import crypto from 'node:crypto';
import {
  AvatarConfigSchema,
  CHAT_RATE_LIMIT_MAX_MESSAGES,
  CHAT_RATE_LIMIT_WINDOW_MS,
  ChatSendPayloadSchema,
  GameActionPayloadSchema,
  HostControlPayloadSchema,
  MAX_CHAT_MESSAGE_LENGTH,
  RoomCreatePayloadSchema,
  RoomJoinPayloadSchema,
  RoomReadyPayloadSchema,
  SpectatorJoinPayloadSchema,
  VoiceSignalPayloadSchema,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@last-round/shared';
import type { Server, Socket } from 'socket.io';
import { RoomManager } from '../rooms/RoomManager.js';
import { sanitizeText } from '../utils/sanitize.js';

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function registerSocketHandlers(io: TypedServer): RoomManager {
  const roomManager = new RoomManager(io);

  io.on('connection', (socket: TypedSocket) => {
    const chatTimestamps: number[] = [];

    socket.on('system:ping', (callback) => {
      if (typeof callback === 'function') {
        callback({
          serverTime: Date.now(),
          version: '1.0.0',
        });
      }
    });

    socket.on('room:create', (rawPayload, callback) => {
      const parsed = RoomCreatePayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        callback?.({
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid room creation parameters.' },
        });
        return;
      }

      const result = roomManager.createRoom(socket.id, parsed.data);
      if (result.ok && result.data) {
        void socket.join(result.data.room.roomCode);
        socket.emit('room:created', result.data);
      }
      callback?.(result);
    });

    socket.on('room:join', (rawPayload, callback) => {
      const parsed = RoomJoinPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        callback?.({
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid room code or player details.' },
        });
        return;
      }

      const result = roomManager.joinRoom(socket.id, parsed.data);
      if (result.ok && result.data) {
        const roomCode = result.data.room.roomCode;
        void socket.join(roomCode);
        socket.to(roomCode).emit('player:joined', {
          roomCode,
          playerId: result.data.playerId,
        });
        io.to(roomCode).emit('room:updated', { room: result.data.room });
      }
      callback?.(result);
    });

    socket.on('spectator:join', (rawPayload, callback) => {
      const parsed = SpectatorJoinPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        callback?.({
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid spectator join request.' },
        });
        return;
      }

      const result = roomManager.joinAsSpectator(socket.id, parsed.data);
      if (result.ok && result.data) {
        const roomCode = result.data.room.roomCode;
        void socket.join(roomCode);
        io.to(roomCode).emit('room:updated', { room: result.data.room });
      }
      callback?.(result);
    });

    socket.on('room:leave', () => {
      const record = roomManager.getRoomBySocket(socket.id);
      if (record) {
        void socket.leave(record.state.roomCode);
      }
      roomManager.leaveCurrentRoom(socket.id);
    });

    socket.on('spectator:leave', () => {
      const record = roomManager.getRoomBySocket(socket.id);
      if (record) {
        void socket.leave(record.state.roomCode);
      }
      roomManager.leaveCurrentRoom(socket.id);
    });

    socket.on('room:ready', (rawPayload) => {
      const parsed = RoomReadyPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) return;
      roomManager.setReady(socket.id, parsed.data.isReady);
    });

    socket.on('avatar:update', (rawPayload) => {
      const parsed = AvatarConfigSchema.safeParse(rawPayload);
      if (!parsed.success) return;
      roomManager.updateAvatar(socket.id, parsed.data);
    });

    socket.on('room:host-control', (rawPayload) => {
      const parsed = HostControlPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) return;
      roomManager.handleHostControl(socket.id, parsed.data);
    });

    socket.on('room:start', (callback) => {
      const record = roomManager.getRoomBySocket(socket.id);
      if (!record) {
        callback?.({ ok: false, error: { code: 'NOT_IN_ROOM', message: 'You are not in a room.' } });
        return;
      }
      const res = roomManager.gameEngine.startMatch(record, socket.id);
      callback?.(res);
    });

    socket.on('game:action', (rawPayload, callback) => {
      const parsed = GameActionPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        callback?.({
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid gameplay action payload.' },
        });
        return;
      }

      const record = roomManager.getRoomBySocket(socket.id);
      if (!record) {
        callback?.({ ok: false, error: { code: 'NOT_IN_ROOM', message: 'You are not in a room.' } });
        return;
      }

      const res = roomManager.gameEngine.submitAction(record, socket.id, parsed.data);
      callback?.(res);
    });

    socket.on('chat:send', (rawPayload) => {
      const parsed = ChatSendPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) return;

      const record = roomManager.getRoomBySocket(socket.id);
      if (!record) return;

      const memberId = record.socketToMemberId.get(socket.id);
      if (!memberId) return;

      // Sliding window rate limiting
      const now = Date.now();
      while (chatTimestamps.length > 0 && now - chatTimestamps[0] > CHAT_RATE_LIMIT_WINDOW_MS) {
        chatTimestamps.shift();
      }
      if (chatTimestamps.length >= CHAT_RATE_LIMIT_MAX_MESSAGES) {
        socket.emit('room:error', {
          code: 'CHAT_RATE_LIMIT',
          message: 'You are sending messages too quickly.',
        });
        return;
      }
      chatTimestamps.push(now);

      const player = record.state.players.find((p) => p.id === memberId);
      const spectator = record.state.spectators.find((s) => s.id === memberId);

      if (!player && !spectator) return;

      if (spectator && record.state.game && !record.state.game.rules.allowSpectatorChat) {
        socket.emit('room:error', {
          code: 'SPECTATOR_CHAT_DISABLED',
          message: 'Spectator chat is disabled in this room.',
        });
        return;
      }

      const sanitized = sanitizeText(parsed.data.content, MAX_CHAT_MESSAGE_LENGTH);
      if (!sanitized) return;

      io.to(record.state.roomCode).emit('chat:message', {
        id: crypto.randomUUID(),
        roomCode: record.state.roomCode,
        senderId: memberId,
        senderName: player ? player.displayName : spectator!.displayName,
        senderRole: player ? 'PLAYER' : 'SPECTATOR',
        content: sanitized,
        timestamp: now,
      });
    });

    // WebRTC peer-to-peer signaling isolated strictly to members inside the same room
    const relayVoiceSignal = (
      type: 'offer' | 'answer' | 'ice-candidate',
      rawPayload: unknown
    ) => {
      const parsed = VoiceSignalPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) return;

      const record = roomManager.getRoomBySocket(socket.id);
      if (!record) return;

      const senderMemberId = record.socketToMemberId.get(socket.id);
      if (!senderMemberId) return;

      for (const [targetSocketId, memberId] of record.socketToMemberId.entries()) {
        if (memberId === parsed.data.targetPeerId) {
          io.to(targetSocketId).emit('voice:signal', {
            fromPeerId: senderMemberId,
            type,
            sdp: parsed.data.sdp,
            candidate: parsed.data.candidate,
          });
          break;
        }
      }
    };

    socket.on('voice:offer', (payload) => relayVoiceSignal('offer', payload));
    socket.on('voice:answer', (payload) => relayVoiceSignal('answer', payload));
    socket.on('voice:ice-candidate', (payload) => relayVoiceSignal('ice-candidate', payload));

    socket.on('voice:speaking', (payload) => {
      if (typeof payload?.isSpeaking !== 'boolean' || typeof payload?.isMuted !== 'boolean') {
        return;
      }
      roomManager.updateVoiceState(socket.id, payload.isSpeaking, payload.isMuted);
    });

    socket.on('disconnect', () => {
      roomManager.handleDisconnect(socket.id);
    });
  });

  return roomManager;
}
