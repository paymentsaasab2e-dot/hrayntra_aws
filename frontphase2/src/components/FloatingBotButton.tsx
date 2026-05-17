'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Eraser, MessageSquareText, History, X, PlusCircle } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AssistantChatPanel, type AssistantPromptSuggestion, type UiChatMessage } from './AssistantChatPanel';
import {
  apiDeleteAssistantHistory,
  apiGetAssistantHistory,
  apiSaveAssistantHistory,
  type AssistantActionLogItem,
  type AssistantConversationMemory,
  type AssistantHistoryRecord,
  type AssistantStructuredResponse,
  type AssistantTaskChain,
} from '../lib/api';

const STORAGE_KEY = 'floating-bot-position';
const HISTORY_STORAGE_PREFIX = 'floating-bot-history';
const SIZE = 72;
const MARGIN = 16;
const BUBBLE_WIDTH = 210;
const BUBBLE_HEIGHT = 52;
const BUBBLE_GAP = 10;
const TAP_MAX_MOVE_PX = 10;

/** Public file alias without spaces to avoid Next image parsing issues. */
const BOT_IMAGE_SRC = '/floating-bot.png';

type AssistantPageConfig = {
  key: string;
  match: (pathname: string) => boolean;
  bubbleMessage: string;
  drawerSubtitle: string;
  chatGreeting: string;
  recommendations: AssistantPromptSuggestion[];
};

const ARIA_IDENTITY = {
  name: 'ARIA',
  role: 'AI System Operator',
  icon: '✳️',
};

function getCapabilitiesForPage(pageKey?: string) {
  const common = ['Remember page-wise conversations', 'Track multi-step task chains', 'Suggest next recruiting actions'];
  switch (pageKey) {
    case 'leads': return ['Create and optimize leads from raw details', 'Qualify leads and organize missing business data', 'Prepare lead conversion next steps', 'Generate CSV, Excel, or PDF lead reports', ...common];
    case 'client': return ['Summarize active client data', 'Guide client updates and follow-ups', 'Support client-to-job workflow planning', 'Generate client summary reports', ...common];
    case 'candidate': return ['Review candidate workflow actions', 'Guide stage movement and recruiter assignment', 'Help plan interview or follow-up steps', 'Generate candidate export-style reports', ...common];
    case 'jobs': return ['Create or improve job descriptions', 'Summarize open job activity', 'Guide job update workflows', 'Generate job reports in CSV, Excel, or PDF', ...common];
    case 'pipeline': return ['Explain stage flow and stuck candidates', 'Suggest movement and follow-up actions', 'Help plan pipeline progress', ...common];
    case 'reports': return ['Summarize report insights', 'Prepare downloadable CSV, Excel, or PDF reports', 'Recommend next report actions', ...common];
    case 'interviews': return ['Summarize upcoming interviews', 'Guide scheduling and follow-up workflows', 'Support interview planning and reporting', ...common];
    case 'placements': return ['Summarize placement outcomes', 'Guide joined/failed placement workflows', 'Generate placement reports', ...common];
    case 'tasks': return ['Prioritize pending tasks', 'Guide task execution and completion', 'Resume interrupted workflows', ...common];
    default: return ['Read live ATS data for this page', 'Plan multi-step recruitment workflows', 'Generate CSV, Excel, or PDF reports when supported', ...common];
  }
}

function getPromptSuggestionsForPage(pageKey?: string, fallback: AssistantPromptSuggestion[] = []) {
  switch (pageKey) {
    case 'dashboard':
      return [
        { label: 'Daily KPI Summary', prompt: 'Summarize today\'s dashboard KPIs and explain what matters most.' },
        { label: 'Trend Review', prompt: 'Show me the most important recruiting trends from the dashboard.' },
        { label: 'Next Focus', prompt: 'What should I focus on next from the dashboard?' },
      ];
    case 'leads':
      return [
        { label: 'All Leads Report', prompt: 'Generate report of all leads.' },
        { label: 'Create Lead', prompt: 'Create a lead from raw company details and ask me for any missing required fields before creating it.' },
        { label: 'AI Capabilities', prompt: 'What can the AI do on the leads page?' },
      ];
    case 'jobs':
      return [
        { label: 'All Jobs Report', prompt: 'Generate report of all jobs.' },
        { label: 'Create Job', prompt: 'Create a new job and ask me for any missing required details before creating it.' },
        { label: 'Improve JD', prompt: 'Generate or improve a job description for this page context.' },
        { label: 'AI Capabilities', prompt: 'What can I manage from the jobs page with AI help?' },
      ];
    default: return fallback;
  }
}

const PAGE_ASSISTANT_CONFIGS: AssistantPageConfig[] = [
  {
    key: 'dashboard',
    match: (pathname) => pathname === '/' || pathname === '/dashboard',
    bubbleMessage: 'Can I help with your dashboard, operator?',
    drawerSubtitle: 'ARIA — Dashboard Intelligence',
    chatGreeting: 'I am ARIA ✳️ — Your AI System Operator. You are on the Dashboard. I can summarize KPIs, detect trends, and plan your recruiting focus. Memory is persistent across sessions.',
    recommendations: [
      { label: 'Daily KPI Summary', prompt: 'Summarize today\'s dashboard KPIs and explain what matters most.', description: 'Quick status of the dashboard.' },
      { label: 'Trend Review', prompt: 'Show me the most important recruiting trends from the dashboard.', description: 'Highlight the biggest movements.' },
      { label: 'Next Focus', prompt: 'What should I focus on next from the dashboard?', description: 'Get priority guidance.' },
    ],
  },
  {
    key: 'leads',
    match: (pathname) => pathname === '/leads' || pathname.startsWith('/leads/'),
    bubbleMessage: 'Can I help with leads?',
    drawerSubtitle: 'ARIA — Lead System Operator',
    chatGreeting: 'I am ARIA ✳️ — Monitoring CRM Leads. I can create records, identify missing data, and qualify business opportunities instantly. Ready for bulk or single operations.',
    recommendations: [
      { label: 'Create Lead', prompt: 'Create a lead from company details.', description: 'Fast lead creation.' },
      { label: 'Qualify Leads', prompt: 'Help me qualify leads on this page.', description: 'Review lead quality.' },
    ],
  },
  {
    key: 'tasks',
    match: (pathname) => pathname === '/Task&Activites' || pathname.startsWith('/Task&Activites/'),
    bubbleMessage: 'ARIA is ready for task operations',
    drawerSubtitle: 'ARIA — Task System Operator',
    chatGreeting: 'I am ARIA ✳️ — Monitoring Task & Activities. I can prioritize your backlog, guide execution, and resume interrupted workflows. Memory preserved.',
    recommendations: [
      { label: 'Pending Tasks', prompt: 'Summarize my pending tasks from this page.', description: 'Quick task overview.' },
      { label: 'Prioritize Work', prompt: 'Help me prioritize today\'s work.', description: 'Sort what to do first.' },
    ],
  },
];

function getAssistantPageConfig(pathname: string | null): AssistantPageConfig | null {
  if (!pathname) return null;
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/auth') ||
    pathname === '/login' ||
    pathname === '/hq/login' ||
    pathname === '/reset-password' ||
    pathname === '/hq'
  ) {
    return null;
  }
  return PAGE_ASSISTANT_CONFIGS.find((config) => config.match(pathname)) ?? PAGE_ASSISTANT_CONFIGS[0];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function defaultPosition() {
  if (typeof window === 'undefined') return { x: MARGIN, y: MARGIN };
  return {
    x: clamp(window.innerWidth - SIZE - MARGIN, MARGIN, window.innerWidth - SIZE - MARGIN),
    y: clamp(window.innerHeight - SIZE - MARGIN, MARGIN, window.innerHeight - SIZE - MARGIN),
  };
}

export function FloatingBotButton() {
  const pathname = usePathname();
  const pageConfig = getAssistantPageConfig(pathname);
  const pagePrompts = getPromptSuggestionsForPage(pageConfig?.key, pageConfig?.recommendations || []);
  const [mounted, setMounted] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'history'>('chat');
  const [chatMessages, setChatMessages] = useState<UiChatMessage[]>([]);
  const [showPageBubble, setShowPageBubble] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [selectedPromptToken, setSelectedPromptToken] = useState(0);
  const [conversationMemory, setConversationMemory] = useState<AssistantConversationMemory | null>(null);
  const [taskMemory, setTaskMemory] = useState<{ tasks: AssistantTaskChain[] } | null>(null);
  const [actionLog, setActionLog] = useState<AssistantActionLogItem[]>([]);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ pointerId: number; startClientX: number; startClientY: number; originX: number; originY: number } | null>(null);
  const hasDraggedRef = useRef(false);
  const seededGreetingKeyRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          setPos({ x: clamp(parsed.x, MARGIN, window.innerWidth - SIZE - MARGIN), y: clamp(parsed.y, MARGIN, window.innerHeight - SIZE - MARGIN) });
          setMounted(true);
          return;
        }
      }
    } catch { /* ignore */ }
    setPos(defaultPosition());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  useEffect(() => {
    setDrawerOpen(false);
    setDragging(false);
    setShowPageBubble(false);
  }, [pathname]);

  const handleHistorySync = useCallback((history: AssistantHistoryRecord | null) => {
    if (!history) return;
    if (Array.isArray(history.messages)) setChatMessages(history.messages as UiChatMessage[]);
    if (history.conversationMemory) setConversationMemory(history.conversationMemory);
    if (history.taskMemory) setTaskMemory(history.taskMemory);
    if (history.actionLog) setActionLog(history.actionLog);
  }, []);

  const handleNewChat = async () => {
    setChatMessages([]);
    setConversationMemory(null);
    setTaskMemory(null);
    setActionLog([]);
    seededGreetingKeyRef.current = null;
    if (pageConfig?.key) {
      await apiDeleteAssistantHistory(pageConfig.key).catch(() => {});
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    hasDraggedRef.current = false;
    dragRef.current = { pointerId: e.pointerId, startClientX: e.clientX, startClientY: e.clientY, originX: pos.x, originY: pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    const dx = e.clientX - dragRef.current.startClientX;
    const dy = e.clientY - dragRef.current.startClientY;
    if (!hasDraggedRef.current && Math.sqrt(dx * dx + dy * dy) > TAP_MAX_MOVE_PX) {
      hasDraggedRef.current = true;
      setDragging(true);
    }
    if (hasDraggedRef.current) {
      setPos({ x: clamp(dragRef.current.originX + dx, MARGIN, window.innerWidth - SIZE - MARGIN), y: clamp(dragRef.current.originY + dy, MARGIN, window.innerHeight - SIZE - MARGIN) });
    }
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    if (!hasDraggedRef.current) setDrawerOpen((o) => !o);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
    setDragging(false);
    dragRef.current = null;
  };

  if (!mounted || !pageConfig) return null;

  return (
    <>
      <AnimatePresence>
        {drawerOpen ? (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawerOpen(false)} className="fixed inset-0 z-[9998] bg-slate-900/10 backdrop-blur-[2px]" />
            <motion.aside initial={{ x: 400, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 400, opacity: 0 }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed bottom-4 right-4 z-[9999] flex h-[600px] w-[400px] flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl ring-1 ring-slate-900/5">
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="relative size-10 overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-sm shadow-orange-200">
                    <Image src={BOT_IMAGE_SRC} alt="ARIA" fill className="object-contain p-0.5" sizes="40px" priority={false} unoptimized />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">{ARIA_IDENTITY.name}</h2>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{ARIA_IDENTITY.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={handleNewChat} className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-blue-600" title="New Chat (+)">
                    <PlusCircle className="size-5" />
                  </button>
                  <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800" aria-label="Close assistant">
                    <X className="size-5" />
                  </button>
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col p-5 pt-4">
                <div className="mb-4 inline-flex w-fit rounded-2xl border border-slate-200 bg-slate-50 p-1">
                  <button type="button" onClick={() => setActiveTab('chat')} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === 'chat' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100' : 'text-slate-500 hover:text-slate-800'}`}>
                    <MessageSquareText className="size-4" /> Chat
                  </button>
                  <button type="button" onClick={() => setActiveTab('history')} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === 'history' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100' : 'text-slate-500 hover:text-slate-800'}`}>
                    <History className="size-4" /> History
                  </button>
                </div>
                {activeTab === 'chat' ? (
                  <AssistantChatPanel pageKey={pageConfig?.key} pathname={pathname || undefined} recommendations={pagePrompts} capabilities={getCapabilitiesForPage(pageConfig?.key)} externalPrompt={selectedPrompt} externalPromptToken={selectedPromptToken} messages={chatMessages} setMessages={setChatMessages} onHistorySync={handleHistorySync} />
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80">
                    <div className="border-b border-slate-200 px-4 py-3"><h3 className="text-sm font-semibold text-slate-900">Conversation History</h3><p className="mt-1 text-xs text-slate-500">Saved history for {pageConfig?.key ? `the ${pageConfig.key} page` : 'this page'}.</p></div>
                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                      {chatMessages.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">No saved history yet for this page.</div> : chatMessages.map((m) => (
                        <div key={`history-${m.id}`} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${m.role === 'user' ? 'rounded-tr-sm bg-blue-600 text-white' : 'rounded-tl-sm border border-slate-200 bg-white text-slate-800'}`}>
                            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">{m.role === 'user' ? 'You' : 'ARIA'}</p>
                            <p className="whitespace-pre-wrap break-words">{m.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <button type="button" aria-label="Open assistant" aria-expanded={drawerOpen} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag} className="fixed z-[9999] box-border touch-none select-none rounded-full border-2 border-orange-400 bg-white p-1 shadow-lg ring-2 ring-orange-200/80 transition-all duration-200 hover:border-blue-400 hover:ring-blue-200/80 focus:outline-none" style={{ left: pos.x, top: pos.y, width: SIZE, height: SIZE, cursor: dragging ? 'grabbing' : 'grab' }}>
        <span className="relative block h-full w-full overflow-hidden rounded-full">
          <Image src={BOT_IMAGE_SRC} alt="ARIA floating assistant" fill className="pointer-events-none rounded-full object-contain p-0.5" draggable={false} priority={false} unoptimized />
        </span>
      </button>
    </>
  );
}


