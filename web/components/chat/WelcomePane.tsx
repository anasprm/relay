'use client';

import { Lock, MessageSquarePlus, ShieldCheck, Wifi } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';

/**
 * WhatsApp Web's empty state: a quiet, centered panel with the product name,
 * one sentence about the workspace, and a single useful action. No marketing
 * cards, no fake feature grids.
 */
export function WelcomePane({ onNewChat }: { onNewChat: () => void }) {
  return (
    <div className="relative flex h-full min-h-0 flex-col items-center justify-center overflow-y-auto bg-panel px-6 py-12 text-center">
      <div className="w-full max-w-md">
        <div className="flex justify-center">
          <Logo />
        </div>

        <h1 className="mt-8 text-[30px] font-light leading-tight tracking-[-0.01em] text-ink">
          Relay Web
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-[14px] leading-[20px] text-muted">
          Pick a conversation from the list, or start a new one with any username in your
          workspace. Messages, voice notes, files, and calls stay together in one thread.
        </p>

        <div className="mt-7 flex justify-center">
          <button
            type="button"
            onClick={onNewChat}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-[14px] font-medium text-white transition-colors hover:bg-accent-hover"
          >
            <MessageSquarePlus size={17} />
            New conversation
          </button>
        </div>

        <ul className="mx-auto mt-10 flex max-w-xs flex-col gap-2.5 text-left text-[13px] leading-[18px] text-muted">
          <li className="flex items-center gap-2.5">
            <Wifi size={15} className="shrink-0 text-accent" />
            Send and receive messages in this browser
          </li>
          <li className="flex items-center gap-2.5">
            <ShieldCheck size={15} className="shrink-0 text-accent" />
            Anonymity and vanish mode per thread
          </li>
          <li className="flex items-center gap-2.5">
            <Lock size={15} className="shrink-0 text-accent" />
            Private to the people in each conversation
          </li>
        </ul>
      </div>
    </div>
  );
}
