export type ShellType = 'live' | 'blank';

export type ItemId =
  | 'kevlar'
  | 'ricochet'
  | 'charm'
  | 'adrenaline'
  | 'smoke'
  | 'visor'
  | 'scanner'
  | 'ejector';

export interface ItemDefinition {
  id: ItemId;
  nameTh: string;
  nameEn: string;
  category: 'defense' | 'recovery' | 'tactical';
  description: string;
  color: string;
}

export interface InventoryItem {
  uid: string;
  itemId: ItemId;
}

export interface ActiveBuffs {
  kevlar: boolean;
  ricochet: boolean;
  charm: boolean;
  visor: boolean;
  smokedTurns: number;
}

export interface AvatarConfig {
  coatColor: string;
  eyeColor: string;
  maskStyle: 'shadow' | 'visor' | 'skull';
}

export interface RoomPlayer {
  id: string;
  name: string;
  avatar: AvatarConfig;
  ready: boolean;
  role: 'player' | 'spectator';
  hearts: number;
  inventory: InventoryItem[];
  buffs: ActiveBuffs;
  isSpeaking?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface CombatLog {
  id: string;
  text: string;
  tone: 'neutral' | 'danger' | 'success' | 'item' | 'info';
}

export interface OnlineRoomState {
  code: string;
  name: string;
  isPublic: boolean;
  maxPlayers: number;
  status: 'lobby' | 'playing' | 'ended';
  hostId: string;
  roundNumber: number;
  shellsRemaining: number;
  turnPlayerId: string | null;
  winnerId: string | null;
  players: RoomPlayer[];
  logs: CombatLog[];
  chat: ChatMessage[];
}

export interface PublicRoomSummary {
  code: string;
  name: string;
  status: 'lobby' | 'playing' | 'ended';
  playerCount: number;
  maxPlayers: number;
  hostName: string;
}

export interface TableOpponent {
  id: string;
  name: string;
  hearts: number;
  buffs: ActiveBuffs;
  avatar?: AvatarConfig;
  inventory: InventoryItem[];
  isTurn: boolean;
}

export type AimTarget = 'idle' | 'self' | number;
