'use client';

import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { Bell, FileText, Lock, LogOut, Settings, Trash2, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Portal } from './Portal';

interface MenuItemDef {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
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

interface MoreOptionsMenuProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLButtonElement | null>;
  menuItems?: MenuItemDef[];
  dangerLabel?: string;
  dangerAction?: () => void;
}

export function MoreOptionsMenu({
  open,
  onClose,
  anchorRef,
  menuItems,
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
    if (!open || !anchor || !menu || typeof window === 'undefined') return;
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
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        (!anchorRef.current ||
          !anchorRef.current.contains(event.target as Node))
      ) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', positionMenu);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', positionMenu);
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
          {/* Guarded mapping over menu items — safely handles undefined/null */}
          {(menuItems || []).map((item, i) => (
            <MenuItem
              key={i}
              icon={item.icon}
              label={item.label}
              onClick={() => {
                item.onClick();
                onClose();
              }}
              danger={item.danger}
              disabled={item.disabled}
            />
          ))}
          {(menuItems || []).length > 0 && dangerAction && dangerLabel && (
            <div className="my-1 h-[1px] bg-border" />
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
          {(menuItems || []).length > 0 && (
            <div className="my-1 h-[1px] bg-border" />
          )}
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
