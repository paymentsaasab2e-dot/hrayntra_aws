'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, Send, Sparkles, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { usePageDrawerOpen } from '../hooks/usePageDrawerOpen';
import {
  askHrYantraLocalAssistant,
  HRYANTRA_AI_SUGGESTIONS,
  HRYANTRA_AI_WELCOME,
  type HrYantraChatMessage,
} from '../lib/hrYantraLocalAssistant';

const STORAGE_KEY = 'hryantra-ai-floating-position';
const SIZE = 56;
const MARGIN = 16;
const TAP_MAX_MOVE_PX = 10;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function defaultPosition() {
  if (typeof window === 'undefined') return { x: 24, y: 24 };
  // Sit above ARIA (bottom-right) so both floating icons stay visible.
  const gapAboveAria = 52 + 12;
  return {
    x: window.innerWidth - SIZE - MARGIN - 8,
    y: window.innerHeight - SIZE - MARGIN - 24 - gapAboveAria,
  };
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function renderMessageText(content: string) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

export function HrYantraAiFloatingButton() {
  const pathname = usePathname();
  const pageDrawerOpen = usePageDrawerOpen();
  const [mounted, setMounted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<HrYantraChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      createdAt: new Date().toISOString(),
      content: HRYANTRA_AI_WELCOME,
    },
  ]);
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const hasDraggedRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  const hidden =
    !pathname ||
    pathname === '/login' ||
    pathname === '/hq/login' ||
    pathname.startsWith('/apply') ||
    pathname.startsWith('/lead-form');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          setPos({
            x: clamp(parsed.x, MARGIN, window.innerWidth - SIZE - MARGIN),
            y: clamp(parsed.y, MARGIN, window.innerHeight - SIZE - MARGIN),
          });
          setMounted(true);
          return;
        }
      }
    } catch {
      /* ignore */
    }
    setPos(defaultPosition());
    setMounted(true);
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  useEffect(() => {
    if (!pageDrawerOpen || typeof window === 'undefined') return;
    setPos((current) => {
      const centerX = current.x + SIZE / 2;
      if (centerX <= window.innerWidth / 2) return current;
      const next = { x: MARGIN, y: current.y };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [pageDrawerOpen]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy, drawerOpen]);

  const ask = async (prompt: string) => {
    const text = prompt.trim();
    if (!text || busy) return;
    setInput('');
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: 'user', content: text, createdAt: new Date().toISOString() },
    ]);
    setBusy(true);
    try {
      const answer = await askHrYantraLocalAssistant(text, messages);
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: 'assistant', content: answer, createdAt: new Date().toISOString() },
      ]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content: error?.message || 'Something went wrong while reading tenant data.',
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  if (!mounted || hidden) return null;

  return (
    <>
      <AnimatePresence>
        {drawerOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 z-[9998] bg-slate-900/25 backdrop-blur-[2px]"
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {drawerOpen ? (
          <motion.aside
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="fixed bottom-24 right-4 z-[9999] flex h-[min(78vh,700px)] w-[min(94vw,440px)] flex-col overflow-hidden rounded-[1.75rem] border border-sky-100/80 bg-white shadow-[0_28px_80px_-24px_rgba(15,23,42,0.45)] sm:right-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative overflow-hidden border-b border-sky-100/80 px-4 py-4">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(32,152,200,0.16),_transparent_55%),linear-gradient(135deg,#FFF7ED_0%,#FFFFFF_48%,#E8F6FC_100%)]" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-[#2098C8]/20">
                    <Image src="/hryantra-logo.png" alt="HRYantra" width={38} height={38} className="object-contain" />
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#2098C8] text-white shadow-sm">
                      <Sparkles className="h-2.5 w-2.5" />
                    </span>
                  </span>
                  <div>
                    <p className="text-sm font-bold tracking-tight text-slate-900">HRYANTRA Brain</p>
                    <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                      Enterprise intelligence · live tenant · RBAC
                    </p>
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Phase 2 Brain · no OpenAI required
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-full p-2 text-slate-400 transition hover:bg-white/80 hover:text-slate-700"
                  aria-label="Close HRYantra AI"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-slate-50/90 to-white px-4 py-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3.5 py-3 text-sm leading-relaxed shadow-sm ${
                      message.role === 'user'
                        ? 'rounded-br-md bg-[#2098C8] text-white'
                        : message.id === 'welcome'
                          ? 'rounded-bl-md border border-sky-100 bg-white text-slate-700 shadow-[0_8px_24px_-12px_rgba(32,152,200,0.35)]'
                          : 'rounded-bl-md border border-slate-200/80 bg-white text-slate-700'
                    }`}
                  >
                    {renderMessageText(message.content)}
                  </div>
                </div>
              ))}
              {busy ? (
                <div className="inline-flex items-center gap-2 rounded-2xl border border-sky-100 bg-white px-3 py-2 text-xs text-slate-500 shadow-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#2098C8]" />
                  Consulting Enterprise Brain…
                </div>
              ) : null}
            </div>

            <div className="border-t border-slate-100 bg-white/95 px-3 py-3 backdrop-blur">
              <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
                {HRYANTRA_AI_SUGGESTIONS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    disabled={busy}
                    onClick={() => void ask(item.prompt)}
                    className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-[#2098C8]/40 hover:bg-sky-50 hover:text-sky-800 disabled:opacity-50"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void ask(input);
                }}
              >
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  rows={2}
                  placeholder="Ask about pulse, leads, jobs… or type refresh"
                  className="min-h-[44px] flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#2098C8] focus:bg-white focus:ring-4 focus:ring-[#2098C8]/15"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void ask(input);
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#2098C8] text-white shadow-md shadow-[#2098C8]/25 transition hover:bg-[#1A86B3] disabled:opacity-50"
                  aria-label="Send"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </form>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>

      <motion.button
        type="button"
        aria-label="Open HRYantra AI"
        className={`fixed z-[9999] box-border touch-none select-none rounded-full border-2 border-[#2098C8] bg-white p-0.5 shadow-lg ring-2 ring-[#2098C8]/25 transition-colors duration-200 hover:border-[#F08818] hover:ring-[#F08818]/30 focus:outline-none ${
          dragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{ left: pos.x, top: pos.y, width: SIZE, height: SIZE }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          hasDraggedRef.current = false;
          dragRef.current = {
            pointerId: e.pointerId,
            startClientX: e.clientX,
            startClientY: e.clientY,
            originX: pos.x,
            originY: pos.y,
          };
          (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
          setDragging(true);
        }}
        onPointerMove={(e) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== e.pointerId) return;
          const dx = e.clientX - drag.startClientX;
          const dy = e.clientY - drag.startClientY;
          if (Math.hypot(dx, dy) > TAP_MAX_MOVE_PX) hasDraggedRef.current = true;
          const next = {
            x: clamp(drag.originX + dx, MARGIN, window.innerWidth - SIZE - MARGIN),
            y: clamp(drag.originY + dy, MARGIN, window.innerHeight - SIZE - MARGIN),
          };
          setPos(next);
        }}
        onPointerUp={(e) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== e.pointerId) return;
          dragRef.current = null;
          setDragging(false);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
          } catch {
            /* ignore */
          }
          if (!hasDraggedRef.current) setDrawerOpen(true);
        }}
        onPointerCancel={() => {
          dragRef.current = null;
          setDragging(false);
        }}
      >
        <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#E8F6FC] to-white">
          <Image src="/hryantra-logo.png" alt="" width={34} height={34} className="object-contain" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#F08818] text-white shadow-sm">
            <Sparkles className="h-2.5 w-2.5" />
          </span>
        </span>
      </motion.button>
    </>
  );
}
