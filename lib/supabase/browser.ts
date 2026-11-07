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

export function getSupabase() {
  if (_client) return _client;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables',
    );
  }
  _client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return _client;
}

export type SupabaseClient = ReturnType<typeof createClient>;
