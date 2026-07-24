'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { confirmDiscardUnsavedChanges } from './useDrawerUnsavedGuard';

const DEFAULT_MESSAGE =
  'You have unsaved changes on this page. Do you want to discard them and leave?';

type UseUnsavedPageGuardOptions = {
  isDirty: boolean;
  message?: string;
  /** Called when the user confirms discard, before navigation. */
  onDiscard?: () => void;
};

/**
 * Intercepts in-app link clicks (e.g. main sidenav) while a page form is dirty
 * and shows the branded Yes/No discard popup before navigating away.
 */
export function useUnsavedPageGuard({
  isDirty,
  message = DEFAULT_MESSAGE,
  onDiscard,
}: UseUnsavedPageGuardOptions): void {
  const router = useRouter();
  const pathname = usePathname();
  const dirtyRef = useRef(isDirty);
  const messageRef = useRef(message);
  const onDiscardRef = useRef(onDiscard);
  const pendingRef = useRef(false);

  dirtyRef.current = isDirty;
  messageRef.current = message;
  onDiscardRef.current = onDiscard;

  useEffect(() => {
    if (!isDirty) return;

    const shouldGuardHref = (href: string): boolean => {
      try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) return true;
        // Stay on the same app route (path + query) — no guard needed.
        if (url.pathname === pathname && url.search === window.location.search) {
          return false;
        }
        return true;
      } catch {
        return false;
      }
    };

    const onDocumentClick = (event: MouseEvent) => {
      if (!dirtyRef.current || pendingRef.current) return;
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      if (!shouldGuardHref(href)) return;

      event.preventDefault();
      event.stopPropagation();

      pendingRef.current = true;
      void (async () => {
        try {
          const confirmed = await confirmDiscardUnsavedChanges(messageRef.current);
          if (!confirmed) return;
          dirtyRef.current = false;
          onDiscardRef.current?.();
          router.push(href);
        } finally {
          pendingRef.current = false;
        }
      })();
    };

    document.addEventListener('click', onDocumentClick, true);
    return () => document.removeEventListener('click', onDocumentClick, true);
  }, [isDirty, pathname, router]);
}
