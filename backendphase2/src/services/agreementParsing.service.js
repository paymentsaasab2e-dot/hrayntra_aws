import { env } from '../config/env.js';
import { parseAgreementTermsFromText, toIsoDate } from '../utils/parseAgreementTermsFromText.js';
import { runAgreementPipeline } from './agreementPipeline.service.js';
import { chatCompletionWithFallback, hasLlmProvider } from './llmChatFallback.service.js';

const LEVEL_OPTIONS = ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Executive', 'All levels'];

function safeJsonParse(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeLevel(value) {
  const v = String(value || '').trim();
  if (!v) return '';

  const lower = v.toLowerCase();
  if (/\ball\s+levels?\b/.test(lower) || lower === 'all' || lower === 'any level') {
    return 'All levels';
  }

  const tierMap = [
    { keys: ['entry level', 'entry'], level: 'Level 1' },
    { keys: ['middle level', 'middle'], level: 'Level 2' },
    { keys: ['top level', 'top'], level: 'Level 3' },
  ];
  for (const row of tierMap) {
    if (row.keys.some((key) => lower === key || lower.includes(key))) {
      return row.level;
    }
  }

  const exact = LEVEL_OPTIONS.find((level) => level.toLowerCase() === lower);
  if (exact) return exact;

  if (/\bexecutive\b/i.test(v) && !/senior\s+executive/i.test(v)) {
    return 'Executive';
  }

  const loose = LEVEL_OPTIONS.find((level) => lower.includes(level.toLowerCase()));
  return loose || '';
}

function stripPercent(value) {
  return String(value ?? '')
    .replace(/%/g, '')
    .trim();
}

function mapFreeReplacement(parsed = {}) {
  const value =
    parsed.agreementFreeReplacementValue ??
    parsed.freeReplacementValue ??
    parsed.freeReplacement?.value ??
    '';
  let unit = String(
    parsed.agreementFreeReplacementUnit ?? parsed.freeReplacementUnit ?? parsed.freeReplacement?.unit ?? '',
  )
    .trim()
    .toUpperCase();
  if (unit !== 'DAYS' && unit !== 'MONTHS') {
    const unitText = String(parsed.freeReplacementPeriod ?? '').toLowerCase();
    unit = unitText.startsWith('day') ? 'DAYS' : unit === '' ? '' : 'MONTHS';
  }
  return {
    value: String(value).trim(),
    unit: unit === 'DAYS' || unit === 'MONTHS' ? unit : 'MONTHS',
  };
}

function mapAiTerms(parsed = {}) {
  const advance =
    parsed.agreementAdvancePaymentPercent ??
    parsed.agreementAdvancePayment ??
    parsed.advancePaymentPercent ??
    '';
  const replacement = mapFreeReplacement(parsed);

  return {
    agreementLevel: normalizeLevel(parsed.agreementLevel ?? parsed.level),
    agreementServiceChargePercent: stripPercent(
      parsed.agreementServiceChargePercent ?? parsed.serviceChargePercent ?? '',
    ),
    agreementContractValidity: String(parsed.agreementContractValidity ?? parsed.contractValidity ?? '').trim(),
    agreementContractStartDate: toIsoDate(
      parsed.agreementContractStartDate ?? parsed.contractStartDate ?? parsed.startDate ?? '',
    ),
    agreementContractEndDate: toIsoDate(
      parsed.agreementContractEndDate ?? parsed.contractEndDate ?? parsed.endDate ?? '',
    ),
    agreementTimePeriod: String(
      parsed.agreementPaymentTerms ?? parsed.agreementTimePeriod ?? parsed.paymentTerms ?? '',
    ).trim(),
    agreementAdvancePaymentPercent: stripPercent(advance),
    agreementFreeReplacementValue: replacement.value,
    agreementFreeReplacementUnit: replacement.unit,
  };
}

function mergeAgreementTerms(aiTerms, regexTerms) {
  const merged = { ...regexTerms };
  const regexLevel = String(regexTerms.agreementLevel || '').trim();
  const protectLevelFromBadAi =
    regexLevel &&
    (regexLevel === 'All levels' ||
      ['Level 1', 'Level 2', 'Level 3', 'Level 4'].includes(regexLevel)) &&
    (String(aiTerms?.agreementLevel || '').trim() === 'Executive' ||
      (regexLevel === 'All levels' && String(aiTerms?.agreementLevel || '').trim() !== 'All levels'));

  for (const [key, value] of Object.entries(aiTerms || {})) {
    if (value == null || String(value).trim() === '') continue;
    if (protectLevelFromBadAi && key === 'agreementLevel') continue;
    if (
      regexTerms.agreementContractStartDate &&
      (key === 'agreementContractStartDate' || key === 'agreementContractEndDate')
    ) {
      continue;
    }
    if (
      protectLevelFromBadAi &&
      key === 'agreementServiceChargePercent' &&
      regexTerms.agreementServiceChargePercent
    ) {
      continue;
    }
    merged[key] = value;
  }
  return merged;
}

function countFilled(terms) {
  return Object.values(terms).filter((v) => v != null && String(v).trim() !== '').length;
}

async function extractAgreementTermsWithAi(cleanedText, fileName = 'agreement') {
  if (!hasLlmProvider() || !String(cleanedText || '').trim()) {
    return null;
  }

  const capped = cleanedText.slice(0, 22000);
  const prompt = `Extract recruitment agreement commercial terms from the document text below.

Return ONLY one valid JSON object with these keys (use null if not found):
- agreementLevel: one of "All levels", "Level 1", "Level 2", "Level 3", "Level 4", "Executive"
  Map document tiers: Entry Level -> Level 1, Middle Level -> Level 2, Top Level -> Level 3.
  If the fee applies to all levels (e.g. "for all levels", "8.33% ... all levels"), use "All levels".
  Do NOT default to Level 2 when there is no Entry/Middle/Top table.
  Do NOT use "Executive" from arbitration text (e.g. "Senior executive rank").
- agreementServiceChargePercent: string number only without % (e.g. "8.33"). Use the single stated professional fee when there is no tier table.
- agreementContractStartDate: string in YYYY-MM-DD when present (start / effective / commencement / dated). If the document has no calendar date but is valid for a period from signing/entering the contract, use today's date.
- agreementContractEndDate: string in YYYY-MM-DD when present (end / expiry). If only a duration is given (e.g. 12 months) and a start date exists (including today), compute the end date.
- agreementContractValidity: string summary of the contract validity period (if available)
- agreementPaymentTerms: string — when/how the client pays (e.g. "Professional fee is payable within 30 days from the date of joining by the candidate")
- agreementAdvancePaymentPercent: string number only without % for advance/upfront payment. Null if the document does not mention an advance.
- agreementFreeReplacementValue: string integer for the free-replacement / guarantee window (e.g. "3")
- agreementFreeReplacementUnit: "MONTHS" or "DAYS" for that replacement window

Document file name: ${fileName}

Agreement text:
${capped}`;

  const completion = await chatCompletionWithFallback(
    {
      model: env.OPENAI_CHAT_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You extract commercial terms from recruitment agreements. Output JSON only, no markdown.',
        },
        { role: 'user', content: prompt },
      ],
    },
    'agreement-parse',
    { quiet: false },
  );

  const parsed = safeJsonParse(completion.choices?.[0]?.message?.content || '{}');
  if (!parsed) {
    console.warn('[agreement-parse] AI returned non-JSON content');
    return null;
  }
  return mapAiTerms(parsed);
}

/**
 * Same text pipeline as bulk CV (multi-pass PDF / mammoth / word-extractor), then AI + regex terms.
 */
export async function parseAgreementDocumentFromUpload(multerFile) {
  if (!multerFile?.buffer?.length) {
    throw new Error('No file uploaded');
  }

  const stage = await runAgreementPipeline(multerFile);
  const cleaned = stage.cleaned || '';
  if (cleaned.replace(/\s+/g, '').length < 40) {
    throw new Error(
      'Could not read enough text from this document. Try a text-based PDF or Word file, or a clearer scan.',
    );
  }

  const fileName = multerFile.originalname || 'agreement-document';
  const regexResult = parseAgreementTermsFromText(cleaned);
  let terms = { ...regexResult.terms };

  try {
    const aiTerms = await extractAgreementTermsWithAi(cleaned, fileName);
    if (aiTerms) {
      terms = mergeAgreementTerms(aiTerms, terms);
    }
  } catch (error) {
    console.warn('[agreement-parse] AI extract failed:', error?.message || error);
  }

  return {
    terms,
    filledCount: countFilled(terms),
    textLength: cleaned.length,
    diagnostics: stage.diagnostics,
  };
}
