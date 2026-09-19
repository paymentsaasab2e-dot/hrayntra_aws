/**
 * Google-like quick search helpers for Phase 2.
 * - Partial / substring match (type a few letters)
 * - Multi-token AND across a haystack (e.g. "john bang" → John in Bangalore)
 * - Light normalization (case, punctuation, accents)
 */

export function normalizeQuickSearchText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9@.+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeQuickSearch(query: unknown, minTokenLength = 1): string[] {
  const normalized = normalizeQuickSearchText(query);
  if (!normalized) return [];
  return normalized.split(' ').filter((token) => token.length >= minTokenLength);
}

/** True when every query token appears somewhere in the haystack (order-independent). */
export function matchesQuickSearch(haystack: unknown, query: unknown): boolean {
  const tokens = tokenizeQuickSearch(query);
  if (!tokens.length) return true;
  const hay = normalizeQuickSearchText(haystack);
  if (!hay) return false;
  const phrase = tokens.join(' ');
  if (hay.includes(phrase)) return true;
  return tokens.every((token) => hay.includes(token));
}

/** Build a searchable string from many fields / arrays. */
export function buildQuickSearchHaystack(...parts: unknown[]): string {
  const chunks: string[] = [];
  for (const part of parts) {
    if (part == null) continue;
    if (Array.isArray(part)) {
      for (const item of part) {
        if (item == null) continue;
        chunks.push(String(item));
      }
      continue;
    }
    if (typeof part === 'object') {
      try {
        chunks.push(JSON.stringify(part));
      } catch {
        chunks.push(String(part));
      }
      continue;
    }
    chunks.push(String(part));
  }
  return chunks.join(' ');
}

export function filterByQuickSearch<T>(
  items: T[],
  query: unknown,
  getHaystack: (item: T) => unknown,
): T[] {
  const tokens = tokenizeQuickSearch(query);
  if (!tokens.length) return items;
  return items.filter((item) => matchesQuickSearch(getHaystack(item), query));
}
