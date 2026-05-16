// File   : thresholdFilter.cjs
// Purpose: Post-merge penalties, salary flag, min score, band sorting.
// Part of: HRJob+Candidate Matching Pipeline v1.0

const BAND_ORDER = {
  'Excellent Fit': 0,
  'Strong Fit': 1,
  'Good Fit': 2,
  'Fair Fit': 3,
  'Below Threshold': 4,
};

function normalizeWorkMode(w) {
  const u = String(w || '').toUpperCase().replace(/[\s-]+/g, '_');
  if (u.includes('REMOTE')) return 'REMOTE';
  if (u.includes('HYBRID')) return 'HYBRID';
  if (u.includes('ONSITE') || u.includes('ON_SITE') || u.includes('OFFICE')) return 'ONSITE';
  return '';
}

function applyThreshold(pairs, job, minScore = 60) {
  const jobMode = normalizeWorkMode(job?.workMode || job?.jobLocationType);
  const jobType = String(job?.type || '').toUpperCase();

  const processed = (pairs || []).map((row) => {
    const merged = { ...row.merged };
    const flags = Array.isArray(row.flags) ? [...row.flags] : [];
    const cand = row.pair?.rawCandidate || row.pair?.candidate || {};
    const prefLoc = String(cand.preferredLocation || '').toLowerCase();
    const loc = String(cand.location || '').toLowerCase();
    const jobLoc = String(job?.location || '').toLowerCase();

    let penalty = 0;
    if (jobMode === 'ONSITE') {
      if (prefLoc.includes('remote only') || prefLoc === 'remote') {
        penalty += 15;
        flags.push('location: remote preference vs onsite job');
      } else if (jobLoc && loc && !loc.includes(jobLoc) && !jobLoc.includes(loc) && !prefLoc.includes('remote')) {
        penalty += 15;
        flags.push('location: different city vs onsite job');
      }
    }

    if (jobType === 'FULL_TIME') {
      const blob = `${cand.availability || ''} ${JSON.stringify(cand.careerPreferences || {})}`.toLowerCase();
      if (/\bcontract\b/.test(blob) && !/\bfull\b/.test(blob)) {
        penalty += 10;
        flags.push('employment: contract preference vs full-time job');
      }
      if (/\bpart[\s-]*time\b/.test(blob) && !/\bfull\b/.test(blob)) {
        penalty += 10;
        flags.push('employment: part-time preference vs full-time job');
      }
    }

    const candExp = Number(cand.expectedSalary ?? 0) || 0;
    const jobMax = Number(job?.salary?.max ?? job?.salaryMax ?? 0) || 0;
    if (jobMax > 0 && candExp > jobMax * 1.3) {
      flags.push('salary expectation above budget — recruiter to verify');
    }

    merged.finalScore = Math.max(0, Math.min(100, merged.finalScore - penalty));
    merged.band = merged.finalScore >= 90 ? 'Excellent Fit' : merged.finalScore >= 80 ? 'Strong Fit' : merged.finalScore >= 70 ? 'Good Fit' : merged.finalScore >= 60 ? 'Fair Fit' : 'Below Threshold';

    return { ...row, merged, flags };
  });

  processed.sort((a, b) => {
    if (b.merged.finalScore !== a.merged.finalScore) return b.merged.finalScore - a.merged.finalScore;
    return (b.p2?.score || 0) - (a.p2?.score || 0);
  });

  const tier100_80 = processed.filter((r) => r.merged.finalScore >= 80);
  const tier80_60 = processed.filter((r) => r.merged.finalScore >= 60 && r.merged.finalScore < 80);
  const tierBelow60 = processed.filter((r) => r.merged.finalScore < 60);

  /** All scored pairs are returned for HR review; minScore only gates LLM suggestions upstream. */
  const visible = processed;
  const hidden = [];

  const stats = {
    excellent: processed.filter((r) => r.merged.band === 'Excellent Fit').length,
    strong: processed.filter((r) => r.merged.band === 'Strong Fit').length,
    good: processed.filter((r) => r.merged.band === 'Good Fit').length,
    fair: processed.filter((r) => r.merged.band === 'Fair Fit').length,
    tier100_80: tier100_80.length,
    tier80_60: tier80_60.length,
    tierBelow60: tierBelow60.length,
    aboveMinScore: processed.filter((r) => r.merged.finalScore >= minScore).length,
    hidden: 0,
    total: processed.length,
  };

  return { visible, hidden, stats, tiers: { tier100_80, tier80_60, tierBelow60 } };
}

module.exports = { applyThreshold, normalizeWorkMode };
