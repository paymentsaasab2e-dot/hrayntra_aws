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
  normalizeExtractedJobTitle,
  isImplausibleJobLocation,
} from './jobCreationPipelineSchema.js';

const TEXT_CAP = 22000;

function stripHtmlApprox(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineMarkdown(escaped) {
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\*)(.+?)\*(?!\*)/g, '$1<em>$2</em>');
}

/** Convert pasted plain/markdown JD into HTML when AI shortens the description. */
function plainTextToJobDescriptionHtml(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!raw) return '';
  if (/<[a-z][\s\S]*>/i.test(raw) && /<\/[a-z][a-z0-9]*>/i.test(raw)) return raw;

  const lines = raw.split('\n');
  const out = [];
  let listType = null;
  const closeList = () => {
    if (!listType) return;
    out.push(`</${listType}>`);
    listType = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      continue;
    }
    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = Math.min(heading[1].length + 1, 4);
      out.push(`<h${level}>${inlineMarkdown(escapeHtml(heading[2]))}</h${level}>`);
      continue;
    }
    const boldHeading = trimmed.match(/^\*\*(.+?)\*\*:?$/);
    if (boldHeading && boldHeading[1].length < 80) {
      closeList();
      out.push(`<h3>${inlineMarkdown(escapeHtml(boldHeading[1]))}</h3>`);
      continue;
    }
    const bullet = trimmed.match(/^([-*•]|\d+[.)])\s+(.+)$/);
    if (bullet) {
      const nextType = /^\d+[.)]/.test(bullet[1]) ? 'ol' : 'ul';
      if (listType !== nextType) {
        closeList();
        out.push(`<${nextType}>`);
        listType = nextType;
      }
      out.push(`<li>${inlineMarkdown(escapeHtml(bullet[2]))}</li>`);
      continue;
    }
    closeList();
    out.push(`<p>${inlineMarkdown(escapeHtml(trimmed))}</p>`);
  }
  closeList();
  return out.join('\n');
}

function preferFullSourceJobDescription(merged, sourceText) {
  const source = String(sourceText || '').trim();
  if (source.length < 200) return merged;
  const aiPlain = stripHtmlApprox(merged?.jobDescriptionHtml);
  if (!aiPlain || aiPlain.length < Math.floor(source.length * 0.85)) {
    return {
      ...merged,
      jobDescriptionHtml: plainTextToJobDescriptionHtml(source),
    };
  }
  return merged;
}

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

  const city = isImplausibleJobLocation(merged.city) ? '' : String(merged.city || '').trim();
  const state = isImplausibleJobLocation(merged.state) ? '' : String(merged.state || '').trim();
  const jobLocation = isImplausibleJobLocation(merged.jobLocation)
    ? ''
    : String(merged.jobLocation || '').trim();

  return {
    nationality: String(merged.nationality || '').trim(),
    jobTitle: normalizeExtractedJobTitle(merged.jobTitle),
    priority: ['High', 'Medium', 'Low'].includes(merged.priority) ? merged.priority : 'Medium',
    companyName: String(merged.companyName || '').trim(),
    companyId,
    numberOfOpenings: String(merged.numberOfOpenings || '1').trim() || '1',
    country: String(merged.country || '').trim(),
    state,
    city,
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
    jobLocation,
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
  // Long pasted JDs are documents — extract fields, don't rewrite the whole posting as a short prompt.
  const isNaturalLanguagePrompt =
    options.source === 'prompt' && sourceText.length > 0 && sourceText.length < 1200;

  const completion = await chatCompletionWithFallback(
    {
      model: env.OPENAI_CHAT_MODEL,
      temperature: 0.2,
      max_tokens: 6000,
      response_format: {
        type: 'json_schema',
        json_schema: jobCreationJsonSchema,
      },
      messages: [
        {
          role: 'system',
          content: isNaturalLanguagePrompt
            ? 'You are an ATS job creation assistant. Extract ALL Add Job form fields from a recruiter\'s short instruction. jobTitle must be a short role name only (no method parentheses). Never invent location, salary, or country — use only what the user explicitly states. Never put language preferences into city/location. Generate rich description, skills, and responsibilities for the role. Return only valid JSON matching the schema.'
            : 'You are an ATS job creation assistant. Extract job posting fields from document text for an Add Job form. jobTitle must be short and clean (role ± domain only; drop parenthetical methods). Location fields must be real places, never language requirements. Preserve the full job description content in jobDescriptionHtml — do not summarize or shorten. Do not ask questions. Return only valid JSON matching the schema.',
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
  const merged = preferFullSourceJobDescription(
    enrichJobFieldsAfterMerge(
      mergeJobAiWithFallback(ai || {}, fallbackData, textStage.cleaned),
    ),
    textStage.cleaned,
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
  const merged = preferFullSourceJobDescription(
    enrichJobFieldsAfterMerge(mergeJobAiWithFallback(ai || {}, fallbackData, cleaned)),
    cleaned,
  );
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
