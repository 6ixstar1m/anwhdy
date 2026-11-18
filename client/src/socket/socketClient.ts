import type { ClientToServerEvents, ServerToClientEvents } from '@last-round/shared';
import { io, type Socket } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

export type TypedClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export const socket: TypedClientSocket = io(SERVER_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 15,
  reconnectionDelay: 1_000,
  reconnectionDelayMax: 5_000,
});
