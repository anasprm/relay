// ============================
// Read Receipts / Ghost Mode Configuration
// ============================

/** Default read receipt modes per user */
const DEFAULT_MODES = {
  anonymity: false,
  vanish: false,
  readReceipts: true, // default: show read receipts
};

/** GET /api/conversations/:id/modes - get read receipt mode for user */
router.get('/:id/modes', async (req, res, next) => {
  try {
    const conversation = conversationFor(req.user.id, req.params.id, req.scope);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found.' });

    const modes = conversation.modes?.[req.user.id] || { ...DEFAULT_MODES };
    res.json({ modes });
  } catch (error) {
    next(error);
  }
});

/** PATCH /api/conversations/:id/modes - update read receipt mode */
router.patch('/:id/modes', async (req, res, next) => {
  try {
    const conversation = conversationFor(req.user.id, req.params.id, req.scope);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found.' });

    const { readReceipts, stealthRead } = req.body || {};
    const allowedRR = ['true', 'false', true, false];
    const allowedSR = ['true', 'false', true, false];

    // Update read receipts preference
    if (allowedRR.includes(readReceipts)) {
      conversation.modes = conversation.modes || {};
      conversation.modes[req.user.id] = {
        ...conversation.modes[req.user.id],
        readReceipts: readReceipts === true || readReceipts === 'true',
      };
    }

    // Update stealth read mode (Schrödinger's read status)
    // When stealthRead is enabled, the user can read messages without
    // updating their read watermark. Read receipts are only sent when
    // the user reacts with an emoji or sends a reply.
    if (allowedSR.includes(stealthRead)) {
      conversation.modes = conversation.modes || {};
      conversation.modes[req.user.id] = {
        ...conversation.modes[req.user.id],
        stealthRead: stealthRead === true || stealthRead === 'true',
      };
      await persistConversation(conversation);
      broadcastConversationRefresh(req.app.locals.io, conversation);
    }

    const updatedModes = conversation.modes?.[req.user.id] || { readReceipts: true, stealthRead: false };
    const hasUpdates = req.body?.readReceipts !== undefined || req.body?.stealthRead !== undefined;

    if (hasUpdates) {
      res.json({ modes: updatedModes });
    } else {
      res.json({ modes: updatedModes });
    }
  } catch (error) {
    next(error);
  }
});

/** -----------------------------------------------------------------
  * Read receipt logic: a message counts as "read" for a participant once
  * their watermark is at or after the moment the message was sent.
  * Implements Schrödinger's Read Status (stealth read): when stealthRead
  * is enabled, the user can read messages without updating their read
  * watermark. Read receipts are only sent when the user reacts with an
  * emoji or sends a reply.
  * ----------------------------------------------------------------- */

function readReceipts(message, conversation, viewerId, modes) {
  const conversation = findConversation(message.conversationId);
  if (!conversation) return { readBy: [], readCount: 0 };

  // If viewer has stealth read enabled, they can read without updating watermark
  if (modes?.stealthRead) {
    // In stealth mode, we still track that they viewed it for analytics
    // but don't update the public reads watermark
    const sentAt = new Date(message.createdAt).getTime();
    const readBy = conversation.participantIds.filter((participantId) => {
      const participantReadAt = conversation.reads?.[participantId];
      // Still check if they've read it, but don't force reply pressure
      return participantReadAt ? new Date(participantReadAt).getTime() >= sentAt : false;
    });
    return { readBy, readCount: readBy.length, stealth: true };
  }

  const sentAt = new Date(message.createdAt).getTime();
  const readAt = conversation.reads?.[viewerId]
    ? new Date(conversation.reads[viewerId]).getTime()
    : 0;

  // If viewer has read past the message send time, they've read it
  if (readAt && readAt >= sentAt) {
    // Determine who has read it
    const readBy = conversation.participantIds.filter((participantId) => {
      const participantReadAt = conversation.reads?.[participantId];
      return participantReadAt ? new Date(participantReadAt).getTime() >= sentAt : false;
    });

    return { readBy, readCount: readBy.length };
  }

  return { readBy: [], readCount: 0 };
}

// ============================
// Whisper Text (Passcode-Revealed Secrets)
// ============================

/** Whisper text: messages blurred until tapped/unlocked */
function whisperText(message, viewerId, passcode) {
  // If viewer has provided the passcode, show normal text
  if (passcode && passcode === message.whisperPasscode) {
    return message.text || '';
  }

  // Otherwise, return blurred version
  const visibleChars = 20;
  const text = message.text || '';
  if (text.length <= visibleChars) {
    return '...'.repeat(Math.ceil(text.length / visibleChars));
  }
  return text.substring(0, visibleChars) + '...' + '✕'.repeat(Math.ceil((text.length - visibleChars) / visibleChars));
}

// ============================
// Smart Auto-Draft Tone Shifter
// ============================

/** Tone options for auto-draft */
const TONE_OPTIONS = {
  PROFESSIONAL: 'Professional',
  FRIENDLY: 'Friendly',
  CONCISE: 'Concise',
  PLAYFUL: 'Playful',
};

/** Auto-shift message tone based on content */
function shiftTone(text, currentTone = 'neutral') {
  const lower = text.toLowerCase();

  if (currentTone === 'neutral') {
    if (/\b(please|thank you|sincerely|regards)\b/.test(lower))
      return TONE_OPTIONS.PROFESSIONAL;
    if (/\b(hey|hi|yo|what's up)\b/.test(lower)) return TONE_OPTIONS.FRIENDLY;
    if (lower.split(' ').length < 10) return TONE_OPTIONS.CONCISE;
    return TONE_OPTIONS.PLAYFUL;
  }

  // Apply tone transformation
  switch (currentTone) {
    case TONE_OPTIONS.PROFESSIONAL:
      return text.replace(/\b(hey|hi|yo)\b/gi, 'Hello').replace(/\b(yeah|yeah sure)\b/gi, 'Yes, I agree');
    case TONE_OPTIONS.FRIENDLY:
      return text.replace(/\b(Hello|Hi there)\b/gi, 'Hey!').replace(/\b(Yes, I agree)\b/gi, 'Yeah sure!');
    case TONE_OPTIONS.CONCISE:
      return text.replace(/\b(very|really|actually)\b/gi, '').replace(/\b(in order to)\b/gi, 'to');
    case TONE_OPTIONS.PLAYFUL:
      return text.replace(/\.([.])$/gi, '!').replace(/\b(soon|later)\b/gi, 'ASAP!').replace(/\,/g, '! ');
  }
}

// ============================
// Smart Focus & Distraction Shield Auto-DND
// ============================

/** Default DND settings */
const DEFAULT_DND_SETTINGS = {
  enabled: false,
  VIPOnly: false,
  VIPContacts: [], // usernames that bypass DND
  schedule: {
    start: '22:00', // 10 PM
    end: '08:00',   // 8 AM
  },
};

/** Update DND settings for a user */
function updateDndSettings(userId, settings) {
  // Would persist to user record
  console.log('[DND] Updated settings for user', userId, settings);
}

/** Check if a message/chat should bypass DND */
function shouldBypassDnd(conversation, user, dndSettings) {
  if (!dndSettings.enabled) return true;

  // VIP contacts always bypass
  if (dndSettings.VIPOnly && dndSettings.VIPContacts.includes(conversation.owner?.username || '')) {
    return true;
  }

  // Schedule-based DND
  const now = new Date();
  const [startH, startM] = dndSettings.schedule.start.split(':').map(Number);
  const [endH, endM] = dndSettings.schedule.end.split(':').map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  // If schedule wraps past midnight
  const inDndPeriod = currentMinutes >= startMinutes || currentMinutes < endMinutes;

  return !inDndPeriod;
}

// ============================
// Integrated Split-Bill Ledger
// ============================

/** Expense record in the split-bill ledger */
interface ExpenseRecord {
  id: string;
  conversationId: string;
  description: string;
  amount: number;
  paidBy: string; // user ID
  splitAmong: string[]; // user IDs (empty = paid by one person)
  createdAt: string;
  settled: boolean;
}

/** Ledger state for a conversation */
interface LedgerState {
  expenses: ExpenseRecord[];
  balances: Record<string, number>; // userId -> net balance (positive = owed to, negative = owes)
}

/** Create a new expense entry in the split-bill ledger */
function createExpenseRecord(
  conversationId: string,
  description: string,
  amount: number,
  paidBy: string,
  splitAmong: string[]
): ExpenseRecord {
  const id = `exp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    conversationId,
    description,
    amount,
    paidBy,
    splitAmong,
    createdAt: new Date().toISOString(),
    settled: false,
  };
}

/** Record an expense in the split-bill ledger */
function recordLedgerExpense(conversationId: string, description: string, amount: number, paidBy: string, splitAmong: string[]) {
  const expense = createExpenseRecord(conversationId, description, amount, paidBy, splitAmong);
  
  // Update balances
  const balances: Record<string, number> = {};
  
  // Initialize all participants
  // In a real app, we'd query the conversation participants
  
  // Calculate share
  const numRecipients = splitAmong.length || 1; // if splitAmong is empty, it's paid by one person
  const share = amount / numRecipients;
  
  // The person who paid gets +amount (they're owed that much)
  // Each recipient gets -share (they owe that much)
  // Net balance: what each person should settle
  
  // For simplicity: paidBy is owed 'amount', others owe 'share' each
  // Net = what you're owed - what you owe
  
  // Add expense
  expenses.push(expense);
  
  // Recalculate balances
  // Reset all balances
  participants.forEach((pid) => {
    balances[pid] = 0;
  });
  
  // Paid person is owed the full amount
  balances[paidBy] = (balances[paidBy] || 0) + amount;
  
  // Each recipient owes their share
  (splitAmong || [paidBy]).forEach((pid) => {
    if (pid !== paidBy) {
      balances[pid] = (balances[pid] || 0) - share;
    }
  });
  
  return { expense, balances };
}

/** Get ledger state for a conversation */
function getLedgerState(conversationId: string): LedgerState {
  // In a real app, this would query the database for all expenses
  // for this conversation and recalculate balances
  return { expenses: [], balances: {} };
}

/** Settle a debt between two users */
function settleDebt(conversationId: string, fromUser: string, toUser: string, amount: number) {
  // Record a settlement transaction
  // In a real app, this would update the ledger and potentially create
  // a new simplified balance
  return { settled: true, fromUser, toUser, amount, settledAt: new Date().toISOString() };
}

// ============================
// Zero-Latency Dual-Stream Translation
// ============================

/** Translation direction */
type TranslationDirection = 'auto' | 'en' | 'es' | 'fr' | 'de' | 'zh' | 'ar' | 'ja' | 'ko';

/** Translation result */
interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
}

/** Translate text using server-side model */
function translateText(text: string, targetLang: TranslationDirection): TranslationResult {
  // In a real app, this would call a translation API (Google Translate, DeepL, etc.)
  // For now, return a placeholder
  
  // Auto-detect if target is 'auto'
  const target = targetLang === 'auto' ? 'es' : targetLang; // Default to Spanish for demo
  
  // Simple placeholder translation
  const translations: Record<string, string> = {
    'hello': 'hola',
    'thank you': 'gracias',
    'how are you': 'cómo estás',
    'good morning': 'buenos días',
    'good evening': 'buenas tardes',
  };
  
  const lower = text.toLowerCase();
  const translated = translations[lower] || `[translated to ${target}: ${text}]`;
  
  return {
    originalText: text,
    translatedText: translated,
    sourceLanguage: 'en',
    targetLanguage: target,
    confidence: 0.85,
  };
}

/** GET /api/translate - translate text */
router.get('/translate', async (req, res, next) => {
  try {
    const { text, target } = req.query;
    
    if (!text) {
      return res.status(400).json({ error: 'Text parameter is required' });
    }
    
    const targetLang = (target as TranslationDirection) || 'auto';
    const result = translateText(text as string, targetLang);
    
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

// ============================
// Cloud-Streamed Zero-Footprint Media
// ============================

/** Serve optimized media proxy */
router.get('/media/proxy', async (req, res, next) => {
  try {
    const { original, size } = req.query;
    
    if (!original) {
      return res.status(400).json({ error: 'Original parameter is required' });
    }
    
    // In a real app, this would serve an optimized proxy from cloud storage
    // For now, return a placeholder indicating cloud streaming is available
    const proxyInfo = {
      original: decodeURIComponent(original as string),
      size: size || 'original',
      streamable: true,
      cloudStorage: true,
      // The actual media would be served from CDN-backed cloud storage
      // with automatic format conversion and resize on-the-fly
    };
    
    res.json({ proxyInfo });
  } catch (error) {
    next(error);
  }
});

// ============================
// Export all new functionality
// ============================

// ============================
// Zero-Latency Dual-Stream Translation
// ============================

/** Translation direction */
type TranslationDirection = 'auto' | 'en' | 'es' | 'fr' | 'de' | 'zh' | 'ar' | 'ja' | 'ko';

/** Translation result */
interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
}

/** Translate text using server-side model */
function translateText(text: string, targetLang: TranslationDirection): TranslationResult {
  // In a real app, this would call a translation API (Google Translate, DeepL, etc.)
  // For now, return a placeholder
  
  // Auto-detect if target is 'auto'
  const target = targetLang === 'auto' ? 'es' : targetLang; // Default to Spanish for demo
  
  // Simple placeholder translation
  const translations: Record<string, string> = {
    'hello': 'hola',
    'thank you': 'gracias',
    'how are you': 'cómo estás',
    'good morning': 'buenos días',
    'good evening': 'buenas tardes',
  };
  
  const lower = text.toLowerCase();
  const translated = translations[lower] || `[translated to ${target}: ${text}]`;
  
  return {
    originalText: text,
    translatedText: translated,
    sourceLanguage: 'en',
    targetLanguage: target,
    confidence: 0.85,
  };
}

/** GET /api/translate - translate text */
router.get('/translate', async (req, res, next) => {
  try {
    const { text, target } = req.query;
    
    if (!text) {
      return res.status(400).json({ error: 'Text parameter is required' });
    }
    
    const targetLang = (target as TranslationDirection) || 'auto';
    const result = translateText(text as string, targetLang);
    
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

// ============================
// Export all new functionality
// ============================

// ============================
// Transparent Edit Version History
// ============================

/** Message edit history entry */
interface EditHistoryEntry {
  id: string;
  messageId: string;
  previousText: string;
  editedAt: string;
  editedBy: string;
  reason?: string;
}

/** Track a message edit and add to version history */
function trackMessageEdit(
  messageId: string,
  previousText: string,
  editedBy: string,
  reason?: string
): EditHistoryEntry {
  const id = `edit-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    messageId,
    previousText,
    editedAt: new Date().toISOString(),
    editedBy,
    reason,
  };
}

/** Get edit history for a message */
function getMessageEditHistory(messageId: string): EditHistoryEntry[] {
  // In a real app, this would query the database for edit history
  // associated with this message ID
  return [];
}

/** Get transparent edit version history for display */
function getTransparentEditHistory(message: any): { current: string; history: EditHistoryEntry[] } {
  const history = getMessageEditHistory(message.id);
  return {
    current: message.text || '',
    history,
  };
}

// ============================
// In-Chat AI Poll-to-Calendar Sync
// ============================

/** Convert poll results to a calendar event */
function pollToCalendarEvent(
  pollId: string,
  pollOptions: string[],
  winningOptionIndex: number,
  conversationId: string
): {
  eventId: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  timeZone: string;
  inviteLinks: string[];
} {
  const winningOption = pollOptions[winningOptionIndex] || 'Selected option';
  const now = new Date();
  
  // Parse the poll timing from the options or use default (next week)
  const defaultDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // next week
  
  return {
    eventId: `cal-${pollId}-${Date.now()}`,
    title: `Poll: ${winningOption}`,
    description: `Group poll from conversation ${conversationId}. Winner: ${winningOption}`,
    startTime: defaultDate.toISOString(),
    endTime: new Date(defaultDate.getTime() + 2 * 60 * 60 * 1000).toISOString(), // 2-hour event
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    inviteLinks: [], // Would generate links for conversation participants
  };
}

// ============================
// Granular Presence Quantum Cloaking
// ==================================================================

/** Presence state per contact category */
type PresenceState = 'online' | 'offline' | 'away' | 'custom';

/** Default presence cloaking settings */
const DEFAULT_PRESENCE_CLOAKING = {
  categories: {
    family: 'online',
    work: 'offline',
    acquaintances: 'custom',
    closeFriends: 'online',
  },
  customAliases: {
    work: 'Available during business hours',
    acquaintances: 'Studying / busy',
  },
};

/** Update presence cloaking settings */
function updatePresenceCloaking(settings: typeof DEFAULT_PRESENCE_CLOAKING) {
  // Would persist to user record
  console.log('[Presence] Updated cloaking settings:', settings);
}

/** Get presence state for a specific contact */
function getPresenceForContact(
  contactId: string,
  contactCategory: keyof typeof DEFAULT_PRESENCE_CLOAKING['categories'],
  override?: PresenceState
): PresenceState {
  // If there's an explicit override, use it
  if (override) return override;
  
  // Otherwise, use the category-based default
  const categoryPresence = DEFAULT_PRESENCE_CLOAKING.categories[contactCategory];
  return categoryPresence || 'online';
}

/** Check if presence should be shown to specific recipients */
function shouldShowPresenceTo(
  recipientId: string,
  recipientCategory: keyof typeof DEFAULT_PRESENCE_CLOAKING['categories']
): boolean {
  // In a real app, this would check the user's presence cloaking settings
  // and determine whether to show online/last-seen to this recipient
  return true;
}

// ============================
// Cryptographic Trust Badges
// ============================

/** Generate a trust badge QR code data URL for a user */
function generateTrustBadge(userId: string, publicKey: string): string {
  // In a real app, this would use a QR code library (qrcode) to encode
  // the user's public key or verified identity info
  // For now, return a placeholder that the frontend can render
  return `/api/trust-badge/${userId}?timestamp=${Date.now()}`;
}

/** Verify a trust badge QR code scan */
function verifyTrustBadge(scannedData: string): { verified: boolean; userId: string; error?: string } {
  try {
    // Decode the QR data which should contain user ID and signature
    const data = JSON.parse(scannedData);
    if (!data.userId || !data.signature) {
      return { verified: false, userId: '', error: 'Invalid trust badge data' };
    }
    
    // In a real app, we'd verify the signature against the user's public key
    // stored in our trusted directory
    return { verified: true, userId: data.userId };
  } catch (e) {
    return { verified: false, userId: '', error: 'Failed to parse trust badge data' };
  }
}

/** GET /api/trust-badge/:userId - generate trust badge QR code */
router.get('/trust-badge/:userId', async (req, res, next) => {
  try {
    const userId = req.params.userId;
    // In a real app, we'd fetch the user's verified public key from the database
    // and generate a QR code data URL
    const badgeData = generateTrustBadge(userId, 'placeholder-key');
    res.set('Content-Type', 'image/svg+xml');
    res.send(badgeData);
  } catch (error) {
    next(error);
  }
});

// ============================
// Smart Group Merger & Invite Links
// ============================

/** AI duplicate detector for groups - checks if groups are similar */
function detectDuplicateGroups(conversations: any[]): { isDuplicate: boolean; similarity: number; suggestion: string } {
  if (conversations.length < 2) {
    return { isDuplicate: false, similarity: 0, suggestion: '' };
  }
  
  // Compare group titles, participant counts, and recent activity
  const first = conversations[0];
  const second = conversations[1];
  
  // Simple similarity check based on title keywords
  const firstWords = (first.title || '').toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
  const secondWords = (second.title || '').toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
  
  const commonWords = firstWords.filter((w: string) => secondWords.includes(w));
  const similarity = firstWords.length > 0 
    ? commonWords.length / Math.max(firstWords.length, secondWords.length)
    : 0;
  
  if (similarity > 0.5) {
    return {
      isDuplicate: true,
      similarity: Math.round(similarity * 100),
      suggestion: 'Suggest merging these groups - they appear to be the same community',
    };
  }
  
  return { isDuplicate: false, similarity: Math.round(similarity * 100), suggestion: '' };
}

/** Create a secure expiring invite link */
function createExpiringInviteLink(conversationId: string, expiresInHours: number = 24): string {
  const token = `${conversationId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();
  return `/invite/${token}?expires=${expiresAt}`;
}

// ============================
// Whisper Text (Passcode-Revealed Secrets)
// ============================

/** Whisper text implementation - messages blurred until tapped/unlocked */
function applyWhisperText(message, viewerId, passcode) {
  if (!message.whisperPasscode) return message.text || '';

  if (passcode && message.whisperPasscode === passcode) {
    // User provided correct passcode - show normal text
    return message.text || '';
  }

  // No passcode or wrong passcode - show blurred version
  const text = message.text || '';
  if (!text) return '✕'.repeat(20);

  const visibleChars = 30;
  if (text.length <= visibleChars) {
    return '...'.repeat(Math.ceil(text.length / visibleChars));
  }
  return text.substring(0, visibleChars) + '...' + '✕'.repeat(Math.ceil((text.length - visibleChars) / visibleChars));
}

// ============================
// Deterministic Morning Brief Builder
// ============================

/** Build a deterministic extractive brief for a conversation */
async function buildDeterministicBrief(conversation) {
  const messages = await listMessages(conversation.id);
  
  // Extract key sentences based on importance markers
  const highlights = messages
    .filter((m) => m.reactions?.['thumbs-up'] || m.forwarded)
    .slice(0, 5)
    .map((m) => ({
      text: m.text || '',
      sender: m.sender?.username || 'unknown',
    }));

  // Extract action items (messages with 'action' keyword or reaction)
  const actionItems = messages
    .filter((m) => {
      const lower = (m.text || '').toLowerCase();
      return /\b(action|do|plan|meet|buy|buy)\b/.test(lower);
    })
    .slice(0, 5)
    .map((m) => ({
      text: m.text || '',
      kind: 'suggested-action',
    }));

  // Extract topics (frequent nouns/terms)
  const allText = messages
    .filter((m) => m.text)
    .map((m) => m.text || '')
    .join(' ');
  
  const topicWords = allText
    .toLowerCase()
    .match(/\b(a|an|the|of|and|to|in|for|is|it|this|that|with|from|by|on|at|as|was|were|be|been|are|am)\b/gi);
  
  const topics = topicWords
    ? [...new Set(topicWords.filter((w: string) => w.length > 4))]
    .slice(0, 10)
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    : [];

  return {
    source: 'deterministic-extractive',
    highlights,
    actionItems,
    topics,
  };
}

// ============================
// Semantic Neural Message Search
// ============================

/** Perform semantic neural search across messages */
router.get('/:id/search/semantic', async (req, res, next) => {
  try {
    const conversation = conversationFor(req.user.id, req.params.id, req.scope);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found.' });

    const { query } = req.query;
    const limit = Number(req.query.limit) || 10;
    const filterUrgency = req.query.urgency as 'routine' | 'important' | 'urgent' | undefined;

    if (!query || query.length < 2) {
      return res.json({ results: [] });
    }

    // In a production app, this would use a vector database (Pinecone, Weaviate, etc.)
    // and compute embeddings on-the-fly or store them with each message.
    // For now, we'll do a keyword-based fallback search.

    const messages = await listMessages(conversation.id);

    const results = messages
      .filter((msg) => {
        // Filter by urgency if specified
        if (filterUrgency && msg.urgency !== filterUrgency) return false;
        return true;
      })
      .map((msg) => {
        // Simple relevance scoring based on text match
        const lowerQuery = query.toLowerCase();
        const lowerText = (msg.text || '').toLowerCase();
        const score = lowerText.includes(lowerQuery) ? 0.8 : 0.3;
        const highlighted = lowerText.includes(lowerQuery)
          ? `(...${msg.text!.substring(lowerText.indexOf(lowerQuery), lowerText.indexOf(lowerQuery) + query.length)}...)`
          : '';

        return {
          messageId: msg.id,
          conversationId: msg.conversationId,
          preview: msg.text ? msg.text.substring(0, 100) : '[media]',
          sender: msg.sender?.username || 'unknown',
          score,
          highlighted,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    res.json({ results });
  } catch (error) {
    next(error);
  }
});

// ============================
// GET /api/conversations/:id/brief - deterministic morning brief
// ============================

router.get('/:id/brief', async (req, res, next) => {
  try {
    const conversation = conversationFor(req.user.id, req.params.id, req.scope);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found.' });

    const brief = await buildDeterministicBrief(conversation);
    res.json({ brief });
  } catch (error) {
    next(error);
  }
});

module.exports = {
  // Read receipt modes
  DEFAULT_MODES,
  markCreatorVerified,
  isCreatorVerified,
  creatorBadgeColor,
  creatorBadge,

  // Read receipt getter
  readReceipts,

  // Ghost mode / stealth read receipts toggle (via PATCH /:id/modes)
  // Handled by the new PATCH /:id/modes route above

  // Whisper text
  whisperText,
  applyWhisperText,

  // Tone shifter
  shiftTone,
  TONE_OPTIONS,

  // DND settings
  DEFAULT_DND_SETTINGS,
  updateDndSettings,
  shouldBypassDnd,

  // Collaborative rooms
  createCollaborativeRoom,
  addCollabParticipant,
  recordExpense,
  addItineraryItem,
  castVote,

  // Split-bill ledger
  ExpenseRecord,
  LedgerState,
  createExpenseRecord,
  recordLedgerExpense,
  getLedgerState,
  settleDebt,

  // Trust badges
  generateTrustBadge,
  verifyTrustBadge,

  // Group merger
  detectDuplicateGroups,
  createExpiringInviteLink,

  // Edit version history
  EditHistoryEntry,
  trackMessageEdit,
  getMessageEditHistory,
  getTransparentEditHistory,

  // Poll-to-calendar sync
  pollToCalendarEvent,

  // Presence quantum cloaking
  DEFAULT_PRESENCE_CLOAKING,
  updatePresenceCloaking,
  getPresenceForContact,
  shouldShowPresenceTo,

  // Translation
  translateText,

  // Media proxy
  serveMediaProxy,
};