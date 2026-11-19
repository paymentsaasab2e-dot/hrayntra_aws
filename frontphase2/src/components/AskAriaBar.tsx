'use client';

import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';

export const ARIA_COMMAND_EVENT = 'hryantra-aria-command';

export function dispatchAriaCommand(text: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ARIA_COMMAND_EVENT, { detail: { text } }));
}

/** One command line for the screen the user is on. ARIA runs it in the same shell. */
export function AskAriaBar() {
  const [text, setText] = useState('');

  const submit = () => {
    const command = text.trim();
    if (!command) return;
    dispatchAriaCommand(command);
    setText('');
  };

  return (
    <form
      className="mb-3 flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white px-3 py-2 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
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
        placeholder="Ask ARIA — create a lead, move a candidate, punch attendance, lock this month"
        className="h-9 min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
      />
      <button
        type="submit"
        className="h-9 shrink-0 rounded-full bg-[#101b35] px-3 text-xs font-semibold text-white"
      >
        Run
      </button>
    </form>
  );
}
