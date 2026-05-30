import { filesApiUpload, type EntityFile, type FileEntityType } from './api';

export const KYC_FILE_TYPE = 'KYC';

const KYC_ACCEPT =
  'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,image/jpeg,image/png,image/webp,.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp';

const KYC_PARSEABLE_EXTENSIONS = /\.(pdf|docx?|xlsx?)$/i;

export function isKycParseableFile(file: File): boolean {
  return KYC_PARSEABLE_EXTENSIONS.test(file.name);
}

export const KYC_FILE_ACCEPT = KYC_ACCEPT;

const MAX_BYTES = 10 * 1024 * 1024;

export function filterKycFiles(files: EntityFile[]): EntityFile[] {
  return files.filter((f) => String(f.fileType || '').toUpperCase() === KYC_FILE_TYPE);
}

export function validateKycFile(file: File): string | null {
  if (file.size > MAX_BYTES) return `${file.name} exceeds 10MB limit`;
  const allowed =
    /\.(pdf|doc|docx|xls|xlsx|jpe?g|png|webp)$/i.test(file.name) ||
    /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)|application\/vnd\.ms-excel|image\/(jpeg|png|webp))$/i.test(
      file.type,
    );
  if (!allowed) {
    return `${file.name}: only PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, and WEBP are allowed`;
  }
  return null;
}

export async function uploadKycDocuments(
  entityType: Extract<FileEntityType, 'client' | 'lead'>,
  entityId: string,
  files: File[],
): Promise<EntityFile[]> {
  const uploaded: EntityFile[] = [];
  for (const file of files) {
    const err = validateKycFile(file);
    if (err) throw new Error(err);
    const res = await filesApiUpload(entityType, entityId, file, KYC_FILE_TYPE);
    if (res?.data) uploaded.push(res.data);
  }
  return uploaded;
}
