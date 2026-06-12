'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { HqSecondaryButton } from './hqUi';
import {
  HQ_LEAD_MODULE_OPTIONS,
  HQ_LEAD_STAGE_LABELS,
  type HqLeadRow,
  type HqLeadScore,
  type HqLeadStage,
} from '@/app/hq/leads/hqLeadsData';

const VALUE_CLASS =
  'w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-sm text-slate-800';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-sm font-medium text-slate-800">{children}</p>;
}

function DetailValue({ value, placeholder = '—' }: { value?: string | number | null; placeholder?: string }) {
  const text =
    value === null || value === undefined || String(value).trim() === ''
      ? placeholder
      : String(value);
  return <div className={VALUE_CLASS}>{text}</div>;
}

function ScoreBadge({ score }: { score: HqLeadScore }) {
  if (score === 'Hot') {
    return (
      <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 ring-1 ring-rose-200">
        Hot
      </span>
    );
  }
  if (score === 'Warm') {
    return (
      <span className="inline-flex rounded-full bg-slate-900 px-2.5 py-0.5 text-[11px] font-bold text-white">
        Warm
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
      Cold
    </span>
  );
}

function StageBadge({ stage }: { stage: HqLeadStage }) {
  const label = HQ_LEAD_STAGE_LABELS[stage].toUpperCase();
  const styles: Record<HqLeadStage, string> = {
    new: 'bg-sky-50 text-sky-700 ring-sky-200',
    contacted: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    demo_scheduled: 'bg-violet-50 text-violet-700 ring-violet-200',
    proposal_sent: 'bg-slate-100 text-slate-700 ring-slate-200',
    negotiation: 'bg-amber-50 text-amber-800 ring-amber-200',
    closed_won: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    closed_lost: 'bg-rose-50 text-rose-700 ring-rose-200',
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black tracking-wide ring-1 ${styles[stage]}`}
    >
      {label}
    </span>
  );
}

function formatCreatedAt(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function HqLeadDetailDrawer({
  open,
  lead,
  onClose,
}: {
  open: boolean;
  lead: HqLeadRow | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !lead) return null;

  const selectedModules = new Set(lead.interestedModules ?? []);

  return (
    <div className="fixed inset-0 z-[500]">
      <button
        type="button"
        aria-label="Close lead drawer backdrop"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="hq-lead-detail-title"
        className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 id="hq-lead-detail-title" className="text-2xl font-bold text-slate-900">
              Lead Details
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Full CRM profile for {lead.name} at {lead.company}.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StageBadge stage={lead.stage} />
              <ScoreBadge score={lead.score} />
              <span className="text-xs text-slate-500">Next follow-up: {lead.nextFollowUp}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <FieldLabel>Contact Name</FieldLabel>
              <DetailValue value={lead.name} />
            </div>
            <div>
              <FieldLabel>Company Name</FieldLabel>
              <DetailValue value={lead.company} />
            </div>
            <div>
              <FieldLabel>Email</FieldLabel>
              <DetailValue value={lead.email} />
            </div>
            <div>
              <FieldLabel>Phone</FieldLabel>
              <DetailValue value={lead.phone} />
            </div>
            <div>
              <FieldLabel>Industry</FieldLabel>
              <DetailValue value={lead.industry} />
            </div>
            <div>
              <FieldLabel>Country</FieldLabel>
              <DetailValue value={lead.country} />
            </div>
            <div>
              <FieldLabel>Expected Users</FieldLabel>
              <DetailValue value={lead.users} />
            </div>
            <div>
              <FieldLabel>Estimated Deal Value ($)</FieldLabel>
              <DetailValue
                value={
                  lead.estimatedDealValue !== undefined && lead.estimatedDealValue !== null
                    ? lead.estimatedDealValue.toLocaleString()
                    : undefined
                }
              />
            </div>
            <div>
              <FieldLabel>Lead Owner</FieldLabel>
              <DetailValue value={lead.owner} />
            </div>
            <div>
              <FieldLabel>Lead Source</FieldLabel>
              <DetailValue value={lead.leadSource} />
            </div>
            <div>
              <FieldLabel>Created</FieldLabel>
              <DetailValue value={formatCreatedAt(lead.createdAt)} />
            </div>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-6">
            <FieldLabel>Interested Modules</FieldLabel>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {HQ_LEAD_MODULE_OPTIONS.map((module) => {
                const checked = selectedModules.has(module);
                return (
                  <div
                    key={module}
                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm ${
                      checked
                        ? 'border-slate-300 bg-slate-100 text-slate-900'
                        : 'border-slate-100 bg-slate-50/40 text-slate-400'
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] font-bold ${
                        checked
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-transparent'
                      }`}
                      aria-hidden
                    >
                      ✓
                    </span>
                    {module}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-6">
            <FieldLabel>Initial Notes</FieldLabel>
            <div className={`${VALUE_CLASS} min-h-[100px] whitespace-pre-wrap`}>
              {lead.initialNotes?.trim() ? lead.initialNotes : '—'}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <HqSecondaryButton type="button" onClick={onClose}>
            Close
          </HqSecondaryButton>
        </div>
      </aside>
    </div>
  );
}
