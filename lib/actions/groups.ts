'use server';

import { parseSessionToken } from '@/lib/server/authStore';
import { stableUuid, usernameFor, isUuid } from '@/lib/server/relayIds';
import { broadcastToConversation } from '@/lib/server/realtime';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export interface GroupParticipantInput {
  /** Relay user id (e.g. `usr_sarah`). */
  userId: string;
  displayName: string;
  email?: string | null;
}

export interface CreateGroupInput {
  token: string;
  /** Relay id for the group (e.g. `conv_group_friends`). */
  conversationId: string;
  name: string;
  /** All participants including the creator. */
  participants: GroupParticipantInput[];
}

export interface AddGroupMemberInput {
  token: string;
  /** Relay id of the group conversation. */
  conversationId: string;
  /** Relay user id to add. */
  userId: string;
  displayName: string;
  email?: string | null;
}

export interface RemoveGroupMemberInput {
  token: string;
  conversationId: string;
  /** Relay user id to remove. */
  userId: string;
}

export interface LeaveGroupInput {
  token: string;
  conversationId: string;
}

export type GroupActionResult =
  | { success: true; conversationId: string; participants: string[] }
  | { success: false; error: string };

/**
 * Creates a group conversation and adds all participants.
 *
 * The conversation row gets `is_group = true` and the provided name. Each
 * participant is upserted into `users` and linked via `conversation_participants`.
 * A `group_created` broadcast notifies all participants' tabs.
 */
export async function createGroup(
  input: CreateGroupInput,
): Promise<GroupActionResult> {
  const token = input?.token?.trim();
  const conversationId = input?.conversationId?.trim();
  const name = input?.name?.trim();
  const participants = input?.participants ?? [];

  if (!token) return { success: false, error: 'Not signed in.' };
  if (!conversationId) return { success: false, error: 'No group id provided.' };
  if (!name) return { success: false, error: 'Group name is required.' };
  if (participants.length === 0) {
    return { success: false, error: 'A group needs at least one participant.' };
  }

  const session = parseSessionToken(token);
  if (!session) return { success: false, error: 'Session is invalid or expired.' };

  try {
    const admin = getSupabaseAdmin();
    const now = new Date().toISOString();

    const creatorUuid = stableUuid(`user:${session.userId}`);
    const conversationUuid = stableUuid(`conversation:${conversationId}`);

    // Upsert the creator.
    const { error: creatorError } = await admin.from('users').upsert(
      {
        id: creatorUuid,
        username: usernameFor(session.userId, session.email),
        display_name: session.displayName || usernameFor(session.userId, session.email),
        email: session.email,
        accent: 'emerald',
        online: true,
        last_seen: now,
      },
      { onConflict: 'id' },
    );
    if (creatorError) throw new Error(`Could not sync creator: ${creatorError.message}`);

    // Upsert the group conversation.
    const { error: conversationError } = await admin.from('conversations').upsert(
      {
        id: conversationUuid,
        is_group: true,
        name,
        created_by: creatorUuid,
        updated_at: now,
      },
      { onConflict: 'id' },
    );
    if (conversationError) throw new Error(`Could not create group: ${conversationError.message}`);

    // Upsert all participants and link them.
    const participantRelayIds: string[] = [];
    for (const participant of participants) {
      const userUuid = stableUuid(`user:${participant.userId}`);
      participantRelayIds.push(participant.userId);

      const { error: userError } = await admin.from('users').upsert(
        {
          id: userUuid,
          username: usernameFor(participant.userId, participant.email),
          display_name: participant.displayName || usernameFor(participant.userId, participant.email),
          email: participant.email,
          accent: 'emerald',
          online: true,
          last_seen: now,
        },
        { onConflict: 'id' },
      );
      if (userError) throw new Error(`Could not sync user ${participant.userId}: ${userError.message}`);

      const { error: participantError } = await admin.from('conversation_participants').upsert(
        {
          conversation_id: conversationUuid,
          user_id: userUuid,
        },
        { onConflict: 'conversation_id,user_id', ignoreDuplicates: true },
      );
      if (participantError) throw new Error(`Could not add participant ${participant.userId}: ${participantError.message}`);
    }

    // Broadcast group creation to all participants.
    await broadcastToConversation(conversationId, 'group_created', {
      conversationId,
      name,
      createdBy: session.userId,
      participants: participantRelayIds,
      createdAt: now,
    });

    return { success: true, conversationId, participants: participantRelayIds };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create group.';
    console.error('[createGroup]', message);
    return { success: false, error: message };
  }
}

/**
 * Adds a single member to an existing group.
 */
export async function addGroupMember(
  input: AddGroupMemberInput,
): Promise<GroupActionResult> {
  const token = input?.token?.trim();
  const conversationId = input?.conversationId?.trim();
  const userId = input?.userId?.trim();
  const displayName = input?.displayName?.trim();
  const email = input?.email ?? null;

  if (!token) return { success: false, error: 'Not signed in.' };
  if (!conversationId) return { success: false, error: 'No group id provided.' };
  if (!userId) return { success: false, error: 'No user id provided.' };
  if (!displayName) return { success: false, error: 'Display name is required.' };

  const session = parseSessionToken(token);
  if (!session) return { success: false, error: 'Session is invalid or expired.' };

  try {
    const admin = getSupabaseAdmin();
    const now = new Date().toISOString();

    const callerUuid = stableUuid(`user:${session.userId}`);
    const targetUuid = stableUuid(`user:${userId}`);
    const conversationUuid = stableUuid(`conversation:${conversationId}`);

    // Verify caller is a participant.
    const { data: callerParticipant, error: callerError } = await admin
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationUuid)
      .eq('user_id', callerUuid)
      .maybeSingle();
    if (callerError) throw new Error(callerError.message);
    if (!callerParticipant) {
      return { success: false, error: 'You are not a participant in this group.' };
    }

    // Upsert the target user.
    const { error: userError } = await admin.from('users').upsert(
      {
        id: targetUuid,
        username: usernameFor(userId, email),
        display_name: displayName || usernameFor(userId, email),
        email,
        accent: 'emerald',
        online: true,
        last_seen: now,
      },
      { onConflict: 'id' },
    );
    if (userError) throw new Error(`Could not sync user: ${userError.message}`);

    // Link the target as a participant.
    const { error: participantError } = await admin.from('conversation_participants').upsert(
      {
        conversation_id: conversationUuid,
        user_id: targetUuid,
      },
      { onConflict: 'conversation_id,user_id', ignoreDuplicates: true },
    );
    if (participantError) throw new Error(`Could not add member: ${participantError.message}`);

    await broadcastToConversation(conversationId, 'member_added', {
      conversationId,
      addedBy: session.userId,
      addedUserId: userId,
      addedUserDisplayName: displayName,
      createdAt: now,
    });

    return { success: true, conversationId, participants: [userId] };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not add member.';
    console.error('[addGroupMember]', message);
    return { success: false, error: message };
  }
}

/**
 * Removes a member from a group. Only another participant can initiate.
 */
export async function removeGroupMember(
  input: RemoveGroupMemberInput,
): Promise<GroupActionResult> {
  const token = input?.token?.trim();
  const conversationId = input?.conversationId?.trim();
  const userId = input?.userId?.trim();

  if (!token) return { success: false, error: 'Not signed in.' };
  if (!conversationId) return { success: false, error: 'No group id provided.' };
  if (!userId) return { success: false, error: 'No user id provided.' };

  const session = parseSessionToken(token);
  if (!session) return { success: false, error: 'Session is invalid or expired.' };

  try {
    const admin = getSupabaseAdmin();
    const callerUuid = stableUuid(`user:${session.userId}`);
    const targetUuid = stableUuid(`user:${userId}`);
    const conversationUuid = stableUuid(`conversation:${conversationId}`);

    // Verify caller is a participant.
    const { data: callerParticipant, error: callerError } = await admin
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationUuid)
      .eq('user_id', callerUuid)
      .maybeSingle();
    if (callerError) throw new Error(callerError.message);
    if (!callerParticipant) {
      return { success: false, error: 'You are not a participant in this group.' };
    }

    // Don't allow removing the last participant.
    const { count } = await admin
      .from('conversation_participants')
      .select('*', { head: true, count: 'exact' })
      .eq('conversation_id', conversationUuid);
    if (count !== null && count <= 1) {
      return { success: false, error: 'Cannot remove the last participant.' };
    }

    const { error: deleteError } = await admin.from('conversation_participants')
      .delete()
      .eq('conversation_id', conversationUuid)
      .eq('user_id', targetUuid);
    if (deleteError) throw new Error(deleteError.message);

    await broadcastToConversation(conversationId, 'member_removed', {
      conversationId,
      removedBy: session.userId,
      removedUserId: userId,
      createdAt: new Date().toISOString(),
    });

    return { success: true, conversationId, participants: [userId] };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not remove member.';
    console.error('[removeGroupMember]', message);
    return { success: false, error: message };
  }
}

/**
 * The current user leaves a group. If they are the last participant, the
 * conversation row is left in place (orphaned) but they are unlinked.
 */
export async function leaveGroup(
  input: LeaveGroupInput,
): Promise<GroupActionResult> {
  const token = input?.token?.trim();
  const conversationId = input?.conversationId?.trim();

  if (!token) return { success: false, error: 'Not signed in.' };
  if (!conversationId) return { success: false, error: 'No group id provided.' };

  const session = parseSessionToken(token);
  if (!session) return { success: false, error: 'Session is invalid or expired.' };

  try {
    const admin = getSupabaseAdmin();
    const callerUuid = stableUuid(`user:${session.userId}`);
    const conversationUuid = stableUuid(`conversation:${conversationId}`);

    const { error: deleteError } = await admin.from('conversation_participants')
      .delete()
      .eq('conversation_id', conversationUuid)
      .eq('user_id', callerUuid);
    if (deleteError) throw new Error(deleteError.message);

    await broadcastToConversation(conversationId, 'group_left', {
      conversationId,
      leftUserId: session.userId,
      createdAt: new Date().toISOString(),
    });

    return { success: true, conversationId, participants: [session.userId] };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not leave group.';
    console.error('[leaveGroup]', message);
    return { success: false, error: message };
  }
}
