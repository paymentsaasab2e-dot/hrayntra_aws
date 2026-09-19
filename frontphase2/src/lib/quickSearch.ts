/**
 * Google-like quick search helpers for Phase 2.
 * - Partial / substring match (type a few letters)
 * - Multi-token AND across a haystack (e.g. "john bang" → John in Bangalore)
 * - Light normalization (case, punctuation, accents)
 * - Relevance scoring so title hits sort above weak body matches
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

export function scoreFieldRelevance(
  query: unknown,
  fields: { primary?: unknown; secondary?: unknown[]; tertiary?: unknown[] } = {},
): number {
  const tokens = tokenizeQuickSearch(query);
  if (!tokens.length) return 0;

  const phrase = tokens.join(' ');
  const primary = normalizeQuickSearchText(fields.primary);
  const secondary = normalizeQuickSearchText(
    (fields.secondary || []).filter((v) => v != null && v !== '').map((v) => String(v)).join(' '),
  );
  const tertiary = normalizeQuickSearchText(
    (fields.tertiary || []).filter((v) => v != null && v !== '').map((v) => String(v)).join(' '),
  );

  let score = 0;

  if (primary) {
    if (primary === phrase) score += 1000;
    else if (primary.startsWith(phrase)) score += 850;
    else if (primary.includes(phrase)) score += 700;
    else {
      let hits = 0;
      for (const token of tokens) {
        if (primary.includes(token)) hits += 1;
      }
      if (hits === tokens.length) score += 500;
      else score += hits * 120;
    }
  }

  if (secondary) {
    if (secondary.includes(phrase)) score += 250;
    else {
      for (const token of tokens) {
        if (secondary.includes(token)) score += 80;
      }
    }
  }

  if (tertiary) {
    if (tertiary.includes(phrase)) score += 80;
    else {
      for (const token of tokens) {
        if (tertiary.includes(token)) score += 25;
      }
    }
  }

  return score;
}

export function sortByQuickSearchRelevance<T>(
  items: T[],
  query: unknown,
  getFields: (item: T) => { primary?: unknown; secondary?: unknown[]; tertiary?: unknown[] },
  getDate?: (item: T) => unknown,
): T[] {
  const tokens = tokenizeQuickSearch(query);
  if (!tokens.length) return items;
  return [...items].sort((a, b) => {
    const scoreDiff = scoreFieldRelevance(query, getFields(b)) - scoreFieldRelevance(query, getFields(a));
    if (scoreDiff !== 0) return scoreDiff;
    if (!getDate) return 0;
    return new Date(String(getDate(b) || 0)).getTime() - new Date(String(getDate(a) || 0)).getTime();
  });
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
