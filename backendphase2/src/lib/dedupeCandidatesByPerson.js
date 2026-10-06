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
  return score;
}

function resolveDedupeKey(row) {
  const personId = String(row?.personId || '').trim();
  if (personId) return personId;

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
 * - Same email is never returned twice.
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
      if (!preferTenant) continue;
      const current = seen.get(key);
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
