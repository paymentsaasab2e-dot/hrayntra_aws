import { env } from '../config/env.js';
import { buildKycFieldCoverage } from '../utils/kycFormFieldManifest.js';
import { parseKycFormFromText } from '../utils/parseKycFormFromText.js';
import { runKycPipeline } from './kycPipeline.service.js';
import { chatCompletionWithFallback, hasLlmProvider } from './llmChatFallback.service.js';

const ENTITY_TYPES = ['LLC', 'Corporation', 'Partnership', 'Sole Proprietorship', 'Other'];
const ID_TYPES = ['National ID', 'Passport', 'Driving License'];

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function stringOrEmpty(value) {
  return value == null ? '' : String(value).trim();
}

function normalizeEntityType(value) {
  const v = stringOrEmpty(value);
  if (!v) return '';
  const exact = ENTITY_TYPES.find((type) => type.toLowerCase() === v.toLowerCase());
  return exact || v;
}

function normalizeIdType(value) {
  const v = stringOrEmpty(value);
  if (!v) return '';
  const exact = ID_TYPES.find((type) => type.toLowerCase() === v.toLowerCase());
  return exact || v;
}

function normalizeDate(value) {
  const raw = stringOrEmpty(value);
  if (!raw) return '';
  const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    return `${iso[1]}-${String(iso[2]).padStart(2, '0')}-${String(iso[3]).padStart(2, '0')}`;
  }
  const dmy = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
  }
  return raw;
}

function mapShareholders(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => ({
      fullName: stringOrEmpty(row?.fullName),
      nationality: stringOrEmpty(row?.nationality),
      ownershipPercentage: stringOrEmpty(row?.ownershipPercentage).replace(/%/g, ''),
      passportNumber: stringOrEmpty(row?.passportNumber),
      passportExpiryDate: normalizeDate(row?.passportExpiryDate),
    }))
    .filter((row) => Object.values(row).some(Boolean));
}

function mapAiKycForm(parsed = {}) {
  const client = parsed.clientInformation || parsed.client || {};
  const signatory = parsed.authorizedSignatory || parsed.signatory || {};
  const bank = parsed.bankAccountDetails || parsed.bank || {};
  const declaration = parsed.declaration || {};
  const attachments = parsed.attachmentsChecklist || parsed.attachments || {};
  const internal = parsed.internalUseOnly || parsed.internal || null;

  return {
    clientInformation: {
      companyName: stringOrEmpty(client.companyName),
      tradeName: stringOrEmpty(client.tradeName),
      entityType: normalizeEntityType(client.entityType),
      incorporationDate: normalizeDate(client.incorporationDate),
      countryOfIncorporation: stringOrEmpty(client.countryOfIncorporation),
      legalRegistrationNumber: stringOrEmpty(client.legalRegistrationNumber),
      taxIdVatNumber: stringOrEmpty(client.taxIdVatNumber),
      businessAddress: stringOrEmpty(client.businessAddress),
      website: stringOrEmpty(client.website),
      primaryContactPerson: stringOrEmpty(client.primaryContactPerson),
      contactDesignation: stringOrEmpty(client.contactDesignation),
      officialEmail: stringOrEmpty(client.officialEmail || client.email),
      phoneNumber: stringOrEmpty(client.phoneNumber),
    },
    authorizedSignatory: {
      fullName: stringOrEmpty(signatory.fullName),
      designation: stringOrEmpty(signatory.designation),
      nationality: stringOrEmpty(signatory.nationality),
      dateOfBirth: normalizeDate(signatory.dateOfBirth),
      idType: normalizeIdType(signatory.idType),
      idNumber: stringOrEmpty(signatory.idNumber),
      issueDate: normalizeDate(signatory.issueDate),
      expiryDate: normalizeDate(signatory.expiryDate),
      email: stringOrEmpty(signatory.email),
      phone: stringOrEmpty(signatory.phone),
    },
    shareholders: mapShareholders(parsed.shareholders),
    bankAccountDetails: {
      bankName: stringOrEmpty(bank.bankName),
      accountHolderName: stringOrEmpty(bank.accountHolderName),
      accountNumber: stringOrEmpty(bank.accountNumber),
      iban: stringOrEmpty(bank.iban),
      swiftBicCode: stringOrEmpty(bank.swiftBicCode || bank.swift),
      bankAddress: stringOrEmpty(bank.bankAddress),
      currency: stringOrEmpty(bank.currency),
    },
    declaration: {
      authorizedSignatoryName: stringOrEmpty(declaration.authorizedSignatoryName),
      date: normalizeDate(declaration.date),
    },
    attachmentsChecklist: {
      shareholderPassportCopy: Boolean(attachments.shareholderPassportCopy),
      generalManagerIdCard: Boolean(attachments.generalManagerIdCard),
      companyDocument: Boolean(attachments.companyDocument),
      bankAccountProof: Boolean(attachments.bankAccountProof),
    },
    internalUseOnly: internal,
  };
}

function mergeKycForms(base, overlay) {
  const merged = JSON.parse(JSON.stringify(base));

  const mergeSection = (target, source) => {
    for (const [key, value] of Object.entries(source || {})) {
      if (value == null || String(value).trim() === '') continue;
      if (!target[key] || String(target[key]).trim() === '') {
        target[key] = value;
      }
    }
  };

  mergeSection(merged.clientInformation, overlay.clientInformation);
  mergeSection(merged.authorizedSignatory, overlay.authorizedSignatory);
  mergeSection(merged.bankAccountDetails, overlay.bankAccountDetails);
  mergeSection(merged.declaration, overlay.declaration);

  if (Array.isArray(overlay.shareholders) && overlay.shareholders.length) {
    merged.shareholders = overlay.shareholders.map((row, index) => {
      const existing = merged.shareholders[index] || {};
      return {
        fullName: existing.fullName || row.fullName || '',
        nationality: existing.nationality || row.nationality || '',
        ownershipPercentage: existing.ownershipPercentage || row.ownershipPercentage || '',
        passportNumber: existing.passportNumber || row.passportNumber || '',
        passportExpiryDate: existing.passportExpiryDate || row.passportExpiryDate || '',
      };
    });
  }

  if (overlay.attachmentsChecklist) {
    merged.attachmentsChecklist = {
      shareholderPassportCopy:
        merged.attachmentsChecklist?.shareholderPassportCopy ||
        overlay.attachmentsChecklist.shareholderPassportCopy ||
        false,
      generalManagerIdCard:
        merged.attachmentsChecklist?.generalManagerIdCard ||
        overlay.attachmentsChecklist.generalManagerIdCard ||
        false,
      companyDocument:
        merged.attachmentsChecklist?.companyDocument ||
        overlay.attachmentsChecklist.companyDocument ||
        false,
      bankAccountProof:
        merged.attachmentsChecklist?.bankAccountProof ||
        overlay.attachmentsChecklist.bankAccountProof ||
        false,
    };
  }

  if (overlay.internalUseOnly) {
    merged.internalUseOnly = { ...(merged.internalUseOnly || {}), ...overlay.internalUseOnly };
  }

  return merged;
}

async function extractKycFormWithAi(cleanedText, fileName = 'kyc') {
  if (!hasLlmProvider() || !String(cleanedText || '').trim()) {
    return null;
  }

  const capped = cleanedText.slice(0, 28000);
  const prompt = `Extract HRYANTRA client KYC form data from the document text below.

Return ONLY one valid JSON object with this structure (use null or empty string if not found):
{
  "clientInformation": {
    "companyName": "",
    "tradeName": "",
    "entityType": "LLC|Corporation|Partnership|Sole Proprietorship|Other",
    "incorporationDate": "YYYY-MM-DD",
    "countryOfIncorporation": "",
    "legalRegistrationNumber": "",
    "taxIdVatNumber": "",
    "businessAddress": "",
    "website": "",
    "primaryContactPerson": "",
    "contactDesignation": "",
    "officialEmail": "",
    "phoneNumber": ""
  },
  "authorizedSignatory": {
    "fullName": "",
    "designation": "",
    "nationality": "",
    "dateOfBirth": "YYYY-MM-DD",
    "idType": "National ID|Passport|Driving License",
    "idNumber": "",
    "issueDate": "YYYY-MM-DD",
    "expiryDate": "YYYY-MM-DD",
    "email": "",
    "phone": ""
  },
  "shareholders": [
    {
      "fullName": "",
      "nationality": "",
      "ownershipPercentage": "",
      "passportNumber": "",
      "passportExpiryDate": "YYYY-MM-DD"
    }
  ],
  "bankAccountDetails": {
    "bankName": "",
    "accountHolderName": "",
    "accountNumber": "",
    "iban": "",
    "swiftBicCode": "",
    "bankAddress": "",
    "currency": ""
  },
  "declaration": {
    "authorizedSignatoryName": "",
    "date": "YYYY-MM-DD"
  },
  "attachmentsChecklist": {
    "shareholderPassportCopy": true|false,
    "generalManagerIdCard": true|false,
    "companyDocument": true|false,
    "bankAccountProof": true|false
  }
}

Use section headers (1. Client Information, 2. Authorized Signatory, etc.). Include all shareholders found.
Do not invent internal SAASA review fields unless an "Internal Use Only" section exists in the document.
Do not list attachment file names — only checklist booleans when clearly marked attached/yes.
Document file name: ${fileName}

KYC document text:
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
            'You extract structured KYC onboarding form data. Output JSON only, no markdown.',
        },
        { role: 'user', content: prompt },
      ],
    },
    'kyc-parse',
    { quiet: true },
  );

  const parsed = safeJsonParse(completion.choices?.[0]?.message?.content || '{}');
  return parsed ? mapAiKycForm(parsed) : null;
}

/**
 * Dedicated KYC pipeline: validate → extract text → clean → regex + AI field mapping.
 */
export async function parseKycDocumentFromUpload(multerFile) {
  if (!multerFile?.buffer?.length) {
    throw new Error('No file uploaded');
  }

  const stage = await runKycPipeline(multerFile);
  const cleaned = stage.cleaned || '';
  const sourceType = stage.sourceType || 'unknown';

  if (sourceType === 'image' && cleaned.length < 20) {
    const empty = parseKycFormFromText('');
    return {
      form: empty.form,
      filledCount: 0,
      totalExtractable: empty.totalExtractable,
      coverage: empty.coverage,
      textLength: 0,
      sourceType,
      message:
        'Image uploaded for KYC records. Scanned forms cannot be auto-read yet — use PDF, Word, or Excel, or enter details manually.',
      diagnostics: stage.diagnostics,
    };
  }

  if (cleaned.length < 15) {
    throw new Error(
      'Could not read enough text from this document. Try a text-based PDF, Word file, or Excel KYC form.',
    );
  }

  const fileName = multerFile.originalname || 'kyc-document';
  const regexResult = parseKycFormFromText(cleaned);
  let form = JSON.parse(JSON.stringify(regexResult.form));

  try {
    const aiForm = await extractKycFormWithAi(cleaned, fileName);
    if (aiForm) {
      form = mergeKycForms(form, aiForm);
    }
  } catch {
    /* keep regex-only result */
  }

  const coverage = buildKycFieldCoverage(form);

  return {
    form,
    filledCount: coverage.filledCount,
    totalExtractable: coverage.totalExtractable,
    coverage,
    textLength: cleaned.length,
    sourceType,
    diagnostics: stage.diagnostics,
  };
}
