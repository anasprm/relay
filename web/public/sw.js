// =================
// Relay PWA Service Worker
// Offline-first, push-triggered background calling
// =================

const CACHE_NAME = 'relay-pwa-v1';
const OFFLINE_URL = '/offline';

const HIGH_PRIORITY_TAG = 'relay-call';
const LOW_PRIORITY_TAG = 'relay-message';

// Install: cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/offline',
        // The app shell will be cached per-navigation; here we just keep it light.
      ]);
    }),
  );
  // Skip waiting so the new SW activates immediately.
  self.clients.claim();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  // Take control of all clients immediately.
  self.clients.claim();
});

// -------------------------------------------------------------------------
// Fetch: serve offline page when network is off and requested resource is
// not in cache.
// -------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  // Only handle GET requests for HTML/navigation
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      // Fallback for navigation requests when offline
      if (event.request.mode === 'navigate') {
        return caches.match(OFFLINE_URL).then((r) => r || fetch(event.request));
      }
      return fetch(event.request);
    }),
  );
});

// -------------------------------------------------------------------------
// Push Subscription Management
// -------------------------------------------------------------------------

let pushSubscription = null;

// The client registers its subscription via the /api/push/subscribe endpoint.
// We store it here so the SW can use it for targeted pushes.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'register-subscription') {
    pushSubscription = event.data.subscription;
  }
});

// -------------------------------------------------------------------------
// Core: High-Priority Push Handling (Incoming Call)
// -------------------------------------------------------------------------
// The server sends a push event with:
//   - type: 'call'
//   - action: 'accept' | 'decline' (from UI buttons)
//   - token: HMAC-verified call token
//   - conversationId, kind (audio/video), caller info
//
// The Service Worker shows a high-priority notification with Accept/Decline
// buttons. When the user clicks, it sends a message back to the client
// (if the app is open) or attempts to keep the call alive via stored SDP.

self.addEventListener('push', (event) => {
  const data = event.data?.json ? event.data.json() : {};

  // Determine priority based on payload
  if (data.type === 'call') {
    // Incoming call — high priority, loud banner, persistent until action
    event.waitUntil(
      handleIncomingCallPush(event, data),
    );
  } else {
    // Regular message — normal priority
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match('/offline').then(() => {
          // Note: we do NOT show a notification for regular messages
          // in the SW; the client handles them via socket.io.
        });
      }),
    );
  }
});

// -------------------------------------------------------------------------
// Handles an incoming-call push notification.
// Shows a high-priority notification with Accept/Decline buttons.
// -------------------------------------------------------------------------
async function handleIncomingCallPush(event, payload) {
  const {
    conversationId,
    kind, // 'audio' | 'video'
    caller,
    callerName,
    callerAvatar,
    token, // HMAC call token for verification (opaque to SW, just passed through)
  } = payload;

  // Options for the notification
  const notificationOptions = {
    title: `Incoming ${kind === 'video' ? 'video' : 'audio'} call`,
    body: `${callerName} is calling on Relay`,
    icon: callerAvatar || '/favicon.ico',
    tag: HIGH_PRIORITY_TAG,
    renotify: true, // re-show if not interacted with
    requireInteraction: true, // stays until user acts
    actions: [
      {
        action: 'accept',
        title: 'Accept',
        // The icon is optional but nice;
        // we use the relay logo by convention.
        icon: '/assets/icons/accept.svg',
      },
      {
        action: 'decline',
        title: 'Decline',
        icon: '/assets/icons/decline.svg',
      },
    ],
  };

  const notification = await self.registration.showNotification(
    notificationOptions.title,
    notificationOptions,
  );

  // Listen for button clicks
  const promise = notification.then((notif) => {
    return notif.addEventListener('click', (clickEvent) => {
      clickEvent.preventDefault();
      clickEvent.stopImmediatePropagation();

      const action = clickEvent.action;
      if (action === 'accept') {
        // Tell the client (if running) to accept the call and open WebRTC.
        // We postMessage to the client's Service Worker controller (i.e. the open tab).
        // If no tab is open, the server will have stored the SDP and will
        // deliver `call:incoming` when the user's socket connects.
        postToClient('call:accept', { conversationId, token });
      } else if (action === 'decline') {
        postToClient('call:decline', { conversationId });
      }

      // Dismiss the notification after action.
      notif.close();
    });
  });

  // If the user does nothing, auto-dismiss after 60s (or keep ringing
  // depending on policy). Here we auto-dismiss to avoid stale notifications.
  const dismissPromise = new Promise((resolve) =>
    setTimeout(() => {
      notification.close();
      resolve();
    }, 60_000),
  );

  return Promise.all([promise, dismissPromise]);
}

// -------------------------------------------------------------------------
// Helper: postMessage to the active client (tab) from the SW.
// If multiple tabs are open, we broadcast to all of them.
// -------------------------------------------------------------------------
function postToClient(type, payload) {
  return self.clients.matchAll({ type: 'all' }).then((clients) => {
    clients.forEach((client) => {
      // Only post to clients that are still focused/visible.
      // We use the WindowClient.postMessage API.
      if (client.focused || client.visibilityState === 'visible') {
        client.postMessage({
          type,
          payload,
        });
      }
    });
  });
}

// -------------------------------------------------------------------------
// Optional: sync existing calls when the user comes back online.
// The SW can ask the server to deliver any pending offline invitations
// when the client re-connects.
// -------------------------------------------------------------------------

self.addEventListener('sync', (event) => {
  if (event.tag === 'pending-calls') {
    event.waitUntil(refreshPendingCalls());
  }
});

async function refreshPendingCalls() {
  // Ask the server to resend any calls that were pending when the user
  // was offline. The backend (realtime.js) already handles delivering
  // `call:incoming` when the socket connects.
  // We just fire a no-op fetch here; the real flow is socket-driven.
  // fetch('/api/calls/refresh', { method: 'POST' });
}

// -------------------------------------------------------------------------
// Legacy: fallback click for notifications that lack an action.
// -------------------------------------------------------------------------
self.addEventListener('notificationclick', (event) => {
  // Already handled inside the push handler, but double‑guard.
  event.preventDefault();
  event.stopImmediatePropagation();

  const notification = event.notification;
  const action = event.action;

  if (action === 'accept') {
    postToClient('call:accept', { conversationId: null });
  } else if (action === 'decline') {
    postToClient('call:decline', { conversationId: null });
  } else {
    // Fallback: focus the app window if open.
    event.notification.close();
    // clients.claim() ensures we get a client if one exists.
    self.clients.claim().then((clients) => {
      const matching = clients.find(
        (c) => c.visibilityState !== 'closed',
      );
      if (matching) matching.focus();
    });
  }

  notification.close();
});