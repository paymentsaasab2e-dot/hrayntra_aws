/** Shared premium Command Center visual tokens (mockup-aligned). */
export const cardClass =
  'rounded-[20px] border border-slate-200/70 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)]';

export const cardHover =
  'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(15,23,42,0.08)]';

export const CHART_COLORS = [
  '#6366F1',
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EC4899',
  '#8B5CF6',
  '#06B6D4',
  '#94A3B8',
];

export function formatMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n.toLocaleString('en-IN')}`;
}

export function formatMoneyFull(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

export function formatCount(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString('en-IN');
}

export function relativeTime(iso?: string | null) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const diff = Date.now() - t;
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export function formatClock(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export function formatShortDate(iso?: string | null) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export function initials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}
