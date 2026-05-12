/**
 * Phase 2 standard date display: **DD/MM/YYYY** (day / month / year).
 * Used anywhere we render calendar dates to users (tables, drawers, CSV).
 *
 * HTML `<input type="date">` / `datetime-local` values stay ISO internally;
 * this module is for human-readable text only. Root layout uses `lang="en-GB"`
 * so native pickers tend to match this order where the browser respects it.
 */

/** Parse API / form values into a local `Date`, including plain `YYYY-MM-DD`. */
export function parseDisplayableDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  // Calendar date only — interpret as local midnight (avoids UTC shift).
  const ymd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    const y = Number(ymd[1]);
    const m = Number(ymd[2]) - 1;
    const d = Number(ymd[3]);
    const dt = new Date(y, m, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const dt = new Date(trimmed);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** `DD/MM/YYYY` — empty string when unparseable (unless raw string fallback). */
export function formatDateDMY(value: unknown): string {
  const d = parseDisplayableDate(value);
  if (!d) return typeof value === 'string' ? String(value).trim() : '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

/** `DD/MM/YYYY, h:mm am/pm` for timestamps shown in lists and exports. */
export function formatDateTimeDMY(value: unknown): string {
  const d = parseDisplayableDate(value);
  if (!d) return typeof value === 'string' ? String(value).trim() : '';
  const time = d.toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${formatDateDMY(d)}, ${time}`;
}

/** Time only (12h), for pairing with `formatDateDMY` on a second line. */
export function formatTime12hEnGb(value: unknown): string {
  const d = parseDisplayableDate(value);
  if (!d) return '—';
  return d.toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
