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
import {
  InactivityWarningModal,
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
  const [inactivityWarning, setInactivityWarning] = useState(false);
  const [sessionMessage, setSessionMessage] = useState<{ title: string; message: string } | null>(null);

  const isAuthRoute =
    pathname === '/login' ||
    pathname?.startsWith('/hq/login') ||
    pathname?.startsWith('/forgot-password') ||
    pathname?.startsWith('/reset-password') ||
    pathname?.startsWith('/apply') ||
    pathname?.startsWith('/client-review');

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
      setInactivityWarning(true);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [forceLogout, isAuthRoute, pathname]);

  useEffect(() => {
    if (isAuthRoute || typeof window === 'undefined') return;

    const sendBrowserCloseBeacon = () => {
      // OAuth redirects leave the app temporarily — do not mark the session as closed.
      if (sessionStorage.getItem('oauth_navigation') === '1') return;

      const token = getAccessToken();
      const sessionId = getStoredSessionId();
      if (!token || !sessionId) return;

      const isLastTab = unregisterAppTab();
      if (!isLastTab) return;

      const tenantDbName = getTenantDbName() || '';
      const url = buildApiUrl(
        `/auth/logout-beacon?token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(sessionId)}&tenantDbName=${encodeURIComponent(tenantDbName)}`,
      );

      try {
        void fetch(url, { method: 'GET', keepalive: true, credentials: 'include' });
      } catch {
        /* best effort only */
      }
    };

    const handlePageHide = (event: PageTransitionEvent) => {
      if (event.persisted) return;
      sendBrowserCloseBeacon();
    };

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', sendBrowserCloseBeacon);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', sendBrowserCloseBeacon);
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
          forceLogout('Your session expired due to inactivity.');
          return;
        }
        if (res.data.inactivityWarning) {
          setInactivityWarning(true);
        }
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
      {inactivityWarning ? (
        <InactivityWarningModal
          onContinue={() => {
            setInactivityWarning(false);
            void apiSessionHeartbeat(getStoredSessionId() || '');
          }}
          onLogout={() => forceLogout(undefined, { silent: true })}
        />
      ) : null}
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
