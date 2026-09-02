'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { BrandPngIcon } from '@/components/coins/BrandPngIcon';
import {
  apiAddInboxChatMessage,
  apiCreateEntityChatThread,
  apiGetEntityChatThread,
  apiGetInboxThread,
  type EntityChatType,
  type InboxMessage,
} from '../../lib/api';
import { usePermissions } from '../../hooks/usePermissions';
import { formatDateTimeDMY } from '../../utils/dateDisplay';
import { startAsyncLoad } from '../../lib/asyncLoadGuard';

export interface DrawerEntityChatTabProps {
  entityType: EntityChatType;
  entityId: string | null | undefined;
  entityLabel?: string;
  isActive: boolean;
  isOpen: boolean;
  className?: string;
}

function sortMessages(messages: InboxMessage[]) {
  return [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function DrawerEntityChatTab({
  entityType,
  entityId,
  entityLabel,
  isActive,
  isOpen,
  className = '',
}: DrawerEntityChatTabProps) {
  const { hasPermission, hasAnyPermission } = usePermissions();
  const canView = hasAnyPermission(['inbox_read', 'inbox_manage']);
  const canSend = hasPermission('inbox_manage');

  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const resolvedEntityId = String(entityId || '').trim();

  const loadChat = useCallback(async () => {
    if (!resolvedEntityId) {
      setLoading(false);
      return;
    }
    const load = startAsyncLoad(setLoading);
    try {
      const existingThread = await apiGetEntityChatThread(entityType, resolvedEntityId);
      if (!load.isActive()) return;
      if (!existingThread) {
        setThreadId(null);
        setMessages([]);
        return;
      }
      setThreadId(existingThread.id);
      const fullThread = await apiGetInboxThread(existingThread.id);
      if (!load.isActive()) return;
      setMessages(sortMessages(fullThread.messages || []));
    } catch (error) {
      console.error('Failed to load entity chat:', error);
      if (!load.isActive()) return;
      setThreadId(null);
      setMessages([]);
    } finally {
      load.finish();
    }
  }, [entityType, resolvedEntityId]);

  useEffect(() => {
    if (!isOpen || !isActive) return;
    void loadChat();
  }, [isOpen, isActive, loadChat]);

  useEffect(() => {
    if (!isOpen) {
      setThreadId(null);
      setMessages([]);
      setInput('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isActive || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isActive]);

  const handleSend = async () => {
    if (!resolvedEntityId || !input.trim() || !canSend) return;
    setSending(true);
    try {
      const messageText = input.trim();
      if (!threadId) {
        const thread = await apiCreateEntityChatThread(entityType, resolvedEntityId, {
          subject: entityLabel ? `${entityLabel} — Team chat` : 'Team chat',
          initialMessage: messageText,
        });
        setThreadId(thread.id);
        const fullThread = await apiGetInboxThread(thread.id);
        setMessages(sortMessages(fullThread.messages || []));
      } else {
        await apiAddInboxChatMessage(threadId, messageText);
        const fullThread = await apiGetInboxThread(threadId);
        setMessages(sortMessages(fullThread.messages || []));
      }
      setInput('');
    } catch (error) {
      console.error('Failed to send chat message:', error);
    } finally {
      setSending(false);
    }
  };

  if (!resolvedEntityId) {
    return (
      <div className={`rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 ${className}`}>
        Save this record first to start team chat.
      </div>
    );
  }

  if (!canView) {
    return (
      <div className={`rounded-xl border border-slate-200 bg-white p-6 text-center ${className}`}>
        <BrandPngIcon name="chat" className="mx-auto mb-3 h-8 w-8" />
        <p className="text-sm font-medium text-slate-700">Team chat unavailable</p>
        <p className="mt-1 text-xs text-slate-500">
          You need inbox access to view or send messages here.
        </p>
      </div>
    );
  }

  return (
    <div className={`flex min-h-[20rem] flex-col rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Team chat</h4>
          <p className="mt-0.5 text-xs text-slate-500">
            Internal messages for team members with inbox access.
          </p>
        </div>
        <BrandPngIcon name="chat" className="h-4 w-4" />
      </div>

      <div ref={scrollRef} className="flex max-h-[28rem] flex-1 flex-col gap-3 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
            Loading chat…
          </div>
        ) : messages.length === 0 ? (
          <p className="text-xs text-slate-500">No messages yet. Start the conversation below.</p>
        ) : (
          messages.map((msg) => {
            const senderName = msg.sender?.name || msg.sender?.email || 'Team member';
            const createdAt = msg.createdAt ? formatDateTimeDMY(msg.createdAt) : '';
            return (
              <div key={msg.id} className="text-xs text-slate-700">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-slate-800">{senderName}</span>
                  {createdAt ? (
                    <span className="text-[10px] text-slate-400">{createdAt}</span>
                  ) : null}
                </div>
                <div className="mt-1 inline-block max-w-[95%] whitespace-pre-wrap rounded-lg bg-slate-100 px-3 py-2 text-[11px]">
                  {msg.body}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-slate-100 px-4 pb-4 pt-2">
        {canSend ? (
          <div className="flex items-end gap-2">
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="Type a message to your team…"
              className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!input.trim() || sending}
              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? 'Sending…' : (
                <>
                  <BrandPngIcon name="send" className="h-3.5 w-3.5" />
                  Send
                </>
              )}
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-500">You can read messages but need the Chat permission to send.</p>
        )}
      </div>
    </div>
  );
}
