import crypto from 'node:crypto';
import { Router } from 'express';
import { requireAuth } from '../auth.js';
import {
  deleteStoryById,
  findUserById,
  getDb,
  persistConversation,
  persistMessage,
  persistStory,
} from '../db.js';
import {
  broadcastConversationRefresh,
  broadcastMessage,
  broadcastStoriesChanged,
  broadcastStoryViewed,
} from '../realtime.js';
import { publicUser, serializeMessage } from '../serializers.js';
import { conversationScope, userScope } from '../site.js';
import { deleteUpload } from '../storage.js';
import { isSafeUploadUrl, sanitizeText } from '../utils.js';

const router = Router();
router.use(requireAuth);

const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_STORY_TEXT = 700;
const MAX_STORY_IMAGE_BYTES = 30 * 1024 * 1024;
const STORY_REACTIONS = new Set(['❤️', '🔥', '😂', '😮', '😢', '👏']);

/** Only known gradient tokens reach the client; never raw CSS. */
const STORY_BACKGROUNDS = new Set([
  'indigo',
  'violet',
  'emerald',
  'amber',
  'rose',
  'cyan',
  'slate',
  'sunset',
  'ocean',
  'forest',
  'midnight',
  'peach',
]);

function storyScope(story, owner) {
  return story.scope || (owner ? userScope(owner) : 'public');
}

/** A story is visible to its owner, to everyone, or to the owner's close friends. */
function visibleTo(story, owner, viewerId) {
  if (story.userId === viewerId) return true;
  if (!story.closeFriendsOnly) return true;
  return Array.isArray(owner?.closeFriends) && owner.closeFriends.includes(viewerId);
}

function serializeStory(story, viewerId) {
  const viewers = story.viewers || {};
  return {
    id: story.id,
    userId: story.userId,
    kind: story.kind === 'image' ? 'image' : 'text',
    text: story.text || '',
    background: STORY_BACKGROUNDS.has(story.background) ? story.background : 'indigo',
    attachment: story.attachment || null,
    closeFriendsOnly: !!story.closeFriendsOnly,
    viewed: !!viewers[viewerId],
    viewerCount: Object.keys(viewers).length,
    createdAt: story.createdAt,
    expiresAt: story.expiresAt,
  };
}

/** Removes expired stories and their media. Runs before every read. */
async function pruneExpiredStories() {
  const db = getDb();
  const now = Date.now();
  const expired = db.stories.filter((story) => new Date(story.expiresAt).getTime() <= now);
  if (expired.length === 0) return;

  const expiredIds = new Set(expired.map((story) => story.id));
  db.stories = db.stories.filter((story) => !expiredIds.has(story.id));

  for (const story of expired) {
    await deleteStoryById(story.id);
    if (story.attachment?.url) void deleteUpload(story.attachment.url);
  }
}

/** Finds the direct thread between two accounts, creating it when needed. */
async function directConversationBetween(io, viewer, other, scope) {
  const db = getDb();
  let conversation = db.conversations.find(
    (candidate) =>
      candidate.kind !== 'group' &&
      candidate.participantIds.length === 2 &&
      candidate.participantIds.includes(viewer.id) &&
      candidate.participantIds.includes(other.id) &&
      conversationScope(candidate) === scope,
  );

  if (!conversation) {
    conversation = {
      id: crypto.randomUUID(),
      participantIds: [viewer.id, other.id],
      scope,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      modes: {
        [viewer.id]: { anonymity: false, vanish: false },
        [other.id]: { anonymity: false, vanish: false },
      },
      reads: {},
    };
    db.conversations.push(conversation);
    await persistConversation(conversation);
    broadcastConversationRefresh(io, conversation);
  }

  return conversation;
}

/** GET /api/stories — active stories grouped by author, plus close-friend ids. */
router.get('/', async (req, res, next) => {
  try {
    await pruneExpiredStories();

    const db = getDb();
    const groups = new Map();

    for (const story of db.stories) {
      const owner = findUserById(story.userId);
      if (!owner || storyScope(story, owner) !== req.scope) continue;
      if (!visibleTo(story, owner, req.user.id)) continue;

      const entry = groups.get(owner.id) || {
        user: publicUser(owner, req.user),
        stories: [],
        unseenCount: 0,
        isMine: owner.id === req.user.id,
      };
      entry.stories.push(serializeStory(story, req.user.id));
      if (!story.viewers?.[req.user.id] && owner.id !== req.user.id) entry.unseenCount += 1;
      groups.set(owner.id, entry);
    }

    const list = [...groups.values()]
      .map((entry) => ({
        ...entry,
        stories: entry.stories.sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
        ),
      }))
      .sort((a, b) => {
        if (a.isMine !== b.isMine) return a.isMine ? -1 : 1;
        const aLatest = a.stories[a.stories.length - 1]?.createdAt || '';
        const bLatest = b.stories[b.stories.length - 1]?.createdAt || '';
        return new Date(bLatest) - new Date(aLatest);
      });

    res.json({
      groups: list,
      closeFriends: Array.isArray(req.user.closeFriends) ? req.user.closeFriends : [],
    });
  } catch (error) {
    next(error);
  }
});

/** POST /api/stories — publish a text or photo story for 24 hours. */
router.post('/', async (req, res, next) => {
  try {
    const kind = req.body?.kind === 'image' ? 'image' : 'text';
    const text = sanitizeText(req.body?.text, MAX_STORY_TEXT);
    const rawAttachment = req.body?.attachment;

    let attachment = null;
    if (kind === 'image') {
      if (!rawAttachment || !isSafeUploadUrl(rawAttachment.url)) {
        return res.status(400).json({ error: 'Upload a photo for this story.' });
      }
      const mime = sanitizeText(rawAttachment.mime, 120);
      if (!mime.startsWith('image/')) {
        return res.status(400).json({ error: 'Stories only support images.' });
      }
      const size = Math.max(0, Number(rawAttachment.size) || 0);
      if (size > MAX_STORY_IMAGE_BYTES) {
        return res.status(400).json({ error: 'Story photos are limited to 30 MB.' });
      }
      attachment = {
        url: rawAttachment.url,
        name: sanitizeText(rawAttachment.name, 180) || 'story',
        mime,
        size,
        kind: 'image',
        width: Number(rawAttachment.width) || undefined,
        height: Number(rawAttachment.height) || undefined,
      };
    } else if (!text) {
      return res.status(400).json({ error: 'Write something for your story.' });
    }

    const now = new Date();
    const story = {
      id: crypto.randomUUID(),
      userId: req.user.id,
      scope: req.scope,
      kind,
      text,
      background: STORY_BACKGROUNDS.has(req.body?.background) ? req.body.background : 'indigo',
      attachment,
      closeFriendsOnly: !!req.body?.closeFriendsOnly,
      viewers: {},
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + STORY_TTL_MS).toISOString(),
    };

    getDb().stories.push(story);
    await persistStory(story);
    broadcastStoriesChanged(req.app.locals.io, req.scope);

    res.status(201).json({ story: serializeStory(story, req.user.id) });
  } catch (error) {
    next(error);
  }
});

/** POST /api/stories/:id/view — mark a story as seen by the caller. */
router.post('/:id/view', async (req, res, next) => {
  try {
    const story = getDb().stories.find((entry) => entry.id === req.params.id);
    if (!story) return res.status(404).json({ error: 'Story not found.' });

    const owner = findUserById(story.userId);
    if (!owner || storyScope(story, owner) !== req.scope || !visibleTo(story, owner, req.user.id)) {
      return res.status(404).json({ error: 'Story not found.' });
    }
    if (new Date(story.expiresAt).getTime() <= Date.now()) {
      return res.status(410).json({ error: 'This story has expired.' });
    }

    if (story.userId !== req.user.id) {
      story.viewers = story.viewers || {};
      if (!story.viewers[req.user.id]) {
        story.viewers[req.user.id] = new Date().toISOString();
        await persistStory(story);
        broadcastStoryViewed(
          req.app.locals.io,
          story.userId,
          story.id,
          publicUser(req.user),
        );
      }
    }

    res.json({ ok: true, viewed: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/stories/:id/reply { text?, reaction? }
 * Instagram-style story replies land as a direct message to the author. The
 * message carries a compact snapshot so it still reads well after the story
 * expires. Reactions are the quick heart/tapback path.
 */
router.post('/:id/reply', async (req, res, next) => {
  try {
    const story = getDb().stories.find((entry) => entry.id === req.params.id);
    if (!story) return res.status(404).json({ error: 'Story not found.' });

    const author = findUserById(story.userId);
    if (!author || storyScope(story, author) !== req.scope || !visibleTo(story, author, req.user.id)) {
      return res.status(404).json({ error: 'Story not found.' });
    }
    if (story.userId === req.user.id) {
      return res.status(400).json({ error: 'You cannot reply to your own story.' });
    }
    if (new Date(story.expiresAt).getTime() <= Date.now()) {
      return res.status(410).json({ error: 'This story has expired.' });
    }

    const reaction = sanitizeText(req.body?.reaction, 16);
    const text = sanitizeText(req.body?.text, 1000);
    if (reaction && !STORY_REACTIONS.has(reaction)) {
      return res.status(400).json({ error: 'Unsupported story reaction.' });
    }
    if (!reaction && !text) {
      return res.status(400).json({ error: 'Write a reply first.' });
    }

    const conversation = await directConversationBetween(
      req.app.locals.io,
      req.user,
      author,
      req.scope,
    );
    const modes = conversation.modes?.[req.user.id] || { anonymity: false, vanish: false };
    const createdAt = new Date().toISOString();

    const message = {
      id: crypto.randomUUID(),
      conversationId: conversation.id,
      senderId: req.user.id,
      kind: 'text',
      text: reaction || text,
      attachment: null,
      anonymous: !!modes.anonymity,
      ephemeral: !!modes.vanish,
      storyReply: {
        storyId: story.id,
        authorId: story.userId,
        kind: story.kind === 'image' ? 'image' : 'text',
        text: (story.text || '').slice(0, 180),
        background: STORY_BACKGROUNDS.has(story.background) ? story.background : 'indigo',
        attachmentUrl: story.attachment?.url || null,
        reaction: reaction || null,
      },
      reactions: {},
      createdAt,
    };

    getDb().messages.push(message);
    conversation.updatedAt = createdAt;
    conversation.reads = conversation.reads || {};
    conversation.reads[req.user.id] = createdAt;

    await Promise.all([persistMessage(message), persistConversation(conversation)]);
    broadcastMessage(req.app.locals.io, message);

    res.status(201).json({
      message: serializeMessage(message, req.user.id),
      conversationId: conversation.id,
    });
  } catch (error) {
    next(error);
  }
});

/** GET /api/stories/:id/viewers — only the author may see who watched. */
router.get('/:id/viewers', (req, res) => {
  const story = getDb().stories.find((entry) => entry.id === req.params.id);
  if (!story || story.userId !== req.user.id) {
    return res.status(404).json({ error: 'Story not found.' });
  }

  const viewers = Object.entries(story.viewers || {})
    .map(([userId, viewedAt]) => {
      const user = findUserById(userId);
      return user ? { user: publicUser(user, req.user), viewedAt } : null;
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt));

  res.json({ viewers });
});

/** DELETE /api/stories/:id — the author can remove a story early. */
router.delete('/:id', async (req, res, next) => {
  try {
    const story = getDb().stories.find((entry) => entry.id === req.params.id);
    if (!story || story.userId !== req.user.id) {
      return res.status(404).json({ error: 'Story not found.' });
    }

    await deleteStoryById(story.id);
    if (story.attachment?.url) void deleteUpload(story.attachment.url);
    broadcastStoriesChanged(req.app.locals.io, req.scope);

    res.json({ ok: true, id: story.id });
  } catch (error) {
    next(error);
  }
});

export default router;
