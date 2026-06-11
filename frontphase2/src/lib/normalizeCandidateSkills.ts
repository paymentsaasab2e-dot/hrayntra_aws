/** Coerce API skill rows (string or { name } objects) into display labels. */
export function normalizeCandidateSkillLabels(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  const labels: string[] = [];
  for (const item of input) {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (trimmed) labels.push(trimmed);
      continue;
    }
    if (item && typeof item === 'object') {
      const record = item as { name?: unknown; label?: unknown; skill?: unknown };
      const label = String(record.name ?? record.label ?? record.skill ?? '').trim();
      if (label) labels.push(label);
    }
  }

  return labels;
}
