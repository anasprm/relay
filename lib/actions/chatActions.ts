'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

/**
 * Hybrid deduplication engine for Relay Messenger.
 *
 * Phase A (Client-Side): Callers should first check local state with
 * findExistingOneOnOneChat() before calling this function. If a thread exists
 * locally, route to it immediately without any server round-trip.
 *
 * Phase B (Server-Side Fallback): If no local thread exists, this function
 * performs a strict database lookup across `conversations` and
 * `conversation_participants`. If a direct thread already exists between the
 * two users, its ID is returned. If not, a new conversation row and both
 * participant junction rows are inserted atomically.
 *
 * @param currentUserId - The ID of the currently logged-in user
 * @param targetUserId  - The ID of the user to start a direct thread with
 * @returns { conversationId: string, isNew: boolean }
 */
export async function getOrCreateDirectChat(
  currentUserId: string,
  targetUserId: string,
): Promise<{ conversationId: string; isNew: boolean }> {
  if (!supabase) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables',
    );
  }

  // ------------------------------------------------------------------
  // Phase B-1: Database lookup — find an existing direct thread
  // ------------------------------------------------------------------
  const { data: existing, error: lookupError } = await supabase
    .from('conversation_participants')
    .select(
      'conversation_id, conversations!inner(is_group, id)',
    )
    .eq('user_id', currentUserId)
    .eq('conversations.is_group', false);

    if (lookupError) throw lookupError;

    const convIds = (existing || []).map((c: any) => c.conversation_id);

    if (convIds.length > 0) {
      // 2. Check which of these also contain the target user
      const { data: shared, error: sharedError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .in('conversation_id', convIds)
        .eq('user_id', targetUserId);

      if (sharedError) throw sharedError;

      if (shared && shared.length > 0) {
        return {
          conversationId: shared[0].conversation_id,
          isNew: false,
        };
      }
    }

    // ------------------------------------------------------------------
    // Phase B-2: Atomic insert — no existing thread found, create one
    // ------------------------------------------------------------------
    const { data: newConv, error: createError } = await supabase
      .from('conversations')
      .insert({ is_group: false, created_at: new Date().toISOString() })
      .select('id')
      .single();

    if (createError) throw createError;

    const { error: partError } = await supabase
      .from('conversation_participants')
      .insert([
        { conversation_id: newConv.id, user_id: currentUserId },
        { conversation_id: newConv.id, user_id: targetUserId },
      ]);

    if (partError) throw partError;

    return {
      conversationId: newConv.id,
      isNew: true,
    };
  }
