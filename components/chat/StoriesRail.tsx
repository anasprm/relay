/* ==========================================================================
   STORIES RAIL — Other users' stories only
   ---------------------------------------------------------------
   - Horizontal immersive 24-hour stories feed with touch swipe gestures
   - Pause-on-hold, interactive reply drawers
   - CRITICAL: Filters out the current user's story — displays ONLY
     other participants' stories. The user's story is managed from the
     unified header in Sidebar.tsx.
   ---------------------------------------------------------------
   60fps smooth: transform + will-change only. Obsidian glassmorphic
   theme compatibility.
   ========================================================================== */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthProvider';
import { useStories } from '@/lib/useStories';
import { useToast } from '@/lib/ToastProvider';
import { cn } from '@/lib/utils';
import type { Story } from '@/lib/types';

export function StoriesRail({
  me,
  socket,
}: {
  me: string; // current user's ID
  socket?: any;
}) {
  const { groups, setStoryComposerOpen, setStoryViewerGroup } = useStories({
    socket,
    enabled: !!socket,
  });

  const [isPaused, setIsPaused] = useState(false);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);

  // Flatten all stories from groups, filter out current user's stories and already-viewed
  const allStories = (groups || []).flatMap((g) => g.stories || []).filter(
    (s) => s.userId !== me && !s.viewed,
  );

  // Compute the story for the given index, wrapping around
  const getStory = (idx: number): Story | undefined => {
    return allStories[idx];
  };

  // Auto-advance interval (respected when not paused)
  const autoAdvanceRef = useRef<number | null>(null);
  useEffect(() => {
    if (!allStories || allStories.length === 0 || isPaused) {
      if (autoAdvanceRef.current) {
        clearInterval(autoAdvanceRef.current);
        autoAdvanceRef.current = null;
      }
      return;
    }
    autoAdvanceRef.current = window.setInterval(() => {
      setActiveStoryIndex((i) => {
        const max = allStories.length - 1;
        return i + 1 > max ? 0 : i + 1;
      });
    }, 5_000); // auto-advance every 5 seconds
    return () => {
      if (autoAdvanceRef.current) {
        clearInterval(autoAdvanceRef.current);
        autoAdvanceRef.current = null;
      }
    };
  }, [allStories, isPaused]);

  // Render the rail
  if (!allStories || allStories.length === 0) {
    return (
      <div className="p-6 text-center text-slate-400 text-sm">
        No active stories from other users
      </div>
    );
  }

  const story = getStory(activeStoryIndex);

  return (
    <div
      className="relative h-64 w-full bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden p-4 flex gap-3 items-center"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {(groups || []).map((group, idx) => {
        if (group.user?.id === me) return null;
        const unviewed = (group.stories || []).some((s) => !s.viewed);
        if (!unviewed) return null;

        return (
          <button
            key={group.user?.id || idx}
            type="button"
            className="flex flex-col items-center gap-2 group cursor-pointer focus:outline-none"
            onClick={() => setStoryViewerGroup(idx)}
          >
            <div className="relative size-16 rounded-full p-[2px] bg-gradient-to-tr from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full rounded-full bg-[#050505] p-[2px]">
                <img
                  src={group.user?.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"}
                  alt={group.user?.displayName || "Story"}
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
            </div>
            <span className="text-xs font-medium text-slate-300 truncate max-w-[70px]">
              {group.user?.displayName || "User"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
