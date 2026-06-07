/** Parse legacy free-text or semicolon/comma-separated industry values. */
export function parseIndustries(raw: string | null | undefined): string[] {
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

export function serializeIndustries(items: string[]): string {
  return parseIndustries(items.join('; ')).join('; ');
}

export function formatIndustriesDisplay(raw: string | null | undefined): string {
  const items = parseIndustries(raw);
  return items.length ? items.join('; ') : '';
}
