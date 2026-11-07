/**
 * Server Action: getOrCreateDirectChat
 * ------------------------------------
 * Hybrid deduplication engine for 1-on-1 threads.
 *
 * Phase A: Query Supabase for any existing non-group conversation shared
 *          between currentUserId and targetUserId.
 * Phase B: If none exists, atomically create a new direct conversation
 *          + two participant rows.
 *
 * Returns the conversation_id (existing or newly created).
 *
 * Usage (Server Component or Server Action):
 *   import { getOrCreateDirectChat } from '@/lib/actions/conversations';
 *   const { conversationId } = await getOrCreateDirectChat({
 *     currentUserId: 'usr_abc',
 *     targetUserId: 'usr_xyz',
 *   });
 */

'use server';

import { supabase } from '@/lib/supabase/server';

interface GetOrCreateDirectChatParams {
  currentUserId: string;
  targetUserId: string;
}

interface GetOrCreateDirectChatResult {
  conversationId: string;
  isNew: boolean;
}

export async function getOrCreateDirectChat(
  params: GetOrCreateDirectChatParams,
): Promise<GetOrCreateDirectChatResult> {
  const { currentUserId, targetUserId } = params;

  // -----------------------------------------------------------
  // Phase A: Look for an existing direct conversation shared by both users
  // -----------------------------------------------------------
  const { data: existing, error: lookupError } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', currentUserId);

  if (lookupError) {
    console.error('[getOrCreateDirectChat] Lookup error:', lookupError);
    throw lookupError;
  }

  const participantConvIds = (existing || []).map((row) => row.conversation_id);

  if (participantConvIds.length > 0) {
    // Find which of these also includes targetUserId
    const { data: shared, error: sharedError } = await supabase
      .from('conversation_participants')
      .select('conversation_id, is_group')
      .in('conversation_id', participantConvIds)
      .eq('user_id', targetUserId)
      .eq('is_group', false);

    if (sharedError) {
      console.error('[getOrCreateDirectChat] Shared lookup error:', sharedError);
      throw sharedError;
    }

    if (shared && shared.length > 0) {
      return {
        conversationId: shared[0].conversation_id,
        isNew: false,
      };
    }
  }

  // -----------------------------------------------------------
  // Phase B: Create a new direct conversation + 2 participant rows
  // -----------------------------------------------------------
  const { data: newConversation, error: createError } = await supabase
    .from('conversations')
    .insert({
      is_group: false,
      created_by: currentUserId,
    })
    .select('id')
    .single();

  if (createError || !newConversation) {
    console.error('[getOrCreateDirectChat] Create conversation error:', createError);
    throw createError ?? new Error('Failed to create conversation');
  }

  const conversationId = newConversation.id;

  const { error: insertError } = await supabase
    .from('conversation_participants')
    .insert([
      { conversation_id: conversationId, user_id: currentUserId },
      { conversation_id: conversationId, user_id: targetUserId },
    ]);

  if (insertError) {
    console.error('[getOrCreateDirectChat] Insert participants error:', insertError);
    // Best-effort cleanup: remove the conversation we just created
    await supabase.from('conversations').delete().eq('id', conversationId);
    throw insertError;
  }

  return {
    conversationId,
    isNew: true,
  };
}
