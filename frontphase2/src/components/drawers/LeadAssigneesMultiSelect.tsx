'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, Users } from 'lucide-react';
import type { TeamMember } from '../../types/team';

/** Role chip background classes — mirrors the existing palette used elsewhere. */
const ROLE_COLOR_MAP: Record<string, string> = {
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  purple: 'bg-purple-100 text-purple-700',
  pink: 'bg-pink-100 text-pink-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  orange: 'bg-orange-100 text-orange-700',
  gray: 'bg-gray-100 text-gray-700',
};

const MENU_MAX_HEIGHT = 288;
const MENU_GAP = 6;

function initials(first?: string, last?: string): string {
  return `${(first?.[0] ?? '').toUpperCase()}${(last?.[0] ?? '').toUpperCase()}` || '?';
}

function colorForMember(member: TeamMember): string {
  const m = member as TeamMember & { systemRole?: TeamMember['role'] };
  const colorKey = (m.role?.color || m.systemRole?.color || '').toLowerCase();
  return ROLE_COLOR_MAP[colorKey] || ROLE_COLOR_MAP.gray;
}

type MenuPlacement = 'top' | 'bottom';

type MenuPosition = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  placement: MenuPlacement;
};

export interface LeadAssigneesMultiSelectProps {
  members: TeamMember[];
  /** Selected user ids — first id is treated as the primary owner. */
  value: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Optional id used to label the dropdown for screen readers. */
  ariaLabel?: string;
  className?: string;
}

/**
 * Multi-select dropdown for assigning a lead to several team members.
 * - Closes on outside click / Esc.
 * - Renders selected users as removable chips above the trigger.
 * - First chip is annotated as "Primary" so users understand the ordering
 *   used by RBAC and downstream conversions (lead → client owner).
 */
export function LeadAssigneesMultiSelect({
  members,
  value,
  onChange,
  loading = false,
  disabled = false,
  placeholder = 'Select team members',
  ariaLabel = 'Assigned team members',
  className = '',
}: LeadAssigneesMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const memberById = useMemo(() => {
    const m = new Map<string, TeamMember>();
    for (const member of members) m.set(member.id, member);
    return m;
  }, [members]);

  const selected = useMemo(
    () => value.map((id) => memberById.get(id)).filter(Boolean) as TeamMember[],
    [value, memberById],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
                return members.filter((m) => {
      const haystack = `${m.firstName ?? ''} ${m.lastName ?? ''} ${m.email ?? ''} ${m.role?.roleName ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [members, query]);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward = spaceBelow < MENU_MAX_HEIGHT + MENU_GAP && spaceAbove > spaceBelow;

    if (openUpward) {
      setMenuPosition({
        left: rect.left,
        width: rect.width,
        bottom: window.innerHeight - rect.top + MENU_GAP,
        placement: 'top',
      });
      return;
    }

    setMenuPosition({
      left: rect.left,
      width: rect.width,
      top: rect.bottom + MENU_GAP,
      placement: 'bottom',
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setMenuPosition(null);
      setQuery('');
      return;
    }

    updateMenuPosition();
    const onReposition = () => updateMenuPosition();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escHandler);
    };
  }, []);

  const toggle = (id: string) => {
    if (disabled) return;
    if (value.includes(id)) onChange(value.filter((existing) => existing !== id));
    else onChange([...value, id]);
  };

  const removeChip = (id: string) => {
    if (disabled) return;
    onChange(value.filter((existing) => existing !== id));
  };

  const menu =
    open && menuPosition && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label={ariaLabel}
            className="fixed z-[80] flex max-h-72 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
            style={{
              left: menuPosition.left,
              width: menuPosition.width,
              ...(menuPosition.placement === 'top'
                ? { bottom: menuPosition.bottom }
                : { top: menuPosition.top }),
            }}
          >
            <div className="border-b border-slate-100 px-3 py-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search team members…"
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto py-1">
              {loading && (
                <li className="px-4 py-3 text-xs text-slate-500">Loading team members…</li>
              )}
              {!loading && filtered.length === 0 && (
                <li className="px-4 py-3 text-xs text-slate-500">No team members match your search.</li>
              )}
              {!loading &&
                filtered.map((member) => {
                  const checked = value.includes(member.id);
                  return (
                    <li key={member.id}>
                      <button
                        type="button"
                        onClick={() => toggle(member.id)}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${checked ? 'bg-blue-50/60' : ''}`}
                      >
                        <span className="flex h-4 w-4 items-center justify-center rounded border border-slate-300 bg-white">
                          {checked && <span className="block h-2 w-2 rounded-sm bg-blue-600" />}
                        </span>
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${colorForMember(member)}`}
                        >
                          {initials(member.firstName, member.lastName)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-slate-900">
                            {member.firstName} {member.lastName}
                          </span>
                          <span className="block truncate text-[11px] text-slate-500">
                            {[member.role?.roleName, member.email].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
            </ul>
            {value.length > 0 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
                <span>{value.length} selected · first row is Primary</span>
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="font-medium text-rose-600 hover:text-rose-700"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((member, idx) => (
            <span
              key={member.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-1 pl-1 pr-2 text-xs text-slate-700"
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${colorForMember(member)}`}
              >
                {initials(member.firstName, member.lastName)}
              </span>
              <span className="font-medium">
                {member.firstName} {member.lastName}
              </span>
              {idx === 0 && (
                <span className="text-[9px] font-semibold uppercase tracking-wider text-blue-700">
                  Primary
                </span>
              )}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeChip(member.id)}
                  className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  aria-label={`Remove ${member.firstName} ${member.lastName}`}
                >
                  <X size={11} strokeWidth={2.5} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || loading}
        aria-label={ariaLabel}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left text-sm text-slate-700 hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="flex items-center gap-2 text-slate-600">
          <Users size={14} className="shrink-0 text-slate-400" />
          {selected.length > 0 ? (
            <span className="font-medium text-slate-900">
              {selected.length} {selected.length === 1 ? 'member selected' : 'members selected'}
            </span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={`text-slate-400 transition-transform ${open ? (menuPosition?.placement === 'top' ? '' : 'rotate-180') : ''}`}
        />
      </button>

      {menu}
    </div>
  );
}
