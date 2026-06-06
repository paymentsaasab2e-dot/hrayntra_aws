/** Salutation options for director / primary contact name fields (CRM). */
export const NAME_SALUTATION_OPTIONS = [
  { value: '', label: '—' },
  { value: 'Mr', label: 'Mr' },
  { value: 'Mrs', label: 'Mrs' },
  { value: 'Ms', label: 'Ms' },
  { value: 'Dr', label: 'Dr' },
  { value: 'Prof', label: 'Prof' },
] as const;

export type NameSalutation = (typeof NAME_SALUTATION_OPTIONS)[number]['value'];

export function formatDirectorDisplay(salutation: string | null | undefined, name: string | null | undefined): string {
  const n = String(name || '').trim();
  const s = String(salutation || '').trim();
  if (!n && !s) return '';
  if (!s) return n;
  if (!n) return s;
  return `${s} ${n}`;
}
