import { filesApiUpload, type EntityFile, type FileEntityType } from './api';

export const KYC_FILE_TYPE = 'KYC';

const KYC_ACCEPT =
  'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp,.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp';

export const KYC_FILE_ACCEPT = KYC_ACCEPT;

const MAX_BYTES = 10 * 1024 * 1024;

export function filterKycFiles(files: EntityFile[]): EntityFile[] {
  return files.filter((f) => String(f.fileType || '').toUpperCase() === KYC_FILE_TYPE);
}

export function validateKycFile(file: File): string | null {
  if (file.size > MAX_BYTES) return `${file.name} exceeds 10MB limit`;
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
