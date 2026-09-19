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
