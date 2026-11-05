/**
 * Web Push for background call invitations.
 *
 * The API never sends message content in a push payload — only the minimum a
 * notification needs to ring, plus a short-lived HMAC token that lets the
 * service worker decline the call without opening the app.
 *
 * VAPID keys come from the environment in production. When they are absent the
 * server generates a key pair and persists it in `server/data/vapid.json`, which
 * keeps local development working. Deployments without a durable disk should set
 * VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT so subscriptions survive
 * a restart.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import webpush from 'web-push';

import { DATA_DIR, PUBLIC_URL, SESSION_SECRET } from './config.js';
import { persistUser } from './db.js';
import { SITE_URLS } from './site.js';

const VAPID_FILE = path.join(DATA_DIR, 'vapid.json');
const MAX_SUBSCRIPTIONS_PER_USER = 8;
const CALL_TOKEN_TTL_MS = 3 * 60 * 1000;

let configured = false;
let publicKey = '';
let keySource = 'none';
let lastError = null;

function readStoredKeys() {
  try {
    const parsed = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'));
    if (typeof parsed.publicKey === 'string' && typeof parsed.privateKey === 'string') {
      return parsed;
    }
  } catch {
    /* missing or corrupt: regenerate below */
  }
  return null;
}

function storeKeys(keys) {
  try {
    fs.writeFileSync(VAPID_FILE, JSON.stringify(keys, null, 2), { mode: 0o600 });
  } catch (error) {
    console.warn(`[push] Could not persist VAPID keys: ${error.message}`);
  }
}

export function initPush() {
  if (configured) return pushStatus();

  const subject = (process.env.VAPID_SUBJECT || 'mailto:anasprmatwork@gmail.com').trim();
  let pub = (process.env.VAPID_PUBLIC_KEY || '').trim();
  let priv = (process.env.VAPID_PRIVATE_KEY || '').trim();

  if (pub && priv) {
    keySource = 'env';
  } else {
    const stored = readStoredKeys();
    if (stored) {
      pub = stored.publicKey;
      priv = stored.privateKey;
      keySource = 'stored';
    } else {
      try {
        const generated = webpush.generateVAPIDKeys();
        pub = generated.publicKey;
        priv = generated.privateKey;
        storeKeys({ publicKey: pub, privateKey: priv, createdAt: new Date().toISOString() });
        keySource = 'generated';
      } catch (error) {
        lastError = error;
        console.warn(`[push] VAPID generation failed: ${error.message}`);
        return pushStatus();
      }
    }
  }

  try {
    webpush.setVapidDetails(subject, pub, priv);
    publicKey = pub;
    configured = true;
    lastError = null;
    console.log(`[push] Web Push ready (VAPID keys: ${keySource}).`);
  } catch (error) {
    lastError = error;
    configured = false;
    console.warn(`[push] Invalid VAPID configuration: ${error.message}`);
  }

  return pushStatus();
}

export function pushStatus() {
  return {
    configured,
    keySource,
    publicKey: configured ? publicKey : null,
    error: lastError?.message || null,
  };
}

export function pushPublicKey() {
  return configured ? publicKey : null;
}

/** The web origin a notification should open, per workspace. */
export function webOriginForScope(scope) {
  const explicit = (process.env.WEB_ORIGIN || '').trim().replace(/\/$/, '');
  if (explicit) return explicit;
  if (/localhost|127\.0\.0\.1/.test(PUBLIC_URL)) return 'http://localhost:3000';
  return SITE_URLS[scope] || SITE_URLS.public;
}

export function subscriptionsFor(user) {
  return Array.isArray(user?.pushSubscriptions) ? user.pushSubscriptions : [];
}

function validEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeSubscription(input) {
  if (!input || typeof input !== 'object') return null;

  const endpoint = typeof input.endpoint === 'string' ? input.endpoint.trim() : '';
  const p256dh = typeof input.keys?.p256dh === 'string' ? input.keys.p256dh.trim() : '';
  const auth = typeof input.keys?.auth === 'string' ? input.keys.auth.trim() : '';

  if (!validEndpoint(endpoint) || !p256dh || !auth) return null;
  if (endpoint.length > 1200 || p256dh.length > 300 || auth.length > 120) return null;

  return {
    endpoint,
    keys: { p256dh, auth },
    userAgent: typeof input.userAgent === 'string' ? input.userAgent.slice(0, 200) : undefined,
    createdAt: new Date().toISOString(),
  };
}

export async function saveSubscription(user, subscription) {
  const normalized = normalizeSubscription(subscription);
  if (!normalized) return { ok: false, error: 'Invalid push subscription.' };

  const current = subscriptionsFor(user).filter(
    (entry) => entry.endpoint !== normalized.endpoint,
  );
  const next = [...current, normalized].slice(-MAX_SUBSCRIPTIONS_PER_USER);
  user.pushSubscriptions = next;
  await persistUser(user);

  return { ok: true, count: next.length };
}

export async function removeSubscription(user, endpoint) {
  const current = subscriptionsFor(user);
  const next = current.filter((entry) => entry.endpoint !== endpoint);
  user.pushSubscriptions = next;
  await persistUser(user);
  return { ok: true, count: next.length };
}

async function deliver(user, payload, options = {}) {
  if (!configured) return { sent: 0, failed: 0, removed: 0, configured: false };

  const subscriptions = subscriptionsFor(user);
  if (subscriptions.length === 0) return { sent: 0, failed: 0, removed: 0, configured: true };

  const body = JSON.stringify(payload);
  const stale = [];
  let sent = 0;
  let failed = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(subscription, body, {
          TTL: options.ttl ?? 60,
          urgency: options.urgency ?? 'high',
          topic: options.topic,
        });
        sent += 1;
      } catch (error) {
        failed += 1;
        const status = error?.statusCode;
        if (status === 404 || status === 410) stale.push(subscription.endpoint);
        else if (status === 413) console.warn('[push] Payload too large for this subscription.');
        else if (status !== 429) {
          console.warn(`[push] Delivery failed (${status || 'network'}): ${error.message}`);
        }
      }
    }),
  );

  if (stale.length > 0) {
    user.pushSubscriptions = subscriptions.filter(
      (entry) => !stale.includes(entry.endpoint),
    );
    try {
      await persistUser(user);
    } catch {
      /* the next subscription write will retry */
    }
  }

  return { sent, failed, removed: stale.length, configured: true };
}

/* ------------------------------------------------------------------ *
 * Call tokens — let the service worker decline without a session.
 * ------------------------------------------------------------------ */

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

export function signCallToken(payload) {
  const body = base64url(
    JSON.stringify({
      conversationId: payload.conversationId,
      callerId: payload.callerId,
      calleeId: payload.calleeId,
      kind: payload.kind === 'video' ? 'video' : 'audio',
      exp: Date.now() + CALL_TOKEN_TTL_MS,
    }),
  );
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifyCallToken(token) {
  if (typeof token !== 'string' || token.length > 1200) return null;
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return null;

  const body = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    if (!payload.conversationId || !payload.callerId || !payload.calleeId) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Notification payloads
 * ------------------------------------------------------------------ */

function callUrl(scope, conversationId, action, kind) {
  const url = new URL('/chat', webOriginForScope(scope));
  url.searchParams.set('call', conversationId);
  url.searchParams.set('callAction', action);
  if (kind) url.searchParams.set('callKind', kind);
  return url.toString();
}

/**
 * Sends an incoming-call notification to every registered device. The payload
 * is intentionally tiny and carries no message text.
 */
export async function sendCallPush({
  callee,
  caller,
  conversationId,
  kind,
  scope,
}) {
  const callerName = caller?.displayName || caller?.username || 'Someone';
  const payload = {
    type: 'call',
    version: 1,
    conversationId,
    kind,
    caller: {
      id: caller?.id || null,
      displayName: callerName,
      username: caller?.username || null,
      avatarUrl: caller?.avatarUrl || null,
    },
    title: `Incoming ${kind === 'video' ? 'video' : 'audio'} call`,
    body: `${callerName} is calling on Relay`,
    url: callUrl(scope, conversationId, 'accept', kind),
    apiUrl: PUBLIC_URL,
    token: signCallToken({
      conversationId,
      callerId: caller?.id,
      calleeId: callee?.id,
      kind,
    }),
    tag: `relay-call-${conversationId}`,
    timestamp: Date.now(),
  };

  return deliver(callee, payload, {
    ttl: 90,
    urgency: 'high',
    topic: `call-${conversationId}`.slice(0, 32),
  });
}

/** Tells a ringing device to drop the notification after the caller hangs up. */
export async function sendCallCancelPush(callee, conversationId) {
  return deliver(
    callee,
    { type: 'call-cancel', conversationId, tag: `relay-call-${conversationId}` },
    { ttl: 30, urgency: 'normal', topic: `call-${conversationId}`.slice(0, 32) },
  );
}

export async function sendGroupCallPush({
  callee,
  caller,
  conversationId,
  title,
  kind,
  scope,
}) {
  const callerName = caller?.displayName || caller?.username || 'Someone';
  const url = new URL('/chat', webOriginForScope(scope));
  url.searchParams.set('call', conversationId);
  url.searchParams.set('callAction', 'accept');
  url.searchParams.set('callKind', kind);
  url.searchParams.set('group', '1');

  const payload = {
    type: 'group-call',
    version: 1,
    conversationId,
    kind,
    title: title || 'Group call',
    body: `${callerName} started a ${kind === 'video' ? 'video' : 'audio'} call`,
    url: url.toString(),
    apiUrl: PUBLIC_URL,
    tag: `relay-group-call-${conversationId}`,
    timestamp: Date.now(),
  };

  return deliver(callee, payload, {
    ttl: 90,
    urgency: 'high',
    topic: `gcall-${conversationId}`.slice(0, 32),
  });
}

/** User-triggered notification used by the "Send a test" button. */
export async function sendTestPush(user, scope) {
  return deliver(
    user,
    {
      type: 'test',
      title: 'Relay notifications are on',
      body: 'Calls can now ring this device even when the app is closed.',
      url: new URL('/chat', webOriginForScope(scope)).toString(),
      tag: 'relay-test',
      timestamp: Date.now(),
    },
    { ttl: 120, urgency: 'normal' },
  );
}
