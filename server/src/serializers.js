import {
  findConversation,
  findMessageById,
  findUserById,
  isGroupConversation,
  lastMessageFor,
  visibleMessagesFor,
} from './db.js';
import { isOnline } from './presence.js';

const ANONYMOUS_IDENTITY = {
  id: 'anonymous',
  username: 'anonymous',
  displayName: 'Anonymous Operator',
  accent: 'slate',
  online: false,
  lastSeen: null,
  anonymous: true,
};

export function publicUser(user, viewer = null) {
  if (!user) return null;
  const alias =
    viewer && viewer.id !== user.id && viewer.aliases
      ? viewer.aliases[user.id] || null
      : null;
  return {
    id: user.id,
    username: user.username,
    displayName: alias || user.displayName,
    accent: user.accent,
    avatarUrl: user.avatarUrl || null,
    discoverable: user.discoverable !== false,
    online: isOnline(user.id),
    lastSeen: user.lastSeen || null,
  };
}

/** A compact snapshot of the message being quoted, safe for any participant. */
export function replyPreview(message) {
  if (!message) return null;
  const sender = findUserById(message.senderId);
  return {
    id: message.id,
    senderId: message.anonymous ? null : message.senderId,
    senderName: message.anonymous
      ? 'Anonymous Operator'
      : sender?.displayName || 'Unknown',
    kind: message.kind || 'text',
    text: (message.text || '').slice(0, 180),
    attachmentName: message.attachment?.name || null,
    anonymous: !!message.anonymous,
  };
}

/**
 * Read receipts are derived from each participant's `reads` watermark, so no
 * extra per-message bookkeeping is needed. A message counts as read once the
 * participant's watermark is at or after the moment it was sent.
 */
function readReceipts(message) {
  const conversation = findConversation(message.conversationId);
  if (!conversation) return { readBy: [], readCount: 0 };

  const sentAt = new Date(message.createdAt).getTime();
  const readBy = conversation.participantIds.filter((participantId) => {
    if (participantId === message.senderId) return false;
    const readAt = conversation.reads?.[participantId];
    return readAt ? new Date(readAt).getTime() >= sentAt : false;
  });

  return { readBy, readCount: readBy.length };
}

export function serializeMessage(message, viewerId) {
  if (!message) return null;

  const sender = findUserById(message.senderId);
  const viewer = findUserById(viewerId);
  const masked = !!message.anonymous && message.senderId !== viewerId;
  const viewedBy = message.viewedBy || {};
  const mine = message.senderId === viewerId;
  const receipts = readReceipts(message);

  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: masked ? null : message.senderId,
    sender: masked ? { ...ANONYMOUS_IDENTITY } : publicUser(sender, viewer),
    kind: message.kind || 'text',
    text: message.text || '',
    attachment: message.attachment || null,
    anonymous: !!message.anonymous,
    ephemeral: !!message.ephemeral,
    viewOnce: !!message.viewOnce,
    // Sender sees whether it was opened; the recipient sees whether they opened it.
    viewOnceOpened: mine ? Object.keys(viewedBy).length > 0 : !!viewedBy[viewerId],
    reactions: message.reactions || {},
    replyTo: replyPreview(findMessageById(message.replyToId)),
    storyReply: message.storyReply || null,
    editedAt: message.editedAt || null,
    forwarded: !!message.forwarded,
    starred: !!(message.stars?.[viewerId]),
    readCount: receipts.readCount,
    // Only the sender needs to know exactly who has read their message.
    ...(mine ? { readBy: receipts.readBy } : {}),
    createdAt: message.createdAt,
    // Transcript is only present for audio attachments and is a convenience label.
    transcript: message.transcript || null,
  };
}

export function unreadCount(conversation, viewerId) {
  const readAt = conversation.reads?.[viewerId] ? new Date(conversation.reads[viewerId]).getTime() : 0;
  return visibleMessagesFor(conversation, viewerId).filter(
    (message) =>
      message.senderId !== viewerId && new Date(message.createdAt).getTime() > readAt,
  ).length;
}

export function serializeConversation(conversation, viewerId) {
  const viewer = findUserById(viewerId);
  const group = isGroupConversation(conversation);
  // A group has no single "other" participant; the client shows the group title.
  const otherId = group
    ? null
    : conversation.participantIds.find((participantId) => participantId !== viewerId);
  const locked = !!conversation.locks?.[viewerId];
  const last = locked ? null : lastMessageFor(conversation.id, viewerId, conversation);
  const pinned = conversation.pinned?.messageId
    ? findMessageById(conversation.pinned.messageId)
    : null;
  const pinnedVisible = !!pinned && !pinned.hiddenFor?.[viewerId];

  return {
    id: conversation.id,
    kind: group ? 'group' : 'direct',
    title: group ? conversation.title || 'Group chat' : null,
    createdBy: group ? conversation.createdBy || null : null,
    memberCount: conversation.participantIds.length,
    participants: conversation.participantIds
      .map((participantId) => publicUser(findUserById(participantId), viewer))
      .filter(Boolean),
    other: group ? null : publicUser(findUserById(otherId), viewer),
    lastMessage: serializeMessage(last, viewerId),
    pinnedMessage: locked || !pinnedVisible ? null : serializeMessage(pinned, viewerId),
    unreadCount: unreadCount(conversation, viewerId),
    modes: conversation.modes?.[viewerId] || { anonymity: false, vanish: false },
    locked,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}
