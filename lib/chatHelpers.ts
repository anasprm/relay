/**
 * Hybrid deduplication helpers for Relay Messenger's New Message flow.
 *
 * Phase A (Client-Side Memory Check - 0ms Latency):
 *   Searches local React state for an existing 1-on-1 conversation between
   * currentUserId and targetUserId. If found, returns it immediately without
   * any server round-trip.
 *
 * Phase B (Server-Side / Database Fallback):
 *   Handled by the caller (NewChatModal.handleSubmit) via
   * POST /api/conversations when Phase A returns null.
 */

export interface Conversation {
  id: string;
  kind?: 'direct' | 'group';
  participants: string[];
  [key: string]: any;
}

/**
 * Searches local state memory for an existing 1-on-1 conversation between
 * currentUserId and targetUserId.
 *
 * Defensive: conversations is coerced to [] via Array.isArray check so that
 * null/undefined/non-array values never throw "object is not iterable".
 *
 * @param conversations - The conversations array from React state (may be null/undefined)
 * @param currentUserId - The ID of the currently logged-in user
 * @param targetUserId - The ID of the user to start a conversation with
 * @returns The existing Conversation if found, otherwise null
 */
export function findExistingOneOnOneChat(
  conversations: Conversation[] | undefined | null,
  currentUserId: string,
  targetUserId: string
): Conversation | null {
  const safeConversations = Array.isArray(conversations) ? conversations : [];

  const existing = safeConversations.find((conv) => {
    const participants = Array.isArray(conv.participants) ? conv.participants : [];
    const isOneOnOne = !conv.isGroup && participants.length === 2;
    if (!isOneOnOne) return false;

    return participants.includes(currentUserId) && participants.includes(targetUserId);
  });

  return existing || null;
}
