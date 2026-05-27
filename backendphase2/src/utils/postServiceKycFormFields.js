const ENTITY_TYPES = ['LLC', 'Corporation', 'Partnership', 'Sole Proprietorship', 'Other'];
const SIGNATORY_ID_TYPES = ['National ID', 'Passport', 'Driving License'];
const REVIEW_STATUSES = ['YES', 'NO', 'NA'];

function normalizeNullableString(value) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
}

function normalizeEnum(value, allowedValues) {
  const normalized = normalizeNullableString(value);
  if (!normalized) return null;
  return allowedValues.includes(normalized) ? normalized : normalized;
}

function normalizeBoolean(value) {
  if (value === true || value === false) return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === 'yes') return true;
    if (normalized === 'false' || normalized === 'no') return false;
  }
  return false;
}

function hasMeaningfulValue(value) {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.some(hasMeaningfulValue);
  if (typeof value === 'object') return Object.values(value).some(hasMeaningfulValue);
  return true;
}

function normalizeShareholders(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => ({
      fullName: normalizeNullableString(row?.fullName),
      nationality: normalizeNullableString(row?.nationality),
      ownershipPercentage: normalizeNullableString(row?.ownershipPercentage),
      passportNumber: normalizeNullableString(row?.passportNumber),
      passportExpiryDate: normalizeNullableString(row?.passportExpiryDate),
    }))
    .filter((row) => hasMeaningfulValue(row));
}

function normalizeStoredFiles(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => ({
      id: normalizeNullableString(row?.id),
      fileName: normalizeNullableString(row?.fileName),
      fileType: normalizeNullableString(row?.fileType) || 'KYC',
      fileUrl: normalizeNullableString(row?.fileUrl),
      uploadDate: normalizeNullableString(row?.uploadDate),
    }))
    .filter((row) => row.id && row.fileName);
}

export function normalizePostServiceKycForm(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const shareholderPassportCopyFiles = normalizeStoredFiles(raw?.attachmentsChecklist?.shareholderPassportCopyFiles);
  const generalManagerIdCardFiles = normalizeStoredFiles(raw?.attachmentsChecklist?.generalManagerIdCardFiles);
  const companyDocumentFiles = normalizeStoredFiles(raw?.attachmentsChecklist?.companyDocumentFiles);
  const bankAccountProofFiles = normalizeStoredFiles(raw?.attachmentsChecklist?.bankAccountProofFiles);

  const form = {
    clientInformation: {
      companyName: normalizeNullableString(raw?.clientInformation?.companyName),
      tradeName: normalizeNullableString(raw?.clientInformation?.tradeName),
      entityType: normalizeEnum(raw?.clientInformation?.entityType, ENTITY_TYPES),
      incorporationDate: normalizeNullableString(raw?.clientInformation?.incorporationDate),
      countryOfIncorporation: normalizeNullableString(raw?.clientInformation?.countryOfIncorporation),
      legalRegistrationNumber: normalizeNullableString(raw?.clientInformation?.legalRegistrationNumber),
      taxIdVatNumber: normalizeNullableString(raw?.clientInformation?.taxIdVatNumber),
      businessAddress: normalizeNullableString(raw?.clientInformation?.businessAddress),
      website: normalizeNullableString(raw?.clientInformation?.website),
      primaryContactPerson: normalizeNullableString(raw?.clientInformation?.primaryContactPerson),
      contactDesignation: normalizeNullableString(raw?.clientInformation?.contactDesignation),
      officialEmail: normalizeNullableString(raw?.clientInformation?.officialEmail),
      phoneNumber: normalizeNullableString(raw?.clientInformation?.phoneNumber),
    },
    authorizedSignatory: {
      fullName: normalizeNullableString(raw?.authorizedSignatory?.fullName),
      designation: normalizeNullableString(raw?.authorizedSignatory?.designation),
      nationality: normalizeNullableString(raw?.authorizedSignatory?.nationality),
      dateOfBirth: normalizeNullableString(raw?.authorizedSignatory?.dateOfBirth),
      idType: normalizeEnum(raw?.authorizedSignatory?.idType, SIGNATORY_ID_TYPES),
      idNumber: normalizeNullableString(raw?.authorizedSignatory?.idNumber),
      issueDate: normalizeNullableString(raw?.authorizedSignatory?.issueDate),
      expiryDate: normalizeNullableString(raw?.authorizedSignatory?.expiryDate),
      email: normalizeNullableString(raw?.authorizedSignatory?.email),
      phone: normalizeNullableString(raw?.authorizedSignatory?.phone),
    },
    shareholders: normalizeShareholders(raw?.shareholders),
    bankAccountDetails: {
      bankName: normalizeNullableString(raw?.bankAccountDetails?.bankName),
      accountHolderName: normalizeNullableString(raw?.bankAccountDetails?.accountHolderName),
      accountNumber: normalizeNullableString(raw?.bankAccountDetails?.accountNumber),
      iban: normalizeNullableString(raw?.bankAccountDetails?.iban),
      swiftBicCode: normalizeNullableString(raw?.bankAccountDetails?.swiftBicCode),
      bankAddress: normalizeNullableString(raw?.bankAccountDetails?.bankAddress),
      currency: normalizeNullableString(raw?.bankAccountDetails?.currency),
    },
    attachmentsChecklist: {
      shareholderPassportCopy:
        normalizeBoolean(raw?.attachmentsChecklist?.shareholderPassportCopy) ||
        shareholderPassportCopyFiles.length > 0,
      shareholderPassportCopyFiles,
      generalManagerIdCard:
        normalizeBoolean(raw?.attachmentsChecklist?.generalManagerIdCard) ||
        generalManagerIdCardFiles.length > 0,
      generalManagerIdCardFiles,
      companyDocument:
        normalizeBoolean(raw?.attachmentsChecklist?.companyDocument) ||
        companyDocumentFiles.length > 0,
      companyDocumentFiles,
      bankAccountProof:
        normalizeBoolean(raw?.attachmentsChecklist?.bankAccountProof) ||
        bankAccountProofFiles.length > 0,
      bankAccountProofFiles,
    },
    declaration: {
      authorizedSignatoryName: normalizeNullableString(raw?.declaration?.authorizedSignatoryName),
      signatureFiles: normalizeStoredFiles(raw?.declaration?.signatureFiles),
      date: normalizeNullableString(raw?.declaration?.date),
      companyStampFiles: normalizeStoredFiles(raw?.declaration?.companyStampFiles),
    },
    internalUseOnly: {
      kycFormFilledCompletelyStatus: normalizeEnum(
        raw?.internalUseOnly?.kycFormFilledCompletelyStatus,
        REVIEW_STATUSES,
      ),
      kycFormFilledCompletelyRemarks: normalizeNullableString(
        raw?.internalUseOnly?.kycFormFilledCompletelyRemarks,
      ),
      shareholderPassportAttachedStatus: normalizeEnum(
        raw?.internalUseOnly?.shareholderPassportAttachedStatus,
        REVIEW_STATUSES,
      ),
      shareholderPassportAttachedRemarks: normalizeNullableString(
        raw?.internalUseOnly?.shareholderPassportAttachedRemarks,
      ),
      gmIdCardAttachedStatus: normalizeEnum(
        raw?.internalUseOnly?.gmIdCardAttachedStatus,
        REVIEW_STATUSES,
      ),
      gmIdCardAttachedRemarks: normalizeNullableString(raw?.internalUseOnly?.gmIdCardAttachedRemarks),
      companyDocumentVerifiedStatus: normalizeEnum(
        raw?.internalUseOnly?.companyDocumentVerifiedStatus,
        REVIEW_STATUSES,
      ),
      companyDocumentVerifiedRemarks: normalizeNullableString(
        raw?.internalUseOnly?.companyDocumentVerifiedRemarks,
      ),
      bankAccountProofAttachedStatus: normalizeEnum(
        raw?.internalUseOnly?.bankAccountProofAttachedStatus,
        REVIEW_STATUSES,
      ),
      bankAccountProofAttachedRemarks: normalizeNullableString(
        raw?.internalUseOnly?.bankAccountProofAttachedRemarks,
      ),
      kycApprovedBy: normalizeNullableString(raw?.internalUseOnly?.kycApprovedBy),
      approvalDate: normalizeNullableString(raw?.internalUseOnly?.approvalDate),
    },
  };

  return hasMeaningfulValue(form) ? form : null;
}

export function buildPostServiceKycFormCreateFields(data) {
  return {
    ...(data.postServiceKycForm !== undefined
      ? { postServiceKycForm: normalizePostServiceKycForm(data.postServiceKycForm) }
      : {}),
  };
}

export function applyPostServiceKycFormUpdateFields(data, updateData) {
  if (data.postServiceKycForm !== undefined) {
    updateData.postServiceKycForm = normalizePostServiceKycForm(data.postServiceKycForm);
  }
}
