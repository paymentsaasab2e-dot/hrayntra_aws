// File   : matchPipelineRunner.cjs
// Purpose: Orchestrate 4-pass HR job-candidate matching for one job vs tenant + portal candidates.
// Part of: HRJob+Candidate Matching Pipeline v1.0

const OpenAI = require('openai');
const { summarizeJob, summarizeCandidate } = require('./job-normalization.cjs');
const { mapPhase2CandidateForPortalEngine } = require('./mapPhase2Candidate.cjs');
const stageLogger = require('./stageLogger.cjs');
const { computePass1 } = require('./pass1SkillsMatch.cjs');
const { computePass2 } = require('./pass2ExperienceMatch.cjs');
const { computePass3, precomputeJobEmbeddingContext } = require('./pass3SemanticMatch.cjs');
const { assessCandidatePoolForJob } = require('./jobPoolValidation.cjs');
const { computePass4 } = require('./pass4CulturalFit.cjs');
const { mergeScores } = require('./scoreMerger.cjs');
const { generateSuggestions } = require('./suggestionEngine.cjs');
const { applyThreshold } = require('./thresholdFilter.cjs');

/** Prisma Mongo: unset ObjectId fields must use isSet:false, not null. */
const AI_MATCH_AUTHOR_WHERE = { isSet: false };

/** Candidates scored per batch before a short pause (reduces Mistral 429 bursts). */
const EMBED_BATCH_SIZE = Math.max(1, Number(process.env.MATCH_EMBED_BATCH_SIZE || 3) || 3);
const EMBED_BATCH_PAUSE_MS = Number(process.env.MATCH_EMBED_BATCH_PAUSE_MS || 500) || 500;

function extractJobSections(job) {
  const responsibilities = Array.isArray(job.keyResponsibilities) ? job.keyResponsibilities.join(' ') : '';
  const requirements = Array.isArray(job.requirements) ? job.requirements.join(' ') : '';
  const aboutUs = `${job.overview || ''} ${Array.isArray(job.benefits) ? job.benefits.join(' ') : ''}`.trim();
  return { responsibilities, requirements, aboutUs };
}

function extractCandidateSections(raw) {
  const cv = Array.isArray(raw?.cvWorkExperienceEntries)
    ? raw.cvWorkExperienceEntries
    : typeof raw?.cvWorkExperienceEntries === 'string'
      ? safeJson(raw.cvWorkExperienceEntries)
      : [];
  const workExperience = (cv || [])
    .map((e) => `${e.title || e.jobTitle || ''} at ${e.company || e.companyName || ''}: ${e.description || e.responsibilities || ''}`)
    .join(' ');
  const skills = [...(raw.skills || []), ...(raw.recruiterSkills || [])].join(', ');
  const summary = raw.cvSummary || raw.notes || raw.recruiterNotes || '';
  return { workExperience, skills, summary };
}

function safeJson(s) {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function getTopPass(p1, p2, p3, p4) {
  const rows = [
    ['Skills Match', p1?.score ?? 0],
    ['Experience', p2?.score ?? 0],
    ['Semantic Fit', p3?.score ?? 0],
    ['Cultural Fit', p4?.skipped ? -1 : p4?.score ?? 0],
  ];
  rows.sort((a, b) => b[1] - a[1]);
  return rows[0][0];
}

function getBottomPass(p1, p2, p3, p4) {
  const rows = [
    ['Skills Match', p1?.score ?? 0],
    ['Experience', p2?.score ?? 0],
    ['Semantic Fit', p3?.score ?? 0],
    ['Cultural Fit', p4?.skipped ? 999 : p4?.score ?? 0],
  ];
  rows.sort((a, b) => a[1] - b[1]);
  return rows[0][0];
}

function buildJobPayload(jobRow) {
  return {
    id: jobRow.id,
    title: jobRow.title,
    description: jobRow.description || '',
    overview: jobRow.overview || '',
    aboutRole: '',
    responsibilities: '',
    keyResponsibilities: jobRow.keyResponsibilities || [],
    skills: jobRow.skills || [],
    preferredSkills: jobRow.preferredSkills || [],
    requirements: jobRow.requirements || [],
    location: jobRow.location || '',
    workMode: jobRow.workMode || jobRow.jobLocationType || null,
    jobLocationType: jobRow.jobLocationType || jobRow.workMode || null,
    experienceRequired: jobRow.experienceRequired || '',
    education: jobRow.education || null,
    type: jobRow.type,
    salary: jobRow.salary || null,
    benefits: jobRow.benefits || [],
    client: jobRow.client,
    department: jobRow.department,
    jobCategory: jobRow.jobCategory,
  };
}

/** Run worker in batches of N candidates; pause between batches to avoid embedding rate limits. */
async function runCandidateBatches(items, batchSize, pauseMs, worker) {
  for (let start = 0; start < items.length; start += batchSize) {
    const batch = items.slice(start, start + batchSize);
    const baseIndex = start;
    await Promise.all(batch.map((item, offset) => worker(item, baseIndex + offset)));
    if (start + batchSize < items.length && pauseMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, pauseMs));
    }
  }
}

async function runMatchPipeline({
  jobId,
  prisma,
  minScore = 60,
  forceRefresh = false,
  candidates: candidatesOverride,
  poolStats = null,
  materializeCandidate = null,
  pipelineMode = 'ai',
}) {
  const isAppliedPipeline = pipelineMode === 'applied';
  const runId = `run_${Date.now()}`;
  const startTime = Date.now();

  const openaiClient = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
  const mistralClient = process.env.MISTRAL_API_KEY
    ? new OpenAI({
        apiKey: process.env.MISTRAL_API_KEY,
        baseURL: process.env.MISTRAL_API_BASE_URL || 'https://api.mistral.ai/v1',
      })
    : null;

  const jobRow = await prisma.job.findFirst({
    where: { id: jobId, status: 'OPEN', isDeleted: { not: true } },
    include: { client: { select: { companyName: true, logo: true } } },
  });
  if (!jobRow) {
    throw new Error(`Job not found or not OPEN: ${jobId}`);
  }

  stageLogger.pipelineStart(jobRow, runId);
  stageLogger.stageStart('STAGE 0 STARTED — Database Pull', { jobId });

  let candidates;
  if (Array.isArray(candidatesOverride)) {
    candidates = candidatesOverride;
    const summary = poolStats
      ? `${candidates.length} merged (tenant ${poolStats.tenantCount}, common ${poolStats.commonCount ?? 0}, portal ${poolStats.portalCount})`
      : `${candidates.length} candidates loaded`;
    stageLogger.stageEnd('STAGE 0', summary);
  } else {
    candidates = await prisma.candidate.findMany({
      where: {
        isDeleted: { not: true },
        status: { in: ['NEW', 'ACTIVE'] },
        NOT: {
          matches: {
            some: {
              jobId,
              status: 'REJECTED',
              createdById: null,
            },
          },
        },
      },
    });
    stageLogger.stageEnd('STAGE 0', `${candidates.length} candidates loaded (tenant only)`);
  }
  stageLogger.stageStart('STAGE 1 STARTED — Data Ingestion and Preparation', {});

  const jobPayload = buildJobPayload(jobRow);
  const normJob = summarizeJob(jobPayload);
  const jobSections = extractJobSections(jobRow);
  const jobText = [jobRow.description, jobRow.overview, ...(jobRow.keyResponsibilities || []), ...(jobRow.requirements || [])]
    .filter(Boolean)
    .join('\n');

  const cultureText = [jobRow.overview, jobRow.description, ...(Array.isArray(jobRow.benefits) ? jobRow.benefits : [])]
    .filter(Boolean)
    .join('\n');
  const skipCulture = !String(cultureText || '').trim();

  const pairs = [];
  for (const raw of candidates) {
    const portal = mapPhase2CandidateForPortalEngine(raw);
    if (!portal) continue;
    const summarized = summarizeCandidate(portal);
    const candidateSections = extractCandidateSections(raw);
    const candidateText = String(summarized.summaryText || raw.cvSummary || raw.notes || '').slice(0, 6000);
    const workHistory = (Array.isArray(raw.cvWorkExperienceEntries)
      ? raw.cvWorkExperienceEntries
      : typeof raw.cvWorkExperienceEntries === 'string'
        ? safeJson(raw.cvWorkExperienceEntries)
        : []
    ).map((e) => ({
      title: e.title || e.jobTitle,
      company: e.company || e.companyName,
      location: e.location,
      description: Array.isArray(e.responsibilities) ? e.responsibilities.join(' ') : e.description,
    }));

    const skillList = summarized.normalizedSkills || [];

    pairs.push({
      rawCandidate: raw,
      portal,
      summarized,
      skillList,
      jobSections,
      candidateSections,
      candidateText,
      workHistory,
      name: summarized.name || `${raw.firstName || ''} ${raw.lastName || ''}`.trim() || 'Candidate',
    });
  }

  stageLogger.stageEnd('STAGE 1', `${pairs.length} pairs ready for scoring`);

  if (!forceRefresh && !isAppliedPipeline && candidates.length > 0) {
    const matchCount = await prisma.match.count({
      where: { jobId, createdById: AI_MATCH_AUTHOR_WHERE, status: { not: 'REJECTED' } },
    });
    const latest = await prisma.match.findFirst({
      where: { jobId, createdById: AI_MATCH_AUTHOR_WHERE, status: { not: 'REJECTED' } },
      orderBy: { updatedAt: 'desc' },
      select: { evaluation: true },
    });
    const computedAt =
      latest?.evaluation && typeof latest.evaluation === 'object' ? latest.evaluation.computedAt : null;
    const latestIsApplied =
      latest?.evaluation &&
      typeof latest.evaluation === 'object' &&
      latest.evaluation.origin === 'applied';
    if (computedAt && matchCount >= candidates.length && !latestIsApplied) {
      const age = Date.now() - new Date(computedAt).getTime();
      if (age < 24 * 60 * 60 * 1000) {
        stageLogger.stageStart('PIPELINE CACHE HIT', { computedAt, ageHours: (age / 3600000).toFixed(2) });
        stageLogger.stageEnd('PIPELINE CACHE HIT', 'skipped recompute');
        stageLogger.pipelineEnd(jobRow, runId, {
          totalPairs: pairs.length,
          visiblePairs: matchCount,
          topCandidate: 'cached',
          topScore: 'cached',
          topBand: 'cached',
          fallbacksUsed: 0,
          duration: ((Date.now() - startTime) / 1000).toFixed(1),
        });
        return { runId, cached: true, totalPairs: pairs.length, visible: matchCount };
      }
    }
  }

  stageLogger.stageStart('STAGE 2 STARTED — 4 Parallel Scoring Passes', {
    embedBatchSize: EMBED_BATCH_SIZE,
    embedBatchPauseMs: EMBED_BATCH_PAUSE_MS,
    embedMaxConcurrent: process.env.MATCH_EMBED_CONCURRENCY || 4,
  });

  let jobEmbedCtx = null;
  try {
    stageLogger.stageStart('STAGE 1b — Pre-compute job embeddings', {});
    jobEmbedCtx = await precomputeJobEmbeddingContext(jobSections, jobText, openaiClient, mistralClient);
    stageLogger.stageEnd('STAGE 1b', `provider=${jobEmbedCtx.engine || 'unknown'}`);
  } catch (preErr) {
    stageLogger.errorLog('STAGE 1b job embeddings', preErr);
    jobEmbedCtx = null;
  }

  const scoredPairs = new Array(pairs.length);
  let fallbackCount = 0;

  await runCandidateBatches(pairs, EMBED_BATCH_SIZE, EMBED_BATCH_PAUSE_MS, async (pair, pairIndex) => {
    const p1 = computePass1(pair.skillList, normJob.normalizedRequiredSkills, normJob.normalizedPreferredSkills);
    const candYears = Number(pair.summarized.candidateExperience ?? pair.rawCandidate.experience ?? 0) || 0;
    const p2 = computePass2(
      candYears,
      pair.summarized.currentTitle,
      pair.workHistory,
      jobRow.experienceRequired,
      jobRow.title,
      jobRow.description || ''
    );
    const p3 = await computePass3(
      pair.jobSections,
      pair.candidateSections,
      jobText,
      pair.candidateText,
      openaiClient,
      mistralClient,
      jobEmbedCtx
    );
    if (p3.fallbackUsed) fallbackCount += 1;

    const pastTitles = (pair.workHistory || []).map((w) => w.title).filter(Boolean);
    const softSkills = (pair.skillList || []).filter((s) => /communication|leadership|team|collaboration|stakeholder/i.test(String(s)));

    const p4 = await computePass4(
      cultureText,
      jobRow.title,
      String(pair.rawCandidate.cvSummary || pair.rawCandidate.notes || '').slice(0, 1200),
      softSkills,
      pastTitles,
      skipCulture
    );
    stageLogger.pass4Log(pair.name, p4);

    const snap = {
      email: pair.rawCandidate.email,
      phone: pair.rawCandidate.phone,
      location: pair.rawCandidate.location,
      currentTitle: pair.rawCandidate.currentTitle || pair.rawCandidate.designation,
      currentCompany: pair.rawCandidate.currentCompany,
      skillsPreview: pair.skillList,
      summaryPreview: pair.candidateText,
    };

    stageLogger.pairLog(
      pairIndex + 1,
      pairs.length,
      `${pair.name} (${pair.rawCandidate.id})`,
      {
        p1: p1.score,
        p2: p2.score,
        p3: p3.score,
        p4: p4.skipped ? 'skipped' : p4.score,
        p4Source: p4.skipped ? p4.source || 'skipped' : p4.source || (p4.error ? 'default-fallback' : 'llm-response'),
        engine: p3.engine,
        embedFallback: p3.fallbackUsed ? 'yes' : 'no',
      },
      snap
    );

    scoredPairs[pairIndex] = { pair, p1, p2, p3, p4 };
  });

  stageLogger.stageEnd('STAGE 2', `${scoredPairs.length} pairs scored`);

  stageLogger.stageStart('STAGE 3 STARTED — Weighted Score Merger', {});
  const mergedPairs = scoredPairs.map((sp, idx) => {
    const merged = mergeScores(sp.p1, sp.p2, sp.p3, sp.p4);
    stageLogger.mergerLog(idx + 1, scoredPairs.length, sp.pair.name, merged.formula, merged.finalScore, merged.band);
    return { ...sp, merged };
  });
  stageLogger.stageEnd('STAGE 3', `${mergedPairs.length} scores merged`);

  const min = Number(minScore) || 60;
  const preThreshold = mergedPairs.filter((m) => m.merged.finalScore >= min);
  stageLogger.stageStart('STAGE 4 STARTED — LLM Suggestion Engine', { pairsAboveThreshold: preThreshold.length });

  const suggestionInputs = preThreshold.map((p) => ({
    candidateName: p.pair.name,
    jobTitle: jobRow.title,
    finalScore: p.merged.finalScore,
    band: p.merged.band,
    pass1: p.p1,
    pass2: p.p2,
    pass3: p.p3,
    pass4: p.p4,
    matchedSkills: p.p1.matchedRequired,
    missingSkills: p.p1.missingRequired,
    topStrength: getTopPass(p.p1, p.p2, p.p3, p.p4),
    topWeakness: getBottomPass(p.p1, p.p2, p.p3, p.p4),
  }));

  const suggestions = await generateSuggestions(suggestionInputs);
  const suggMap = new Map(suggestions.map((s) => [s.pairIndex, s.suggestion]));
  const preIdxByCand = new Map(preThreshold.map((p, i) => [p.pair.rawCandidate.id, i]));

  const mergedWithSugg = mergedPairs.map((p) => {
    const idx = preIdxByCand.get(p.pair.rawCandidate.id);
    const suggestion = idx !== undefined ? suggMap.get(idx) : null;
    return { ...p, suggestion: suggestion || null, flags: [] };
  });

  stageLogger.stageEnd('STAGE 4', `${suggestions.length} suggestions generated`);

  stageLogger.stageStart('STAGE 5 STARTED — Threshold Filter and Score Banding', {});
  const aboveBeforePenalties = mergedWithSugg.filter((m) => m.merged.finalScore >= min).length;
  stageLogger.stage5ThresholdLog(min, aboveBeforePenalties, mergedWithSugg.length, '(before location/salary penalties)');
  const filtered = applyThreshold(mergedWithSugg, jobRow, min);
  stageLogger.stage5ThresholdLog(
    min,
    filtered.stats?.aboveMinScore ?? 0,
    mergedWithSugg.length,
    '(after penalties)'
  );
  stageLogger.stageEnd('STAGE 5', JSON.stringify(filtered.stats));
  stageLogger.finalScoresSummary(filtered.visible, jobRow.title);

  stageLogger.stageStart('STAGE 6 STARTED — Persisting and Delivering Results', {});

  if (isAppliedPipeline) {
    const candidateIds = candidates.map((c) => c.id).filter(Boolean);
    if (candidateIds.length) {
      await prisma.match.deleteMany({
        where: {
          jobId,
          candidateId: { in: candidateIds },
          createdById: AI_MATCH_AUTHOR_WHERE,
        },
      });
    }
  } else {
    const existingAi = await prisma.match.findMany({
      where: { jobId, createdById: AI_MATCH_AUTHOR_WHERE, status: { not: 'REJECTED' } },
      select: { id: true, evaluation: true },
    });
    const deleteIds = existingAi
      .filter(
        (row) =>
          !(row.evaluation && typeof row.evaluation === 'object' && row.evaluation.origin === 'applied')
      )
      .map((row) => row.id);
    if (deleteIds.length) {
      await prisma.match.deleteMany({ where: { id: { in: deleteIds } } });
    }
  }

  const computedAt = new Date().toISOString();
  const toPersist = filtered.visible;
  let persisted = 0;
  let materialized = 0;
  let skippedPersist = 0;

  for (const ep of toPersist) {
    const evaluationJson = {
      pass1: ep.p1,
      pass2: ep.p2,
      pass3: ep.p3,
      pass4: ep.p4,
      merged: { ...ep.merged },
      finalScore: ep.merged.finalScore,
      band: ep.merged.band,
      weights: ep.merged.weights,
      suggestion: ep.suggestion,
      flags: ep.flags || [],
      engineVersion: '1.0',
      runId,
      computedAt,
      poolSource: isAppliedPipeline
        ? 'tenant-applied'
        : poolStats?.commonIncluded
          ? 'tenant+common'
          : poolStats?.portalIncluded
            ? 'tenant+portal'
            : 'tenant',
      origin: isAppliedPipeline
        ? 'applied'
        : String(ep.pair.rawCandidate?.source || '').toLowerCase() === 'phase1'
          ? 'phase1'
          : 'tenant',
    };

    let candidateId = ep.pair.rawCandidate.id;
    if (typeof materializeCandidate === 'function') {
      const resolved = await materializeCandidate(ep.pair.rawCandidate);
      if (!resolved?.id) {
        skippedPersist += 1;
        continue;
      }
      if (resolved.materialized) materialized += 1;
      candidateId = resolved.id;
    }

    await prisma.match.create({
      data: {
        candidateId,
        jobId,
        score: ep.merged.finalScore,
        status: 'SUGGESTED',
        evaluation: evaluationJson,
      },
    });
    persisted += 1;
  }

  const stage6Summary =
    materialized > 0 || skippedPersist > 0
      ? `${persisted} Match rows written (${materialized} portal→tenant, ${skippedPersist} skipped)`
      : `${persisted} Match rows written (all scored candidates)`;
  stageLogger.stageEnd('STAGE 6', stage6Summary);

  const top = filtered.visible[0];
  stageLogger.pipelineEnd(jobRow, runId, {
    totalPairs: pairs.length,
    visiblePairs: persisted,
    topCandidate: top?.pair?.name,
    topScore: top?.merged?.finalScore,
    topBand: top?.merged?.band,
    fallbacksUsed: fallbackCount,
    duration: ((Date.now() - startTime) / 1000).toFixed(1),
  });

  return { runId, totalPairs: pairs.length, visible: filtered.visible.length, stats: filtered.stats, cached: false };
}

module.exports = { runMatchPipeline, extractJobSections, extractCandidateSections, getTopPass, getBottomPass };
