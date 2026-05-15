const { PrismaClient } = require('@prisma/client');

let candidateCommonClient = null;

/**
 * Mongo URL for the shared `candidatecommon` database.
 * Set CANDIDATE_COMMON_DATABASE_URL or defaults to same host with db name `candidatecommon`.
 */
function resolveCandidateCommonDatabaseUrl() {
  const explicit = String(process.env.CANDIDATE_COMMON_DATABASE_URL || '').trim();
  if (explicit) return explicit;

  const base = String(process.env.DATABASE_URL || '').trim();
  if (!base) return '';

  try {
    const parsed = new URL(base);
    parsed.pathname = '/candidatecommon';
    return parsed.toString();
  } catch {
    return '';
  }
}

function getCandidateCommonPrisma() {
  const url = resolveCandidateCommonDatabaseUrl();
  if (!url) return null;

  if (!candidateCommonClient) {
    candidateCommonClient = new PrismaClient({
      datasources: { db: { url } },
      log: process.env.NODE_ENV === 'development' ? ['warn'] : ['error'],
    });
  }

  return candidateCommonClient;
}

module.exports = {
  getCandidateCommonPrisma,
  resolveCandidateCommonDatabaseUrl,
};
