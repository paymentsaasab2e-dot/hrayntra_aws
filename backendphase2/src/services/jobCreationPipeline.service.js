import fs from 'fs';
import { env } from '../config/env.js';
import { runCvPipelineThroughStage4 } from './cvParsing.service.js';
import {
  chatCompletionWithFallback,
  hasLlmProvider,
  extractUsageFromLlmError,
} from './llmChatFallback.service.js';
import {
  JOB_CREATION_PIPELINE_NAME,
  JOB_CREATION_PIPELINE_SECTIONS,
  jobCreationJsonSchema,
  extractJobRegexFallback,
  mergeJobAiWithFallback,
  resolveCompanyIdByName,
  buildJobExtractionPromptInstructions,
  logJobRegexFieldExtraction,
  enrichJobFieldsAfterMerge,
} from './jobCreationPipelineSchema.js';

const TEXT_CAP = 22000;

function logStageBanner(stage, title) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[${JOB_CREATION_PIPELINE_NAME}] Stage ${stage} — ${title}`);
  console.log('='.repeat(80));
}

function logLines(lines) {
  for (const line of lines) {
    if (line != null && line !== '') console.log(line);
  }
}

function defaultTargetHireDateIso() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

function normalizeJobPipelineOutput(merged, clients = []) {
  const companyId = resolveCompanyIdByName(merged.companyName, clients);
  let targetHireDate = String(merged.targetHireDate || '').trim();
  if (!targetHireDate) targetHireDate = defaultTargetHireDateIso();
  const skills = Array.isArray(merged.skills)
    ? [...new Set(merged.skills.map((s) => String(s).trim()).filter(Boolean))]
    : [];

  return {
    nationality: String(merged.nationality || '').trim(),
    jobTitle: String(merged.jobTitle || '').trim(),
    priority: ['High', 'Medium', 'Low'].includes(merged.priority) ? merged.priority : 'Medium',
    companyName: String(merged.companyName || '').trim(),
    companyId,
    numberOfOpenings: String(merged.numberOfOpenings || '1').trim() || '1',
    country: String(merged.country || '').trim(),
    state: String(merged.state || '').trim(),
    city: String(merged.city || '').trim(),
    industryType: String(merged.industryType || '').trim(),
    employmentType: String(merged.employmentType || '').trim(),
    targetHireDate,
    minExperience: Number.isFinite(Number(merged.minExperience)) ? Number(merged.minExperience) : 0,
    maxExperience: Number.isFinite(Number(merged.maxExperience)) ? Number(merged.maxExperience) : 0,
    payRangeMin: String(merged.payRangeMin || '').trim(),
    payRangeMax: String(merged.payRangeMax || '').trim(),
    salaryCurrency: (() => {
      const raw = String(merged.salaryCurrency || '').trim();
      if (raw && raw !== 'USD') return raw;
      if (merged.country === 'India' || String(merged.nationality || '').toLowerCase().includes('indian')) {
        return 'INR';
      }
      return raw || 'USD';
    })(),
    salaryInput: String(merged.salaryInput || '').trim(),
    jobLocation: String(merged.jobLocation || '').trim(),
    jobLocationType: String(merged.jobLocationType || '').trim(),
    jobType: String(merged.jobType || 'Full Time').trim() || 'Full Time',
    languages: Array.isArray(merged.languages) ? merged.languages : [],
    skills,
    jobDescriptionHtml: String(merged.jobDescriptionHtml || '').trim(),
    jobSummary: String(merged.jobSummary || '').trim(),
    keyResponsibilitiesText: String(merged.keyResponsibilitiesText || '').trim(),
    qualificationsExperienceText: String(merged.qualificationsExperienceText || '').trim(),
    candidateRequirementsText: String(merged.candidateRequirementsText || '').trim(),
    compensationBenefitsText: String(merged.compensationBenefitsText || '').trim(),
    educationalQualification: String(merged.educationalQualification || '').trim(),
    educationalSpecialization: String(merged.educationalSpecialization || '').trim(),
  };
}

async function extractJobStructuredWithAi(cleanedText, currentForm = {}, options = {}) {
  if (!hasLlmProvider()) {
    throw new Error('AI job creation pipeline is not configured');
  }

  const sourceText = String(cleanedText || '').trim();
  const isNaturalLanguagePrompt =
    options.source === 'prompt' || (sourceText.length > 0 && sourceText.length < 2500);

  const completion = await chatCompletionWithFallback(
    {
      model: env.OPENAI_CHAT_MODEL,
      temperature: 0.2,
      max_tokens: 2800,
      response_format: {
        type: 'json_schema',
        json_schema: jobCreationJsonSchema,
      },
      messages: [
        {
          role: 'system',
          content: isNaturalLanguagePrompt
            ? 'You are an ATS job creation assistant. Extract ALL Add Job form fields from a recruiter\'s short instruction. Never invent location, salary, or country — use only what the user explicitly states. Generate rich description, skills, and responsibilities for the role. Return only valid JSON matching the schema.'
            : 'You are an ATS job creation assistant. Extract job posting fields from document text for an Add Job form. Do not ask questions. Return only valid JSON matching the schema.',
        },
        {
          role: 'user',
          content: [
            buildJobExtractionPromptInstructions(isNaturalLanguagePrompt),
            `Current form (preserve unless document overrides):\n${JSON.stringify(currentForm, null, 2)}`,
            `${isNaturalLanguagePrompt ? 'Recruiter instruction' : 'Document text'}:\n${sourceText.slice(0, TEXT_CAP)}`,
          ].join('\n\n'),
        },
      ],
    },
    'jobcreation-pipeline'
  );

  const raw = completion.choices?.[0]?.message?.content?.trim();
  const parsed = raw ? JSON.parse(raw) : null;
  const usage = completion.usage || extractUsageFromLlmError(completion) || null;
  return { parsed, usage, provider: completion._provider || 'openai' };
}

/**
 * Full jobcreation pipeline: document text extraction (stages 1–3) + job regex (stage 4) + AI (stage 5–8).
 * Does NOT run candidate CV regex (email/phone/name).
 * @param {import('multer').File} file
 * @param {{ currentForm?: Record<string, unknown>, clients?: Array<{ id: string, companyName?: string }> }} options
 */
export async function processJobCreationPipeline(file, options = {}) {
  const { currentForm = {}, clients = [] } = options;
  const t0 = Date.now();

  const textStage = await runCvPipelineThroughStage4(file, {
    skipCandidateRegex: true,
    skipProfilePhoto: true,
    logTag: JOB_CREATION_PIPELINE_NAME,
  });

  logStageBanner(4, 'Regex Safety Net (job fields only)');
  const fallbackData = extractJobRegexFallback(textStage.cleaned);
  logLines(logJobRegexFieldExtraction(fallbackData));

  logStageBanner(5, 'AI Structured Extraction (job creation pipeline)');
  logLines(['Pipeline sections:', ...JOB_CREATION_PIPELINE_SECTIONS.map((s) => `  - ${s}`)]);

  let ai = null;
  let usage = null;
  let parseRoute = 'regex-only';
  let aiError = null;

  try {
    const aiResult = await extractJobStructuredWithAi(textStage.cleaned, currentForm, {
      source: 'document',
    });
    ai = aiResult.parsed;
    usage = aiResult.usage;
    parseRoute = aiResult.provider || 'ai';
    logLines(['AI returned valid JSON ✅', `jobTitle="${ai?.jobTitle || ''}"`]);
  } catch (err) {
    aiError = err?.message || String(err);
    console.error(`[${JOB_CREATION_PIPELINE_NAME}] AI stage failed:`, aiError);
    logLines([`AI failed — using regex fallback only: ${aiError}`]);
  }

  logStageBanner(6, 'Validate + Merge');
  const merged = enrichJobFieldsAfterMerge(
    mergeJobAiWithFallback(ai || {}, fallbackData, textStage.cleaned),
  );
  const normalized = normalizeJobPipelineOutput(merged, clients);

  logStageBanner(7, 'Response payload');
  logLines([
    `companyId: ${normalized.companyId || `(manual select — add client "${normalized.companyName}" first)`}`,
    `jobTitle: ${normalized.jobTitle}`,
    `openings: ${normalized.numberOfOpenings}`,
    `country: ${normalized.country}`,
    `city: ${normalized.city || '—'}`,
    `experience: ${normalized.minExperience}–${normalized.maxExperience} years`,
    `salary: ${normalized.salaryInput || '—'}`,
    `skills: ${normalized.skills.length}`,
    `targetHireDate: ${normalized.targetHireDate}`,
    `descriptionHtml: ${normalized.jobDescriptionHtml ? `${normalized.jobDescriptionHtml.length} chars` : '—'}`,
  ]);

  logStageBanner(8, 'Final Response');
  const elapsed = Date.now() - t0;
  logLines([
    '✅ JOB CREATION PIPELINE COMPLETE',
    `Parse route: ${parseRoute}`,
    `Total time: ~${elapsed}ms`,
  ]);

  return {
    ...normalized,
    extractedTextLength: textStage.cleaned.length,
    jobParseMeta: {
      pipeline: JOB_CREATION_PIPELINE_NAME,
      parseRoute,
      aiError: aiError || undefined,
      tokenUsage: usage || undefined,
      elapsedMs: elapsed,
    },
  };
}

/**
 * Extract full Add Job form fields from a natural-language or pasted-text prompt (no file upload).
 * Uses regex safety net + OpenAI structured JSON (same schema as JD file pipeline).
 */
export async function processJobCreationFromPrompt(promptText, options = {}) {
  const { currentForm = {}, clients = [] } = options;
  const cleaned = String(promptText || '').trim();
  const t0 = Date.now();

  if (!cleaned) {
    throw new Error('Job prompt is required');
  }

  logStageBanner(4, 'Regex Safety Net (job fields from prompt)');
  const fallbackData = extractJobRegexFallback(cleaned);
  logLines(logJobRegexFieldExtraction(fallbackData));

  logStageBanner(5, 'AI Structured Extraction (job prompt)');
  logLines(['Pipeline sections:', ...JOB_CREATION_PIPELINE_SECTIONS.map((s) => `  - ${s}`)]);

  let ai = null;
  let usage = null;
  let parseRoute = 'regex-only';
  let aiError = null;

  try {
    const aiResult = await extractJobStructuredWithAi(cleaned, currentForm, { source: 'prompt' });
    ai = aiResult.parsed;
    usage = aiResult.usage;
    parseRoute = aiResult.provider || 'ai';
    logLines(['AI returned valid JSON ✅', `jobTitle="${ai?.jobTitle || ''}"`]);
  } catch (err) {
    aiError = err?.message || String(err);
    console.error(`[${JOB_CREATION_PIPELINE_NAME}] prompt AI stage failed:`, aiError);
    logLines([`AI failed — using regex fallback only: ${aiError}`]);
  }

  logStageBanner(6, 'Validate + Merge');
  const merged = enrichJobFieldsAfterMerge(mergeJobAiWithFallback(ai || {}, fallbackData, cleaned));
  const normalized = normalizeJobPipelineOutput(merged, clients);

  logStageBanner(7, 'Response payload (prompt)');
  logLines([
    `jobTitle: ${normalized.jobTitle}`,
    `city: ${normalized.city || '—'}`,
    `country: ${normalized.country}`,
    `salary: ${normalized.salaryInput || '—'}`,
    `currency: ${normalized.salaryCurrency || '—'}`,
    `skills: ${normalized.skills.length}`,
  ]);

  const elapsed = Date.now() - t0;
  return {
    ...normalized,
    extractedTextLength: cleaned.length,
    jobParseMeta: {
      pipeline: JOB_CREATION_PIPELINE_NAME,
      source: 'prompt',
      parseRoute,
      aiError: aiError || undefined,
      tokenUsage: usage || undefined,
      elapsedMs: elapsed,
    },
  };
}

/** Remove temp upload after processing. */
export function cleanupJobPipelineUpload(file) {
  try {
    if (file?.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  } catch {
    /* ignore */
  }
}
