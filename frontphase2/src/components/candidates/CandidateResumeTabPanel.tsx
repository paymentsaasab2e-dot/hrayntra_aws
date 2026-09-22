'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Eye, Loader2, Pencil, RefreshCw, Trash2, Upload } from 'lucide-react';
import { ResumeInlinePreview } from './ResumeInlinePreview';
import { ResumePreviewModal } from './ResumePreviewModal';
import { SaasaCvSavedPreview } from './SaasaCvSavedPreview';
import { SaasaCvCompositePreview } from './SaasaCvCompositePreview';
import type { CandidateProfileDrawerData } from '../drawers/CandidateProfileDrawer';
import {
  apiDeleteCandidateResumeVersion,
  apiUploadCandidateResumeFile,
  filesApiGet,
  type BackendCandidate,
} from '../../lib/api';
import { extractApiData } from '../../lib/mapCandidateProfile';
import CVEditorModal from '../CVEditorModal';
import { PortalTailoredCvStudioPreview } from './PortalTailoredCvStudioPreview';
import {
  candidateToCvEditorData,
  hasPortalAiCv,
  hasResumeTabUpdatedCv,
  listAvailableResumeCvModes,
  mergeResumeTabCandidateSource,
  readCvEditorLayout,
  readPortalStudioTemplateId,
  readPortalTailoredCvHtml,
  resolveDefaultResumeCvViewMode,
  type ResumeCvViewMode,
} from '../../lib/cvEditorMapping';
import {
  isCandidateResumeFileRow,
  pickLatestResumeFileUrl,
  resolveCandidateResumeUrlFromSources,
} from '../../lib/phase1ProfileSnapshot';
import {
  hasSaasaCvDocumentTextEdits,
  readSaasaCvAnnotations,
  resolveSaasaCvBaseResumeUrl,
  resolveSaasaCvPreviewUrl,
  type SaasaCvFileRef,
} from '../../lib/saasaCvAnnotations';
import { buildFileHref } from '../../utils/cloudinaryUrls';
import { getResumeExtension, isResumeHttpUrl, normalizeResumeHref } from '../../lib/resumePreview';
import { triggerBlobDownload, triggerFileDownload } from '../../utils/triggerFileDownload';
import { requestConfirm, SYSTEM_ALERT_TITLE } from '../../lib/appDialog';
import { startAsyncLoad } from '../../lib/asyncLoadGuard';
import { downloadCvEditorPlainText, printCvEditorAsPdf } from '../../lib/cvEditorExport';

function normalizeResumeCompareUrl(url: string): string {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '').toLowerCase();
  } catch {
    return raw.split('?')[0]?.replace(/\/+$/, '').toLowerCase() || '';
  }
}

function isResumeVersionCandidateFile(file: {
  fileType?: string;
  fileUrl?: string | null;
  fileName?: string;
}): boolean {
  // Keep Resume versions separate from Files-tab documents (Other/Offer/etc.).
  return isCandidateResumeFileRow(file);
}

type ResumeVersionRow = {
  id: string;
  fileUrl: string;
  fileName: string;
  uploadDate?: string;
  isPrimary?: boolean;
};

function buildResumeVersionRows(
  files: Array<{
    id: string;
    fileUrl?: string | null;
    fileType?: string;
    fileName?: string;
    uploadDate?: string;
    createdAt?: string;
  }>,
  primaryUrl: string,
  primaryFileName?: string | null,
  storedVersions?: Array<{
    id?: string | null;
    fileUrl?: string | null;
    fileName?: string | null;
    uploadedAt?: string | null;
    isPrimary?: boolean;
  }> | null,
  firstOriginalUrl?: string | null,
): ResumeVersionRow[] {
  const primary = String(primaryUrl || '').trim();
  const primaryKey = normalizeResumeCompareUrl(primary);
  // Current Original CV slot only — never resurrect a replaced URL as a ghost v2.
  const originalKey = primaryKey || normalizeResumeCompareUrl(String(firstOriginalUrl || '').trim());

  const fileByUrl = new Map<string, ResumeVersionRow>();
  for (const file of files) {
    if (!isResumeVersionCandidateFile(file)) continue;
    const raw = String(file.fileUrl || '').trim();
    const key = normalizeResumeCompareUrl(raw);
    if (!key) continue;
    fileByUrl.set(key, {
      id: file.id,
      fileUrl: raw,
      fileName: file.fileName || 'Resume',
      uploadDate: file.uploadDate || file.createdAt,
      isPrimary: Boolean(primaryKey && key === primaryKey),
    });
  }

  const fromStored: ResumeVersionRow[] = (Array.isArray(storedVersions) ? storedVersions : [])
    .map((row, index) => {
      const raw = String(row?.fileUrl || '').trim();
      const key = normalizeResumeCompareUrl(raw);
      if (!raw || !key) return null;
      const matchedFile = fileByUrl.get(key);
      return {
        id:
          String(row?.id || '').trim() ||
          matchedFile?.id ||
          `stored-${index}-${key}`,
        fileUrl: raw,
        fileName: String(row?.fileName || matchedFile?.fileName || '').trim() || 'Resume',
        uploadDate: row?.uploadedAt || matchedFile?.uploadDate || undefined,
        isPrimary:
          Boolean(row?.isPrimary) || Boolean(primaryKey && key === primaryKey),
      } as ResumeVersionRow;
    })
    .filter(Boolean) as ResumeVersionRow[];

  // resumeVersions is authoritative when present — orphan CandidateFile rows must not
  // reappear as v2 after Replace CV or Delete version.
  let versions: ResumeVersionRow[];
  if (fromStored.length > 0) {
    versions = fromStored.filter((row) => {
      const key = normalizeResumeCompareUrl(row.fileUrl);
      if (primaryKey && key === primaryKey) return true;
      // If files loaded, drop stored URLs whose files were already wiped/deleted.
      if (fileByUrl.size === 0) return true;
      return fileByUrl.has(key);
    });
  } else {
    versions = Array.from(fileByUrl.values());
  }

  // Ensure current Original CV is present; do not seed a divergent firstOriginal URL.
  if (primary && !versions.some((row) => normalizeResumeCompareUrl(row.fileUrl) === primaryKey)) {
    versions.unshift({
      id: '__primary_resume__',
      fileUrl: primary,
      fileName: String(primaryFileName || '').trim() || 'Original CV',
      uploadDate: undefined,
      isPrimary: true,
    });
  } else if (primary && versions.length) {
    let matched = false;
    for (const row of versions) {
      if (normalizeResumeCompareUrl(row.fileUrl) === primaryKey) {
        row.isPrimary = !matched;
        matched = true;
      } else {
        row.isPrimary = false;
      }
    }
  }

  versions.sort((a, b) => {
    // v1 = current Original CV (primary), then older → newer extra versions.
    const aIsOriginal =
      Boolean(originalKey) && normalizeResumeCompareUrl(a.fileUrl) === originalKey;
    const bIsOriginal =
      Boolean(originalKey) && normalizeResumeCompareUrl(b.fileUrl) === originalKey;
    if (aIsOriginal && !bIsOriginal) return -1;
    if (!aIsOriginal && bIsOriginal) return 1;
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;

    const aHasDate = Boolean(a.uploadDate && Date.parse(String(a.uploadDate)));
    const bHasDate = Boolean(b.uploadDate && Date.parse(String(b.uploadDate)));
    if (!aHasDate && bHasDate) return -1;
    if (aHasDate && !bHasDate) return 1;
    const ta = Date.parse(String(a.uploadDate || '')) || 0;
    const tb = Date.parse(String(b.uploadDate || '')) || 0;
    if (ta !== tb) return ta - tb;
    return String(a.fileName || '').localeCompare(String(b.fileName || ''));
  });

  const seen = new Set<string>();
  const unique: ResumeVersionRow[] = [];
  for (const row of versions) {
    const key = normalizeResumeCompareUrl(row.fileUrl) || row.id;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  return unique;
}

const RESUME_FILE_ACCEPT =
  '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function isAllowedResumeFile(file: File): boolean {
  const name = String(file?.name || '').toLowerCase();
  const type = String(file?.type || '').toLowerCase();
  if (/\.(pdf|docx?)$/i.test(name)) return true;
  return (
    type === 'application/pdf' ||
    type === 'application/msword' ||
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}

export interface CandidateResumeCvEditorApi {
  backendCandidate: BackendCandidate | null;
  resumeHref: string;
  canEdit: boolean;
  busy: boolean;
  openEditor: () => void | Promise<void>;
  openStructuredPreview: () => void | Promise<void>;
  refreshBackend: () => Promise<BackendCandidate | null>;
  deleteEditedCv?: () => Promise<boolean>;
  deleteUpdatedCv?: () => Promise<boolean>;
  preferredResumeViewMode?: ResumeCvViewMode | null;
}

interface CandidateResumeTabPanelProps {
  candidate: CandidateProfileDrawerData;
  enabled?: boolean;
  cvEditor: CandidateResumeCvEditorApi;
  /** Latest saved HRYantra CV file URL (from hook after save) */
  saasaSavedFileUrl?: string | null;
  /** After HRYantra CV save, show HRYantra CV tab without hiding Updated CV */
  preferredResumeViewMode?: ResumeCvViewMode | null;
  /** Keep parent preference in sync when the user picks a Resume tab (Original / HRYantra / …). */
  onPreferredResumeViewModeChange?: (mode: ResumeCvViewMode | null) => void;
  onCandidateUpdated?: () => void | Promise<void>;
  onToast?: (message: string) => void;
  onOpenSaasaCv?: () => void;
}

const MODE_LABELS: Record<ResumeCvViewMode, string> = {
  original: 'Original CV',
  saasa: 'HRYantra CV',
  ai: 'AI CV',
  updated: 'Updated CV',
  edited: 'Edited CV',
};

export function CandidateResumeTabPanel({
  candidate,
  enabled = true,
  cvEditor,
  onCandidateUpdated,
  onToast,
  onOpenSaasaCv,
  saasaSavedFileUrl = null,
  preferredResumeViewMode: preferredResumeViewModeProp = null,
  onPreferredResumeViewModeChange,
}: CandidateResumeTabPanelProps) {
  const {
    backendCandidate,
    resumeHref,
    canEdit,
    busy,
    openEditor,
    openStructuredPreview,
    refreshBackend,
    deleteUpdatedCv,
    preferredResumeViewMode: preferredResumeViewModeFromEditor = null,
  } = cvEditor;

  const preferredResumeViewMode =
    preferredResumeViewModeProp ?? preferredResumeViewModeFromEditor;

  const resumeSourceCandidate = useMemo(
    () => mergeResumeTabCandidateSource(backendCandidate, candidate),
    [backendCandidate, candidate],
  );

  const structuredCvData = useMemo(() => {
    if (!resumeSourceCandidate) return null;
    return candidateToCvEditorData(resumeSourceCandidate);
  }, [resumeSourceCandidate]);

  const [loading, setLoading] = useState(false);
  const [resumePreviewOpen, setResumePreviewOpen] = useState(false);
  const [saasaPreviewOpen, setSaasaPreviewOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ResumeCvViewMode | null>(null);
  const [filesResumeUrl, setFilesResumeUrl] = useState<string | null>(null);
  const [candidateFiles, setCandidateFiles] = useState<SaasaCvFileRef[]>([]);
  const [portalReady, setPortalReady] = useState(false);
  const [downloadingResume, setDownloadingResume] = useState(false);
  const [downloadingSaasa, setDownloadingSaasa] = useState(false);
  const [downloadingUpdated, setDownloadingUpdated] = useState(false);
  const [exportingUpdatedPdf, setExportingUpdatedPdf] = useState(false);
  const [replacingCv, setReplacingCv] = useState(false);
  const [deletingVersionId, setDeletingVersionId] = useState<string | null>(null);
  const [cvUploadLabel, setCvUploadLabel] = useState('Uploading CV…');
  const replaceCvInputRef = useRef<HTMLInputElement | null>(null);
  const cvUploadModeRef = useRef<'replace' | 'version'>('replace');
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [forcedPreviewUrl, setForcedPreviewUrl] = useState<string | null>(null);
  const [resumeVersionRows, setResumeVersionRows] = useState<ResumeVersionRow[]>([]);
  const [previewReloadKey, setPreviewReloadKey] = useState(0);

  const canDeleteUpdatedCv =
    canEdit && Boolean(deleteUpdatedCv) && hasResumeTabUpdatedCv(resumeSourceCandidate);
  const canReplaceCv = canEdit && Boolean(candidate.id);

  const handleDeleteUpdatedCv = async () => {
    if (busy || !deleteUpdatedCv || !canDeleteUpdatedCv) return;
    const confirmed = await requestConfirm(
      'Remove the updated CV? The Original CV will remain. You can edit and save again anytime.',
      {
        title: SYSTEM_ALERT_TITLE,
        tone: 'warning',
        confirmLabel: 'Remove',
        cancelLabel: 'Cancel',
      }
    );
    if (!confirmed) return;
    await deleteUpdatedCv();
  };

  const refreshResumeFiles = async (
    primaryOverride?: {
      url?: string | null;
      fileName?: string | null;
    },
    extraOverride?: Record<string, unknown> | null,
  ) => {
    const filesRaw = await filesApiGet('candidate', candidate.id).catch(() => null);
    const files = extractApiData(filesRaw) ?? [];
    setCandidateFiles(
      files.map((f) => ({
        id: f.id,
        fileUrl: f.fileUrl ?? null,
        fileType: f.fileType,
        fileName: f.fileName,
      }))
    );
    const latest = pickLatestResumeFileUrl(files);
    setFilesResumeUrl(latest || null);

    const extra =
      (extraOverride && typeof extraOverride === 'object' && !Array.isArray(extraOverride)
        ? extraOverride
        : null) ||
      (backendCandidate?.extraData &&
      typeof backendCandidate.extraData === 'object' &&
      !Array.isArray(backendCandidate.extraData)
        ? (backendCandidate.extraData as Record<string, unknown>)
        : null) ||
      (candidate.extraData && typeof candidate.extraData === 'object' && !Array.isArray(candidate.extraData)
        ? (candidate.extraData as Record<string, unknown>)
        : null);
    const primaryUrl = String(
      primaryOverride?.url ||
        backendCandidate?.resume ||
        backendCandidate?.resumeUrl ||
        candidate.resumeUrl ||
        extra?.originalResumeUrl ||
        '',
    ).trim();
    const primaryFileName = String(
      primaryOverride?.fileName || extra?.originalResumeFileName || '',
    ).trim();
    const firstOriginalUrl = String(extra?.firstOriginalResumeUrl || '').trim();
    const storedVersions = Array.isArray(extra?.resumeVersions)
      ? (extra.resumeVersions as Array<{
          id?: string | null;
          fileUrl?: string | null;
          fileName?: string | null;
          uploadedAt?: string | null;
          isPrimary?: boolean;
        }>)
      : null;

    const versions = buildResumeVersionRows(
      files.map((f) => ({
        id: f.id,
        fileUrl: f.fileUrl,
        fileType: f.fileType,
        fileName: f.fileName,
        uploadDate: f.uploadDate,
        createdAt: (f as { createdAt?: string }).createdAt,
      })),
      primaryUrl,
      primaryFileName,
      storedVersions,
      firstOriginalUrl,
    );
    setResumeVersionRows(versions);
    return versions;
  };

  const openReplaceCvPicker = () => {
    if (!canReplaceCv || replacingCv) return;
    cvUploadModeRef.current = 'replace';
    replaceCvInputRef.current?.click();
  };

  const openVersionCvPicker = () => {
    if (!canReplaceCv || replacingCv) return;
    cvUploadModeRef.current = 'version';
    replaceCvInputRef.current?.click();
  };

  const selectResumeVersion = (version: ResumeVersionRow) => {
    const url = String(version.fileUrl || '').trim();
    setSelectedVersionId(version.id);
    setForcedPreviewUrl(url || null);
    setViewMode('original');
    onPreferredResumeViewModeChange?.('original');
    setPreviewReloadKey((key) => key + 1);
  };

  const handleDeleteResumeVersion = async (version: ResumeVersionRow, index: number) => {
    if (!canReplaceCv || replacingCv || deletingVersionId) return;
    // Original CV (v1) cannot be deleted — use Replace CV instead.
    if (index === 0) {
      onToast?.('Original CV cannot be deleted. Use Replace CV instead.');
      return;
    }
    const label = `v${index + 1}`;
    const confirmed = await requestConfirm(
      `Delete ${label}? This removes that resume file from this candidate. This cannot be undone.`,
      {
        title: SYSTEM_ALERT_TITLE,
        tone: 'warning',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
      }
    );
    if (!confirmed) return;

    setDeletingVersionId(version.id);
    setCvUploadLabel(`Deleting ${label}…`);
    setReplacingCv(true);
    try {
      const realFileId =
        version.id &&
        version.id !== '__primary_resume__' &&
        !String(version.id).startsWith('stored-')
          ? version.id
          : null;
      const deleted = await apiDeleteCandidateResumeVersion(candidate.id, {
        fileId: realFileId,
        fileUrl: version.fileUrl,
      });
      const payload = (deleted?.data || deleted) as {
        extraData?: Record<string, unknown> | null;
        resume?: string | null;
        resumeUrl?: string | null;
        resumeVersions?: Array<{
          id?: string | null;
          fileUrl?: string | null;
          fileName?: string | null;
          uploadedAt?: string | null;
          isPrimary?: boolean;
        }> | null;
      };

      const refreshed = await refreshBackend();
      const extraFromDelete =
        payload?.extraData && typeof payload.extraData === 'object' && !Array.isArray(payload.extraData)
          ? (payload.extraData as Record<string, unknown>)
          : null;
      const extraFromRefresh =
        refreshed?.extraData && typeof refreshed.extraData === 'object' && !Array.isArray(refreshed.extraData)
          ? (refreshed.extraData as Record<string, unknown>)
          : null;
      const mergedExtra: Record<string, unknown> = {
        ...(extraFromRefresh || {}),
        ...(extraFromDelete || {}),
      };
      if (Array.isArray(payload?.resumeVersions)) {
        mergedExtra.resumeVersions = payload.resumeVersions;
      } else if (Array.isArray(mergedExtra.resumeVersions)) {
        const deletedKey = normalizeResumeCompareUrl(version.fileUrl);
        mergedExtra.resumeVersions = (
          mergedExtra.resumeVersions as Array<{ fileUrl?: string | null; id?: string | null }>
        ).filter((row) => {
          if (realFileId && String(row?.id || '').trim() === realFileId) return false;
          return normalizeResumeCompareUrl(String(row?.fileUrl || '')) !== deletedKey;
        });
      }

      const primaryAfter = String(
        payload?.resume ||
          payload?.resumeUrl ||
          refreshed?.resume ||
          refreshed?.resumeUrl ||
          mergedExtra.originalResumeUrl ||
          '',
      ).trim();

      const versions = await refreshResumeFiles(
        {
          url: primaryAfter || undefined,
          fileName: String(mergedExtra.originalResumeFileName || '').trim() || undefined,
        },
        mergedExtra,
      );

      const next =
        versions.find((row) => row.isPrimary) ||
        versions[0] ||
        null;
      setSelectedVersionId(next?.id || null);
      setForcedPreviewUrl(next?.fileUrl || null);
      setViewMode('original');
      onPreferredResumeViewModeChange?.('original');
      setPreviewReloadKey((key) => key + 1);
      await onCandidateUpdated?.();
      onToast?.(`${label} deleted.`);
    } catch (error) {
      onToast?.(error instanceof Error ? error.message : 'Failed to delete CV version');
    } finally {
      setDeletingVersionId(null);
      setReplacingCv(false);
    }
  };

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const uploadsBase = useMemo(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';
    return apiBase.replace(/\/api\/v1\/?$/, '');
  }, []);

  const saasaStored = useMemo(
    () => readSaasaCvAnnotations(backendCandidate?.extraData ?? candidate.extraData ?? null),
    [backendCandidate?.extraData, candidate.extraData]
  );

  const originalResumeRaw = useMemo(() => {
    const forced = String(forcedPreviewUrl || '').trim();
    if (forced) return forced;
    const selected = resumeVersionRows.find((row) => row.id === selectedVersionId);
    if (selected?.fileUrl) return selected.fileUrl;
    return (
      resolveCandidateResumeUrlFromSources(backendCandidate, { filesResumeUrl }) ||
      resolveCandidateResumeUrlFromSources(
        {
          resumeUrl: candidate.resumeUrl,
          resume: candidate.resumeUrl,
          extraData: candidate.extraData ?? null,
        },
        { filesResumeUrl },
      ) ||
      resumeHref ||
      ''
    );
  }, [
    forcedPreviewUrl,
    selectedVersionId,
    resumeVersionRows,
    backendCandidate,
    candidate.resumeUrl,
    candidate.extraData,
    filesResumeUrl,
    resumeHref,
  ]);

  const effectiveResumeHref = useMemo(() => {
    const raw = String(originalResumeRaw || '').trim();
    if (!raw) return '';
    if (isResumeHttpUrl(raw)) return normalizeResumeHref(raw);
    return buildFileHref(raw, uploadsBase);
  }, [originalResumeRaw, uploadsBase]);

  const handleReplaceCvSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    if (!file || !canReplaceCv || replacingCv) return;

    if (!isAllowedResumeFile(file)) {
      onToast?.('Please choose a PDF, DOC, or DOCX resume file.');
      return;
    }

    const asVersion = cvUploadModeRef.current === 'version';
    const hasExisting = Boolean(String(originalResumeRaw || effectiveResumeHref || '').trim());
    const confirmed = await requestConfirm(
      asVersion
        ? 'Add this file as another CV version? The Original CV (v1) stays. This becomes v2, v3, …'
        : hasExisting
          ? 'Replace the Original CV? The current original and any extra versions (v2, v3, …) will be removed. This file becomes the only Original CV (v1).'
          : 'Upload this file as the candidate’s Original CV? It will be used everywhere the resume is shown.',
      {
        title: SYSTEM_ALERT_TITLE,
        tone: 'warning',
        confirmLabel: asVersion ? 'Add version' : hasExisting ? 'Replace CV' : 'Upload CV',
        cancelLabel: 'Cancel',
      }
    );
    if (!confirmed) return;

    setCvUploadLabel(asVersion ? 'Uploading CV version…' : hasExisting ? 'Replacing CV…' : 'Uploading CV…');
    setReplacingCv(true);
    try {
      const uploaded = await apiUploadCandidateResumeFile(candidate.id, file, {
        replacePrimary: !asVersion,
      });
      const payload = (uploaded?.data || uploaded) as {
        resumeFileId?: string | null;
        resumeFileUrl?: string | null;
        resume?: string | null;
        resumeUrl?: string | null;
        extraData?: Record<string, unknown> | null;
        resumeVersions?: Array<{
          id?: string | null;
          fileUrl?: string | null;
          fileName?: string | null;
          uploadedAt?: string | null;
          isPrimary?: boolean;
        }> | null;
      };
      const newFileId = String(payload?.resumeFileId || '').trim();
      const newFileUrl = String(
        payload?.resumeFileUrl || payload?.resumeUrl || payload?.resume || '',
      ).trim();

      const refreshed = await refreshBackend();
      const extraFromUpload =
        payload?.extraData && typeof payload.extraData === 'object' && !Array.isArray(payload.extraData)
          ? (payload.extraData as Record<string, unknown>)
          : null;
      const extraFromRefresh =
        refreshed?.extraData && typeof refreshed.extraData === 'object' && !Array.isArray(refreshed.extraData)
          ? (refreshed.extraData as Record<string, unknown>)
          : null;
      const mergedExtra: Record<string, unknown> = {
        ...(extraFromRefresh || {}),
        ...(extraFromUpload || {}),
      };
      if (Array.isArray(payload?.resumeVersions) && payload.resumeVersions.length) {
        mergedExtra.resumeVersions = payload.resumeVersions;
      } else if (
        Array.isArray(extraFromUpload?.resumeVersions) &&
        (extraFromUpload.resumeVersions as unknown[]).length
      ) {
        mergedExtra.resumeVersions = extraFromUpload.resumeVersions;
      }

      if (!asVersion && newFileUrl) {
        // Replace must pin Original + history to the new file only (no ghost v2).
        mergedExtra.firstOriginalResumeUrl = newFileUrl;
        mergedExtra.firstOriginalResumeFileName = file.name;
        mergedExtra.originalResumeUrl = newFileUrl;
        mergedExtra.originalResumeFileName = file.name;
        if (Array.isArray(mergedExtra.resumeVersions)) {
          const key = normalizeResumeCompareUrl(newFileUrl);
          mergedExtra.resumeVersions = (
            mergedExtra.resumeVersions as Array<{ fileUrl?: string | null }>
          ).filter((row) => normalizeResumeCompareUrl(String(row?.fileUrl || '')) === key);
          if (!(mergedExtra.resumeVersions as unknown[]).length) {
            mergedExtra.resumeVersions = [
              {
                id: newFileId || null,
                fileUrl: newFileUrl,
                fileName: file.name,
                uploadedAt: null,
                isPrimary: true,
              },
            ];
          }
        } else {
          mergedExtra.resumeVersions = [
            {
              id: newFileId || null,
              fileUrl: newFileUrl,
              fileName: file.name,
              uploadedAt: null,
              isPrimary: true,
            },
          ];
        }
      }

      const primaryAfterUpload = asVersion
        ? String(
            refreshed?.resume ||
              refreshed?.resumeUrl ||
              candidate.resumeUrl ||
              mergedExtra.originalResumeUrl ||
              '',
          ).trim()
        : String(
            newFileUrl ||
              refreshed?.resume ||
              refreshed?.resumeUrl ||
              '',
          ).trim();
      const versions = await refreshResumeFiles(
        {
          url: primaryAfterUpload || undefined,
          fileName: asVersion
            ? String(mergedExtra.originalResumeFileName || file.name)
            : file.name,
        },
        mergedExtra,
      );

      // Prefer the newly uploaded file id; fall back to matching URL.
      let selectId = newFileId;
      let selectUrl = newFileUrl;
      if (!selectId && newFileUrl) {
        const match = versions.find(
          (row) => normalizeResumeCompareUrl(row.fileUrl) === normalizeResumeCompareUrl(newFileUrl),
        );
        selectId = match?.id || '';
        if (match?.fileUrl) selectUrl = match.fileUrl;
      }
      if (!selectId && versions.length) {
        if (asVersion) {
          // Newest version is last in oldest-first / original-first list.
          const newest = versions[versions.length - 1]!;
          selectId = newest.id;
          selectUrl = newest.fileUrl;
        } else {
          // Replace CV → show the new Original (v1).
          const original =
            versions.find((row) => row.isPrimary) ||
            versions[0]!;
          selectId = original.id;
          selectUrl = original.fileUrl;
        }
      }
      if (selectId) setSelectedVersionId(selectId);
      if (selectUrl) {
        setForcedPreviewUrl(selectUrl);
      }

      setViewMode('original');
      onPreferredResumeViewModeChange?.('original');
      setPreviewReloadKey((key) => key + 1);
      await onCandidateUpdated?.();
      // Keep spinner up briefly so the preview can remount with the new URL.
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      onToast?.(
        asVersion
          ? 'CV version added successfully.'
          : hasExisting
            ? 'CV replaced successfully.'
            : 'CV uploaded successfully.',
      );
    } catch (error) {
      onToast?.(
        error instanceof Error
          ? error.message
          : asVersion
            ? 'Failed to add CV version'
            : 'Failed to replace CV',
      );
    } finally {
      setReplacingCv(false);
      cvUploadModeRef.current = 'replace';
    }
  };

  const saasaPreviewRaw = useMemo(() => {
    const fromExtra = resolveSaasaCvPreviewUrl(
      backendCandidate?.extraData ?? candidate.extraData ?? null,
      candidateFiles
    );
    const fromStored = saasaStored?.fileUrl ?? null;
    const fromProp = saasaSavedFileUrl ?? null;
    return fromExtra || fromStored || fromProp || null;
  }, [
    backendCandidate?.extraData,
    candidate.extraData,
    candidateFiles,
    saasaStored?.fileUrl,
    saasaSavedFileUrl,
  ]);

  const effectiveSaasaPreviewHref = useMemo(() => {
    const raw = String(saasaPreviewRaw || saasaStored?.fileUrl || saasaSavedFileUrl || '').trim();
    if (!raw) return '';
    if (isResumeHttpUrl(raw)) return normalizeResumeHref(raw);
    return buildFileHref(raw, uploadsBase);
  }, [saasaPreviewRaw, saasaStored?.fileUrl, saasaSavedFileUrl, uploadsBase]);

  const saasaBaseResumeHref = useMemo(() => {
    const raw = resolveSaasaCvBaseResumeUrl({
      storedResumeUrl: saasaStored?.resumeUrl,
      originalResumeUrl: String(
        (backendCandidate?.extraData as Record<string, unknown> | null | undefined)?.originalResumeUrl ||
          (candidate.extraData as Record<string, unknown> | null | undefined)?.originalResumeUrl ||
          filesResumeUrl ||
          '',
      ),
      fallbackResumeUrl: effectiveResumeHref || filesResumeUrl,
      saasaFileUrl: saasaStored?.fileUrl || saasaSavedFileUrl || saasaPreviewRaw,
    });
    if (!raw) return '';
    if (isResumeHttpUrl(raw)) return normalizeResumeHref(raw);
    return buildFileHref(raw, uploadsBase);
  }, [
    saasaStored?.resumeUrl,
    saasaStored?.fileUrl,
    saasaSavedFileUrl,
    saasaPreviewRaw,
    backendCandidate?.extraData,
    candidate.extraData,
    effectiveResumeHref,
    filesResumeUrl,
    uploadsBase,
  ]);

  useEffect(() => {
    if (!enabled || !candidate.id) {
      setLoading(false);
      return;
    }
    setFilesResumeUrl(null);
    setCandidateFiles([]);

    const load = startAsyncLoad(setLoading);
    const run = async () => {
      try {
        const [filesRaw, refreshed] = await Promise.all([
          filesApiGet('candidate', candidate.id).catch(() => null),
          refreshBackend(),
        ]);
        if (!load.isActive()) return;
        const files = extractApiData(filesRaw) ?? [];
        setCandidateFiles(
          files.map((f) => ({
            id: f.id,
            fileUrl: f.fileUrl ?? null,
            fileType: f.fileType,
            fileName: f.fileName,
          }))
        );
        const latest = pickLatestResumeFileUrl(files);
        if (latest) setFilesResumeUrl(latest);

        const extraSource =
          (refreshed?.extraData &&
          typeof refreshed.extraData === 'object' &&
          !Array.isArray(refreshed.extraData)
            ? (refreshed.extraData as Record<string, unknown>)
            : null) ||
          (candidate.extraData &&
          typeof candidate.extraData === 'object' &&
          !Array.isArray(candidate.extraData)
            ? (candidate.extraData as Record<string, unknown>)
            : null);

        const primaryUrl = String(
          refreshed?.resume ||
            refreshed?.resumeUrl ||
            candidate.resumeUrl ||
            extraSource?.originalResumeUrl ||
            '',
        ).trim();
        const primaryFileName = String(extraSource?.originalResumeFileName || '').trim();
        const firstOriginalUrl = String(extraSource?.firstOriginalResumeUrl || '').trim();
        const storedVersions = Array.isArray(extraSource?.resumeVersions)
          ? (extraSource.resumeVersions as Array<{
              id?: string | null;
              fileUrl?: string | null;
              fileName?: string | null;
              uploadedAt?: string | null;
              isPrimary?: boolean;
            }>)
          : null;
        const versions = buildResumeVersionRows(
          files.map((f) => ({
            id: f.id,
            fileUrl: f.fileUrl,
            fileType: f.fileType,
            fileName: f.fileName,
            uploadDate: f.uploadDate,
            createdAt: (f as { createdAt?: string }).createdAt,
          })),
          primaryUrl,
          primaryFileName,
          storedVersions,
          firstOriginalUrl,
        );
        setResumeVersionRows(versions);

        // Keep selection on a real version URL; default to v1 (original).
        setSelectedVersionId((current) => {
          if (current && versions.some((row) => row.id === current)) return current;
          return versions[0]?.id || null;
        });
        setForcedPreviewUrl((current) => {
          const currentKey = normalizeResumeCompareUrl(String(current || ''));
          if (currentKey && versions.some((row) => normalizeResumeCompareUrl(row.fileUrl) === currentKey)) {
            return current;
          }
          return versions[0]?.fileUrl || null;
        });
      } finally {
        load.finish();
      }
    };

    void run();
    return () => {
      load.abort();
    };
  }, [enabled, candidate.id, refreshBackend]);

  useEffect(() => {
    if (!enabled || viewMode !== 'saasa' || !candidate.id) return;
    void (async () => {
      try {
        const filesRaw = await filesApiGet('candidate', candidate.id).catch(() => null);
        const files = extractApiData(filesRaw) ?? [];
        setCandidateFiles(
          files.map((f) => ({
            id: f.id,
            fileUrl: f.fileUrl ?? null,
            fileType: f.fileType,
            fileName: f.fileName,
          }))
        );
        await refreshBackend();
      } catch {
        /* ignore */
      }
    })();
  }, [enabled, viewMode, candidate.id, refreshBackend]);

  const availableModes = useMemo(
    () => listAvailableResumeCvModes(resumeSourceCandidate, originalResumeRaw || resumeHref),
    [resumeSourceCandidate, originalResumeRaw, resumeHref],
  );

  const lastAppliedPreferredRef = useRef<ResumeCvViewMode | null>(null);

  // Apply preferred mode once when it changes (e.g. after HRYantra save) — not on every refresh.
  useEffect(() => {
    if (!preferredResumeViewMode) {
      lastAppliedPreferredRef.current = null;
      return;
    }
    if (!availableModes.includes(preferredResumeViewMode)) return;
    if (lastAppliedPreferredRef.current === preferredResumeViewMode) return;
    lastAppliedPreferredRef.current = preferredResumeViewMode;
    setViewMode(preferredResumeViewMode);
  }, [preferredResumeViewMode, availableModes.join(',')]);

  useEffect(() => {
    setViewMode((current) => {
      if (current && availableModes.includes(current)) return current;
      return resolveDefaultResumeCvViewMode(
        resumeSourceCandidate,
        originalResumeRaw || resumeHref,
      );
    });
  }, [
    resumeSourceCandidate,
    originalResumeRaw,
    resumeHref,
    availableModes.join(','),
  ]);

  const selectViewMode = (mode: ResumeCvViewMode) => {
    lastAppliedPreferredRef.current = mode;
    setViewMode(mode);
    onPreferredResumeViewModeChange?.(mode);
  };

  const buildResumeFilename = (sourceUrl: string, label: string) => {
    const ext = getResumeExtension(sourceUrl);
    const base = String(candidate.name || 'candidate').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'candidate';
    return ext ? `${base}-${label}.${ext}` : `${base}-${label}.pdf`;
  };

  const handleDownloadResume = async () => {
    const source = originalResumeRaw || effectiveResumeHref;
    if (!source || downloadingResume) return;
    setDownloadingResume(true);
    try {
      await triggerFileDownload(source, {
        uploadsBase,
        filename: buildResumeFilename(source, 'resume'),
      });
    } catch (error) {
      onToast?.(error instanceof Error ? error.message : 'Failed to download resume');
    } finally {
      setDownloadingResume(false);
    }
  };

  const handleDownloadUpdatedText = () => {
    if (!structuredCvData || downloadingUpdated) return;
    setDownloadingUpdated(true);
    try {
      downloadCvEditorPlainText(structuredCvData, candidate.name);
    } catch (error) {
      onToast?.(error instanceof Error ? error.message : 'Failed to download updated CV');
    } finally {
      setDownloadingUpdated(false);
    }
  };

  const handleExportUpdatedPdf = () => {
    if (!structuredCvData || exportingUpdatedPdf) return;
    setExportingUpdatedPdf(true);
    try {
      printCvEditorAsPdf(structuredCvData, candidate.name);
    } catch (error) {
      onToast?.(error instanceof Error ? error.message : 'Failed to export updated CV as PDF');
    } finally {
      window.setTimeout(() => setExportingUpdatedPdf(false), 600);
    }
  };

  const handleDownloadSaasaCv = async () => {
    if (downloadingSaasa) return;
    setDownloadingSaasa(true);
    try {
      const filename =
        candidateFiles.find((file) => file.fileUrl && file.fileUrl === (saasaStored?.fileUrl || ''))
          ?.fileName ||
        saasaStored?.fileName ||
        buildResumeFilename(
          saasaPreviewRaw || saasaStored?.fileUrl || saasaSavedFileUrl || effectiveSaasaPreviewHref || 'hryantra-cv.pdf',
          'saasa-cv',
        );

      const baseResume = saasaBaseResumeHref || effectiveResumeHref;
      if (!baseResume) throw new Error('No original resume found to rebuild HRYantra CV');

      const { exportSaasaCvFromStoredData, withExportTimeout } = await import(
        '../../lib/saasaCvExport'
      );
      const extra = backendCandidate?.extraData ?? candidate.extraData ?? null;
      const { readSaasaCvCompanyLogo } = await import('../../lib/saasaCvAnnotations');
      const blob = await withExportTimeout(
        exportSaasaCvFromStoredData({
          resumeUrl: baseResume,
          annotations: saasaStored?.items ?? [],
          companyLogo:
            saasaStored?.companyLogo ?? readSaasaCvCompanyLogo(extra) ?? null,
          pdfTextLayerHtml: saasaStored?.pdfTextLayerHtml ?? null,
          width: 800,
        }),
        60000,
        'HRYantra CV download',
      );
      if (!blob || blob.size < 5000) {
        throw new Error(
          'Could not build HRYantra CV PDF. Open Edit HRYantra CV, wait for the CV to load, Save, then download again.',
        );
      }
      await triggerBlobDownload(blob, filename.endsWith('.pdf') ? filename : `${filename}.pdf`, {
        skipWatermark: true,
      });
    } catch (error) {
      onToast?.(error instanceof Error ? error.message : 'Failed to download HRYantra CV');
    } finally {
      setDownloadingSaasa(false);
    }
  };

  const showOriginalPreview = viewMode === 'original' && Boolean(effectiveResumeHref);
  /**
   * When scribbles / logo / text edits exist, preview the same live composite as Edit
   * so every teammate sees marks — not only the person who saved (or Super Admin).
   * Fall back to the exported snapshot file when there are no live overlays.
   */
  const hasLiveSaasaOverlays = Boolean(
    (saasaStored?.items && saasaStored.items.length > 0) ||
      saasaStored?.companyLogo?.url ||
      hasSaasaCvDocumentTextEdits(saasaStored),
  );
  const showSaasaComposite =
    viewMode === 'saasa' && Boolean(saasaBaseResumeHref) && hasLiveSaasaOverlays;
  const showSaasaSavedFile =
    viewMode === 'saasa' && !showSaasaComposite && Boolean(effectiveSaasaPreviewHref);
  const showSaasaEmpty =
    viewMode === 'saasa' &&
    !showSaasaComposite &&
    !effectiveSaasaPreviewHref &&
    Boolean(onOpenSaasaCv);
  const portalTailoredCvHtml = useMemo(
    () => readPortalTailoredCvHtml(resumeSourceCandidate),
    [resumeSourceCandidate],
  );
  const portalStudioTemplateId = useMemo(
    () => readPortalStudioTemplateId(resumeSourceCandidate),
    [resumeSourceCandidate],
  );
  const showAiCvPreview = viewMode === 'ai' && hasPortalAiCv(resumeSourceCandidate);
  const showPortalStudioPreview = showAiCvPreview && Boolean(portalTailoredCvHtml);
  const showStructuredPreview =
    viewMode === 'updated' && hasResumeTabUpdatedCv(resumeSourceCandidate);

  const showOriginalToolbar = viewMode === 'original' && Boolean(effectiveResumeHref);
  const showSaasaToolbar = viewMode === 'saasa' && Boolean(saasaBaseResumeHref || effectiveSaasaPreviewHref);
  const showStructuredToolbar = viewMode === 'updated' && showStructuredPreview;
  const showReplaceCvAction =
    canReplaceCv && (viewMode === 'original' || viewMode === null || !availableModes.length);
  const showResumeToolbar =
    availableModes.length > 0 ||
    showOriginalToolbar ||
    showSaasaToolbar ||
    showStructuredToolbar ||
    showReplaceCvAction;

  const structuredCvPreviewKey = useMemo(() => {
    const layout = readCvEditorLayout(resumeSourceCandidate);
    const extra = resumeSourceCandidate?.extraData;
    const savedAt =
      extra && typeof extra === 'object' && !Array.isArray(extra)
        ? String((extra as Record<string, unknown>).cvEditorContentSavedAt || '')
        : '';
    return [
      resumeSourceCandidate?.id,
      layout?.updatedAt,
      savedAt,
      structuredCvData?.name,
      structuredCvData?.candidatePhotoUrl,
      structuredCvData?.companyLogoUrl,
      structuredCvData?.summary,
      structuredCvData?.experiences?.map((e) => `${e.role}|${e.company}|${e.desc}`).join(';'),
      structuredCvData?.education?.map((e) => `${e.degree}|${e.school}`).join(';'),
      structuredCvData?.skills?.join(','),
    ].join('|');
  }, [resumeSourceCandidate, structuredCvData]);

  return (
    <>
      <input
        ref={replaceCvInputRef}
        type="file"
        accept={RESUME_FILE_ACCEPT}
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(event) => void handleReplaceCvSelected(event)}
      />
      <div className="flex h-[calc(100vh-18rem)] min-h-[560px] flex-col">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          {showResumeToolbar ? (
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {availableModes.length > 0 ? (
                  <div
                    className="flex min-w-0 flex-wrap items-center gap-2"
                    role="tablist"
                    aria-label="Resume version"
                  >
                    {availableModes.map((mode) => {
                      const active = viewMode === mode;
                      const deletable = mode === 'updated' && canDeleteUpdatedCv;
                      return (
                        <div
                          key={mode}
                          className={`inline-flex items-stretch overflow-hidden rounded-full text-sm font-semibold transition-colors ${
                            active
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'border border-slate-200 bg-white text-slate-700'
                          }`}
                        >
                          <button
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => selectViewMode(mode)}
                            disabled={busy || replacingCv}
                            className={`px-4 py-2 transition-colors disabled:opacity-60 ${
                              active ? '' : 'hover:bg-slate-50'
                            }`}
                          >
                            {MODE_LABELS[mode]}
                          </button>
                          {deletable ? (
                            <button
                              type="button"
                              title={`Delete ${MODE_LABELS[mode]}`}
                              aria-label={`Delete ${MODE_LABELS[mode]}`}
                              disabled={busy || replacingCv}
                              onClick={() => void handleDeleteUpdatedCv()}
                              className={`inline-flex items-center border-l px-2.5 py-2 transition-colors disabled:opacity-60 ${
                                active
                                  ? 'border-blue-500 hover:bg-blue-700'
                                  : 'border-slate-200 hover:bg-red-50 hover:text-red-700'
                              }`}
                            >
                              {busy && active ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Trash2 size={14} />
                              )}
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {viewMode === 'original' && resumeVersionRows.length > 0
                  ? resumeVersionRows.map((version, index) => {
                      const active =
                        selectedVersionId === version.id ||
                        (!selectedVersionId &&
                          !forcedPreviewUrl &&
                          (version.isPrimary || index === 0)) ||
                        (forcedPreviewUrl &&
                          normalizeResumeCompareUrl(forcedPreviewUrl) ===
                            normalizeResumeCompareUrl(version.fileUrl));
                      const label = `v${index + 1}`;
                      const deleting = deletingVersionId === version.id;
                      return (
                        <div
                          key={version.id}
                          className={`inline-flex max-w-[240px] items-center overflow-hidden rounded-full text-xs font-semibold ${
                            active
                              ? 'bg-slate-900 text-white'
                              : 'border border-slate-200 bg-white text-slate-700'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => selectResumeVersion(version)}
                            disabled={replacingCv || Boolean(deletingVersionId)}
                            className={`inline-flex min-w-0 items-center gap-1.5 px-3 py-1.5 transition-colors disabled:opacity-60 ${
                              active ? '' : 'hover:bg-slate-50'
                            }`}
                            title={version.fileName}
                          >
                            <span>{label}</span>
                            {index === 0 ? (
                              <span className={active ? 'text-slate-300' : 'text-slate-400'}>
                                · original
                              </span>
                            ) : null}
                          </button>
                          {canReplaceCv && index > 0 ? (
                            <button
                              type="button"
                              title={`Delete ${label}`}
                              aria-label={`Delete ${label}`}
                              disabled={replacingCv || Boolean(deletingVersionId)}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void handleDeleteResumeVersion(version, index);
                              }}
                              className={`inline-flex items-center border-l px-2 py-1.5 transition-colors disabled:opacity-60 ${
                                active
                                  ? 'border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                                  : 'border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-700'
                              }`}
                            >
                              {deleting ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Trash2 size={12} />
                              )}
                            </button>
                          ) : null}
                        </div>
                      );
                    })
                  : null}
              </div>

              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                {showOriginalToolbar || showReplaceCvAction ? (
                  <>
                    {showOriginalToolbar ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setResumePreviewOpen(true)}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Eye size={16} />
                          Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDownloadResume()}
                          disabled={downloadingResume}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          {downloadingResume ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                          Download
                        </button>
                      </>
                    ) : null}
                    {showReplaceCvAction ? (
                      <>
                        <button
                          type="button"
                          onClick={openReplaceCvPicker}
                          disabled={replacingCv}
                          className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                        >
                          {replacingCv && cvUploadModeRef.current === 'replace' ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : effectiveResumeHref ? (
                            <RefreshCw size={16} />
                          ) : (
                            <Upload size={16} />
                          )}
                          {effectiveResumeHref ? 'Replace CV' : 'Upload CV'}
                        </button>
                        {effectiveResumeHref ? (
                          <button
                            type="button"
                            onClick={openVersionCvPicker}
                            disabled={replacingCv}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                          >
                            {replacingCv && cvUploadModeRef.current === 'version' ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Upload size={16} />
                            )}
                            Upload another version
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </>
                ) : showSaasaToolbar ? (
                  <>
                    {onOpenSaasaCv ? (
                      <button
                        type="button"
                        onClick={onOpenSaasaCv}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil size={16} />
                        Edit HRYantra CV
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setSaasaPreviewOpen(true)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Eye size={16} />
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDownloadSaasaCv()}
                      disabled={downloadingSaasa}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {downloadingSaasa ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                      Download
                    </button>
                  </>
                ) : showStructuredToolbar ? (
                  <>
                    {canDeleteUpdatedCv ? (
                      <button
                        type="button"
                        onClick={() => void handleDeleteUpdatedCv()}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        Delete
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={openStructuredPreview}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Eye size={16} />
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadUpdatedText}
                      disabled={downloadingUpdated}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {downloadingUpdated ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Download size={16} />
                      )}
                      TXT
                    </button>
                    <button
                      type="button"
                      onClick={handleExportUpdatedPdf}
                      disabled={exportingUpdatedPdf}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {exportingUpdatedPdf ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Download size={16} />
                      )}
                      PDF
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="relative min-h-0 flex-1 overflow-hidden">
            {replacingCv ? (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-white/80 backdrop-blur-[1px]">
                <Loader2 className="size-8 animate-spin text-blue-600" />
                <p className="text-sm font-medium text-slate-700">{cvUploadLabel}</p>
                <p className="text-xs text-slate-500">Please wait until the resume preview updates.</p>
              </div>
            ) : null}
            {loading && !backendCandidate ? (
              <div className="flex h-full min-h-[320px] items-center justify-center">
                <Loader2 className="size-8 animate-spin text-blue-600" />
              </div>
            ) : showOriginalPreview ? (
              <ResumeInlinePreview
                key={`original-${previewReloadKey}-${selectedVersionId || 'primary'}-${effectiveResumeHref}`}
                resumeUrl={effectiveResumeHref}
                candidateName={candidate.name}
                enabled={enabled && viewMode === 'original' && !replacingCv}
                minHeightClass="h-full min-h-0"
                className="h-full"
              />
            ) : showSaasaComposite && saasaBaseResumeHref ? (
              <SaasaCvCompositePreview
                key={`saasa-live-${saasaStored?.updatedAt ?? ''}-${saasaStored?.items?.length ?? 0}-${saasaBaseResumeHref}`}
                baseResumeUrl={saasaBaseResumeHref}
                annotations={saasaStored?.items ?? []}
                companyLogo={saasaStored?.companyLogo ?? null}
                documentHtml={saasaStored?.documentHtml ?? null}
                pdfTextLayerHtml={saasaStored?.pdfTextLayerHtml ?? null}
                candidateName={candidate.name}
                enabled={enabled && viewMode === 'saasa'}
                minHeightClass="h-full min-h-0"
                className="h-full"
              />
            ) : showSaasaSavedFile ? (
              <SaasaCvSavedPreview
                fileUrl={effectiveSaasaPreviewHref}
                cacheKey={saasaStored?.updatedAt ?? saasaStored?.fileId ?? null}
                candidateName={candidate.name}
                enabled={enabled && viewMode === 'saasa'}
                minHeightClass="h-full min-h-0"
                className="h-full"
                preferNativePdfEmbed
              />
            ) : showSaasaEmpty ? (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
                <p className="text-sm text-slate-600">No HRYantra CV saved yet.</p>
                <button
                  type="button"
                  onClick={onOpenSaasaCv}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <Pencil size={16} />
                  Create HRYantra CV
                </button>
              </div>
            ) : showPortalStudioPreview && portalTailoredCvHtml ? (
              <PortalTailoredCvStudioPreview
                html={portalTailoredCvHtml}
                templateId={portalStudioTemplateId}
                className="h-full"
              />
            ) : showAiCvPreview && structuredCvData ? (
              <div className="h-full min-h-0 overflow-auto bg-slate-200/80 p-3 sm:p-4">
                <CVEditorModal
                  key={`ai-${structuredCvPreviewKey}`}
                  initialData={structuredCvData}
                  readOnly
                  embedded
                />
              </div>
            ) : showStructuredPreview && structuredCvData ? (
              <div className="h-full min-h-0 overflow-auto bg-slate-200/80 p-3 sm:p-4">
                <CVEditorModal
                  key={structuredCvPreviewKey}
                  initialData={structuredCvData}
                  readOnly
                  embedded
                />
              </div>
            ) : (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
                <p className="text-sm text-slate-500">No resume available for this candidate.</p>
                {canReplaceCv ? (
                  <button
                    type="button"
                    onClick={openReplaceCvPicker}
                    disabled={replacingCv || busy}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {replacingCv ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    Upload CV
                  </button>
                ) : canEdit ? (
                  <p className="mt-2 text-xs text-slate-400">
                    Upload a resume from <span className="font-medium text-slate-600">Edit Candidate</span> to
                    create one.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </section>
      </div>

      <ResumePreviewModal
        isOpen={resumePreviewOpen}
        onClose={() => setResumePreviewOpen(false)}
        resumeUrl={effectiveResumeHref || null}
        candidateName={candidate.name}
      />

      {portalReady && saasaPreviewOpen && (effectiveSaasaPreviewHref || saasaBaseResumeHref)
        ? createPortal(
            <div className="fixed inset-0 z-[220] flex flex-col bg-slate-950/60 p-2 sm:p-4">
              <div className="mx-auto flex h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] max-w-[min(96vw,1400px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:h-[calc(100vh-2rem)] sm:w-[calc(100vw-2rem)]">
                <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
                  <h3 className="text-base font-semibold text-slate-900">{candidate.name} — HRYantra CV</h3>
                  <button
                    type="button"
                    onClick={() => setSaasaPreviewOpen(false)}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Close
                  </button>
                </div>
                <div className="min-h-0 flex-1">
                  {showSaasaComposite && saasaBaseResumeHref ? (
                    <SaasaCvCompositePreview
                      key={`saasa-preview-modal-${saasaStored?.updatedAt ?? ''}-${saasaStored?.items?.length ?? 0}`}
                      baseResumeUrl={saasaBaseResumeHref}
                      annotations={saasaStored?.items ?? []}
                      companyLogo={saasaStored?.companyLogo ?? null}
                      documentHtml={saasaStored?.documentHtml ?? null}
                      pdfTextLayerHtml={saasaStored?.pdfTextLayerHtml ?? null}
                      candidateName={candidate.name}
                      enabled={saasaPreviewOpen}
                      minHeightClass="h-full min-h-0"
                      className="h-full"
                    />
                  ) : effectiveSaasaPreviewHref ? (
                    <SaasaCvSavedPreview
                      fileUrl={effectiveSaasaPreviewHref}
                      cacheKey={saasaStored?.updatedAt ?? saasaStored?.fileId ?? null}
                      candidateName={candidate.name}
                      enabled={saasaPreviewOpen}
                      minHeightClass="h-full min-h-0"
                      className="h-full"
                    />
                  ) : null}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
