/**
 * Supabase Browser Client — Option B (plain supabase-js)
 * -------------------------------------------------------
 * Lightweight client for Postgres reads/writes and Realtime subscriptions.
 * Does NOT manage auth cookies — Relay's custom JWT auth (lib/api.ts,
 * lib/AuthProvider.tsx) owns the session. This client only talks to
 * your Supabase database and Realtime channels.
 *
 * Client creation is lazy (on first use) so Next.js static prerendering
 * doesn't fail when env vars are placeholders during build.
 *
 * Usage:
 *   import { getSupabase } from '@/lib/supabase/browser';
 *   const supabase = getSupabase();
 *   const { data, error } = await supabase.from('messages').select('*');
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let _client: ReturnType<typeof createClient> | null = null;

/**
 * True when both env vars hold something that looks like a real Supabase
 * project URL + key. Prevents crashes and endless Realtime retry loops when
 * the app is built or run without credentials (previews, fresh clones).
 */
export function isSupabaseConfigured(): boolean {
  if (!supabaseUrl || !supabaseAnonKey) return false;
  if (/your[-_]?supabase|placeholder|example\.(com|org)/i.test(supabaseUrl)) return false;
  try {
    const url = new URL(supabaseUrl);
    // Cloud project URLs look like https://<20-char-ref>.supabase.co
    return (
      url.protocol === 'https:' &&
      /^[a-z0-9]{20}\.supabase\.(co|in)$/i.test(url.hostname)
    );
  } catch {
    return false;
  }
}

export function getSupabase() {
  if (_client) return _client;
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  _client = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return _client;
}

export type SupabaseClient = ReturnType<typeof createClient>;
