/**
 * ISO / date strings from API → separate date & time in the user's locale.
 * Used by leads table and lead drawer.
 */
export function splitDateTimeForDisplay(value: string | null | undefined): { date: string; time: string } | null {
  if (value == null || !String(value).trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { date: String(value).trim(), time: '—' };
  const date = d.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return { date, time };
}
