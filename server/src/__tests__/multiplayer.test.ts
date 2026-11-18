import crypto from 'node:crypto';
import type { ClientToServerEvents, ServerToClientEvents } from '@last-round/shared';
import { io as ioc, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppServer } from '../index.js';

type TestClient = Socket<ServerToClientEvents, ClientToServerEvents>;

describe('LAST ROUND Authoritative Multiplayer & Game Engine', () => {
  let port = 0;
  let closeServer: () => Promise<void>;

  beforeAll(async () => {
    const { httpServer, io } = createAppServer();
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        if (addr && typeof addr === 'object') {
          port = addr.port;
        }
        resolve();
      });
    });
    closeServer = async () => {
      io.close();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    };
  });

  afterAll(async () => {
    await closeServer();
  });

  function createClient(): Promise<TestClient> {
    return new Promise((resolve) => {
      const client: TestClient = ioc(`http://localhost:${port}`, {
        transports: ['websocket'],
      });
      client.on('connect', () => resolve(client));
    });
  }

  it('creates isolated rooms, enforces join rules, and runs authoritative turns', async () => {
    const host = await createClient();
    const guest = await createClient();
    const spectator = await createClient();

    try {
      // 1. Create room
      const createRes = await new Promise<any>((resolve) => {
        host.emit(
          'room:create',
          {
            requestId: crypto.randomUUID(),
            sessionId: 'session-host-001',
            displayName: 'HostAgent',
            allowSpectators: true,
          },
          resolve
        );
      });

      expect(createRes.ok).toBe(true);
      const roomCode = createRes.data.room.roomCode;
      expect(roomCode).toHaveLength(6);

      // 2. Reject invalid room code
      const badJoin = await new Promise<any>((resolve) => {
        guest.emit(
          'room:join',
          {
            requestId: crypto.randomUUID(),
            sessionId: 'session-guest-001',
            roomCode: 'ZZZZZZ',
            displayName: 'GuestAgent',
          },
          resolve
        );
      });
      expect(badJoin.ok).toBe(false);

      // 3. Valid join
      const joinRes = await new Promise<any>((resolve) => {
        guest.emit(
          'room:join',
          {
            requestId: crypto.randomUUID(),
            sessionId: 'session-guest-001',
            roomCode,
            displayName: 'GuestAgent',
          },
          resolve
        );
      });
      expect(joinRes.ok).toBe(true);
      expect(joinRes.data.room.players).toHaveLength(2);

      // 4. Spectator join
      const specRes = await new Promise<any>((resolve) => {
        spectator.emit(
          'spectator:join',
          {
            requestId: crypto.randomUUID(),
            sessionId: 'session-spec-001',
            roomCode,
            displayName: 'Watcher',
          },
          resolve
        );
      });
      expect(specRes.ok).toBe(true);

      // 5. Ready & start match
      guest.emit('room:ready', { isReady: true });
      await new Promise((r) => setTimeout(r, 50));

      const startRes = await new Promise<any>((resolve) => {
        host.emit('room:start', resolve);
      });
      expect(startRes.ok).toBe(true);

      // 6. Spectator is strictly blocked from submitting game actions
      const specAction = await new Promise<any>((resolve) => {
        spectator.emit(
          'game:action',
          {
            actionId: crypto.randomUUID(),
            actionType: 'TAKE_CHANCE',
          },
          resolve
        );
      });
      expect(specAction.ok).toBe(false);
      expect(specAction.error?.code).toBe('SPECTATOR_FORBIDDEN');
    } finally {
      host.disconnect();
      guest.disconnect();
      spectator.disconnect();
    }
  });
});
