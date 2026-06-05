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
import { BulkCvLeaveConfirmModal } from '../components/candidates/BulkCvLeaveConfirmModal';

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

export function BulkCvLeaveGuardProvider({ children }: { children: React.ReactNode }) {
  const [registration, setRegistration] = useState<BulkCvGuardRegistration | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [leaveActionLabel, setLeaveActionLabel] = useState('leave');
  const leaveIntentRef = useRef<LeaveIntent | null>(null);
  const onStopRef = useRef<(() => void) | null>(null);
  const historyTrapRef = useRef(false);

  useEffect(() => {
    onStopRef.current = registration?.onStop ?? null;
  }, [registration?.onStop]);

  const register = useCallback((next: BulkCvGuardRegistration | null) => {
    setRegistration(next);
  }, []);

  const requestLeave = useCallback((intent: LeaveIntent) => {
    if (!registration?.active) {
      intent.onConfirmed();
      return;
    }
    leaveIntentRef.current = intent;
    setLeaveActionLabel(intent.leaveActionLabel);
    setConfirmOpen(true);
  }, [registration?.active]);

  const handleStay = useCallback(() => {
    leaveIntentRef.current = null;
    setConfirmOpen(false);
  }, []);

  const handleStopAndLeave = useCallback(() => {
    const intent = leaveIntentRef.current;
    leaveIntentRef.current = null;
    setConfirmOpen(false);
    onStopRef.current?.();
    intent?.onConfirmed?.();
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
      if (confirmOpen) return;
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
  }, [confirmOpen, isActive, requestLeave]);

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
      if (confirmOpen) return;
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
  }, [confirmOpen, isActive, requestLeave]);

  const value = useMemo(() => ({ register, requestLeave }), [register, requestLeave]);

  return (
    <BulkCvLeaveGuardContext.Provider value={value}>
      {children}
      <BulkCvLeaveConfirmModal
        open={confirmOpen && isActive}
        processed={registration?.progress.current ?? 0}
        total={registration?.progress.total ?? 0}
        leaveActionLabel={leaveActionLabel}
        onStay={handleStay}
        onStopAndLeave={handleStopAndLeave}
      />
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

  useEffect(() => {
    if (!ctx || !enabled) return;
    ctx.register(registration);
    return () => ctx.register(null);
  }, [
    ctx,
    enabled,
    registration?.active,
    registration?.progress.current,
    registration?.progress.total,
    registration?.onStop,
  ]);
}
