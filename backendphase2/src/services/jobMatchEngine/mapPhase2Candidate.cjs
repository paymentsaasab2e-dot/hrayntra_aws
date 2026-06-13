/**
 * Maps a backendphase2 Prisma `Candidate` row into the richer portal-style
 * object expected by `summarizeCandidate` in `job-normalization.cjs`
 * (same family as backend1 job-portal candidates).
 */

const { parseJsonArray, extractSnapshotSections } = require('./matchCandidateProfile.cjs');

function mapPhase2CandidateForPortalEngine(c) {
  if (!c) return null;

  const snapshotSections = extractSnapshotSections(c.extraData);
  const cvWork = parseJsonArray(c.cvWorkExperienceEntries);
  const workSource = cvWork.length ? cvWork : snapshotSections.work;
  const workExperiences = workSource
    .map((e) => ({
      jobTitle: e.title || e.jobTitle || e.role || '',
      companyName: e.company || e.companyName || '',
      workLocation: e.location || e.workLocation || '',
      description: Array.isArray(e.responsibilities)
        ? e.responsibilities.join(' ')
        : String(e.description || e.keyResponsibilities || '').trim(),
    }))
    .filter((w) => w.jobTitle || w.companyName);

  const cvEd = parseJsonArray(c.cvEducationEntries);
  const eduSource = cvEd.length ? cvEd : snapshotSections.education;
  const educations = eduSource
    .map((e) => ({
      degree: e.degree || e.qualification || e.program || '',
      fieldOfStudy: e.field || e.fieldOfStudy || e.major || '',
      institution: e.institution || e.school || e.university || '',
    }))
    .filter((x) => x.degree || x.institution);

  const skillList = [
    ...new Set(
      [
        ...(Array.isArray(c.skills) ? c.skills : []),
        ...(Array.isArray(c.recruiterSkills) ? c.recruiterSkills : []),
        ...(Array.isArray(c.certificationsList) ? c.certificationsList : []),
        ...(Array.isArray(c.certifications) ? c.certifications : []),
        ...snapshotSections.skills,
      ]
        .map((s) => String(s || '').trim())
        .filter(Boolean)
    ),
  ];

  const languageList = [
    ...new Set(
      [
        ...(Array.isArray(c.languages) ? c.languages : []),
        ...(Array.isArray(c.recruiterLanguages) ? c.recruiterLanguages : []),
        ...snapshotSections.languages,
      ]
        .map((s) => String(s || '').trim())
        .filter(Boolean)
    ),
  ];

  const cp =
    c.careerPreferences && typeof c.careerPreferences === 'object' && !Array.isArray(c.careerPreferences)
      ? c.careerPreferences
      : null;

  const extra =
    c.extraData && typeof c.extraData === 'object' && !Array.isArray(c.extraData) ? c.extraData : {};
  const snap =
    extra.phase1ProfileSnapshot && typeof extra.phase1ProfileSnapshot === 'object'
      ? extra.phase1ProfileSnapshot
      : null;
  const projectRows = parseJsonArray(snap?.projects || snap?.projectEntries);
  const projectTechnologies = projectRows
    .flatMap((p) => (Array.isArray(p?.technologies) ? p.technologies : []))
    .map((t) => String(t || '').trim())
    .filter(Boolean);
  const projectTitles = projectRows
    .map((p) => String(p?.title || p?.projectTitle || p?.name || '').trim())
    .filter(Boolean);

  return {
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    currentTitle: c.currentTitle || c.designation || null,
    designation: c.designation,
    location: c.location,
    city: c.city,
    country: c.country,
    linkedIn: c.linkedIn,
    portfolio: c.portfolio,
    experienceYears: c.experience ?? c.experienceYears,
    recruiterSkills: skillList,
    recruiterLanguages: languageList,
    skills: [],
    certificationsList: Array.isArray(c.certificationsList) ? c.certificationsList : [],
    cvSummary: c.cvSummary || c.notes || c.recruiterNotes || null,
    summary: null,
    workExperiences,
    educations,
    certifications: [],
    project: projectRows.length
      ? {
          title: projectTitles[0] || null,
          titles: projectTitles,
          technologies: projectTechnologies,
        }
      : null,
    profile: {
      city: c.city,
      email: c.email,
      fullName: [c.firstName, c.lastName].filter(Boolean).join(' ').trim() || null,
      totalExperience: c.experience ?? c.experienceYears,
      linkedinUrl: c.linkedIn,
      portfolioUrl: c.portfolio || c.website || null,
    },
    careerPreferences: cp
      ? {
          preferredRoles: Array.isArray(cp.preferredRoles) ? cp.preferredRoles : [],
          preferredLocations: Array.isArray(cp.preferredLocations) ? cp.preferredLocations : [],
          preferredIndustry: cp.preferredIndustry || null,
          preferredWorkMode: cp.preferredWorkMode || null,
          preferredSalary: cp.preferredSalary ?? null,
          currentSalary: cp.currentSalary ?? null,
          availabilityToStart: cp.availabilityToStart || null,
          openToRelocation: Boolean(cp.openToRelocation),
          currentRole: cp.currentRole || null,
          currentLocation: cp.currentLocation || null,
        }
      : null,
    preferredLocation: c.preferredLocation || null,
    expectedSalary: c.expectedSalary ?? null,
    currentSalary: c.currentSalary ?? null,
    noticePeriod: c.noticePeriod,
    availability: c.availability,
  };
}

module.exports = {
  mapPhase2CandidateForPortalEngine,
};
