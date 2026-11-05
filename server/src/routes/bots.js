/* ==========================================================================
   MODULE 2: DEVELOPER-FIRST OPEN API & WEBHOOK BOT ECOSYSTEM
   Secure REST & WebSocket API for bots, webhooks, and mini-apps
   ========================================================================== */

import { router } from '../index';
import { api } from '../../lib/api';
import { db } from '../../lib/db';
import type { Conversation, Message } from '../../lib/types';

// ==========================================================================
// 2A. Secure Bot Webhook REST API
// ==========================================================================

/** Register a new bot webhook subscription */
router.post('/api/v1/bots/register', async (req, res, next) => {
  try {
    const { url, events, secret, metadata } = req.body || {};

    if (!url || !events?.length) {
      return res.status(400).json({
        error: 'url and events array are required',
      });
    }

    // Validate webhook URL returns 2xx
    const validation = await validateWebhookUrl(url);
    if (!validation.verified) {
      return res.status(400).json({
        error: 'Webhook URL validation failed',
        details: validation.error,
      });
    }

    // Generate a HMAC secret if not provided
    const botSecret = secret || generateHmacSecret();

    // Persist webhook subscription
    const subscription = {
      id: `bot_${Date.now()}-${Math.random().toString(36).slice(2)}`,
      url,
      events, // ['message', 'delivered', 'read', 'reaction']
      secret: botSecret,
      metadata: metadata || {},
      createdAt: new Date().toISOString(),
      active: true,
      lastTriggered: null,
      failureCount: 0,
    };

    await db.dbSet('bot_webhooks', subscription.id, subscription);

    res.status(201).json({
      success: true,
      subscription,
    });
  } catch (error) {
    next(error);
  }
});

/** List all bot webhook subscriptions (paginated) */
router.get('/api/v1/bots/subscriptions', async (req, res, next) => {
  try {
    const subscriptions = await db.dbGetAll('bot_webhooks');
    res.json({
      success: true,
      subscriptions,
      total: subscriptions.length,
    });
  } catch (error) {
    next(error);
  }
});

/** Remove a bot webhook subscription */
router.delete('/api/v1/bots/subscriptions/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.dbDelete('bot_webhooks', id);
    res.json({
      success: true,
      deleted: true,
    });
  } catch (error) {
    next(error);
  }
});

/** Validate webhook URL health */
async function validateWebhookUrl(url: string) {
  try {
    const abortCtrl = new AbortController();
    const timeoutId = setTimeout(() => abortCtrl.abort(), 5000);

    const res = await fetch(url, {
      method: 'HEAD',
      signal: abortCtrl.signal,
      timeout: 5000,
    });

    clearTimeout(timeoutId);

    return {
      verified: res.ok && (res.status >= 200 && res.status < 300),
      error: null,
    };
  } catch (error) {
    return {
      verified: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/** Generate HMAC secret for webhook signature */
function generateHmacSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('hex');
}

// ==========================================================================
// 2B. WebSocket Bot Event Pipeline
// ==========================================================================

/** Bot WebSocket event types */
type BotEventType =
  | 'message:sent'
  | 'message:delivered'
  | 'message:read'
  | 'reaction:added'
  | 'reaction:removed'
  | 'user:joined'
  | 'user:left';

interface BotEventPayload {
  type: BotEventType;
  conversationId: string;
  messageId?: string;
  botId: string;
  timestamp: string;
  payload: Record<string, any>;
}

/** In-memory bot event queue (would be Redis in production) */
const botEventQueue: BotEventPayload[] = [];

/** WebSocket bot publisher — broadcasts events to all connected bot subscribers */
router.post('/api/v1/bots/publish', async (req, res, next) => {
  try {
    const { conversationId, eventType, messageId, payload } = req.body || {};

    if (!conversationId || !eventType) {
      return res.status(400).json({
        error: 'conversationId and eventType are required',
      });
    }

    const botEvent: BotEventPayload = {
      type: eventType,
      conversationId,
      messageId,
      botId: req.headers['x-bot-id'] || 'unknown',
      timestamp: new Date().toISOString(),
      payload,
    };

    // Add to broadcast queue
    botEventQueue.push(botEvent);

    // In production: publish to Redis, which bot WebSocket subscribers listen on
    console.log('[Bot] Event published:', { type: eventType, conversationId });

    res.json({
      success: true,
      event: botEvent.type,
      queued: botEventQueue.length,
    });
  } catch (error) {
    next(error);
  }
});

/** Route incoming bot events to all subscribed webhook URLs */
router.post('/api/v1/bots/route', async (req, res, next) => {
  try {
    const events = req.body || [];

    if (!Array.isArray(events)) {
      // Single event
      const result = await triggerBotWebhook(events);
      return res.json(result);
    }

    // Multiple events — batch process
    const results = await Promise.all(events.map(triggerBotWebhook));
    res.json({ success: true, results });
  } catch (error) {
    next(error);
  }
});

/** Trigger a single bot webhook with HMAC signature */
async function triggerBotWebhook(event: BotEventPayload) {
  const subscriptions = await db.dbGetAll('bot_webhooks');

  const activeSubs = subscriptions.filter((sub) => sub.active && sub.events.includes(event.type));

  for (const sub of activeSubs) {
    try {
      const signature = generateWebhookSignature(event, sub.secret);

      await fetch(sub.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event.type,
        },
        body: JSON.stringify(event),
        timeout: 10000,
      });

      // Update last triggered stats
      sub.lastTriggered = new Date().toISOString();
      sub.failureCount = 0;
      await db.dbPut('bot_webhooks', sub.id, sub);
    } catch (err) {
      // Increment failure count
      sub.failureCount = (sub.failureCount || 0) + 1;
      if (sub.failureCount >= 5) {
        sub.active = false; // Auto-disable after 5 failures
      }
      await db.dbPut('bot_webhooks', sub.id, sub);
      console.error('[Bot] Webhook failed:', sub.url, err);
    }
  }
}

/** Generate HMAC-SHA256 webhook signature */
function generateWebhookSignature(event: BotEventPayload, secret: string): string {
  const payload = JSON.stringify(event);
  const hmac = createHmac('sha256', Buffer.from(secret, 'hex'));
  hmac.update(payload);
  return hmac.digest('hex');
}

// ==========================================================================
// 2C. Mini-App Sandboxing — iframe embedding in chat bubbles
// ==========================================================================

/** Supported mini-app manifest type */
interface MiniAppManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  url: string; // iframe source URL
  icons: string[]; // SVG/ICO URLs
  permissions: ('storage' | 'notifications' | 'clipboard')[];
  security: {
    sandbox: 'allow-scripts' | 'allow-popups' | 'allow-forms' | string;
    csp: string;
  };
}

/** Register a mini-app for iframe embedding in chat bubbles */
router.post('/api/v1/mini-apps/register', async (req, res, next) => {
  try {
    const manifest: MiniAppManifest = req.body;

    if (!manifest.url || !manifest.id) {
      return res.status(400).json({
        error: 'url and id are required',
      });
    }

    // Validate the mini-app URL serves proper Content-Type
    const validate = await validateMiniAppUrl(manifest.url);
    if (!validate.verified) {
      return res.status(400).json({
        error: 'Mini-app URL validation failed',
        details: validate.error,
      });
    }

    const registered = {
      ...manifest,
      registeredAt: new Date().toISOString(),
      status: 'active',
      usageCount: 0,
    };

    await db.dbSet('mini_apps', registered.id, registered);

    res.status(201).json({
      success: true,
      app: registered,
    });
  } catch (error) {
    next(error);
  }
});

/** List registered mini-apps */
router.get('/api/v1/mini-apps', async (req, res, next) => {
  try {
    const apps = await db.dbGetAll('mini_apps');
    res.json({
      success: true,
      apps,
      total: apps.length,
    });
  } catch (error) {
    next(error);
  }
});

/** Validate mini-app URL */
async function validateMiniAppUrl(url: string) {
  try {
    const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'text/html' } });
    const contentType = res.headers.get('content-type') || '';

    // Must serve text/html or application/xhtml+xml
    if (!contentType.includes('html')) {
      return {
        verified: false,
        error: 'URL does not serve HTML',
      };
    }

    return { verified: true, error: null };
  } catch (error) {
    return {
      verified: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

export { router as botsRouter };