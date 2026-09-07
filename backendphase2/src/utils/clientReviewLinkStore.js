import { prisma, getActiveTenantDbName, runWithTenantContext } from '../config/prisma.js';
import { mergeCvSubmissionExtraData } from './clientTrackerOptions.js';

function submissionOf(extraData) {
  const extra =
    extraData && typeof extraData === 'object' && !Array.isArray(extraData) ? extraData : {};
  const submission =
    extra.cvSubmission && typeof extra.cvSubmission === 'object' && !Array.isArray(extra.cvSubmission)
      ? extra.cvSubmission
      : {};
  return { extra, submission };
}

function shareFromDoc(doc, tenantDbName) {
  if (!doc) return null;
  const { submission } = submissionOf(doc.extraData);
  const code = String(submission.reviewCode || '').trim().toLowerCase();
  const token = String(submission.reviewToken || '').trim();
  if (!code || !token) return null;
  return {
    id: String(doc.id || doc._id?.$oid || doc._id || ''),
    code,
    token,
    tenantDbName: tenantDbName || null,
    matchId: submission.reviewMatchId || null,
    candidateId: String(doc.id || doc._id?.$oid || doc._id || ''),
    interviewId: submission.reviewInterviewId || null,
    expiresAt: null,
  };
}

async function listTenantDbNames() {
  try {
    const { headquartersAuthService } = await import('../modules/auth/headquarters-auth.service.js');
    const tenants = await headquartersAuthService.listTenants();
    return Array.from(
      new Set(
        (tenants || [])
          .map((row) => String(row?.tenantDbName || '').trim())
          .filter(Boolean),
      ),
    );
  } catch (err) {
    console.warn('[client-review] tenant list failed:', err?.message || err);
    return [];
  }
}

async function searchShareInCurrentDb(code) {
  const value = String(code || '').trim().toLowerCase();
  if (!value) return null;

  try {
    const result = await prisma.$runCommandRaw({
      find: 'candidates',
      filter: { 'extraData.cvSubmission.reviewCode': value },
      projection: { extraData: 1 },
      limit: 1,
    });
    const doc = result?.cursor?.firstBatch?.[0];
    if (doc) return shareFromDoc(doc, getActiveTenantDbName() || null);
  } catch (err) {
    console.warn('[client-review] candidate code lookup failed:', err?.message || err);
  }

  return null;
}

export async function findClientReviewLinkByCode(code) {
  const value = String(code || '').trim().toLowerCase();
  if (!value) return null;

  const direct = await searchShareInCurrentDb(value);
  if (direct) return direct;

  const dash = value.lastIndexOf('-');
  if (dash > 0) {
    const tenantDbName = value.slice(0, dash);
    if (tenantDbName) {
      const found = await runWithTenantContext(tenantDbName, () => searchShareInCurrentDb(value));
      if (found) return { ...found, tenantDbName };
    }
  }

  const seen = new Set();
  const tenants = await listTenantDbNames();
  for (const tenantDbName of tenants) {
    if (!tenantDbName || seen.has(tenantDbName)) continue;
    seen.add(tenantDbName);
    const found = await runWithTenantContext(tenantDbName, () => searchShareInCurrentDb(value));
    if (found) return { ...found, tenantDbName };
  }

  return null;
}

export async function findReusableClientReviewLink({ candidateId } = {}) {
  const id = String(candidateId || '').trim();
  if (!id) return null;
  const candidate = await prisma.candidate.findUnique({
    where: { id },
    select: { id: true, extraData: true },
  });
  return shareFromDoc(candidate, getActiveTenantDbName() || null);
}

export async function persistClientReviewShareOnCandidate({
  code,
  token,
  candidateId,
  matchId = null,
  interviewId = null,
} = {}) {
  const id = String(candidateId || '').trim();
  if (!id) throw new Error('Missing candidate for short review link');

  const candidate = await prisma.candidate.findUnique({
    where: { id },
    select: { extraData: true },
  });
  if (!candidate) throw new Error('Candidate not found');

  await prisma.candidate.update({
    where: { id },
    data: {
      extraData: mergeCvSubmissionExtraData(candidate.extraData, {
        reviewCode: code,
        reviewToken: token,
        reviewMatchId: matchId || null,
        reviewInterviewId: interviewId || null,
      }),
    },
  });

  return code;
}
