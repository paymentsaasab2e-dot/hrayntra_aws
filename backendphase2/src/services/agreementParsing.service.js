import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { env } from '../config/env.js';
import { parseAgreementTermsFromText } from '../utils/parseAgreementTermsFromText.js';
import { runCvPipelineThroughStage4, validateCvUploadFile } from './cvParsing.service.js';
import { chatCompletionWithFallback, hasLlmProvider } from './llmChatFallback.service.js';

const LEVEL_OPTIONS = ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Executive'];

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeLevel(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  const exact = LEVEL_OPTIONS.find((level) => level.toLowerCase() === v.toLowerCase());
  if (exact) return exact;
  const loose = LEVEL_OPTIONS.find((level) => v.toLowerCase().includes(level.toLowerCase()));
  return loose || v;
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
  for (const [key, value] of Object.entries(aiTerms || {})) {
    if (value != null && String(value).trim() !== '') {
      merged[key] = value;
    }
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
- agreementLevel: one of "Level 1", "Level 2", "Level 3", "Level 4", "Executive"
- agreementServiceChargePercent: string number only without % (e.g. "8.5")
- agreementPaymentTerms: string — when/how the client pays (e.g. "Payment due after candidate joins")
- agreementAdvancePaymentPercent: string number only without % for advance/upfront payment
- agreementFreeReplacementValue: string integer (e.g. "3")
- agreementFreeReplacementUnit: "MONTHS" or "DAYS"

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
    { quiet: true },
  );

  const parsed = safeJsonParse(completion.choices?.[0]?.message?.content || '{}');
  return parsed ? mapAiTerms(parsed) : null;
}

/**
 * Same text pipeline as bulk CV (multi-pass PDF / mammoth / word-extractor), then AI + regex terms.
 */
export async function parseAgreementDocumentFromUpload(multerFile) {
  const ext = path.extname(multerFile.originalname || '.pdf').toLowerCase() || '.pdf';
  const tmpPath = path.join(os.tmpdir(), `agreement-${randomUUID()}${ext}`);
  fs.writeFileSync(tmpPath, multerFile.buffer);

  const file = {
    path: tmpPath,
    originalname: multerFile.originalname || `agreement${ext}`,
    filename: multerFile.originalname || `agreement${ext}`,
    mimetype: multerFile.mimetype,
    size: multerFile.size,
  };

  try {
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new Error('Only PDF, DOC, and DOCX files are allowed');
    }

    const validation = validateCvUploadFile(file);
    if (!validation.ok) {
      throw new Error(validation.message);
    }

    const stage4 = await runCvPipelineThroughStage4(file);
    const cleaned = stage4.cleaned || '';
    if (cleaned.length < 20) {
      throw new Error(
        'Could not read enough text from this document. Try a text-based PDF or Word file.',
      );
    }

    const regexResult = parseAgreementTermsFromText(cleaned);
    let terms = { ...regexResult.terms };

    try {
      const aiTerms = await extractAgreementTermsWithAi(cleaned, file.originalname);
      if (aiTerms) {
        terms = mergeAgreementTerms(aiTerms, terms);
      }
    } catch {
      /* keep regex-only result */
    }

    return {
      terms,
      filledCount: countFilled(terms),
      textLength: cleaned.length,
    };
  } finally {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      /* ignore */
    }
  }
}
