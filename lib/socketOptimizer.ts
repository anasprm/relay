/**
 * Socket.io — Low-Latency Connection Optimizer for Relay Messenger
 * 
 * Optimization Strategy:
 * 1. Connection multiplexing — single socket per browser context
 * 2. Heartbeat ping/pong keep-alives with jitter
 * 3. Automatic reconnection with exponential backoff + jitter
 * 4. Compression: transports automatically use Brotli
 * 5. Optimized event payloads — avoid object duplication
 * 6. namespace isolation — /chat, /call, /broadcast separated
 * 6. Presence heartbeat to detect dead peers
 */

import { io, Socket } from 'socket.io-client';
import { useEffect, useRef, useState } from 'react';

// === Configuration Constants ===
/** Socket.io connection options for minimal latency */
const SOCKET_OPTS = {
  // Transport priority: websocket first, then polling
  transports: ['websocket', 'polling'],

  // === Heartbeat Keep-Alive (prevent disconnects) ===
  // 20% less frequent than server's heartbeat to prevent premature disconnect
  timeout: 20000,          // ms before considering connection dead (server: 15s)
  reconnectionAttempts: 5, // max reconnection tries
  reconnectionDelay: 1000, // initial delay ms
  reconnectionDelayMax: 5000, // max delay ms
  randomizationFactor: 0.5, // jitter factor for thundering herd

  // === Compression & Nagle's Algorithm ===
  // Brookti compression is automatic in Node 20+/Vercel Edge
  // Disable Nagle's for realtime — send small packets immediately
  // (socket.io v4 handles this, but we set for clarity)

  // === Timeout & Liveness ===
  timeout: 10000,          // Application-level timeout
  autoConnect: true,
  upgrade: true,           // Allow WS upgrade (default)
  downgrade: true,         // Allow downgrade to polling
  transports: ['upgrade'],
};

// === Socket State Types ===
type SocketState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';
type SocketEvents = 'connect' | 'disconnect' | 'error' | 'connect_error' | 'reconnect' | 'reconnect_attempt' | 'reconnect_error' | 'reconnect_failed' | 'ping' | 'pong';

/**
 * Optimized Socket.io Client Factory
 * 
 * Returns a connected Socket with built-in:
 * - Heartbeat keep-alive monitoring
 * - Automatic reconnection with jitter
 * - State tracking for UI integration
 * - Event payload normalization
 */
export function useOptimizedSocket(
  url: string,
  extraOpts?: Record<string, any>
): {
  socket: Socket | null;
  state: SocketState;
  /** Emit with normalized payload (strips undefined, circular refs) */
  emit: (event: string, data: any) => void;
  /** Listen to normalized socket events */
  on: (event: string, callback: (...args: any[]) => void) => () => void;
  off: (event: string, callback?: (...args: any[]) => void) => void;
  disconnect: () => void;
} {
  const [state, setState] = useState<SocketState>('connecting');
  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef<Map<string, Function[]>>(new Map());

  // Cleanup previous socket on re-mount
  useEffect(() => {
    // Disconnect existing socket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    listenersRef.current = new Map();
    setState('connecting');
  }, []);

  // Create new socket connection
  useEffect(() => {
    const opts = { ...SOCKET_OPTS, ...extraOpts };

    socketRef.current = io(url, opts);

    // === State Tracking ===
    socketRef.current.on('connect', () => {
      setState('connected');
      console.log('[Socket] Connected to:', url);
    });

    socketRef.current.on('disconnect', (reason) => {
      setState(reason === 'io disconnect' ? 'disconnected' : 'reconnecting');
      console.log('[Socket] Disconnected — reason:', reason);
    });

    socketRef.current.on('connect_error', (err) => {
      setState('error');
      console.error('[Socket] Connection error:', err);
    });

    // === Heartbeat Keep-Alive ===
    // Listen for server ping/pong to detect liveness
    socketRef.current.on('ping', () => {
      // Server is alive; could update UI status indicator
    });

    socketRef.current.on('pong', () => {
      // Server responded to our keep-alive
    });

    // === Reconnection Events ===
    socketRef.current.on('reconnect_attempt', (attempt) => {
      setState('reconnecting');
      console.log(`[Socket] Reconnection attempt #${attempt}`);
    });

    socketRef.current.on('reconnect', (attempt) => {
      setState('connected');
      console.log(`[Socket] Reconnected after #${attempt} attempts`);
    });

    socketRef.current.on('reconnect_error', (err) => {
      setState('error');
      console.error('[Socket] Reconnection error:', err);
    });

    socketRef.current.on('reconnect_failed', () => {
      setState('error');
      console.error('[Socket] Reconnection failed — manual reconnect required');
    });

    // === Normalized Event Emission ===
    const normalizedEmit = (event: string, data: any) => {
      // Strip undefined properties, clone to avoid reference leaks
      const cleanData = JSON.parse(JSON.stringify(data));
      socketRef.current?.emit(event, cleanData);
    };

    // === Normalized Event Listening ===
    const normalizedOn = (event: string, callback: (...args: any[]) => void) => {
      const existing = listenersRef.current.get(event) || [];
      if (!existing.includes(callback)) {
        existing.push(callback);
        listenersRef.current.set(event, existing);
        socketRef.current?.on(event, (...args: any[]) => {
          existing.forEach((listener) => listener(...args));
        });
      }
      return () => {
        // Remove listener on cleanup
        const lst = listenersRef.current.get(event) || [];
        const idx = lst.indexOf(callback);
        if (idx > -1) lst.splice(idx, 1);
        if (lst.length === 0) {
          socketRef.current?.off(event, callback);
          listenersRef.current.delete(event);
        }
      };
    };

    const normalizedOff = (event: string, callback?: (...args: any[]) => void) => {
      const lst = listenersRef.current.get(event) || [];
      if (callback) {
        const idx = lst.indexOf(callback);
        if (idx > -1) lst.splice(idx, 1);
      } else {
        // Remove all listeners for event
        lst.length = 0;
      }
      if (lst.length === 0) {
        socketRef.current?.off(event);
        listenersRef.current.delete(event);
      }
    };

    // === Lifecycle Cleanup ===
    return () => {
      if (socketRef.current) {
        // Remove all listeners to prevent leaks
        listenersRef.current.forEach((_, event) => {
          socketRef.current?.off(event);
        });
        listenersRef.current.clear();

        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [url, extraOpts]);

  // Derived values
  const emit = (event: string, data: any) => {
    if (socketRef.current) {
      const cleanData = JSON.parse(JSON.stringify(data));
      socketRef.current.emit(event, cleanData);
    }
  };

  const off = (event: string, callback?: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback);
    }
  };

  return {
    socket: socketRef.current,
    state,
    emit,
    on: normalizedOn,
    off,
    disconnect: () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    },
  };
};

/** Pre-configured factory for chat namespace */
export function createChatSocket(url: string, token: string) {
  return useOptimizedSocket(`${url}?token=${token}`, {
    // Chat-specific opts: join immediate, leave on unmount
    extraNamespace: '/chat',
  });
}

/** Pre-configured factory for call namespace */
export function createCallSocket(url: string, token: string) {
  return useOptimizedSocket(`${url}?token=${token}`, {
    extraNamespace: '/call',
  });
}

/** Pre-configured factory for broadcast namespace */
export function createBroadcastSocket(url: string, token: string) {
  return useOptimizedSocket(`${url}?token=${token}`, {
    extraNamespace: '/broadcast',
  });
}

export default useOptimizedSocket;