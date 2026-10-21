export function isResumeAttachment(filename = '', mimeType = '') {
  const name = String(filename || '').trim().toLowerCase();
  const mime = String(mimeType || '').trim().toLowerCase();
  if (name.endsWith('.pdf') || mime === 'application/pdf') return true;
  if (name.endsWith('.doc') || mime === 'application/msword') return true;
  if (name.endsWith('.docx') || mime.includes('wordprocessingml.document')) return true;
  return false;
}

export function summarizeMailAttachment({ id, filename, mimeType, size } = {}) {
  const name = String(filename || 'attachment').trim() || 'attachment';
  return {
    id: String(id || ''),
    filename: name,
    mimeType: String(mimeType || 'application/octet-stream'),
    size: Number(size) || 0,
    isResume: isResumeAttachment(name, mimeType),
  };
}
