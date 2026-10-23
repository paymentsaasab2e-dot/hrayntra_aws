'use client';

import React, { useEffect, useState } from 'react';

/** Keep chrome (bot, permissions, behaviour) off the first network wave. */
export function IdleMount({
  delayMs = 1600,
  children,
}: {
  delayMs?: number;
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs]);

  if (!ready) return null;
  return <>{children}</>;
}
