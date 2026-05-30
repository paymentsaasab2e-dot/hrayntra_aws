/** All KYC form fields mapped to UI sections (for coverage reporting). */

export const KYC_EXTRACTABLE_FIELDS = [
  { path: 'clientInformation.companyName', label: 'Company Name', section: '1. Client Information' },
  { path: 'clientInformation.tradeName', label: 'Trade Name', section: '1. Client Information' },
  { path: 'clientInformation.entityType', label: 'Type of Entity', section: '1. Client Information' },
  { path: 'clientInformation.incorporationDate', label: 'Date of Incorporation', section: '1. Client Information' },
  { path: 'clientInformation.countryOfIncorporation', label: 'Country of Incorporation', section: '1. Client Information' },
  { path: 'clientInformation.legalRegistrationNumber', label: 'Legal Registration Number', section: '1. Client Information' },
  { path: 'clientInformation.taxIdVatNumber', label: 'Tax ID / VAT Number', section: '1. Client Information' },
  { path: 'clientInformation.website', label: 'Website', section: '1. Client Information' },
  { path: 'clientInformation.businessAddress', label: 'Business Address', section: '1. Client Information' },
  { path: 'clientInformation.primaryContactPerson', label: 'Primary Contact Person', section: '1. Client Information' },
  { path: 'clientInformation.contactDesignation', label: 'Contact Designation', section: '1. Client Information' },
  { path: 'clientInformation.officialEmail', label: 'Email (Official)', section: '1. Client Information' },
  { path: 'clientInformation.phoneNumber', label: 'Phone Number', section: '1. Client Information' },
  { path: 'authorizedSignatory.fullName', label: 'Full Name', section: '2. Authorized Signatory' },
  { path: 'authorizedSignatory.designation', label: 'Designation', section: '2. Authorized Signatory' },
  { path: 'authorizedSignatory.nationality', label: 'Nationality', section: '2. Authorized Signatory' },
  { path: 'authorizedSignatory.dateOfBirth', label: 'Date of Birth', section: '2. Authorized Signatory' },
  { path: 'authorizedSignatory.idType', label: 'ID Type', section: '2. Authorized Signatory' },
  { path: 'authorizedSignatory.idNumber', label: 'ID Number', section: '2. Authorized Signatory' },
  { path: 'authorizedSignatory.issueDate', label: 'Issue Date', section: '2. Authorized Signatory' },
  { path: 'authorizedSignatory.expiryDate', label: 'Expiry Date', section: '2. Authorized Signatory' },
  { path: 'authorizedSignatory.email', label: 'Email', section: '2. Authorized Signatory' },
  { path: 'authorizedSignatory.phone', label: 'Phone', section: '2. Authorized Signatory' },
  { path: 'shareholders[0].fullName', label: 'Shareholder 1 — Full Name', section: '3. Shareholders' },
  { path: 'shareholders[0].nationality', label: 'Shareholder 1 — Nationality', section: '3. Shareholders' },
  { path: 'shareholders[0].ownershipPercentage', label: 'Shareholder 1 — Ownership %', section: '3. Shareholders' },
  { path: 'shareholders[0].passportNumber', label: 'Shareholder 1 — Passport Number', section: '3. Shareholders' },
  { path: 'shareholders[0].passportExpiryDate', label: 'Shareholder 1 — Passport Expiry', section: '3. Shareholders' },
  { path: 'shareholders[1].fullName', label: 'Shareholder 2 — Full Name', section: '3. Shareholders' },
  { path: 'shareholders[1].nationality', label: 'Shareholder 2 — Nationality', section: '3. Shareholders' },
  { path: 'shareholders[1].ownershipPercentage', label: 'Shareholder 2 — Ownership %', section: '3. Shareholders' },
  { path: 'shareholders[1].passportNumber', label: 'Shareholder 2 — Passport Number', section: '3. Shareholders' },
  { path: 'shareholders[1].passportExpiryDate', label: 'Shareholder 2 — Passport Expiry', section: '3. Shareholders' },
  { path: 'bankAccountDetails.bankName', label: 'Bank Name', section: '4. Bank Account' },
  { path: 'bankAccountDetails.accountHolderName', label: 'Account Holder Name', section: '4. Bank Account' },
  { path: 'bankAccountDetails.accountNumber', label: 'Account Number', section: '4. Bank Account' },
  { path: 'bankAccountDetails.iban', label: 'IBAN', section: '4. Bank Account' },
  { path: 'bankAccountDetails.swiftBicCode', label: 'SWIFT / BIC Code', section: '4. Bank Account' },
  { path: 'bankAccountDetails.currency', label: 'Currency', section: '4. Bank Account' },
  { path: 'bankAccountDetails.bankAddress', label: 'Bank Address', section: '4. Bank Account' },
  { path: 'attachmentsChecklist.shareholderPassportCopy', label: 'Shareholder Passport Copy', section: '5. Attachments', type: 'boolean' },
  { path: 'attachmentsChecklist.generalManagerIdCard', label: 'GM ID Card / Passport', section: '5. Attachments', type: 'boolean' },
  { path: 'attachmentsChecklist.companyDocument', label: 'Company Document', section: '5. Attachments', type: 'boolean' },
  { path: 'attachmentsChecklist.bankAccountProof', label: 'Bank Account Proof', section: '5. Attachments', type: 'boolean' },
  { path: 'declaration.authorizedSignatoryName', label: 'Authorized Signatory Name', section: '6. Declaration' },
  { path: 'declaration.date', label: 'Declaration Date', section: '6. Declaration' },
];

/** Fields that require separate file uploads — not read from KYC form text. */
export const KYC_UPLOAD_ONLY_FIELDS = [
  'Signature file upload',
  'Company stamp file upload',
  'Shareholder passport copy files',
  'GM ID card files',
  'Company document files',
  'Bank account proof files',
];

/** Internal SAASA review fields — not filled from client KYC documents. */
export const KYC_INTERNAL_ONLY_FIELDS = [
  'KYC Form filled completely (status/remarks)',
  'Shareholder Passport attached (status/remarks)',
  'GM ID Card attached (status/remarks)',
  'Company document verified (status/remarks)',
  'Bank account proof attached (status/remarks)',
  'KYC Approved By',
  'Approval Date',
];

function getByPath(obj, path) {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let cur = obj;
  for (const part of parts) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

function isFilled(value, type) {
  if (type === 'boolean') return value === true;
  if (value == null) return false;
  return String(value).trim() !== '';
}

export function buildKycFieldCoverage(form) {
  const fields = KYC_EXTRACTABLE_FIELDS.map((field) => {
    const value = getByPath(form, field.path);
    const filled = isFilled(value, field.type);
    return { ...field, filled, value: field.type === 'boolean' ? Boolean(value) : value ?? '' };
  });

  const filledCount = fields.filter((f) => f.filled).length;
  const bySection = {};
  for (const field of fields) {
    if (!bySection[field.section]) {
      bySection[field.section] = { filled: 0, total: 0, missing: [] };
    }
    bySection[field.section].total += 1;
    if (field.filled) {
      bySection[field.section].filled += 1;
    } else {
      bySection[field.section].missing.push(field.label);
    }
  }

  return {
    fields,
    filledCount,
    totalExtractable: fields.length,
    bySection,
    uploadOnly: KYC_UPLOAD_ONLY_FIELDS,
    internalOnly: KYC_INTERNAL_ONLY_FIELDS,
  };
}

export function logKycCoverage(coverage) {
  console.log(`Extractable fields: ${coverage.filledCount} / ${coverage.totalExtractable}`);
  for (const [section, stats] of Object.entries(coverage.bySection)) {
    console.log(`  ${section}: ${stats.filled}/${stats.total}`);
    if (stats.missing.length) {
      console.log(`    Missing: ${stats.missing.join(', ')}`);
    }
  }
  console.log(`Upload-only (not from text): ${coverage.uploadOnly.join('; ')}`);
  console.log(`Internal only (SAASA staff): ${coverage.internalOnly.join('; ')}`);
}
