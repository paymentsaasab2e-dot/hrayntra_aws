'use client';

import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { motion } from 'motion/react';

export type HqSvgKpiItem = {
  label: string;
  value: string | number;
  growth: number;
  iconSrc: string;
  sparkSrc: string;
  compareLabel?: string;
};

function AnimatedValue({ value }: { value: string | number }) {
  if (typeof value === 'string') return <>{value}</>;
  return <>{value.toLocaleString()}</>;
}

/** Premium KPI card built around the real /public/svgs icon + sparkline assets. */
export function HqSvgKpiCard({ item }: { item: HqSvgKpiItem }) {
  const up = item.growth >= 0;
  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 12px 28px rgba(15,23,42,0.08)' }}
      transition={{ duration: 0.15 }}
      className="flex flex-col overflow-hidden rounded-[18px] border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
    >
      <div className="flex flex-1 flex-col p-4 pb-3">
        <div className="mb-3 flex items-start justify-between gap-2">
          <img
            src={item.iconSrc}
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 select-none"
            draggable={false}
          />
        </div>
        <p className="text-[11px] font-medium leading-tight text-[#6B7280]">{item.label}</p>
        <p className="mt-1.5 text-[22px] font-bold leading-none tracking-tight text-[#111827]">
          <AnimatedValue value={item.value} />
        </p>
        <div
          className={`mt-2.5 flex items-center gap-1 text-[11px] font-semibold ${
            up ? 'text-emerald-600' : 'text-red-500'
          }`}
        >
          {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          {Math.abs(item.growth).toFixed(1)}%
          <span className="font-medium text-slate-400">{item.compareLabel || 'vs Apr 2025'}</span>
        </div>
      </div>
      {/* Real sparkline SVG as chart strip */}
      <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-2.5">
        <img
          src={item.sparkSrc}
          alt=""
          width={200}
          height={48}
          className="h-8 w-full select-none object-fill"
          draggable={false}
        />
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
} as const;
