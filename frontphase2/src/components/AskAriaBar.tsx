'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useAiCoinGate } from './coins/AiCoinGate';
import { apiRunKnownAriaCommand, apiUndoKnownAriaCommand } from '../lib/api';

export const ARIA_COMMAND_EVENT = 'hryantra-aria-command';
const UNDO_KEY = 'hryantra-aria-undo';

type UndoPayload = { available: boolean; actionId: string; expiresAt: string; label: string };

export function dispatchAriaCommand(text: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ARIA_COMMAND_EVENT, { detail: { text } }));
}

function readUndo(): UndoPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(UNDO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UndoPayload;
    if (!parsed?.actionId || !parsed.expiresAt) return null;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      sessionStorage.removeItem(UNDO_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** One command line for the screen the user is on. A known command does the work. */
export function AskAriaBar() {
  const gate = useAiCoinGate('ai.assistant_chat');
  const [text, setText] = useState('');
  const [undo, setUndo] = useState<UndoPayload | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setUndo(readUndo());
  }, []);

  const submit = async () => {
    const command = text.trim();
    if (!command || busy) return;
    if (gate.locked) {
      const unlocked = await gate.confirmAndUnlock();
      if (!unlocked) return;
    }
    setBusy(true);
    try {
      const res = await apiRunKnownAriaCommand(command);
      const data = res.data;
      if (data?.matched) {
        setText('');
        if (data.ok && data.undoPayload?.available) {
          sessionStorage.setItem(UNDO_KEY, JSON.stringify(data.undoPayload));
          setUndo(data.undoPayload);
        }
        if (data.ok) {
          toast.success(data.summary || 'Done');
          window.setTimeout(() => window.location.reload(), 400);
        } else {
          toast.error(data.summary || 'Could not run that command');
        }
        return;
      }
    } catch (error: any) {
      const message = String(error?.message || '');
      if (message.toLowerCase().includes('coin')) {
        toast.error(message);
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    dispatchAriaCommand(command);
    setText('');
  };

  const undoLast = async () => {
    if (!undo?.actionId || busy) return;
    setBusy(true);
    try {
      await apiUndoKnownAriaCommand(undo.actionId);
      sessionStorage.removeItem(UNDO_KEY);
      setUndo(null);
      toast.success('Undone');
      window.setTimeout(() => window.location.reload(), 300);
    } catch (error: any) {
      toast.error(error?.message || 'Undo failed');
      setBusy(false);
    }
  };

  const costLabel = gate.cost > 0 ? `${gate.cost} coins` : 'Included';

  return (
    <form
      className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white px-3 py-2 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Sparkles className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
      <label className="sr-only" htmlFor="ask-aria">
        Ask ARIA to do this
      </label>
      <input
        id="ask-aria"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Ask ARIA — punch a name, approve leave, lock this month, run payroll"
        className="h-9 min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
      />
      <span className="shrink-0 text-[11px] font-semibold text-slate-500" title="Charged only when ARIA runs a known command or opens chat">
        {costLabel}
      </span>
      {undo ? (
        <button
          type="button"
          onClick={() => void undoLast()}
          className="h-9 shrink-0 rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-700"
        >
          Undo
        </button>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="h-9 shrink-0 rounded-full bg-[#101b35] px-3 text-xs font-semibold text-white disabled:opacity-60"
      >
        Run
      </button>
    </form>
  );
}
