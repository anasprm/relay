'use server';

import { parseSessionToken } from '@/lib/server/authStore';
import { isUuid, stableUuid, usernameFor } from '@/lib/server/relayIds';
import { broadcastToConversation } from '@/lib/server/realtime';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export interface ToggleReactionInput {
  token: string;
  conversationId: string;
  messageId: string;
  /** Emoji to set, or null/empty to remove the caller's reaction. */
  emoji: string | null;
}

export type ToggleReactionResult =
  | { success: true; messageId: string; reactions: Record<string, string> }
  | { success: false; error: string };

/**
 * Replaces (or clears) the caller's reaction on a message.
 *
 * The database stores one row per (message, user). The reaction map returned to
 * clients is `Record<userId, emoji>`, which is what the message bubble
 * aggregates into per-emoji counts.
 */
export async function toggleReaction(
  input: ToggleReactionInput,
): Promise<ToggleReactionResult> {
  const token = input?.token?.trim();
  const conversationId = input?.conversationId?.trim();
  const messageId = input?.messageId?.trim();
  const emoji = input?.emoji?.trim() || null;

  if (!token) return { success: false, error: 'Not signed in.' };
  if (!conversationId) return { success: false, error: 'No conversation selected.' };
  if (!messageId) return { success: false, error: 'No message selected.' };
  if (emoji && emoji.length > 16) {
    return { success: false, error: 'Invalid reaction.' };
  }

  // Optimistically appended messages still carry a local id (`msg_…`) until the
  // send action resolves; there is no row to attach a reaction to yet.
  if (!isUuid(messageId)) {
    return { success: false, error: 'This message is still syncing. Try again in a moment.' };
  }

  const session = parseSessionToken(token);
  if (!session) return { success: false, error: 'Session is invalid or expired.' };

  try {
    const admin = getSupabaseAdmin();
    const now = new Date().toISOString();

    const senderUuid = stableUuid(`user:${session.userId}`);
    const conversationUuid = stableUuid(`conversation:${conversationId}`);

    // Confirm the message belongs to the conversation the caller claims,
    // otherwise a crafted request could react inside another thread.
    const { data: messageRow, error: messageError } = await admin
      .from('messages')
      .select('id')
      .eq('id', messageId)
      .eq('conversation_id', conversationUuid)
      .maybeSingle();
    if (messageError) throw new Error(messageError.message);
    if (!messageRow) return { success: false, error: 'Message not found.' };

    // The FK requires a users row; it normally exists because this user has
    // sent a message, but a fresh tab can react before ever posting.
    const { error: userError } = await admin.from('users').upsert(
      {
        id: senderUuid,
        username: usernameFor(session.userId, session.email),
        display_name: session.displayName || usernameFor(session.userId, session.email),
        email: session.email,
        accent: 'emerald',
        online: true,
        last_seen: now,
      },
      { onConflict: 'id' },
    );
    if (userError) throw new Error(`Could not sync user: ${userError.message}`);

    const { data: existing, error: existingError } = await admin
      .from('message_reactions')
      .select('emoji')
      .eq('message_id', messageId)
      .eq('user_id', senderUuid)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    // Same emoji (or explicit clear) toggles the reaction off.
    if (!emoji || existing?.emoji === emoji) {
      const { error: deleteError } = await admin
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', senderUuid);
      if (deleteError) throw new Error(deleteError.message);
    } else {
      const { error: upsertError } = await admin
        .from('message_reactions')
        .upsert(
          { message_id: messageId, user_id: senderUuid, emoji },
          { onConflict: 'message_id,user_id' },
        );
      if (upsertError) throw new Error(upsertError.message);
    }

    const { data: rows, error: listError } = await admin
      .from('message_reactions')
      .select('user_id, emoji')
      .eq('message_id', messageId);
    if (listError) throw new Error(listError.message);

    // Return relay ids where possible so the client's own id (`usr_me`) can be
    // used to decide whether the next click adds or removes a reaction.
    const reactions: Record<string, string> = {};
    for (const row of rows ?? []) {
      const key = row.user_id === senderUuid ? session.userId : row.user_id;
      reactions[key] = row.emoji;
    }

    await broadcastToConversation(conversationId, 'reaction', {
      messageId,
      reactions,
    });

    return { success: true, messageId, reactions };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not update reaction.';
    console.error('[toggleReaction]', message);
    return { success: false, error: message };
  }
}
