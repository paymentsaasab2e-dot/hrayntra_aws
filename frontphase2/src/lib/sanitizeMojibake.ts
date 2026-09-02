const GARBLED_EM_DASH = /Ã¢â‚¬â€[\u009d\u201c\u201d\u2014]?/g;
const GARBLED_ELLIPSIS = /Ã¢â‚¬Â¦/g;
const GARBLED_MIDDOT = /Ã‚Â·/g;
const GARBLED_CHECK = /Ã¢Å“â€œ/g;
const SINGLE_EM_DASH = /â€”/g;
const SINGLE_EN_DASH = /â€“/g;
const SINGLE_ELLIPSIS = /â€¦/g;
const SINGLE_MIDDOT = /Â·/g;
const LEFTOVER_MOJIBAKE = /Ã¢|Ã‚|â‚¬|â€\u009d/;

const SKIP_KEY_RE = /token|password|secret|authorization|hash|signature|otp|pin\b/i;

function hasMojibakeGlyphs(value: string): boolean {
  return /[ÃÂ]/.test(value) || value.includes('â€') || value.includes('\u009d');
}

function decodeLatin1AsUtf8(input: string): string | null {
  const bytes = new Uint8Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    if (code > 255) return null;
    bytes[i] = code;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function applyKnownGlyphFixes(value: string): string {
  return value
    .replace(GARBLED_EM_DASH, '—')
    .replace(GARBLED_ELLIPSIS, '…')
    .replace(GARBLED_MIDDOT, '·')
    .replace(GARBLED_CHECK, '✓')
    .replace(SINGLE_EM_DASH, '—')
    .replace(SINGLE_EN_DASH, '–')
    .replace(SINGLE_ELLIPSIS, '…')
    .replace(SINGLE_MIDDOT, '·');
}

/** Repair UTF-8/Latin-1 mojibake such as `Ã¢â‚¬â€` → `—` and `Ã‚Â·` → `·`. */
export function sanitizeMojibakeText(value: string): string {
  let text = applyKnownGlyphFixes(value);
  for (let i = 0; i < 4; i += 1) {
    const next = decodeLatin1AsUtf8(text);
    if (!next || next === text) break;
    text = applyKnownGlyphFixes(next);
  }
  if (LEFTOVER_MOJIBAKE.test(text)) {
    text = applyKnownGlyphFixes(text).replace(/Ã¢[^\sA-Za-z0-9]{0,16}/g, '—');
  }
  return text;
}

export function looksLikeMojibake(value: string): boolean {
  return hasMojibakeGlyphs(value) || LEFTOVER_MOJIBAKE.test(value);
}

/** Empty or still-garbled values become an em dash for UI. */
export function cleanDisplayText(value?: string | null, fallback = '—'): string {
  if (value == null) return fallback;
  const trimmed = String(value).trim();
  if (!trimmed) return fallback;
  const cleaned = looksLikeMojibake(trimmed) ? sanitizeMojibakeText(trimmed).trim() : trimmed;
  if (!cleaned || looksLikeMojibake(cleaned)) return fallback;
  return cleaned;
}

export function sanitizeMojibakeDeep<T>(value: T, key = ''): T {
  if (typeof value === 'string') {
    if (SKIP_KEY_RE.test(key) || !hasMojibakeGlyphs(value)) return value;
    return sanitizeMojibakeText(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMojibakeDeep(item, key)) as T;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return value;
    const next: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of entries) {
      next[entryKey] = sanitizeMojibakeDeep(entryValue, entryKey);
    }
    return next as T;
  }
  return value;
}
