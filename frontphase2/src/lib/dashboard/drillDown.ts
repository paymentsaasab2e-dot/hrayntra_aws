export function normalizeDrillLabel(value?: string | null) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const ALIASES: Record<string, string[]> = {
  new: ['new', 'new lead', 'fresh'],
  contacted: ['contacted', 'in touch'],
  qualified: ['qualified', 'qual'],
  meeting: ['meeting', 'demo', 'appointment'],
  proposal: ['proposal', 'quoted', 'quote'],
  negotiation: ['negotiation', 'negotiate'],
  converted: ['converted', 'won', 'closed won', 'customer', 'placed'],
  lost: ['lost', 'closed lost', 'rejected'],
  active: ['active'],
  inactive: ['inactive', 'cold'],
  'on hold': ['on hold', 'onhold', 'hold'],
  prospect: ['prospect', 'hot'],
  hot: ['hot', 'prospect'],
  cold: ['cold', 'inactive'],
  open: ['open'],
  filled: ['filled', 'closed filled'],
  closed: ['closed', 'filled'],
  draft: ['draft'],
  applied: ['applied', 'new'],
  assigned: ['assigned'],
  unassigned: ['unassigned', 'open'],
};

export function labelsMatch(value: string | undefined | null, needle: string | undefined | null) {
  const a = normalizeDrillLabel(value);
  const b = normalizeDrillLabel(needle);
  if (!b) return true;
  if (!a) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const aliasList = ALIASES[b] || Object.values(ALIASES).find((list) => list.includes(b));
  if (!aliasList) return false;
  return aliasList.some((alias) => a === alias || a.includes(alias) || alias.includes(a));
}

export function filterByLabel<T>(
  rows: T[],
  getValue: (row: T) => string | undefined | null,
  needle: string,
) {
  const exact = rows.filter((row) => labelsMatch(getValue(row), needle));
  if (exact.length) return exact;
  const n = normalizeDrillLabel(needle);
  if (!n) return rows;
  return rows.filter((row) => normalizeDrillLabel(getValue(row)).includes(n));
}

export function flattenDrillRows(
  rows: Array<Record<string, unknown>> | undefined | null,
): Array<Record<string, string>> {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    if (!row || typeof row !== 'object') return { Value: String(row ?? '—') };
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      if (key === 'id' || key === 'href' || key.startsWith('_')) continue;
      if (value == null || value === '') {
        out[key] = '—';
        continue;
      }
      if (typeof value === 'object') {
        if (value instanceof Date) {
          out[key] = value.toLocaleString();
          continue;
        }
        if (Array.isArray(value)) {
          out[key] = value.map((item) => (item == null ? '' : String(item))).filter(Boolean).join(', ') || '—';
          continue;
        }
        for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
          if (subValue == null || typeof subValue === 'object') continue;
          out[`${key} ${subKey}`] = String(subValue);
        }
        continue;
      }
      out[key] = String(value);
    }
    return Object.keys(out).length ? out : { Value: '—' };
  });
}
