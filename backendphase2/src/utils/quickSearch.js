/**
 * Google-like quick search helpers for Phase 2 list APIs.
 * Multi-token AND: each token must match at least one of the provided field clauses.
 */

import { escapePrismaRegex } from './escapePrismaRegex.js';

export function normalizeQuickSearchText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9@.+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeQuickSearch(query, minTokenLength = 2) {
  const normalized = normalizeQuickSearchText(query);
  if (!normalized) return [];
  const tokens = normalized.split(' ').filter((token) => token.length >= minTokenLength);
  // Single short token (1 char): still allow contains for that one token.
  if (!tokens.length && normalized.length === 1) return [normalized];
  if (!tokens.length && normalized.length > 0) return [normalized];
  return tokens;
}

export function matchesQuickSearch(haystack, query) {
  const tokens = tokenizeQuickSearch(query, 1);
  if (!tokens.length) return true;
  const hay = normalizeQuickSearchText(haystack);
  if (!hay) return false;
  const phrase = tokens.join(' ');
  if (hay.includes(phrase)) return true;
  return tokens.every((token) => hay.includes(token));
}

/**
 * Relevance score so title / primary hits sort above description-only noise.
 * @param {string} query
 * @param {{ primary?: unknown, secondary?: unknown[], tertiary?: unknown[] }} fields
 */
export function scoreFieldRelevance(query, fields = {}) {
  const tokens = tokenizeQuickSearch(query, 1);
  if (!tokens.length) return 0;

  const phrase = tokens.join(' ');
  const primary = normalizeQuickSearchText(fields.primary);
  const secondary = normalizeQuickSearchText(
    (Array.isArray(fields.secondary) ? fields.secondary : [fields.secondary])
      .filter((v) => v != null && v !== '')
      .map((v) => String(v))
      .join(' '),
  );
  const tertiary = normalizeQuickSearchText(
    (Array.isArray(fields.tertiary) ? fields.tertiary : [fields.tertiary])
      .filter((v) => v != null && v !== '')
      .map((v) => String(v))
      .join(' '),
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

export function compareRelevanceThenDate(aScore, bScore, aDate, bDate) {
  const scoreDiff = (Number(bScore) || 0) - (Number(aScore) || 0);
  if (scoreDiff !== 0) return scoreDiff;
  return new Date(bDate || 0).getTime() - new Date(aDate || 0).getTime();
}

/**
 * @param {string} search
 * @param {(escapedToken: string, rawToken: string) => object[]} buildFieldClauses
 *        Returns Prisma OR clauses for one token.
 * @returns {object|null} Prisma where fragment
 */
export function buildTokenAndSearchWhere(search, buildFieldClauses) {
  const raw = String(search || '').trim();
  if (!raw) return null;
  const tokens = tokenizeQuickSearch(raw, 1);
  if (!tokens.length) return null;

  const andParts = tokens.map((token) => {
    const escaped = escapePrismaRegex(token);
    const clauses = buildFieldClauses(escaped, token) || [];
    if (!clauses.length) return null;
    return clauses.length === 1 ? clauses[0] : { OR: clauses };
  }).filter(Boolean);

  if (!andParts.length) return null;
  if (andParts.length === 1) return andParts[0];
  return { AND: andParts };
}
