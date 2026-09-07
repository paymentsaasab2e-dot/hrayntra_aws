import type { ClientReviewData } from './clientReviewTypes';

function isClientStorageUrl(value: string): boolean {
  const raw = String(value || '').trim();
  if (!raw) return false;
  if (/\/client-review\/[^/]+\/(resume|files)\b/i.test(raw)) return false;
  if (/\/interviews\/public\/review\/[^/]+\/(resume|files)\b/i.test(raw)) return false;
  return (
    /amazonaws\.com/i.test(raw) ||
    /hryantra-bucket/i.test(raw) ||
    /cloudinary\.com/i.test(raw) ||
    /\/uploads\/(phase\d+|tenants)\//i.test(raw)
  );
}

export function isClientReviewFileHref(value: string): boolean {
  return /\/client-review\/[^/]+\/(resume|files)\b/i.test(String(value || ''));
}

export function clientReviewResumeHref(token: string, matchId?: string): string {
  const base = `/client-review/${token}/resume`;
  const id = String(matchId || '').trim();
  return id ? `${base}?matchId=${encodeURIComponent(id)}` : base;
}

export function clientReviewFileHref(token: string, fileId: string, matchId?: string): string {
  const base = `/client-review/${token}/files/${encodeURIComponent(String(fileId || '').trim())}`;
  const id = String(matchId || '').trim();
  return id ? `${base}?matchId=${encodeURIComponent(id)}` : base;
}

function maskDetail(detail: ClientReviewData, token: string): ClientReviewData {
  const matchId = String(detail.matchId || detail.activeMatchId || '').trim();
  const resumeHref = clientReviewResumeHref(token, matchId);
  const next: ClientReviewData = { ...detail };

  if (isClientStorageUrl(String(next.sharedResumeUrl || ''))) next.sharedResumeUrl = resumeHref;
  if (next.candidate && isClientStorageUrl(String(next.candidate.resume || ''))) {
    next.candidate = { ...next.candidate, resume: resumeHref };
  }
  if (isClientStorageUrl(String(next.offerLetterUrl || ''))) {
    next.offerLetterUrl = clientReviewFileHref(token, 'offer', matchId);
  }

  next.candidateFiles = Array.isArray(next.candidateFiles)
    ? next.candidateFiles.map((file) => ({
        ...file,
        fileUrl: file.id ? clientReviewFileHref(token, file.id, matchId) : file.fileUrl,
      }))
    : next.candidateFiles;

  next.presentationSections = Array.isArray(next.presentationSections)
    ? next.presentationSections.map((section) => ({
        ...section,
        fields: Array.isArray(section.fields)
          ? section.fields.map((field) => ({
              ...field,
              value: isClientStorageUrl(String(field.value || '')) ? resumeHref : field.value,
            }))
          : section.fields,
      }))
    : next.presentationSections;

  return next;
}

export function maskClientReviewStorageUrls(data: ClientReviewData, token: string): ClientReviewData {
  const masked = maskDetail(data, token);
  if (!Array.isArray(masked.batchCandidates)) return masked;
  return {
    ...masked,
    batchCandidates: masked.batchCandidates.map((row) => ({
      ...row,
      detail: maskDetail(row.detail || masked, token),
    })),
  };
}
