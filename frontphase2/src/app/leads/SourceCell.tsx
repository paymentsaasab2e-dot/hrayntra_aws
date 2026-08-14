'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Globe, Linkedin, Mail, Users, Megaphone, Link2 } from 'lucide-react';
import type { Lead, LeadSource } from './types';

/** Light visual style per source — keeps existing violet for fallback. */
const SOURCE_STYLES: Record<LeadSource, { className: string; Icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }> }> = {
  Website: {
    className: 'text-blue-700 bg-gradient-to-r from-blue-50 to-sky-50/80 border-blue-100 hover:from-blue-100 hover:to-sky-100',
    Icon: Globe,
  },
  LinkedIn: {
    className: 'text-sky-700 bg-gradient-to-r from-sky-50 to-blue-50/80 border-sky-100 hover:from-sky-100 hover:to-blue-100',
    Icon: Linkedin,
  },
  Email: {
    className: 'text-emerald-700 bg-gradient-to-r from-emerald-50 to-teal-50/80 border-emerald-100 hover:from-emerald-100 hover:to-teal-100',
    Icon: Mail,
  },
  Referral: {
    className: 'text-amber-700 bg-gradient-to-r from-amber-50 to-orange-50/80 border-amber-100 hover:from-amber-100 hover:to-orange-100',
    Icon: Users,
  },
  Campaign: {
    className: 'text-fuchsia-700 bg-gradient-to-r from-fuchsia-50 to-pink-50/80 border-fuchsia-100 hover:from-fuchsia-100 hover:to-pink-100',
    Icon: Megaphone,
  },
};

/** Ensure a URL has a scheme so window.open / mailto behave correctly. */
function normalizeUrl(value: string | undefined | null, kind: 'http' | 'mailto'): string | null {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) return null;
  if (kind === 'mailto') {
    return v.startsWith('mailto:') ? v : `mailto:${v}`;
  }
  if (/^https?:\/\//i.test(v)) return v;
  if (/^mailto:/i.test(v)) return v;
  return `https://${v.replace(/^\/+/, '')}`;
}

interface SourceTarget {
  /** Final href (http(s):// or mailto:). */
  href: string | null;
  /** Should it open in a new tab? mailto stays in same tab. */
  newTab: boolean;
  /** Optional human-readable tooltip subtitle (e.g. resolved url or email). */
  detail?: string;
  /** Optional emphasized tooltip title (e.g. referral name). */
  title?: string;
}

function resolveTarget(lead: Lead): SourceTarget {
  switch (lead.source) {
    case 'Website': {
      const href = normalizeUrl(lead.sourceWebsiteUrl || lead.website, 'http');
      return { href, newTab: true, detail: href || undefined };
    }
    case 'LinkedIn': {
      const href = normalizeUrl(lead.sourceLinkedInUrl || lead.linkedIn, 'http');
      return { href, newTab: true, detail: href || undefined };
    }
    case 'Email': {
      const email = (lead.sourceEmail || lead.email || '').trim();
      const href = normalizeUrl(email, 'mailto');
      return { href, newTab: false, detail: email || undefined };
    }
    case 'Referral': {
      // Referrals don't navigate — they only describe who referred the lead.
      return { href: null, newTab: false, title: lead.referralName || undefined, detail: lead.referralName ? 'Referred by' : 'No referral name recorded' };
    }
    case 'Campaign': {
      const href = normalizeUrl(lead.campaignLink, 'http');
      return { href, newTab: true, title: lead.campaignName || undefined, detail: href || undefined };
    }
    default:
      return { href: null, newTab: false };
  }
}

interface TooltipState {
  rect: DOMRect;
  title: string;
  subtitle?: string;
}

function SourceTooltip({ state }: { state: TooltipState }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: -9999, left: -9999, arrowLeft: 0, above: true });

  useEffect(() => {
    if (!ref.current) return;
    const tip = ref.current.getBoundingClientRect();
    const { rect } = state;
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const above = rect.top >= tip.height + margin || rect.bottom + tip.height + margin > vh;
    const anchor = rect.left + rect.width / 2;
    let left = anchor - tip.width / 2;
    left = Math.max(margin, Math.min(left, vw - tip.width - margin));
    const arrowLeft = Math.max(12, Math.min(tip.width - 12, anchor - left));
    const top = above ? rect.top - tip.height - margin : rect.bottom + margin;
    setPos({ top, left, arrowLeft, above });
  }, [state]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      style={{ top: pos.top, left: pos.left }}
      className="pointer-events-none fixed z-[9999] w-max max-w-[300px] rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
    >
      <div className="leading-tight">{state.title}</div>
      {state.subtitle && (
        <div className="mt-0.5 text-[10px] text-slate-300 leading-tight break-all">{state.subtitle}</div>
      )}
      <span
        aria-hidden
        className={`absolute h-2 w-2 rotate-45 bg-slate-900 ${pos.above ? 'top-full -translate-y-1' : 'bottom-full translate-y-1'}`}
        style={{ left: pos.arrowLeft - 4 }}
      />
    </div>,
    document.body,
  );
}

interface SourceCellProps {
  lead: Lead;
}

/**
 * Renders the lead Source tag.
 *
 * - **Website** / **LinkedIn** / **Campaign**: clickable; opens link in a new tab.
 * - **Email**: opens the user's mail client (`mailto:`) with the lead's email.
 * - **Referral**: not clickable, but shows a tooltip on hover with the referrer name.
 * - Stops row click propagation so opening the link doesn't also open the row drawer.
 */
export function SourceCell({ lead }: SourceCellProps) {
  const raw = lead.source;
  const addedBy = String(
    lead.addedByName ||
      (lead.campaignName === 'Public intake form'
        ? lead.auditMeta?.createdBy?.name || lead.referralName || ''
        : '')
  ).trim();
  const isValid =
    raw != null &&
    raw !== '' &&
    (['Website', 'LinkedIn', 'Email', 'Referral', 'Campaign'] as const).includes(raw as LeadSource);

  if (!isValid && !addedBy) {
    return <span className="inline-block min-h-[1.25rem] min-w-[1px]" aria-hidden="true" />;
  }

  const source = (isValid ? raw : 'Referral') as LeadSource;
  const leadForTarget = { ...lead, source };
  const displayLabel = addedBy || source;

  const personStyle = {
    className:
      'text-indigo-700 bg-gradient-to-r from-indigo-50 to-violet-50/80 border-indigo-100 hover:from-indigo-100 hover:to-violet-100',
    Icon: Users,
  };
  const style = addedBy ? personStyle : SOURCE_STYLES[source] ?? {
    className: 'text-violet-800 bg-gradient-to-r from-violet-50 to-fuchsia-50/80 border-violet-100',
    Icon: ExternalLink,
  };
  const { Icon } = style;

  const target = addedBy
    ? { href: null, newTab: false, title: addedBy, detail: 'Filled the lead form' }
    : resolveTarget(leadForTarget);
  const interactive = addedBy ? true : Boolean(target.href) || source === 'Referral';

  const wrapperRef = useRef<HTMLSpanElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const showTip = useCallback(() => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    // Compose a friendly tooltip per source.
    if (addedBy) {
      setTooltip({
        rect,
        title: `Added by ${addedBy}`,
        subtitle: source !== addedBy ? source : undefined,
      });
      return;
    }
    if (source === 'Referral') {
      setTooltip({
        rect,
        title: target.title ? `Referred by ${target.title}` : 'Referral',
        subtitle: target.title ? undefined : 'No referral name recorded',
      });
      return;
    }
    if (!target.href) {
      setTooltip({ rect, title: source, subtitle: 'No link recorded' });
      return;
    }
    const titleByKind: Record<string, string> = {
      Website: 'Open website',
      LinkedIn: 'Open LinkedIn profile',
      Email: 'Compose email',
      Campaign: target.title ? `Open campaign — ${target.title}` : 'Open campaign',
    };
    setTooltip({
      rect,
      title: titleByKind[source] || source,
      subtitle: target.detail,
    });
  }, [addedBy, source, target.href, target.title, target.detail]);

  const hideTip = useCallback(() => setTooltip(null), []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!target.href) return;
      if (target.newTab) {
        window.open(target.href, '_blank', 'noopener,noreferrer');
      } else {
        window.location.href = target.href;
      }
    },
    [target.href, target.newTab],
  );

  const baseClass = `inline-flex items-center gap-1.5 text-xs font-semibold border w-fit px-2.5 py-1.5 rounded-xl shadow-sm transition-colors ${style.className}`;
  const interactiveClass = interactive ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30' : 'cursor-default';

  return (
    <>
      <span
        ref={wrapperRef}
        role={target.href ? 'link' : 'note'}
        tabIndex={interactive ? 0 : -1}
        onClick={handleClick}
        onMouseEnter={showTip}
        onMouseLeave={hideTip}
        onFocus={showTip}
        onBlur={hideTip}
        onKeyDown={(e) => {
          if (!target.href) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            if (target.newTab) window.open(target.href, '_blank', 'noopener,noreferrer');
            else window.location.href = target.href;
          }
        }}
        className={`${baseClass} ${interactiveClass}`}
        aria-label={
          addedBy
            ? `Added by ${addedBy}`
            : source === 'Referral'
            ? target.title
              ? `Referred by ${target.title}`
              : 'Referral'
            : target.href
              ? `${source} — opens in new tab`
              : source
        }
      >
        <Icon size={13} className="shrink-0" strokeWidth={2.35} />
        {displayLabel}
        {target.href && target.newTab && (
          <Link2 size={11} className="shrink-0 opacity-70" strokeWidth={2.35} />
        )}
      </span>
      {tooltip && <SourceTooltip state={tooltip} />}
    </>
  );
}
