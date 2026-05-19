/** Default catalog — kept in sync with backend DEFAULT_COMPANY_SERVICES. */
export const DEFAULT_COMPANY_SERVICES = [
  'Permanent Placement',
  'Contract Staffing',
  'Temporary Staffing',
  'Executive Search',
  'RPO (Recruitment Process Outsourcing)',
  'Temp-to-Hire',
  'IT & Software Recruitment',
  'Technology Staffing',
  'Payroll Services',
  'HR Consulting',
  'Background Verification',
  'Training & Development',
] as const;

export const RECOMMENDED_COMPANY_SERVICES = [
  'Permanent Placement',
  'Contract Staffing',
  'Executive Search',
] as const;

/** Parse legacy free-text or semicolon/comma-separated values. */
export function parseServicesNeeded(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[;,]/)) {
    const label = part.trim().replace(/\s+/g, ' ');
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

/** Serialize for API / DB (matches import samples: "Permanent placement; Contract"). */
export function serializeServicesNeeded(items: string[]): string {
  return parseServicesNeeded(items.join('; ')).join('; ');
}

export function formatServicesNeededDisplay(raw: string | null | undefined): string {
  const items = parseServicesNeeded(raw);
  return items.length ? items.join('; ') : '';
}

function isSelected(service: string, selected: string[]) {
  const key = service.toLowerCase();
  return selected.some((s) => s.toLowerCase() === key);
}

/** Rank catalog matches for the typed query; empty query returns org recommendations first. */
export function suggestCompanyServices(
  catalog: string[],
  query: string,
  selected: string[],
  recommended: string[] = [...RECOMMENDED_COMPANY_SERVICES],
  limit = 8,
): string[] {
  const q = query.trim().toLowerCase();
  const pool = catalog.filter((s) => !isSelected(s, selected));

  const score = (label: string): number => {
    const hay = label.toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    if (!q) {
      const recIdx = recommended.findIndex((r) => r.toLowerCase() === hay);
      return recIdx >= 0 ? 100 - recIdx : 10;
    }
    if (hay === q) return 200;
    if (hay.startsWith(q)) return 150;
    if (words.every((w) => hay.includes(w))) return 120;
    if (hay.includes(q)) return 100;
    if (words.some((w) => hay.includes(w))) return 60;
    return 0;
  };

  return [...pool]
    .map((label) => ({ label, rank: score(label) }))
    .filter((row) => row.rank > 0)
    .sort((a, b) => b.rank - a.rank || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map((row) => row.label);
}
