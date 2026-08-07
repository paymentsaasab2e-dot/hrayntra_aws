'use client';

import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { HqInfoTip } from './HqPhase2DashboardParts';

export type HqSvgKpiItem = {
  label: string;
  value: string | number;
  growth?: number | null;
  iconSrc: string;
  sparkSrc?: string;
  sparkData?: Array<{ i: number; v: number }>;
  sparkColor?: string;
  compareLabel?: string;
  /** Short sentence for the (i) tip */
  info?: string;
};

function AnimatedValue({ value }: { value: string | number }) {
  if (typeof value === 'string') return <>{value}</>;
  return <>{value.toLocaleString()}</>;
}

function LiveSpark({
  data,
  color,
}: {
  data: Array<{ i: number; v: number }>;
  color: string;
}) {
  const id = `kpi-spark-${color.replace('#', '')}-${data.length}`;
  const vals = data.map((d) => d.v);
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, 0);
  // Give flat series a little vertical room so the line isn't a hairline blob
  const pad = max === min ? Math.max(1, max * 0.15) : (max - min) * 0.15;
  return (
    <div className="h-7 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            fill={`url(#${id})`}
            strokeWidth={1.6}
            dot={false}
            isAnimationActive={false}
            baseValue={Math.max(0, min - pad)}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** KPI card — live spark when available; growth only when real delta exists */
export function HqSvgKpiCard({ item }: { item: HqSvgKpiItem }) {
  const hasGrowth = typeof item.growth === 'number' && Number.isFinite(item.growth);
  const up = hasGrowth ? Number(item.growth) >= 0 : true;
  const spark = item.sparkData?.length
    ? item.sparkData
    : [{ i: 0, v: 0 }, { i: 1, v: 0 }];
  const color = item.sparkColor || '#6366F1';

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="group relative z-0 flex flex-col overflow-visible rounded-2xl border border-white/80 bg-white/80 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_16px_40px_-22px_rgba(15,23,42,0.2)] backdrop-blur-md"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300/70 to-transparent"
      />
      <div className="flex flex-1 flex-col p-3.5 pb-2.5 sm:p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-slate-50 to-indigo-50/80 ring-1 ring-indigo-100/70 transition group-hover:ring-indigo-200">
            <img
              src={item.iconSrc}
              alt=""
              width={40}
              height={40}
              className="h-9 w-9 select-none"
              draggable={false}
            />
          </div>
          {hasGrowth ? (
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'
              }`}
            >
              {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(Number(item.growth)).toFixed(1)}%
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 ring-1 ring-slate-100">
              Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-slate-400">{item.label}</p>
          {item.info ? <HqInfoTip text={item.info} /> : null}
        </div>
        <p className="hq-display mt-1.5 text-[1.35rem] font-bold leading-none tracking-tight text-slate-900 tabular-nums sm:text-[1.45rem]">
          <AnimatedValue value={item.value} />
        </p>
        <p className="mt-1.5 text-[10px] font-medium text-slate-400">
          {item.compareLabel || (hasGrowth ? 'vs prior 7d' : 'Portal')}
        </p>
      </div>
      <div className="relative border-t border-indigo-50/80 bg-gradient-to-r from-slate-50/80 via-indigo-50/40 to-teal-50/30 px-2.5 py-2">
        {item.sparkData?.length ? (
          <LiveSpark data={spark} color={color} />
        ) : item.sparkSrc ? (
          <img
            src={item.sparkSrc}
            alt=""
            width={200}
            height={48}
            className="h-7 w-full select-none object-fill opacity-90"
            draggable={false}
          />
        ) : (
          <LiveSpark data={spark} color={color} />
        )}
      </div>
    </motion.div>
  );
}

export const HQ_SVG_ASSETS = {
  totalCandidates: {
    icon: '/svgs/icon-total-candidates.svg',
    spark: '/svgs/sparkline-total-candidates.svg',
  },
  newCandidates: {
    icon: '/svgs/icon-new-candidates.svg',
    spark: '/svgs/sparkline-new-candidates.svg',
  },
  openJobs: {
    icon: '/svgs/icon-open-jobs.svg',
    spark: '/svgs/sparkline-open-jobs.svg',
  },
  applications: {
    icon: '/svgs/icon-applications.svg',
    spark: '/svgs/sparkline-applications.svg',
  },
  activeApplications: {
    icon: '/svgs/icon-active-applications.svg',
    spark: '/svgs/sparkline-active-applications.svg',
  },
  interviewRequests: {
    icon: '/svgs/icon-interview-requests.svg',
    spark: '/svgs/sparkline-interview-requests.svg',
  },
  avgMatchScore: {
    icon: '/svgs/icon-avg-match-score.svg',
    spark: '/svgs/sparkline-avg-match-score.svg',
  },
  profileCompleteness: {
    icon: '/svgs/icon-profile-completeness.svg',
    spark: '/svgs/sparkline-profile-completeness.svg',
  },
};
