'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImageWithFallback } from '../../components/ImageWithFallback';
import type { Lead } from './types';

/** Distinct, accessible color palette for initials when no avatar image exists. */
const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-fuchsia-500',
  'bg-cyan-500',
  'bg-orange-500',
];

function colorForKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash << 5) - hash + key.charCodeAt(i);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

interface TooltipContent {
  /** Avatar bounding rect at the time of hover — used to anchor the tooltip. */
  rect: DOMRect;
  /** Bold title (usually the team member name). */
  title: string;
  /** Optional secondary line, e.g. email or "Primary". */
  subtitle?: string;
  /** Optional list block (used by the "+N" overflow chip). */
  items?: string[];
  /** Optional small caption above items, e.g. "Also assigned". */
  itemsHeading?: string;
}

interface PortalTooltipProps {
  content: TooltipContent;
}

/** Tooltip rendered into `document.body` so no parent `overflow-hidden` can clip it. */
function PortalTooltip({ content }: PortalTooltipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; arrowLeft: number; placeAbove: boolean }>({
    top: -9999,
    left: -9999,
    arrowLeft: 0,
    placeAbove: true,
  });

  useEffect(() => {
    if (!ref.current) return;
    const tipRect = ref.current.getBoundingClientRect();
    const { rect } = content;
    const margin = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Prefer placing above the avatar; fall back below when near the top edge.
    const spaceAbove = rect.top;
    const placeAbove = spaceAbove >= tipRect.height + margin || rect.bottom + tipRect.height + margin > viewportHeight;

    const anchorCenter = rect.left + rect.width / 2;
    let left = anchorCenter - tipRect.width / 2;
    left = Math.max(margin, Math.min(left, viewportWidth - tipRect.width - margin));
    const arrowLeft = Math.max(12, Math.min(tipRect.width - 12, anchorCenter - left));

    const top = placeAbove ? rect.top - tipRect.height - margin : rect.bottom + margin;

    setPosition({ top, left, arrowLeft, placeAbove });
  }, [content]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      style={{ top: position.top, left: position.left }}
      className="pointer-events-none fixed z-[9999] w-max max-w-[260px] rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
    >
      <div className="leading-tight">{content.title}</div>
      {content.subtitle && (
        <div className="mt-0.5 text-[10px] text-slate-300 leading-tight">{content.subtitle}</div>
      )}
      {content.itemsHeading && (
        <div className="mt-1 text-[10px] uppercase tracking-wider text-slate-300">{content.itemsHeading}</div>
      )}
      {content.items && content.items.length > 0 && (
        <ul className="mt-0.5 space-y-0.5">
          {content.items.map((label, i) => (
            <li key={`${label}-${i}`} className="leading-tight">
              {label}
            </li>
          ))}
        </ul>
      )}
      <span
        aria-hidden
        className={`absolute h-2 w-2 rotate-45 bg-slate-900 ${
          position.placeAbove ? 'top-full -translate-y-1' : 'bottom-full translate-y-1'
        }`}
        style={{ left: position.arrowLeft - 4 }}
      />
    </div>,
    document.body,
  );
}

interface AssigneeChipProps {
  name: string;
  avatar?: string;
  colorKey: string;
  isPrimary?: boolean;
  email?: string;
  onHover: (rect: DOMRect, content: Omit<TooltipContent, 'rect'>) => void;
  onLeave: () => void;
}

function AssigneeChip({ name, avatar, colorKey, isPrimary, email, onHover, onLeave }: AssigneeChipProps) {
  const initials = getInitials(name);
  const colorClass = colorForKey(colorKey || name || 'unknown');
  const ref = useRef<HTMLDivElement>(null);

  const enter = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const subtitleParts: string[] = [];
    if (isPrimary) subtitleParts.push('Primary');
    if (email) subtitleParts.push(email);
    onHover(rect, { title: name, subtitle: subtitleParts.join(' · ') || undefined });
  }, [name, email, isPrimary, onHover]);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={enter}
      onMouseLeave={onLeave}
      onFocus={enter}
      onBlur={onLeave}
      tabIndex={0}
    >
      {avatar ? (
        <ImageWithFallback
          src={avatar}
          alt={name}
          className="h-8 w-8 rounded-full object-cover ring-2 ring-white shadow-md shadow-slate-300/30 bg-slate-100"
        />
      ) : (
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-white shadow-md shadow-slate-300/30 ${colorClass}`}
          aria-label={name}
        >
          {initials}
        </div>
      )}
      {isPrimary && (
        <span
          className="pointer-events-none absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-blue-500 ring-2 ring-white"
          aria-hidden
        />
      )}
    </div>
  );
}

interface AssigneeAvatarsProps {
  lead: Lead;
  /** Max avatars shown before the "+N" overflow chip. Default 3. */
  maxVisible?: number;
}

/**
 * Avatar-only renderer for the leads table "Assigned To" cell.
 *
 * - Up to `maxVisible` overlapping avatar chips, then a `+N` chip.
 * - Hovering any chip shows a single portal-based tooltip with that member's
 *   name (and email/Primary marker). Moving to another chip swaps the tooltip
 *   atomically — only one tooltip is ever visible.
 * - Portal rendering escapes the table's `overflow-hidden` clipping.
 */
export function AssigneeAvatars({ lead, maxVisible = 3 }: AssigneeAvatarsProps) {
  const [tooltip, setTooltip] = useState<TooltipContent | null>(null);

  const showTooltip = useCallback((rect: DOMRect, content: Omit<TooltipContent, 'rect'>) => {
    setTooltip({ rect, ...content });
  }, []);

  const hideTooltip = useCallback(() => setTooltip(null), []);

  const overflowRef = useRef<HTMLDivElement>(null);
  const unassignedRef = useRef<HTMLDivElement>(null);

  const assignees =
    Array.isArray(lead.assignedToUsers) && lead.assignedToUsers.length > 0
      ? lead.assignedToUsers
      : lead.assignedTo?.name && lead.assignedTo.name !== 'Unassigned'
        ? [{ id: lead.assignedToId, name: lead.assignedTo.name, avatar: lead.assignedTo.avatar || '', email: undefined as string | undefined }]
        : [];

  if (assignees.length === 0) {
    return (
      <>
        <div
          ref={unassignedRef}
          className="inline-flex"
          onMouseEnter={() => {
            if (!unassignedRef.current) return;
            showTooltip(unassignedRef.current.getBoundingClientRect(), { title: 'Unassigned' });
          }}
          onMouseLeave={hideTooltip}
        >
          <div className="h-8 w-8 rounded-full bg-slate-100 ring-2 ring-white shadow-md flex items-center justify-center text-slate-400 text-[11px] font-semibold">
            —
          </div>
        </div>
        {tooltip && <PortalTooltip content={tooltip} />}
      </>
    );
  }

  const visible = assignees.slice(0, maxVisible);
  const hidden = assignees.slice(maxVisible);

  return (
    <>
      <div className="flex -space-x-2">
        {visible.map((user, idx) => (
          <AssigneeChip
            key={user.id || `${user.name}-${idx}`}
            name={user.name}
            avatar={user.avatar}
            email={user.email}
            colorKey={user.id || user.name}
            isPrimary={idx === 0}
            onHover={showTooltip}
            onLeave={hideTooltip}
          />
        ))}
        {hidden.length > 0 && (
          <div
            ref={overflowRef}
            className="relative"
            tabIndex={0}
            onMouseEnter={() => {
              if (!overflowRef.current) return;
              showTooltip(overflowRef.current.getBoundingClientRect(), {
                title: `${hidden.length} more assignee${hidden.length === 1 ? '' : 's'}`,
                itemsHeading: 'Also assigned',
                items: hidden.map((u) => u.name),
              });
            }}
            onMouseLeave={hideTooltip}
            onFocus={() => {
              if (!overflowRef.current) return;
              showTooltip(overflowRef.current.getBoundingClientRect(), {
                title: `${hidden.length} more assignee${hidden.length === 1 ? '' : 's'}`,
                itemsHeading: 'Also assigned',
                items: hidden.map((u) => u.name),
              });
            }}
            onBlur={hideTooltip}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-700 ring-2 ring-white shadow-md shadow-slate-300/30">
              +{hidden.length}
            </div>
          </div>
        )}
      </div>
      {tooltip && <PortalTooltip content={tooltip} />}
    </>
  );
}
