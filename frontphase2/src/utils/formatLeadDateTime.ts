/**
 * ISO / date strings from API → separate date & time for the leads UI.
 * Date is always **DD/MM/YYYY** (phase 2 standard).
 */
import { formatDateDMY, formatTime12hEnGb, parseDisplayableDate } from './dateDisplay';

export function splitDateTimeForDisplay(value: string | null | undefined): { date: string; time: string } | null {
  if (value == null || !String(value).trim()) return null;
  const d = parseDisplayableDate(value);
  if (!d) return { date: String(value).trim(), time: '—' };
  return {
    date: formatDateDMY(d),
    time: formatTime12hEnGb(d),
  };
}

/**
 * Normalize any incoming date/datetime string into the "YYYY-MM-DDTHH:mm"
 * format consumed by HTML `<input type="datetime-local">`. Returns an empty
 * string if the value is falsy or unparseable so the input renders empty.
 */
export function toDateTimeLocalInput(value: string | null | undefined): string {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';

  // Already in the right shape (YYYY-MM-DDTHH:mm or with seconds) — strip seconds/zone.
  const localMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (localMatch) {
    return `${localMatch[1]}T${localMatch[2]}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return '';

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Convert the value emitted by `<input type="datetime-local">`
 * (`YYYY-MM-DDTHH:mm`) into an ISO timestamp suitable for sending to the
 * backend. Returns the input untouched when it isn't a recognizable local
 * datetime so other formats (date-only, ISO already) survive intact.
 */
export function fromDateTimeLocalInput(value: string | null | undefined): string {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return trimmed;
}
