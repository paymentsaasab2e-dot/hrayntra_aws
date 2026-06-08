export const DIRECTOR_DETAIL_LABELS = {
  salutation: 'Director Salutation',
  name: 'Director Name',
} as const;

const DIRECTOR_LABEL_SET = new Set<string>(Object.values(DIRECTOR_DETAIL_LABELS));

export function isDirectorDetailLabel(label?: string | null): boolean {
  return DIRECTOR_LABEL_SET.has(String(label ?? '').trim());
}

export type DirectorStoredDetails = {
  directorSalutation: string;
  directorName: string;
};

export function directorFromOtherDetails(
  otherDetails?: Array<{ label: string; value: string }> | null,
): DirectorStoredDetails {
  const byLabel = new Map(
    (otherDetails ?? []).map((item) => [String(item.label || '').trim(), String(item.value || '').trim()]),
  );
  return {
    directorSalutation: byLabel.get(DIRECTOR_DETAIL_LABELS.salutation) || '',
    directorName: byLabel.get(DIRECTOR_DETAIL_LABELS.name) || '',
  };
}

export function mergeDirectorIntoOtherDetails(
  existing: Array<{ label: string; value: string }> | undefined,
  director: { directorSalutation?: string | null; directorName?: string | null },
): Array<{ label: string; value: string }> | undefined {
  const base = (existing ?? []).filter((item) => !isDirectorDetailLabel(item.label));
  const entries = [...base];
  const push = (label: string, value?: string | null) => {
    const trimmed = String(value ?? '').trim();
    if (trimmed) entries.push({ label, value: trimmed });
  };

  push(DIRECTOR_DETAIL_LABELS.salutation, director.directorSalutation);
  push(DIRECTOR_DETAIL_LABELS.name, director.directorName);

  return entries.length ? entries : undefined;
}
