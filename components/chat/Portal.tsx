'use client';

import { createPortal, type ReactNode } from 'react-dom/client';
import { useEffect, useRef } from 'react';

interface PortalProps {
  children: ReactNode;
  container?: HTMLElement | null;
}

/**
 * Renders children into a detached DOM node (document.body by default) so
 * dropdowns, modals, and trays never get clipped by overflow-hidden parents
 * (Phase 3: Portal Rendering).
 */
export function Portal({ children, container }: PortalProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  if (!elRef.current) elRef.current = document.createElement('div');
  const el = elRef.current;

  useEffect(() => {
    const target = container || document.body;
    target.appendChild(el);
    return () => {
      if (el.parentNode === target) target.removeChild(el);
    };
  }, [container]);

  return createPortal(children, el);
}
