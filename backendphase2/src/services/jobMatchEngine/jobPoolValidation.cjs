// File   : jobPoolValidation.cjs
// Purpose: Quick job vs candidate-pool sanity check before full AI scoring.
// Part of: HRJob+Candidate Matching Pipeline v1.0

const { computePass1 } = require('./pass1SkillsMatch.cjs');

function assessCandidatePoolForJob(pairs, normJob) {
  const requiredSkills = normJob?.normalizedRequiredSkills || [];
  const preferredSkills = normJob?.normalizedPreferredSkills || [];
  let withAnySkillMatch = 0;
  let pass1AtOrAbove40 = 0;
  let pass1AtOrAbove60 = 0;

  for (const pair of pairs) {
    const p1 = computePass1(pair.skillList || [], requiredSkills, preferredSkills);
    if (p1.matchedRequired.length > 0 || p1.matchedPreferred.length > 0) {
      withAnySkillMatch += 1;
    }
    if (p1.score >= 40) pass1AtOrAbove40 += 1;
    if (p1.score >= 60) pass1AtOrAbove60 += 1;
  }

  const total = pairs.length;
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);

  return {
    total,
    requiredSkills,
    preferredSkills,
    withAnySkillMatch,
    pass1AtOrAbove40,
    pass1AtOrAbove60,
    pctWithSkill: pct(withAnySkillMatch),
    pctPass1Above40: pct(pass1AtOrAbove40),
    likelyLowScores: total > 0 && pass1AtOrAbove40 < Math.max(2, Math.ceil(total * 0.15)),
  };
}

module.exports = { assessCandidatePoolForJob };
