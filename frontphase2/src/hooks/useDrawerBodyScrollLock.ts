'use client';

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Locks body scroll while a drawer is open, compensating for scrollbar width
 * so the page does not jump. Unlock is deferred until `release()` so exit
 * animations are not interrupted by a layout shift (the common open/close flick).
 */
export function useDrawerBodyScrollLock(isOpen: boolean) {
  const lockedRef = useRef(false);
  const isOpenRef = useRef(isOpen);
  const prevOverflowRef = useRef('');
  const prevPaddingRightRef = useRef('');

  isOpenRef.current = isOpen;

  const lock = useCallback(() => {
    if (typeof document === 'undefined' || lockedRef.current) return;
    prevOverflowRef.current = document.body.style.overflow;
    prevPaddingRightRef.current = document.body.style.paddingRight;
    const scrollbarGap = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    document.body.style.overflow = 'hidden';
    if (scrollbarGap > 0) {
      document.body.style.paddingRight = `${scrollbarGap}px`;
    }
    lockedRef.current = true;
  }, []);

  const release = useCallback(() => {
    if (typeof document === 'undefined' || !lockedRef.current) return;
    // Skip if the drawer reopened before the previous exit finished.
    if (isOpenRef.current) return;
    document.body.style.overflow = prevOverflowRef.current;
    document.body.style.paddingRight = prevPaddingRightRef.current;
    lockedRef.current = false;
  }, []);

  useLayoutEffect(() => {
    if (isOpen) lock();
  }, [isOpen, lock]);

  useEffect(() => () => {
    // Force unlock on unmount even if marked open.
    if (!lockedRef.current || typeof document === 'undefined') return;
    document.body.style.overflow = prevOverflowRef.current;
    document.body.style.paddingRight = prevPaddingRightRef.current;
    lockedRef.current = false;
  }, []);

  return { release };
}
