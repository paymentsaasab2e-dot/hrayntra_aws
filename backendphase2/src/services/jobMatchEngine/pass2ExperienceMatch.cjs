// File   : pass2ExperienceMatch.cjs
// Purpose: Deterministic experience / seniority / domain fit scoring.
// Part of: HRJob+Candidate Matching Pipeline v1.0

const DOMAIN_MAP = {
  fintech: ['fintech', 'banking', 'finance', 'payments', 'lending', 'insurance', 'wealth', 'trading', 'neobank'],
  healthcare: ['health', 'hospital', 'medical', 'pharma', 'clinical', 'biotech', 'diagnostic', 'telemedicine'],
  ecommerce: ['ecommerce', 'retail', 'marketplace', 'shopify', 'd2c', 'supply chain', 'logistics', 'warehouse'],
  saas: ['saas', 'b2b software', 'enterprise software', 'platform'],
  edtech: ['edtech', 'education', 'learning', 'lms', 'training'],
  media: ['media', 'entertainment', 'streaming', 'content', 'gaming'],
  realestate: ['real estate', 'proptech', 'property', 'construction'],
  travel: ['travel', 'hospitality', 'hotel', 'airline', 'tourism'],
  general: [],
};

function parseExperienceRange(str) {
  const raw = String(str || '').trim().toLowerCase();
  if (!raw) return { min: 0, max: 99 };
  if (/\+/.test(raw) || /at least|minimum|min\.?/.test(raw)) {
    const m = raw.match(/(\d+(?:\.\d+)?)/);
    const min = m ? Math.floor(Number(m[1])) : 0;
    return { min, max: 99 };
  }
  if (/\d+\s*[-–to]+\s*\d+/.test(raw)) {
    const nums = raw.match(/(\d+(?:\.\d+)?)/g);
    if (nums && nums.length >= 2) {
      const a = Math.floor(Number(nums[0]));
      const b = Math.floor(Number(nums[1]));
      return { min: Math.min(a, b), max: Math.max(a, b) };
    }
  }
  const single = raw.match(/^(\d+(?:\.\d+)?)\s*year/);
  if (single) {
    const min = Math.floor(Number(single[1]));
    return { min, max: min + 2 };
  }
  const any = raw.match(/(\d+(?:\.\d+)?)/g);
  if (any && any.length) {
    const min = Math.floor(Number(any[0]));
    return { min, max: min + 2 };
  }
  return { min: 0, max: 99 };
}

function mapTitleToTier(title) {
  const t = String(title || '').toLowerCase();
  if (/(intern|trainee|fresher|graduate|entry)/.test(t)) return 1;
  if (/(junior|\bjr\b|associate)/.test(t)) return 2;
  if (/(mid|intermediate)/.test(t)) return 3;
  if (/(senior|\bsr\b|specialist)/.test(t)) return 4;
  if (/(lead|principal|staff|architect)/.test(t)) return 5;
  if (/(manager|director|head|\bvp\b|chief|\bcto\b|\bceo\b)/.test(t)) return 6;
  if (/engineer|developer|analyst|consultant/.test(t)) return 3;
  return 3;
}

function inferDomain(text) {
  const blob = String(text || '').toLowerCase();
  for (const [domain, kws] of Object.entries(DOMAIN_MAP)) {
    if (domain === 'general') continue;
    for (const kw of kws) {
      if (blob.includes(kw)) return domain;
    }
  }
  return 'general';
}

function roleKeywordOverlap(jobTitle, workHistory) {
  const jt = String(jobTitle || '').toLowerCase();
  if (!jt) return 0;
  const roleTerms = [
    'node',
    'nodejs',
    'node.js',
    'react',
    'developer',
    'engineer',
    'full stack',
    'fullstack',
    'frontend',
    'backend',
    'javascript',
    'typescript',
    'python',
    'java',
    'software',
    'web',
  ];
  const jobHits = roleTerms.filter((term) => jt.includes(term));
  if (!jobHits.length) return 0;

  const hist = Array.isArray(workHistory) ? workHistory : [];
  let matches = 0;
  for (const w of hist) {
    const chunk = `${w?.title || ''} ${w?.company || ''} ${w?.description || ''}`.toLowerCase();
    if (!chunk.trim()) continue;
    if (jobHits.some((term) => chunk.includes(term))) matches += 1;
  }
  if (!hist.length) return 0;
  return matches / hist.length;
}

function computePass2(
  candidateYears,
  candidateTitle,
  candidateWorkHistory,
  jobExperienceRequired,
  jobTitle,
  jobDescription
) {
  const candY = Number(candidateYears) || 0;
  const { min: minY, max: maxY } = parseExperienceRange(jobExperienceRequired);

  let yearsScore = 5;
  if (candY >= minY && candY <= maxY) yearsScore = 40;
  else if (candY > maxY) yearsScore = Math.max(0, 40 - (candY - maxY) * 2);
  else if (candY === minY - 1) yearsScore = 30;
  else if (candY === minY - 2) yearsScore = 18;
  else if (candY < minY - 2) yearsScore = 5;

  const ct = mapTitleToTier(candidateTitle);
  const jt = mapTitleToTier(jobTitle);
  const tierDiff = ct - jt;
  let seniorityScore = 8;
  if (tierDiff === 0) seniorityScore = 30;
  else if (tierDiff === -1) seniorityScore = 20;
  else if (tierDiff <= -2) seniorityScore = 8;
  else if (tierDiff === 1) seniorityScore = 15;
  else if (tierDiff >= 2) seniorityScore = 5;

  const domainKey = inferDomain(`${jobDescription || ''} ${jobTitle || ''}`);
  const domainKws = DOMAIN_MAP[domainKey] || [];
  const hist = Array.isArray(candidateWorkHistory) ? candidateWorkHistory : [];
  let matchingRoles = 0;
  for (const w of hist) {
    const chunk = `${w?.title || ''} ${w?.company || ''} ${w?.location || ''}`.toLowerCase();
    if (!chunk.trim()) continue;
    const hit = domainKws.some((kw) => chunk.includes(kw));
    if (hit) matchingRoles += 1;
  }
  const totalRoles = Math.max(1, hist.length);
  const domainMatchRatio = domainKey === 'general' ? 0.2 : matchingRoles / totalRoles;
  let domainScore = Math.round(domainMatchRatio * 25) + 5;
  if (domainKey === 'general') {
    const roleOverlap = roleKeywordOverlap(jobTitle, hist);
    domainScore += Math.round(roleOverlap * 20);
  }
  domainScore = Math.min(30, domainScore);

  const rawTotal = yearsScore + seniorityScore + domainScore;
  const score = Math.min(100, Math.max(0, rawTotal));

  return {
    score: Math.round(score * 100) / 100,
    yearsScore,
    seniorityScore,
    domainScore,
    parsedMinYears: minY,
    parsedMaxYears: maxY,
    candidateTier: ct,
    jobTier: jt,
    breakdown: { years: yearsScore, seniority: seniorityScore, domain: domainScore },
  };
}

module.exports = { computePass2, parseExperienceRange, inferDomain, DOMAIN_MAP };
