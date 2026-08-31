'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import {
  getSuperAdminWorkScope,
  setSuperAdminWorkScope,
  SUPER_ADMIN_WORK_SCOPE_EVENT,
  type SuperAdminWorkScope,
} from '@/lib/org/superAdminWorkScope';

type Props = {
  variant?: 'header' | 'light';
};

const OPTIONS: Array<{ id: SuperAdminWorkScope; label: string; hint: string }> = [
  { id: 'own', label: 'Own', hint: 'Only your leads, clients, jobs, and candidates' },
  { id: 'all', label: 'All company', hint: 'Everything in this tenant' },
];

/**
 * Super Admin work-scope: Own (personal pipeline) vs All company.
 */
export function SuperAdminWorkSwitcher({ variant = 'light' }: Props) {
  const { isSuperAdmin } = usePermissions();
  const [scope, setScope] = useState<SuperAdminWorkScope>('all');
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => setScope(getSuperAdminWorkScope());
    sync();
    window.addEventListener(SUPER_ADMIN_WORK_SCOPE_EVENT, sync);
    return () => window.removeEventListener(SUPER_ADMIN_WORK_SCOPE_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !btnRef.current) {
      setMenuPos(null);
      return;
    }
    const place = () => {
      const rect = btnRef.current!.getBoundingClientRect();
      const width = Math.max(rect.width, 200);
      let left = rect.left;
      if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
      setMenuPos({ top: rect.bottom + 6, left, width });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  if (!isSuperAdmin()) return null;

  const dark = variant === 'header';
  const selected = OPTIONS.find((o) => o.id === scope) || OPTIONS[1];

  const pick = (id: SuperAdminWorkScope) => {
    setOpen(false);
    setSuperAdminWorkScope(id);
  };

  const menu =
    open && menuPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label="Work scope"
            className="fixed z-[200] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
            style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
          >
            {OPTIONS.map((option) => {
              const on = scope === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => pick(option.id)}
                  className={`flex w-full flex-col px-3 py-2.5 text-left ${
                    on ? 'bg-sky-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className={`text-[13px] font-semibold ${on ? 'text-sky-900' : 'text-slate-800'}`}>
                    {option.label}
                  </span>
                  <span className="text-[11px] text-slate-500">{option.hint}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={selected.hint}
        className={
          dark
            ? 'inline-flex h-9 max-w-[180px] items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 text-[12px] font-medium text-slate-100 hover:bg-white/10'
            : 'inline-flex h-9 max-w-[180px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50'
        }
      >
        <span className="min-w-0 truncate">{selected.label}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 opacity-70 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {menu}
    </>
  );
}
