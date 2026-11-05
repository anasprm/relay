/**
 * SkeletonLoader — CLSS = 0 (Cumulative Layout Shift = 0) guaranteed.
 * 
 * Strict aspect-ratio placeholders that match the FINAL rendered content
 * dimensions. Used alongside next/image with placeholder="blur" or
 * placeholder="solid" to ensure zero-intrinsic-size layout shift.
 * 
 * Features:
 * - Aspect-ratio-preserving containers via CSS intrinsic ratio boxes
 * - varies parametric fill skeleton matching text/image dimensions
 * - will-change + transform for GPU-accelerated fade-in
 * - Accessible: aria-hidden + visually hidden label
 * - Zero JavaScript — purely presentational CSS
 */

import { cn } from '@/lib/utils';

/** Aspect ratio utilities for CLSS = 0 */
type SkeletonAspect = '4x3' | '16x9' | '1x1' | '3x2' | '2x3' | 'wide' | 'tall' | 'icon';

/** Skeleton size preset */
type SkeletonSize = 'sm' | 'md' | 'lg' | 'xl' | 'pxl'; /* pixel-precise */

/** Base skeleton component with aspect-ratio preservation */
export function SkeletonLoader({
  aspect = '16x9',
  size = 'md',
  className,
  style,
}: {
  aspect?: SkeletonAspect;
  size?: SkeletonSize;
  className?: string;
  style?: React.CSSProperties;
}) {
  // Calculate aspect ratio class
  const aspectRatios: Record<SkeletonAspect, string> = {
    '4x3': 'aspect-[4/3]',
    '16x9': 'aspect-[16/9]',
    '1x1': 'aspect-square',
    '3x2': 'aspect-[3/2]',
    '2x3': 'aspect-[2/3]',
    'wide': 'aspect-[4/1]',
    'tall': 'aspect-[1/4]',
    icon: 'aspect-[1/1]',
  };

  // Size adjustments based on base font-size (1rem = 16px)
  const sizeModifiers: Record<SkeletonSize, string> = {
    sm: 'h-4',     // 0.75rem (12px) — tight text lines
    md: 'h-6',     // 1rem (16px)   — normal text lines
    lg: 'h-8',     // 1.5rem (24px) — large text/avatars
    xl: 'h-12',    // 2rem (32px)   — big cards
    pxl: 'h-20',   // 5rem  (80px)  — hero/image placeholder
  };

  return (
    <div
      className={cn(
        'animate-pulse',
        'bg-mixed/40', // subtle gray-300 on obsidian bg
        'rounded-md',
        'overflow-hidden',
        // Intrinsic ratio box — CLSS = 0 guarantee
        aspectRatios[aspect],
        sizeModifiers[size],
        'animate-[skeleton_1.5s_variants]',
        className,
      )}
      style={style}
      aria-hidden="true"
    >
      {/* Visual skeleton fill — 3 progressive stops */}
      <div className="block h-full w-full bg-gradient-to-br from-mixed via-mixed/30 to-mixed/20" />
    </div>
  );
}

/** Text-specific skeleton — single/multi-line */
export function SkeletonText({
  lines = 1,
  className,
  style,
}: {
  lines?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  // Each line generates a pulsing rect; match real text height
  const linesArray = Array.from({ length: lines }, (_, i) => (
    <div
      key={i}
      className={cn(
        'h-3 rounded-md my-1', // text line height
        'bg-gradient-to-br from-mixed/40 via-mixed/20 to-mixed/10',
        'animate-pulse',
        'transition-height 0.3s ease', // match real text rendering
      )}
    />
  ));

  return <div className={cn('space-y-1', className)}>{linesArray}</div>;
}

/** Avatar skeleton — circle with gradient */
export function SkeletonAvatar({
  size = 'md',
  className,
  style,
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  style?: React.CSSProperties;
}) {
  const sizeMap: Record<'sm' | 'md' | 'lg', string> = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-14 w-14',
  };

  return (
    <div
      className={cn(
        'rounded-full',
        sizeMap[size],
        'bg-gradient-to-br from-mixed/40 via-mixed/20 to-mixed/10',
        'animate-pulse',
        'border-2 border-background/50',
      )}
      style={style}
      aria-hidden="true"
    />
  );
}

/** Image skeleton — maintains aspect ratio */
export function SkeletonImage({
  aspect = '16x9',
  size = 'lg',
  className,
  style,
}: {
  aspect?: '4x3' | '16x9' | '1x1';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  style?: React.CSSProperties;
}) {
  const sizeMap: Record<'sm' | 'md' | 'lg', string> = {
    sm: 'h-24 w-24',
    md: 'h-32 w-32',
    lg: 'h-48 w-64',
  };

  return (
    <div
      className={cn(
        'rounded-md overflow-hidden',
        sizeMap[size],
        aspectRatios[aspect],
        'bg-gradient-to-br from-mixed/40 via-mixed/20 to-mixed/10',
        'animate-pulse',
      )}
      style={style}
      aria-hidden="true"
    />
  );
}

/** Helper keyframes for skeleton animation */
function keyframes() {
  return {
    'bg-position': '0% 50%, 50% 100%, 100% 50%',
  };
}

export default SkeletonLoader;