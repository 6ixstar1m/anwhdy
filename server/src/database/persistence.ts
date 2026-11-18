import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

let prisma: PrismaClient | null = null;

if (env.DATABASE_URL) {
  try {
    prisma = new PrismaClient();
  } catch (err) {
    console.warn('[database] Prisma client initialization skipped:', err);
  }
}

export interface CompletedMatchRecord {
  matchId: string;
  roomCode: string;
  winnerName: string;
  playerCount: number;
  rounds: number;
  startedAt: Date;
}

export async function persistRoomCreated(params: {
  roomCode: string;
  isPrivate: boolean;
  allowSpectators: boolean;
}): Promise<void> {
  if (!prisma) return;
  try {
    await prisma.room.upsert({
      where: { roomCode: params.roomCode },
      update: {
        isPrivate: params.isPrivate,
        allowSpectators: params.allowSpectators,
      },
      create: {
        roomCode: params.roomCode,
        isPrivate: params.isPrivate,
        allowSpectators: params.allowSpectators,
      },
    });
  } catch (err) {
    console.warn('[database] persistRoomCreated failed (continuing in-memory):', err);
  }
}

export async function persistCompletedMatch(record: CompletedMatchRecord): Promise<void> {
  if (!prisma) return;
  try {
    await prisma.gameHistory.upsert({
      where: { matchId: record.matchId },
      update: {},
      create: {
        matchId: record.matchId,
        roomCode: record.roomCode,
        winnerName: record.winnerName,
        playerCount: record.playerCount,
        rounds: record.rounds,
        startedAt: record.startedAt,
        endedAt: new Date(),
      },
    });
  } catch (err) {
    console.warn('[database] persistCompletedMatch failed (continuing in-memory):', err);
  }
}
