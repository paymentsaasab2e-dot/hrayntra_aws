'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Archive,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock3,
  Download,
  FileText,
  Filter,
  Mail,
  Menu,
  MoreVertical,
  Paperclip,
  Pencil,
  RefreshCcw,
  Reply,
  ReplyAll,
  Search,
  Send,
  Star,
  Tag,
  Trash2,
  UserCircle2,
} from 'lucide-react';
import { formatDateDMY, formatDateTimeDMY } from '../../utils/dateDisplay';
import {
  apiArchiveGmailMessage,
  apiArchiveOutlookMessage,
  apiConnectIntegration,
  apiCreateCalendarEventFromGmailMessage,
  apiCreateCalendarEventFromOutlookMessage,
  apiGetGmailInbox,
  apiGetGmailMessage,
  apiGetMailboxStatus,
  apiGetOutlookInbox,
  apiGetOutlookMessage,
  apiTrashGmailMessage,
  apiTrashOutlookMessage,
  apiUpdateGmailMessageFlags,
  apiUpdateOutlookMessageFlags,
  type GmailInboxMessage,
} from '../../lib/api';
import { usePageAutoRefresh } from '../../hooks/usePageAutoRefresh';

type MailTab = 'Primary' | 'Promotions' | 'Social' | 'Updates';
type ResizeSection = 'left' | 'middle' | null;
type GmailFolder = 'INBOX' | 'STARRED' | 'SNOOZED' | 'SENT' | 'DRAFT';
type MailProvider = 'gmail' | 'outlook';

const INBOX_PROVIDER_KEY = 'inbox_mail_provider';

const LEFT_MENU = [
  { label: 'Inbox', icon: Mail, folder: 'INBOX' as GmailFolder },
  { label: 'Starred', icon: Star, folder: 'STARRED' as GmailFolder },
  { label: 'Snoozed', icon: Clock3, folder: 'SNOOZED' as GmailFolder },
  { label: 'Sent', icon: Send, folder: 'SENT' as GmailFolder },
  { label: 'Drafts', icon: FileText, folder: 'DRAFT' as GmailFolder },
];

const LEFT_MIN = 140;
const LEFT_MAX = 420;
const LIST_MIN = 220;
const LIST_MAX = 760;
const DETAIL_MIN = 240;
const DETAIL_MAX = 900;

function getResponsiveMins(viewportWidth: number) {
  if (viewportWidth < 900) {
    return { left: 96, list: 160, detail: 180 };
  }
  if (viewportWidth < 1200) {
    return { left: 120, list: 190, detail: 220 };
  }
  return { left: LEFT_MIN, list: LIST_MIN, detail: DETAIL_MIN };
}

function fitPaneWidths(totalWidth: number, desired: { left: number; list: number; detail: number }, viewportWidth: number) {
  const mins = getResponsiveMins(viewportWidth);
  const maxLeft = Math.min(LEFT_MAX, Math.max(mins.left, totalWidth - mins.list - mins.detail - 16));
  let left = clamp(desired.left, mins.left, maxLeft);

  const maxList = Math.min(LIST_MAX, Math.max(mins.list, totalWidth - left - mins.detail - 16));
  let list = clamp(desired.list, mins.list, maxList);

  let detail = totalWidth - left - list - 16;
  if (detail < mins.detail) {
    const shortage = mins.detail - detail;
    const reducibleList = Math.max(0, list - mins.list);
    const listReduction = Math.min(shortage, reducibleList);
    list -= listReduction;
    detail = totalWidth - left - list - 16;
  }

  if (detail < mins.detail) {
    const shortage = mins.detail - detail;
    const reducibleLeft = Math.max(0, left - mins.left);
    const leftReduction = Math.min(shortage, reducibleLeft);
    left -= leftReduction;
    detail = totalWidth - left - list - 16;
  }

  detail = clamp(detail, mins.detail, DETAIL_MAX);
  return { left, list, detail };
}

function formatRowDate(value?: string | null) {
  if (!value) return '';
  return formatDateDMY(value);
}

function formatDetailDate(value?: string | null) {
  if (!value) return '';
  return formatDateTimeDMY(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getMailTab(subject = '', sender = ''): MailTab {
  const value = `${subject} ${sender}`.toLowerCase();
  if (/sale|discount|offer|deal|promo|marketing|hackathon|apply|campus/.test(value)) return 'Promotions';
  if (/linkedin|twitter|facebook|social|network|pinterest/.test(value)) return 'Social';
  if (/security|alert|update|statement|notification|otp|verification/.test(value)) return 'Updates';
  return 'Primary';
}

function getAvatarLabel(name?: string) {
  const parts = String(name || 'Gmail').trim().split(/\s+/);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'GM';
}

function ResizeHandle({
  onMouseDown,
}: {
  onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="group relative hidden w-2 shrink-0 cursor-col-resize bg-transparent md:block"
    >
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[#dadce0] transition-colors group-hover:bg-[#1a73e8]" />
      <div className="absolute left-1/2 top-1/2 h-14 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent group-hover:bg-[#1a73e8]" />
    </div>
  );
}

function TopBar({
  search,
  onSearchChange,
  onRefresh,
  refreshing,
  onOpenUpdates,
  mailProvider,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
  onOpenUpdates: () => void;
  mailProvider: MailProvider;
}) {
  const isOutlook = mailProvider === 'outlook';
  return (
    <header className="flex h-16 items-center gap-4 px-4">
      <button className="rounded-full p-3 text-[#5f6368] hover:bg-[#e8eaed]">
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex min-w-[140px] items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full text-white ${
            isOutlook ? 'bg-[#0f6cbd]' : 'bg-[#ea4335]'
          }`}
        >
          <Mail className="h-5 w-5" />
        </div>
        <div className="text-[30px] font-normal tracking-tight text-[#5f6368]">
          {isOutlook ? 'Outlook' : 'Gmail'}
        </div>
      </div>

      <div className="mx-2 flex flex-1 items-center rounded-full bg-[#eaf1fb] px-4 py-3">
        <Search className="mr-4 h-5 w-5 text-[#5f6368]" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search mail"
          className="w-full bg-transparent text-[16px] text-[#202124] outline-none placeholder:text-[#5f6368]"
        />
        <button className="rounded-full p-2 text-[#5f6368] hover:bg-[#dbe7f6]">
          <Filter className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={onRefresh}
        className="rounded-full p-3 text-[#5f6368] hover:bg-[#e8eaed]"
        title="Refresh"
      >
        <RefreshCcw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
      </button>
      <button
        type="button"
        onClick={onOpenUpdates}
        className="rounded-full p-3 text-[#5f6368] hover:bg-[#e8eaed]"
        title="Updates"
      >
        <Bell className="h-5 w-5" />
      </button>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#c2e7ff] text-sm font-medium text-[#174ea6]">
        <UserCircle2 className="h-6 w-6" />
      </div>
    </header>
  );
}

function InboxFolderFlyout({
  inboxCount,
  active,
  mailProvider,
  gmailConnected,
  outlookConnected,
  onOpenInbox,
  onProviderChange,
}: {
  inboxCount: number;
  active: boolean;
  mailProvider: MailProvider;
  gmailConnected: boolean;
  outlookConnected: boolean;
  onOpenInbox: () => void;
  onProviderChange: (provider: MailProvider) => void;
}) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);

  const clearTimer = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const computePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const estimatedHeight = 112;
    const top = Math.max(8, Math.min(rect.top, window.innerHeight - estimatedHeight - 8));
    setPanelStyle({ top, left: rect.right + 8 });
  }, []);

  const show = () => {
    clearTimer();
    computePosition();
    setOpen(true);
  };

  const hide = () => {
    clearTimer();
    closeTimer.current = window.setTimeout(() => setOpen(false), 140);
  };

  useLayoutEffect(() => {
    if (!open) return;
    computePosition();
  }, [open, computePosition]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => computePosition();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open, computePosition]);

  useEffect(() => () => clearTimer(), []);

  const pickMailbox = (provider: MailProvider) => {
    onProviderChange(provider);
    onOpenInbox();
    setOpen(false);
  };

  const flyoutPanel =
    open && typeof window !== 'undefined' && panelStyle
      ? createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              top: panelStyle.top,
              left: panelStyle.left,
              width: 196,
              zIndex: 80,
            }}
            className="rounded-2xl border border-[#dadce0] bg-white p-1.5 shadow-[0_8px_28px_rgba(32,33,36,0.18)]"
            onMouseEnter={show}
            onMouseLeave={hide}
          >
            <button
              type="button"
              onClick={() => pickMailbox('gmail')}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm ${
                mailProvider === 'gmail' ? 'bg-[#e8f0fe] font-medium text-[#174ea6]' : 'text-[#202124] hover:bg-[#f1f3f4]'
              }`}
            >
              <span className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Gmail
              </span>
              {gmailConnected ? (
                <span className="text-[10px] font-medium text-[#1a73e8]">On</span>
              ) : (
                <span className="text-[10px] text-[#5f6368]">Connect</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => pickMailbox('outlook')}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm ${
                mailProvider === 'outlook' ? 'bg-[#e8f0fe] font-medium text-[#0f6cbd]' : 'text-[#202124] hover:bg-[#f1f3f4]'
              }`}
            >
              <span className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Outlook
              </span>
              {outlookConnected ? (
                <span className="text-[10px] font-medium text-[#0f6cbd]">On</span>
              ) : (
                <span className="text-[10px] text-[#5f6368]">Connect</span>
              )}
            </button>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div ref={triggerRef} className="relative" onMouseEnter={show} onMouseLeave={hide}>
        <button
          type="button"
          onClick={() => {
            onOpenInbox();
            if (open) {
              setOpen(false);
            } else {
              show();
            }
          }}
          className={`flex w-full items-center justify-between rounded-r-full px-4 py-2 text-sm ${
            active || open ? 'bg-[#d3e3fd] font-medium text-[#001d35]' : 'text-[#202124] hover:bg-[#eaebef]'
          }`}
        >
          <span className="flex min-w-0 items-center gap-4">
            <Mail className="h-4 w-4 shrink-0" />
            <span className="min-w-0">
              <span className="block">Inbox</span>
              <span className="block truncate text-[10px] font-medium uppercase tracking-[0.12em] text-[#5f6368]">
                {mailProvider === 'outlook' ? 'Outlook' : 'Gmail'}
              </span>
            </span>
          </span>
          <span className="flex items-center gap-2">
            {inboxCount ? <span className="text-xs font-medium">{inboxCount}</span> : null}
            <ChevronRight className={`h-3.5 w-3.5 text-[#5f6368] ${open ? 'translate-x-0.5' : ''}`} />
          </span>
        </button>
      </div>
      {flyoutPanel}
    </>
  );
}

function LeftRail({
  connectedEmail,
  inboxCount,
  activeFolder,
  onFolderChange,
  onCompose,
  mailProvider,
  gmailConnected,
  outlookConnected,
  onProviderChange,
}: {
  connectedEmail?: string;
  inboxCount: number;
  activeFolder: GmailFolder;
  onFolderChange: (folder: GmailFolder) => void;
  onCompose: () => void;
  mailProvider: MailProvider;
  gmailConnected: boolean;
  outlookConnected: boolean;
  onProviderChange: (provider: MailProvider) => void;
}) {
  const brand = mailProvider === 'outlook' ? 'Outlook' : 'Gmail';
  return (
    <aside className="flex h-full flex-col px-2 pb-4">
      <div className="px-2 py-2">
        <button
          type="button"
          onClick={onCompose}
          className="inline-flex items-center gap-3 rounded-2xl bg-white px-6 py-4 text-sm font-medium text-[#3c4043] shadow-sm hover:shadow"
        >
          <Pencil className="h-5 w-5" />
          Compose
        </button>
      </div>

      <div className="mt-3 space-y-1">
        {LEFT_MENU.map((item) => {
          if (item.folder === 'INBOX') {
            return (
              <InboxFolderFlyout
                key={item.label}
                inboxCount={inboxCount}
                active={activeFolder === 'INBOX'}
                mailProvider={mailProvider}
                gmailConnected={gmailConnected}
                outlookConnected={outlookConnected}
                onOpenInbox={() => onFolderChange('INBOX')}
                onProviderChange={onProviderChange}
              />
            );
          }
          const Icon = item.icon;
          const count = item.folder === activeFolder ? inboxCount : undefined;
          const active = activeFolder === item.folder;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => onFolderChange(item.folder)}
              className={`flex w-full items-center justify-between rounded-r-full px-4 py-2 text-sm ${
                active
                  ? 'bg-[#d3e3fd] font-medium text-[#001d35]'
                  : 'text-[#202124] hover:bg-[#eaebef]'
              }`}
            >
              <span className="flex items-center gap-4">
                <Icon className="h-4 w-4" />
                {item.label}
              </span>
              {count ? <span className="text-xs font-medium">{count}</span> : null}
            </button>
          );
        })}
      </div>

      <div className="mt-6 px-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5f6368]">Labels</p>
          <button className="text-lg text-[#5f6368]">+</button>
        </div>
        <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-[#5f6368] shadow-sm">
          Connected as
          <div className="mt-2 truncate font-medium text-[#202124]">{connectedEmail || `No ${brand} linked`}</div>
          {mailProvider === 'outlook' && connectedEmail ? (
            <div className="mt-1 text-[11px] leading-4 text-[#5f6368]">
              Microsoft / Outlook account
              {/@gmail\.com$/i.test(connectedEmail)
                ? ' — this is the Microsoft login, not the Gmail inbox.'
                : ''}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-auto px-4">
        <div className="rounded-2xl bg-white px-4 py-3 text-xs text-[#5f6368] shadow-sm">
          {brand} sync is powered by your connected {mailProvider === 'outlook' ? 'Microsoft' : 'Google'} account.
        </div>
      </div>
    </aside>
  );
}

function MailTabs({
  counts,
  activeTab,
  onTabChange,
}: {
  counts: Record<MailTab, number>;
  activeTab: MailTab;
  onTabChange: (tab: MailTab) => void;
}) {
  const tabs: Array<{ key: MailTab; icon: React.ReactNode }> = [
    { key: 'Primary', icon: <Mail className="h-4 w-4" /> },
    { key: 'Promotions', icon: <Tag className="h-4 w-4" /> },
    { key: 'Social', icon: <UserCircle2 className="h-4 w-4" /> },
    { key: 'Updates', icon: <Circle className="h-4 w-4" /> },
  ];

  return (
    <div className="overflow-x-auto border-b border-[#dadce0]">
      <div className="flex min-w-max">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`flex min-w-[180px] items-center gap-3 border-b-2 px-4 py-4 text-sm ${
              activeTab === tab.key
                ? 'border-[#1a73e8] text-[#1a73e8]'
                : 'border-transparent text-[#5f6368] hover:bg-[#f1f3f4]'
            }`}
          >
            {tab.icon}
            <span>{tab.key}</span>
            {counts[tab.key] ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  activeTab === tab.key ? 'bg-[#e8f0fe] text-[#1a73e8]' : 'bg-[#e8eaed] text-[#5f6368]'
                }`}
              >
                {counts[tab.key]}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function MailList({
  emails,
  selectedId,
  onSelect,
  loading,
  onLoadMore,
  hasMore,
  loadingMore,
  requiresReconnect,
  mailProvider,
  needsConnect,
  mailboxUnavailable,
  loadError,
}: {
  emails: GmailInboxMessage[];
  selectedId?: string;
  onSelect: (email: GmailInboxMessage) => void;
  loading: boolean;
  onLoadMore: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  requiresReconnect: boolean;
  mailProvider: MailProvider;
  needsConnect: boolean;
  mailboxUnavailable?: boolean;
  loadError?: string;
}) {
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const remaining = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (remaining < 180 && hasMore && !loadingMore && !loading) {
      onLoadMore();
    }
  };

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) {
          onLoadMore();
        }
      },
      {
        root: node.parentElement,
        rootMargin: '160px',
        threshold: 0.01,
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, onLoadMore, emails.length]);

  return (
    <div
      onScroll={handleScroll}
      className="h-0 min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]"
    >
      {loading ? (
        <div className="space-y-2 p-3">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="h-12 animate-pulse rounded-lg bg-[#f1f3f4]" />
          ))}
        </div>
      ) : needsConnect ? (
        <div className="p-6">
          <div className="rounded-2xl border border-[#dadce0] bg-white p-6 text-center">
            <div
              className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full text-white ${
                mailProvider === 'outlook' ? 'bg-[#0f6cbd]' : 'bg-[#ea4335]'
              }`}
            >
              <Mail className="h-6 w-6" />
            </div>
            <p className="mt-4 text-base font-medium text-[#202124]">
              Connect {mailProvider === 'outlook' ? 'Outlook' : 'Gmail'}
            </p>
            <p className="mt-2 text-sm leading-6 text-[#5f6368]">
              Sign in with your {mailProvider === 'outlook' ? 'Microsoft / Outlook' : 'Google'} account to
              load this mailbox here.
            </p>
            <button
              type="button"
              onClick={() =>
                void apiConnectIntegration(
                  mailProvider === 'outlook' ? 'outlook' : 'gmail',
                  `${window.location.origin}/inbox`
                )
              }
              className="mt-5 rounded-full bg-[#c2e7ff] px-4 py-2 text-sm font-medium text-[#001d35] hover:bg-[#b3e0ff]"
            >
              Connect {mailProvider === 'outlook' ? 'Outlook' : 'Gmail'}
            </button>
          </div>
        </div>
      ) : requiresReconnect ? (
        <div className="p-6">
          <div className="rounded-2xl border border-[#dadce0] bg-[#fff8e1] p-4 text-sm text-[#5f6368]">
            <p className="font-medium text-[#202124]">
              Reconnect {mailProvider === 'outlook' ? 'Outlook' : 'Gmail'} to read inbox messages
            </p>
            <p className="mt-2 leading-6">
              Your current {mailProvider === 'outlook' ? 'Microsoft' : 'Google'} connection does not
              include inbox-read permission yet.
            </p>
            <button
              type="button"
              onClick={() =>
                void apiConnectIntegration(
                  mailProvider === 'outlook' ? 'outlook' : 'gmail',
                  `${window.location.origin}/inbox`
                )
              }
              className="mt-4 rounded-full bg-[#c2e7ff] px-4 py-2 text-sm font-medium text-[#001d35] hover:bg-[#b3e0ff]"
            >
              Reconnect {mailProvider === 'outlook' ? 'Outlook' : 'Gmail'}
            </button>
          </div>
        </div>
      ) : mailboxUnavailable ? (
        <div className="p-6">
          <div className="rounded-2xl border border-[#dadce0] bg-white p-6 text-center">
            <p className="text-base font-medium text-[#202124]">No Outlook mailbox on this account</p>
            <p className="mt-2 text-sm leading-6 text-[#5f6368]">
              Microsoft is connected, but this login does not have Outlook.com or Microsoft 365 mail.
              Reconnect Outlook with an Outlook or work mail account.
            </p>
            <button
              type="button"
              onClick={() =>
                void apiConnectIntegration('outlook', `${window.location.origin}/inbox`)
              }
              className="mt-5 rounded-full bg-[#c2e7ff] px-4 py-2 text-sm font-medium text-[#001d35] hover:bg-[#b3e0ff]"
            >
              Reconnect Outlook
            </button>
          </div>
        </div>
      ) : loadError ? (
        <div className="p-6">
          <div className="rounded-2xl border border-[#dadce0] bg-[#fff8e1] p-6 text-center">
            <p className="text-base font-medium text-[#202124]">
              Could not load {mailProvider === 'outlook' ? 'Outlook' : 'Gmail'} mail
            </p>
            <p className="mt-2 text-sm leading-6 text-[#5f6368]">{loadError}</p>
            <button
              type="button"
              onClick={() =>
                void apiConnectIntegration(
                  mailProvider === 'outlook' ? 'outlook' : 'gmail',
                  `${window.location.origin}/inbox`
                )
              }
              className="mt-5 rounded-full bg-[#c2e7ff] px-4 py-2 text-sm font-medium text-[#001d35] hover:bg-[#b3e0ff]"
            >
              Reconnect {mailProvider === 'outlook' ? 'Outlook' : 'Gmail'}
            </button>
          </div>
        </div>
      ) : emails.length === 0 ? (
        <div className="p-10 text-center text-sm text-[#5f6368]">
          {mailProvider === 'outlook'
            ? 'No Outlook messages in this folder.'
            : 'No messages found in this tab.'}
        </div>
      ) : (
        emails.map((email) => {
          const selected = selectedId === email.id;
          return (
            <button
              key={email.id}
              onClick={() => onSelect(email)}
              className={`grid w-full min-w-0 grid-cols-[24px_24px_minmax(110px,0.9fr)_minmax(0,2.1fr)_70px] items-center gap-3 border-b border-[#f1f3f4] px-4 py-2 text-left text-sm ${
                selected ? 'bg-[#e8f0fe]' : email.unread ? 'bg-white font-semibold' : 'bg-white hover:shadow-sm'
              }`}
            >
              <span className="h-4 w-4 rounded border border-[#9aa0a6]" />
              <Star className={`h-4 w-4 ${email.starred ? 'fill-[#fbbc04] text-[#fbbc04]' : 'text-[#9aa0a6]'}`} />
              <span className="truncate text-[#202124]">{email.sender}</span>
              <span className="truncate text-[#5f6368]">
                <span className="text-[#202124]">{email.subject}</span>
                {email.preview ? <span> - {email.preview}</span> : null}
              </span>
              <span className="justify-self-end text-xs text-[#5f6368]">{formatRowDate(email.timestamp)}</span>
            </button>
          );
        })
      )}

      {loadingMore ? (
        <div className="p-3">
          <div className="h-10 animate-pulse rounded-lg bg-[#f1f3f4]" />
        </div>
      ) : null}

      <div ref={loadMoreRef} className="h-2 w-full" />
    </div>
  );
}

function MailDetail({
  email,
  connectedEmail,
  actionBusy,
  actionMessage,
  onCreateCalendar,
  onTrash,
  onArchive,
  onToggleUnread,
  onToggleStar,
  onReply,
  onReplyAll,
  onDownload,
}: {
  email: GmailInboxMessage | null;
  connectedEmail?: string;
  actionBusy?: string | null;
  actionMessage?: string;
  onCreateCalendar: (email: GmailInboxMessage) => void;
  onTrash: (email: GmailInboxMessage) => void;
  onArchive: (email: GmailInboxMessage) => void;
  onToggleUnread: (email: GmailInboxMessage) => void;
  onToggleStar: (email: GmailInboxMessage) => void;
  onReply: (email: GmailInboxMessage) => void;
  onReplyAll: (email: GmailInboxMessage) => void;
  onDownload: (email: GmailInboxMessage) => void;
}) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  useEffect(() => {
    setShowMoreMenu(false);
  }, [email?.id]);

  if (!email) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-[#5f6368]">
        <Mail className="h-10 w-10" />
        <p className="mt-3 text-sm">Select a message to read it here.</p>
      </div>
    );
  }

  const hasRenderableHtml = !!email.htmlBody && /<[^>]+>/.test(email.htmlBody);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#dadce0] px-6 py-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[28px] font-normal text-[#202124]">{email.subject}</h2>
          <div className="relative flex items-center gap-1 text-[#5f6368]">
            <button
              type="button"
              disabled={actionBusy === 'calendar'}
              onClick={() => onCreateCalendar(email)}
              className="rounded-full p-2 hover:bg-[#f1f3f4] disabled:cursor-not-allowed disabled:opacity-50"
              title="Create calendar event"
            >
              <CalendarDays className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={actionBusy === 'trash'}
              onClick={() => onTrash(email)}
              className="rounded-full p-2 hover:bg-[#f1f3f4] disabled:cursor-not-allowed disabled:opacity-50"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowMoreMenu((current) => !current)}
              className="rounded-full p-2 hover:bg-[#f1f3f4]"
              title="More"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {showMoreMenu ? (
              <div className="absolute right-0 top-11 z-20 w-52 rounded-2xl border border-[#dadce0] bg-white p-2 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onArchive(email);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-[#202124] hover:bg-[#f1f3f4]"
                >
                  <Archive className="h-4 w-4" />
                  Archive
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onToggleUnread(email);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-[#202124] hover:bg-[#f1f3f4]"
                >
                  <Mail className="h-4 w-4" />
                  {email.unread ? 'Mark as read' : 'Mark as unread'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onToggleStar(email);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-[#202124] hover:bg-[#f1f3f4]"
                >
                  <Star className="h-4 w-4" />
                  {email.starred ? 'Remove star' : 'Add star'}
                </button>
              </div>
            ) : null}
          </div>
        </div>
        {actionMessage ? (
          <div className="mb-4 rounded-2xl bg-[#e8f0fe] px-4 py-2 text-sm text-[#174ea6]">{actionMessage}</div>
        ) : null}

        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1a73e8] text-sm font-medium text-white">
            {getAvatarLabel(email.sender)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#202124]">
                  {email.sender}{' '}
                  <span className="font-normal text-[#5f6368]">
                    {email.email ? `<${email.email}>` : ''}
                  </span>
                </p>
                <p className="mt-1 text-xs text-[#5f6368]">
                  to {email.to || connectedEmail || 'me'} <ChevronDown className="ml-1 inline h-3 w-3" />
                </p>
              </div>
              <p className="whitespace-nowrap text-xs text-[#5f6368]">{formatDetailDate(email.timestamp)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        {hasRenderableHtml ? (
          <iframe
            title={`mail-message-${email.id}`}
            srcDoc={email.htmlBody}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            className="h-full min-h-[520px] w-full rounded-xl border border-[#dadce0] bg-white"
          />
        ) : (
          <div className="whitespace-pre-wrap text-[14px] leading-7 text-[#202124]">
            {email.body || email.preview}
          </div>
        )}

        {email.hasAttachment ? (
          <div className="mt-8 rounded-2xl border border-[#dadce0] bg-[#f8f9fa] p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#202124]">
              <Paperclip className="h-4 w-4 text-[#5f6368]" />
              Attachments
            </div>
            <p className="text-xs text-[#5f6368]">This message includes attachment data from the mailbox.</p>
          </div>
        ) : null}
      </div>

      <div className="border-t border-[#dadce0] px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onReply(email)}
            className="inline-flex items-center gap-2 rounded-full border border-[#dadce0] px-4 py-2 text-sm text-[#202124] hover:bg-[#f1f3f4]"
          >
            <Reply className="h-4 w-4" />
            Reply
          </button>
          <button
            type="button"
            onClick={() => onReplyAll(email)}
            className="inline-flex items-center gap-2 rounded-full border border-[#dadce0] px-4 py-2 text-sm text-[#202124] hover:bg-[#f1f3f4]"
          >
            <ReplyAll className="h-4 w-4" />
            Reply all
          </button>
          <button
            type="button"
            onClick={() => onDownload(email)}
            className="inline-flex items-center gap-2 rounded-full border border-[#dadce0] px-4 py-2 text-sm text-[#202124] hover:bg-[#f1f3f4]"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InboxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [mailProvider, setMailProvider] = useState<MailProvider>('gmail');
  const [gmailConnected, setGmailConnected] = useState(false);
  const [outlookConnected, setOutlookConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState('');
  const [outlookEmail, setOutlookEmail] = useState('');
  const [statusReady, setStatusReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState('');
  const [mailboxUnavailable, setMailboxUnavailable] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [emails, setEmails] = useState<GmailInboxMessage[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [requiresReconnect, setRequiresReconnect] = useState(false);
  const [detailActionBusy, setDetailActionBusy] = useState<string | null>(null);
  const [detailActionMessage, setDetailActionMessage] = useState('');
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [activeFolder, setActiveFolder] = useState<GmailFolder>('INBOX');
  const [activeTab, setActiveTab] = useState<MailTab>('Primary');
  const [leftWidth, setLeftWidth] = useState(280);
  const [listWidth, setListWidth] = useState(760);
  const [detailWidth, setDetailWidth] = useState(520);
  const [resizing, setResizing] = useState<ResizeSection>(null);
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1440);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const applyInboxResult = (result: Awaited<ReturnType<typeof apiGetGmailInbox>>) => {
    const nextEmails = result?.messages || [];
    setConnected(!!result?.connected);
    setConnectedEmail(result?.email || '');
    setEmails(nextEmails);
    setNextPageToken(result?.nextPageToken || null);
    setRequiresReconnect(!!result?.requiresReconnect);
    setMailboxUnavailable(!!result?.mailboxUnavailable);
    setLoadError('');
    setSelectedId((current) =>
      current && nextEmails.some((item) => item.id === current) ? current : nextEmails[0]?.id
    );
  };

  const loadInbox = async (
    query?: string,
    folder: GmailFolder = activeFolder,
    provider: MailProvider = mailProvider
  ) => {
    if (
      (provider === 'outlook' && !outlookConnected) ||
      (provider === 'gmail' && !gmailConnected)
    ) {
      setConnected(false);
      setConnectedEmail(provider === 'outlook' ? outlookEmail : gmailEmail);
      setEmails([]);
      setNextPageToken(null);
      setRequiresReconnect(false);
      setMailboxUnavailable(false);
      setLoadError('');
      setSelectedId(undefined);
      return;
    }
    const params = {
      q: query || undefined,
      maxResults: 25,
      labelId: folder,
    };
    const result =
      provider === 'outlook' ? await apiGetOutlookInbox(params) : await apiGetGmailInbox(params);
    applyInboxResult(result);
  };

  const loadMoreInbox = async () => {
    if (!nextPageToken || loadingMore) return;
    try {
      setLoadingMore(true);
      const params = {
        q: search || undefined,
        maxResults: 25,
        pageToken: nextPageToken,
        labelId: activeFolder,
      };
      const result =
        mailProvider === 'outlook' ? await apiGetOutlookInbox(params) : await apiGetGmailInbox(params);
      const moreEmails = result?.messages || [];
      setRequiresReconnect(!!result?.requiresReconnect);
      setEmails((current) => {
        const existingIds = new Set(current.map((item) => item.id));
        const deduped = moreEmails.filter((item) => !existingIds.has(item.id));
        return [...current, ...deduped];
      });
      setNextPageToken(result?.nextPageToken || null);
    } finally {
      setLoadingMore(false);
    }
  };

  const chooseProvider = (
    gmailOn: boolean,
    outlookOn: boolean,
    preferred?: MailProvider | null
  ): MailProvider => {
    if (preferred === 'outlook' || preferred === 'gmail') return preferred;
    if (outlookOn && !gmailOn) return 'outlook';
    return 'gmail';
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const gmailJustConnected = params.get('gmail_connected') === '1';
    const outlookJustConnected = params.get('outlook_connected') === '1';
    if (gmailJustConnected || outlookJustConnected) {
      const email = params.get('email');
      console.info(
        `[inbox] ${outlookJustConnected ? 'Outlook' : 'Gmail'} connected${email ? ` as ${email}` : ''}`
      );
      window.history.replaceState(
        {},
        '',
        `/inbox?mailbox=${outlookJustConnected ? 'outlook' : 'gmail'}`
      );
    }

    let active = true;
    void (async () => {
      try {
        const status = await apiGetMailboxStatus();
        if (!active) return;
        const gmailOn = !!status?.gmail?.connected;
        const outlookOn = !!status?.outlook?.connected;
        setGmailConnected(gmailOn);
        setOutlookConnected(outlookOn);
        setGmailEmail(status?.gmail?.email || '');
        setOutlookEmail(status?.outlook?.email || '');
        const mailboxParam = params.get('mailbox');
        const mailboxFromUrl =
          mailboxParam === 'outlook' || mailboxParam === 'gmail' ? mailboxParam : null;
        const stored = window.sessionStorage.getItem(INBOX_PROVIDER_KEY) as MailProvider | null;
        const preferred: MailProvider | null = outlookJustConnected
          ? 'outlook'
          : gmailJustConnected
            ? 'gmail'
            : mailboxFromUrl
              ? mailboxFromUrl
              : stored === 'outlook' || stored === 'gmail'
                ? stored
                : null;
        const nextProvider = chooseProvider(gmailOn, outlookOn, preferred);
        setMailProvider(nextProvider);
        window.sessionStorage.setItem(INBOX_PROVIDER_KEY, nextProvider);
      } catch {
        if (active) {
          setGmailConnected(false);
          setOutlookConnected(false);
        }
      } finally {
        if (active) setStatusReady(true);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const mailbox = searchParams.get('mailbox');
    if (mailbox !== 'gmail' && mailbox !== 'outlook') return;
    setMailProvider((current) => {
      if (current === mailbox) return current;
      window.sessionStorage.setItem(INBOX_PROVIDER_KEY, mailbox);
      setConnectedEmail(mailbox === 'outlook' ? outlookEmail : gmailEmail);
      setEmails([]);
      setSelectedId(undefined);
      setNextPageToken(null);
      setDetailActionMessage('');
      setMailboxUnavailable(false);
      setLoadError('');
      setLoading(true);
      return mailbox;
    });
  }, [searchParams]);

  useEffect(() => {
    if (!statusReady) return;
    let active = true;
    const delay = search.trim() ? 350 : 0;
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          await loadInbox(search, activeFolder, mailProvider);
          if (active) setLoadError('');
        } catch (error: any) {
          if (active) {
            const authFailed = /invalid credentials|unauthenticated|authError|401/i.test(
              String(error?.message || '')
            );
            setConnected(mailProvider === 'outlook' ? outlookConnected : gmailConnected);
            setEmails([]);
            setMailboxUnavailable(false);
            setConnectedEmail(mailProvider === 'outlook' ? outlookEmail : gmailEmail);
            if (authFailed) {
              setRequiresReconnect(true);
              setLoadError('');
            } else {
              setRequiresReconnect(false);
              setLoadError(
                error?.message || `Could not load ${mailProvider === 'outlook' ? 'Outlook' : 'Gmail'} mail`
              );
            }
          }
        } finally {
          if (active) setLoading(false);
        }
      })();
    }, delay);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [search, activeFolder, mailProvider, statusReady, gmailConnected, outlookConnected]);

  // Reusable auto-refresh — re-fetch the active folder while visible/on focus.
  usePageAutoRefresh(() => {
    if (!loading && statusReady) {
      void loadInbox(search, activeFolder, mailProvider).catch((error: any) => {
        const authFailed = /invalid credentials|unauthenticated|authError|401/i.test(
          String(error?.message || '')
        );
        if (authFailed) setRequiresReconnect(true);
      });
    }
  }, { events: ['jobportal:inbox-changed'] });

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (event: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const total = rect.width;

      if (resizing === 'left') {
        const nextLeft = clamp(event.clientX - rect.left, LEFT_MIN, LEFT_MAX);
        const maxListAllowed = total - nextLeft - detailWidth - 40;
        const nextList = clamp(listWidth, LIST_MIN, Math.max(LIST_MIN, Math.min(LIST_MAX, maxListAllowed)));
        setLeftWidth(nextLeft);
        setListWidth(nextList);
      }

      if (resizing === 'middle') {
        const xFromContainer = event.clientX - rect.left;
        const nextList = clamp(xFromContainer - leftWidth - 4, LIST_MIN, LIST_MAX);
        const remainingDetail = total - leftWidth - nextList - 16;
        if (remainingDetail >= DETAIL_MIN) {
          setListWidth(nextList);
          setDetailWidth(clamp(remainingDetail, DETAIL_MIN, DETAIL_MAX));
        }
      }
    };

    const handleMouseUp = () => setResizing(null);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizing, leftWidth, listWidth, detailWidth]);

  useEffect(() => {
    const handleWindowResize = () => {
      setViewportWidth(window.innerWidth);
      const container = containerRef.current;
      if (!container) return;
      const next = fitPaneWidths(
        container.getBoundingClientRect().width,
        { left: leftWidth, list: listWidth, detail: detailWidth },
        window.innerWidth
      );
      setLeftWidth(next.left);
      setListWidth(next.list);
      setDetailWidth(next.detail);
    };

    handleWindowResize();
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [leftWidth, listWidth, detailWidth]);

  const grouped = useMemo(() => {
    const data: Record<MailTab, GmailInboxMessage[]> = {
      Primary: [],
      Promotions: [],
      Social: [],
      Updates: [],
    };
    for (const email of emails) {
      data[getMailTab(email.subject, email.sender)].push(email);
    }
    return data;
  }, [emails]);

  const filteredEmails =
    mailProvider === 'outlook' || activeFolder !== 'INBOX' ? emails : grouped[activeTab];

  const selectedEmail = useMemo(
    () => filteredEmails.find((item) => item.id === selectedId) || filteredEmails[0] || null,
    [filteredEmails, selectedId]
  );

  useEffect(() => {
    const messageId = selectedEmail?.id;
    if (!messageId) return;
    const alreadyHasBody = Boolean(selectedEmail.htmlBody || (selectedEmail.body && selectedEmail.body !== selectedEmail.preview));
    if (alreadyHasBody) return;

    let cancelled = false;
    void (async () => {
      try {
        const full =
          mailProvider === 'outlook'
            ? await apiGetOutlookMessage(messageId)
            : await apiGetGmailMessage(messageId);
        if (cancelled || !full) return;
        setEmails((current) =>
          current.map((item) => (item.id === full.id ? { ...item, ...full } : item))
        );
      } catch {
        // Keep the list preview if the full message cannot be loaded.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedEmail?.id, selectedEmail?.htmlBody, selectedEmail?.body, selectedEmail?.preview, mailProvider]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setLoadError('');
      await loadInbox(search, activeFolder);
    } catch (error: any) {
      const authFailed = /invalid credentials|unauthenticated|authError|401/i.test(
        String(error?.message || '')
      );
      if (authFailed) {
        setRequiresReconnect(true);
        setLoadError('');
      } else {
        setLoadError(error?.message || 'Could not refresh mail');
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleCompose = () => {
    const url =
      mailProvider === 'outlook'
        ? 'https://outlook.office.com/mail/deeplink/compose'
        : 'https://mail.google.com/mail/u/0/#inbox?compose=new';
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleProviderChange = (provider: MailProvider) => {
    if (provider !== mailProvider) {
      setMailProvider(provider);
      window.sessionStorage.setItem(INBOX_PROVIDER_KEY, provider);
      setConnectedEmail(provider === 'outlook' ? outlookEmail : gmailEmail);
      setEmails([]);
      setSelectedId(undefined);
      setNextPageToken(null);
      setDetailActionMessage('');
      setMailboxUnavailable(false);
      setLoadError('');
      setLoading(true);
    }
    router.replace(`/inbox?mailbox=${provider}`, { scroll: false });
  };

  const handleFolderChange = (folder: GmailFolder) => {
    setActiveFolder(folder);
    setActiveTab('Primary');
    setSelectedId(undefined);
    setDetailActionMessage('');
  };

  const handleOpenUpdates = () => {
    setActiveFolder('INBOX');
    setActiveTab('Updates');
  };

  const handleSelect = (email: GmailInboxMessage) => {
    setDetailActionMessage('');
    setSelectedId(email.id);
    if (email.unread) {
      setEmails((current) =>
        current.map((item) => (item.id === email.id ? { ...item, unread: false } : item))
      );
    }
  };

  const updateEmailInState = (messageId: string, patch: Partial<GmailInboxMessage>) => {
    setEmails((current) => current.map((item) => (item.id === messageId ? { ...item, ...patch } : item)));
  };

  const removeEmailFromState = (messageId: string) => {
    setEmails((current) => current.filter((item) => item.id !== messageId));
    setSelectedId((current) => (current === messageId ? undefined : current));
  };

  const buildMailtoLink = (email: GmailInboxMessage, type: 'reply' | 'replyAll') => {
    const recipients = type === 'replyAll' ? (email.to || email.email || '').trim() : (email.email || '').trim();
    const subject = email.subject?.startsWith('Re:') ? email.subject : `Re: ${email.subject || ''}`;
    const body = `\n\n---- Original message ----\nFrom: ${email.sender} <${email.email || ''}>\nDate: ${formatDetailDate(
      email.timestamp
    )}\nSubject: ${email.subject || ''}\n\n${email.body || email.preview || ''}`;
    return `mailto:${encodeURIComponent(recipients)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleReply = (email: GmailInboxMessage) => {
    window.location.href = buildMailtoLink(email, 'reply');
  };

  const handleReplyAll = (email: GmailInboxMessage) => {
    window.location.href = buildMailtoLink(email, 'replyAll');
  };

  const handleDownload = (email: GmailInboxMessage) => {
    const content = email.htmlBody || `<pre>${email.body || email.preview || ''}</pre>`;
    const blob = new Blob([content], { type: email.htmlBody ? 'text/html;charset=utf-8' : 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${(email.subject || 'mail-message').replace(/[^\w.-]+/g, '_')}.${email.htmlBody ? 'html' : 'txt'}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const runDetailAction = async (actionKey: string, task: () => Promise<void>) => {
    try {
      setDetailActionBusy(actionKey);
      setDetailActionMessage('');
      await task();
    } catch (error: any) {
      setDetailActionMessage(error?.message || 'Inbox action failed');
    } finally {
      setDetailActionBusy(null);
    }
  };

  const handleArchive = (email: GmailInboxMessage) =>
    void runDetailAction('archive', async () => {
      await (mailProvider === 'outlook'
        ? apiArchiveOutlookMessage(email.id)
        : apiArchiveGmailMessage(email.id));
      removeEmailFromState(email.id);
      setDetailActionMessage('Email archived.');
    });

  const handleTrash = (email: GmailInboxMessage) =>
    void runDetailAction('trash', async () => {
      await (mailProvider === 'outlook'
        ? apiTrashOutlookMessage(email.id)
        : apiTrashGmailMessage(email.id));
      removeEmailFromState(email.id);
      setDetailActionMessage('Email moved to trash.');
    });

  const handleToggleUnread = (email: GmailInboxMessage) =>
    void runDetailAction('flags', async () => {
      const result =
        mailProvider === 'outlook'
          ? await apiUpdateOutlookMessageFlags(email.id, { unread: !email.unread })
          : await apiUpdateGmailMessageFlags(email.id, { unread: !email.unread });
      updateEmailInState(email.id, { unread: !!result.unread });
      setDetailActionMessage(result.unread ? 'Marked as unread.' : 'Marked as read.');
    });

  const handleToggleStar = (email: GmailInboxMessage) =>
    void runDetailAction('flags', async () => {
      const result =
        mailProvider === 'outlook'
          ? await apiUpdateOutlookMessageFlags(email.id, { starred: !email.starred })
          : await apiUpdateGmailMessageFlags(email.id, { starred: !email.starred });
      updateEmailInState(email.id, { starred: !!result.starred });
      setDetailActionMessage(result.starred ? 'Star added.' : 'Star removed.');
    });

  const handleCreateCalendar = (email: GmailInboxMessage) =>
    void runDetailAction('calendar', async () => {
      const result =
        mailProvider === 'outlook'
          ? await apiCreateCalendarEventFromOutlookMessage(email.id)
          : await apiCreateCalendarEventFromGmailMessage(email.id);
      setDetailActionMessage('Calendar event created.');
      if (result.eventLink) {
        window.open(result.eventLink, '_blank', 'noopener,noreferrer');
      }
    });

  useEffect(() => {
    if (filteredEmails.length && !filteredEmails.some((item) => item.id === selectedId)) {
      setSelectedId(filteredEmails[0]?.id);
    }
  }, [filteredEmails, selectedId]);

  if (!statusReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f8fc]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#dadce0] border-t-[#1a73e8]" />
      </div>
    );
  }

  return (
    <div className="ph2-page-shell h-[calc(100dvh-3.5rem)] overflow-hidden bg-[#f6f8fc] text-[#202124]">
      <TopBar
        search={search}
        onSearchChange={setSearch}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        onOpenUpdates={handleOpenUpdates}
        mailProvider={mailProvider}
      />

      <div ref={containerRef} className="flex h-[calc(100%-4rem)] overflow-hidden">
        <div style={{ width: leftWidth }} className="relative z-20 shrink-0 overflow-visible">
          <LeftRail
            connectedEmail={connectedEmail}
            inboxCount={emails.length}
            activeFolder={activeFolder}
            onFolderChange={handleFolderChange}
            onCompose={handleCompose}
            mailProvider={mailProvider}
            gmailConnected={gmailConnected}
            outlookConnected={outlookConnected}
            onProviderChange={handleProviderChange}
          />
        </div>

        {viewportWidth >= 768 ? <ResizeHandle onMouseDown={() => setResizing('left')} /> : null}

        <main className="flex min-w-0 flex-1 px-2 pb-4 pr-4">
          <div className="flex min-h-0 flex-1 overflow-hidden rounded-[24px] bg-white shadow-sm">
            <div
              style={{ width: listWidth }}
              className="flex min-h-0 min-w-0 shrink-0 flex-col overflow-hidden border-r border-[#dadce0]"
            >
              <div className="overflow-x-auto px-4 py-3 text-[#5f6368]">
                <div className="flex min-w-max items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="h-5 w-5 rounded border border-[#9aa0a6]" />
                    <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    <MoreVertical className="h-4 w-4" />
                  </div>
                  <div className="text-xs">
                    {filteredEmails.length ? `1-${filteredEmails.length} of ${filteredEmails.length}` : '0 messages'}
                  </div>
                </div>
              </div>

              {activeFolder === 'INBOX' && mailProvider === 'gmail' ? (
                <MailTabs
                  counts={{
                    Primary: grouped.Primary.length,
                    Promotions: grouped.Promotions.length,
                    Social: grouped.Social.length,
                    Updates: grouped.Updates.length,
                  }}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                />
              ) : null}

              <MailList
                emails={filteredEmails}
                selectedId={selectedEmail?.id}
                onSelect={handleSelect}
                loading={loading || refreshing}
                onLoadMore={loadMoreInbox}
                hasMore={!!nextPageToken}
                loadingMore={loadingMore}
                requiresReconnect={requiresReconnect}
                mailProvider={mailProvider}
                mailboxUnavailable={mailboxUnavailable}
                loadError={loadError}
                needsConnect={
                  mailProvider === 'outlook' ? !outlookConnected : !gmailConnected
                }
              />
            </div>

            {viewportWidth >= 768 ? <ResizeHandle onMouseDown={() => setResizing('middle')} /> : null}

            <div style={{ width: detailWidth }} className="min-w-0 flex-1">
              <MailDetail
                email={selectedEmail}
                connectedEmail={connectedEmail}
                actionBusy={detailActionBusy}
                actionMessage={detailActionMessage}
                onCreateCalendar={handleCreateCalendar}
                onTrash={handleTrash}
                onArchive={handleArchive}
                onToggleUnread={handleToggleUnread}
                onToggleStar={handleToggleStar}
                onReply={handleReply}
                onReplyAll={handleReplyAll}
                onDownload={handleDownload}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
