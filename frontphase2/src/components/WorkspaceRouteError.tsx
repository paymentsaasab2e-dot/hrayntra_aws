'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { isStaleClientBundleError, reloadOnceForStaleBundle } from '@/lib/staleClientBundle';
import { WorkspaceErrorCard } from '@/components/PageErrorBoundary';

function hardReload() {
  if (typeof window === 'undefined') return;
  window.location.reload();
}

/** Shared Next.js `error.tsx` screen — one route crash must not stick on other routes. */
export default function WorkspaceRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const crashedPathRef = useRef(pathname);

  useEffect(() => {
    console.error(error);
    crashedPathRef.current = pathname;
    if (isStaleClientBundleError(error)) {
      reloadOnceForStaleBundle();
    }
    // Capture the path at crash time only; pathname changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  useEffect(() => {
    if (pathname !== crashedPathRef.current) {
      reset();
    }
  }, [pathname, reset]);

  return (
    <WorkspaceErrorCard
      error={error}
      onRetry={() => {
        if (isStaleClientBundleError(error) && reloadOnceForStaleBundle()) return;
        try {
          reset();
        } catch {
          /* reset can fail if the tree is already unmounted */
        }
        hardReload();
      }}
    />
  );
}
