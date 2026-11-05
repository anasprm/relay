'use client';

import { io, Socket } from 'socket.io-client';
import { API_URL, readToken } from './api';

export function createSocket(token?: string | null): Socket {
  const activeToken = token || readToken();
  const isProd = process.env.NODE_ENV === 'production';

  // On Vercel / serverless production, socket.io server doesn't run alongside next.js.
  // We return a mock event emitter to prevent 404 connection spam and UI freezing.
  if (isProd) {
    console.warn('[Socket] Running on Vercel production: live socket server disabled. Using offline-first REST & IndexedDB sync.');
    return {
      on: () => {},
      off: () => {},
      emit: () => {},
      close: () => {},
      connected: false,
    } as unknown as Socket;
  }

  const socket = io(API_URL || 'http://localhost:4000', {
    auth: { token: activeToken },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 3,
    reconnectionDelay: 2000,
    autoConnect: true,
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket] Connection warning:', err.message);
  });

  return socket;
}
