// File   : scoreMerger.cjs
// Purpose: Weighted merge of four pass scores + band label.
// Part of: HRJob+Candidate Matching Pipeline v1.0

function bandFor(score) {
  if (score >= 90) return 'Excellent Fit';
  if (score >= 80) return 'Strong Fit';
  if (score >= 70) return 'Good Fit';
  if (score >= 60) return 'Fair Fit';
  return 'Below Threshold';
}

function mergeScores(pass1, pass2, pass3, pass4) {
  const s1 = Number(pass1?.score) || 0;
  const s2 = Number(pass2?.score) || 0;
  const s3 = Number(pass3?.score) || 0;
  const s4 = pass4?.skipped ? 0 : Number(pass4?.score) || 0;

  const p4Skipped = Boolean(pass4?.skipped);
  const p3Neutral =
    pass3?.engine === 'fallback-neutral' ||
    (pass3?.engine === 'lexical-fallback' && Number(pass3?.score) === 50);

  let p1 = 0.3;
  let p2 = 0.25;
  let p3 = 0.3;
  let p4 = 0.15;

  if (p4Skipped) {
    p1 = 0.35;
    p2 = 0.25;
    p3 = 0.4;
    p4 = 0;
  }

  if (p3Neutral) {
    if (p4Skipped) {
      p1 = 0.55;
      p2 = 0.45;
      p3 = 0;
      p4 = 0;
    } else {
      const w3 = p3;
      p3 = 0;
      p1 += w3 / 2;
      p2 += w3 / 2;
    }
  }

  const rawScore = s1 * p1 + s2 * p2 + s3 * p3 + s4 * p4;
  const finalScore = Math.round(Math.min(100, Math.max(0, rawScore)));
  const band = bandFor(finalScore);

  const t1 = (s1 * p1).toFixed(1);
  const t2 = (s2 * p2).toFixed(1);
  const t3 = (s3 * p3).toFixed(1);
  const t4 = (s4 * p4).toFixed(1);
  const formula = `(${s1}×${p1.toFixed(2)})+(${s2}×${p2.toFixed(2)})+(${s3}×${p3.toFixed(2)})+(${s4}×${p4.toFixed(2)}) = ${t1}+${t2}+${t3}+${t4} = ${rawScore.toFixed(2)}`;

  return {
    finalScore,
    rawScore,
    band,
    weights: { p1, p2, p3, p4 },
    formula,
  };
}

module.exports = { mergeScores, bandFor };
