import http from 'node:http';
import type { ClientToServerEvents, ServerToClientEvents } from '@last-round/shared';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { Server } from 'socket.io';
import { env } from './config/env.js';
import { roomStore } from './rooms/RoomStore.js';
import { registerSocketHandlers } from './socket/registerHandlers.js';

export function createAppServer() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '64kb' }));

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'last-round-server',
      activeRooms: roomStore.size(),
      timestamp: new Date().toISOString(),
    });
  });

  const httpServer = http.createServer(app);

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: env.CLIENT_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 10_000,
    pingTimeout: 20_000,
  });

  const roomManager = registerSocketHandlers(io);

  return { app, httpServer, io, roomManager };
}

if (env.NODE_ENV !== 'test') {
  const { httpServer, io } = createAppServer();

  httpServer.listen(env.PORT, () => {
    console.log(`[LAST ROUND] Authoritative server listening on http://localhost:${env.PORT}`);
  });

  const shutdown = (signal: string) => {
    console.log(`[LAST ROUND] Received ${signal}, shutting down gracefully...`);
    io.close(() => {
      httpServer.close(() => {
        process.exit(0);
      });
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
