const { prisma } = require('../lib/prisma');
const { mapLmsDraftToRecruiterCvFields } = require('./lmsTailoredCvMapper.service');

function getPhase2BaseUrl() {
  return (
    process.env.PHASE2_INTERNAL_API_URL ||
    process.env.PHASE2_API_URL ||
    process.env.PHASE2_BASE_URL ||
    'http://localhost:5001'
  );
}

function getPhase2SyncSecret() {
  return process.env.PHASE2_PORTAL_SYNC_SECRET || 'phase2-portal-sync-2026-shared-secret';
}

async function resolveTenantDbName(jobId) {
  let tenantDbName = null;
  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { tenantDbName: true },
    });
    tenantDbName = String(job?.tenantDbName || '').trim() || null;
  } catch (e) {
    console.warn('[TailoredCvSync] Could not read job.tenantDbName:', e?.message || e);
  }
  if (!tenantDbName) {
    tenantDbName = String(process.env.PHASE2_DEFAULT_TENANT_DB_NAME || '').trim() || null;
  }
  return tenantDbName;
}

async function loadTailoredCvForJob(candidateId, jobId) {
  const [roleVersion, studioDraft, candidate] = await Promise.all([
    prisma.lmsResumeRoleVersion.findFirst({
      where: { userId: candidateId, jobId: String(jobId) },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.lmsResumeDraft.findUnique({ where: { userId: candidateId } }),
    prisma.candidate.findUnique({
      where: { id: candidateId },
      select: {
        avatar: true,
        profile: { select: { profilePhotoUrl: true } },
      },
    }),
  ]);

  const avatarUrl =
    candidate?.profile?.profilePhotoUrl || candidate?.avatar || null;

  if (roleVersion?.draftSnapshot && typeof roleVersion.draftSnapshot === 'object') {
    return {
      draft: {
        ...roleVersion.draftSnapshot,
        templateId: roleVersion.templateId || roleVersion.draftSnapshot.templateId,
      },
      templateId: roleVersion.templateId || studioDraft?.templateId,
      jobTitle: roleVersion.jobTitle,
      company: roleVersion.company,
      resumeHtml: roleVersion.resumeHtml || null,
      avatarUrl,
      source: 'role-version',
    };
  }

  if (!studioDraft) return null;

  return {
    draft: {
      basics: studioDraft.basics,
      skills: studioDraft.skills,
      experience: studioDraft.experience,
      education: studioDraft.education,
      templateId: studioDraft.templateId,
    },
    templateId: studioDraft.templateId,
    jobTitle: null,
    company: null,
    resumeHtml: null,
    avatarUrl,
    source: 'studio-draft',
  };
}

/**
 * After a portal apply, push the role-tailored LMS CV into the Phase 2 tenant DB
 * so recruiters see it under Resume → Updated CV (not the original upload).
 */
async function syncTailoredCvToPhase2AfterApply(candidateId, jobId) {
  const tailored = await loadTailoredCvForJob(candidateId, jobId);
  if (!tailored?.draft) {
    console.log(`[TailoredCvSync] No tailored CV for candidateId=${candidateId} jobId=${jobId} — skipped`);
    return;
  }

  const tenantDbName = await resolveTenantDbName(jobId);
  if (!tenantDbName) {
    console.warn(
      `[TailoredCvSync] Skipped — no tenantDbName for job ${jobId}. Configure job.tenantDbName or PHASE2_DEFAULT_TENANT_DB_NAME.`,
    );
    return;
  }

  const cvPayload = mapLmsDraftToRecruiterCvFields(tailored.draft, {
    templateId: tailored.templateId,
    jobTitle: tailored.jobTitle,
    company: tailored.company,
    resumeHtml: tailored.resumeHtml,
    avatarUrl: tailored.avatarUrl,
  });
  if (!cvPayload) return;

  const url = `${String(getPhase2BaseUrl()).replace(/\/$/, '')}/api/v1/internal/sync-portal-tailored-cv`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-phase2-portal-sync-secret': getPhase2SyncSecret(),
      },
      body: JSON.stringify({
        tenantDbName,
        candidateId,
        jobId,
        cvPayload,
        source: tailored.source,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn('[TailoredCvSync] Phase2 HTTP error:', res.status, text);
      return;
    }

    console.log(
      `✅ Tailored CV synced to Phase2 | candidateId=${candidateId} jobId=${jobId} tenant=${tenantDbName} source=${tailored.source}`,
    );
  } catch (e) {
    console.warn('[TailoredCvSync] Phase2 request failed:', e?.message || e);
  }
}

module.exports = {
  loadTailoredCvForJob,
  syncTailoredCvToPhase2AfterApply,
};
