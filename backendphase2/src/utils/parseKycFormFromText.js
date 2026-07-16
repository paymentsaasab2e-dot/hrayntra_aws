import { buildKycFieldCoverage } from './kycFormFieldManifest.js';

const ENTITY_TYPES = ['LLC', 'Corporation', 'Partnership', 'Sole Proprietorship', 'Other'];
const ID_TYPES = ['National ID', 'Passport', 'Driving License'];

function normalizeText(text = '') {
  return String(text)
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sliceSection(text, startPattern, endPattern) {
  const start = text.search(startPattern);
  if (start < 0) return '';
  const fromStart = text.slice(start);
  const relativeEnd = fromStart.slice(1).search(endPattern);
  if (relativeEnd < 0) return fromStart;
  return fromStart.slice(0, relativeEnd + 1);
}

function pickLabelValue(text, labels = []) {
  for (const label of labels) {
    const pattern = new RegExp(
      `${escapeRegExp(label)}\\s*[:\\-|]\\s*([^\\n|]{1,240})`,
      'i',
    );
    const match = text.match(pattern);
    if (match?.[1]) {
      const value = String(match[1]).trim().replace(/\s{2,}/g, ' ');
      if (value.length > 0 && value.length < 240) return value;
    }
  }
  return '';
}

function toIsoDate(token) {
  const raw = String(token || '').trim();
  if (!raw) return '';

  const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    return `${iso[1]}-${String(iso[2]).padStart(2, '0')}-${String(iso[3]).padStart(2, '0')}`;
  }

  const dmy = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
  }

  return '';
}

function pickDate(text, labels) {
  const raw = pickLabelValue(text, labels);
  return toIsoDate(raw) || raw;
}

function normalizeEntityType(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  const found = ENTITY_TYPES.find((type) => v.toLowerCase() === type.toLowerCase());
  if (found) return found;
  if (/llc/i.test(v)) return 'LLC';
  if (/corp/i.test(v)) return 'Corporation';
  if (/partner/i.test(v)) return 'Partnership';
  if (/sole/i.test(v)) return 'Sole Proprietorship';
  return '';
}

function normalizeIdType(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  const found = ID_TYPES.find((type) => v.toLowerCase() === type.toLowerCase());
  if (found) return found;
  if (/passport/i.test(v)) return 'Passport';
  if (/national/i.test(v)) return 'National ID';
  if (/driv/i.test(v)) return 'Driving License';
  return '';
}

function pickEmailInSection(section, labels = ['Email (Official)', 'Official Email', 'Email']) {
  const labeled = pickLabelValue(section, labels);
  if (labeled && /@/.test(labeled)) return labeled.split(/\s/)[0];
  const match = section.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : '';
}

function pickWebsite(section) {
  const labeled = pickLabelValue(section, ['Website', 'Company Website']);
  if (labeled) {
    const cleaned = labeled.replace(/^https?:\/\//i, '').split(/\s/)[0];
    return cleaned ? `https://${cleaned.replace(/^\/+/, '')}` : '';
  }
  const match = section.match(/https?:\/\/[^\s|]+/i);
  return match ? match[0] : '';
}

function pickIban(section) {
  const labeled = pickLabelValue(section, ['IBAN']);
  if (labeled) return labeled.replace(/\s+/g, '').toUpperCase();
  const match = section.match(/\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/);
  return match ? match[0] : '';
}

function pickSwift(section) {
  const labeled = pickLabelValue(section, ['SWIFT / BIC Code', 'SWIFT', 'BIC Code', 'SWIFT Code']);
  if (labeled) return labeled.replace(/\s+/g, '').toUpperCase();
  const match = section.match(/\b[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?\b/);
  return match ? match[0] : '';
}

function parseShareholderBlocks(section) {
  const shareholders = [];
  const blockPattern =
    /shareholder\s*(\d+)[\s\S]{0,900}?(?=shareholder\s*\d+|bank\s*account|attachments?\s*checklist|declaration|$)/gi;
  let match = blockPattern.exec(section);
  while (match) {
    const block = match[0];
    shareholders.push({
      fullName: pickLabelValue(block, ['Full Name', 'Name']),
      nationality: pickLabelValue(block, ['Nationality']),
      ownershipPercentage: pickLabelValue(block, ['Ownership %', 'Ownership', 'Ownership Percentage']).replace(
        /%/g,
        '',
      ),
      passportNumber: pickLabelValue(block, ['Passport Number', 'Passport No', 'Passport #']),
      passportExpiryDate: pickDate(block, ['Passport Expiry Date', 'Passport Expiry']),
    });
    match = blockPattern.exec(section);
  }

  if (!shareholders.length) {
    for (let index = 1; index <= 4; index += 1) {
      const prefix = new RegExp(`shareholder\\s*${index}`, 'i');
      if (!prefix.test(section)) continue;
      const slice = section.split(prefix)[1]?.slice(0, 500) || '';
      const row = {
        fullName: pickLabelValue(slice, ['Full Name', 'Name']),
        nationality: pickLabelValue(slice, ['Nationality']),
        ownershipPercentage: pickLabelValue(slice, ['Ownership %', 'Ownership']).replace(/%/g, ''),
        passportNumber: pickLabelValue(slice, ['Passport Number', 'Passport No']),
        passportExpiryDate: pickDate(slice, ['Passport Expiry Date', 'Passport Expiry']),
      };
      if (Object.values(row).some(Boolean)) shareholders.push(row);
    }
  }

  return shareholders;
}

function attachmentMarked(section, labelPatterns) {
  for (const pattern of labelPatterns) {
    const lineMatch = section.match(
      new RegExp(`${pattern.source}[^\\n]{0,120}`, 'i'),
    );
    if (!lineMatch) continue;
    const line = lineMatch[0];
    if (/\[(?:x|✓|☑)\]|✓|☑|\byes\b|\battached\b|\benclosed\b|\bprovided\b/i.test(line)) {
      return true;
    }
    const value = pickLabelValue(section, [line.split(':')[0]?.trim() || '']);
    if (/^(yes|true|attached|provided)$/i.test(value)) return true;
  }
  return false;
}

function parseAttachmentsChecklist(section) {
  if (!section.trim()) {
    return {
      shareholderPassportCopy: false,
      generalManagerIdCard: false,
      companyDocument: false,
      bankAccountProof: false,
    };
  }

  return {
    shareholderPassportCopy: attachmentMarked(section, [/shareholder\s*passport/i]),
    generalManagerIdCard: attachmentMarked(section, [
      /general\s*manager\s*id/i,
      /gm\s*id\s*card/i,
    ]),
    companyDocument: attachmentMarked(section, [/company\s*document/i, /trade\s*license/i, /incorporation\s*certificate/i]),
    bankAccountProof: attachmentMarked(section, [/bank\s*account\s*proof/i, /bank\s*letter/i, /voided\s*cheque/i]),
  };
}

function parseInternalUseOnly(section) {
  if (!section.trim()) return null;

  const pickStatus = (labels) => {
    const raw = pickLabelValue(section, labels);
    const normalized = String(raw).trim().toUpperCase();
    if (['YES', 'NO', 'NA'].includes(normalized)) return normalized;
    return '';
  };

  return {
    kycFormFilledCompletelyStatus: pickStatus(['KYC Form filled completely Status', 'KYC Form filled completely']),
    kycFormFilledCompletelyRemarks: pickLabelValue(section, ['KYC Form filled completely Remarks']),
    shareholderPassportAttachedStatus: pickStatus(['Shareholder Passport attached Status']),
    shareholderPassportAttachedRemarks: pickLabelValue(section, ['Shareholder Passport attached Remarks']),
    gmIdCardAttachedStatus: pickStatus(['GM ID Card attached Status']),
    gmIdCardAttachedRemarks: pickLabelValue(section, ['GM ID Card attached Remarks']),
    companyDocumentVerifiedStatus: pickStatus(['Company document verified Status']),
    companyDocumentVerifiedRemarks: pickLabelValue(section, ['Company document verified Remarks']),
    bankAccountProofAttachedStatus: pickStatus(['Bank account proof attached Status']),
    bankAccountProofAttachedRemarks: pickLabelValue(section, ['Bank account proof attached Remarks']),
    kycApprovedBy: pickLabelValue(section, ['KYC Approved By', 'Approved By']),
    approvalDate: pickDate(section, ['Approval Date']),
  };
}

export function emptyParsedKycForm() {
  return {
    clientInformation: {
      companyName: '',
      tradeName: '',
      entityType: '',
      incorporationDate: '',
      countryOfIncorporation: '',
      legalRegistrationNumber: '',
      taxIdVatNumber: '',
      businessAddress: '',
      website: '',
      primaryContactPerson: '',
      contactDesignation: '',
      officialEmail: '',
      phoneNumber: '',
    },
    authorizedSignatory: {
      fullName: '',
      designation: '',
      nationality: '',
      dateOfBirth: '',
      idType: '',
      idNumber: '',
      issueDate: '',
      expiryDate: '',
      email: '',
      phone: '',
    },
    shareholders: [],
    bankAccountDetails: {
      bankName: '',
      accountHolderName: '',
      accountNumber: '',
      iban: '',
      swiftBicCode: '',
      bankAddress: '',
      currency: '',
    },
    attachmentsChecklist: {
      shareholderPassportCopy: false,
      generalManagerIdCard: false,
      companyDocument: false,
      bankAccountProof: false,
    },
    declaration: {
      authorizedSignatoryName: '',
      date: '',
    },
    internalUseOnly: null,
  };
}

/**
 * Parse HRYANTRA KYC form fields from document text (section-scoped regex).
 */
export function parseKycFormFromText(rawText = '') {
  const text = normalizeText(rawText);
  const form = emptyParsedKycForm();

  const clientSection =
    sliceSection(text, /1\.\s*client\s*information/i, /2\.\s*authorized/i) || text;
  const signatorySection =
    sliceSection(text, /2\.\s*authorized[\s\S]*?(?:details|signatory)/i, /3\.\s*shareholder/i) ||
    sliceSection(text, /general\s*manager\s*details/i, /3\.\s*shareholder|shareholder\s*\/\s*beneficial/i);
  const shareholderSection =
    sliceSection(text, /3\.\s*shareholder/i, /4\.\s*bank\s*account/i) || text;
  const bankSection =
    sliceSection(text, /4\.\s*bank\s*account/i, /5\.\s*attachments/i) || text;
  const attachmentsSection =
    sliceSection(text, /5\.\s*attachments/i, /6\.\s*declaration/i) || text;
  const declarationSection =
    sliceSection(text, /6\.\s*declaration/i, /internal\s*use\s*only/i) || text;
  const internalSection = sliceSection(text, /internal\s*use\s*only/i, /$/) || '';

  form.clientInformation = {
    companyName: pickLabelValue(clientSection, ['Company Name']),
    tradeName: pickLabelValue(clientSection, ['Trade Name (if any)', 'Trade Name']),
    entityType: normalizeEntityType(pickLabelValue(clientSection, ['Type of Entity', 'Entity Type'])),
    incorporationDate: pickDate(clientSection, ['Date of Incorporation', 'Incorporation Date']),
    countryOfIncorporation: pickLabelValue(clientSection, ['Country of Incorporation']),
    legalRegistrationNumber: pickLabelValue(clientSection, [
      'Legal Registration Number',
      'Registration Number',
      'CR Number',
      'Company Registration Number',
    ]),
    taxIdVatNumber: pickLabelValue(clientSection, ['Tax ID / VAT Number', 'Tax ID', 'VAT Number', 'TRN']),
    businessAddress: pickLabelValue(clientSection, ['Business Address', 'Registered Address', 'Office Address']),
    website: pickWebsite(clientSection),
    primaryContactPerson: pickLabelValue(clientSection, ['Primary Contact Person', 'Contact Person']),
    contactDesignation: pickLabelValue(clientSection, ['Contact Designation']),
    officialEmail: pickEmailInSection(clientSection, ['Email (Official)', 'Official Email']),
    phoneNumber: pickLabelValue(clientSection, ['Phone Number', 'Contact Phone', 'Telephone', 'Mobile']),
  };

  form.authorizedSignatory = {
    fullName: pickLabelValue(signatorySection, ['Full Name']),
    designation: pickLabelValue(signatorySection, ['Designation']),
    nationality: pickLabelValue(signatorySection, ['Nationality']),
    dateOfBirth: pickDate(signatorySection, ['Date of Birth', 'DOB']),
    idType: normalizeIdType(pickLabelValue(signatorySection, ['ID Type', 'Identity Type'])),
    idNumber: pickLabelValue(signatorySection, ['ID Number', 'Identity Number', 'Emirates ID']),
    issueDate: pickDate(signatorySection, ['Issue Date', 'ID Issue Date']),
    expiryDate: pickDate(signatorySection, ['Expiry Date', 'ID Expiry Date', 'Expiration Date']),
    email: pickEmailInSection(signatorySection, ['Email']),
    phone: pickLabelValue(signatorySection, ['Phone', 'Mobile', 'Contact Number']),
  };

  form.shareholders = parseShareholderBlocks(shareholderSection);

  form.bankAccountDetails = {
    bankName: pickLabelValue(bankSection, ['Bank Name']),
    accountHolderName: pickLabelValue(bankSection, ['Account Holder Name', 'Account Name']),
    accountNumber: pickLabelValue(bankSection, ['Account Number']),
    iban: pickIban(bankSection),
    swiftBicCode: pickSwift(bankSection),
    bankAddress: pickLabelValue(bankSection, ['Bank Address']),
    currency: pickLabelValue(bankSection, ['Currency']),
  };

  form.attachmentsChecklist = parseAttachmentsChecklist(attachmentsSection);

  form.declaration = {
    authorizedSignatoryName: pickLabelValue(declarationSection, [
      'Authorized Signatory Name',
      'Signatory Name',
    ]),
    date: pickDate(declarationSection, ['Declaration Date', 'Date of Declaration', 'Date']),
  };

  const internal = parseInternalUseOnly(internalSection);
  if (internal && Object.values(internal).some((v) => v != null && String(v).trim() !== '')) {
    form.internalUseOnly = internal;
  }

  const coverage = buildKycFieldCoverage(form);

  return {
    form,
    filledCount: coverage.filledCount,
    totalExtractable: coverage.totalExtractable,
    coverage,
    textLength: text.length,
  };
}
