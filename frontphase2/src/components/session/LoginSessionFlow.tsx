'use client';

import React, { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { buildSocketBaseUrl } from '@/lib/api';
import {
  apiCompleteSessionTransfer,
  apiRequestSessionTransfer,
  apiSessionTransferStatus,
  buildLoginDevicePayload,
  buildLoginIdentifierFields,
  finalizeAuthAfterTokens,
  type ActiveSessionView,
} from '@/lib/sessionAuth';
import {
  DuplicateLoginModal,
  SessionMessageModal,
  WaitingTransferModal,
} from './SessionModals';

type Props = {
  identifier: string;
  password: string;
  activeSession: ActiveSessionView | null;
  onCancel: () => void;
  onSuccess: (payload: { requirePasswordReset: boolean }) => void;
};

export function LoginSessionFlow({ identifier, password, activeSession, onCancel, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ title: string; message: string } | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const loginFields = buildLoginIdentifierFields(identifier);
  const device = buildLoginDevicePayload();

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  const completeApprovedLogin = async (approvedRequestId: string) => {
    const res = await apiCompleteSessionTransfer({
      requestId: approvedRequestId,
      ...loginFields,
      password,
      ...device,
    });
    if (!res.data?.accessToken) {
      throw new Error('Failed to complete login after approval.');
    }
    const auth = await finalizeAuthAfterTokens({
      accessToken: res.data.accessToken,
      refreshToken: res.data.refreshToken,
      tenantDbName: res.data.tenantDbName,
    });
    onSuccess({ requirePasswordReset: auth.requirePasswordReset });
  };

  const listenForTransferResolution = (rid: string) => {
    const socket = io(buildSocketBaseUrl(), {
      transports: ['websocket', 'polling'],
      auth: { pendingTransferRequestId: rid },
    });
    socketRef.current = socket;

    socket.on('session_transfer_resolved', async (payload: { status?: string; message?: string }) => {
      if (payload?.status === 'APPROVED') {
        try {
          setLoading(true);
          await completeApprovedLogin(rid);
        } catch (err: unknown) {
          setMessage({
            title: 'Login failed',
            message: err instanceof Error ? err.message : 'Could not complete login.',
          });
          setWaiting(false);
        } finally {
          setLoading(false);
        }
        return;
      }
      if (payload?.status === 'REJECTED') {
        setWaiting(false);
        setMessage({
          title: 'Login request rejected',
          message: payload.message || 'Login request rejected by active session.',
        });
      }
      if (payload?.status === 'EXPIRED') {
        setWaiting(false);
        setMessage({
          title: 'Request expired',
          message: 'The login request timed out. Please try again.',
        });
      }
    });
  };

  const pollTransferStatus = (rid: string) => {
    const interval = window.setInterval(async () => {
      try {
        const res = await apiSessionTransferStatus(rid);
        const status = res.data?.status;
        if (status === 'APPROVED') {
          window.clearInterval(interval);
          setLoading(true);
          try {
            await completeApprovedLogin(rid);
          } catch (err: unknown) {
            setMessage({
              title: 'Login failed',
              message: err instanceof Error ? err.message : 'Could not complete login.',
            });
            setWaiting(false);
          } finally {
            setLoading(false);
          }
        } else if (status === 'REJECTED') {
          window.clearInterval(interval);
          setWaiting(false);
          setMessage({
            title: 'Login request rejected',
            message: 'Login request rejected by active session.',
          });
        } else if (status === 'EXPIRED' || status === 'NOT_FOUND') {
          window.clearInterval(interval);
          setWaiting(false);
          setMessage({
            title: 'Request expired',
            message: 'The login request timed out. Please try again.',
          });
        }
      } catch {
        /* ignore transient poll errors */
      }
    }, 2500);
    return () => window.clearInterval(interval);
  };

  const handleYes = async () => {
    setLoading(true);
    try {
      const res = await apiRequestSessionTransfer({
        ...loginFields,
        password,
        ...device,
      });
      const rid = res.data?.requestId;
      if (!rid) throw new Error('Failed to create session transfer request.');
      setRequestId(rid);
      setWaiting(true);
      listenForTransferResolution(rid);
      pollTransferStatus(rid);
    } catch (err: unknown) {
      setMessage({
        title: 'Request failed',
        message: err instanceof Error ? err.message : 'Could not request session transfer.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (message) {
    return (
      <SessionMessageModal
        title={message.title}
        message={message.message}
        onClose={() => {
          setMessage(null);
          onCancel();
        }}
      />
    );
  }

  if (waiting && requestId) {
    return <WaitingTransferModal />;
  }

  return (
    <DuplicateLoginModal
      activeSession={activeSession}
      loading={loading}
      onYes={handleYes}
      onNo={onCancel}
    />
  );
}
