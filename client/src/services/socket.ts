import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from '../../../shared/types';

// In production, configure through VITE_SERVER_URL environment variable
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SERVER_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
});
