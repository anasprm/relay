'use client';

import { useEffect } from 'react';

// Service Worker registration — standard PWA pattern.
// We register it immediately so it controls the client scope (same origin).
// It will not show notifications until the user has interacted with the app
// (browser policy), but we can prime it on mount.
export function SWRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[SW] Registered:', registration.scope);

        // Optional: listen for notification permission change
        Notification.requestPermission().then((perm) => {
          console.log('[SW] Permission:', perm);
        });
      })
      .catch((err) => {
        console.error('[SW] Registration failed:', err);
      });
  }, []);

  return null;
}