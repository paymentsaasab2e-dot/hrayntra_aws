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

/** Mask typed digits into DD/MM/YYYY (day / month / year). */
export function maskDateDMYInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Parse **DD/MM/YYYY** to `YYYY-MM-DD`, or null if invalid. */
export function parseDMYToYMD(dmy: string): string | null {
  const trimmed = String(dmy || '').trim();
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isoToDMYDate(value: string | null | undefined): string {
  if (!value) return '';
  return formatDateDMY(value);
}

export function isoToTimeHM(value: string | null | undefined): string {
  const d = parseDisplayableDate(value);
  if (!d) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Combine DD/MM/YYYY + HH:mm → ISO string for API storage. */
export function combineDMYAndTimeToISO(dmy: string, timeHm: string): string {
  const ymd = parseDMYToYMD(dmy);
  if (!ymd) return '';
  const time = (timeHm || '09:00').trim().slice(0, 5);
  return fromDateTimeLocalInput(`${ymd}T${time}`);
}

export function formatFollowUpDisplay(value: string | null | undefined): string {
  const parts = splitDateTimeForDisplay(value);
  if (!parts) return '—';
  return `${parts.date}, ${parts.time}`;
}
