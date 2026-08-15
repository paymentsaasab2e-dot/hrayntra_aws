'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info, Lock, Minus, Plus, RefreshCw, Sparkles, X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { apiFetch, notifyTenantCoinsChanged } from '@/lib/api';
import { useTenantCoins, isInsufficientCoinsError } from '@/components/coins/TenantCoinsContext';
import { openAiCoinPurchaseModal } from '@/components/coins/AiCoinPurchaseModal';
import { TokenCoinIcon } from '@/components/coins/TokenCoinIcon';
import { RecFillBar, RecSemiGauge } from '@/components/dashboard/recruitment/recViz';
import {
  fetchTenantBehaviorEngine,
  type PeoplePerfProduct,
  type TenantBehaviorEngineReport,
} from '@/lib/tenant-behavior-engine';
import { scorePeopleDesk, teamHealthRows, defaultSop, type PeopleDeskScores, type PeopleSop } from './peopleInsights';

export type PeoplePerfSlot = {
  product: PeoplePerfProduct;
  featureId: string;
  label: string;
  active: boolean;
  expiresAt: string | null;
  coinsCost: number;
  daysLeft: number;
};

const CARD =
  'relative rounded-[1.25rem] border border-slate-100/80 bg-white shadow-[0_14px_40px_-28px_rgba(15,23,42,0.22)]';

const KIND_LABEL: Record<string, string> = {
  health: 'Operating health',
  capacity: 'Utilization',
  follow: 'Completion',
  load: 'Workload',
  next: 'Recommended action',
};

function NumberStepper({
  value,
  onChange,
  min,
  max,
  step,
  digits = 0,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step: number;
  digits?: number;
}) {
  const bump = (dir: -1 | 1) => {
    const next = Math.round((value + dir * step) * 10) / 10;
    onChange(Math.min(max, Math.max(min, next)));
  };
  return (
    <span className="inline-flex h-6 shrink-0 items-stretch overflow-hidden rounded-md border border-slate-200 bg-white">
      <button
        type="button"
        aria-label="Decrease"
        onClick={() => bump(-1)}
        className="flex w-6 items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      >
        <Minus size={11} strokeWidth={2.5} />
      </button>
      <span className={`flex items-center justify-center text-[12px] font-semibold tabular-nums text-slate-800 ${digits > 0 ? 'w-10' : 'w-7'}`}>
        {value.toFixed(digits)}
      </span>
      <button
        type="button"
        aria-label="Increase"
        onClick={() => bump(1)}
        className="flex w-6 items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      >
        <Plus size={11} strokeWidth={2.5} />
      </button>
    </span>
  );
}

async function loadStatus(): Promise<{ crm: PeoplePerfSlot; recruitment: PeoplePerfSlot } | null> {
  const res = await apiFetch<{ crm: PeoplePerfSlot; recruitment: PeoplePerfSlot }>('/settings/org/people-perf', {
    auth: true,
  });
  return res.data || null;
}

async function unlockProduct(product: PeoplePerfProduct) {
  return apiFetch('/settings/org/people-perf/unlock', {
    method: 'POST',
    auth: true,
    body: { product },
  });
}

function HoursChart({ desk }: { desk: PeopleDeskScores }) {
  return (
    <div className="h-[168px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={desk.utilization} barSize={28} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid stroke="#E8EEF4" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} interval={0} />
          <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={28} />
          <Tooltip cursor={{ fill: 'rgba(15,23,42,0.04)' }} contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
          <Bar dataKey="hours" name="Hours" fill="#334155" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TeamChart({ rows }: { rows: ReturnType<typeof teamHealthRows> }) {
  const h = Math.min(200, Math.max(96, rows.length * 40 + 24));
  return (
    <div style={{ height: h }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} barSize={14} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid stroke="#E8EEF4" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={36} />
          <Tooltip cursor={{ fill: 'rgba(15,23,42,0.04)' }} contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
          <Bar dataKey="health" name="Score" fill="#818CF8" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type InsightTopic = 'composite' | 'utilization' | 'completion' | 'hours' | 'team' | 'operating';

function LearnMoreBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="absolute right-3 top-3 z-30 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm hover:bg-slate-50"
    >
      Learn more
    </button>
  );
}

function FormulaTip({ title, lines }: { title: string; lines: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={title}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:border-indigo-200 hover:text-indigo-600"
      >
        <Info size={13} strokeWidth={2.25} />
      </button>
      {open ? (
        <>
          <button type="button" className="fixed inset-0 z-[1]" aria-label="Close formula" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-9 z-[2] w-[280px] rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.45)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{title}</p>
            <ul className="mt-2 space-y-1.5">
              {lines.map((line) => (
                <li key={line} className="text-[12px] leading-snug text-slate-600">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </span>
  );
}

function CardInsightModal({
  topic,
  onClose,
  desk,
  teamRows,
}: {
  topic: InsightTopic | null;
  onClose: () => void;
  desk: PeopleDeskScores;
  teamRows: ReturnType<typeof teamHealthRows>;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!topic) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    const blockBackgroundScroll = (e: WheelEvent | TouchEvent) => {
      const scroll = document.getElementById('people-insight-scroll');
      if (scroll && e.target instanceof Node && scroll.contains(e.target)) return;
      e.preventDefault();
    };
    window.addEventListener('wheel', blockBackgroundScroll, { passive: false, capture: true });
    window.addEventListener('touchmove', blockBackgroundScroll, { passive: false, capture: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      window.removeEventListener('wheel', blockBackgroundScroll, { capture: true });
      window.removeEventListener('touchmove', blockBackgroundScroll, { capture: true });
    };
  }, [topic, onClose]);

  if (!mounted || !topic) return null;

  const insightByKind: Record<InsightTopic, string[]> = {
    composite: ['health'],
    utilization: ['capacity'],
    completion: ['follow'],
    hours: ['capacity'],
    team: ['health'],
    operating: ['load', 'next'],
  };

  const titles: Record<InsightTopic, { kicker: string; title: string; formula: { title: string; lines: string[] } }> = {
    composite: {
      kicker: 'Score',
      title: 'Composite score',
      formula: {
        title: 'How this is calculated',
        lines: [
          'Records updated — of records they opened, how many they changed',
          'Assigned hours — time on assigned work vs the week you set',
          'Work finished — done out of assigned (open + done)',
          'Open workload — how many assigned items are still sitting open',
        ],
      },
    },
    utilization: {
      kicker: 'Time',
      title: 'Utilization',
      formula: {
        title: 'How this is calculated',
        lines: [
          `Assigned hours ÷ (${desk.hoursPerDay}h × ${desk.workdays}d = ${desk.expectedHours}h)`,
          'Only time in selected role modules counts',
          'Dashboard, reports and AI count as admin',
        ],
      },
    },
    completion: {
      kicker: 'Output',
      title: 'Completion rate',
      formula: {
        title: 'How this is calculated',
        lines: ['Updates ÷ views on records', 'Hours are not part of this number', 'Low rate = browsing without moving work'],
      },
    },
    hours: {
      kicker: 'Allocation',
      title: 'Hours vs standard week',
      formula: {
        title: 'What the bars mean',
        lines: [
          'Assigned work — time in role modules',
          'Admin / reports — dashboard, reports, AI',
          `Unused — leftover of the ${desk.expectedHours}h week`,
        ],
      },
    },
    team: {
      kicker: 'Team',
      title: 'Team scores',
      formula: {
        title: 'How to read this',
        lines: ['Same mix for every member: assigned hours, updates, finished work, and what is still open'],
      },
    },
    operating: {
      kicker: 'Standard',
      title: 'Operating standard',
      formula: {
        title: 'How this is calculated',
        lines: [
          'Work finished = done ÷ (still open + done) on assigned records',
          'Open workload = how many assigned items are still in the queue, plus overdue',
          'Toggle modules on the card to change what counts as assigned',
        ],
      },
    },
  };

  const meta = titles[topic];
  const notes = desk.insights.filter((i) => insightByKind[topic].includes(i.kind) && i.kind !== 'next');
  const primary = notes[0];
  const actionText = primary?.action;

  const modal = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-6">
      <button type="button" className="absolute inset-0 bg-slate-900/25 backdrop-blur-[2px]" aria-label="Close" onClick={onClose} />
      <div
        id="people-insight-dialog"
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[90vh] w-full max-w-[880px] flex-col overflow-hidden overscroll-contain rounded-[1.6rem] border border-slate-200/80 bg-white shadow-[0_28px_80px_-28px_rgba(15,23,42,0.4)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{meta.kicker}</p>
              <FormulaTip title={meta.formula.title} lines={meta.formula.lines} />
            </div>
            <h3 className="mt-1 text-[20px] font-semibold tracking-tight text-slate-900">{meta.title}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <div id="people-insight-scroll" className="grid min-h-0 flex-1 overflow-auto overscroll-contain lg:grid-cols-2">
          <div className="bg-slate-50/80 p-5">
            {topic === 'composite' ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-end gap-3">
                    <p className="text-[44px] font-semibold leading-none tabular-nums tracking-tight text-slate-900">{desk.health}</p>
                    <p className="pb-1 text-[15px] font-bold text-slate-800">{desk.healthLabel}</p>
                  </div>
                  <p className="mt-3 inline-flex max-w-full rounded-full bg-rose-50 px-3 py-1.5 text-[13px] font-bold leading-snug tracking-tight text-rose-700">
                    Main gap · {desk.gapLine}
                  </p>
                </div>
                <div className="space-y-3">
                  {desk.drivers.map((d) => (
                    <div key={d.key}>
                      <div className="mb-0.5 flex items-baseline justify-between gap-2">
                        <span className={`text-[12px] font-bold ${d.key === desk.weakest.key ? 'text-rose-700' : 'text-slate-700'}`}>
                          {d.label}
                        </span>
                        <span className={`text-[12px] font-bold tabular-nums ${d.key === desk.weakest.key ? 'text-rose-700' : 'text-slate-800'}`}>
                          {d.readout}
                        </span>
                      </div>
                      <p className="mb-1.5 text-[11px] leading-snug text-slate-500">{d.meaning}</p>
                      <RecFillBar pct={d.score} color={d.key === desk.weakest.key ? '#E11D48' : '#6366F1'} height={8} />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {topic === 'utilization' ? (
              <RecSemiGauge
                display={`${desk.capacity}%`}
                pct={desk.capacity}
                label="Utilization"
                sub={`${desk.productiveHours}h of ${desk.expectedHours}h`}
                tone={desk.capacity < 25 ? 'rose' : desk.capacity > 100 ? 'amber' : 'indigo'}
              />
            ) : null}
            {topic === 'completion' ? (
              <RecSemiGauge
                display={`${desk.followThrough}%`}
                pct={desk.followThrough}
                label="Completion rate"
                sub={`${desk.followThrough}% of views updated`}
                tone={desk.followThrough < 20 ? 'rose' : desk.followThrough >= 50 ? 'lime' : 'amber'}
              />
            ) : null}
            {topic === 'hours' ? <HoursChart desk={desk} /> : null}
            {topic === 'team' ? <TeamChart rows={teamRows} /> : null}
            {topic === 'operating' ? (
              <div className="space-y-5">
                <div>
                  <div className="mb-1 flex justify-between text-[12px] font-semibold text-slate-700">
                    <span>Work finished</span>
                    <span className="tabular-nums">{desk.closeRate}%</span>
                  </div>
                  <p className="mb-1.5 text-[11px] leading-snug text-slate-500">Done out of assigned items still on the desk.</p>
                  <RecFillBar pct={desk.closeRate} color="#65A30D" height={10} />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-[12px] font-semibold text-slate-700">
                    <span>Open workload</span>
                    <span className="tabular-nums">{desk.loadPressure}%</span>
                  </div>
                  <p className="mb-1.5 text-[11px] leading-snug text-slate-500">How piled-up open and overdue assigned work is.</p>
                  <RecFillBar
                    pct={desk.loadPressure}
                    color={desk.loadPressure > 70 ? '#E11D48' : desk.loadPressure > 40 ? '#F59E0B' : '#64748B'}
                    height={10}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-4 p-5">
            {primary?.facts?.length ? (
              <div className="grid grid-cols-2 gap-2">
                {primary.facts.map((f) => (
                  <div key={f.label} className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{f.label}</p>
                    <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-slate-900">{f.value}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {notes.map((ins) => (
              <article key={ins.id}>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-500">{KIND_LABEL[ins.kind]}</p>
                <h4 className="mt-1 text-[16px] font-semibold tracking-tight text-slate-900">{ins.title}</h4>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-600">{ins.why || ins.body}</p>
              </article>
            ))}

            {actionText ? (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-500">Do this next</p>
                <p className="mt-1 text-[13px] font-medium leading-relaxed text-slate-800">{actionText}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export function PeoplePerfPanel({ product }: { product: PeoplePerfProduct }) {
  const { coins, refresh: refreshCoins, getFeatureCost } = useTenantCoins();
  const [status, setStatus] = useState<PeoplePerfSlot | null>(null);
  const [report, setReport] = useState<TenantBehaviorEngineReport | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [topic, setTopic] = useState<InsightTopic | null>(null);
  const [sop, setSop] = useState<PeopleSop>(() => defaultSop(product));

  useEffect(() => {
    setSop(defaultSop(product));
    try {
      const raw = window.localStorage.getItem(`saasa:people-sop:${product}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<PeopleSop>;
      setSop((prev) => ({
        ...prev,
        hoursPerDay: Number(parsed.hoursPerDay) > 0 ? Number(parsed.hoursPerDay) : prev.hoursPerDay,
        workdays: Number(parsed.workdays) > 0 ? Number(parsed.workdays) : prev.workdays,
        books: Array.isArray(parsed.books) && parsed.books.length ? parsed.books.map(String) : prev.books,
      }));
    } catch {
      /* keep defaults */
    }
  }, [product]);

  useEffect(() => {
    try {
      window.localStorage.setItem(`saasa:people-sop:${product}`, JSON.stringify(sop));
    } catch {
      /* ignore */
    }
  }, [product, sop]);

  const featureId = product === 'crm' ? 'intel.people_perf_crm' : 'intel.people_perf_recruitment';
  const catalogCost = getFeatureCost(featureId) || status?.coinsCost || (product === 'crm' ? 40 : 55);
  const active = Boolean(status?.active);
  const faded = !active;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [st, engine] = await Promise.all([loadStatus(), fetchTenantBehaviorEngine({ range: 'week' })]);
      setStatus(st?.[product] || null);
      setReport(engine);
      setSelectedId((prev) => {
        if (prev && engine?.users.some((u) => u.userId === prev)) return prev;
        return engine?.users[0]?.userId || null;
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load hours & scores');
    } finally {
      setLoading(false);
    }
  }, [product]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = report?.users.find((u) => u.userId === selectedId) || report?.users[0];
  const desk = useMemo(() => scorePeopleDesk(selected, product, sop), [selected, product, sop]);
  const teamRows = useMemo(() => teamHealthRows(report?.users || [], product, sop), [report?.users, product, sop]);
  const standardHours = sop.hoursPerDay * sop.workdays;

  const payMonth = async () => {
    if (paying) return;
    if (coins < catalogCost) {
      openAiCoinPurchaseModal({ featureId, required: catalogCost, balance: coins });
      return;
    }
    const ok = window.confirm(
      `Unlock ${product === 'crm' ? 'CRM' : 'Recruitment'} hours & scores for 30 days?\n\n${catalogCost} coins (once this month).\nBalance ${coins} → ${coins - catalogCost}.`,
    );
    if (!ok) return;
    setPaying(true);
    try {
      notifyTenantCoinsChanged({ spent: catalogCost });
      const res = await unlockProduct(product);
      toast.success(res.message || 'Unlocked for 30 days');
      await Promise.all([refreshCoins(), load()]);
    } catch (err) {
      if (isInsufficientCoinsError(err)) {
        openAiCoinPurchaseModal({ featureId, required: catalogCost, balance: coins });
      } else {
        toast.error(err instanceof Error ? err.message : 'Unlock failed');
      }
    } finally {
      setPaying(false);
    }
  };

  const isCrm = product === 'crm';
  const modules = isCrm
    ? [
        ['leads', 'Leads'],
        ['clients', 'Clients'],
        ['pipeline', 'Tasks'],
      ]
    : [
        ['jobs', 'Jobs'],
        ['candidates', 'Candidates'],
        ['interviews', 'Interviews'],
        ['placements', 'Placements'],
        ['pipeline', 'Pipeline'],
      ];

  return (
    <div className="relative space-y-4">
      {faded ? (
        <div className="relative z-20 mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-amber-200/90 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-6 text-center shadow-[0_16px_40px_rgba(15,23,42,0.12)]">
          <div className="pointer-events-none absolute -left-10 -top-12 h-36 w-36 rounded-full bg-amber-300/45 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 -right-8 h-36 w-36 rounded-full bg-emerald-300/40 blur-3xl" />
          <div className="relative mx-auto mb-3 flex h-16 w-16 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-amber-200/70" />
            <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-xl shadow-amber-500/40 ring-4 ring-white">
              <TokenCoinIcon className="h-8 w-8" />
            </span>
            <Lock className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-white p-0.5 text-amber-800" />
          </div>
          <p className="relative text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Unlock with coins</p>
          <p className="relative mt-1.5 text-[17px] font-bold text-slate-900">
            Unlock {isCrm ? 'CRM' : 'Recruitment'} hours & scores
          </p>
          <p className="relative mt-1 text-[13px] text-slate-600">
            See each person’s hours, utilization, completion, and recommended actions. 30 days.
          </p>
          <button
            type="button"
            disabled={paying}
            onClick={() => void payMonth()}
            className="relative mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-4 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 disabled:opacity-60"
          >
            <TokenCoinIcon className="h-5 w-5" />
            Pay {catalogCost} · 1 month
          </button>
          <p className="relative mt-2 inline-flex items-center justify-center gap-1 text-[11px] text-slate-500">
            Balance <TokenCoinIcon className="h-3.5 w-3.5" /> {coins}
          </p>
        </div>
      ) : null}

      <div className={faded ? 'select-none' : ''}>
        <div className={faded ? 'pointer-events-none max-h-[min(52vh,420px)] overflow-hidden blur-[2.5px] opacity-50' : ''}>
          <header className={`${CARD} mb-4 px-5 py-4`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-100 to-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                  <Sparkles className="h-3 w-3" /> Premium
                </p>
                <h2 className="mt-1.5 text-[18px] font-bold tracking-tight text-slate-900">Hours & scores</h2>
                <p className="mt-0.5 text-[12px] font-medium text-slate-500">
                  Assigned-work hours versus the standard operating week
                  {active && status?.daysLeft ? ` · ${status.daysLeft} days remaining` : ''}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <label className="flex h-9 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-[12px] text-slate-600">
                  Hours / day
                  <NumberStepper
                    value={sop.hoursPerDay}
                    min={1}
                    max={12}
                    step={0.5}
                    digits={1}
                    onChange={(n) => setSop((s) => ({ ...s, hoursPerDay: n }))}
                  />
                </label>
                <label className="flex h-9 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-[12px] text-slate-600">
                  Days / week
                  <NumberStepper
                    value={sop.workdays}
                    min={1}
                    max={7}
                    step={1}
                    onChange={(n) => setSop((s) => ({ ...s, workdays: n }))}
                  />
                </label>
                <span className="inline-flex h-9 w-[11.75rem] shrink-0 items-center justify-center rounded-xl bg-slate-900 text-[12px] font-semibold tabular-nums text-white">
                  {Number(sop.hoursPerDay).toFixed(1)}h × {sop.workdays}d = {standardHours.toFixed(1)}h
                </span>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
          </header>

          <div className="grid gap-4 xl:grid-cols-[220px_1fr]">
            <aside className={`${CARD} p-3`}>
              <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Team</p>
              <div className="space-y-1">
                {teamRows.map((row) => {
                  const on = row.userId === selected?.userId;
                  const tone =
                    row.health >= 72 ? 'bg-lime-400' : row.health >= 50 ? 'bg-indigo-400' : row.health >= 28 ? 'bg-amber-400' : 'bg-rose-400';
                  return (
                    <button
                      key={row.userId}
                      type="button"
                      onClick={() => setSelectedId(row.userId)}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left ${
                        on ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${tone}`} />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[13px] font-semibold ${on ? 'text-white' : 'text-slate-800'}`}>
                          {row.member}
                        </span>
                        <span className={`block text-[11px] tabular-nums ${on ? 'text-white/70' : 'text-slate-500'}`}>
                          Score {row.health} · {row.hours}h assigned
                        </span>
                      </span>
                    </button>
                  );
                })}
                {!teamRows.length ? <p className="px-2 py-6 text-center text-xs text-slate-400">No tracked users yet.</p> : null}
              </div>
            </aside>

            <div className="space-y-4">
              {desk ? (
                <>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="relative">
                      <LearnMoreBtn onClick={() => setTopic('composite')} />
                      <RecSemiGauge
                        display={`${desk.health}`}
                        pct={desk.health}
                        label="Composite score"
                        sub={desk.healthLabel}
                        tone={desk.healthTone}
                        onClick={() => setTopic('composite')}
                      />
                    </div>
                    <div className="relative">
                      <LearnMoreBtn onClick={() => setTopic('utilization')} />
                      <RecSemiGauge
                        display={`${desk.capacity}%`}
                        pct={desk.capacity}
                        label="Utilization"
                        sub={`${desk.productiveHours}h of ${desk.expectedHours}h`}
                        tone={desk.capacity < 25 ? 'rose' : desk.capacity > 100 ? 'amber' : 'indigo'}
                        onClick={() => setTopic('utilization')}
                      />
                    </div>
                    <div className="relative">
                      <LearnMoreBtn onClick={() => setTopic('completion')} />
                      <RecSemiGauge
                        display={`${desk.followThrough}%`}
                        pct={desk.followThrough}
                        label="Completion rate"
                        sub={`${selected?.activity.actions || 0} updates / ${selected?.activity.visits || 0} views`}
                        tone={desk.followThrough < 20 ? 'rose' : desk.followThrough >= 50 ? 'lime' : 'amber'}
                        onClick={() => setTopic('completion')}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <section className={`relative ${CARD} p-4`}>
                      <LearnMoreBtn onClick={() => setTopic('hours')} />
                      <h3 className="pr-24 text-[13px] font-bold text-slate-900">Hours vs standard week</h3>
                      <p className="mb-1 text-[11px] font-medium text-slate-400">Assigned work · admin/reports · unused standard hours</p>
                      <HoursChart desk={desk} />
                    </section>
                    <section className={`relative ${CARD} p-4`}>
                      <LearnMoreBtn onClick={() => setTopic('team')} />
                      <h3 className="pr-24 text-[13px] font-bold text-slate-900">Team scores</h3>
                      <p className="mb-1 text-[11px] font-medium text-slate-400">Composite score by member</p>
                      <TeamChart rows={teamRows} />
                    </section>
                  </div>

                  <section className={`relative ${CARD} p-4`}>
                    <LearnMoreBtn onClick={() => setTopic('operating')} />
                    <div className="min-w-0 pr-24">
                      <h3 className="text-[13px] font-bold text-slate-900">Operating standard</h3>
                      <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-slate-500">{desk.recipe}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {modules.map(([book, label]) => {
                        const on = sop.books.includes(book);
                        return (
                          <button
                            key={book}
                            type="button"
                            onClick={() =>
                              setSop((s) => ({
                                ...s,
                                books: on ? s.books.filter((b) => b !== book) : [...s.books, book],
                              }))
                            }
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              on ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <div>
                        <div className="mb-1 flex justify-between text-[12px] font-semibold text-slate-600">
                          <span>Work finished</span>
                          <span className="tabular-nums">{desk.closeRate}%</span>
                        </div>
                        <p className="mb-1 text-[11px] text-slate-400">Done out of assigned items</p>
                        <RecFillBar pct={desk.closeRate} color="#65A30D" height={10} />
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between text-[12px] font-semibold text-slate-600">
                          <span>Open workload</span>
                          <span className="tabular-nums">{desk.loadPressure}%</span>
                        </div>
                        <p className="mb-1 text-[11px] text-slate-400">Still open and overdue on this desk</p>
                        <RecFillBar
                          pct={desk.loadPressure}
                          color={desk.loadPressure > 70 ? '#E11D48' : desk.loadPressure > 40 ? '#F59E0B' : '#64748B'}
                          height={10}
                        />
                      </div>
                    </div>
                  </section>
                </>
              ) : (
                <p className={`${CARD} p-8 text-center text-sm text-slate-500`}>No team member selected.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {desk ? (
        <CardInsightModal topic={topic} onClose={() => setTopic(null)} desk={desk} teamRows={teamRows} />
      ) : null}
    </div>
  );
}
