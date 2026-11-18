import crypto from 'node:crypto';
import {
  ELIMINATION_DURATION_MS,
  EVENT_RESOLUTION_DURATION_MS,
  NEXT_TURN_DURATION_MS,
  ROUND_INTRO_DURATION_MS,
  STARTING_DURATION_MS,
  computeStepRisk,
  type ClientToServerEvents,
  type GameActionPayload,
  type GameEventPayload,
  type ServerAckResponse,
  type ServerToClientEvents,
} from '@last-round/shared';
import type { Server } from 'socket.io';
import { persistCompletedMatch } from '../database/persistence.js';
import { roomStore, type ServerRoomRecord } from '../rooms/RoomStore.js';
import { createSeededRng, generateSeed, shuffleWithRng } from '../utils/rng.js';

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

export class GameEngine {
  constructor(private readonly io: TypedServer) {}

  public startMatch(record: ServerRoomRecord, actorSocketId: string): ServerAckResponse {
    const room = record.state;
    const requesterId = record.socketToMemberId.get(actorSocketId);

    if (!requesterId || requesterId !== room.hostId) {
      return { ok: false, error: { code: 'NOT_HOST', message: 'Only the room host can start the match.' } };
    }

    if (room.game && room.game.phase !== 'WAITING' && room.game.phase !== 'RESULTS') {
      return { ok: false, error: { code: 'ALREADY_STARTED', message: 'A match is already in progress.' } };
    }

    const activePlayers = room.players.filter((p) => p.connectionStatus !== 'DISCONNECTED');
    if (activePlayers.length < 2) {
      return { ok: false, error: { code: 'INSUFFICIENT_PLAYERS', message: 'At least 2 players are required.' } };
    }

    const unreadyNonHost = activePlayers.filter((p) => !p.isHost && !p.isReady);
    if (unreadyNonHost.length > 0) {
      return { ok: false, error: { code: 'PLAYERS_NOT_READY', message: 'All players must be ready before starting.' } };
    }

    const rules = room.game?.rules ?? {
      minPlayers: 2,
      maxPlayers: 6,
      turnDurationMs: 20_000,
      allowPassOption: true,
      maxPassesPerPlayer: 1,
      baseRiskProbability: 1 / 6,
      escalateRiskEachTurn: true,
      riskStepIncrement: 1 / 6,
      allowSpectatorChat: true,
    };

    const seed = generateSeed();
    const rng = createSeededRng(seed);
    const matchId = crypto.randomUUID();

    // Reset player match flags
    for (const p of room.players) {
      p.isAlive = true;
      p.passesRemaining = rules.maxPassesPerPlayer;
    }

    const turnOrder = shuffleWithRng(
      room.players.map((p) => p.id),
      rng
    );

    if (record.internalMatch?.phaseTimerHandle) {
      clearTimeout(record.internalMatch.phaseTimerHandle);
    }

    record.internalMatch = {
      seed,
      rng,
      stepInRound: 0,
      startedAt: Date.now(),
      processedActionIds: new Set(),
      phaseTimerHandle: null,
    };

    room.game = {
      matchId,
      roundNumber: 1,
      phase: 'STARTING',
      turnOrder,
      currentTurnPlayerId: null,
      turnStartedAt: null,
      turnEndsAt: null,
      currentRiskFactor: computeStepRisk(rules, 0),
      winnerId: null,
      lastEvent: null,
      rules,
    };

    record.lastActivityAt = Date.now();
    this.io.to(room.roomCode).emit('game:started', { room });
    this.io.to(room.roomCode).emit('room:updated', { room });

    this.schedulePhaseTransition(record, STARTING_DURATION_MS, () => {
      this.enterRoundIntro(record);
    });

    return { ok: true };
  }

  private enterRoundIntro(record: ServerRoomRecord): void {
    const room = record.state;
    if (!room.game || !record.internalMatch) return;

    record.internalMatch.stepInRound = 0;
    room.game.phase = 'ROUND_INTRO';
    room.game.currentRiskFactor = computeStepRisk(room.game.rules, 0);

    this.broadcastGameAndRoom(record);

    this.schedulePhaseTransition(record, ROUND_INTRO_DURATION_MS, () => {
      const aliveIds = room.game!.turnOrder.filter((id) =>
        room.players.some((p) => p.id === id && p.isAlive)
      );
      if (aliveIds.length <= 1) {
        this.finishMatch(record, aliveIds[0] ?? null);
        return;
      }
      this.beginPlayerTurn(record, aliveIds[0]);
    });
  }

  private beginPlayerTurn(record: ServerRoomRecord, playerId: string): void {
    const room = record.state;
    if (!room.game || !record.internalMatch) return;

    const player = room.players.find((p) => p.id === playerId && p.isAlive);
    if (!player) {
      this.advanceToNextTurn(record, playerId);
      return;
    }

    const now = Date.now();
    const duration = room.game.rules.turnDurationMs;
    const risk = computeStepRisk(room.game.rules, record.internalMatch.stepInRound);

    room.game.phase = 'PLAYER_TURN';
    room.game.currentTurnPlayerId = player.id;
    room.game.turnStartedAt = now;
    room.game.turnEndsAt = now + duration;
    room.game.currentRiskFactor = risk;

    this.io.to(room.roomCode).emit('game:turn', {
      currentTurnPlayerId: player.id,
      turnStartedAt: now,
      turnEndsAt: now + duration,
      currentRiskFactor: risk,
    });
    this.broadcastGameAndRoom(record);

    // Server-authoritative turn timeout: auto-executes TAKE_CHANCE
    this.schedulePhaseTransition(record, duration, () => {
      if (!room.game || room.game.phase !== 'PLAYER_TURN') return;
      if (room.game.currentTurnPlayerId !== player.id) return;
      this.resolvePlayerAction(record, player.id, {
        actionId: crypto.randomUUID(),
        actionType: 'TAKE_CHANCE',
      });
    });
  }

  public submitAction(
    record: ServerRoomRecord,
    socketId: string,
    payload: GameActionPayload
  ): ServerAckResponse {
    const room = record.state;
    if (!room.game || !record.internalMatch) {
      return { ok: false, error: { code: 'NO_ACTIVE_MATCH', message: 'No active match.' } };
    }

    const memberId = record.socketToMemberId.get(socketId);
    if (!memberId) {
      return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not a member of this room.' } };
    }

    // Block spectators explicitly
    const isSpectator = room.spectators.some((s) => s.id === memberId);
    if (isSpectator) {
      return { ok: false, error: { code: 'SPECTATOR_FORBIDDEN', message: 'Spectators cannot perform gameplay actions.' } };
    }

    if (room.game.phase !== 'PLAYER_TURN') {
      return { ok: false, error: { code: 'INVALID_PHASE', message: 'Actions are only allowed during a player turn.' } };
    }

    if (room.game.currentTurnPlayerId !== memberId) {
      return { ok: false, error: { code: 'NOT_YOUR_TURN', message: 'It is not your turn.' } };
    }

    if (record.internalMatch.processedActionIds.has(payload.actionId)) {
      return { ok: false, error: { code: 'DUPLICATE_ACTION', message: 'Duplicate action ignored.' } };
    }

    const player = room.players.find((p) => p.id === memberId);
    if (!player || !player.isAlive) {
      return { ok: false, error: { code: 'PLAYER_ELIMINATED', message: 'Eliminated players cannot act.' } };
    }

    if (payload.actionType === 'PASS_TURN') {
      if (!room.game.rules.allowPassOption || player.passesRemaining <= 0) {
        return { ok: false, error: { code: 'NO_PASSES_LEFT', message: 'No pass tokens remaining.' } };
      }
    }

    return this.resolvePlayerAction(record, memberId, payload);
  }

  private resolvePlayerAction(
    record: ServerRoomRecord,
    playerId: string,
    payload: GameActionPayload
  ): ServerAckResponse {
    const room = record.state;
    const game = room.game;
    const internal = record.internalMatch;
    if (!game || !internal) {
      return { ok: false, error: { code: 'NO_ACTIVE_MATCH', message: 'No active match.' } };
    }

    const player = room.players.find((p) => p.id === playerId);
    if (!player) {
      return { ok: false, error: { code: 'PLAYER_NOT_FOUND', message: 'Player not found.' } };
    }

    internal.processedActionIds.add(payload.actionId);
    if (internal.phaseTimerHandle) {
      clearTimeout(internal.phaseTimerHandle);
      internal.phaseTimerHandle = null;
    }

    record.lastActivityAt = Date.now();
    game.phase = 'EVENT_RESOLUTION';
    game.turnStartedAt = null;
    game.turnEndsAt = null;

    let outcome: GameEventPayload['outcome'] = 'SAFE';

    if (payload.actionType === 'PASS_TURN') {
      player.passesRemaining = Math.max(0, player.passesRemaining - 1);
      outcome = 'PASSED';
    } else {
      const risk = computeStepRisk(game.rules, internal.stepInRound);
      const roll = internal.rng();
      if (roll < risk) {
        outcome = 'ELIMINATED';
      } else {
        outcome = 'SAFE';
        internal.stepInRound += 1;
      }
    }

    const eventPayload: GameEventPayload = {
      eventId: payload.actionId,
      matchId: game.matchId,
      roundNumber: game.roundNumber,
      actorPlayerId: player.id,
      actorName: player.displayName,
      actionType: payload.actionType,
      outcome,
      timestamp: Date.now(),
    };

    game.lastEvent = eventPayload;
    this.io.to(room.roomCode).emit('game:event', eventPayload);
    this.broadcastGameAndRoom(record);

    this.schedulePhaseTransition(record, EVENT_RESOLUTION_DURATION_MS, () => {
      if (outcome === 'ELIMINATED') {
        this.handlePlayerElimination(record, player.id);
      } else {
        this.advanceToNextTurn(record, player.id);
      }
    });

    return { ok: true };
  }

  public handlePlayerElimination(record: ServerRoomRecord, playerId: string): void {
    const room = record.state;
    const game = room.game;
    if (!game) return;

    const player = room.players.find((p) => p.id === playerId);
    if (player) {
      player.isAlive = false;
    }

    game.phase = 'PLAYER_ELIMINATION';
    this.io.to(room.roomCode).emit('game:eliminated', {
      playerId,
      roundNumber: game.roundNumber,
    });
    this.broadcastGameAndRoom(record);

    this.schedulePhaseTransition(record, ELIMINATION_DURATION_MS, () => {
      const survivors = room.players.filter((p) => p.isAlive);
      if (survivors.length <= 1) {
        this.finishMatch(record, survivors[0]?.id ?? null);
        return;
      }
      game.roundNumber += 1;
      this.enterRoundIntro(record);
    });
  }

  private advanceToNextTurn(record: ServerRoomRecord, previousPlayerId: string): void {
    const room = record.state;
    const game = room.game;
    if (!game) return;

    const survivors = room.players.filter((p) => p.isAlive);
    if (survivors.length <= 1) {
      this.finishMatch(record, survivors[0]?.id ?? null);
      return;
    }

    game.phase = 'NEXT_TURN';
    this.broadcastGameAndRoom(record);

    const aliveOrderedIds = game.turnOrder.filter((id) =>
      survivors.some((s) => s.id === id)
    );

    const prevIndex = game.turnOrder.indexOf(previousPlayerId);
    let nextPlayerId = aliveOrderedIds[0];

    for (let offset = 1; offset <= game.turnOrder.length; offset++) {
      const candidateId = game.turnOrder[(prevIndex + offset) % game.turnOrder.length];
      if (aliveOrderedIds.includes(candidateId)) {
        nextPlayerId = candidateId;
        break;
      }
    }

    this.schedulePhaseTransition(record, NEXT_TURN_DURATION_MS, () => {
      this.beginPlayerTurn(record, nextPlayerId);
    });
  }

  private finishMatch(record: ServerRoomRecord, winnerId: string | null): void {
    const room = record.state;
    const game = room.game;
    if (!game) return;

    if (record.internalMatch?.phaseTimerHandle) {
      clearTimeout(record.internalMatch.phaseTimerHandle);
      record.internalMatch.phaseTimerHandle = null;
    }

    game.phase = 'GAME_OVER';
    game.winnerId = winnerId;
    game.currentTurnPlayerId = null;
    game.turnStartedAt = null;
    game.turnEndsAt = null;

    const winner = room.players.find((p) => p.id === winnerId);

    this.io.to(room.roomCode).emit('game:finished', {
      winnerId: winnerId ?? '',
      room,
    });
    this.broadcastGameAndRoom(record);

    void persistCompletedMatch({
      matchId: game.matchId,
      roomCode: room.roomCode,
      winnerName: winner?.displayName ?? 'No Survivor',
      playerCount: room.players.length,
      rounds: game.roundNumber,
      startedAt: new Date(record.internalMatch?.startedAt ?? Date.now()),
    });

    this.schedulePhaseTransition(record, 2_500, () => {
      if (!room.game) return;
      room.game.phase = 'RESULTS';
      for (const p of room.players) {
        if (!p.isHost) {
          p.isReady = false;
        }
      }
      this.broadcastGameAndRoom(record);
    });
  }

  private broadcastGameAndRoom(record: ServerRoomRecord): void {
    if (record.state.game) {
      this.io.to(record.state.roomCode).emit('game:state', { game: record.state.game });
    }
    this.io.to(record.state.roomCode).emit('room:updated', { room: record.state });
  }

  private schedulePhaseTransition(
    record: ServerRoomRecord,
    delayMs: number,
    fn: () => void
  ): void {
    if (!record.internalMatch) return;
    if (record.internalMatch.phaseTimerHandle) {
      clearTimeout(record.internalMatch.phaseTimerHandle);
    }
    record.internalMatch.phaseTimerHandle = setTimeout(() => {
      if (!roomStore.has(record.state.roomCode)) return;
      fn();
    }, delayMs);
  }
}
