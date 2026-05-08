/**
 * Maps a backendphase2 Prisma `Candidate` row into the richer portal-style
 * object expected by `summarizeCandidate` in `job-normalization.cjs`
 * (same family as backend1 job-portal candidates).
 */

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

function mapPhase2CandidateForPortalEngine(c) {
  if (!c) return null;

  const cvWork = parseJsonArray(c.cvWorkExperienceEntries);
  const workExperiences = cvWork
    .map((e) => ({
      jobTitle: e.title || e.jobTitle || e.role || '',
      companyName: e.company || e.companyName || '',
      workLocation: e.location || '',
    }))
    .filter((w) => w.jobTitle || w.companyName);

  const cvEd = parseJsonArray(c.cvEducationEntries);
  const educations = cvEd
    .map((e) => ({
      degree: e.degree || e.qualification || '',
      fieldOfStudy: e.field || e.fieldOfStudy || e.major || '',
      institution: e.institution || e.school || e.university || '',
    }))
    .filter((x) => x.degree || x.institution);

  const skillList = [
    ...new Set(
      [...(Array.isArray(c.skills) ? c.skills : []), ...(Array.isArray(c.recruiterSkills) ? c.recruiterSkills : [])]
        .map((s) => String(s || '').trim())
        .filter(Boolean)
    ),
  ];

  const cp =
    c.careerPreferences && typeof c.careerPreferences === 'object' && !Array.isArray(c.careerPreferences)
      ? c.careerPreferences
      : null;

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
    skills: [],
    certificationsList: Array.isArray(c.certificationsList) ? c.certificationsList : [],
    cvSummary: c.cvSummary || c.notes || c.recruiterNotes || null,
    summary: null,
    workExperiences,
    educations,
    certifications: [],
    project: null,
    profile: {
      city: c.city,
      email: c.email,
      fullName: [c.firstName, c.lastName].filter(Boolean).join(' ').trim() || null,
      totalExperience: c.experience ?? c.experienceYears,
      linkedinUrl: c.linkedIn,
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
