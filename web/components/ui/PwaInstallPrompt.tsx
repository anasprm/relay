/* ==========================================================================
   PWA INSTALL PROMPT COMPONENT — web/components/ui/PwaInstallPrompt.tsx
   ========================================================================== */

'use client';

import { useEffect, useState } from 'react';
import { useAuth as useStore } from '@/lib/AuthProvider';
import { useRouter } from 'next/navigation';

/** Props for the install prompt component */
export type PwaInstallPromptProps = {
  /** Optional custom className to add to the prompt wrapper */
  className?: string;
  /** Called when the user successfully installs the PWA */
  onInstall?: () => void;
  /** Called when the user dismisses the prompt */
  onDismiss?: () => void;
  /** Optional boolean to force show/hide the prompt */
  visible?: boolean;
};

/** Main PWA Install Prompt Component */
export function PwaInstallPromptComponent({
  className,
  onInstall,
  onDismiss,
  visible,
}: PwaInstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const { user } = useStore();
  const router = useRouter();

  // Listen for the beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
      // Only show if not already installed
      const isInstalled = window.matchMedia('(display-mode: standalone)').matches;
      if (!isInstalled) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Handle install button click
  const handleInstall = async () => {
    if (!deferredPrompt) return;

    setShowPrompt(false);

    // Show the browser's native install UI
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const choiceResult = await deferredPrompt.userChoice;

    if (choiceResult.outcome === 'accepted') {
      console.log('[PWA] User installed Relay Messenger Pro');
      setShowPrompt(false);
      setDeferredPrompt(null);
      onInstall?.();
    } else {
      console.log('[PWA] User dismissed install prompt');
      setShowPrompt(false);
      setDeferredPrompt(null);
      onDismiss?.();
    }
  };

  // If the PWA is already installed, don't show the prompt
  useEffect(() => {
    const checkInstallation = () => {
      const isInstalled = window.matchMedia('(display-mode: standalone)').matches;
      if (isInstalled) {
        setShowPrompt(false);
      }
    };

    checkInstallation();
    const interval = setInterval(checkInstallation, 1000);
    return () => clearInterval(interval);
  }, []);

  // If explicitly visible prop is false, don't show
  if (visible === false) {
    return null;
  }

  // Only show if visible is not explicitly true and we have a deferred prompt
  if (!visible && (!deferredPrompt || !showPrompt)) {
    return null;
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-xl install-prompt-border"
      onClick={(e) => {
        // Click outside the content area to dismiss
        const target = e.target as HTMLElement;
        if (target.className?.includes('install-prompt-wrapper')) {
          setShowPrompt(false);
          onDismiss?.();
        }
      }}
    >
      <div className="install-prompt-wrapper max-w-md mx-auto px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-lg text-white">
            Add Relay to your home screen
          </h3>
          <button
            onClick={handleInstall}
            className="text-sm text-primary hover:text-primary/90"
          >
            Install
          </button>
        </div>
        <p className="text-sm text-white/70 opacity-80">
          No account needed. Get fast, reliable push notifications and offline
          access to your chats.
        </p>
      </div>
    </div>
  );
}

/** Export the component for use in other files */
export default PwaInstallPromptComponent;