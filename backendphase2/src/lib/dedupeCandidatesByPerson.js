import { normalizeEmail, normalizePhoneE164 } from './personIdentity.js';

function isPhase1OnlySource(source) {
  return source === 'phase1' || source === 'common' || source === 'pool';
}

function tenantRowScore(row) {
  let score = 0;
  // Rows already materialized into the tenant CRM carry status / assigned jobs.
  if (row?.status && row.status !== 'ACTIVE' && String(row.status).trim()) score += 2;
  if (row?.source && !isPhase1OnlySource(row.source)) score += 1;
  if (Array.isArray(row?.assignedJobs) && row.assignedJobs.length > 0) score += 1;
  // Prefer Applied/pipeline stages over empty New discovery when collapsing true dupes.
  const stage = String(row?.stage || '').trim().toLowerCase();
  if (stage && stage !== 'new') score += 1;
  return score;
}

function normalizePersonName(row) {
  return [row?.firstName, row?.lastName]
    .map((part) => String(part || '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameTokens(row) {
  return new Set(
    normalizePersonName(row)
      .split(/\s+/)
      .map((t) => t.replace(/[^a-z]/g, ''))
      .filter((t) => t.length > 1 && t !== 'candidate'),
  );
}

/**
 * Shared email/phone must not collapse clearly different people
 * (e.g. "rushabh Candidate" + "Himanshu Ghode" both using ghodehimanshu453@…).
 */
export function namesLikelySamePerson(a, b) {
  const na = normalizePersonName(a);
  const nb = normalizePersonName(b);
  if (!na || !nb) return true;
  if (na === nb) return true;

  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.size || !tb.size) return true;

  let overlap = 0;
  for (const token of ta) {
    if (tb.has(token)) overlap += 1;
  }
  if (overlap === 0) return false;

  const minSize = Math.min(ta.size, tb.size);
  return overlap / minSize >= 0.5;
}

function resolveDedupeKey(row) {
  const personId = String(row?.personId || '').trim();
  if (personId) return `person|${personId}`;

  const emailNormalized = String(row?.emailNormalized || '').trim();
  const email = emailNormalized || normalizeEmail(row?.email);
  if (email) return `email|${email}`;

  const phoneE164 = String(row?.phoneE164 || '').trim();
  const phone = phoneE164 || normalizePhoneE164(row?.phone);
  if (phone) return `phone|${phone}`;

  const id = String(row?.id || '').trim();
  return id ? `id|${id}` : '';
}

/**
 * Deduplicate candidate-shaped rows by person identity.
 * - Skips isDeleted === true rows.
 * - First match wins, unless a later collision is a stronger tenant CRM row.
 * - Email/phone collisions with clearly different names are kept as separate people.
 */
export function dedupeCandidatesByPerson(rows, options = {}) {
  const { preferTenant = true } = options;
  const seen = new Map();
  const result = [];

  for (const row of rows || []) {
    if (!row) continue;
    if (row.isDeleted === true) continue;

    const key = resolveDedupeKey(row);
    if (!key) continue;

    if (seen.has(key)) {
      const current = seen.get(key);
      // Wrong shared contact info across different humans — keep both.
      if (
        (key.startsWith('email|') || key.startsWith('phone|')) &&
        !namesLikelySamePerson(current, row)
      ) {
        const idKey = `id|${String(row.id || '').trim()}`;
        if (!idKey || idKey === 'id|' || seen.has(idKey)) continue;
        seen.set(idKey, row);
        result.push(row);
        continue;
      }

      if (!preferTenant) continue;
      if (tenantRowScore(row) > tenantRowScore(current)) {
        const idx = result.indexOf(current);
        if (idx !== -1) result[idx] = row;
        seen.set(key, row);
      }
      continue;
    }

    seen.set(key, row);
    result.push(row);
  }

  return result;
}
