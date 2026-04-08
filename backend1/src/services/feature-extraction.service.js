const {
  summarizeCandidate,
  summarizeJob,
  educationLevelToRank,
  experienceLevelToRank,
} = require('./job-normalization.service');

function buildCandidateFeatures(candidate) {
  const normalized = candidate?.normalizedSkills ? candidate : summarizeCandidate(candidate);

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
    domainFamily: normalized.domainFamily || null,
  };
}

function buildJobFeatures(job) {
  const normalized = job?.normalizedRequiredSkills ? job : summarizeJob(job);

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
    domainFamily: normalized.domainFamily || null,
  };
}

module.exports = {
  buildCandidateFeatures,
  buildJobFeatures,
};
