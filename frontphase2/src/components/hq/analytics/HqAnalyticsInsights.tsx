'use client';

import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { HqAnalyticsInsight } from '@/lib/api';
import { HqPanel, HqPanelTitle } from '../hqUi';

const TONE = {
  info: {
    icon: Info,
    className: 'border-sky-100 bg-sky-50/80 text-sky-900',
    iconClass: 'text-sky-600',
  },
  good: {
    icon: CheckCircle2,
    className: 'border-emerald-100 bg-emerald-50/80 text-emerald-900',
    iconClass: 'text-emerald-600',
  },
  warn: {
    icon: AlertTriangle,
    className: 'border-amber-100 bg-amber-50/80 text-amber-900',
    iconClass: 'text-amber-600',
  },
} as const;

export function HqAnalyticsInsights({ insights }: { insights: HqAnalyticsInsight[] }) {
  if (!insights?.length) return null;

  return (
    <HqPanel>
      <HqPanelTitle title="Intelligence insights" meta={<span className="text-[10px] text-slate-400">Rule-based</span>} />
      <ul className="space-y-2">
        {insights.map((insight, i) => {
          const tone = TONE[insight.tone] || TONE.info;
          const Icon = tone.icon;
          return (
            <li
              key={`${i}-${insight.text.slice(0, 24)}`}
              className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm leading-snug ${tone.className}`}
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone.iconClass}`} />
              <span>{insight.text}</span>
            </li>
          );
        })}
      </ul>
    </HqPanel>
  );
}
