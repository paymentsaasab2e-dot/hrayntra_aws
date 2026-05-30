import path from 'path';
import { logKycCoverage } from '../utils/kycFormFieldManifest.js';
import { parseKycFormFromText } from '../utils/parseKycFormFromText.js';
import { extractKycDocumentTextFromUpload } from '../utils/kycDocumentTextExtract.js';

const KYC_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const KYC_ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.txt',
  '.csv',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
]);

function divider(char = '=') {
  return char.repeat(80);
}

function cleanAndDeduplicate(text = '') {
  const lines = String(text || '')
    .replace(/\u0000/g, ' ')
    .split('\n');
  const out = [];
  const seenBoilerplate = new Set();
  let duplicateCount = 0;
  let previousKey = null;

  for (const line of lines) {
    const normalized = line.replace(/\s+/g, ' ').trim();
    if (!normalized) continue;

    // Keep repeated label:value rows (e.g. Nationality: Indian for each shareholder).
    const isLabelValue =
      /^[^:]{2,80}:\s*\S/.test(normalized) && !/^https?:\/\//i.test(normalized);

    if (isLabelValue) {
      out.push(normalized);
      previousKey = null;
      continue;
    }

    const key = normalized.toLowerCase();
    if (key === previousKey || seenBoilerplate.has(key)) {
      duplicateCount += 1;
      continue;
    }

    previousKey = key;
    seenBoilerplate.add(key);
    out.push(normalized);
  }

  return {
    cleaned: out.join('\n'),
    duplicateCount,
  };
}

export function validateKycUploadFile(file) {
  const fileName = file?.originalname || file?.filename || 'upload';
  const ext = path.extname(fileName || '').toLowerCase();
  const mime = String(file?.mimetype || '').toLowerCase();
  const size = Number(file?.size || 0);
  const maxSize = 10 * 1024 * 1024;

  if (!size) return { ok: false, message: 'File appears to be empty.' };
  if (size > maxSize) return { ok: false, message: 'File too large. Max 10MB allowed.' };
  if (!KYC_ALLOWED_MIME_TYPES.has(mime) && !KYC_ALLOWED_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      message: 'Only PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, and WEBP files are allowed.',
    };
  }
  return { ok: true };
}

export async function runKycPipeline(file) {
  const fileName = file?.originalname || file?.filename || 'kyc-document';
  const ext = path.extname(fileName || '').toLowerCase();
  const mime = String(file?.mimetype || '').toLowerCase();
  const kb = (Number(file?.size || 0) / 1024).toFixed(2);

  console.log('');
  console.log(`KYC Pipeline — ${fileName}`);
  console.log(divider('='));
  console.log('Stage 1 — File Validation');
  console.log(divider('='));
  console.log(`File: ${fileName}`);
  console.log(`Size: ${kb} KB`);
  console.log(`MIME: ${mime}`);
  console.log(`Extension: ${ext || '(none)'}`);

  const validation = validateKycUploadFile(file);
  if (!validation.ok) {
    console.log(`Status: ❌ REJECTED — ${validation.message}`);
    throw new Error(validation.message);
  }
  console.log('Status: ✅ ACCEPTED — proceeding to extraction');

  console.log('');
  console.log(divider('='));
  console.log('Stage 2 — KYC Text Extraction');
  console.log(divider('='));
  const { text: extracted, sourceType } = await extractKycDocumentTextFromUpload(file);
  console.log(`Source type: ${sourceType}`);
  console.log(`Extracted text length: ${extracted.length}`);

  if (sourceType === 'image' && extracted.length < 20) {
    console.log('Note: Image file — limited text extraction. AI/manual review recommended.');
  }

  console.log('');
  console.log(divider('='));
  console.log('Stage 3 — Clean + Deduplicate');
  console.log(divider('='));
  const { cleaned, duplicateCount } = cleanAndDeduplicate(extracted);
  console.log(`Input length: ${extracted.length} chars`);
  console.log(`After cleaning: ${cleaned.length} chars`);
  console.log(`Duplicate lines removed: ${duplicateCount}`);

  try {
    const preview = parseKycFormFromText(cleaned);
    console.log('');
    console.log(divider('='));
    console.log('Stage 4 — KYC field extraction (preview)');
    console.log(divider('='));
    console.log(`Company: ${preview.form.clientInformation.companyName || '(not detected)'}`);
    console.log(`Signatory: ${preview.form.authorizedSignatory.fullName || '(not detected)'}`);
    console.log(`Shareholders: ${preview.form.shareholders.length}`);
    console.log(`Bank: ${preview.form.bankAccountDetails.bankName || '(not detected)'}`);
    logKycCoverage(preview.coverage);
  } catch (previewErr) {
    console.warn('[KYC Pipeline] Stage 4 preview failed:', previewErr?.message || previewErr);
  }

  return {
    rawText: extracted,
    cleaned,
    sourceType,
    diagnostics: {
      fileName,
      sizeBytes: Number(file?.size || 0),
      mime,
      extension: ext,
      sourceType,
      rawLength: extracted.length,
      cleanedLength: cleaned.length,
      duplicateLinesRemoved: duplicateCount,
    },
  };
}
