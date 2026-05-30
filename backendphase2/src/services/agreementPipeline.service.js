import path from 'path';
import { parseAgreementTermsFromText } from '../utils/parseAgreementTermsFromText.js';
import { extractDocumentTextFromUpload } from '../utils/documentTextExtract.js';

const AGREEMENT_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const AGREEMENT_ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx']);

function divider(char = '=') {
  return char.repeat(80);
}

function cleanAndDeduplicate(text = '') {
  const lines = String(text || '')
    .replace(/\u0000/g, ' ')
    .split('\n');
  const out = [];
  const seen = new Set();
  let duplicateCount = 0;
  for (const line of lines) {
    const normalized = line.replace(/\s+/g, ' ').trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(key);
    out.push(normalized);
  }
  return {
    cleaned: out.join('\n'),
    duplicateCount,
  };
}

export function validateAgreementUploadFile(file) {
  const fileName = file?.originalname || file?.filename || 'upload';
  const ext = path.extname(fileName || '').toLowerCase();
  const mime = String(file?.mimetype || '').toLowerCase();
  const size = Number(file?.size || 0);
  const maxSize = 10 * 1024 * 1024;

  if (!size) return { ok: false, message: 'File appears to be empty.' };
  if (size > maxSize) return { ok: false, message: 'File too large. Max 10MB allowed.' };
  if (!AGREEMENT_ALLOWED_MIME_TYPES.has(mime) && !AGREEMENT_ALLOWED_EXTENSIONS.has(ext)) {
    return { ok: false, message: 'Only PDF, DOC, and DOCX files are allowed.' };
  }
  return { ok: true };
}

export async function runAgreementPipeline(file) {
  const fileName = file?.originalname || file?.filename || 'agreement-document';
  const ext = path.extname(fileName || '').toLowerCase();
  const mime = String(file?.mimetype || '').toLowerCase();
  const kb = (Number(file?.size || 0) / 1024).toFixed(2);

  console.log('');
  console.log(`Agreement Pipeline — ${fileName}`);
  console.log(divider('='));
  console.log('Stage 1 — File Validation');
  console.log(divider('='));
  console.log(`File: ${fileName}`);
  console.log(`Size: ${kb} KB`);
  console.log(`MIME: ${mime}`);
  console.log(`Extension: ${ext || '(none)'}`);

  const validation = validateAgreementUploadFile(file);
  if (!validation.ok) {
    console.log(`Status: ❌ REJECTED — ${validation.message}`);
    throw new Error(validation.message);
  }
  console.log('Status: ✅ ACCEPTED — proceeding to extraction');

  console.log('');
  console.log(divider('='));
  console.log('Stage 2 — Agreement Text Extraction');
  console.log(divider('='));
  const extracted = await extractDocumentTextFromUpload(file);
  console.log(`Extracted text length: ${extracted.length}`);

  console.log('');
  console.log(divider('='));
  console.log('Stage 3 — Clean + Deduplicate');
  console.log(divider('='));
  const { cleaned, duplicateCount } = cleanAndDeduplicate(extracted);
  console.log(`Input length: ${extracted.length} chars`);
  console.log(`After cleaning: ${cleaned.length} chars`);
  console.log(`Duplicate lines removed: ${duplicateCount}`);

  try {
    const preview = parseAgreementTermsFromText(cleaned);
    console.log('');
    console.log(divider('='));
    console.log('Stage 4 — Agreement field extraction (preview)');
    console.log(divider('='));
    console.log(`Level: ${preview.terms.agreementLevel || '(not detected)'}`);
    console.log(`Service charge %: ${preview.terms.agreementServiceChargePercent || '(not detected)'}`);
    console.log(`Payment terms: ${preview.terms.agreementTimePeriod ? 'detected' : '(not detected)'}`);
    console.log(`Free replacement: ${preview.terms.agreementFreeReplacementValue || '-'} ${preview.terms.agreementFreeReplacementUnit || ''}`);
    console.log(`Contract validity: ${preview.terms.agreementContractValidity || '(not detected)'}`);
    console.log(`Fields filled: ${preview.filledCount}`);
  } catch (previewErr) {
    console.warn('[Agreement Pipeline] Stage 4 preview failed:', previewErr?.message || previewErr);
  }

  return {
    rawText: extracted,
    cleaned,
    diagnostics: {
      fileName,
      sizeBytes: Number(file?.size || 0),
      mime,
      extension: ext,
      rawLength: extracted.length,
      cleanedLength: cleaned.length,
      duplicateLinesRemoved: duplicateCount,
    },
  };
}

