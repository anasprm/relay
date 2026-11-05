import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { declineDirectCallFromPush } from '../realtime.js';
import {
  pushPublicKey,
  pushStatus,
  removeSubscription,
  saveSubscription,
  sendTestPush,
  subscriptionsFor,
  verifyCallToken,
} from '../push.js';

const router = Router();

/**
 * GET /api/push/key — the public VAPID key plus whether this deployment can
 * actually send pushes. The client uses this before asking for permission, so
 * a missing key shows an honest "not configured" state instead of a broken
 * toggle.
 */
router.get('/key', (req, res) => {
  const status = pushStatus();
  res.json({
    configured: status.configured,
    publicKey: pushPublicKey(),
    keySource: status.keySource,
    error: status.error,
    subscriptions: subscriptionsFor(req.user).length,
  });
});

/** POST /api/push/subscribe — stores this browser's push endpoint. */
router.post('/subscribe', requireAuth, async (req, res, next) => {
  try {
    const result = await saveSubscription(req.user, req.body?.subscription);
    if (!result.ok) return res.status(400).json({ error: result.error });

    // A registration is also the moment to make sure the server can send.
    const status = pushStatus();
    res.json({
      ok: true,
      count: result.count,
      configured: status.configured,
    });
  } catch (error) {
    next(error);
  }
});

/** POST /api/push/unsubscribe — removes one endpoint, e.g. after sign-out. */
router.post('/unsubscribe', requireAuth, async (req, res, next) => {
  try {
    const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint.trim() : '';
    if (!endpoint) return res.status(400).json({ error: 'An endpoint is required.' });

    const result = await removeSubscription(req.user, endpoint);
    res.json({ ok: true, count: result.count });
  } catch (error) {
    next(error);
  }
});

/** POST /api/push/test — a real notification so the user can confirm ringing. */
router.post('/test', requireAuth, async (req, res, next) => {
  try {
    const status = pushStatus();
    if (!status.configured) {
      return res.status(503).json({
        error: 'Push notifications are not configured on this server.',
      });
    }
    if (subscriptionsFor(req.user).length === 0) {
      return res.status(409).json({ error: 'Enable notifications on this device first.' });
    }

    const result = await sendTestPush(req.user, req.scope);
    res.json({ ok: result.sent > 0, ...result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/push/call-response — called by the service worker, not the app.
 *
 * The notification's "Decline" button has no session, so it carries a
 * short-lived HMAC token instead. Only declining is allowed here; accepting
 * must open the app and complete WebRTC with a real session.
 */
router.post('/call-response', async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  const action = req.body?.action === 'decline' ? 'decline' : null;

  if (!action) return res.status(400).json({ error: 'Unsupported call action.' });

  const payload = verifyCallToken(token);
  if (!payload) return res.status(401).json({ error: 'This call invitation has expired.' });

  const io = req.app.locals.io;
  const result = declineDirectCallFromPush(io, payload);
  if (!result.ok) return res.status(409).json({ error: result.error || 'The call already ended.' });

  res.json({ ok: true });
});

export default router;
