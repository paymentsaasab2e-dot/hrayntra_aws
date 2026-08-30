/**
 * Maps internal employment type / job type to Careerjet XML values.
 * Official feed sample: contract_type=permanent, working_hours=full-time
 * Search API also documents: p/c/t/i/v and f/p — XML uses the English words.
 * https://www.careerjet.com/docs/feeds/xml
 * https://www.careerjet.com/partners/api
 */

function mapContractType(type, employmentType) {
  const v = `${type || ''} ${employmentType || ''}`.toUpperCase().replace(/[\s-]+/g, '_');
  if (v.includes('INTERN') || v.includes('TRAINEE')) return 'internship';
  if (v.includes('TEMP')) return 'temporary';
  if (v.includes('VOLUNTEER')) return 'volunteering';
  if (v.includes('CONTRACT') || v.includes('FREELANCE')) return 'contract';
  return 'permanent';
}

function mapWorkingHours(type, employmentType) {
  const v = `${type || ''} ${employmentType || ''}`.toUpperCase();
  if (v.includes('PART')) return 'part-time';
  return 'full-time';
}

module.exports = {
  mapContractType,
  mapWorkingHours,
};
