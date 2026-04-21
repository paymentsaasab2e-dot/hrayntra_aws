'use client';

import React, { useEffect, useMemo, useState } from 'react';

function toMessage(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input instanceof Error) return input.message;
  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
}

export function GlobalAlertHost() {
  const [queue, setQueue] = useState<string[]>([]);

  const activeMessage = useMemo(() => queue[0] || null, [queue]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const originalAlert = window.alert;

    window.alert = (message?: unknown) => {
      setQueue((prev) => [...prev, toMessage(message ?? '')]);
    };

    return () => {
      window.alert = originalAlert;
    };
  }, []);

  if (!activeMessage) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <p className="text-sm font-medium text-slate-900 whitespace-pre-wrap">{activeMessage}</p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => setQueue((prev) => prev.slice(1))}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

