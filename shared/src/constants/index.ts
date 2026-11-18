export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const MIN_ACTIVE_PLAYERS = 2;
export const MAX_ACTIVE_PLAYERS = 6;
export const MAX_SPECTATORS = 12;

export const DEFAULT_TURN_DURATION_MS = 20_000;
export const STARTING_DURATION_MS = 2_000;
export const ROUND_INTRO_DURATION_MS = 2_800;
export const EVENT_RESOLUTION_DURATION_MS = 2_800;
export const ELIMINATION_DURATION_MS = 3_200;
export const NEXT_TURN_DURATION_MS = 1_000;
export const RECONNECT_GRACE_PERIOD_MS = 30_000;
export const ROOM_IDLE_TTL_MS = 30 * 60_000;

export const MAX_CHAT_MESSAGE_LENGTH = 240;
export const CHAT_RATE_LIMIT_WINDOW_MS = 5_000;
export const CHAT_RATE_LIMIT_MAX_MESSAGES = 5;

/**
 * Polar angles (in radians) for 6 evenly spaced chairs around the round table.
 */
export const SEAT_ANGLES_RAD: readonly number[] = [
  0,
  Math.PI / 3,
  (2 * Math.PI) / 3,
  Math.PI,
  (4 * Math.PI) / 3,
  (5 * Math.PI) / 3,
] as const;

export const TABLE_RADIUS = 2.15;
export const CHAIR_DISTANCE = 2.75;
