'use client';

import { useEffect } from 'react';

/**
 * Lock page scroll while a centered popup is open without a horizontal jump
 * (scrollbar disappearing used to shift the page and look like a flicker).
 */
export function useLockedBodyScroll(locked: boolean) {
  useEffect(() => {
    if (!locked || typeof document === 'undefined') return;

    const body = document.body;
    const html = document.documentElement;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarGap = Math.max(0, window.innerWidth - html.clientWidth);

    body.style.overflow = 'hidden';
    if (scrollbarGap > 0) {
      body.style.paddingRight = `${scrollbarGap}px`;
    }

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [locked]);
}
