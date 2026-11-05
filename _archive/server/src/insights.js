/**
 * Smart thread briefs.
 *
 * This is deliberately a deterministic, on-server summarizer: no third-party
 * model, no API key, no message content leaving the deployment. It scores the
 * sentences a person actually needs after being away — decisions, questions,
 * and requests — and returns a compact, explainable brief. The client can show
 * it without pretending an LLM wrote it.
 */

import { findUserById } from './db.js';

const STOPWORDS = new Set(
  `a about above after again against all am an and any are aren't as at be because been before being
  below between both but by can't cannot could couldn't did didn't do does doesn't doing don't down during
  each few for from further had hadn't has hasn't have haven't having he he'd he'll he's her here here's hers
  herself him himself his how how's i i'd i'll i'm i've if in into is isn't it it's its itself let's me more
  most mustn't my myself no nor not of off on once only or other ought our ours ourselves out over own same
  shan't she she'd she'll she's should shouldn't so some such than that that's the their theirs them
  themselves then there there's these they they'd they'll they're they've this those through to too under
  until up very was wasn't we we'd we'll we're we've were weren't what what's when when's where where's which
  while who who's whom why why's with won't would wouldn't you you'd you'll you're you've your yours yourself
  yourselves ok okay yeah yes just really quite maybe probably actually basically literally still already also
  thing things stuff gonna wanna got get got much many lot`.split(/\s+/),
);

const ACTION_CUES = [
  'please',
  'can you',
  'could you',
  'would you',
  'need to',
  'needs to',
  'have to',
  'has to',
  'must',
  "don't forget",
  'do not forget',
  'remember to',
  'make sure',
  'send ',
  'bring ',
  'review ',
  'confirm ',
  'reply ',
  'call ',
  'meet ',
  'deadline',
  'due ',
  'asap',
  "let's",
  'lets ',
  'we should',
  'i need',
  'waiting for',
  'follow up',
];

const TIME_CUES = [
  'today',
  'tomorrow',
  'tonight',
  'this morning',
  'this afternoon',
  'this evening',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
  'noon',
  'midnight',
  'this week',
  'next week',
  'weekend',
  'deadline',
  'due',
  'by ',
  'before ',
  'after ',
  'am',
  'pm',
];

function tokenize(value) {
  return (value || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function splitSentences(value) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return [];
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 8);
}

function includesAny(haystack, needles) {
  const lower = haystack.toLowerCase();
  return needles.some((needle) => lower.includes(needle));
}

function senderName(message, viewerId) {
  if (message.anonymous && message.senderId !== viewerId) return 'Anonymous Operator';
  const sender = findUserById(message.senderId);
  if (!sender) return 'Someone';
  return sender.displayName || sender.username || 'Someone';
}

function truncate(value, max) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function minutesFor(words) {
  return Math.max(1, Math.round(words / 220));
}

/**
 * Builds a brief for one conversation.
 *
 * `messages` must already be the viewer's visible copy, oldest first. When the
 * viewer has unread messages we summarize those; otherwise we fall back to the
 * last day, then to the tail of the thread, so the card is still useful in a
 * busy group that was already marked read.
 */
export function buildBrief({ conversation, viewerId, messages, now = new Date() }) {
  const readAt = conversation.reads?.[viewerId]
    ? new Date(conversation.reads[viewerId]).getTime()
    : 0;

  const unread = messages.filter(
    (message) =>
      message.senderId !== viewerId && new Date(message.createdAt).getTime() > readAt,
  );

  const dayAgo = now.getTime() - 24 * 60 * 60 * 1000;
  const recent = messages.filter((message) => new Date(message.createdAt).getTime() >= dayAgo);
  const fromOthers = (pool) => pool.filter((message) => message.senderId !== viewerId);

  let pool;
  let source;
  if (fromOthers(unread).length > 0) {
    pool = fromOthers(unread);
    source = 'unread';
  } else if (fromOthers(recent).length > 0) {
    pool = fromOthers(recent);
    source = 'recent';
  } else {
    pool = fromOthers(messages).slice(-12);
    source = 'thread';
  }

  const textMessages = pool.filter((message) => (message.text || '').trim());
  const words = textMessages.reduce(
    (total, message) => total + (message.text || '').trim().split(/\s+/).length,
    0,
  );

  /* Term frequency across the pool, used to score sentences. */
  const frequency = new Map();
  for (const message of textMessages) {
    for (const token of tokenize(message.text)) {
      frequency.set(token, (frequency.get(token) || 0) + 1);
    }
  }
  const maxFrequency = Math.max(1, ...frequency.values());

  const candidates = [];
  for (const message of textMessages) {
    const sentences = splitSentences(message.text);
    sentences.forEach((sentence, index) => {
      const tokens = tokenize(sentence);
      if (tokens.length === 0) return;

      const keywordScore =
        tokens.reduce((total, token) => total + (frequency.get(token) || 0) / maxFrequency, 0) /
        Math.sqrt(tokens.length);

      const isQuestion = /\?$/.test(sentence);
      const actionable = includesAny(sentence, ACTION_CUES);
      const timed = includesAny(sentence, TIME_CUES);

      // Later sentences in a message are often the actual ask, so give a small
      // bonus to the final sentence instead of always quoting the opener.
      const positionBonus = index === sentences.length - 1 ? 0.35 : 0;

      const score =
        keywordScore +
        (isQuestion ? 1.4 : 0) +
        (actionable ? 1.1 : 0) +
        (timed ? 0.45 : 0) +
        positionBonus;

      candidates.push({
        text: truncate(sentence, 220),
        raw: sentence,
        sender: senderName(message, viewerId),
        at: message.createdAt,
        score,
        isQuestion,
        actionable,
        timed,
      });
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  const highlights = [];
  const used = new Set();
  for (const candidate of candidates) {
    const fingerprint = candidate.text.toLowerCase();
    if (used.has(fingerprint)) continue;
    used.add(fingerprint);
    highlights.push(candidate);
    if (highlights.length === 3) break;
  }

  const actionItems = candidates
    .filter((candidate) => candidate.actionable || candidate.isQuestion || candidate.timed)
    .filter((candidate) => !highlights.slice(0, 1).some((entry) => entry.text === candidate.text))
    .slice(0, 4)
    .map((candidate) => ({
      text: candidate.text,
      sender: candidate.sender,
      at: candidate.at,
      kind: candidate.isQuestion ? 'question' : candidate.timed ? 'time' : 'request',
    }));

  const topics = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([token]) => token)
    .filter((token) => token.length >= 4)
    .slice(0, 6);

  const bySenderMap = new Map();
  for (const message of pool) {
    const name = senderName(message, viewerId);
    bySenderMap.set(name, (bySenderMap.get(name) || 0) + 1);
  }

  const windowStart = pool.length
    ? new Date(Math.min(...pool.map((message) => new Date(message.createdAt).getTime()))).toISOString()
    : null;
  const windowEnd = pool.length
    ? new Date(Math.max(...pool.map((message) => new Date(message.createdAt).getTime()))).toISOString()
    : null;

  return {
    generatedAt: now.toISOString(),
    source,
    windowStart,
    windowEnd,
    stats: {
      messages: pool.length,
      participants: bySenderMap.size,
      media: pool.filter((message) => message.attachment).length,
      words,
      readingMinutes: minutesFor(words),
      bySender: [...bySenderMap.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
    },
    highlights: highlights.map((candidate) => ({
      text: candidate.text,
      sender: candidate.sender,
      at: candidate.at,
    })),
    actionItems,
    topics,
    // Honest provenance: the UI shows this instead of implying a cloud model.
    engine: 'relay-local-extractive',
  };
}
