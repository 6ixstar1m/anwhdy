import {
  DEFAULT_TURN_DURATION_MS,
  MAX_ACTIVE_PLAYERS,
  MIN_ACTIVE_PLAYERS,
} from '../constants/index.js';
import type { AvatarConfig, GameRulesConfig } from '../types/game.js';

export const DEFAULT_GAME_RULES: GameRulesConfig = {
  minPlayers: MIN_ACTIVE_PLAYERS,
  maxPlayers: MAX_ACTIVE_PLAYERS,
  turnDurationMs: DEFAULT_TURN_DURATION_MS,
  allowPassOption: true,
  maxPassesPerPlayer: 1,
  baseRiskProbability: 1 / 6,
  escalateRiskEachTurn: true,
  riskStepIncrement: 1 / 6,
  allowSpectatorChat: true,
};

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  bodyType: 'masculine',
  skinTone: '#c68b67',
  hairStyle: 'short',
  hairColor: '#1f1b18',
  outfit: 'tailored_coat',
  outfitColor: '#232529',
  accessory: 'none',
  facePreset: 0,
};

export const SKIN_TONE_PRESETS: readonly string[] = [
  '#f1c9a8',
  '#dfaa82',
  '#c68b67',
  '#9e6747',
  '#6d432b',
  '#472a1b',
] as const;

export const HAIR_COLOR_PRESETS: readonly string[] = [
  '#151312',
  '#36261b',
  '#6b4423',
  '#a88352',
  '#c9c4bc',
  '#6b1d28',
] as const;

export const OUTFIT_COLOR_PRESETS: readonly string[] = [
  '#1c1e22',
  '#2c2224',
  '#1b2833',
  '#2b2923',
  '#471820',
  '#3a3d42',
] as const;

/**
 * Calculates the clamped probability [0.05, 0.95] for the current step in a round.
 * Executed strictly on the authoritative server.
 */
export function computeStepRisk(rules: GameRulesConfig, stepInRound: number): number {
  if (!rules.escalateRiskEachTurn) {
    return Math.min(0.95, Math.max(0.05, rules.baseRiskProbability));
  }
  const raw = rules.baseRiskProbability + stepInRound * rules.riskStepIncrement;
  return Math.min(0.95, Math.max(0.05, raw));
}
