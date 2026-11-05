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

/**
 * StoriesRail — immersive 24-hour stories feed with touch swipe gestures,
 * pause-on-hold, and interactive reply drawers.
 * 
 * The rail displays stories as circular avatars with a progress ring.
 * Tapping a story opens the StoryViewer. Swiping left/right navigates
 * between stories. Press-and-hold pauses the auto-advance.
 * 
   Filters out the current user's story (me), showing only other users'
   stories in the rail.
 */

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
  const { toast } = useToast();

  const [isPaused, setIsPaused] = useState(false);
  const [swipeProgress, setSwipeProgress] = useState(0); // -1 → 1, left to right
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);

  // Flatten all stories from groups, filter out current user's stories and already-viewed
  const allStories = groups.flatMap((g) => g.stories || []).filter(
    (s) => s.userId !== me && !s.viewed,
  );

  // Compute the story for the given index, wrapping around
  const getStory = (idx: number): Story | undefined => {
    return allStories[idx];
  };

  // Swipe gesture handlers
  const startX = useRef<number>(0);
  const endX = useRef<number>(0);

  useEffect(() => {
    const handleTouchStart = (e: React.TouchEvent) => {
      setIsPaused(false);
      setSwipeProgress(0);
      startX.current = e.touchIdentifier ? e.touches[0].clientX : e.clientX;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
      if (startX.current === null) return;
      endX.current =
        e.touches[0].clientX;
      const delta = endX.current - startX.current;
      const pct = (delta / window.innerWidth) * 100;
      setSwipeProgress(
        Math.max(-100, Math.min(100, pct)),
      );
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
      const delta = (endX.current || 0) - (startX.current || 0);
      const threshold = 50; // 5% of screen width

      if (Math.abs(delta) > threshold * (window.innerWidth / 100)) {
        if (delta > 0) {
          // Swiped right → next story
          setActiveStoryIndex((i) => (i + 1) % Math.max(stories?.length || 1, 1));
        } else {
          // Swiped left → previous story
          setActiveStoryIndex((i) => {
            const max = Math.max(stories?.length || 1, 1);
            return i - 1 < 0 ? max - 1 : i - 1;
          });
        }
      }
      setSwipeProgress(0);
      startX.current = null;
      endX.current = null;
    };

    const handleMouseEnter = () => {
      // Optional: pause on hover for desktop
    };

    const handleMouseLeave = () => {
      // Resume auto-advance
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('mouseenter', handleMouseEnter);
    window.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('mouseenter', handleMouseEnter);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [stories, setActiveStoryIndex]);

  // Auto-advance interval (respected when not paused)
  const autoAdvanceRef = useRef<number | null>(null);
  useEffect(() => {
    if (!stories || stories.length === 0 || isPaused) {
      if (autoAdvanceRef.current) {
        clearInterval(autoAdvanceRef.current);
        autoAdvanceRef.current = null;
      }
      return;
    }
    autoAdvanceRef.current = window.setInterval(() => {
      setActiveStoryIndex((i) => {
        const max = stories.length - 1;
        return i + 1 > max ? 0 : i + 1;
      });
    }, 5_000); // auto-advance every 5 seconds
    return () => {
      if (autoAdvanceRef.current) {
        clearInterval(autoAdvanceRef.current);
        autoAdvanceRef.current = null;
      }
    };
  }, [stories, isPaused]);

  // Render the rail
  if (!stories || stories.length === 0) {
    return (
      <div className="p-4 text-muted-foreground">
        No stories yet
      </div>
    );
  }

  const story = getStory(activeStoryIndex);

  return (
    <div
      className="relative h-64 w-full bg-background/50 rounded-xl overflow-hidden border border-border/20"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Progress ring indicating story advancement */}
      <div
        className="absolute inset-0 rounded-full opacity-20 bg-gradient-to-b from-primary/40 to-secondary/40"
        style={{
          strokeDashoffset: 0,
          strokeDasharray: `${2 * Math.PI * 30}`,
          transition: `stroke-dashoffset 5s linear${isPaused ? '; transition: none' : ''}`,
        }}
      />
      {/* Story avatars — other users only */}
      {stories?.map((story, idx) => {
        // Skip the current user's story; only show others
        if (story.owner?.id === me) return null;

        const isActive = idx === activeStoryIndex;
        const hasUnviewed = story.isViewed === false;

        return (
          <button
            key={story.id}
            type="button"
            className={cn(
              'absolute flex size-12 rounded-full overflow-hidden border-2 border-border/30 hover:border-primary transition-colors',
              isActive && 'border-primary bg-primary/20',
            )}
            onClick={() => {
              // Open story viewer
              setStoryViewerGroup(idx);
            }}
            onTouchStart={undefined}
            role="button"
            aria-label={`Story ${idx + 1} from ${story.owner?.displayName || 'unknown'}`}
          >
            <img
              src={story.owner?.avatarUrl || '/placeholder-avatar.png'}
              alt={`Story from ${story.owner?.displayName}`}
              className="w-full h-full object-cover"
              style={{ width: '48px', height: '48px' }}
            />
            {hasUnviewed && (
              <div
                className="absolute top-1 right-1 rounded-full bg-primary text-[8px] font-semibold"
              >
                {story.viewCount || 0}m
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}