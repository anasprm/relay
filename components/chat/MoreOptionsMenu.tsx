'use client';

import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { Bell, FileText, Lock, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Portal } from './Portal';

interface MoreOptionsMenuProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLButtonElement | null>;
  onClearChat?: () => void;
  onMute?: () => void;
  onLeaveGroup?: () => void;
  dangerLabel?: string;
  dangerAction?: () => void;
}

function MenuItem({
  icon,
  label,
  onClick,
  danger = false,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors',
        disabled
          ? 'text-faint cursor-not-allowed'
          : danger
            ? 'text-accent-error hover:bg-accent-error/10'
            : 'text-ink hover:bg-panel-2 hover:text-ink',
      )}
    >
      <span className="shrink-0 text-muted">{icon}</span>
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

export function MoreOptionsMenu({
  open,
  onClose,
  anchorRef,
  onClearChat,
  onMute,
  onLeaveGroup,
  dangerLabel,
  dangerAction,
}: MoreOptionsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useRef<{ x: number; y: number; flip: boolean } | null>(
    null,
  );

  const positionMenu = useCallback(() => {
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!open || !anchor || !menu) return;
    const rect = anchor.getBoundingClientRect();
    let x = rect.left;
    let y = rect.bottom + 6;
    let flip = false;
    if (y + 220 > window.innerHeight) {
      y = rect.top - 6;
      flip = true;
    }
    if (x + 200 > window.innerWidth) x = window.innerWidth - 200;
    if (x < 8) x = 8;
    setPos.current = { x, y, flip };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    positionMenu();
    const raf = requestAnimationFrame(positionMenu);
    const onResize = () => positionMenu();
    const onPointerDown = (event: PointerEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        (!anchorRef.current ||
          !anchorRef.current.contains(event.target as Node))
      ) {
        onClose();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, [open, onClose, anchorRef, positionMenu]);

  if (!open) return null;

  const style = pos.current
    ? {
        left: pos.current.x,
        top: pos.current.y,
        transformOrigin: pos.current.flip ? 'bottom left' : 'top left',
      }
    : undefined;

  return (
    <Portal>
      <div className="fixed z-[70] pointer-events-none" style={style}>
        <div
          ref={menuRef}
          className={cn(
            'pointer-events-auto z-[71] w-[200px] overflow-hidden rounded-xl border border-border bg-panel-2 shadow-[0_18px_50px_-18px_rgba(2,6,23,0.6)] p-1 relay-animate-scale-in',
            pos.current?.flip && 'bottom-full mb-1.5',
            !pos.current?.flip && 'top-full mt-1.5',
          )}
          role="menu"
          aria-label="More options"
        >
          <div className="flex items-center justify-between gap-0.5 px-0.5">
            {onClearChat && (
              <MenuItem
                icon={<FileText className="h-4 w-4" />}
                label="Clear chat history"
                onClick={() => {
                  onClearChat();
                  onClose();
                }}
              />
            )}
            {onMute && (
              <MenuItem
                icon={<Bell className="h-4 w-4" />}
                label="Mute notifications"
                onClick={() => {
                  onMute();
                  onClose();
                }}
              />
            )}
            {onLeaveGroup && (
              <MenuItem
                icon={<Lock className="h-4 w-4" />}
                label="Leave group"
                onClick={() => {
                  onLeaveGroup?.();
                  onClose();
                }}
              />
            )}
            {dangerAction && dangerLabel && (
              <MenuItem
                icon={<Trash2 className="h-4 w-4" />}
                label={dangerLabel}
                onClick={() => {
                  dangerAction();
                  onClose();
                }}
                danger
              />
            )}
          </div>
          {dangerAction || onClearChat || onMute || onLeaveGroup ? (
            <div className="my-1 h-[1px] bg-border" />
          ) : null}
          <MenuItem
            icon={<X className="h-4 w-4" />}
            label="Cancel"
            onClick={onClose}
          />
        </div>
      </div>
    </Portal>
  );
}
