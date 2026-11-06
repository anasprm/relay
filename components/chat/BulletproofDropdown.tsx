'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';

interface DropdownItem {
  label: string;
  onClick: () => void;
  isDestructive?: boolean;
}

interface BulletproofDropdownProps {
  items?: DropdownItem[] | null | undefined;
  ariaLabel?: string;
}

export function BulletproofDropdown({
  items = [],
  ariaLabel = 'More options',
}: BulletproofDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const safeItems = Array.isArray(items) ? items : [];

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="p-2 rounded-full text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800/60 shrink-0 cursor-pointer flex items-center justify-center"
        aria-label={ariaLabel}
      >
        <MoreVertical className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-[#1C1C1E] border border-zinc-800 rounded-xl shadow-2xl z-50 py-2 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
          {safeItems.length === 0 ? (
            <div className="px-4 py-2 text-xs text-zinc-500">No options available</div>
          ) : (
            safeItems.map((item, index) => (
              <button
                key={index}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  try {
                    item?.onClick?.();
                  } catch (err) {
                    console.error('Error executing dropdown action:', err);
                  }
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800/60 transition-colors text-left',
                  item?.isDestructive
                    ? 'text-red-400 hover:bg-red-500/10'
                    : 'text-zinc-200 hover:bg-zinc-800/60',
                )}
              >
                <span>{item?.label || 'Action'}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}