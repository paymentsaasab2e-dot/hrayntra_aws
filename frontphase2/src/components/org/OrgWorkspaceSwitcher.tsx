'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { useOrgWorkspace } from '@/lib/org/useOrgWorkspace';

type Props = {
  variant?: 'header' | 'light';
};

/**
 * Company switcher — Super Admin / switch_companies with selected organizations.
 * Custom menu (not native <select>) so “All companies” stays readable in the dark header.
 */
export function OrgWorkspaceSwitcher({ variant = 'light' }: Props) {
  const { orgUnitId, orgUnitName, companies, canSwitchCompanies, purpose, setActiveOrgUnit } =
    useOrgWorkspace();
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
      const width = Math.max(rect.width, 180);
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

  if (!canSwitchCompanies) {
    if (orgUnitName && (purpose === 'company_head' || purpose === 'site_head')) {
      return (
        <span className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] font-medium text-slate-600">
          {orgUnitName}
        </span>
      );
    }
    return null;
  }

  if (!companies.length) return null;

  const dark = variant === 'header';
  const selectedLabel = orgUnitId
    ? companies.find((c) => c.id === orgUnitId)?.name || orgUnitName || 'Company'
    : 'All companies';

  const pick = (id: string, name?: string) => {
    setOpen(false);
    setActiveOrgUnit(id, name);
  };

  const menu =
    open && menuPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label="Companies"
            className="fixed z-[200] max-h-[min(320px,70vh)] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
            style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
          >
            <button
              type="button"
              role="option"
              aria-selected={!orgUnitId}
              onClick={() => pick('')}
              className={`flex w-full items-center px-3 py-2.5 text-left text-[13px] font-medium ${
                !orgUnitId
                  ? 'bg-sky-50 text-sky-900'
                  : 'text-slate-800 hover:bg-slate-50'
              }`}
            >
              All companies
            </button>
            {companies.map((c) => {
              const on = orgUnitId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => pick(c.id, c.name)}
                  className={`flex w-full items-center px-3 py-2.5 text-left text-[13px] font-medium ${
                    on ? 'bg-sky-50 text-sky-900' : 'text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  {c.name}
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
        title={selectedLabel}
        className={
          dark
            ? 'inline-flex h-9 max-w-[240px] items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 text-[12px] font-medium text-slate-100 hover:bg-white/10'
            : 'inline-flex h-9 max-w-[240px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50'
        }
      >
        <span className="min-w-0 truncate">{selectedLabel}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 opacity-70 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {menu}
    </>
  );
}
