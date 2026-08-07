/** Stored in otherDetails for Follow-up tab / scheduler — not user-facing. */
export const FOLLOW_UP_SCHEDULE_LABEL = '__followUpSchedule';

/** Hide system rows (e.g. `__followUpSchedule`) from Overview "Other Details". */
export function isInternalLeadOtherDetailLabel(label?: string | null): boolean {
  const trimmed = String(label || '').trim();
  if (!trimmed) return false;
  return trimmed.startsWith('__');
}

/** Keep system rows when rebuilding otherDetails from the visible form. */
export function withPreservedInternalOtherDetails(
  nextDetails: Array<{ label: string; value: string }> | undefined,
  previousDetails?: Array<{ label: string; value: string }> | null,
): Array<{ label: string; value: string }> | undefined {
  const base = Array.isArray(nextDetails) ? [...nextDetails] : [];
  const internals = (previousDetails ?? []).filter((item) =>
    isInternalLeadOtherDetailLabel(item?.label),
  );
  if (!internals.length) {
    return nextDetails === undefined ? undefined : base;
  }

  const withoutInternal = base.filter((item) => !isInternalLeadOtherDetailLabel(item?.label));
  return [...withoutInternal, ...internals];
}
