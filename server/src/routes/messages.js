import crypto from 'node:crypto';
import { Router } from 'express';
import { requireAuth } from '../auth.js';
import {
  conversationFor,
  deleteMessagesByIds,
  findMessageById,
  getDb,
  persistConversation,
  persistMessage,
} from '../db.js';
import {
  broadcastMessage,
  broadcastMessageDeleted,
  broadcastMessageUpdate,
} from '../realtime.js';
import { serializeMessage } from '../serializers.js';
import { conversationScope } from '../site.js';
import { deleteUpload } from '../storage.js';
import { sanitizeText } from '../utils.js';

const router = Router();
router.use(requireAuth);

/**
 * The composer offers these six, so the API must accept the same set. Keeping
 * both lists aligned avoids a reaction that looks valid in the UI but 400s.
 */
const ALLOWED_REACTIONS = new Set(['❤️', '👍', '😂', '😮', '😢', '🙏', '🎉', '👀', '✅']);

/** How long the opener's browser has to fetch a view-once file before it is erased. */
const VIEW_ONCE_GRACE_MS = 90_000;

/** Resolve :id to a message in a conversation the caller can see. */
function locateMessage(req) {
  const message = findMessageById(req.params.id);
  if (!message) return null;
  const conversation = conversationFor(req.user.id, message.conversationId, req.scope);
  if (!conversation) return null;
  return { message, conversation };
}

/** GET /api/messages/starred — every message this account has saved. */
router.get('/starred', (req, res) => {
  const db = getDb();
  const conversationIds = new Set(
    db.conversations
      .filter(
        (conversation) =>
          conversation.participantIds.includes(req.user.id) &&
          conversationScope(conversation) === req.scope,
      )
      .map((conversation) => conversation.id),
  );

  const messages = db.messages
    .filter(
      (message) =>
        conversationIds.has(message.conversationId) &&
        message.stars?.[req.user.id] &&
        !message.hiddenFor?.[req.user.id],
    )
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((message) => {
      const conversation = db.conversations.find((entry) => entry.id === message.conversationId);
      return {
        message: serializeMessage(message, req.user.id),
        conversationId: message.conversationId,
        conversationKind: conversation?.kind === 'group' ? 'group' : 'direct',
        conversationTitle:
          conversation?.kind === 'group'
            ? conversation.title || 'Group chat'
            : conversation?.participantIds
                .filter((id) => id !== req.user.id)
                .map((id) => db.users.find((user) => user.id === id)?.displayName)
                .filter(Boolean)
                .join(', ') || 'Direct message',
      };
    });

  res.json({ messages });
});

/** POST /api/messages/:id/reactions { emoji } — toggles the viewer's reaction. */
router.post('/:id/reactions', async (req, res, next) => {
  try {
    const found = locateMessage(req);
    if (!found) return res.status(404).json({ error: 'Message not found.' });
    const { message } = found;

    const emoji = String(req.body?.emoji || '❤️');
    if (!ALLOWED_REACTIONS.has(emoji)) {
      return res.status(400).json({ error: 'Unsupported reaction.' });
    }

    message.reactions = message.reactions || {};
    if (message.reactions[req.user.id] === emoji) {
      delete message.reactions[req.user.id];
    } else {
      message.reactions[req.user.id] = emoji;
    }

    await persistMessage(message);
    broadcastMessageUpdate(req.app.locals.io, message);
    res.json({ message: serializeMessage(message, req.user.id) });
  } catch (error) {
    next(error);
  }
});

/** POST /api/messages/:id/star — save or unsave a message for this account. */
router.post('/:id/star', async (req, res, next) => {
  try {
    const found = locateMessage(req);
    if (!found) return res.status(404).json({ error: 'Message not found.' });
    const { message } = found;

    message.stars = message.stars || {};
    if (message.stars[req.user.id]) delete message.stars[req.user.id];
    else message.stars[req.user.id] = new Date().toISOString();

    await persistMessage(message);
    broadcastMessageUpdate(req.app.locals.io, message);
    res.json({
      starred: !!message.stars[req.user.id],
      message: serializeMessage(message, req.user.id),
    });
  } catch (error) {
    next(error);
  }
});

/** PATCH /api/messages/:id { text } — edit your own text message. */
router.patch('/:id', async (req, res, next) => {
  try {
    const found = locateMessage(req);
    if (!found) return res.status(404).json({ error: 'Message not found.' });
    const { message } = found;

    if (message.senderId !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own messages.' });
    }
    if (message.viewOnce) {
      return res.status(400).json({ error: 'View-once messages cannot be edited.' });
    }
    if ((message.kind || 'text') !== 'text') {
      return res.status(400).json({ error: 'Only text messages can be edited.' });
    }

    const text = sanitizeText(req.body?.text);
    if (!text) return res.status(400).json({ error: 'A message cannot be empty.' });
    if (text === message.text) {
      return res.json({ message: serializeMessage(message, req.user.id) });
    }

    message.text = text;
    message.editedAt = new Date().toISOString();
    await persistMessage(message);
    broadcastMessageUpdate(req.app.locals.io, message);
    res.json({ message: serializeMessage(message, req.user.id) });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/messages/:id/forward { conversationId }
 * Copies the content into another thread the caller belongs to. View-once
 * media is deliberately not forwardable.
 */
router.post('/:id/forward', async (req, res, next) => {
  try {
    const found = locateMessage(req);
    if (!found) return res.status(404).json({ error: 'Message not found.' });
    const { message: source } = found;

    if (source.viewOnce) {
      return res.status(400).json({ error: 'View-once messages cannot be forwarded.' });
    }
    if (!source.text && !source.attachment) {
      return res.status(400).json({ error: 'This message has nothing to forward.' });
    }

    const target = conversationFor(req.user.id, String(req.body?.conversationId || ''), req.scope);
    if (!target) return res.status(404).json({ error: 'Conversation not found.' });

    const modes = target.modes?.[req.user.id] || { anonymity: false, vanish: false };
    const createdAt = new Date().toISOString();
    const forwarded = {
      id: crypto.randomUUID(),
      conversationId: target.id,
      senderId: req.user.id,
      kind: source.kind || 'text',
      text: source.text || '',
      attachment: source.attachment || null,
      anonymous: !!modes.anonymity,
      ephemeral: !!modes.vanish,
      forwarded: true,
      reactions: {},
      createdAt,
    };

    getDb().messages.push(forwarded);
    target.updatedAt = createdAt;
    target.reads = target.reads || {};
    target.reads[req.user.id] = createdAt;

    await Promise.all([persistMessage(forwarded), persistConversation(target)]);
    broadcastMessage(req.app.locals.io, forwarded);

    res.status(201).json({ message: serializeMessage(forwarded, req.user.id) });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/messages/:id/view
 * Opens a view-once photo or video. The recipient may do this once: the media
 * is removed from the message (and erased from storage shortly after) so it
 * cannot be reopened by either side.
 */
router.post('/:id/view', async (req, res, next) => {
  try {
    const found = locateMessage(req);
    if (!found || !found.message.viewOnce) {
      return res.status(404).json({ error: 'Message not found.' });
    }
    const { message } = found;

    if (message.senderId === req.user.id) {
      return res.status(400).json({ error: 'You cannot open your own view-once message.' });
    }
    if (message.viewedBy?.[req.user.id] || !message.attachment) {
      return res.status(410).json({ error: 'This view-once message was already opened.' });
    }

    const attachment = message.attachment;
    const openedAt = new Date().toISOString();

    message.viewedBy = { ...(message.viewedBy || {}), [req.user.id]: openedAt };
    message.openedAt = message.openedAt || openedAt;
    message.attachment = null;
    await persistMessage(message);
    broadcastMessageUpdate(req.app.locals.io, message);

    // The browser has the signed URL now; erase the file after a short grace
    // period so the single view is genuinely the last one.
    const timer = setTimeout(() => {
      void deleteUpload(attachment.url);
    }, VIEW_ONCE_GRACE_MS);
    timer.unref?.();

    res.json({
      url: attachment.url,
      name: attachment.name,
      mime: attachment.mime,
      kind: attachment.kind || message.kind,
      openedAt,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/messages/:id
 * Body `{ forEveryone: false }` removes the message from the caller's copy only
 * (like "delete for me"). Otherwise it unsends for everyone, erasing its media.
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const found = locateMessage(req);
    if (!found) return res.status(404).json({ error: 'Message not found.' });
    const { message, conversation } = found;

    if (req.body?.forEveryone === false) {
      message.hiddenFor = { ...(message.hiddenFor || {}), [req.user.id]: new Date().toISOString() };
      await persistMessage(message);
      return res.json({ ok: true, id: message.id, forEveryone: false });
    }

    if (message.senderId !== req.user.id) {
      return res.status(403).json({ error: 'You can only unsend your own messages.' });
    }

    const attachmentUrl = message.attachment?.url || null;
    const db = getDb();
    db.messages = db.messages.filter((candidate) => candidate.id !== message.id);
    await deleteMessagesByIds([message.id]);

    if (conversation.pinned?.messageId === message.id) {
      delete conversation.pinned;
      await persistConversation(conversation);
    }

    broadcastMessageDeleted(req.app.locals.io, conversation, message.id);
    if (attachmentUrl) void deleteUpload(attachmentUrl);

    res.json({ ok: true, id: message.id, conversationId: conversation.id });
  } catch (error) {
    next(error);
  }
});

export default router;
