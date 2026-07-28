'use client';

import React from 'react';
import type { DashboardOverview, PipelineStage } from '@/lib/dashboard/api';
import { useEnterpriseDashboard } from './smartDashboardFilters';

type Props = {
  overview: DashboardOverview | null;
  loading?: boolean;
};

function PipelineBoard({
  title,
  stages,
}: {
  title: string;
  stages: PipelineStage[];
}) {
  const { openDrillDown } = useEnterpriseDashboard();
  const max = Math.max(1, ...stages.map((s) => s.count));

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-bold text-slate-800">{title}</h3>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {stages.map((stage) => (
          <button
            key={stage.stage}
            type="button"
            onClick={() =>
              openDrillDown({
                title: `${title} · ${stage.stage}`,
                href: stage.href,
                rows: [{ stage: stage.stage, count: stage.count }],
              })
            }
            className="min-w-[8.5rem] flex-1 rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-3 text-left transition hover:border-sky-300 hover:shadow-sm"
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{stage.stage}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{stage.count}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#2098C8]"
                style={{ width: `${Math.round((stage.count / max) * 100)}%` }}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function PipelineBoards({ overview, loading }: Props) {
  if (loading && !overview) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  return (
    <section aria-label="Pipelines" className="grid gap-4 lg:grid-cols-2">
      <PipelineBoard title="CRM Pipeline" stages={overview?.crmPipeline || []} />
      <PipelineBoard title="Recruitment Pipeline" stages={overview?.recruitmentPipeline || []} />
    </section>
  );
}
