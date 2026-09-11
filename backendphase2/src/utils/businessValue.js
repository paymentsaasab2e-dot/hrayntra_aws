/**
 * Expected Business Value — store digits only (optional decimal) as a string.
 */
export function normalizeBusinessValue(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null;
    return Number.isInteger(value) ? String(Math.trunc(value)) : String(value);
  }
  let out = '';
  let seenDot = false;
  for (const ch of String(value).replace(/,/g, '')) {
    if (ch >= '0' && ch <= '9') {
      out += ch;
      continue;
    }
    if (ch === '.' && !seenDot) {
      out += '.';
      seenDot = true;
    }
  }
  if (!out || out === '.') return null;
  const n = Number(out);
  if (!Number.isFinite(n) || n < 0) return null;
  if (Number.isInteger(n)) return String(Math.trunc(n));
  return out.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') || null;
}
