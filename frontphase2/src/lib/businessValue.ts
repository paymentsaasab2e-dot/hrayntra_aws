/**
 * Expected Business Value — digits only (optional one decimal), no currency text.
 */

/** Keep only numeric typing while the user edits (allows one `.`). */
export function sanitizeBusinessValueInput(raw: string): string {
  const text = String(raw ?? '');
  let out = '';
  let seenDot = false;
  for (const ch of text) {
    if (ch >= '0' && ch <= '9') {
      out += ch;
      continue;
    }
    if (ch === '.' && !seenDot) {
      out += '.';
      seenDot = true;
    }
  }
  return out;
}

/**
 * Normalize for API save: strip currency/letters/commas → clean number string, or ''.
 * Examples: "₹15,00,000" → "1500000", "50.5k" → "505" (letters dropped; prefer typing digits).
 */
export function normalizeBusinessValueForSave(raw: string | number | null | undefined): string {
  if (raw == null) return '';
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw < 0) return '';
    return String(raw);
  }
  const cleaned = sanitizeBusinessValueInput(String(raw).replace(/,/g, ''));
  if (!cleaned || cleaned === '.') return '';
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return '';
  // Prefer integer string when whole number; keep decimals otherwise.
  if (Number.isInteger(n)) return String(Math.trunc(n));
  return cleaned.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

/** Display value for inputs — existing free text becomes digits-only. */
export function businessValueInputValue(raw: string | number | null | undefined): string {
  return normalizeBusinessValueForSave(raw);
}
