/**
 * Supabase Browser Client — Option B (plain supabase-js)
 * -------------------------------------------------------
 * Lightweight client for Postgres reads/writes and Realtime subscriptions.
 * Does NOT manage auth cookies — Relay's custom JWT auth (lib/api.ts,
 * lib/AuthProvider.tsx) owns the session. This client only talks to
 * your Supabase database and Realtime channels.
 *
 * Usage:
 *   import { supabase } from '@/lib/supabase/browser';
 *   const { data, error } = await supabase.from('messages').select('*');
 *   const channel = supabase.channel('room:conv_abc').subscribe();
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export type SupabaseClient = typeof supabase;
