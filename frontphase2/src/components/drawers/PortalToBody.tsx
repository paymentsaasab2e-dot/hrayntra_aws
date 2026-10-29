'use client';

import { useLayoutEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Render overlays on document.body so they are not clipped by list-page isolation. */
export function PortalToBody({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setTarget(document.body);
  }, []);
  if (!target) return null;
  return createPortal(children, target);
}
