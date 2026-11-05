'use client';

import { io, Socket } from 'socket.io-client';
import { API_URL, readToken } from './api';

export function createSocket(token?: string | null): Socket {
  const activeToken = token || readToken();
  const isProd = process.env.NODE_ENV === 'production';

  // In production (Vercel serverless), WebSockets are not supported natively.
  // We fall back to polling or a disconnected mock socket wrapper to prevent error spam.
  const socket = io(isProd ? undefined : API_URL || 'http://localhost:4000', {
    auth: { token: activeToken },
    transports: isProd ? ['polling'] : ['websocket', 'polling'],
    reconnectionAttempts: isProd ? 3 : 10,
    reconnectionDelay: 2000,
    autoConnect: true,
  });

  socket.on('connect_error', (err) => {
    if (!isProd) {
      console.warn('[Socket] Connection warning:', err.message);
    }
  });

  return socket;
}
