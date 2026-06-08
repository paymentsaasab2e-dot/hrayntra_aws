'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { requestConfirm } from '../lib/appDialog';

type BulkCvGuardProgress = { current: number; total: number };

type BulkCvGuardRegistration = {
  active: boolean;
  progress: BulkCvGuardProgress;
  onStop: () => void;
};

type LeaveIntent = {
  leaveActionLabel: string;
  onConfirmed: () => void;
};

type BulkCvLeaveGuardContextValue = {
  register: (registration: BulkCvGuardRegistration | null) => void;
  requestLeave: (intent: LeaveIntent) => void;
};

const BulkCvLeaveGuardContext = createContext<BulkCvLeaveGuardContextValue | null>(null);

function isSamePageNavigation(href: string): boolean {
  try {
    const url = new URL(href, window.location.href);
    return (
      url.origin === window.location.origin &&
      url.pathname === window.location.pathname &&
      url.search === window.location.search
    );
  } catch {
    return true;
  }
}

function buildBulkCvLeaveMessage(
  leaveActionLabel: string,
  progress: BulkCvGuardProgress,
): string {
  const progressLine =
    progress.total > 0
      ? `\n\nProcessed ${progress.current} of ${progress.total} so far.`
      : '';
  return `CVs are still being parsed and saved. If you ${leaveActionLabel} now, parsing will stop and remaining files may not be processed.${progressLine}`;
}

export function BulkCvLeaveGuardProvider({ children }: { children: React.ReactNode }) {
  const [registration, setRegistration] = useState<BulkCvGuardRegistration | null>(null);
  const registrationRef = useRef<BulkCvGuardRegistration | null>(null);
  const onStopRef = useRef<(() => void) | null>(null);
  const historyTrapRef = useRef(false);
  const leaveConfirmInFlightRef = useRef(false);

  useEffect(() => {
    onStopRef.current = registrationRef.current?.onStop ?? null;
  }, [registration?.onStop, registration?.active]);

  const register = useCallback((next: BulkCvGuardRegistration | null) => {
    registrationRef.current = next;
    setRegistration(next);
  }, []);

  const requestLeave = useCallback((intent: LeaveIntent) => {
    const activeRegistration = registrationRef.current;
    if (!activeRegistration?.active) {
      intent.onConfirmed();
      return;
    }
    if (leaveConfirmInFlightRef.current) return;

    leaveConfirmInFlightRef.current = true;
    const { progress } = activeRegistration;

    void requestConfirm(
      buildBulkCvLeaveMessage(intent.leaveActionLabel, progress),
      {
        title: 'Bulk CV parsing in progress',
        tone: 'warning',
        confirmLabel: `Yes — stop & ${intent.leaveActionLabel}`,
        cancelLabel: 'No — keep parsing',
      },
    ).then((confirmed) => {
      leaveConfirmInFlightRef.current = false;
      if (confirmed) {
        onStopRef.current?.();
        intent.onConfirmed();
      }
    });
  }, []);

  const isActive = Boolean(registration?.active);

  useEffect(() => {
    if (!isActive || typeof window === 'undefined') return;

    const onPageHide = (event: PageTransitionEvent) => {
      if (event.persisted) return;
      onStopRef.current?.();
    };

    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, [isActive]);

  useEffect(() => {
    if (!isActive || typeof window === 'undefined') return;

    const onDocumentClick = (event: MouseEvent) => {
      if (leaveConfirmInFlightRef.current) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }
      if (isSamePageNavigation(href)) return;

      event.preventDefault();
      event.stopPropagation();

      const url = new URL(href, window.location.href);
      requestLeave({
        leaveActionLabel: 'leave this page',
        onConfirmed: () => {
          if (anchor.target === '_blank') {
            window.open(url.href, '_blank', 'noopener,noreferrer');
            return;
          }
          window.location.assign(url.href);
        },
      });
    };

    document.addEventListener('click', onDocumentClick, true);
    return () => document.removeEventListener('click', onDocumentClick, true);
  }, [isActive, requestLeave]);

  useEffect(() => {
    if (!isActive || typeof window === 'undefined') return;

    const trap = () => {
      if (!historyTrapRef.current) {
        history.pushState({ bulkCvGuard: true }, '', window.location.href);
        historyTrapRef.current = true;
      }
    };

    trap();

    const onPopState = () => {
      trap();
      if (leaveConfirmInFlightRef.current) return;
      requestLeave({
        leaveActionLabel: 'go back',
        onConfirmed: () => {
          historyTrapRef.current = false;
          window.history.back();
        },
      });
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      if (historyTrapRef.current) {
        historyTrapRef.current = false;
      }
    };
  }, [isActive, requestLeave]);

  const value = useMemo(() => ({ register, requestLeave }), [register, requestLeave]);

  return (
    <BulkCvLeaveGuardContext.Provider value={value}>
      {children}
    </BulkCvLeaveGuardContext.Provider>
  );
}

export function useBulkCvLeaveGuard() {
  const ctx = useContext(BulkCvLeaveGuardContext);
  if (!ctx) {
    throw new Error('useBulkCvLeaveGuard must be used within BulkCvLeaveGuardProvider');
  }
  return ctx;
}

/** Optional hook when provider may be absent (drawer used outside guarded pages). */
export function useBulkCvLeaveGuardOptional() {
  return useContext(BulkCvLeaveGuardContext);
}

export function useBulkCvLeaveGuardRegistration(
  registration: BulkCvGuardRegistration | null,
  enabled = true
) {
  const ctx = useBulkCvLeaveGuardOptional();
  const registrationRef = useRef(registration);
  registrationRef.current = registration;

  useEffect(() => {
    if (!ctx || !enabled) return;
    if (!registration?.active) {
      ctx.register(null);
      return () => ctx.register(null);
    }
    ctx.register(registrationRef.current);
    return () => ctx.register(null);
  }, [ctx, enabled, registration?.active]);

  useEffect(() => {
    if (!ctx || !enabled || !registration?.active) return;
    ctx.register(registrationRef.current);
  }, [
    ctx,
    enabled,
    registration?.active,
    registration?.progress.current,
    registration?.progress.total,
  ]);
}
