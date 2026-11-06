'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, launcherReady, readToken, refreshSession, tokenExpiresAt, writeToken, type ApiError } from './api';
import type { AuthResponse, User } from './types';

/** Renew a session once it is inside its last 10 days (of a 30-day lifetime). */
const SESSION_REFRESH_WINDOW_MS = 20 * 24 * 60 * 60 * 1000;

interface RegisterOptions {
  email?: string;
  inviteCode?: string;
  displayName?: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<User>;
  register: (
    username: string,
    password: string,
    options?: RegisterOptions,
  ) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const NOTICE_KEY = 'relay.authNotice';
const SESSION_COOKIE = 'relay.session';
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Middleware runs on the server before the client can read localStorage, so a
 * small marker cookie lets it distinguish "signed in" from "signed out". The
 * real bearer token never leaves localStorage.
 */
function writeSessionCookie(signedIn: boolean) {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = signedIn
      ? `${SESSION_COOKIE}=1; path=/; max-age=${SESSION_COOKIE_MAX_AGE}; samesite=lax`
      : `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
  } catch {
    /* cookies unavailable — client-side guards still apply */
  }
}

/** One-shot message shown on the sign-in screen (e.g. "wrong workspace"). */
export function consumeAuthNotice(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.sessionStorage.getItem(NOTICE_KEY);
    if (value) window.sessionStorage.removeItem(NOTICE_KEY);
    return value;
  } catch {
    return null;
  }
}

function writeNotice(message: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (message) window.sessionStorage.setItem(NOTICE_KEY, message);
    else window.sessionStorage.removeItem(NOTICE_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      // A launcher code in the URL must be exchanged before the session is read.
      await launcherReady;
      if (!active) return;

      const stored = readToken();
      if (!stored) {
        writeSessionCookie(false);
        setLoading(false);
        return;
      }

      writeSessionCookie(true);
      setToken(stored);

      try {
        const response = await api.get<{ user: User }>('/api/auth/me');
        if (!active) return;
        setUser(response.user);

        // Keep an in-use device signed in without a long-lived credential.
        if (tokenExpiresAt(stored) - Date.now() < SESSION_REFRESH_WINDOW_MS) {
          const next = await refreshSession();
          if (next && active) setToken(next);
        }
      } catch (error) {
        if (!active) return;
        // Keep the reason so the sign-in screen can explain a workspace mismatch.
        if (error && typeof error === 'object' && 'message' in error) {
          writeNotice(String((error as ApiError).message));
        }
        writeToken(null);
        writeSessionCookie(false);
        setToken(null);
        setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const response = await api.post<AuthResponse>('/api/auth/login', {
      identifier,
      password,
    });
    writeNotice(null);
    writeToken(response.token);
    writeSessionCookie(true);
    setToken(response.token);
    setUser(response.user);
    return response.user;
  }, []);

  const register = useCallback(
    async (
      username: string,
      password: string,
      options: RegisterOptions = {},
    ) => {
      const response = await api.post<AuthResponse>('/api/auth/register', {
        username,
        password,
        ...(options.email ? { email: options.email } : {}),
        ...(options.displayName ? { displayName: options.displayName } : {}),
        ...(options.inviteCode ? { inviteCode: options.inviteCode } : {}),
      });
      writeNotice(null);
      writeToken(response.token);
      writeSessionCookie(true);
      setToken(response.token);
      setUser(response.user);
      return response.user;
    },
    [],
  );

  const logout = useCallback(() => {
    writeToken(null);
    writeSessionCookie(false);
    setToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const response = await api.get<{ user: User }>('/api/auth/me');
    setUser(response.user);
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout, refresh }),
    [user, token, loading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

export function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as ApiError).message);
  }
  return 'Something went wrong. Please try again.';
}
