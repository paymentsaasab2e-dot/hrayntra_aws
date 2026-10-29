'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Render overlays on document.body so they are not clipped by list-page isolation. */
export function PortalToBody({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  if (!ready || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
