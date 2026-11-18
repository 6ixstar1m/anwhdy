import crypto from 'node:crypto';
import {
  DEFAULT_AVATAR_CONFIG,
  DEFAULT_GAME_RULES,
  MAX_ACTIVE_PLAYERS,
  MAX_SPECTATORS,
  RECONNECT_GRACE_PERIOD_MS,
  ROOM_IDLE_TTL_MS,
  type AvatarConfig,
  type ClientToServerEvents,
  type HostControlPayload,
  type PlayerState,
  type RoomCreatePayload,
  type RoomJoinPayload,
  type RoomState,
  type ServerAckResponse,
  type ServerToClientEvents,
  type SpectatorJoinPayload,
  type SpectatorState,
} from '@last-round/shared';
import type { Server } from 'socket.io';
import { persistRoomCreated } from '../database/persistence.js';
import { GameEngine } from '../game/GameEngine.js';
import { generateRoomCode } from '../utils/rng.js';
import { sanitizeText } from '../utils/sanitize.js';
import { roomStore, type ServerRoomRecord } from './RoomStore.js';

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

export class RoomManager {
  public readonly gameEngine: GameEngine;
  private readonly socketToRoomCode = new Map<string, string>();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(private readonly io: TypedServer) {
    this.gameEngine = new GameEngine(io);
    this.cleanupInterval = setInterval(() => this.cleanupAbandonedRooms(), 60_000);
    this.cleanupInterval.unref();
  }

  public getRoomBySocket(socketId: string): ServerRoomRecord | undefined {
    const code = this.socketToRoomCode.get(socketId);
    if (!code) return undefined;
    return roomStore.get(code);
  }

  public createRoom(
    socketId: string,
    payload: RoomCreatePayload
  ): ServerAckResponse<{ room: RoomState; playerId: string }> {
    // Leave any previous room first to maintain strict room isolation
    this.leaveCurrentRoom(socketId);

    let roomCode = generateRoomCode();
    let attempts = 0;
    while (roomStore.has(roomCode) && attempts < 20) {
      roomCode = generateRoomCode();
      attempts++;
    }

    const playerId = crypto.randomUUID();
    const safeName = sanitizeText(payload.displayName, 24) || 'Player 1';

    const hostPlayer: PlayerState = {
      id: playerId,
      sessionId: payload.sessionId,
      displayName: safeName,
      seatIndex: 0,
      isHost: true,
      isReady: true,
      isAlive: true,
      passesRemaining: payload.rules?.maxPassesPerPlayer ?? DEFAULT_GAME_RULES.maxPassesPerPlayer,
      connectionStatus: 'CONNECTED',
      avatar: payload.avatar ?? { ...DEFAULT_AVATAR_CONFIG },
      isMuted: false,
      isSpeaking: false,
    };

    const rules = {
      ...DEFAULT_GAME_RULES,
      ...(payload.rules ?? {}),
    };

    const roomState: RoomState = {
      roomCode,
      hostId: playerId,
      isPrivate: true,
      allowSpectators: payload.allowSpectators,
      players: [hostPlayer],
      spectators: [],
      game: {
        matchId: '',
        roundNumber: 0,
        phase: 'WAITING',
        turnOrder: [],
        currentTurnPlayerId: null,
        turnStartedAt: null,
        turnEndsAt: null,
        currentRiskFactor: rules.baseRiskProbability,
        winnerId: null,
        lastEvent: null,
        rules,
      },
      createdAt: Date.now(),
    };

    const record: ServerRoomRecord = {
      state: roomState,
      internalMatch: null,
      socketToMemberId: new Map([[socketId, playerId]]),
      sessionToMemberId: new Map([[payload.sessionId, playerId]]),
      disconnectTimers: new Map(),
      processedRequestIds: new Set([payload.requestId]),
      lastActivityAt: Date.now(),
    };

    roomStore.set(roomCode, record);
    this.socketToRoomCode.set(socketId, roomCode);

    void persistRoomCreated({
      roomCode,
      isPrivate: true,
      allowSpectators: payload.allowSpectators,
    });

    return { ok: true, data: { room: roomState, playerId } };
  }

  public joinRoom(
    socketId: string,
    payload: RoomJoinPayload
  ): ServerAckResponse<{ room: RoomState; playerId: string }> {
    const record = roomStore.get(payload.roomCode);
    if (!record) {
      return { ok: false, error: { code: 'ROOM_NOT_FOUND', message: 'Room code does not exist.' } };
    }

    // Reconnection check by sessionId before creating a duplicate entry
    const existingMemberId = record.sessionToMemberId.get(payload.sessionId);
    if (existingMemberId) {
      const existingPlayer = record.state.players.find((p) => p.id === existingMemberId);
      if (existingPlayer) {
        const timer = record.disconnectTimers.get(existingPlayer.id);
        if (timer) {
          clearTimeout(timer);
          record.disconnectTimers.delete(existingPlayer.id);
        }
        // Remove stale socket mapping if any
        for (const [oldSock, mId] of record.socketToMemberId.entries()) {
          if (mId === existingPlayer.id) {
            record.socketToMemberId.delete(oldSock);
            this.socketToRoomCode.delete(oldSock);
          }
        }
        existingPlayer.connectionStatus = 'CONNECTED';
        if (payload.avatar) {
          existingPlayer.avatar = payload.avatar;
        }
        record.socketToMemberId.set(socketId, existingPlayer.id);
        this.socketToRoomCode.set(socketId, record.state.roomCode);
        record.lastActivityAt = Date.now();
        return { ok: true, data: { room: record.state, playerId: existingPlayer.id } };
      }
    }

    if (record.processedRequestIds.has(payload.requestId)) {
      return { ok: false, error: { code: 'DUPLICATE_REQUEST', message: 'Join request already processed.' } };
    }

    const phase = record.state.game?.phase ?? 'WAITING';
    if (phase !== 'WAITING' && phase !== 'RESULTS') {
      return {
        ok: false,
        error: {
          code: 'MATCH_IN_PROGRESS',
          message: 'Match is already underway. You can join as a spectator instead.',
        },
      };
    }

    if (record.state.players.length >= MAX_ACTIVE_PLAYERS) {
      return { ok: false, error: { code: 'ROOM_FULL', message: 'Room has reached the 6-player limit.' } };
    }

    this.leaveCurrentRoom(socketId);

    // Find lowest available seat index [0..5]
    const occupiedSeats = new Set(record.state.players.map((p) => p.seatIndex));
    let seatIndex = 0;
    while (occupiedSeats.has(seatIndex) && seatIndex < MAX_ACTIVE_PLAYERS) {
      seatIndex++;
    }

    const playerId = crypto.randomUUID();
    const safeName = sanitizeText(payload.displayName, 24) || `Player ${seatIndex + 1}`;
    const maxPasses = record.state.game?.rules.maxPassesPerPlayer ?? DEFAULT_GAME_RULES.maxPassesPerPlayer;

    const newPlayer: PlayerState = {
      id: playerId,
      sessionId: payload.sessionId,
      displayName: safeName,
      seatIndex,
      isHost: false,
      isReady: false,
      isAlive: true,
      passesRemaining: maxPasses,
      connectionStatus: 'CONNECTED',
      avatar: payload.avatar ?? { ...DEFAULT_AVATAR_CONFIG },
      isMuted: false,
      isSpeaking: false,
    };

    record.processedRequestIds.add(payload.requestId);
    record.state.players.push(newPlayer);
    record.socketToMemberId.set(socketId, playerId);
    record.sessionToMemberId.set(payload.sessionId, playerId);
    this.socketToRoomCode.set(socketId, record.state.roomCode);
    record.lastActivityAt = Date.now();

    return { ok: true, data: { room: record.state, playerId } };
  }

  public joinAsSpectator(
    socketId: string,
    payload: SpectatorJoinPayload
  ): ServerAckResponse<{ room: RoomState; spectatorId: string }> {
    const record = roomStore.get(payload.roomCode);
    if (!record) {
      return { ok: false, error: { code: 'ROOM_NOT_FOUND', message: 'Room code does not exist.' } };
    }

    if (!record.state.allowSpectators) {
      return {
        ok: false,
        error: { code: 'SPECTATORS_DISABLED', message: 'This room does not allow spectators.' },
      };
    }

    const existingMemberId = record.sessionToMemberId.get(payload.sessionId);
    if (existingMemberId) {
      const existingSpec = record.state.spectators.find((s) => s.id === existingMemberId);
      if (existingSpec) {
        existingSpec.connectionStatus = 'CONNECTED';
        record.socketToMemberId.set(socketId, existingSpec.id);
        this.socketToRoomCode.set(socketId, record.state.roomCode);
        return { ok: true, data: { room: record.state, spectatorId: existingSpec.id } };
      }
    }

    if (record.state.spectators.length >= MAX_SPECTATORS) {
      return { ok: false, error: { code: 'SPECTATOR_LIMIT', message: 'Spectator capacity reached.' } };
    }

    this.leaveCurrentRoom(socketId);

    const spectatorId = crypto.randomUUID();
    const safeName = sanitizeText(payload.displayName, 24) || 'Spectator';

    const spectator: SpectatorState = {
      id: spectatorId,
      sessionId: payload.sessionId,
      displayName: safeName,
      connectionStatus: 'CONNECTED',
    };

    record.processedRequestIds.add(payload.requestId);
    record.state.spectators.push(spectator);
    record.socketToMemberId.set(socketId, spectatorId);
    record.sessionToMemberId.set(payload.sessionId, spectatorId);
    this.socketToRoomCode.set(socketId, record.state.roomCode);
    record.lastActivityAt = Date.now();

    return { ok: true, data: { room: record.state, spectatorId } };
  }

  public setReady(socketId: string, isReady: boolean): void {
    const record = this.getRoomBySocket(socketId);
    if (!record) return;

    const memberId = record.socketToMemberId.get(socketId);
    const player = record.state.players.find((p) => p.id === memberId);
    if (!player) return;

    player.isReady = player.isHost ? true : isReady;
    record.lastActivityAt = Date.now();
    this.io.to(record.state.roomCode).emit('room:updated', { room: record.state });
  }

  public updateAvatar(socketId: string, avatar: AvatarConfig): void {
    const record = this.getRoomBySocket(socketId);
    if (!record) return;

    const memberId = record.socketToMemberId.get(socketId);
    const player = record.state.players.find((p) => p.id === memberId);
    if (!player) return;

    player.avatar = avatar;
    record.lastActivityAt = Date.now();
    this.io.to(record.state.roomCode).emit('room:updated', { room: record.state });
  }

  public updateVoiceState(socketId: string, isSpeaking: boolean, isMuted: boolean): void {
    const record = this.getRoomBySocket(socketId);
    if (!record) return;

    const memberId = record.socketToMemberId.get(socketId);
    if (!memberId) return;

    const player = record.state.players.find((p) => p.id === memberId);
    if (player) {
      player.isSpeaking = isSpeaking;
      player.isMuted = isMuted;
    }

    this.io.to(record.state.roomCode).emit('player:speaking', {
      peerId: memberId,
      isSpeaking,
      isMuted,
    });
  }

  public handleHostControl(socketId: string, payload: HostControlPayload): void {
    const record = this.getRoomBySocket(socketId);
    if (!record) return;

    const requesterId = record.socketToMemberId.get(socketId);
    if (!requesterId || requesterId !== record.state.hostId) return;

    const roomCode = record.state.roomCode;
    record.lastActivityAt = Date.now();

    switch (payload.action) {
      case 'TOGGLE_SPECTATORS': {
        record.state.allowSpectators = !record.state.allowSpectators;
        this.io.to(roomCode).emit('room:updated', { room: record.state });
        break;
      }
      case 'CLOSE_ROOM': {
        this.io.to(roomCode).emit('room:closed', {
          roomCode,
          reason: 'The host closed the room.',
        });
        for (const sockId of record.socketToMemberId.keys()) {
          this.socketToRoomCode.delete(sockId);
        }
        roomStore.delete(roomCode);
        break;
      }
      case 'KICK_PLAYER': {
        if (!payload.targetPlayerId || payload.targetPlayerId === record.state.hostId) return;
        this.removeMemberFromRoom(record, payload.targetPlayerId, true);
        break;
      }
      case 'REMATCH': {
        const phase = record.state.game?.phase;
        if (phase !== 'RESULTS' && phase !== 'GAME_OVER') return;
        if (record.internalMatch?.phaseTimerHandle) {
          clearTimeout(record.internalMatch.phaseTimerHandle);
        }
        record.internalMatch = null;
        for (const p of record.state.players) {
          p.isAlive = true;
          p.isReady = p.isHost;
        }
        if (record.state.game) {
          record.state.game.phase = 'WAITING';
          record.state.game.winnerId = null;
          record.state.game.lastEvent = null;
          record.state.game.currentTurnPlayerId = null;
        }
        this.io.to(roomCode).emit('room:updated', { room: record.state });
        break;
      }
    }
  }

  public handleDisconnect(socketId: string): void {
    const record = this.getRoomBySocket(socketId);
    if (!record) return;

    const memberId = record.socketToMemberId.get(socketId);
    record.socketToMemberId.delete(socketId);
    this.socketToRoomCode.delete(socketId);

    if (!memberId) return;

    const player = record.state.players.find((p) => p.id === memberId);
    if (player) {
      player.connectionStatus = 'RECONNECTING';
      this.io.to(record.state.roomCode).emit('room:updated', { room: record.state });

      const timer = setTimeout(() => {
        record.disconnectTimers.delete(player.id);
        this.removeMemberFromRoom(record, player.id, false);
      }, RECONNECT_GRACE_PERIOD_MS);

      record.disconnectTimers.set(player.id, timer);
      return;
    }

    const specIndex = record.state.spectators.findIndex((s) => s.id === memberId);
    if (specIndex !== -1) {
      const [removed] = record.state.spectators.splice(specIndex, 1);
      record.sessionToMemberId.delete(removed.sessionId);
      this.io.to(record.state.roomCode).emit('room:updated', { room: record.state });
    }
  }

  public leaveCurrentRoom(socketId: string): void {
    const record = this.getRoomBySocket(socketId);
    if (!record) return;

    const memberId = record.socketToMemberId.get(socketId);
    record.socketToMemberId.delete(socketId);
    this.socketToRoomCode.delete(socketId);

    if (memberId) {
      this.removeMemberFromRoom(record, memberId, false);
    }
  }

  private removeMemberFromRoom(
    record: ServerRoomRecord,
    memberId: string,
    wasKicked: boolean
  ): void {
    const roomCode = record.state.roomCode;
    const timer = record.disconnectTimers.get(memberId);
    if (timer) {
      clearTimeout(timer);
      record.disconnectTimers.delete(memberId);
    }

    // Disconnect socket if kicked
    for (const [sockId, mId] of record.socketToMemberId.entries()) {
      if (mId === memberId) {
        record.socketToMemberId.delete(sockId);
        this.socketToRoomCode.delete(sockId);
        const sock = this.io.sockets.sockets.get(sockId);
        if (sock) {
          sock.leave(roomCode);
          if (wasKicked) {
            sock.emit('room:closed', {
              roomCode,
              reason: 'You were removed from the room by the host.',
            });
          }
        }
      }
    }

    const playerIdx = record.state.players.findIndex((p) => p.id === memberId);
    if (playerIdx !== -1) {
      const [removedPlayer] = record.state.players.splice(playerIdx, 1);
      record.sessionToMemberId.delete(removedPlayer.sessionId);

      // Delete room if empty
      if (record.state.players.length === 0) {
        roomStore.delete(roomCode);
        return;
      }

      // Migrate host if host left
      if (record.state.hostId === memberId) {
        const nextHost = record.state.players[0];
        nextHost.isHost = true;
        nextHost.isReady = true;
        record.state.hostId = nextHost.id;
      }

      this.io.to(roomCode).emit('player:left', { roomCode, playerId: memberId });
      this.io.to(roomCode).emit('room:updated', { room: record.state });

      // If match was active and player left mid-match, evaluate remaining survivors
      const phase = record.state.game?.phase;
      if (phase && phase !== 'WAITING' && phase !== 'RESULTS' && phase !== 'GAME_OVER') {
        const survivors = record.state.players.filter((p) => p.isAlive);
        if (survivors.length <= 1) {
          this.gameEngine.handlePlayerElimination(record, memberId);
        } else if (record.state.game?.currentTurnPlayerId === memberId) {
          this.gameEngine.handlePlayerElimination(record, memberId);
        }
      }
      return;
    }

    const specIdx = record.state.spectators.findIndex((s) => s.id === memberId);
    if (specIdx !== -1) {
      const [removedSpec] = record.state.spectators.splice(specIdx, 1);
      record.sessionToMemberId.delete(removedSpec.sessionId);
      this.io.to(roomCode).emit('room:updated', { room: record.state });
    }
  }

  private cleanupAbandonedRooms(): void {
    const now = Date.now();
    for (const [code, record] of roomStore.entries()) {
      const noConnectedSockets = record.socketToMemberId.size === 0;
      if (noConnectedSockets && now - record.lastActivityAt > ROOM_IDLE_TTL_MS) {
        roomStore.delete(code);
      }
    }
  }
}
