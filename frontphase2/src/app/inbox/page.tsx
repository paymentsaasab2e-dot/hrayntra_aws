'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  Bell,
  CalendarDays,
  ChevronDown,
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
import {
  apiArchiveGmailMessage,
  apiConnectIntegration,
  apiCreateCalendarEventFromGmailMessage,
  apiGetGmailInbox,
  apiTrashGmailMessage,
  apiUpdateGmailMessageFlags,
  type GmailInboxMessage,
} from '../../lib/api';

type MailTab = 'Primary' | 'Promotions' | 'Social' | 'Updates';
type ResizeSection = 'left' | 'middle' | null;
type GmailFolder = 'INBOX' | 'STARRED' | 'SNOOZED' | 'SENT' | 'DRAFT';

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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatDetailDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

function EmptyInboxState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f8fc] p-8">
      <div className="w-full max-w-xl rounded-[28px] border border-[#dadce0] bg-white p-10 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e8f0fe] text-[#1a73e8]">
          <Mail className="h-8 w-8" />
        </div>
        <h2 className="mt-5 text-2xl font-medium text-[#202124]">Connect Gmail to open Inbox</h2>
        <p className="mt-3 text-sm leading-6 text-[#5f6368]">
          Once Gmail is connected from settings, this page will show the real emails from that mailbox
          in a Gmail-style layout.
        </p>
        <button
          type="button"
          onClick={() => void apiConnectIntegration('gmail')}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#c2e7ff] px-5 py-3 text-sm font-medium text-[#001d35] hover:bg-[#b3e0ff]"
        >
          <Mail className="h-4 w-4" />
          Connect Gmail
        </button>
      </div>
    </div>
  );
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
}: {
  search: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
  onOpenUpdates: () => void;
}) {
  return (
    <header className="flex h-16 items-center gap-4 px-4">
      <button className="rounded-full p-3 text-[#5f6368] hover:bg-[#e8eaed]">
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex min-w-[140px] items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ea4335] text-white">
          <Mail className="h-5 w-5" />
        </div>
        <div className="text-[30px] font-normal tracking-tight text-[#5f6368]">Gmail</div>
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

function LeftRail({
  connectedEmail,
  inboxCount,
  activeFolder,
  onFolderChange,
  onCompose,
}: {
  connectedEmail?: string;
  inboxCount: number;
  activeFolder: GmailFolder;
  onFolderChange: (folder: GmailFolder) => void;
  onCompose: () => void;
}) {
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
          <div className="mt-2 truncate font-medium text-[#202124]">{connectedEmail || 'No Gmail linked'}</div>
        </div>
      </div>

      <div className="mt-auto px-4">
        <div className="rounded-2xl bg-white px-4 py-3 text-xs text-[#5f6368] shadow-sm">
          Gmail sync is powered by your connected Google account.
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
}: {
  emails: GmailInboxMessage[];
  selectedId?: string;
  onSelect: (email: GmailInboxMessage) => void;
  loading: boolean;
  onLoadMore: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  requiresReconnect: boolean;
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
      ) : requiresReconnect ? (
        <div className="p-6">
          <div className="rounded-2xl border border-[#dadce0] bg-[#fff8e1] p-4 text-sm text-[#5f6368]">
            <p className="font-medium text-[#202124]">Reconnect Gmail to read inbox messages</p>
            <p className="mt-2 leading-6">
              Your current Google connection does not include inbox-read permission yet.
            </p>
            <button
              type="button"
              onClick={() => void apiConnectIntegration('gmail')}
              className="mt-4 rounded-full bg-[#c2e7ff] px-4 py-2 text-sm font-medium text-[#001d35] hover:bg-[#b3e0ff]"
            >
              Reconnect Gmail
            </button>
          </div>
        </div>
      ) : emails.length === 0 ? (
        <div className="p-10 text-center text-sm text-[#5f6368]">No messages found in this tab.</div>
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
            title={`gmail-message-${email.id}`}
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
            <p className="text-xs text-[#5f6368]">This message includes attachment data from Gmail.</p>
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [connected, setConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState('');
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

  const loadInbox = async (query?: string, folder: GmailFolder = activeFolder) => {
    const result = await apiGetGmailInbox({
      q: query || undefined,
      maxResults: 100,
      labelId: folder,
    });
    const nextEmails = result?.messages || [];
    setConnected(!!result?.connected);
    setConnectedEmail(result?.email || '');
    setEmails(nextEmails);
    setNextPageToken(result?.nextPageToken || null);
    setRequiresReconnect(!!result?.requiresReconnect);
    setSelectedId((current) =>
      current && nextEmails.some((item) => item.id === current) ? current : nextEmails[0]?.id
    );
  };

  const loadMoreInbox = async () => {
    if (!nextPageToken || loadingMore) return;
    try {
      setLoadingMore(true);
      const result = await apiGetGmailInbox({
        q: search || undefined,
        maxResults: 100,
        pageToken: nextPageToken,
        labelId: activeFolder,
      });
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

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await loadInbox('', activeFolder);
      } catch {
        if (active) {
          setConnected(false);
          setEmails([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!loading) void loadInbox(search, activeFolder);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [search, loading, activeFolder]);

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

  const filteredEmails = activeFolder === 'INBOX' ? grouped[activeTab] : emails;

  const selectedEmail = useMemo(
    () => filteredEmails.find((item) => item.id === selectedId) || filteredEmails[0] || null,
    [filteredEmails, selectedId]
  );

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadInbox(search, activeFolder);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCompose = () => {
    window.open('https://mail.google.com/mail/u/0/#inbox?compose=new', '_blank', 'noopener,noreferrer');
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
    anchor.download = `${(email.subject || 'gmail-message').replace(/[^\w.-]+/g, '_')}.${email.htmlBody ? 'html' : 'txt'}`;
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
      setDetailActionMessage(error?.message || 'Gmail action failed');
    } finally {
      setDetailActionBusy(null);
    }
  };

  const handleArchive = (email: GmailInboxMessage) =>
    void runDetailAction('archive', async () => {
      await apiArchiveGmailMessage(email.id);
      removeEmailFromState(email.id);
      setDetailActionMessage('Email archived.');
    });

  const handleTrash = (email: GmailInboxMessage) =>
    void runDetailAction('trash', async () => {
      await apiTrashGmailMessage(email.id);
      removeEmailFromState(email.id);
      setDetailActionMessage('Email moved to trash.');
    });

  const handleToggleUnread = (email: GmailInboxMessage) =>
    void runDetailAction('flags', async () => {
      const result = await apiUpdateGmailMessageFlags(email.id, { unread: !email.unread });
      updateEmailInState(email.id, { unread: !!result.unread });
      setDetailActionMessage(result.unread ? 'Marked as unread.' : 'Marked as read.');
    });

  const handleToggleStar = (email: GmailInboxMessage) =>
    void runDetailAction('flags', async () => {
      const result = await apiUpdateGmailMessageFlags(email.id, { starred: !email.starred });
      updateEmailInState(email.id, { starred: !!result.starred });
      setDetailActionMessage(result.starred ? 'Star added.' : 'Star removed.');
    });

  const handleCreateCalendar = (email: GmailInboxMessage) =>
    void runDetailAction('calendar', async () => {
      const result = await apiCreateCalendarEventFromGmailMessage(email.id);
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

  if (!loading && !connected) {
    return <EmptyInboxState />;
  }

  return (
    <div className="h-screen overflow-hidden bg-[#f6f8fc] text-[#202124]">
      <TopBar
        search={search}
        onSearchChange={setSearch}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        onOpenUpdates={handleOpenUpdates}
      />

      <div ref={containerRef} className="flex h-[calc(100vh-4rem)] overflow-hidden">
        <div style={{ width: leftWidth }} className="shrink-0 overflow-hidden">
          <LeftRail
            connectedEmail={connectedEmail}
            inboxCount={emails.length}
            activeFolder={activeFolder}
            onFolderChange={handleFolderChange}
            onCompose={handleCompose}
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

              {activeFolder === 'INBOX' ? (
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
