/** Bulk CV upload — accepted extensions (keep in sync with backend bulkCvZip + validateCvUploadFile). */
export const BULK_CV_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg'] as const;

export const BULK_CV_FORMAT_LABEL = 'PDF, DOC, DOCX, TXT, PNG, JPG, JPEG';

export const BULK_CV_ACCEPT_INPUT = [
  ...BULK_CV_EXTENSIONS,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/jpg',
].join(',');
