'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { requestConfirm, SYSTEM_ALERT_TITLE } from '../lib/appDialog';

export const DISCARD_UNSAVED_MESSAGE =
  'You have unsaved changes in this drawer. Do you want to discard them and close?';

export async function confirmDiscardUnsavedChanges(
  message: string = DISCARD_UNSAVED_MESSAGE,
): Promise<boolean> {
  return requestConfirm(message, {
    title: SYSTEM_ALERT_TITLE,
    tone: 'warning',
    confirmLabel: 'Yes',
    cancelLabel: 'No',
  });
}

function isSkipDirtyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest('[data-drawer-skip-dirty="true"]')) return true;
  if (target.closest('[data-drawer-nav="true"]')) return true;
  // Pure close / cancel chrome
  if (target.closest('[aria-label="Close"], [aria-label="Close drawer"], [title="Close"]')) {
    return true;
  }
  return false;
}

export type UseDrawerUnsavedGuardOptions = {
  isOpen: boolean;
  onClose: () => void;
  /** Extra dirty flag from form state comparison / edit mode. */
  isDirty?: boolean;
  /** When false, close never prompts. Default true. */
  enabled?: boolean;
  message?: string;
  /**
   * Auto-detect typing / field changes inside the drawer panel.
   * Set false when you fully control isDirty yourself.
   */
  trackInteractions?: boolean;
};

export type UseDrawerUnsavedGuardResult<T extends HTMLElement = HTMLElement> = {
  panelRef: (node: T | null) => void;
  /** Call instead of onClose for backdrop / X / Escape. */
  requestClose: () => Promise<boolean>;
  markDirty: () => void;
  markClean: () => void;
  isDirty: boolean;
};

/** Nested drawers: only the topmost open guard handles Escape. */
const escapeCloseStack: Array<() => void> = [];

/**
 * Smart unsaved-change guard for Phase 2 drawers.
 * - Prompts Yes/No only when the user typed or changed data.
 * - Silent close when nothing changed.
 */
export function useDrawerUnsavedGuard<T extends HTMLElement = HTMLElement>(
  options: UseDrawerUnsavedGuardOptions,
): UseDrawerUnsavedGuardResult<T> {
  const {
    isOpen,
    onClose,
    isDirty: explicitDirty = false,
    enabled = true,
    message = DISCARD_UNSAVED_MESSAGE,
    trackInteractions = true,
  } = options;

  const [panelEl, setPanelEl] = useState<T | null>(null);
  const panelRef = useCallback((node: T | null) => {
    setPanelEl(node);
  }, []);
  const [interactionDirty, setInteractionDirty] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) setInteractionDirty(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !enabled || !trackInteractions || !panelEl) return;

    const mark = (event: Event) => {
      if (isSkipDirtyTarget(event.target)) return;
      setInteractionDirty(true);
    };

    panelEl.addEventListener('input', mark, true);
    panelEl.addEventListener('change', mark, true);
    return () => {
      panelEl.removeEventListener('input', mark, true);
      panelEl.removeEventListener('change', mark, true);
    };
  }, [isOpen, enabled, trackInteractions, panelEl]);

  const isDirty = Boolean(explicitDirty) || interactionDirty;
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const messageRef = useRef(message);
  messageRef.current = message;

  const markDirty = useCallback(() => setInteractionDirty(true), []);
  const markClean = useCallback(() => setInteractionDirty(false), []);

  const requestClose = useCallback(async () => {
    if (enabledRef.current && isDirtyRef.current) {
      const confirmed = await confirmDiscardUnsavedChanges(messageRef.current);
      if (!confirmed) return false;
    }
    setInteractionDirty(false);
    onCloseRef.current();
    return true;
  }, []);

  useEffect(() => {
    if (!isOpen || !enabled) return;
    const closeFromEscape = () => {
      void requestClose();
    };
    escapeCloseStack.push(closeFromEscape);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (escapeCloseStack[escapeCloseStack.length - 1] !== closeFromEscape) return;
      event.preventDefault();
      event.stopPropagation();
      closeFromEscape();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      const idx = escapeCloseStack.lastIndexOf(closeFromEscape);
      if (idx >= 0) escapeCloseStack.splice(idx, 1);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [isOpen, enabled, requestClose]);

  return {
    panelRef,
    requestClose,
    markDirty,
    markClean,
    isDirty,
  };
}
