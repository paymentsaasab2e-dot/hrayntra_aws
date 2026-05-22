import 'dotenv/config';
import { runWithTenantContext, prisma, getJobPortalPrismaClient } from '../src/config/prisma.js';
import { fetchCandidateCommonForCandidatesList } from '../src/services/candidateCommon/candidateCommonPool.service.js';

function isPhase1CandidateSource(source) {
  return String(source || '').trim().toLowerCase() === 'phase1';
}

function candidateHasRealJobLink(candidate) {
  if (!candidate) return false;
  const assigned = Array.isArray(candidate.assignedJobs) ? candidate.assignedJobs : [];
  if (assigned.some((id) => String(id || '').trim())) return true;
  if (Array.isArray(candidate.applications) && candidate.applications.length > 0) return true;
  if (Array.isArray(candidate.pipelineEntries) && candidate.pipelineEntries.length > 0) return true;
  return false;
}

function candidateHasListIdentity(candidate) {
  return (
    Boolean(String(candidate?.firstName || '').trim()) ||
    Boolean(String(candidate?.lastName || '').trim()) ||
    Boolean(String(candidate?.email || '').trim())
  );
}

function shouldShowOnCrmCandidatesList(candidate, options = {}) {
  if (!candidate) return false;
  const includeCommonPool = options.includeCommonPool === true;
  if (isPhase1CandidateSource(candidate.source) && !candidateHasRealJobLink(candidate)) {
    if (includeCommonPool) return candidateHasListIdentity(candidate);
    return false;
  }
  if (!candidateHasListIdentity(candidate) && !candidateHasRealJobLink(candidate)) return false;
  return true;
}

await runWithTenantContext('rus01', async () => {
  const tenantAll = await prisma.candidate.findMany({
    where: { isDeleted: { not: true } },
    select: { id: true, firstName: true, lastName: true, email: true, source: true, stage: true },
  });
  console.log('\n=== rus01 tenant candidates (not deleted) ===', tenantAll.length);
  console.log(JSON.stringify(tenantAll, null, 2));

  const portalPrisma = getJobPortalPrismaClient();
  const portalRow = await portalPrisma.candidate.findUnique({
    where: { id: 'b1c869d84e75048c5c61c5e3' },
    select: { id: true, firstName: true, lastName: true, email: true, source: true, assignedJobs: true },
  });
  console.log('\n=== job portal candidate b1c869 ===');
  console.log(portalRow);

  const common = await fetchCandidateCommonForCandidatesList({});
  const rushabh = common[0];
  console.log('\n=== shouldShow rushabh? ===', shouldShowOnCrmCandidatesList(rushabh, { includeCommonPool: true }));

  await portalPrisma.$disconnect();
});

await prisma.$disconnect();
