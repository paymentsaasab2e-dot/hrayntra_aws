'use client';

import Image from 'next/image';
import { AnimatePresence, motion } from 'motion/react';
import { Eraser, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AssistantChatPanel, type UiChatMessage } from './AssistantChatPanel';

const STORAGE_KEY = 'floating-bot-position';
const SIZE = 72;
const MARGIN = 16;
/** Pixels moved before we treat the gesture as a drag (not a tap to open). */
const TAP_MAX_MOVE_PX = 10;

/** Public file: `public/image-removebg-preview (18).png` */
const BOT_IMAGE_SRC = `/${encodeURIComponent('image-removebg-preview (18).png')}`;

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
  const [mounted, setMounted] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<UiChatMessage[]>([]);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const hasDraggedRef = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { x?: number; y?: number };
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
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const persist = useCallback((x: number, y: number) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ x, y }));
    } catch {
      /* ignore */
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      hasDraggedRef.current = false;
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        originX: pos.x,
        originY: pos.y,
      };
    },
    [pos.x, pos.y]
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current || e.pointerId !== dragRef.current.pointerId) return;
    const dx = e.clientX - dragRef.current.startClientX;
    const dy = e.clientY - dragRef.current.startClientY;
    if (Math.hypot(dx, dy) > TAP_MAX_MOVE_PX) {
      hasDraggedRef.current = true;
    }
    const maxX = window.innerWidth - SIZE - MARGIN;
    const maxY = window.innerHeight - SIZE - MARGIN;
    const nextX = clamp(dragRef.current.originX + dx, MARGIN, maxX);
    const nextY = clamp(dragRef.current.originY + dy, MARGIN, maxY);
    setPos({ x: nextX, y: nextY });
  }, []);

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const active = dragRef.current && e.pointerId === dragRef.current.pointerId;
      setDragging(false);
      if (!active) return;

      const wasTap = !hasDraggedRef.current;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      dragRef.current = null;
      setPos((p) => {
        persist(p.x, p.y);
        return p;
      });
      if (wasTap) {
        setDrawerOpen(true);
      }
    },
    [persist]
  );

  useEffect(() => {
    const onResize = () => {
      setPos((p) => ({
        x: clamp(p.x, MARGIN, window.innerWidth - SIZE - MARGIN),
        y: clamp(p.y, MARGIN, window.innerHeight - SIZE - MARGIN),
      }));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!mounted) return null;

  return (
    <>
      <AnimatePresence>
        {drawerOpen ? (
          <>
            <motion.div
              key="bot-drawer-backdrop"
              role="presentation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[10000] bg-slate-900/50"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              key="bot-drawer-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="floating-bot-drawer-title"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="fixed right-0 top-0 z-[10001] flex h-full min-h-0 w-full max-w-md flex-col bg-white shadow-2xl"
              onClick={(ev) => ev.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-orange-400 bg-orange-500 p-1">
                    <Image
                      src={BOT_IMAGE_SRC}
                      alt=""
                      width={40}
                      height={40}
                      className="h-full w-full rounded-full object-cover"
                      draggable={false}
                    />
                  </span>
                  <div>
                    <h2 id="floating-bot-drawer-title" className="text-lg font-semibold text-slate-900">
                      AI Assistant
                    </h2>
                    <p className="text-sm text-slate-500">Chat with your recruiting copilot</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {chatMessages.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setChatMessages([])}
                      className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                      title="Clear conversation"
                      aria-label="Clear conversation"
                    >
                      <Eraser className="size-5" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                    aria-label="Close assistant"
                  >
                    <X className="size-5" />
                  </button>
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col p-5 pt-4">
                <AssistantChatPanel messages={chatMessages} setMessages={setChatMessages} />
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <button
        type="button"
        aria-label="Open assistant — drag to move"
        aria-expanded={drawerOpen}
        title="Tap to open assistant, drag to move"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setDrawerOpen(true);
          }
        }}
        className="fixed z-[9999] box-border touch-none select-none rounded-full border-2 border-orange-400 bg-orange-500 p-1.5 shadow-lg ring-2 ring-orange-200/80 transition-all duration-200 hover:border-blue-400 hover:bg-blue-600 hover:shadow-xl hover:ring-blue-200/80 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-300"
        style={{
          left: pos.x,
          top: pos.y,
          width: SIZE,
          height: SIZE,
          cursor: dragging ? 'grabbing' : 'grab',
        }}
      >
        <span className="relative block h-full w-full overflow-hidden rounded-full">
          <Image
            src={BOT_IMAGE_SRC}
            alt=""
            width={56}
            height={56}
            className="pointer-events-none h-full w-full rounded-full object-cover"
            draggable={false}
            priority={false}
          />
        </span>
      </button>
    </>
  );
}
