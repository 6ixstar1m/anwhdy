export type GamePhase =
  | 'WAITING'
  | 'STARTING'
  | 'ROUND_INTRO'
  | 'PLAYER_TURN'
  | 'EVENT_RESOLUTION'
  | 'PLAYER_ELIMINATION'
  | 'NEXT_TURN'
  | 'GAME_OVER'
  | 'RESULTS';

export type PlayerConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';

export type PlayerActionType = 'TAKE_CHANCE' | 'PASS_TURN';

export type EventOutcomeType = 'SAFE' | 'ELIMINATED' | 'PASSED';

export interface AvatarConfig {
  bodyType: 'masculine' | 'feminine';
  skinTone: string;
  hairStyle: 'short' | 'slick' | 'bob' | 'ponytail' | 'buzz' | 'waves';
  hairColor: string;
  outfit: 'tailored_coat' | 'turtleneck' | 'leather_jacket' | 'vest_shirt' | 'hoodie_dark';
  outfitColor: string;
  accessory: 'none' | 'glasses' | 'scar' | 'earpiece' | 'watch';
  facePreset: number;
}

export interface PlayerState {
  id: string;
  sessionId: string;
  displayName: string;
  seatIndex: number;
  isHost: boolean;
  isReady: boolean;
  isAlive: boolean;
  passesRemaining: number;
  connectionStatus: PlayerConnectionStatus;
  avatar: AvatarConfig;
  isMuted: boolean;
  isSpeaking: boolean;
}

export interface SpectatorState {
  id: string;
  sessionId: string;
  displayName: string;
  connectionStatus: PlayerConnectionStatus;
  eliminatedFromSeat?: number;
}

export interface GameRulesConfig {
  minPlayers: number;
  maxPlayers: number;
  turnDurationMs: number;
  allowPassOption: boolean;
  maxPassesPerPlayer: number;
  baseRiskProbability: number;
  escalateRiskEachTurn: boolean;
  riskStepIncrement: number;
  allowSpectatorChat: boolean;
}

export interface GamePublicState {
  matchId: string;
  roundNumber: number;
  phase: GamePhase;
  turnOrder: string[];
  currentTurnPlayerId: string | null;
  turnStartedAt: number | null;
  turnEndsAt: number | null;
  currentRiskFactor: number;
  winnerId: string | null;
  lastEvent: GameEventPayload | null;
  rules: GameRulesConfig;
}

export interface RoomState {
  roomCode: string;
  hostId: string;
  isPrivate: boolean;
  allowSpectators: boolean;
  players: PlayerState[];
  spectators: SpectatorState[];
  game: GamePublicState | null;
  createdAt: number;
}

export interface GameEventPayload {
  eventId: string;
  matchId: string;
  roundNumber: number;
  actorPlayerId: string;
  actorName: string;
  actionType: PlayerActionType;
  outcome: EventOutcomeType;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  roomCode: string;
  senderId: string;
  senderName: string;
  senderRole: 'PLAYER' | 'SPECTATOR';
  content: string;
  timestamp: number;
}
