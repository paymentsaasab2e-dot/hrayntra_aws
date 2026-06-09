'use client';

import { useEffect, useState } from 'react';
import {
  PAGE_DRAWER_CLOSE_EVENT,
  PAGE_DRAWER_OPEN_EVENT,
  getRegisteredPageDrawerCount,
} from '../lib/pageDrawerEvents';

const MIN_PANEL_WIDTH = 240;
const MIN_PANEL_HEIGHT_RATIO = 0.38;

function classNameOf(el: Element): string {
  if (!(el instanceof HTMLElement)) return '';
  return typeof el.className === 'string' ? el.className : '';
}

function isFloatingAssistant(el: HTMLElement): boolean {
  if (el.dataset.floatingBot === 'true') return true;
  const cls = classNameOf(el);
  if (cls.includes('z-[9998]') || cls.includes('z-[9999]')) return true;
  if (el.closest('[data-floating-bot="true"]')) return true;
  return false;
}

function isDrawerBackdrop(el: HTMLElement, cls: string, rect: DOMRect): boolean {
  if (!cls.includes('fixed') || !cls.includes('inset-0')) return false;
  if (rect.width < window.innerWidth * 0.85 || rect.height < window.innerHeight * 0.85) return false;

  const zIndex = Number.parseInt(window.getComputedStyle(el).zIndex || '0', 10);
  if (Number.isFinite(zIndex) && zIndex >= 9998) return false;

  return (
    cls.includes('bg-slate-900') ||
    cls.includes('backdrop-blur') ||
    cls.includes('bg-black/')
  );
}

function isDrawerOverlayShell(el: HTMLElement, cls: string, rect: DOMRect): boolean {
  if (!cls.includes('fixed') || !cls.includes('inset-0') || !cls.includes('flex')) return false;
  if (rect.width < window.innerWidth * 0.85) return false;

  const zIndex = Number.parseInt(window.getComputedStyle(el).zIndex || '0', 10);
  if (Number.isFinite(zIndex) && zIndex >= 9998) return false;

  return cls.includes('justify-end') || cls.includes('flex-row');
}

function isDrawerPanel(el: HTMLElement, cls: string, rect: DOMRect): boolean {
  if (el.dataset.appPageDrawer === 'panel') return true;
  if (isFloatingAssistant(el)) return false;

  const positioned =
    cls.includes('fixed') || cls.includes('absolute') || cls.includes('relative');
  if (!positioned) return false;

  if (rect.width < MIN_PANEL_WIDTH || rect.height < window.innerHeight * MIN_PANEL_HEIGHT_RATIO) {
    return false;
  }

  if (rect.right < window.innerWidth - 28) return false;
  if (rect.left < 40 && rect.width > window.innerWidth * 0.92) return false;
  if (rect.height < 100 && rect.top < 80) return false;

  const rightAnchored =
    cls.includes('right-0') ||
    cls.includes('right-4') ||
    cls.includes('inset-y-0') ||
    cls.includes('justify-end') ||
    rect.right >= window.innerWidth - 8;

  const looksLikeDrawer =
    cls.includes('shadow-2xl') ||
    cls.includes('shadow-[0_24px') ||
    cls.includes('border-l') ||
    cls.includes('max-w-6xl') ||
    cls.includes('max-w-5xl') ||
    cls.includes('max-w-4xl') ||
    cls.includes('max-w-3xl') ||
    cls.includes('w-3/4') ||
    cls.includes('w-[min') ||
    cls.includes('rounded-[28px]') ||
    rect.width >= window.innerWidth * 0.32;

  return rightAnchored && looksLikeDrawer;
}

function scanPageDrawersOpen(): boolean {
  if (typeof document === 'undefined') return false;
  if (getRegisteredPageDrawerCount() > 0) return true;

  for (const el of document.querySelectorAll('body *')) {
    if (!(el instanceof HTMLElement)) continue;
    if (isFloatingAssistant(el)) continue;

    const cls = classNameOf(el);
    if (!cls) continue;

    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;

    if (isDrawerBackdrop(el, cls, rect)) return true;
    if (isDrawerOverlayShell(el, cls, rect)) return true;
    if (isDrawerPanel(el, cls, rect)) return true;
  }

  return false;
}

/** True when any full-height page drawer is open (registered or detected in DOM). */
export function usePageDrawerOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = () => setOpen(getRegisteredPageDrawerCount() > 0 || scanPageDrawersOpen());

    const onRegisteredOpen = () => setOpen(true);
    const onRegisteredClose = () => sync();

    sync();
    window.addEventListener(PAGE_DRAWER_OPEN_EVENT, onRegisteredOpen);
    window.addEventListener(PAGE_DRAWER_CLOSE_EVENT, onRegisteredClose);

    const observer = new MutationObserver(() => sync());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'data-app-page-drawer'],
    });

    window.addEventListener('resize', sync);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', sync);
      window.removeEventListener(PAGE_DRAWER_OPEN_EVENT, onRegisteredOpen);
      window.removeEventListener(PAGE_DRAWER_CLOSE_EVENT, onRegisteredClose);
    };
  }, []);

  return open;
}
