'use server';

import { parseSessionToken } from '@/lib/server/authStore';
import { stableUuid } from '@/lib/server/relayIds';
import { broadcastToConversation } from '@/lib/server/realtime';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export interface EditMessageInput {
  token: string;
  /** Relay id of the conversation. */
  conversationId: string;
  /** Relay id (or Supabase UUID) of the message to edit. */
  messageId: string;
  body: string;
}

export interface DeleteMessageInput {
  token: string;
  conversationId: string;
  messageId: string;
}

export interface BurnViewOnceInput {
  token: string;
  conversationId: string;
  messageId: string;
}

export type MessageMutationResult =
  | { success: true; messageId: string }
  | { success: false; error: string };

/**
 * Edits the body of a message the caller sent.
 *
 * Validates the custom JWT, resolves relay ids to Supabase UUIDs via
 * `stableUuid`, verifies ownership (`sender_id === caller_uuid`), then updates
 * `body`, `updated_at`, and `edited_at` with the service-role client.
 * Broadcasts `message_edited` so all tabs update the bubble in real time.
 */
export async function editMessage(
  input: EditMessageInput,
): Promise<MessageMutationResult> {
  const token = input?.token?.trim();
  const conversationId = input?.conversationId?.trim();
  const messageId = input?.messageId?.trim();
  const body = input?.body?.trim();

  if (!token) return { success: false, error: 'Not signed in.' };
  if (!conversationId) return { success: false, error: 'No conversation selected.' };
  if (!messageId) return { success: false, error: 'No message selected.' };
  if (!body) return { success: false, error: 'Message body is required.' };

  const session = parseSessionToken(token);
  if (!session) return { success: false, error: 'Session is invalid or expired.' };

  try {
    const admin = getSupabaseAdmin();
    const now = new Date().toISOString();

    const callerUuid = stableUuid(`user:${session.userId}`);
    const conversationUuid = stableUuid(`conversation:${conversationId}`);

    // Resolve the message id. It may be a local `msg_…` id (not yet in Supabase)
    // or a persisted UUID. Only persisted messages can be edited.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(messageId)) {
      return { success: false, error: 'This message cannot be edited yet.' };
    }

    // Verify ownership: the caller must be the sender.
    const { data: messageRow, error: lookupError } = await admin
      .from('messages')
      .select('id, sender_id, conversation_id')
      .eq('id', messageId)
      .eq('conversation_id', conversationUuid)
      .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    if (!messageRow) return { success: false, error: 'Message not found.' };
    if (messageRow.sender_id !== callerUuid) {
      return { success: false, error: 'You can only edit your own messages.' };
    }

    const { error: updateError } = await admin.from('messages').update({
      body,
      updated_at: now,
      edited_at: now,
    }).eq('id', messageId);
    if (updateError) throw new Error(updateError.message);

    await broadcastToConversation(conversationId, 'message_edited', {
      conversationId,
      messageId,
      body,
      editedBy: session.userId,
      editedAt: now,
    });

    return { success: true, messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not edit message.';
    console.error('[editMessage]', message);
    return { success: false, error: message };
  }
}

/**
 * Soft-deletes a message the caller sent.
 *
 * Sets `is_deleted = true` and clears `body` so thread history continuity is
 * preserved while the content is removed. Broadcasts `message_deleted`.
 */
export async function deleteMessage(
  input: DeleteMessageInput,
): Promise<MessageMutationResult> {
  const token = input?.token?.trim();
  const conversationId = input?.conversationId?.trim();
  const messageId = input?.messageId?.trim();

  if (!token) return { success: false, error: 'Not signed in.' };
  if (!conversationId) return { success: false, error: 'No conversation selected.' };
  if (!messageId) return { success: false, error: 'No message selected.' };

  const session = parseSessionToken(token);
  if (!session) return { success: false, error: 'Session is invalid or expired.' };

  try {
    const admin = getSupabaseAdmin();
    const now = new Date().toISOString();

    const callerUuid = stableUuid(`user:${session.userId}`);
    const conversationUuid = stableUuid(`conversation:${conversationId}`);

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(messageId)) {
      return { success: false, error: 'This message cannot be deleted yet.' };
    }

    const { data: messageRow, error: lookupError } = await admin
      .from('messages')
      .select('id, sender_id, conversation_id')
      .eq('id', messageId)
      .eq('conversation_id', conversationUuid)
      .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    if (!messageRow) return { success: false, error: 'Message not found.' };
    if (messageRow.sender_id !== callerUuid) {
      return { success: false, error: 'You can only delete your own messages.' };
    }

    const { error: updateError } = await admin.from('messages').update({
      body: null,
      is_deleted: true,
      updated_at: now,
    }).eq('id', messageId);
    if (updateError) throw new Error(updateError.message);

    await broadcastToConversation(conversationId, 'message_deleted', {
      conversationId,
      messageId,
      deletedBy: session.userId,
      deletedAt: now,
    });

    return { success: true, messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not delete message.';
    console.error('[deleteMessage]', message);
    return { success: false, error: message };
  }
}

/**
 * Marks a view-once media message as opened/burned.
 *
 * Sets `view_once_opened = true` so the sender and recipient UIs can show the
 * burned state. Broadcasts `view_once_burned`.
 */
export async function burnViewOnce(
  input: BurnViewOnceInput,
): Promise<MessageMutationResult> {
  const token = input?.token?.trim();
  const conversationId = input?.conversationId?.trim();
  const messageId = input?.messageId?.trim();

  if (!token) return { success: false, error: 'Not signed in.' };
  if (!conversationId) return { success: false, error: 'No conversation selected.' };
  if (!messageId) return { success: false, error: 'No message selected.' };

  const session = parseSessionToken(token);
  if (!session) return { success: false, error: 'Session is invalid or expired.' };

  try {
    const admin = getSupabaseAdmin();
    const now = new Date().toISOString();

    const conversationUuid = stableUuid(`conversation:${conversationId}`);

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(messageId)) {
      return { success: false, error: 'This message cannot be burned yet.' };
    }

    const { data: messageRow, error: lookupError } = await admin
      .from('messages')
      .select('id, view_once, view_once_opened, conversation_id')
      .eq('id', messageId)
      .eq('conversation_id', conversationUuid)
      .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    if (!messageRow) return { success: false, error: 'Message not found.' };
    if (!messageRow.view_once) {
      return { success: false, error: 'This message is not view-once.' };
    }
    if (messageRow.view_once_opened) {
      return { success: true, messageId }; // already burned
    }

    const { error: updateError } = await admin.from('messages').update({
      view_once_opened: true,
      updated_at: now,
    }).eq('id', messageId);
    if (updateError) throw new Error(updateError.message);

    await broadcastToConversation(conversationId, 'view_once_burned', {
      conversationId,
      messageId,
      burnedBy: session.userId,
      burnedAt: now,
    });

    return { success: true, messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not burn message.';
    console.error('[burnViewOnce]', message);
    return { success: false, error: message };
  }
}
