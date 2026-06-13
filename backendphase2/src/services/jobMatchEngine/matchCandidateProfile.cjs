// Shared candidate profile text + JSON parsing for AI / Applied match pipelines.

function parseJsonArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function joinList(items) {
  return items
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join(', ');
}

function formatWorkEntry(entry) {
  const title = entry?.title || entry?.jobTitle || entry?.role || '';
  const company = entry?.company || entry?.companyName || '';
  const location = entry?.location || entry?.workLocation || '';
  const start = entry?.startDate || '';
  const end = entry?.endDate || (entry?.isCurrentJob || entry?.currentlyWorkHere ? 'Present' : '');
  const responsibilities = Array.isArray(entry?.responsibilities)
    ? entry.responsibilities.join('; ')
    : String(entry?.description || entry?.keyResponsibilities || '').trim();
  const header = [title, company ? `at ${company}` : '', location ? `(${location})` : '']
    .filter(Boolean)
    .join(' ');
  const dates = start || end ? ` [${[start, end].filter(Boolean).join(' – ')}]` : '';
  return `${header}${dates}${responsibilities ? `: ${responsibilities}` : ''}`.trim();
}

function formatEducationEntry(entry) {
  const qualification =
    entry?.qualification || entry?.degree || entry?.degreeProgram || entry?.program || '';
  const school =
    entry?.institution || entry?.institutionName || entry?.school || entry?.university || '';
  const field = entry?.field || entry?.fieldOfStudy || entry?.major || '';
  const start = entry?.startDate || '';
  const end = entry?.endDate || (entry?.currentlyStudying ? 'Present' : '');
  const dates = start || end ? ` (${[start, end].filter(Boolean).join(' – ')})` : '';
  return [qualification, field, school ? `at ${school}` : '', dates].filter(Boolean).join(' ').trim();
}

function extractSnapshotSections(extraData) {
  const extra =
    extraData && typeof extraData === 'object' && !Array.isArray(extraData) ? extraData : {};
  const snap =
    extra.phase1ProfileSnapshot && typeof extra.phase1ProfileSnapshot === 'object'
      ? extra.phase1ProfileSnapshot
      : null;
  if (!snap) return { projects: [], accomplishments: [], internships: [], work: [], education: [], skills: [], languages: [] };

  const projects = parseJsonArray(snap.projects || snap.projectEntries);
  const accomplishments = parseJsonArray(snap.accomplishments || snap.accomplishmentEntries);
  const internships = parseJsonArray(snap.internships || snap.internshipEntries);
  const work = parseJsonArray(snap.workExperience || snap.workExperienceEntries);
  const education = parseJsonArray(snap.education || snap.educationEntries);
  const skillRows = parseJsonArray(snap.skills);
  const skills = skillRows
    .map((row) => (typeof row === 'string' ? row : row?.name || row?.skill || ''))
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  const langRows = parseJsonArray(snap.languages);
  const languages = langRows
    .map((row) => (typeof row === 'string' ? row : row?.name || row?.language || ''))
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  return { projects, accomplishments, internships, work, education, skills, languages };
}

function buildMatchPipelineCandidateText(raw) {
  if (!raw) return '';

  const parts = [];
  const summary = String(raw.cvSummary || raw.notes || raw.recruiterNotes || '').trim();
  if (summary) parts.push(`Professional summary: ${summary}`);

  const work = parseJsonArray(raw.cvWorkExperienceEntries);
  const snapshotSections = extractSnapshotSections(raw.extraData);
  const workEntries = work.length ? work : snapshotSections.work;
  if (workEntries.length) {
    parts.push(`Work experience:\n${workEntries.map(formatWorkEntry).filter(Boolean).join('\n')}`);
  }

  const education = parseJsonArray(raw.cvEducationEntries);
  const educationEntries = education.length ? education : snapshotSections.education;
  if (educationEntries.length) {
    parts.push(`Education:\n${educationEntries.map(formatEducationEntry).filter(Boolean).join('\n')}`);
  }

  const skills = [
    ...(Array.isArray(raw.skills) ? raw.skills : []),
    ...(Array.isArray(raw.recruiterSkills) ? raw.recruiterSkills : []),
    ...(Array.isArray(raw.certificationsList) ? raw.certificationsList : []),
    ...(Array.isArray(raw.certifications) ? raw.certifications : []),
    ...snapshotSections.skills,
  ];
  const skillText = joinList(skills);
  if (skillText) parts.push(`Skills: ${skillText}`);

  const languages = [
    ...(Array.isArray(raw.languages) ? raw.languages : []),
    ...(Array.isArray(raw.recruiterLanguages) ? raw.recruiterLanguages : []),
    ...snapshotSections.languages,
  ];
  const langText = joinList(languages);
  if (langText) parts.push(`Languages: ${langText}`);

  const portfolio = parseJsonArray(raw.cvPortfolioLinks);
  if (portfolio.length) {
    const links = portfolio
      .map((row) => {
        if (typeof row === 'string') return row;
        return [row?.label || row?.title, row?.url || row?.link].filter(Boolean).join(' ');
      })
      .filter(Boolean);
    if (links.length) parts.push(`Portfolio: ${links.join(' | ')}`);
  }

  const { projects, accomplishments, internships } = snapshotSections;
  if (projects.length) {
    parts.push(
      `Projects:\n${projects
        .map((p) => {
          const title = p?.title || p?.projectTitle || p?.name || '';
          const desc = p?.description || p?.projectDescription || '';
          const link = p?.link || p?.url || p?.projectLink || '';
          return [title, desc, link].filter(Boolean).join(' — ');
        })
        .filter(Boolean)
        .join('\n')}`
    );
  }
  if (internships.length) {
    parts.push(
      `Internships:\n${internships
        .map((row) => formatWorkEntry(row))
        .filter(Boolean)
        .join('\n')}`
    );
  }
  if (accomplishments.length) {
    parts.push(
      `Accomplishments:\n${accomplishments
        .map((row) => {
          const title = row?.title || row?.name || row?.category || '';
          const org = row?.organization || row?.org || '';
          const desc = row?.description || '';
          return [title, org ? `(${org})` : '', desc].filter(Boolean).join(' ');
        })
        .filter(Boolean)
        .join('\n')}`
    );
  }

  const cp =
    raw.careerPreferences && typeof raw.careerPreferences === 'object' && !Array.isArray(raw.careerPreferences)
      ? raw.careerPreferences
      : null;
  if (cp) {
    const prefParts = [];
    if (cp.currentRole) prefParts.push(`Current role: ${cp.currentRole}`);
    if (cp.preferredRoles?.length) prefParts.push(`Preferred roles: ${joinList(cp.preferredRoles)}`);
    if (cp.preferredLocations?.length) prefParts.push(`Preferred locations: ${joinList(cp.preferredLocations)}`);
    if (cp.preferredWorkMode) prefParts.push(`Preferred work mode: ${cp.preferredWorkMode}`);
    if (cp.availabilityToStart) prefParts.push(`Availability: ${cp.availabilityToStart}`);
    if (prefParts.length) parts.push(`Career preferences: ${prefParts.join('; ')}`);
  }

  if (raw.currentTitle || raw.currentCompany) {
    parts.push(
      `Current position: ${[raw.currentTitle || raw.designation, raw.currentCompany].filter(Boolean).join(' at ')}`
    );
  }
  if (raw.location || raw.city || raw.country) {
    parts.push(
      `Location: ${[raw.location, raw.city, raw.country].map((v) => String(v || '').trim()).filter(Boolean).join(', ')}`
    );
  }

  return parts.join('\n\n').trim();
}

function buildWorkHistoryFromRaw(raw) {
  const cv = parseJsonArray(raw?.cvWorkExperienceEntries);
  const snapshotWork = extractSnapshotSections(raw?.extraData).work;
  const entries = cv.length ? cv : snapshotWork;
  return entries.map((e) => ({
    title: e.title || e.jobTitle || e.role,
    company: e.company || e.companyName,
    location: e.location || e.workLocation,
    description: Array.isArray(e.responsibilities)
      ? e.responsibilities.join(' ')
      : String(e.description || e.keyResponsibilities || '').trim(),
  }));
}

module.exports = {
  parseJsonArray,
  extractSnapshotSections,
  buildMatchPipelineCandidateText,
  buildWorkHistoryFromRaw,
  formatWorkEntry,
  formatEducationEntry,
};
