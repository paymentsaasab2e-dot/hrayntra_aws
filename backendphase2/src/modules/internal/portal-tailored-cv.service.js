import { prisma, runWithTenantContext, getJobPortalPrismaClient } from '../../config/prisma.js';
import { mergeCandidateRecruiterExtraData } from '../../utils/candidateRecruiterCvExtra.util.js';

function parseExtra(extraData) {
  if (!extraData || typeof extraData !== 'object' || Array.isArray(extraData)) return {};
  return extraData;
}

/**
 * Persist a role-tailored CV from the job portal (Phase 1 LMS editor) onto the
 * tenant candidate so Phase 2 Resume tab shows Updated CV after apply.
 */
export async function applyPortalTailoredCvSync({
  tenantDbName,
  candidateId,
  jobId,
  cvPayload,
  source = 'job-portal-tailor-apply',
}) {
  const tdb = String(tenantDbName || '').trim();
  const candId = String(candidateId || '').trim();
  const jId = String(jobId || '').trim();
  if (!tdb) throw new Error('tenantDbName is required');
  if (!candId || !jId) throw new Error('candidateId and jobId are required');
  if (!cvPayload || typeof cvPayload !== 'object') throw new Error('cvPayload is required');

  return runWithTenantContext(tdb, async () => {
    const existing = await prisma.candidate.findUnique({
      where: { id: candId },
      select: { id: true, extraData: true, isDeleted: true },
    });

    if (!existing || existing.isDeleted === true) {
      const portal = getJobPortalPrismaClient();
      const portalCand = await portal.candidate.findUnique({
        where: { id: candId },
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          linkedIn: true,
          resumeUrl: true,
          location: true,
          city: true,
          country: true,
          currentTitle: true,
          currentCompany: true,
          avatar: true,
          designation: true,
        },
      });
      if (!portalCand) {
        throw new Error('Candidate not found in tenant database');
      }
      await prisma.candidate.create({
        data: {
          id: candId,
          firstName: portalCand.firstName || null,
          lastName: portalCand.lastName || null,
          email: portalCand.email || null,
          phone: portalCand.phone || null,
          linkedIn: portalCand.linkedIn || null,
          resumeUrl: portalCand.resumeUrl || null,
          resume: portalCand.resumeUrl || null,
          location: portalCand.location || null,
          city: portalCand.city || null,
          country: portalCand.country || null,
          currentTitle: portalCand.currentTitle || null,
          currentCompany: portalCand.currentCompany || null,
          avatar: portalCand.avatar || null,
          designation: portalCand.designation || null,
          source: 'Job Portal',
          stage: 'Applied',
          status: 'ACTIVE',
          assignedJobs: [jId],
          lastActivity: new Date(),
        },
      });
    }

    const existingExtra = parseExtra(existing.extraData);
    const savedAt = new Date().toISOString();
    const mergedExtra = mergeCandidateRecruiterExtraData(existingExtra, {
      ...existingExtra,
      portalAiCvSaved: true,
      portalAiCvSavedAt: savedAt,
      resumeCvViewMode: 'ai',
      cvEditorLayout: cvPayload.cvEditorLayout ?? existingExtra.cvEditorLayout ?? null,
      portalStudioTemplateId: cvPayload.portalStudioTemplateId || null,
      portalTailoredCvHtml: cvPayload.portalTailoredCvHtml || null,
      portalTailoredCv: {
        jobId: jId,
        jobTitle: cvPayload.jobTitle || null,
        company: cvPayload.company || null,
        appliedAt: savedAt,
        source,
        hasStudioHtml: Boolean(cvPayload.portalTailoredCvHtml),
        studioTemplateId: cvPayload.portalStudioTemplateId || null,
      },
    });

    await prisma.candidate.update({
      where: { id: candId },
      data: {
        firstName: cvPayload.firstName ?? null,
        lastName: cvPayload.lastName ?? null,
        email: cvPayload.email ?? null,
        phone: cvPayload.phone ?? null,
        linkedIn: cvPayload.linkedIn ?? null,
        currentTitle: cvPayload.currentTitle ?? null,
        designation: cvPayload.currentTitle ?? null,
        location: cvPayload.location ?? null,
        cvSummary: cvPayload.cvSummary ?? null,
        skills: Array.isArray(cvPayload.skills) ? cvPayload.skills : [],
        recruiterSkills: Array.isArray(cvPayload.recruiterSkills)
          ? cvPayload.recruiterSkills
          : Array.isArray(cvPayload.skills)
            ? cvPayload.skills
            : [],
        cvWorkExperienceEntries: Array.isArray(cvPayload.cvWorkExperienceEntries)
          ? cvPayload.cvWorkExperienceEntries
          : [],
        cvEducationEntries: Array.isArray(cvPayload.cvEducationEntries)
          ? cvPayload.cvEducationEntries
          : [],
        ...(cvPayload.avatar ? { avatar: cvPayload.avatar } : {}),
        extraData: mergedExtra,
        lastActivity: new Date(),
      },
    });

    return { candidateId: candId, jobId: jId, resumeCvViewMode: 'ai' };
  });
}
