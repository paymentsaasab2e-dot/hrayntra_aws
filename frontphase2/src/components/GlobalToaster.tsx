'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Toaster } from 'sonner';

/**
 * Single app-wide Sonner host, portaled to document.body so toasts are never
 * trapped under .ph2-page-shell isolation / header action stacking contexts.
 */
export function GlobalToaster() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <Toaster
      position="top-right"
      richColors
      closeButton
      offset={{ top: '5rem', right: '1rem' }}
      style={{ zIndex: 2147483646 }}
      toastOptions={{
        style: { zIndex: 2147483646 },
      }}
    />,
    document.body,
  );
}
