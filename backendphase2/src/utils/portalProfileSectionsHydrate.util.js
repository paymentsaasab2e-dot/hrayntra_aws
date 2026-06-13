/**
 * Load live work experience, skills, projects, and accomplishments from the
 * job-portal Mongo DB (backend1 collections) when tenant / candidatecommon rows
 * are sparse. Used by both AI and Applied match pipelines for identical enrichment.
 */

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    if (value == null) continue;
    if (typeof value === 'string' && !value.trim()) continue;
    if (Array.isArray(value) && !value.length) continue;
    return value;
  }
  return null;
}

function readObjectId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'object' && value.$oid) return String(value.$oid).trim() || null;
  return String(value).trim() || null;
}

function readDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.$date) {
    return typeof value.$date === 'string' ? value.$date : new Date(value.$date).toISOString();
  }
  return null;
}

function buildCandidateIdFilters(candidateId) {
  const idStr = String(candidateId || '').trim();
  if (!idStr) return [];
  const isObjectIdHex = /^[a-fA-F0-9]{24}$/.test(idStr);
  return isObjectIdHex
    ? [{ candidateId: { $oid: idStr } }, { candidateId: idStr }]
    : [{ candidateId: idStr }];
}

async function runPortalFind(portalClient, collection, candidateId, limit = 50) {
  if (!portalClient?.$runCommandRaw || !candidateId) return [];
  for (const filter of buildCandidateIdFilters(candidateId)) {
    try {
      const result = await portalClient.$runCommandRaw({
        find: collection,
        filter,
        limit,
      });
      const docs = result?.cursor?.firstBatch;
      if (Array.isArray(docs) && docs.length) return docs;
    } catch {
      /* try next filter */
    }
  }
  return [];
}

function mapPortalWorkRow(doc) {
  if (!doc || typeof doc !== 'object') return null;
  const title = String(doc.jobTitle || doc.job_title || doc.title || '').trim();
  const company = String(doc.company || doc.companyName || '').trim();
  if (!title && !company) return null;
  const responsibilities = String(doc.responsibilities || doc.description || '').trim();
  return {
    title,
    jobTitle: title,
    company,
    companyName: company,
    location: doc.workLocation || doc.work_location || doc.location || null,
    workLocation: doc.workLocation || doc.work_location || doc.location || null,
    startDate: readDate(doc.startDate || doc.start_date),
    endDate: readDate(doc.endDate || doc.end_date),
    isCurrentJob: Boolean(doc.isCurrentJob ?? doc.is_current_job),
    currentlyWorkHere: Boolean(doc.isCurrentJob ?? doc.is_current_job),
    responsibilities: responsibilities ? [responsibilities] : [],
    description: responsibilities || null,
  };
}

function mapPortalSkillRows(docs) {
  const names = [];
  for (const doc of docs) {
    const skillName = String(doc?.skill?.name || doc?.name || doc?.skillName || '').trim();
    if (skillName) names.push(skillName);
  }
  return [...new Set(names)];
}

function mapPortalProjectRows(docs) {
  return docs
    .map((doc) => ({
      title: doc.projectTitle || doc.project_title || doc.title || null,
      projectTitle: doc.projectTitle || doc.project_title || doc.title || null,
      projectType: doc.projectType || doc.project_type || null,
      description: doc.projectDescription || doc.project_description || doc.description || null,
      projectDescription: doc.projectDescription || doc.project_description || doc.description || null,
      link: doc.projectLink || doc.project_link || doc.url || null,
      url: doc.projectLink || doc.project_link || doc.url || null,
      technologies: Array.isArray(doc.technologies) ? doc.technologies : [],
      organization: doc.organizationClient || doc.organization_client || null,
    }))
    .filter((row) => row.title || row.projectTitle || row.description);
}

function mapPortalAccomplishmentRows(docs) {
  return docs
    .map((doc) => ({
      title: doc.title || doc.category || doc.achievementTitle || null,
      category: doc.category || doc.categoryType || null,
      organization: doc.organization || doc.awardedBy || doc.org || null,
      description: doc.description || null,
      date: doc.date || doc.yearReceived || null,
    }))
    .filter((row) => row.title || row.description);
}

function mergeSnapshotProjects(candidate, projectRows) {
  if (!projectRows.length) return;
  const extra =
    candidate.extraData && typeof candidate.extraData === 'object' && !Array.isArray(candidate.extraData)
      ? candidate.extraData
      : {};
  const snap =
    extra.phase1ProfileSnapshot && typeof extra.phase1ProfileSnapshot === 'object'
      ? extra.phase1ProfileSnapshot
      : {};
  const existing = Array.isArray(snap.projects) ? snap.projects : [];
  if (existing.length >= projectRows.length) return;
  candidate.extraData = {
    ...extra,
    phase1ProfileSnapshot: {
      ...snap,
      projects: projectRows,
    },
  };
}

function mergeSnapshotAccomplishments(candidate, accomplishmentRows) {
  if (!accomplishmentRows.length) return;
  const extra =
    candidate.extraData && typeof candidate.extraData === 'object' && !Array.isArray(candidate.extraData)
      ? candidate.extraData
      : {};
  const snap =
    extra.phase1ProfileSnapshot && typeof extra.phase1ProfileSnapshot === 'object'
      ? extra.phase1ProfileSnapshot
      : {};
  const existing = Array.isArray(snap.accomplishments) ? snap.accomplishments : [];
  if (existing.length >= accomplishmentRows.length) return;
  candidate.extraData = {
    ...extra,
    phase1ProfileSnapshot: {
      ...snap,
      accomplishments: accomplishmentRows,
    },
  };
}

async function hydrateOneCandidateFromPortal(candidate, portalClient) {
  if (!candidate?.id || !portalClient) return candidate;

  const id = String(candidate.id).trim();
  const existingWork = Array.isArray(candidate.cvWorkExperienceEntries)
    ? candidate.cvWorkExperienceEntries
    : [];

  if (!existingWork.length) {
    const workDocs = await runPortalFind(portalClient, 'work_experiences', id, 20);
    const mappedWork = workDocs.map(mapPortalWorkRow).filter(Boolean);
    if (mappedWork.length) {
      candidate.cvWorkExperienceEntries = mappedWork;
      const extra =
        candidate.extraData && typeof candidate.extraData === 'object' && !Array.isArray(candidate.extraData)
          ? candidate.extraData
          : {};
      const snap =
        extra.phase1ProfileSnapshot && typeof extra.phase1ProfileSnapshot === 'object'
          ? extra.phase1ProfileSnapshot
          : {};
      candidate.extraData = {
        ...extra,
        phase1ProfileSnapshot: {
          ...snap,
          workExperience: mappedWork,
        },
      };
    }
  }

  const skillDocs = await runPortalFind(portalClient, 'candidate_skills', id, 30);
  const portalSkills = mapPortalSkillRows(skillDocs);
  if (portalSkills.length) {
    candidate.skills = pickFirstNonEmpty(candidate.skills, portalSkills) || portalSkills;
    candidate.recruiterSkills =
      pickFirstNonEmpty(candidate.recruiterSkills, portalSkills) || portalSkills;
  }

  const projectDocs = await runPortalFind(portalClient, 'candidate_projects', id, 10);
  mergeSnapshotProjects(candidate, mapPortalProjectRows(projectDocs));

  const accomplishmentDocs = await runPortalFind(portalClient, 'candidate_accomplishments', id, 20);
  mergeSnapshotAccomplishments(candidate, mapPortalAccomplishmentRows(accomplishmentDocs));

  const summaryDocs = await runPortalFind(portalClient, 'candidate_summaries', id, 1);
  const portalSummary = String(summaryDocs[0]?.summaryText || summaryDocs[0]?.summary_text || '').trim();
  if (portalSummary && !String(candidate.cvSummary || '').trim()) {
    candidate.cvSummary = portalSummary;
  }

  return candidate;
}

/** Batch-hydrate portal profile sections for match-pipeline candidates. */
export async function batchHydratePortalProfileSections(candidates, portalClient) {
  if (!portalClient || !Array.isArray(candidates) || !candidates.length) return candidates;

  await Promise.all(
    candidates.map(async (candidate) => {
      try {
        await hydrateOneCandidateFromPortal(candidate, portalClient);
      } catch (err) {
        console.warn(
          '[portalProfileSectionsHydrate] failed for',
          candidate?.id,
          err?.message || err
        );
      }
    })
  );

  return candidates;
}
