/** Vibrant palette for 3D-style dashboard charts */
export const CHART_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#a855f7',
];

/** Lighter top / darker bottom for pseudo-3D bars and pie slices */
export const CHART_COLOR_TOP = [
  '#818cf8',
  '#a78bfa',
  '#f472b6',
  '#fb7185',
  '#fb923c',
  '#facc15',
  '#4ade80',
  '#22d3ee',
  '#60a5fa',
  '#c084fc',
];

export const CHART_TOOLTIP_STYLE: Record<string, string | number> = {
  borderRadius: 12,
  border: '1px solid rgba(99, 102, 241, 0.25)',
  boxShadow: '0 12px 28px -8px rgba(79, 70, 229, 0.45), 0 4px 12px rgba(15, 23, 42, 0.12)',
  background: 'linear-gradient(145deg, #ffffff 0%, #f5f3ff 100%)',
  fontSize: 12,
  fontWeight: 600,
  color: '#1e1b4b',
};

export const CHART_GRID_STROKE = 'rgba(99, 102, 241, 0.12)';

export const MODULE_WIDGET_ACCENT: Record<
  string,
  { header: string; border: string; glow: string; chart: string }
> = {
  Leads: {
    header: 'from-indigo-500 via-violet-500 to-purple-500',
    border: 'border-indigo-200/80',
    glow: 'shadow-[0_16px_40px_-12px_rgba(99,102,241,0.45)]',
    chart: '#6366f1',
  },
  Clients: {
    header: 'from-violet-500 via-fuchsia-500 to-pink-500',
    border: 'border-violet-200/80',
    glow: 'shadow-[0_16px_40px_-12px_rgba(139,92,246,0.45)]',
    chart: '#8b5cf6',
  },
  Jobs: {
    header: 'from-blue-500 via-cyan-500 to-teal-500',
    border: 'border-blue-200/80',
    glow: 'shadow-[0_16px_40px_-12px_rgba(59,130,246,0.45)]',
    chart: '#3b82f6',
  },
  Candidates: {
    header: 'from-emerald-500 via-green-500 to-lime-500',
    border: 'border-emerald-200/80',
    glow: 'shadow-[0_16px_40px_-12px_rgba(16,185,129,0.4)]',
    chart: '#22c55e',
  },
  Interviews: {
    header: 'from-amber-500 via-orange-500 to-red-500',
    border: 'border-amber-200/80',
    glow: 'shadow-[0_16px_40px_-12px_rgba(245,158,11,0.4)]',
    chart: '#f97316',
  },
  Placements: {
    header: 'from-rose-500 via-pink-500 to-fuchsia-500',
    border: 'border-rose-200/80',
    glow: 'shadow-[0_16px_40px_-12px_rgba(244,63,94,0.4)]',
    chart: '#f43f5e',
  },
  'Task and activity': {
    header: 'from-slate-500 via-indigo-500 to-violet-500',
    border: 'border-slate-200/80',
    glow: 'shadow-[0_16px_40px_-12px_rgba(100,116,139,0.35)]',
    chart: '#64748b',
  },
  Team: {
    header: 'from-sky-500 via-blue-500 to-indigo-500',
    border: 'border-sky-200/80',
    glow: 'shadow-[0_16px_40px_-12px_rgba(14,165,233,0.4)]',
    chart: '#0ea5e9',
  },
  Departments: {
    header: 'from-purple-500 via-violet-500 to-indigo-500',
    border: 'border-purple-200/80',
    glow: 'shadow-[0_16px_40px_-12px_rgba(168,85,247,0.4)]',
    chart: '#a855f7',
  },
};

export function getModuleAccent(module?: string) {
  return MODULE_WIDGET_ACCENT[module || ''] || MODULE_WIDGET_ACCENT.Leads;
}
