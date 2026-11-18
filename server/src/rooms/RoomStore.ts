import type { RoomState } from '@last-round/shared';

export interface ServerInternalMatchState {
  seed: string;
  rng: () => number;
  stepInRound: number;
  startedAt: number;
  processedActionIds: Set<string>;
  phaseTimerHandle: NodeJS.Timeout | null;
}

export interface ServerRoomRecord {
  state: RoomState;
  internalMatch: ServerInternalMatchState | null;
  socketToMemberId: Map<string, string>;
  sessionToMemberId: Map<string, string>;
  disconnectTimers: Map<string, NodeJS.Timeout>;
  processedRequestIds: Set<string>;
  lastActivityAt: number;
}

/**
 * Storage abstraction so active match state lives in memory now
 * and can swap to Redis-backed persistence without changing room/game logic.
 */
export interface IRoomStore {
  get(roomCode: string): ServerRoomRecord | undefined;
  set(roomCode: string, record: ServerRoomRecord): void;
  delete(roomCode: string): boolean;
  has(roomCode: string): boolean;
  entries(): IterableIterator<[string, ServerRoomRecord]>;
  size(): number;
}

export class InMemoryRoomStore implements IRoomStore {
  private readonly rooms = new Map<string, ServerRoomRecord>();

  get(roomCode: string): ServerRoomRecord | undefined {
    return this.rooms.get(roomCode);
  }

  set(roomCode: string, record: ServerRoomRecord): void {
    this.rooms.set(roomCode, record);
  }

  delete(roomCode: string): boolean {
    const existing = this.rooms.get(roomCode);
    if (existing) {
      if (existing.internalMatch?.phaseTimerHandle) {
        clearTimeout(existing.internalMatch.phaseTimerHandle);
      }
      for (const timer of existing.disconnectTimers.values()) {
        clearTimeout(timer);
      }
    }
    return this.rooms.delete(roomCode);
  }

  has(roomCode: string): boolean {
    return this.rooms.has(roomCode);
  }

  entries(): IterableIterator<[string, ServerRoomRecord]> {
    return this.rooms.entries();
  }

  size(): number {
    return this.rooms.size;
  }
}

export const roomStore: IRoomStore = new InMemoryRoomStore();
