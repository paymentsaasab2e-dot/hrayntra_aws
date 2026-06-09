'use client';

import { useEffect } from 'react';

export const PAGE_DRAWER_OPEN_EVENT = 'app-page-drawer-open';
export const PAGE_DRAWER_CLOSE_EVENT = 'app-page-drawer-close';

let registeredDrawerCount = 0;

export function registerPageDrawerOpen() {
  registeredDrawerCount += 1;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PAGE_DRAWER_OPEN_EVENT));
  }
}

export function registerPageDrawerClose() {
  registeredDrawerCount = Math.max(0, registeredDrawerCount - 1);
  if (typeof window !== 'undefined' && registeredDrawerCount === 0) {
    window.dispatchEvent(new CustomEvent(PAGE_DRAWER_CLOSE_EVENT));
  }
}

export function getRegisteredPageDrawerCount() {
  return registeredDrawerCount;
}

/** Call from any page drawer when it mounts / unmounts (or opens / closes). */
export function usePageDrawerLifecycle(active: boolean) {
  useEffect(() => {
    if (!active) return;
    registerPageDrawerOpen();
    return () => registerPageDrawerClose();
  }, [active]);
}
