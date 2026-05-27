'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { buildFileHref } from '../../utils/cloudinaryUrls';
import { formatDateDMY } from '../../utils/dateDisplay';
import { KycDocumentsField } from '../documents/KycDocumentsField';
import {
  createEmptyPostServiceKycShareholder,
  formatPostServiceKycBoolean,
  formatPostServiceKycReviewStatus,
  postServiceKycFormHasAnyValue,
  type PostServiceKycAttachmentFieldKey,
  type PostServiceKycFileRef,
  type PostServiceKycFormValues,
  type PostServiceKycReviewStatus,
} from '../../lib/clientKycForm';

type FormProps = {
  values: PostServiceKycFormValues;
  onChange: (next: PostServiceKycFormValues) => void;
  disabled?: boolean;
  uploadsBase?: string;
  pendingFilesByField: Record<PostServiceKycAttachmentFieldKey, File[]>;
  onPendingFilesChange: (field: PostServiceKycAttachmentFieldKey, files: File[]) => void;
  onRemoveStoredFile?: (field: PostServiceKycAttachmentFieldKey, fileId: string) => void | Promise<void>;
};

const inputClassName =
  'w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500';

function InputField({
  label,
  value,
  onChange,
  disabled,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={inputClassName}
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  disabled,
  rows = 3,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        rows={rows}
        placeholder={placeholder}
        className={`${inputClassName} resize-none`}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  disabled,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  options: string[];
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={`${inputClassName} bg-white`}
      >
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
      />
      <span>{label}</span>
    </label>
  );
}

function AttachmentUploadField({
  label,
  description,
  storedFiles,
  pendingFiles,
  onPendingFilesChange,
  onRemoveStoredFile,
  disabled,
  uploadsBase,
}: {
  label: string;
  description: string;
  storedFiles: PostServiceKycFileRef[];
  pendingFiles: File[];
  onPendingFilesChange: (files: File[]) => void;
  onRemoveStoredFile?: (fileId: string) => void | Promise<void>;
  disabled?: boolean;
  uploadsBase?: string;
}) {
  return (
    <KycDocumentsField
      pendingFiles={pendingFiles}
      onPendingFilesChange={onPendingFilesChange}
      storedFiles={storedFiles}
      onRemoveStored={onRemoveStoredFile}
      disabled={disabled}
      uploadsBase={uploadsBase}
      label={label}
      description={description}
    />
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4 text-sm font-semibold text-slate-900">{title}</div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  if (!value.trim()) return null;
  return (
    <div className="border-b border-slate-100 py-2 last:border-0">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`text-sm font-medium text-slate-900 ${multiline ? 'whitespace-pre-line' : ''}`}>
        {value}
      </div>
    </div>
  );
}

function SummarySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 text-sm font-semibold text-slate-900">{title}</div>
      <div>{children}</div>
    </div>
  );
}

function SummaryFileList({
  label,
  files,
  uploadsBase,
}: {
  label: string;
  files: PostServiceKycFileRef[];
  uploadsBase?: string;
}) {
  if (files.length === 0) return null;

  return (
    <div className="border-b border-slate-100 py-2 last:border-0">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
      <ul className="space-y-2">
        {files.map((file) => {
          const href = buildFileHref(file.fileUrl || '', uploadsBase || '');
          return (
            <li key={file.id}>
              <a
                href={href || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full max-w-md items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 hover:bg-slate-50"
              >
                <span className="min-w-0 flex-1 truncate">{file.fileName}</span>
                {file.uploadDate ? (
                  <span className="shrink-0 text-xs text-slate-400">{formatDateDMY(file.uploadDate)}</span>
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function dateValue(value: string) {
  return value.trim() ? formatDateDMY(value.trim()) : '';
}

const reviewStatusOptions = ['YES', 'NO', 'NA'];

function ReviewRow({
  label,
  status,
  remarks,
  onStatusChange,
  onRemarksChange,
  disabled,
}: {
  label: string;
  status: PostServiceKycReviewStatus;
  remarks: string;
  onStatusChange: (value: PostServiceKycReviewStatus) => void;
  onRemarksChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[minmax(0,1.5fr)_180px_minmax(0,1fr)]">
      <div className="text-sm font-medium text-slate-900">{label}</div>
      <SelectField
        label="Status"
        value={status}
        onChange={(value) => onStatusChange(value as PostServiceKycReviewStatus)}
        disabled={disabled}
        options={reviewStatusOptions}
      />
      <InputField
        label="Remarks"
        value={remarks}
        onChange={onRemarksChange}
        disabled={disabled}
        placeholder="Add remarks"
      />
    </div>
  );
}

export function ClientPostServiceKycFormSection({
  values,
  onChange,
  disabled,
  uploadsBase,
  pendingFilesByField,
  onPendingFilesChange,
  onRemoveStoredFile,
}: FormProps) {
  const update = <K extends keyof PostServiceKycFormValues>(
    key: K,
    patch: Partial<PostServiceKycFormValues[K]>,
  ) => {
    onChange({
      ...values,
      [key]: {
        ...values[key],
        ...patch,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-slate-900">SAASA B2E - KYC Form</h4>
        <p className="mt-1 text-xs text-slate-500">For clients with post-service payment terms.</p>
      </div>

      <FormSection title="1. Client Information">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InputField label="Company Name" value={values.clientInformation.companyName} onChange={(value) => update('clientInformation', { companyName: value })} disabled={disabled} />
          <InputField label="Trade Name (if any)" value={values.clientInformation.tradeName} onChange={(value) => update('clientInformation', { tradeName: value })} disabled={disabled} />
          <SelectField label="Type of Entity" value={values.clientInformation.entityType} onChange={(value) => update('clientInformation', { entityType: value as PostServiceKycFormValues['clientInformation']['entityType'] })} disabled={disabled} options={['LLC', 'Corporation', 'Partnership', 'Sole Proprietorship', 'Other']} />
          <InputField label="Date of Incorporation" type="date" value={values.clientInformation.incorporationDate} onChange={(value) => update('clientInformation', { incorporationDate: value })} disabled={disabled} />
          <InputField label="Country of Incorporation" value={values.clientInformation.countryOfIncorporation} onChange={(value) => update('clientInformation', { countryOfIncorporation: value })} disabled={disabled} />
          <InputField label="Legal Registration Number" value={values.clientInformation.legalRegistrationNumber} onChange={(value) => update('clientInformation', { legalRegistrationNumber: value })} disabled={disabled} />
          <InputField label="Tax ID / VAT Number" value={values.clientInformation.taxIdVatNumber} onChange={(value) => update('clientInformation', { taxIdVatNumber: value })} disabled={disabled} />
          <InputField label="Website" value={values.clientInformation.website} onChange={(value) => update('clientInformation', { website: value })} disabled={disabled} placeholder="https://company.com" />
          <div className="sm:col-span-2">
            <TextAreaField label="Business Address" value={values.clientInformation.businessAddress} onChange={(value) => update('clientInformation', { businessAddress: value })} disabled={disabled} />
          </div>
          <InputField label="Primary Contact Person" value={values.clientInformation.primaryContactPerson} onChange={(value) => update('clientInformation', { primaryContactPerson: value })} disabled={disabled} />
          <InputField label="Contact Designation" value={values.clientInformation.contactDesignation} onChange={(value) => update('clientInformation', { contactDesignation: value })} disabled={disabled} />
          <InputField label="Email (Official)" type="email" value={values.clientInformation.officialEmail} onChange={(value) => update('clientInformation', { officialEmail: value })} disabled={disabled} />
          <InputField label="Phone Number" value={values.clientInformation.phoneNumber} onChange={(value) => update('clientInformation', { phoneNumber: value })} disabled={disabled} />
        </div>
      </FormSection>

      <FormSection title="2. Authorized Signatory / General Manager Details">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InputField label="Full Name" value={values.authorizedSignatory.fullName} onChange={(value) => update('authorizedSignatory', { fullName: value })} disabled={disabled} />
          <InputField label="Designation" value={values.authorizedSignatory.designation} onChange={(value) => update('authorizedSignatory', { designation: value })} disabled={disabled} />
          <InputField label="Nationality" value={values.authorizedSignatory.nationality} onChange={(value) => update('authorizedSignatory', { nationality: value })} disabled={disabled} />
          <InputField label="Date of Birth" type="date" value={values.authorizedSignatory.dateOfBirth} onChange={(value) => update('authorizedSignatory', { dateOfBirth: value })} disabled={disabled} />
          <SelectField label="ID Type" value={values.authorizedSignatory.idType} onChange={(value) => update('authorizedSignatory', { idType: value as PostServiceKycFormValues['authorizedSignatory']['idType'] })} disabled={disabled} options={['National ID', 'Passport', 'Driving License']} />
          <InputField label="ID Number" value={values.authorizedSignatory.idNumber} onChange={(value) => update('authorizedSignatory', { idNumber: value })} disabled={disabled} />
          <InputField label="Issue Date" type="date" value={values.authorizedSignatory.issueDate} onChange={(value) => update('authorizedSignatory', { issueDate: value })} disabled={disabled} />
          <InputField label="Expiry Date" type="date" value={values.authorizedSignatory.expiryDate} onChange={(value) => update('authorizedSignatory', { expiryDate: value })} disabled={disabled} />
          <InputField label="Email" type="email" value={values.authorizedSignatory.email} onChange={(value) => update('authorizedSignatory', { email: value })} disabled={disabled} />
          <InputField label="Phone" value={values.authorizedSignatory.phone} onChange={(value) => update('authorizedSignatory', { phone: value })} disabled={disabled} />
        </div>
      </FormSection>

      <FormSection title="3. Shareholder / Beneficial Owner Information">
        <div className="space-y-4">
          {values.shareholders.map((shareholder, index) => (
            <div key={shareholder.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">Shareholder {index + 1}</div>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...values,
                      shareholders:
                        values.shareholders.length > 1
                          ? values.shareholders.filter((row) => row.id !== shareholder.id)
                          : values.shareholders,
                    })
                  }
                  disabled={disabled || values.shareholders.length <= 1}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Remove shareholder ${index + 1}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InputField label="Full Name" value={shareholder.fullName} onChange={(value) => onChange({ ...values, shareholders: values.shareholders.map((row) => row.id === shareholder.id ? { ...row, fullName: value } : row) })} disabled={disabled} />
                <InputField label="Nationality" value={shareholder.nationality} onChange={(value) => onChange({ ...values, shareholders: values.shareholders.map((row) => row.id === shareholder.id ? { ...row, nationality: value } : row) })} disabled={disabled} />
                <InputField label="Ownership %" value={shareholder.ownershipPercentage} onChange={(value) => onChange({ ...values, shareholders: values.shareholders.map((row) => row.id === shareholder.id ? { ...row, ownershipPercentage: value } : row) })} disabled={disabled} placeholder="e.g. 25" />
                <InputField label="Passport Number" value={shareholder.passportNumber} onChange={(value) => onChange({ ...values, shareholders: values.shareholders.map((row) => row.id === shareholder.id ? { ...row, passportNumber: value } : row) })} disabled={disabled} />
                <InputField label="Passport Expiry Date" type="date" value={shareholder.passportExpiryDate} onChange={(value) => onChange({ ...values, shareholders: values.shareholders.map((row) => row.id === shareholder.id ? { ...row, passportExpiryDate: value } : row) })} disabled={disabled} />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({ ...values, shareholders: [...values.shareholders, createEmptyPostServiceKycShareholder()] })}
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-60"
          >
            <Plus size={16} />
            Add shareholder
          </button>
        </div>
      </FormSection>

      <FormSection title="4. Bank Account Details">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InputField label="Bank Name" value={values.bankAccountDetails.bankName} onChange={(value) => update('bankAccountDetails', { bankName: value })} disabled={disabled} />
          <InputField label="Account Holder Name" value={values.bankAccountDetails.accountHolderName} onChange={(value) => update('bankAccountDetails', { accountHolderName: value })} disabled={disabled} />
          <InputField label="Account Number" value={values.bankAccountDetails.accountNumber} onChange={(value) => update('bankAccountDetails', { accountNumber: value })} disabled={disabled} />
          <InputField label="IBAN" value={values.bankAccountDetails.iban} onChange={(value) => update('bankAccountDetails', { iban: value })} disabled={disabled} />
          <InputField label="SWIFT / BIC Code" value={values.bankAccountDetails.swiftBicCode} onChange={(value) => update('bankAccountDetails', { swiftBicCode: value })} disabled={disabled} />
          <InputField label="Currency" value={values.bankAccountDetails.currency} onChange={(value) => update('bankAccountDetails', { currency: value })} disabled={disabled} placeholder="e.g. AED" />
          <div className="sm:col-span-2">
            <TextAreaField label="Bank Address" value={values.bankAccountDetails.bankAddress} onChange={(value) => update('bankAccountDetails', { bankAddress: value })} disabled={disabled} />
          </div>
        </div>
      </FormSection>

      <FormSection title="5. Attachments Checklist (Mandatory)">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <CheckboxField
              label="Shareholder Passport Copy"
              checked={values.attachmentsChecklist.shareholderPassportCopy}
              onChange={(checked) => update('attachmentsChecklist', { shareholderPassportCopy: checked })}
              disabled={disabled}
            />
            {(values.attachmentsChecklist.shareholderPassportCopy ||
              values.attachmentsChecklist.shareholderPassportCopyFiles.length > 0 ||
              pendingFilesByField.shareholderPassportCopyFiles.length > 0) && (
              <AttachmentUploadField
                label="Shareholder Passport Copy Files"
                description="Upload the passport copies for each shareholder with 10% or more ownership."
                storedFiles={values.attachmentsChecklist.shareholderPassportCopyFiles}
                pendingFiles={pendingFilesByField.shareholderPassportCopyFiles}
                onPendingFilesChange={(files) => {
                  update('attachmentsChecklist', { shareholderPassportCopy: files.length > 0 || values.attachmentsChecklist.shareholderPassportCopyFiles.length > 0 || values.attachmentsChecklist.shareholderPassportCopy });
                  onPendingFilesChange('shareholderPassportCopyFiles', files);
                }}
                onRemoveStoredFile={onRemoveStoredFile ? (fileId) => onRemoveStoredFile('shareholderPassportCopyFiles', fileId) : undefined}
                disabled={disabled}
                uploadsBase={uploadsBase}
              />
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <CheckboxField
              label="General Manager ID Card / Passport"
              checked={values.attachmentsChecklist.generalManagerIdCard}
              onChange={(checked) => update('attachmentsChecklist', { generalManagerIdCard: checked })}
              disabled={disabled}
            />
            {(values.attachmentsChecklist.generalManagerIdCard ||
              values.attachmentsChecklist.generalManagerIdCardFiles.length > 0 ||
              pendingFilesByField.generalManagerIdCardFiles.length > 0) && (
              <AttachmentUploadField
                label="General Manager ID Card / Passport Files"
                description="Upload the General Manager identity card or passport."
                storedFiles={values.attachmentsChecklist.generalManagerIdCardFiles}
                pendingFiles={pendingFilesByField.generalManagerIdCardFiles}
                onPendingFilesChange={(files) => {
                  update('attachmentsChecklist', { generalManagerIdCard: files.length > 0 || values.attachmentsChecklist.generalManagerIdCardFiles.length > 0 || values.attachmentsChecklist.generalManagerIdCard });
                  onPendingFilesChange('generalManagerIdCardFiles', files);
                }}
                onRemoveStoredFile={onRemoveStoredFile ? (fileId) => onRemoveStoredFile('generalManagerIdCardFiles', fileId) : undefined}
                disabled={disabled}
                uploadsBase={uploadsBase}
              />
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <CheckboxField
              label="Company Document"
              checked={values.attachmentsChecklist.companyDocument}
              onChange={(checked) => update('attachmentsChecklist', { companyDocument: checked })}
              disabled={disabled}
            />
            {(values.attachmentsChecklist.companyDocument ||
              values.attachmentsChecklist.companyDocumentFiles.length > 0 ||
              pendingFilesByField.companyDocumentFiles.length > 0) && (
              <AttachmentUploadField
                label="Company Document Files"
                description="Upload the Certificate of Incorporation, Trade License, or other company documents."
                storedFiles={values.attachmentsChecklist.companyDocumentFiles}
                pendingFiles={pendingFilesByField.companyDocumentFiles}
                onPendingFilesChange={(files) => {
                  update('attachmentsChecklist', { companyDocument: files.length > 0 || values.attachmentsChecklist.companyDocumentFiles.length > 0 || values.attachmentsChecklist.companyDocument });
                  onPendingFilesChange('companyDocumentFiles', files);
                }}
                onRemoveStoredFile={onRemoveStoredFile ? (fileId) => onRemoveStoredFile('companyDocumentFiles', fileId) : undefined}
                disabled={disabled}
                uploadsBase={uploadsBase}
              />
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <CheckboxField
              label="Bank Account Proof"
              checked={values.attachmentsChecklist.bankAccountProof}
              onChange={(checked) => update('attachmentsChecklist', { bankAccountProof: checked })}
              disabled={disabled}
            />
            {(values.attachmentsChecklist.bankAccountProof ||
              values.attachmentsChecklist.bankAccountProofFiles.length > 0 ||
              pendingFilesByField.bankAccountProofFiles.length > 0) && (
              <AttachmentUploadField
                label="Bank Account Proof Files"
                description="Upload a voided cheque, bank letter, or statement showing the account holder name."
                storedFiles={values.attachmentsChecklist.bankAccountProofFiles}
                pendingFiles={pendingFilesByField.bankAccountProofFiles}
                onPendingFilesChange={(files) => {
                  update('attachmentsChecklist', { bankAccountProof: files.length > 0 || values.attachmentsChecklist.bankAccountProofFiles.length > 0 || values.attachmentsChecklist.bankAccountProof });
                  onPendingFilesChange('bankAccountProofFiles', files);
                }}
                onRemoveStoredFile={onRemoveStoredFile ? (fileId) => onRemoveStoredFile('bankAccountProofFiles', fileId) : undefined}
                disabled={disabled}
                uploadsBase={uploadsBase}
              />
            )}
          </div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No advance payment will be released, and services will only commence after KYC approval with all above documents.
        </div>
      </FormSection>

      <FormSection title="6. Declaration & Undertaking">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
          We confirm that all information provided is accurate and complete. We understand that services will be provided without advance payment, and we agree to pay within the agreed credit period after service delivery. Any delay or default may result in suspension of future services and legal recovery actions.
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InputField label="Authorized Signatory Name" value={values.declaration.authorizedSignatoryName} onChange={(value) => update('declaration', { authorizedSignatoryName: value })} disabled={disabled} />
          <InputField label="Date" type="date" value={values.declaration.date} onChange={(value) => update('declaration', { date: value })} disabled={disabled} />
          <div className="sm:col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AttachmentUploadField
              label="Signature"
              description="Upload an image, PDF, DOC, or DOCX of the signature."
              storedFiles={values.declaration.signatureFiles}
              pendingFiles={pendingFilesByField.signatureFiles}
              onPendingFilesChange={(files) => onPendingFilesChange('signatureFiles', files)}
              onRemoveStoredFile={onRemoveStoredFile ? (fileId) => onRemoveStoredFile('signatureFiles', fileId) : undefined}
              disabled={disabled}
              uploadsBase={uploadsBase}
            />
            <AttachmentUploadField
              label="Company Stamp"
              description="Upload an image, PDF, DOC, or DOCX of the company stamp."
              storedFiles={values.declaration.companyStampFiles}
              pendingFiles={pendingFilesByField.companyStampFiles}
              onPendingFilesChange={(files) => onPendingFilesChange('companyStampFiles', files)}
              onRemoveStoredFile={onRemoveStoredFile ? (fileId) => onRemoveStoredFile('companyStampFiles', fileId) : undefined}
              disabled={disabled}
              uploadsBase={uploadsBase}
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Internal Use Only (SAASA B2E)">
        <div className="space-y-3">
          <ReviewRow
            label="KYC Form filled completely"
            status={values.internalUseOnly.kycFormFilledCompletelyStatus}
            remarks={values.internalUseOnly.kycFormFilledCompletelyRemarks}
            onStatusChange={(value) => update('internalUseOnly', { kycFormFilledCompletelyStatus: value })}
            onRemarksChange={(value) => update('internalUseOnly', { kycFormFilledCompletelyRemarks: value })}
            disabled={disabled}
          />
          <ReviewRow
            label="Shareholder Passport attached"
            status={values.internalUseOnly.shareholderPassportAttachedStatus}
            remarks={values.internalUseOnly.shareholderPassportAttachedRemarks}
            onStatusChange={(value) => update('internalUseOnly', { shareholderPassportAttachedStatus: value })}
            onRemarksChange={(value) => update('internalUseOnly', { shareholderPassportAttachedRemarks: value })}
            disabled={disabled}
          />
          <ReviewRow
            label="GM ID Card attached"
            status={values.internalUseOnly.gmIdCardAttachedStatus}
            remarks={values.internalUseOnly.gmIdCardAttachedRemarks}
            onStatusChange={(value) => update('internalUseOnly', { gmIdCardAttachedStatus: value })}
            onRemarksChange={(value) => update('internalUseOnly', { gmIdCardAttachedRemarks: value })}
            disabled={disabled}
          />
          <ReviewRow
            label="Company document verified"
            status={values.internalUseOnly.companyDocumentVerifiedStatus}
            remarks={values.internalUseOnly.companyDocumentVerifiedRemarks}
            onStatusChange={(value) => update('internalUseOnly', { companyDocumentVerifiedStatus: value })}
            onRemarksChange={(value) => update('internalUseOnly', { companyDocumentVerifiedRemarks: value })}
            disabled={disabled}
          />
          <ReviewRow
            label="Bank account proof attached"
            status={values.internalUseOnly.bankAccountProofAttachedStatus}
            remarks={values.internalUseOnly.bankAccountProofAttachedRemarks}
            onStatusChange={(value) => update('internalUseOnly', { bankAccountProofAttachedStatus: value })}
            onRemarksChange={(value) => update('internalUseOnly', { bankAccountProofAttachedRemarks: value })}
            disabled={disabled}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputField label="KYC Approved By" value={values.internalUseOnly.kycApprovedBy} onChange={(value) => update('internalUseOnly', { kycApprovedBy: value })} disabled={disabled} />
            <InputField label="Approval Date" type="date" value={values.internalUseOnly.approvalDate} onChange={(value) => update('internalUseOnly', { approvalDate: value })} disabled={disabled} />
          </div>
        </div>
      </FormSection>
    </div>
  );
}

export function ClientPostServiceKycSummary({
  values,
  uploadsBase,
}: {
  values: PostServiceKycFormValues;
  uploadsBase?: string;
}) {
  if (!postServiceKycFormHasAnyValue(values)) {
    return <p className="text-sm text-slate-500">No KYC form data added yet.</p>;
  }

  return (
    <div className="space-y-4">
      <SummarySection title="1. Client Information">
        <SummaryRow label="Company Name" value={values.clientInformation.companyName} />
        <SummaryRow label="Trade Name" value={values.clientInformation.tradeName} />
        <SummaryRow label="Type of Entity" value={values.clientInformation.entityType} />
        <SummaryRow label="Date of Incorporation" value={dateValue(values.clientInformation.incorporationDate)} />
        <SummaryRow label="Country of Incorporation" value={values.clientInformation.countryOfIncorporation} />
        <SummaryRow label="Legal Registration Number" value={values.clientInformation.legalRegistrationNumber} />
        <SummaryRow label="Tax ID / VAT Number" value={values.clientInformation.taxIdVatNumber} />
        <SummaryRow label="Business Address" value={values.clientInformation.businessAddress} multiline />
        <SummaryRow label="Website" value={values.clientInformation.website} />
        <SummaryRow label="Primary Contact Person" value={values.clientInformation.primaryContactPerson} />
        <SummaryRow label="Contact Designation" value={values.clientInformation.contactDesignation} />
        <SummaryRow label="Official Email" value={values.clientInformation.officialEmail} />
        <SummaryRow label="Phone Number" value={values.clientInformation.phoneNumber} />
      </SummarySection>

      <SummarySection title="2. Authorized Signatory / General Manager Details">
        <SummaryRow label="Full Name" value={values.authorizedSignatory.fullName} />
        <SummaryRow label="Designation" value={values.authorizedSignatory.designation} />
        <SummaryRow label="Nationality" value={values.authorizedSignatory.nationality} />
        <SummaryRow label="Date of Birth" value={dateValue(values.authorizedSignatory.dateOfBirth)} />
        <SummaryRow label="ID Type" value={values.authorizedSignatory.idType} />
        <SummaryRow label="ID Number" value={values.authorizedSignatory.idNumber} />
        <SummaryRow label="Issue Date" value={dateValue(values.authorizedSignatory.issueDate)} />
        <SummaryRow label="Expiry Date" value={dateValue(values.authorizedSignatory.expiryDate)} />
        <SummaryRow label="Email" value={values.authorizedSignatory.email} />
        <SummaryRow label="Phone" value={values.authorizedSignatory.phone} />
      </SummarySection>

      <SummarySection title="3. Shareholder / Beneficial Owner Information">
        <div className="space-y-3">
          {values.shareholders
            .filter((row) =>
              [row.fullName, row.nationality, row.ownershipPercentage, row.passportNumber, row.passportExpiryDate]
                .some((value) => value.trim()),
            )
            .map((shareholder, index) => (
              <div key={shareholder.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-2 text-sm font-semibold text-slate-900">Shareholder {index + 1}</div>
                <SummaryRow label="Full Name" value={shareholder.fullName} />
                <SummaryRow label="Nationality" value={shareholder.nationality} />
                <SummaryRow label="Ownership %" value={shareholder.ownershipPercentage} />
                <SummaryRow label="Passport Number" value={shareholder.passportNumber} />
                <SummaryRow label="Passport Expiry Date" value={dateValue(shareholder.passportExpiryDate)} />
              </div>
            ))}
        </div>
      </SummarySection>

      <SummarySection title="4. Bank Account Details">
        <SummaryRow label="Bank Name" value={values.bankAccountDetails.bankName} />
        <SummaryRow label="Account Holder Name" value={values.bankAccountDetails.accountHolderName} />
        <SummaryRow label="Account Number" value={values.bankAccountDetails.accountNumber} />
        <SummaryRow label="IBAN" value={values.bankAccountDetails.iban} />
        <SummaryRow label="SWIFT / BIC Code" value={values.bankAccountDetails.swiftBicCode} />
        <SummaryRow label="Bank Address" value={values.bankAccountDetails.bankAddress} multiline />
        <SummaryRow label="Currency" value={values.bankAccountDetails.currency} />
      </SummarySection>

      <SummarySection title="5. Attachments Checklist">
        <SummaryRow label="Shareholder Passport Copy" value={formatPostServiceKycBoolean(values.attachmentsChecklist.shareholderPassportCopy)} />
        <SummaryFileList label="Shareholder Passport Files" files={values.attachmentsChecklist.shareholderPassportCopyFiles} uploadsBase={uploadsBase} />
        <SummaryRow label="General Manager ID Card / Passport" value={formatPostServiceKycBoolean(values.attachmentsChecklist.generalManagerIdCard)} />
        <SummaryFileList label="General Manager ID Card / Passport Files" files={values.attachmentsChecklist.generalManagerIdCardFiles} uploadsBase={uploadsBase} />
        <SummaryRow label="Company Document" value={formatPostServiceKycBoolean(values.attachmentsChecklist.companyDocument)} />
        <SummaryFileList label="Company Document Files" files={values.attachmentsChecklist.companyDocumentFiles} uploadsBase={uploadsBase} />
        <SummaryRow label="Bank Account Proof" value={formatPostServiceKycBoolean(values.attachmentsChecklist.bankAccountProof)} />
        <SummaryFileList label="Bank Account Proof Files" files={values.attachmentsChecklist.bankAccountProofFiles} uploadsBase={uploadsBase} />
      </SummarySection>

      <SummarySection title="6. Declaration & Undertaking">
        <div className="mb-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
          We confirm that all information provided is accurate and complete. We understand that services will be provided without advance payment, and we agree to pay within the agreed credit period after service delivery.
        </div>
        <SummaryRow label="Authorized Signatory Name" value={values.declaration.authorizedSignatoryName} />
        <SummaryFileList label="Signature" files={values.declaration.signatureFiles} uploadsBase={uploadsBase} />
        <SummaryRow label="Date" value={dateValue(values.declaration.date)} />
        <SummaryFileList label="Company Stamp" files={values.declaration.companyStampFiles} uploadsBase={uploadsBase} />
      </SummarySection>

      <SummarySection title="Internal Use Only (SAASA B2E)">
        <SummaryRow label="KYC Form filled completely" value={formatPostServiceKycReviewStatus(values.internalUseOnly.kycFormFilledCompletelyStatus)} />
        <SummaryRow label="KYC Form remarks" value={values.internalUseOnly.kycFormFilledCompletelyRemarks} multiline />
        <SummaryRow label="Shareholder Passport attached" value={formatPostServiceKycReviewStatus(values.internalUseOnly.shareholderPassportAttachedStatus)} />
        <SummaryRow label="Shareholder Passport remarks" value={values.internalUseOnly.shareholderPassportAttachedRemarks} multiline />
        <SummaryRow label="GM ID Card attached" value={formatPostServiceKycReviewStatus(values.internalUseOnly.gmIdCardAttachedStatus)} />
        <SummaryRow label="GM ID Card remarks" value={values.internalUseOnly.gmIdCardAttachedRemarks} multiline />
        <SummaryRow label="Company document verified" value={formatPostServiceKycReviewStatus(values.internalUseOnly.companyDocumentVerifiedStatus)} />
        <SummaryRow label="Company document remarks" value={values.internalUseOnly.companyDocumentVerifiedRemarks} multiline />
        <SummaryRow label="Bank account proof attached" value={formatPostServiceKycReviewStatus(values.internalUseOnly.bankAccountProofAttachedStatus)} />
        <SummaryRow label="Bank account proof remarks" value={values.internalUseOnly.bankAccountProofAttachedRemarks} multiline />
        <SummaryRow label="KYC Approved By" value={values.internalUseOnly.kycApprovedBy} />
        <SummaryRow label="Approval Date" value={dateValue(values.internalUseOnly.approvalDate)} />
      </SummarySection>
    </div>
  );
}
