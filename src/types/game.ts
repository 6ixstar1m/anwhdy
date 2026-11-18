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

export type TurnOwner = 'player' | 'dealer';
export type AimTarget = 'idle' | 'dealer' | 'player';

export interface CombatLog {
  id: string;
  text: string;
  tone: 'neutral' | 'danger' | 'success' | 'item' | 'info';
}
