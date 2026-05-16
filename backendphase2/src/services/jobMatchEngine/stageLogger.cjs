// File   : stageLogger.cjs
// Purpose: Human-readable console logging for the HR job–candidate matching pipeline.
// Part of: HRJob+Candidate Matching Pipeline v1.0

function ts() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function bannerLine() {
  return '══════════════════════════════════════════════════════';
}

function thinLine() {
  return '──────────────────────────────────────────────────────';
}

function pipelineStart(job, runId) {
  const title = job?.title || '(untitled job)';
  const id = job?.id || '(no id)';
  console.log('');
  console.log(bannerLine());
  console.log(`🚀  PIPELINE START — Job: "${title}" (${id})`);
  console.log(`    Run ID   : ${runId}`);
  console.log(`    Job ID   : ${id}`);
  console.log(`    Time     : ${ts()}`);
  console.log(bannerLine());
}

function pipelineEnd(job, runId, stats = {}) {
  const title = job?.title || '(untitled job)';
  const id = job?.id || '(no id)';
  console.log('');
  console.log(bannerLine());
  console.log(`🏁  PIPELINE COMPLETE — Job: "${title}" (${id})`);
  console.log(`    Total pairs evaluated : ${stats.totalPairs ?? '—'}`);
  console.log(`    Pairs shown to HR     : ${stats.visiblePairs ?? '—'}`);
  console.log(
    `    Top match             : ${stats.topCandidate || '—'} — ${stats.topScore ?? '—'} (${stats.topBand || '—'})`
  );
  console.log(`    LLM fallbacks used    : ${stats.fallbacksUsed ?? 0}`);
  console.log(`    Duration              : ${stats.duration ?? '—'}s`);
  console.log(`    Run ID                : ${runId}`);
  console.log(bannerLine());
  console.log('');
}

function stageStart(stageName, details = {}) {
  console.log('');
  console.log(thinLine());
  console.log(`${stageName}`);
  console.log(thinLine());
  const keys = Object.keys(details || {});
  for (const k of keys) {
    const v = details[k];
    if (v !== undefined && v !== null) console.log(`    ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
  }
}

function stageEnd(stageName, summary = {}) {
  const label = typeof summary === 'string' ? summary : JSON.stringify(summary);
  console.log(`✅  ${stageName} COMPLETE — ${label}`);
  console.log(thinLine());
}

function pairLog(index, total, candidateLabel, scores, candidateSnapshot = null) {
  console.log('');
  console.log(`    [Pair ${index}/${total}] Candidate: ${candidateLabel}`);
  console.log(`      Pass 1 Skills     : ${scores.p1 ?? scores.pass1 ?? '—'}`);
  console.log(`      Pass 2 Experience : ${scores.p2 ?? scores.pass2 ?? '—'}`);
  console.log(`      Pass 3 Semantic   : ${scores.p3 ?? scores.pass3 ?? '—'}  [engine: ${scores.engine || '—'}]`);
  if (scores.embedFallback === 'yes') {
    console.log('      Pass 3 provider   : Mistral fallback (OpenAI unavailable)');
  }
  if (scores.engine === 'lexical-fallback') {
    console.log('      Pass 3 note       : Lexical text overlap (embedding APIs unavailable)');
  }
  console.log(`      Pass 4 Cultural   : ${scores.p4 ?? scores.pass4 ?? '—'}`);
  if (scores.p4Source) {
    console.log(`      Pass 4 source     : ${scores.p4Source}`);
  }
  if (candidateSnapshot && typeof candidateSnapshot === 'object') {
    const snap = candidateSnapshot;
    if (snap.email) console.log(`      Candidate email   : ${snap.email}`);
    if (snap.phone) console.log(`      Candidate phone   : ${snap.phone}`);
    if (snap.location) console.log(`      Candidate location: ${snap.location}`);
    if (snap.currentTitle) console.log(`      Current title     : ${snap.currentTitle}`);
    if (snap.currentCompany) console.log(`      Current company   : ${snap.currentCompany}`);
    if (Array.isArray(snap.skillsPreview) && snap.skillsPreview.length) {
      console.log(`      Skills (sample)     : ${snap.skillsPreview.slice(0, 12).join(', ')}`);
    }
    if (snap.summaryPreview) {
      const s = String(snap.summaryPreview).replace(/\s+/g, ' ').trim().slice(0, 220);
      console.log(`      Summary preview     : ${s}${String(snap.summaryPreview).length > 220 ? '…' : ''}`);
    }
  }
  console.log('      → Raw scores logged. Merger next.');
}

function mergerLog(index, total, candidateName, formula, finalScore, band) {
  console.log('');
  console.log(`    [Pair ${index}/${total}] ${candidateName}`);
  console.log(`      Formula: ${formula}`);
  console.log(`      📊 Final Score: ${finalScore}`);
  console.log(`      📊 Band       : ${band}`);
}

function fallbackLog(candidateId, reason) {
  console.log(`🔁  Fallback — candidate ${candidateId}: ${reason}`);
}

/** Pre-flight: job required skills vs loaded candidate pool. */
function pass4Log(candidateName, p4) {
  if (!p4) {
    console.log(`[pass4] Candidate: ${candidateName} → Cultural score: — → source: unknown`);
    return;
  }
  if (p4.skipped) {
    console.log(
      `[pass4] Candidate: ${candidateName} → Cultural score: skipped → source: ${p4.source || 'skipped'}`
    );
    return;
  }
  const source = p4.source || (p4.error ? 'default-fallback' : 'llm-response');
  console.log(
    `[pass4] Candidate: ${candidateName} → Cultural score: ${p4.score} → source: ${source}`
  );
  if (source === 'llm-response' && p4.score === 0) {
    console.log(
      '[pass4]   LLM returned all-zero dimensions (clear mismatch or insufficient culture info in profile)'
    );
  }
  if (source === 'default-fallback') {
    console.log(
      `[pass4]   LLM/parse failed${p4.errorMessage ? `: ${p4.errorMessage}` : ''} — using neutral score ${p4.score}`
    );
  }
  if (source === 'llm-response' && p4.score > 0 && p4.dimensions) {
    const d = p4.dimensions;
    console.log(
      `[pass4]   dimensions: pace=${d.workPace} collab=${d.collaboration} comm=${d.communication} lead=${d.leadership} innov=${d.innovation}`
    );
  }
}

function stage5ThresholdLog(minScore, aboveCount, total, phase = '') {
  const phaseLabel = phase ? ` ${phase}` : '';
  console.log(
    `[stage5] Threshold: ${minScore} — candidates above${phaseLabel}: ${aboveCount} of ${total} (LLM suggestions; all scores still saved for HR)`
  );
}

function jobPoolInsight(job, stats) {
  console.log('');
  console.log(thinLine());
  console.log('📋  JOB vs CANDIDATE POOL (pre-flight)');
  console.log(`    Job title              : ${job?.title || '—'}`);
  console.log(
    `    Required skills        : ${(stats.requiredSkills || []).slice(0, 14).join(', ') || '(none listed)'}`
  );
  if ((stats.preferredSkills || []).length) {
    console.log(
      `    Preferred skills       : ${stats.preferredSkills.slice(0, 10).join(', ')}`
    );
  }
  console.log(`    Candidates in pool     : ${stats.total ?? 0}`);
  console.log(
    `    With ≥1 skill match    : ${stats.withAnySkillMatch ?? 0} (${stats.pctWithSkill ?? 0}%)`
  );
  console.log(
    `    Pass-1 score ≥ 40      : ${stats.pass1AtOrAbove40 ?? 0} (${stats.pctPass1Above40 ?? 0}%)`
  );
  if (stats.likelyLowScores) {
    console.log(
      '    ⚠️  Most candidates lack required skills for this role — final scores will likely cluster below 60 until you add better-matched profiles.'
    );
  }
  console.log(thinLine());
}

function errorLog(stage, error) {
  console.log(`❌  ${stage}: ${error?.message || error}`);
}

/** Print ranked final scores grouped 100–80, 80–60, below 60 for HR audit. */
function finalScoresSummary(mergedPairs, jobTitle) {
  const rows = (mergedPairs || [])
    .map((p) => ({
      name: p.pair?.name || p.pair?.rawCandidate?.firstName || 'Candidate',
      id: p.pair?.rawCandidate?.id || '',
      score: Number(p.merged?.finalScore ?? 0),
      band: p.merged?.band || '—',
    }))
    .sort((a, b) => b.score - a.score);

  console.log('');
  console.log(thinLine());
  console.log(`📊  FINAL SCORES — Job: "${jobTitle || 'Job'}" (${rows.length} candidates)`);
  console.log(thinLine());

  const tier80 = rows.filter((r) => r.score >= 80);
  const tier60 = rows.filter((r) => r.score >= 60 && r.score < 80);
  const tierLow = rows.filter((r) => r.score < 60);

  const printTier = (label, list) => {
    console.log(`  ${label} (${list.length})`);
    if (!list.length) {
      console.log('    (none)');
      return;
    }
    list.forEach((r, i) => {
      console.log(`    ${i + 1}. ${r.name} — ${r.score} (${r.band})`);
    });
  };

  printTier('100 – 80', tier80);
  printTier('80 – 60', tier60);
  printTier('Below 60', tierLow);
  console.log(thinLine());
}

module.exports = {
  stageStart,
  stageEnd,
  pairLog,
  mergerLog,
  pipelineStart,
  pipelineEnd,
  fallbackLog,
  errorLog,
  finalScoresSummary,
  jobPoolInsight,
  pass4Log,
  stage5ThresholdLog,
};
