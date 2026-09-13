'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { io, type Socket } from 'socket.io-client';
import {
  apiApproveSessionTransfer,
  apiRejectSessionTransfer,
  apiSessionHeartbeat,
  clearAuthStorage,
  endSessionOnServer,
  getStoredSessionId,
  isIntentionalLogout,
  loginPathForCurrentPage,
  isImpersonationAccessToken,
  type ActiveSessionView,
} from '@/lib/sessionAuth';
import { registerAppTab, unregisterAppTab } from '@/lib/tabSessionCoordinator';
import { buildApiUrl, buildSocketBaseUrl, getAccessToken, getTenantDbName } from '@/lib/api';
import { isBulkCvUploadInProgress } from '@/lib/bulkCvRuntime';
import {
  SessionMessageModal,
  SessionTransferRequestModal,
} from './SessionModals';

const HEARTBEAT_MS = 20_000;

export default function ActiveSessionManager() {
  const router = useRouter();
  const pathname = usePathname();
  const socketRef = useRef<Socket | null>(null);
  const [transferRequest, setTransferRequest] = useState<{
    requestId: string;
    challenger: ActiveSessionView | null;
  } | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [sessionMessage, setSessionMessage] = useState<{ title: string; message: string } | null>(null);

  const isAuthRoute =
    pathname === '/login' ||
    pathname?.startsWith('/hq/login') ||
    pathname?.startsWith('/forgot-password') ||
    pathname?.startsWith('/reset-password') ||
    pathname?.startsWith('/apply') ||
    pathname?.startsWith('/client-review') ||
    pathname?.startsWith('/interview-rsvp') ||
    pathname?.startsWith('/session-transfer');

  const forceLogout = useCallback(
    (message?: string, opts?: { silent?: boolean }) => {
      void (async () => {
        const silent = Boolean(opts?.silent) || isIntentionalLogout();
        await endSessionOnServer();
        clearAuthStorage();
        socketRef.current?.disconnect();
        socketRef.current = null;
        const loginPath = loginPathForCurrentPage();
        if (silent) {
          window.location.assign(loginPath);
          return;
        }
        if (message) {
          setSessionMessage({ title: 'Session ended', message });
        }
        router.replace(`${loginPath}?session=${encodeURIComponent(message || 'Session ended')}`);
      })();
    },
    [router],
  );

  useEffect(() => {
    if (isAuthRoute || typeof window === 'undefined') return;
    if (!getAccessToken()) return;
    registerAppTab();
  }, [isAuthRoute, pathname]);

  useEffect(() => {
    if (isAuthRoute || typeof window === 'undefined') return;
    const token = getAccessToken();
    if (!token) return;
    if (isImpersonationAccessToken(token)) return;

    const socket = io(buildSocketBaseUrl(), {
      auth: {
        token,
        tenantDbName: getTenantDbName() || undefined,
      },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('session_join');
    });

    socket.on('session_transfer_request', (payload: { requestId: string; challenger?: ActiveSessionView }) => {
      setTransferRequest({
        requestId: payload.requestId,
        challenger: payload.challenger || null,
      });
    });

    socket.on('session_revoked', (payload: { reason?: string }) => {
      const reason = String(payload?.reason || '').toUpperCase();
      if (reason === 'LOGOUT' || reason === 'BROWSER_CLOSED' || isIntentionalLogout()) {
        forceLogout(undefined, { silent: true });
        return;
      }
      forceLogout(
        reason === 'TRANSFER_APPROVED'
          ? 'Your session ended because login was approved on another device.'
          : 'Your session is no longer active.',
      );
    });

    socket.on('session_inactivity_warning', () => {
      // Inactivity timeout disabled for now — ignore warning events.
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [forceLogout, isAuthRoute, pathname]);

  useEffect(() => {
    if (isAuthRoute || typeof window === 'undefined') return;

    const buildBeaconUrl = (extra: Record<string, string> = {}) => {
      const token = getAccessToken();
      const sessionId = getStoredSessionId();
      if (!token || !sessionId) return null;
      const tenantDbName = getTenantDbName() || '';
      const qs = new URLSearchParams({
        token,
        sessionId,
        tenantDbName,
        ...extra,
      });
      return buildApiUrl(`/auth/logout-beacon?${qs.toString()}`);
    };

    const sendBeaconUrl = (url: string) => {
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
          if (navigator.sendBeacon(url)) return;
        }
        void fetch(url, { method: 'GET', keepalive: true, credentials: 'include' });
      } catch {
        /* best effort only */
      }
    };

    /** Reload / bfcache restore must stay logged in — cancel any close-intent ASAP. */
    const cancelCloseIntent = () => {
      if (sessionStorage.getItem('oauth_navigation') === '1') return;
      const url = buildBeaconUrl({ cancel: '1' });
      if (!url) return;
      sendBeaconUrl(url);
    };

    const sendBrowserCloseBeacon = () => {
      // OAuth redirects leave the app temporarily — do not mark the session as closed.
      if (sessionStorage.getItem('oauth_navigation') === '1') return;
      // Keep session alive while Bulk CV is importing so a leave prompt can cancel safely.
      if (isBulkCvUploadInProgress()) return;

      const token = getAccessToken();
      const sessionId = getStoredSessionId();
      if (!token || !sessionId) return;

      const isLastTab = unregisterAppTab();
      if (!isLastTab) return;

      // Mark close-intent only (never finalize). A tab reload also hits pagehide;
      // pageshow + heartbeat cancel this within the grace window so the user
      // stays signed in. Real browser/tab close with no resume → session stops
      // blocking new logins after grace / presence timeout.
      const url = buildBeaconUrl();
      if (!url) return;
      sendBeaconUrl(url);
    };

    const handlePageHide = (event: PageTransitionEvent) => {
      if (event.persisted) {
        // Entering bfcache — tab may come back; do not mark closed.
        return;
      }
      sendBrowserCloseBeacon();
    };

    const handlePageShow = () => {
      // Reload or restore from bfcache: clear close-intent so we do not log out.
      cancelCloseIntent();
      registerAppTab();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        cancelCloseIntent();
        registerAppTab();
      }
    };

    window.addEventListener('pagehide', handlePageHide);
    // Avoid beforeunload here: it also fires on reload and would race with
    // pageshow cancel. pagehide is enough for close + navigation away.
    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibility);
    // If this mount is itself a reload, cancel any intent from the previous page.
    cancelCloseIntent();

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isAuthRoute]);

  useEffect(() => {
    if (isAuthRoute || typeof window === 'undefined') return;
    const token = getAccessToken();
    if (!token) return;
    if (isImpersonationAccessToken(token)) return;

    let cancelled = false;

    const tick = async () => {
      const sessionId = getStoredSessionId();
      if (!sessionId) return;
      try {
        const res = await apiSessionHeartbeat(sessionId);
        if (cancelled) return;
        if (!res.data?.ok) {
          forceLogout('Your session is no longer active.');
          return;
        }
        // Inactivity timeout disabled — never show the expiring-soon modal.
      } catch {
        /* network blip — do not logout immediately */
      }
    };

    tick();
    const id = window.setInterval(tick, HEARTBEAT_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [forceLogout, isAuthRoute, pathname]);

  const handleApprove = async () => {
    if (!transferRequest) return;
    setTransferLoading(true);
    try {
      await apiApproveSessionTransfer(transferRequest.requestId);
      setTransferRequest(null);
      forceLogout('You approved login on another device. This session has ended.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to approve transfer';
      setSessionMessage({ title: 'Error', message });
    } finally {
      setTransferLoading(false);
    }
  };

  const handleReject = async () => {
    if (!transferRequest) return;
    setTransferLoading(true);
    try {
      await apiRejectSessionTransfer(transferRequest.requestId);
      setTransferRequest(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reject transfer';
      setSessionMessage({ title: 'Error', message });
    } finally {
      setTransferLoading(false);
    }
  };

  if (isAuthRoute) return null;

  return (
    <>
      {transferRequest ? (
        <SessionTransferRequestModal
          challenger={transferRequest.challenger}
          loading={transferLoading}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      ) : null}
      {/* Inactivity warning modal disabled for now */}
      {sessionMessage ? (
        <SessionMessageModal
          title={sessionMessage.title}
          message={sessionMessage.message}
          onClose={() => setSessionMessage(null)}
        />
      ) : null}
    </>
  );
}
