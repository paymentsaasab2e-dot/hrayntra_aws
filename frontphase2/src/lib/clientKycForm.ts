export type PostServiceKycEntityType =
  | 'LLC'
  | 'Corporation'
  | 'Partnership'
  | 'Sole Proprietorship'
  | 'Other'
  | '';

export type PostServiceKycIdType =
  | 'National ID'
  | 'Passport'
  | 'Driving License'
  | '';

export type PostServiceKycReviewStatus = 'YES' | 'NO' | 'NA' | '';

export type PostServiceKycFileRef = {
  id: string;
  fileName: string;
  fileType: string;
  fileUrl: string | null;
  uploadDate: string;
};

export type PostServiceKycAttachmentFieldKey =
  | 'shareholderPassportCopyFiles'
  | 'generalManagerIdCardFiles'
  | 'companyDocumentFiles'
  | 'bankAccountProofFiles'
  | 'signatureFiles'
  | 'companyStampFiles';

export type PostServiceKycShareholder = {
  id: string;
  fullName: string;
  nationality: string;
  ownershipPercentage: string;
  passportNumber: string;
  passportExpiryDate: string;
};

export type PostServiceKycFormValues = {
  clientInformation: {
    companyName: string;
    tradeName: string;
    entityType: PostServiceKycEntityType;
    incorporationDate: string;
    countryOfIncorporation: string;
    legalRegistrationNumber: string;
    taxIdVatNumber: string;
    businessAddress: string;
    website: string;
    primaryContactPerson: string;
    contactDesignation: string;
    officialEmail: string;
    phoneNumber: string;
  };
  authorizedSignatory: {
    fullName: string;
    designation: string;
    nationality: string;
    dateOfBirth: string;
    idType: PostServiceKycIdType;
    idNumber: string;
    issueDate: string;
    expiryDate: string;
    email: string;
    phone: string;
  };
  shareholders: PostServiceKycShareholder[];
  bankAccountDetails: {
    bankName: string;
    accountHolderName: string;
    accountNumber: string;
    iban: string;
    swiftBicCode: string;
    bankAddress: string;
    currency: string;
  };
  attachmentsChecklist: {
    shareholderPassportCopy: boolean;
    shareholderPassportCopyFiles: PostServiceKycFileRef[];
    generalManagerIdCard: boolean;
    generalManagerIdCardFiles: PostServiceKycFileRef[];
    companyDocument: boolean;
    companyDocumentFiles: PostServiceKycFileRef[];
    bankAccountProof: boolean;
    bankAccountProofFiles: PostServiceKycFileRef[];
  };
  declaration: {
    authorizedSignatoryName: string;
    signatureFiles: PostServiceKycFileRef[];
    date: string;
    companyStampFiles: PostServiceKycFileRef[];
  };
  internalUseOnly: {
    kycFormFilledCompletelyStatus: PostServiceKycReviewStatus;
    kycFormFilledCompletelyRemarks: string;
    shareholderPassportAttachedStatus: PostServiceKycReviewStatus;
    shareholderPassportAttachedRemarks: string;
    gmIdCardAttachedStatus: PostServiceKycReviewStatus;
    gmIdCardAttachedRemarks: string;
    companyDocumentVerifiedStatus: PostServiceKycReviewStatus;
    companyDocumentVerifiedRemarks: string;
    bankAccountProofAttachedStatus: PostServiceKycReviewStatus;
    bankAccountProofAttachedRemarks: string;
    kycApprovedBy: string;
    approvalDate: string;
  };
};

const ENTITY_TYPES = ['LLC', 'Corporation', 'Partnership', 'Sole Proprietorship', 'Other'] as const;
const ID_TYPES = ['National ID', 'Passport', 'Driving License'] as const;
const REVIEW_STATUSES = ['YES', 'NO', 'NA'] as const;

function createId() {
  return `kyc-shareholder-${Math.random().toString(36).slice(2, 10)}`;
}

function stringValue(value: unknown) {
  return value == null ? '' : String(value);
}

function normalizeEntityType(value: unknown): PostServiceKycEntityType {
  const normalized = stringValue(value).trim();
  return (ENTITY_TYPES.includes(normalized as (typeof ENTITY_TYPES)[number]) ? normalized : '') as PostServiceKycEntityType;
}

function normalizeIdType(value: unknown): PostServiceKycIdType {
  const normalized = stringValue(value).trim();
  return (ID_TYPES.includes(normalized as (typeof ID_TYPES)[number]) ? normalized : '') as PostServiceKycIdType;
}

function normalizeReviewStatus(value: unknown): PostServiceKycReviewStatus {
  const normalized = stringValue(value).trim().toUpperCase();
  return (REVIEW_STATUSES.includes(normalized as (typeof REVIEW_STATUSES)[number]) ? normalized : '') as PostServiceKycReviewStatus;
}

function normalizeBoolean(value: unknown) {
  if (value === true || value === false) return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === 'yes') return true;
    if (normalized === 'false' || normalized === 'no') return false;
  }
  return false;
}

function normalizeStoredFiles(value: unknown): PostServiceKycFileRef[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => ({
      id: stringValue((row as { id?: unknown })?.id).trim(),
      fileName: stringValue((row as { fileName?: unknown })?.fileName).trim(),
      fileType: stringValue((row as { fileType?: unknown })?.fileType).trim() || 'KYC',
      fileUrl:
        stringValue((row as { fileUrl?: unknown })?.fileUrl).trim() || null,
      uploadDate: stringValue((row as { uploadDate?: unknown })?.uploadDate).trim(),
    }))
    .filter((row) => row.id && row.fileName);
}

export function createEmptyPostServiceKycShareholder(): PostServiceKycShareholder {
  return {
    id: createId(),
    fullName: '',
    nationality: '',
    ownershipPercentage: '',
    passportNumber: '',
    passportExpiryDate: '',
  };
}

export function normalizePostServiceKycShareholders(value: unknown): PostServiceKycShareholder[] {
  const list = Array.isArray(value) ? value : [];
  const normalized = list.map((row) => ({
    id: stringValue((row as { id?: unknown })?.id).trim() || createId(),
    fullName: stringValue((row as { fullName?: unknown })?.fullName),
    nationality: stringValue((row as { nationality?: unknown })?.nationality),
    ownershipPercentage: stringValue((row as { ownershipPercentage?: unknown })?.ownershipPercentage),
    passportNumber: stringValue((row as { passportNumber?: unknown })?.passportNumber),
    passportExpiryDate: stringValue((row as { passportExpiryDate?: unknown })?.passportExpiryDate),
  }));

  if (normalized.length >= 2) return normalized;
  return [...normalized, ...Array.from({ length: 2 - normalized.length }, () => createEmptyPostServiceKycShareholder())];
}

export function emptyPostServiceKycForm(): PostServiceKycFormValues {
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
    shareholders: normalizePostServiceKycShareholders([]),
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
      shareholderPassportCopyFiles: [],
      generalManagerIdCard: false,
      generalManagerIdCardFiles: [],
      companyDocument: false,
      companyDocumentFiles: [],
      bankAccountProof: false,
      bankAccountProofFiles: [],
    },
    declaration: {
      authorizedSignatoryName: '',
      signatureFiles: [],
      date: '',
      companyStampFiles: [],
    },
    internalUseOnly: {
      kycFormFilledCompletelyStatus: '',
      kycFormFilledCompletelyRemarks: '',
      shareholderPassportAttachedStatus: '',
      shareholderPassportAttachedRemarks: '',
      gmIdCardAttachedStatus: '',
      gmIdCardAttachedRemarks: '',
      companyDocumentVerifiedStatus: '',
      companyDocumentVerifiedRemarks: '',
      bankAccountProofAttachedStatus: '',
      bankAccountProofAttachedRemarks: '',
      kycApprovedBy: '',
      approvalDate: '',
    },
  };
}

export function postServiceKycFormFromRecord(
  record: { postServiceKycForm?: unknown } | null | undefined,
): PostServiceKycFormValues {
  const saved =
    record && typeof record === 'object' && 'postServiceKycForm' in record
      ? (record as { postServiceKycForm?: unknown }).postServiceKycForm
      : null;
  const empty = emptyPostServiceKycForm();
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return empty;

  const value = saved as Record<string, unknown>;
  const shareholderPassportCopyFiles = normalizeStoredFiles((value.attachmentsChecklist as { shareholderPassportCopyFiles?: unknown })?.shareholderPassportCopyFiles);
  const generalManagerIdCardFiles = normalizeStoredFiles((value.attachmentsChecklist as { generalManagerIdCardFiles?: unknown })?.generalManagerIdCardFiles);
  const companyDocumentFiles = normalizeStoredFiles((value.attachmentsChecklist as { companyDocumentFiles?: unknown })?.companyDocumentFiles);
  const bankAccountProofFiles = normalizeStoredFiles((value.attachmentsChecklist as { bankAccountProofFiles?: unknown })?.bankAccountProofFiles);

  return {
    clientInformation: {
      companyName: stringValue((value.clientInformation as { companyName?: unknown })?.companyName),
      tradeName: stringValue((value.clientInformation as { tradeName?: unknown })?.tradeName),
      entityType: normalizeEntityType((value.clientInformation as { entityType?: unknown })?.entityType),
      incorporationDate: stringValue((value.clientInformation as { incorporationDate?: unknown })?.incorporationDate),
      countryOfIncorporation: stringValue((value.clientInformation as { countryOfIncorporation?: unknown })?.countryOfIncorporation),
      legalRegistrationNumber: stringValue((value.clientInformation as { legalRegistrationNumber?: unknown })?.legalRegistrationNumber),
      taxIdVatNumber: stringValue((value.clientInformation as { taxIdVatNumber?: unknown })?.taxIdVatNumber),
      businessAddress: stringValue((value.clientInformation as { businessAddress?: unknown })?.businessAddress),
      website: stringValue((value.clientInformation as { website?: unknown })?.website),
      primaryContactPerson: stringValue((value.clientInformation as { primaryContactPerson?: unknown })?.primaryContactPerson),
      contactDesignation: stringValue((value.clientInformation as { contactDesignation?: unknown })?.contactDesignation),
      officialEmail: stringValue((value.clientInformation as { officialEmail?: unknown })?.officialEmail),
      phoneNumber: stringValue((value.clientInformation as { phoneNumber?: unknown })?.phoneNumber),
    },
    authorizedSignatory: {
      fullName: stringValue((value.authorizedSignatory as { fullName?: unknown })?.fullName),
      designation: stringValue((value.authorizedSignatory as { designation?: unknown })?.designation),
      nationality: stringValue((value.authorizedSignatory as { nationality?: unknown })?.nationality),
      dateOfBirth: stringValue((value.authorizedSignatory as { dateOfBirth?: unknown })?.dateOfBirth),
      idType: normalizeIdType((value.authorizedSignatory as { idType?: unknown })?.idType),
      idNumber: stringValue((value.authorizedSignatory as { idNumber?: unknown })?.idNumber),
      issueDate: stringValue((value.authorizedSignatory as { issueDate?: unknown })?.issueDate),
      expiryDate: stringValue((value.authorizedSignatory as { expiryDate?: unknown })?.expiryDate),
      email: stringValue((value.authorizedSignatory as { email?: unknown })?.email),
      phone: stringValue((value.authorizedSignatory as { phone?: unknown })?.phone),
    },
    shareholders: normalizePostServiceKycShareholders(value.shareholders),
    bankAccountDetails: {
      bankName: stringValue((value.bankAccountDetails as { bankName?: unknown })?.bankName),
      accountHolderName: stringValue((value.bankAccountDetails as { accountHolderName?: unknown })?.accountHolderName),
      accountNumber: stringValue((value.bankAccountDetails as { accountNumber?: unknown })?.accountNumber),
      iban: stringValue((value.bankAccountDetails as { iban?: unknown })?.iban),
      swiftBicCode: stringValue((value.bankAccountDetails as { swiftBicCode?: unknown })?.swiftBicCode),
      bankAddress: stringValue((value.bankAccountDetails as { bankAddress?: unknown })?.bankAddress),
      currency: stringValue((value.bankAccountDetails as { currency?: unknown })?.currency),
    },
    attachmentsChecklist: {
      shareholderPassportCopy:
        normalizeBoolean((value.attachmentsChecklist as { shareholderPassportCopy?: unknown })?.shareholderPassportCopy) ||
        shareholderPassportCopyFiles.length > 0,
      shareholderPassportCopyFiles,
      generalManagerIdCard:
        normalizeBoolean((value.attachmentsChecklist as { generalManagerIdCard?: unknown })?.generalManagerIdCard) ||
        generalManagerIdCardFiles.length > 0,
      generalManagerIdCardFiles,
      companyDocument:
        normalizeBoolean((value.attachmentsChecklist as { companyDocument?: unknown })?.companyDocument) ||
        companyDocumentFiles.length > 0,
      companyDocumentFiles,
      bankAccountProof:
        normalizeBoolean((value.attachmentsChecklist as { bankAccountProof?: unknown })?.bankAccountProof) ||
        bankAccountProofFiles.length > 0,
      bankAccountProofFiles,
    },
    declaration: {
      authorizedSignatoryName: stringValue((value.declaration as { authorizedSignatoryName?: unknown })?.authorizedSignatoryName),
      signatureFiles: normalizeStoredFiles((value.declaration as { signatureFiles?: unknown })?.signatureFiles),
      date: stringValue((value.declaration as { date?: unknown })?.date),
      companyStampFiles: normalizeStoredFiles((value.declaration as { companyStampFiles?: unknown })?.companyStampFiles),
    },
    internalUseOnly: {
      kycFormFilledCompletelyStatus: normalizeReviewStatus((value.internalUseOnly as { kycFormFilledCompletelyStatus?: unknown })?.kycFormFilledCompletelyStatus),
      kycFormFilledCompletelyRemarks: stringValue((value.internalUseOnly as { kycFormFilledCompletelyRemarks?: unknown })?.kycFormFilledCompletelyRemarks),
      shareholderPassportAttachedStatus: normalizeReviewStatus((value.internalUseOnly as { shareholderPassportAttachedStatus?: unknown })?.shareholderPassportAttachedStatus),
      shareholderPassportAttachedRemarks: stringValue((value.internalUseOnly as { shareholderPassportAttachedRemarks?: unknown })?.shareholderPassportAttachedRemarks),
      gmIdCardAttachedStatus: normalizeReviewStatus((value.internalUseOnly as { gmIdCardAttachedStatus?: unknown })?.gmIdCardAttachedStatus),
      gmIdCardAttachedRemarks: stringValue((value.internalUseOnly as { gmIdCardAttachedRemarks?: unknown })?.gmIdCardAttachedRemarks),
      companyDocumentVerifiedStatus: normalizeReviewStatus((value.internalUseOnly as { companyDocumentVerifiedStatus?: unknown })?.companyDocumentVerifiedStatus),
      companyDocumentVerifiedRemarks: stringValue((value.internalUseOnly as { companyDocumentVerifiedRemarks?: unknown })?.companyDocumentVerifiedRemarks),
      bankAccountProofAttachedStatus: normalizeReviewStatus((value.internalUseOnly as { bankAccountProofAttachedStatus?: unknown })?.bankAccountProofAttachedStatus),
      bankAccountProofAttachedRemarks: stringValue((value.internalUseOnly as { bankAccountProofAttachedRemarks?: unknown })?.bankAccountProofAttachedRemarks),
      kycApprovedBy: stringValue((value.internalUseOnly as { kycApprovedBy?: unknown })?.kycApprovedBy),
      approvalDate: stringValue((value.internalUseOnly as { approvalDate?: unknown })?.approvalDate),
    },
  };
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.some((entry) => {
      if (entry && typeof entry === 'object' && 'id' in entry) {
        const { id: _id, ...rest } = entry as PostServiceKycShareholder;
        return hasMeaningfulValue(rest);
      }
      return hasMeaningfulValue(entry);
    });
  }
  if (typeof value === 'object') return Object.values(value).some(hasMeaningfulValue);
  return true;
}

export function postServiceKycFormHasAnyValue(values: PostServiceKycFormValues): boolean {
  return hasMeaningfulValue(values);
}

export function postServiceKycFormApiPayload(values: PostServiceKycFormValues) {
  const normalized = {
    clientInformation: { ...values.clientInformation },
    authorizedSignatory: { ...values.authorizedSignatory },
    shareholders: values.shareholders
      .map(({ id: _id, ...rest }) => ({ ...rest }))
      .filter((row) => hasMeaningfulValue(row)),
    bankAccountDetails: { ...values.bankAccountDetails },
    attachmentsChecklist: {
      ...values.attachmentsChecklist,
      shareholderPassportCopyFiles: values.attachmentsChecklist.shareholderPassportCopyFiles.map((file) => ({ ...file })),
      generalManagerIdCardFiles: values.attachmentsChecklist.generalManagerIdCardFiles.map((file) => ({ ...file })),
      companyDocumentFiles: values.attachmentsChecklist.companyDocumentFiles.map((file) => ({ ...file })),
      bankAccountProofFiles: values.attachmentsChecklist.bankAccountProofFiles.map((file) => ({ ...file })),
    },
    declaration: {
      ...values.declaration,
      signatureFiles: values.declaration.signatureFiles.map((file) => ({ ...file })),
      companyStampFiles: values.declaration.companyStampFiles.map((file) => ({ ...file })),
    },
    internalUseOnly: { ...values.internalUseOnly },
  };

  return {
    postServiceKycForm: (postServiceKycFormHasAnyValue(values) ? normalized : null) as
      | PostServiceKycFormValues
      | null,
  };
}

export function formatPostServiceKycBoolean(value: boolean) {
  return value ? 'Yes' : 'No';
}

export function formatPostServiceKycReviewStatus(value: PostServiceKycReviewStatus) {
  if (value === 'YES') return 'Yes';
  if (value === 'NO') return 'No';
  if (value === 'NA') return 'N/A';
  return '';
}

function mergeStringField(current: string, extracted: string | undefined) {
  const next = extracted != null ? String(extracted).trim() : '';
  return current.trim() ? current : next;
}

function mergeShareholders(
  current: PostServiceKycShareholder[],
  extracted: Partial<PostServiceKycShareholder>[] | undefined,
): PostServiceKycShareholder[] {
  if (!extracted?.length) return current;
  const max = Math.max(current.length, extracted.length, 2);
  const rows: PostServiceKycShareholder[] = [];

  for (let index = 0; index < max; index += 1) {
    const base = current[index] || createEmptyPostServiceKycShareholder();
    const patch = extracted[index];
    if (!patch) {
      rows.push(base);
      continue;
    }
    rows.push({
      id: base.id,
      fullName: mergeStringField(base.fullName, patch.fullName),
      nationality: mergeStringField(base.nationality, patch.nationality),
      ownershipPercentage: mergeStringField(base.ownershipPercentage, patch.ownershipPercentage),
      passportNumber: mergeStringField(base.passportNumber, patch.passportNumber),
      passportExpiryDate: mergeStringField(base.passportExpiryDate, patch.passportExpiryDate),
    });
  }

  return rows.length >= 2 ? rows : normalizePostServiceKycShareholders(rows);
}

/** Apply non-empty values parsed from an uploaded KYC document into the form. */
export function mergeExtractedPostServiceKycForm(
  current: PostServiceKycFormValues,
  extracted: Partial<PostServiceKycFormValues>,
): PostServiceKycFormValues {
  const client = extracted.clientInformation;
  const signatory = extracted.authorizedSignatory;
  const bank = extracted.bankAccountDetails;
  const declaration = extracted.declaration;

  return {
    ...current,
    clientInformation: {
      companyName: mergeStringField(current.clientInformation.companyName, client?.companyName),
      tradeName: mergeStringField(current.clientInformation.tradeName, client?.tradeName),
      entityType: current.clientInformation.entityType || client?.entityType || '',
      incorporationDate: mergeStringField(
        current.clientInformation.incorporationDate,
        client?.incorporationDate,
      ),
      countryOfIncorporation: mergeStringField(
        current.clientInformation.countryOfIncorporation,
        client?.countryOfIncorporation,
      ),
      legalRegistrationNumber: mergeStringField(
        current.clientInformation.legalRegistrationNumber,
        client?.legalRegistrationNumber,
      ),
      taxIdVatNumber: mergeStringField(current.clientInformation.taxIdVatNumber, client?.taxIdVatNumber),
      businessAddress: mergeStringField(current.clientInformation.businessAddress, client?.businessAddress),
      website: mergeStringField(current.clientInformation.website, client?.website),
      primaryContactPerson: mergeStringField(
        current.clientInformation.primaryContactPerson,
        client?.primaryContactPerson,
      ),
      contactDesignation: mergeStringField(
        current.clientInformation.contactDesignation,
        client?.contactDesignation,
      ),
      officialEmail: mergeStringField(current.clientInformation.officialEmail, client?.officialEmail),
      phoneNumber: mergeStringField(current.clientInformation.phoneNumber, client?.phoneNumber),
    },
    authorizedSignatory: {
      fullName: mergeStringField(current.authorizedSignatory.fullName, signatory?.fullName),
      designation: mergeStringField(current.authorizedSignatory.designation, signatory?.designation),
      nationality: mergeStringField(current.authorizedSignatory.nationality, signatory?.nationality),
      dateOfBirth: mergeStringField(current.authorizedSignatory.dateOfBirth, signatory?.dateOfBirth),
      idType: current.authorizedSignatory.idType || signatory?.idType || '',
      idNumber: mergeStringField(current.authorizedSignatory.idNumber, signatory?.idNumber),
      issueDate: mergeStringField(current.authorizedSignatory.issueDate, signatory?.issueDate),
      expiryDate: mergeStringField(current.authorizedSignatory.expiryDate, signatory?.expiryDate),
      email: mergeStringField(current.authorizedSignatory.email, signatory?.email),
      phone: mergeStringField(current.authorizedSignatory.phone, signatory?.phone),
    },
    shareholders: mergeShareholders(current.shareholders, extracted.shareholders),
    bankAccountDetails: {
      bankName: mergeStringField(current.bankAccountDetails.bankName, bank?.bankName),
      accountHolderName: mergeStringField(
        current.bankAccountDetails.accountHolderName,
        bank?.accountHolderName,
      ),
      accountNumber: mergeStringField(current.bankAccountDetails.accountNumber, bank?.accountNumber),
      iban: mergeStringField(current.bankAccountDetails.iban, bank?.iban),
      swiftBicCode: mergeStringField(current.bankAccountDetails.swiftBicCode, bank?.swiftBicCode),
      bankAddress: mergeStringField(current.bankAccountDetails.bankAddress, bank?.bankAddress),
      currency: mergeStringField(current.bankAccountDetails.currency, bank?.currency),
    },
    attachmentsChecklist: {
      ...current.attachmentsChecklist,
      shareholderPassportCopy:
        current.attachmentsChecklist.shareholderPassportCopy ||
        extracted.attachmentsChecklist?.shareholderPassportCopy ||
        false,
      generalManagerIdCard:
        current.attachmentsChecklist.generalManagerIdCard ||
        extracted.attachmentsChecklist?.generalManagerIdCard ||
        false,
      companyDocument:
        current.attachmentsChecklist.companyDocument ||
        extracted.attachmentsChecklist?.companyDocument ||
        false,
      bankAccountProof:
        current.attachmentsChecklist.bankAccountProof ||
        extracted.attachmentsChecklist?.bankAccountProof ||
        false,
    },
    declaration: {
      ...current.declaration,
      authorizedSignatoryName: mergeStringField(
        current.declaration.authorizedSignatoryName,
        declaration?.authorizedSignatoryName,
      ),
      date: mergeStringField(current.declaration.date, declaration?.date),
    },
    internalUseOnly: extracted.internalUseOnly
      ? {
          kycFormFilledCompletelyStatus:
            current.internalUseOnly.kycFormFilledCompletelyStatus ||
            extracted.internalUseOnly.kycFormFilledCompletelyStatus ||
            '',
          kycFormFilledCompletelyRemarks: mergeStringField(
            current.internalUseOnly.kycFormFilledCompletelyRemarks,
            extracted.internalUseOnly.kycFormFilledCompletelyRemarks,
          ),
          shareholderPassportAttachedStatus:
            current.internalUseOnly.shareholderPassportAttachedStatus ||
            extracted.internalUseOnly.shareholderPassportAttachedStatus ||
            '',
          shareholderPassportAttachedRemarks: mergeStringField(
            current.internalUseOnly.shareholderPassportAttachedRemarks,
            extracted.internalUseOnly.shareholderPassportAttachedRemarks,
          ),
          gmIdCardAttachedStatus:
            current.internalUseOnly.gmIdCardAttachedStatus ||
            extracted.internalUseOnly.gmIdCardAttachedStatus ||
            '',
          gmIdCardAttachedRemarks: mergeStringField(
            current.internalUseOnly.gmIdCardAttachedRemarks,
            extracted.internalUseOnly.gmIdCardAttachedRemarks,
          ),
          companyDocumentVerifiedStatus:
            current.internalUseOnly.companyDocumentVerifiedStatus ||
            extracted.internalUseOnly.companyDocumentVerifiedStatus ||
            '',
          companyDocumentVerifiedRemarks: mergeStringField(
            current.internalUseOnly.companyDocumentVerifiedRemarks,
            extracted.internalUseOnly.companyDocumentVerifiedRemarks,
          ),
          bankAccountProofAttachedStatus:
            current.internalUseOnly.bankAccountProofAttachedStatus ||
            extracted.internalUseOnly.bankAccountProofAttachedStatus ||
            '',
          bankAccountProofAttachedRemarks: mergeStringField(
            current.internalUseOnly.bankAccountProofAttachedRemarks,
            extracted.internalUseOnly.bankAccountProofAttachedRemarks,
          ),
          kycApprovedBy: mergeStringField(
            current.internalUseOnly.kycApprovedBy,
            extracted.internalUseOnly.kycApprovedBy,
          ),
          approvalDate: mergeStringField(
            current.internalUseOnly.approvalDate,
            extracted.internalUseOnly.approvalDate,
          ),
        }
      : current.internalUseOnly,
  };
}

export function postServiceKycFormFromParseResponse(
  form?: Partial<PostServiceKycFormValues> | null,
): Partial<PostServiceKycFormValues> {
  if (!form) return {};
  const empty = emptyPostServiceKycForm();
  return mergeExtractedPostServiceKycForm(empty, form);
}
