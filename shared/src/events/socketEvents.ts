import { z } from 'zod';
import { MAX_CHAT_MESSAGE_LENGTH, ROOM_CODE_LENGTH } from '../constants/index.js';
import type {
  AvatarConfig,
  ChatMessage,
  GameEventPayload,
  GamePublicState,
  GameRulesConfig,
  RoomState,
} from '../types/game.js';

export const AvatarConfigSchema: z.ZodType<AvatarConfig> = z.object({
  bodyType: z.enum(['masculine', 'feminine']),
  skinTone: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  hairStyle: z.enum(['short', 'slick', 'bob', 'ponytail', 'buzz', 'waves']),
  hairColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  outfit: z.enum(['tailored_coat', 'turtleneck', 'leather_jacket', 'vest_shirt', 'hoodie_dark']),
  outfitColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accessory: z.enum(['none', 'glasses', 'scar', 'earpiece', 'watch']),
  facePreset: z.number().int().min(0).max(5),
});

export const GameRulesOverrideSchema: z.ZodType<Partial<GameRulesConfig>> = z
  .object({
    turnDurationMs: z.number().int().min(8_000).max(60_000).optional(),
    allowPassOption: z.boolean().optional(),
    maxPassesPerPlayer: z.number().int().min(0).max(3).optional(),
    escalateRiskEachTurn: z.boolean().optional(),
    allowSpectatorChat: z.boolean().optional(),
  })
  .strict();

export const RoomCreatePayloadSchema = z.object({
  requestId: z.string().uuid(),
  sessionId: z.string().min(8).max(128),
  displayName: z.string().trim().min(2).max(24),
  avatar: AvatarConfigSchema.optional(),
  allowSpectators: z.boolean().default(true),
  rules: GameRulesOverrideSchema.optional(),
});

export const RoomJoinPayloadSchema = z.object({
  requestId: z.string().uuid(),
  sessionId: z.string().min(8).max(128),
  roomCode: z.string().trim().toUpperCase().length(ROOM_CODE_LENGTH),
  displayName: z.string().trim().min(2).max(24),
  avatar: AvatarConfigSchema.optional(),
});

export const SpectatorJoinPayloadSchema = z.object({
  requestId: z.string().uuid(),
  sessionId: z.string().min(8).max(128),
  roomCode: z.string().trim().toUpperCase().length(ROOM_CODE_LENGTH),
  displayName: z.string().trim().min(2).max(24),
});

export const RoomReadyPayloadSchema = z.object({
  isReady: z.boolean(),
});

export const HostControlPayloadSchema = z.object({
  action: z.enum(['KICK_PLAYER', 'TOGGLE_SPECTATORS', 'CLOSE_ROOM', 'REMATCH']),
  targetPlayerId: z.string().optional(),
});

export const GameActionPayloadSchema = z.object({
  actionId: z.string().uuid(),
  actionType: z.enum(['TAKE_CHANCE', 'PASS_TURN']),
});

export const ChatSendPayloadSchema = z.object({
  content: z.string().trim().min(1).max(MAX_CHAT_MESSAGE_LENGTH),
});

export const VoiceSignalPayloadSchema = z.object({
  targetPeerId: z.string().min(1).max(128),
  sdp: z.unknown().optional(),
  candidate: z.unknown().optional(),
});

export type RoomCreatePayload = z.infer<typeof RoomCreatePayloadSchema>;
export type RoomJoinPayload = z.infer<typeof RoomJoinPayloadSchema>;
export type SpectatorJoinPayload = z.infer<typeof SpectatorJoinPayloadSchema>;
export type RoomReadyPayload = z.infer<typeof RoomReadyPayloadSchema>;
export type HostControlPayload = z.infer<typeof HostControlPayloadSchema>;
export type GameActionPayload = z.infer<typeof GameActionPayloadSchema>;
export type ChatSendPayload = z.infer<typeof ChatSendPayloadSchema>;
export type VoiceSignalPayload = z.infer<typeof VoiceSignalPayloadSchema>;

export interface ServerAckResponse<T = undefined> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface ClientToServerEvents {
  'system:ping': (callback: (res: { serverTime: number; version: string }) => void) => void;
  'room:create': (
    payload: RoomCreatePayload,
    callback: (res: ServerAckResponse<{ room: RoomState; playerId: string }>) => void
  ) => void;
  'room:join': (
    payload: RoomJoinPayload,
    callback: (res: ServerAckResponse<{ room: RoomState; playerId: string }>) => void
  ) => void;
  'room:leave': () => void;
  'room:ready': (payload: RoomReadyPayload) => void;
  'room:start': (callback?: (res: ServerAckResponse) => void) => void;
  'room:host-control': (payload: HostControlPayload) => void;
  'game:action': (
    payload: GameActionPayload,
    callback?: (res: ServerAckResponse) => void
  ) => void;
  'chat:send': (payload: ChatSendPayload) => void;
  'voice:offer': (payload: VoiceSignalPayload) => void;
  'voice:answer': (payload: VoiceSignalPayload) => void;
  'voice:ice-candidate': (payload: VoiceSignalPayload) => void;
  'voice:speaking': (payload: { isSpeaking: boolean; isMuted: boolean }) => void;
  'avatar:update': (payload: AvatarConfig) => void;
  'spectator:join': (
    payload: SpectatorJoinPayload,
    callback: (res: ServerAckResponse<{ room: RoomState; spectatorId: string }>) => void
  ) => void;
  'spectator:leave': () => void;
}

export interface ServerToClientEvents {
  'room:created': (payload: { room: RoomState; playerId: string }) => void;
  'room:updated': (payload: { room: RoomState }) => void;
  'room:closed': (payload: { roomCode: string; reason: string }) => void;
  'room:error': (payload: { code: string; message: string }) => void;
  'player:joined': (payload: { roomCode: string; playerId: string }) => void;
  'player:left': (payload: { roomCode: string; playerId: string }) => void;
  'game:started': (payload: { room: RoomState }) => void;
  'game:state': (payload: { game: GamePublicState }) => void;
  'game:turn': (payload: {
    currentTurnPlayerId: string;
    turnStartedAt: number;
    turnEndsAt: number;
    currentRiskFactor: number;
  }) => void;
  'game:event': (payload: GameEventPayload) => void;
  'game:eliminated': (payload: { playerId: string; roundNumber: number }) => void;
  'game:finished': (payload: { winnerId: string; room: RoomState }) => void;
  'chat:message': (payload: ChatMessage) => void;
  'voice:signal': (payload: {
    fromPeerId: string;
    type: 'offer' | 'answer' | 'ice-candidate';
    sdp?: unknown;
    candidate?: unknown;
  }) => void;
  'player:speaking': (payload: {
    peerId: string;
    isSpeaking: boolean;
    isMuted: boolean;
  }) => void;
}
