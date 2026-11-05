/* ==========================================================================
   MODULE 1: ZERO-FRICTION WEB-FIRST ONBOARDING
   Burner Guest Sessions & Passkey Sign-In
   ========================================================================== */

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthProvider';
import { useRouter, useSearchParams } from 'next/navigation';

/** Burner guest interface */
interface BurnerGuest {
  id: string;
  name: string;
  isGuest: boolean;
  createdAt: string;
}

/** Room entry component — supports both guest and authenticated flow */
export default function RoomEntryPage({ params }: { params: { roomId: string } }) {
  const { user, token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isGuest, setIsGuest] = useState(false);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Parse roomId from URL: /chat/[roomId]
  const roomId = params.roomId || 'default';

  useEffect(() => {
    // If user is already authenticated, skip guest flow
    if (user?.id) {
      setIsGuest(false);
      setIsLoading(false);
      return;
    }

    // Check if this is a burner guest session (no auth params)
    const hasAuthParams = searchParams.has('token') || searchParams.has('userId');

    if (!hasAuthParams && !user?.id) {
      // Auto-generate burner guest
      const generateGuestId = () =>
        `guest_${Math.random()
          .toString(36)
          .substring(2, 15)}-${Date.now()
          .toString(36)
          .substring(2)}`;

      setGuestId(generateGuestId());
      setIsGuest(true);
    }

    setIsLoading(false);
  }, [user?.id, searchParams]);

  // Handle guest session handshake — establish WebSocket presence
  useEffect(() => {
    if (!isGuest || !guestId) return;

    // Simulate session handshake with server
    // In production, this would POST to /api/sessions/guest
    console.log('[Burner] Guest session handshake:', { guestId, roomId });

    // Auto-cleanup on unload
    return () => {
      console.log('[Burner] Guest session cleanup:', guestId);
    };
  }, [isGuest, guestId, roomId]);

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center">Loading…</div>;
  }

  if (isGuest) {
    // Render guest entry UI
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-black-900 text-white p-8 flex flex-col items-center gap-4">
        <h1 className="text-3xl font-bold">Welcome to Relay</h1>
        <p className="text-base opacity-90">
          Enter as a burner guest to preview the chat. No phone, no SMS, no spam.
        </p>

        <div className="bg-white/10 backdrop-blur-xl rounded-xl p-6 w-full max-w-md text-center">
          <p className="text-sm opacity-60 mb-4">Your burner identity:</p>
          <div className="font-mono bg-black/30 rounded-p py-3 px-4 select-all">
            {guestId}
          </div>

          <button
            onClick={() => {
              // In production: auto-login as guest via WebSocket
              setIsGuest(false);
              router.push(`/chat/${roomId}`);
            }}
            className="w-full mt-4 py-2 rounded-md bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-colors">
            Continue as Guest
          </button>

          <p className="text-xs opacity-60 mt-4">
            No account needed. Messages are ephemeral and local-only.
          </p>
        </div>
      </div>
    );
  }

  // Authenticated user — establish WebSocket and redirect
  useEffect(() => {
    // Establish WebSocket presence on room entry
    // In production: connect to /api/rooms/:roomId/join with JWT
    console.log('[Auth] Joining room:', roomId, 'with token present');

    // Navigate to the chat page
    router.push(`/chat/${roomId}`);
  }, [user?.id, roomId, router]);

  return null; // Transition handled via useEffect
}