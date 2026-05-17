'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import type { DashboardWidget } from '../../lib/dashboard/types';
import { DashboardWidgetCard } from './DashboardWidget';

type Props = {
  moduleName: string;
  widgets: DashboardWidget[];
  editMode: boolean;
  onUpdate: (widget: DashboardWidget) => void;
  onRemove: (id: string) => void;
  onDuplicate: (widget: DashboardWidget) => void;
  onAddToModule?: (moduleName: string) => void;
};

const MODULE_ACCENT: Record<string, string> = {
  Leads: 'from-indigo-500/10 via-indigo-50/40 to-violet-50/30',
  Clients: 'from-violet-500/10 via-violet-50/40 to-fuchsia-50/30',
  Jobs: 'from-blue-500/10 via-blue-50/40 to-cyan-50/30',
  Candidates: 'from-emerald-500/10 via-emerald-50/40 to-teal-50/30',
  Interviews: 'from-amber-500/10 via-amber-50/40 to-orange-50/30',
  Placements: 'from-rose-500/10 via-rose-50/40 to-pink-50/30',
  'Task and activity': 'from-slate-500/10 via-slate-50/40 to-indigo-50/20',
  Team: 'from-sky-500/10 via-sky-50/40 to-indigo-50/30',
  Departments: 'from-purple-500/10 via-purple-50/40 to-indigo-50/30',
};

export function DashboardModuleSection({
  moduleName,
  widgets,
  editMode,
  onUpdate,
  onRemove,
  onDuplicate,
  onAddToModule,
}: Props) {
  const accent = MODULE_ACCENT[moduleName] || 'from-indigo-500/10 via-indigo-50/40 to-violet-50/30';

  return (
    <section
      className="overflow-hidden rounded-2xl border border-indigo-100/80 bg-white shadow-[0_8px_30px_-12px_rgba(59,130,246,0.12)]"
      aria-labelledby={`dashboard-section-${moduleName.replace(/\s+/g, '-')}`}
    >
      <header
        className={`flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100/60 bg-gradient-to-r ${accent} px-4 py-3 sm:px-5`}
      >
        <div>
          <h2
            id={`dashboard-section-${moduleName.replace(/\s+/g, '-')}`}
            className="text-base font-bold tracking-tight text-slate-900 sm:text-lg"
          >
            {moduleName}
          </h2>
          <p className="text-[11px] font-medium text-slate-500">
            {widgets.length} chart{widgets.length === 1 ? '' : 's'} in this section
          </p>
        </div>
        {editMode && onAddToModule ? (
          <button
            type="button"
            onClick={() => onAddToModule(moduleName)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200/80 bg-white/90 px-3 py-1.5 text-xs font-semibold text-indigo-800 shadow-sm hover:bg-indigo-50"
          >
            <Plus size={14} /> Add to {moduleName}
          </button>
        ) : null}
      </header>

      <div className="grid grid-cols-12 gap-4 p-4 sm:p-5" style={{ gridAutoRows: 'minmax(80px, auto)' }}>
        {widgets.map((widget) => (
          <DashboardWidgetCard
            key={widget.id}
            widget={widget}
            editMode={editMode}
            onUpdate={onUpdate}
            onRemove={onRemove}
            onDuplicate={onDuplicate}
          />
        ))}
      </div>
    </section>
  );
}

