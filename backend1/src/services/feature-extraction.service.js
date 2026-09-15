const {
  summarizeCandidate,
  summarizeJob,
  educationLevelToRank,
  experienceLevelToRank,
} = require('./job-normalization.service');

function buildCandidateFeatures(candidate) {
  const normalized = candidate?.normalizedSkills ? candidate : summarizeCandidate(candidate);
  const responsibilityCorpus = [
    normalized.summaryText,
    ...(Array.isArray(normalized.workTitles) ? normalized.workTitles : []),
    ...(Array.isArray(normalized.keywords) ? normalized.keywords.slice(0, 40) : []),
  ]
    .filter(Boolean)
    .join(' ');

  return {
    id: normalized.id,
    skills: normalized.normalizedSkills || [],
    roleCategories: normalized.roleCategories || [],
    experienceYears: Number(normalized.candidateExperience || 0),
    experienceLevel: normalized.experienceLevel || 'entry',
    experienceRank: experienceLevelToRank(normalized.experienceLevel || normalized.candidateExperience || 0),
    educationLevel: normalized.educationLevel || null,
    educationRank: educationLevelToRank(normalized.educationLevel),
    location: normalized.normalizedLocation || { raw: normalized.currentLocation || null, normalized: null, tokens: [] },
    workModePreference: normalized.workModePreference || normalized.preferredWorkMode || null,
    preferredLocations: normalized.preferredLocations || [],
    preferredRoles: normalized.preferredRoles || [],
    preferredIndustry: normalized.preferredIndustry || null,
    industry: normalized.preferredIndustry || normalized.domainFamily || null,
    domainFamily: normalized.domainFamily || null,
    currentTitle: normalized.currentTitle || normalized.normalizedCurrentTitle || null,
    summaryText: normalized.summaryText || '',
    responsibilityText: responsibilityCorpus,
    responsibilityTokens: tokenizeForMatch(responsibilityCorpus),
  };
}

function buildJobFeatures(job) {
  const normalized = job?.normalizedRequiredSkills ? job : summarizeJob(job);
  const raw = normalized.rawSnapshot || {};
  const responsibilityCorpus = [
    ...(Array.isArray(normalized.responsibilities) ? normalized.responsibilities : []),
    ...(Array.isArray(raw.keyResponsibilities) ? raw.keyResponsibilities : []),
    raw.responsibilities,
    raw.description,
    raw.overview,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    id: normalized.id,
    requiredSkills: normalized.normalizedRequiredSkills || [],
    preferredSkills: normalized.normalizedPreferredSkills || [],
    roleCategories: normalized.roleCategories || [],
    requiredExperienceYears: Number(normalized.requiredExperienceYears || 0),
    requiredExperienceLevel: normalized.experienceLevel || 'entry',
    requiredExperienceRank: experienceLevelToRank(normalized.experienceLevel || normalized.requiredExperienceYears || 0),
    jobLocation: normalized.normalizedLocation || { raw: normalized.location || null, normalized: null, tokens: [] },
    workMode: normalized.workMode || null,
    educationRequirement: normalized.educationRequirement || null,
    educationRequirementRank: educationLevelToRank(normalized.educationRequirement),
    industry: normalized.industry || null,
    domainFamily: normalized.domainFamily || null,
    title: normalized.title || null,
    postedAt: normalized.postedAt || null,
    responsibilityText: responsibilityCorpus,
    responsibilityTokens: tokenizeForMatch(responsibilityCorpus),
  };
}

function tokenizeForMatch(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .split(/[^a-z0-9+#.\-/]+/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 2);
}

module.exports = {
  buildCandidateFeatures,
  buildJobFeatures,
};
