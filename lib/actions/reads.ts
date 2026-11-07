'use server';

import { parseSessionToken } from '@/lib/server/authStore';
import { stableUuid, usernameFor } from '@/lib/server/relayIds';
import { broadcastToConversation } from '@/lib/server/realtime';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export interface MarkConversationReadInput {
  token: string;
  conversationId: string;
}

export type MarkConversationReadResult =
  | { success: true; updatedCount: number }
  | { success: false; error: string };

/**
 * Marks all unread messages in a conversation as read by the current user.
 *
 * Appends the caller's UUID to each message's `read_by` array and inserts a
 * row into `message_reads` for auditability. Broadcasts a `message_read`
 * event so the sender's tabs can flip ticks to blue in real time.
 *
 * Intended to be called when a conversation is opened/viewed.
 */
export async function markConversationRead(
  input: MarkConversationReadInput,
): Promise<MarkConversationReadResult> {
  const token = input?.token?.trim();
  const conversationId = input?.conversationId?.trim();

  if (!token) return { success: false, error: 'Not signed in.' };
  if (!conversationId) return { success: false, error: 'No conversation selected.' };

  const session = parseSessionToken(token);
  if (!session) return { success: false, error: 'Session is invalid or expired.' };

  try {
    const admin = getSupabaseAdmin();
    const now = new Date().toISOString();

    const senderUuid = stableUuid(`user:${session.userId}`);
    const conversationUuid = stableUuid(`conversation:${conversationId}`);

    // Ensure the caller is a participant of this conversation.
    const { data: participant, error: participantError } = await admin
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationUuid)
      .eq('user_id', senderUuid)
      .maybeSingle();
    if (participantError) throw new Error(participantError.message);
    if (!participant) {
      return { success: false, error: 'You are not a participant in this conversation.' };
    }

    // Fetch unread messages in this conversation not sent by the caller.
    const { data: messages, error: fetchError } = await admin
      .from('messages')
      .select('id, sender_id, read_by')
      .eq('conversation_id', conversationUuid)
      .neq('sender_id', senderUuid);
    if (fetchError) throw new Error(fetchError.message);

    const unreadMessageIds = (messages ?? [])
      .filter((msg) => !Array.isArray(msg.read_by) || !msg.read_by.includes(senderUuid))
      .map((msg) => msg.id);

    if (unreadMessageIds.length === 0) {
      return { success: true, updatedCount: 0 };
    }

    // Update read_by and insert read records. Small conversations → sequential
    // updates are fine; keep it simple and atomic-per-message.
    for (const msgId of unreadMessageIds) {
      const msg = messages!.find((m) => m.id === msgId)!;
      const updatedReadBy = Array.isArray(msg.read_by)
        ? [...msg.read_by, senderUuid]
        : [senderUuid];

      const { error: updateError } = await admin
        .from('messages')
        .update({ read_by: updatedReadBy })
        .eq('id', msgId);
      if (updateError) throw new Error(updateError.message);

      const { error: insertError } = await admin.from('message_reads').insert({
        message_id: msgId,
        user_id: senderUuid,
        read_at: now,
      });
      if (insertError) throw new Error(insertError.message);
    }

    // Ensure caller's user row exists for any future lookups.
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

    // Broadcast so the sender's tabs update ticks to blue.
    await broadcastToConversation(conversationId, 'message_read', {
      conversationId,
      userId: session.userId,
      messageIds: unreadMessageIds,
      readAt: now,
    });

    return { success: true, updatedCount: unreadMessageIds.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not mark messages as read.';
    console.error('[markConversationRead]', message);
    return { success: false, error: message };
  }
}
