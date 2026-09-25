'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  apiGetCandidate,
  apiUpdateCandidate,
  filesApiDelete,
  filesApiGet,
  filesApiUpload,
  type BackendCandidate,
} from '../lib/api';
import { extractApiData } from '../lib/mapCandidateProfile';
import {
  enrichBackendCandidateFromPhase1Snapshot,
  pickLatestResumeFileUrl,
  resolveCandidateResumeUrlFromSources,
} from '../lib/phase1ProfileSnapshot';
import {
  buildSaasaCvSaveExtra,
  dataUrlToFile,
  type ResumeCvViewMode,
} from '../lib/cvEditorMapping';
import {
  normalizeSaasaCvCompanyLogo,
  readSaasaCvAnnotations,
  readSaasaCvCompanyLogo,
  SAASA_CV_FILE_TYPE,
  type SaasaCvAnnotation,
  type SaasaCvCompanyLogo,
} from '../lib/saasaCvAnnotations';
import { compositeCompanyLogoOnCanvas } from '../lib/saasaCvPaintCanvas';
import { exportPaintLayerPdf } from '../lib/saasaCvExport';
import { SaasaCvAnnotationModal } from '../components/candidates/SaasaCvAnnotationModal';
import { isWordResume } from '../lib/resumePreview';

function normalizeUrl(url: string): string {
  return String(url || '')
    .trim()
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

interface UseSaasaCvAnnotationsOptions {
  candidateId?: string | null;
  candidateName?: string;
  resumeUrl?: string | null;
  extraData?: Record<string, unknown> | null;
  enabled?: boolean;
  canEdit?: boolean;
  onCandidateUpdated?: () => void | Promise<void>;
  onFilesRefresh?: () => void | Promise<void>;
  onToast?: (message: string) => void;
  /** Switch Resume tab to HRYantra CV after save (Updated CV tab stays available). */
  onViewModeChange?: (mode: ResumeCvViewMode | null) => void;
}

function hasPaintMarks(items: SaasaCvAnnotation[]): boolean {
  return items.some((a) => a.type === 'draw' || a.type === 'highlight');
}

export function useSaasaCvAnnotations({
  candidateId,
  candidateName = 'Candidate',
  resumeUrl,
  extraData,
  enabled = true,
  canEdit = true,
  onCandidateUpdated,
  onFilesRefresh,
  onToast,
  onViewModeChange,
}: UseSaasaCvAnnotationsOptions) {
  const [open, setOpen] = useState(false);
  const [backendCandidate, setBackendCandidate] = useState<BackendCandidate | null>(null);
  const [busy, setBusy] = useState(false);
  const [resolvedResumeUrl, setResolvedResumeUrl] = useState<string | null>(null);
  const [preferredResumeViewMode, setPreferredResumeViewMode] =
    useState<ResumeCvViewMode | null>(null);

  const stored = useMemo(() => {
    const fromBackend = readSaasaCvAnnotations(backendCandidate?.extraData ?? null);
    const fromDrawer = readSaasaCvAnnotations(extraData ?? null);
    if (fromBackend && fromDrawer) {
      const tb = Date.parse(fromBackend.updatedAt || '') || 0;
      const td = Date.parse(fromDrawer.updatedAt || '') || 0;
      return tb >= td ? fromBackend : fromDrawer;
    }
    return fromBackend ?? fromDrawer;
  }, [extraData, backendCandidate?.extraData]);

  const savedHryantraDocx = useMemo(() => {
    const fileUrl = String(stored?.fileUrl || '').trim();
    if (/\.docx(?:$|\?)/i.test(fileUrl)) return fileUrl;
    return '';
  }, [stored?.fileUrl]);

  const effectiveResumeUrl =
    savedHryantraDocx || resolvedResumeUrl?.trim() || resumeUrl?.trim() || null;

  const initialCompanyLogo = useMemo(
    () =>
      stored?.companyLogo ??
      readSaasaCvCompanyLogo(backendCandidate?.extraData ?? extraData ?? null) ??
      null,
    [backendCandidate?.extraData, extraData, stored?.companyLogo]
  );

  const openModal = useCallback(() => {
    if (!effectiveResumeUrl) {
      onToast?.('No original resume on file for this candidate.');
      return;
    }
    setOpen(true);
  }, [effectiveResumeUrl, onToast]);

  const closeModal = useCallback(() => setOpen(false), []);

  const resolveFreshExtraForSave = useCallback(async (): Promise<{
    extra: Record<string, unknown>;
    resume: string;
    resumeUrl: string;
  }> => {
    if (!candidateId) return { extra: {}, resume: '', resumeUrl: '' };
    try {
      const raw = await apiGetCandidate(candidateId);
      const fetched = enrichBackendCandidateFromPhase1Snapshot(
        extractApiData<BackendCandidate>(raw) ?? ({} as BackendCandidate)
      );
      if (fetched?.id) setBackendCandidate(fetched);
      const extra = fetched?.extraData;
      return {
        extra:
          extra && typeof extra === 'object' && !Array.isArray(extra)
            ? (extra as Record<string, unknown>)
            : {},
        resume: String(fetched?.resume || '').trim(),
        resumeUrl: String(fetched?.resumeUrl || '').trim(),
      };
    } catch {
      const fallback =
        (backendCandidate?.extraData as Record<string, unknown> | undefined) ??
        (extraData && typeof extraData === 'object' && !Array.isArray(extraData) ? extraData : {});
      return {
        extra: fallback,
        resume: String(backendCandidate?.resume || '').trim(),
        resumeUrl: String(backendCandidate?.resumeUrl || resumeUrl || '').trim(),
      };
    }
  }, [candidateId, backendCandidate?.extraData, backendCandidate?.resume, backendCandidate?.resumeUrl, extraData, resumeUrl]);

  const resolveCompanyLogoForSave = useCallback(
    async (
      logo: SaasaCvCompanyLogo | null,
      prevUrl: string | null | undefined
    ): Promise<SaasaCvCompanyLogo | null> => {
      if (!logo?.url?.trim() || !candidateId) return null;
      const cur = logo.url.trim();
      const init = (prevUrl || '').trim();
      if (!cur && init) return null;
      if (cur.startsWith('data:')) {
        const file = dataUrlToFile(cur, 'saasa-company-logo.png');
        if (!file) throw new Error('Invalid company logo image');
        const raw = await filesApiUpload('candidate', candidateId, file, 'Other');
        const uploaded = extractApiData<{ fileUrl?: string | null }>(raw);
        const url = (uploaded?.fileUrl || '').trim();
        if (!url) throw new Error('Company logo upload failed');
        return { ...logo, url };
      }
      if (cur.startsWith('http')) return logo;
      return normalizeSaasaCvCompanyLogo(logo);
    },
    [candidateId]
  );

  const saveAnnotations = useCallback(
    async (
      items: SaasaCvAnnotation[],
      exportPayload: Blob | HTMLCanvasElement | null,
      companyLogo: SaasaCvCompanyLogo | null,
      fullSnapshot = false,
      documentEdits?: {
        documentHtml?: string | null;
        pdfTextLayerHtml?: string[] | null;
        wordTextReplacements?: { from: string; to: string }[] | null;
        wordDocxBase64?: string | null;
        wordDocument?: boolean;
      }
    ) => {
      if (!candidateId || !canEdit) {
        onToast?.('You cannot save annotations for this candidate.');
        return false;
      }
      setBusy(true);
      try {
        const freshPromise = resolveFreshExtraForSave();

        const wordReplacements = (documentEdits?.wordTextReplacements || []).filter(
          (item) => item.from.trim() && item.from !== item.to
        );
        const wordDocxBase64 = String(documentEdits?.wordDocxBase64 || '').trim();
        let editedWordUrl: string | null = null;
        const fresh = await freshPromise;
        const existingExtra = fresh.extra;
        const prevStored = readSaasaCvAnnotations(existingExtra);
        let fileId = prevStored?.fileId;
        let fileUrl = prevStored?.fileUrl ?? null;
        let fileName = prevStored?.fileName;
        const uploadEditedWord = async (editedBlob: Blob) => {
          const safeWordName =
            (candidateName || 'Candidate').replace(/[^\w\s-]/g, '').trim() || 'Candidate';
          const wordFile = new File([editedBlob], `HRYantra CV - ${safeWordName}.docx`, {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          });
          const wordUpload = await filesApiUpload(
            'candidate',
            candidateId,
            wordFile,
            SAASA_CV_FILE_TYPE
          );
          const wordUploaded = extractApiData<{
            id?: string;
            fileUrl?: string | null;
            fileName?: string;
          }>(wordUpload);
          const nextWordUrl = (wordUploaded?.fileUrl || '').trim();
          if (!nextWordUrl) throw new Error('Updated Word file did not upload');
          const previousFileId = fileId;
          if (wordUploaded?.id) {
            fileId = wordUploaded.id;
            fileUrl = nextWordUrl;
            fileName = wordUploaded.fileName || wordFile.name;
          } else {
            fileUrl = nextWordUrl;
            fileName = wordFile.name;
          }
          editedWordUrl = nextWordUrl;
          setResolvedResumeUrl(nextWordUrl);
          if (previousFileId && previousFileId !== fileId) {
            try {
              await filesApiDelete('candidate', candidateId, previousFileId);
            } catch {
              /* replace the previous HRYantra file */
            }
          }
        };
        if (wordDocxBase64 && isWordResume(effectiveResumeUrl)) {
          const binary = atob(wordDocxBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
          await uploadEditedWord(
            new Blob([bytes], {
              type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            })
          );
        } else if (wordReplacements.length && isWordResume(effectiveResumeUrl)) {
          const editRes = await fetch('/api/resume-word-edit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: effectiveResumeUrl,
              replacements: wordReplacements,
            }),
          });
          if (!editRes.ok) {
            const detail = (await editRes.text()).slice(0, 240).trim();
            let message = 'Could not update the Word document';
            try {
              const parsed = JSON.parse(detail) as { error?: string };
              if (parsed.error) message = parsed.error;
            } catch {
              if (detail) message = detail;
            }
            throw new Error(message);
          }
          await uploadEditedWord(await editRes.blob());
        }

        const paintMarks = hasPaintMarks(items);
        const hasPins = items.some((a) => a.type === 'comment' || a.type === 'important');
        const hasTextEdits = Boolean(
          documentEdits?.documentHtml?.trim() ||
            documentEdits?.pdfTextLayerHtml?.some((h) => h.trim())
        );
        const resolvedLogo = await resolveCompanyLogoForSave(
          companyLogo,
          prevStored?.companyLogo?.url
        );

        const shouldUploadSnapshot =
          Boolean(exportPayload) &&
          (fullSnapshot || paintMarks || resolvedLogo?.url || hasPins || hasTextEdits);

        let savedFullSnapshot = fullSnapshot;
        let savedSnapshotFormat: 'pdf' | 'png' | undefined;
        let uploadWarning: string | null = null;

        // Keep previous file if this save cannot produce a new snapshot.
        // Never delete the existing file just because export failed — that wiped marks + CV.
        if (shouldUploadSnapshot && exportPayload) {
          let blob: Blob | null = null;
          if (exportPayload instanceof Blob) {
            blob = exportPayload;
          } else if (exportPayload instanceof HTMLCanvasElement) {
            if (!fullSnapshot) {
              if (resolvedLogo?.url) {
                await compositeCompanyLogoOnCanvas(exportPayload, resolvedLogo);
              }
              blob = await exportPaintLayerPdf(exportPayload);
              savedFullSnapshot = false;
            }
          }

          if (blob && blob.size >= 5000) {
            savedSnapshotFormat =
              blob.type === 'application/pdf' || blob.type.includes('pdf') ? 'pdf' : 'png';
            try {
              if (fileId) {
                try {
                  await filesApiDelete('candidate', candidateId, fileId);
                } catch {
                  /* replace previous export */
                }
              }
              const safeName =
                (candidateName || 'Candidate').replace(/[^\w\s-]/g, '').trim() || 'Candidate';
              const isPdf = blob.type === 'application/pdf' || blob.type.includes('pdf');
              const file = new File(
                [blob],
                `HRYantra CV - ${safeName}.${isPdf ? 'pdf' : 'png'}`,
                { type: isPdf ? 'application/pdf' : 'image/png' }
              );
              const uploadRes = await filesApiUpload(
                'candidate',
                candidateId,
                file,
                SAASA_CV_FILE_TYPE
              );
              const uploaded = extractApiData<{
                id?: string;
                fileUrl?: string | null;
                fileName?: string;
              }>(uploadRes);
              if (uploaded?.id) {
                fileId = uploaded.id;
                fileUrl = uploaded.fileUrl ?? null;
                fileName = uploaded.fileName || file.name;
              }
            } catch (uploadErr: unknown) {
              uploadWarning =
                uploadErr instanceof Error
                  ? uploadErr.message
                  : 'Could not upload HRYantra CV PDF file.';
              // Keep previous fileId/fileUrl — annotations still save below.
            }
          } else if (exportPayload) {
            uploadWarning =
              'CV PDF export looked empty — marks and text edits were still saved. Try Save again after the CV finishes loading.';
          }
        }

        const pinnedOriginal = String(
          existingExtra.firstOriginalResumeUrl || existingExtra.originalResumeUrl || ''
        ).trim();
        let safeResumeUrl = String(prevStored?.resumeUrl || effectiveResumeUrl || '').trim();
        if (
          editedWordUrl &&
          safeResumeUrl &&
          normalizeUrl(safeResumeUrl) === normalizeUrl(editedWordUrl)
        ) {
          safeResumeUrl = pinnedOriginal;
        }
        if (fileUrl && safeResumeUrl && normalizeUrl(safeResumeUrl) === normalizeUrl(fileUrl)) {
          safeResumeUrl = pinnedOriginal || String(prevStored?.resumeUrl || '').trim();
        }
        if (fileUrl && safeResumeUrl && normalizeUrl(safeResumeUrl) === normalizeUrl(fileUrl)) {
          safeResumeUrl = '';
        }
        if (!safeResumeUrl) safeResumeUrl = pinnedOriginal || String(resumeUrl || '').trim();

        // Always persist scribbles + text edits — even when PDF upload failed.
        const nextExtra = buildSaasaCvSaveExtra(
          existingExtra,
          {
            resumeUrl: safeResumeUrl || pinnedOriginal,
            items,
            companyLogo: resolvedLogo,
            fileId,
            fileUrl,
            fileName,
            fullSnapshot: fileUrl ? savedFullSnapshot : false,
            snapshotFormat: fileUrl ? savedSnapshotFormat : undefined,
            documentHtml:
              editedWordUrl || documentEdits?.wordDocument
                ? null
                : documentEdits?.pdfTextLayerHtml?.some((h) => h.trim())
                  ? null
                  : (documentEdits?.documentHtml ?? prevStored?.documentHtml ?? null),
            pdfTextLayerHtml:
              editedWordUrl || documentEdits?.wordDocument
                ? null
                : (documentEdits?.pdfTextLayerHtml ?? prevStored?.pdfTextLayerHtml ?? null),
          },
          editedWordUrl || fileUrl || items.length > 0 || resolvedLogo?.url || hasTextEdits
            ? { resumeCvViewMode: 'saasa' }
            : undefined
        );
        const dropKeys = new Set<string>();
        const rememberDrop = (url: string) => {
          const key = normalizeUrl(url);
          const originalKey = normalizeUrl(pinnedOriginal);
          if (!key || (originalKey && key === originalKey)) return;
          dropKeys.add(key);
        };
        if (editedWordUrl) rememberDrop(editedWordUrl);
        const previousSavedResume = String(prevStored?.resumeUrl || '').trim();
        if (
          previousSavedResume &&
          pinnedOriginal &&
          normalizeUrl(previousSavedResume) !== normalizeUrl(pinnedOriginal)
        ) {
          rememberDrop(previousSavedResume);
        }
        if (Array.isArray(nextExtra.resumeVersions) && dropKeys.size) {
          nextExtra.resumeVersions = (
            nextExtra.resumeVersions as Array<{ fileUrl?: string | null }>
          ).filter((row) => {
            const key = normalizeUrl(String(row?.fileUrl || ''));
            return !key || !dropKeys.has(key);
          });
        }
        const resumePatch: { resume?: string; resumeUrl?: string } = {};
        if (pinnedOriginal && dropKeys.size) {
          if (fresh.resume && dropKeys.has(normalizeUrl(fresh.resume))) {
            resumePatch.resume = pinnedOriginal;
          }
          if (fresh.resumeUrl && dropKeys.has(normalizeUrl(fresh.resumeUrl))) {
            resumePatch.resumeUrl = pinnedOriginal;
          }
        }
        if (dropKeys.size) {
          try {
            const filesRaw = await filesApiGet('candidate', candidateId);
            const files =
              extractApiData<Array<{ id?: string; fileUrl?: string | null; fileType?: string }>>(
                filesRaw
              ) ?? [];
            for (const file of files) {
              const key = normalizeUrl(String(file.fileUrl || ''));
              if (!file.id || !key || !dropKeys.has(key) || file.id === fileId) continue;
              const type = String(file.fileType || '').trim();
              if (/^resume$/i.test(type) || /^cv$/i.test(type)) continue;
              try {
                await filesApiDelete('candidate', candidateId, file.id);
              } catch {
                /* leftover copy is not a resume version */
              }
            }
          } catch {
            /* version list still keeps the original resume */
          }
        }
        const response = await apiUpdateCandidate(candidateId, {
          extraData: nextExtra,
          ...resumePatch,
        });
        const updated = enrichBackendCandidateFromPhase1Snapshot(
          extractApiData<BackendCandidate>(response) ?? ({} as BackendCandidate)
        );
        if (updated?.id) setBackendCandidate(updated);
        if (editedWordUrl || fileUrl || items.length > 0 || resolvedLogo?.url || hasTextEdits) {
          setPreferredResumeViewMode('saasa');
          onViewModeChange?.('saasa');
        }
        if (uploadWarning) {
          onToast?.(uploadWarning);
        } else {
          onToast?.(
            fileId
              ? 'HRYantra CV saved and added to Files.'
              : 'HRYantra CV annotations saved.'
          );
        }
        closeModal();
        void onCandidateUpdated?.();
        void onFilesRefresh?.();
        return true;
      } catch (error: unknown) {
        onToast?.(
          error instanceof Error ? error.message : 'Failed to save HRYantra CV.'
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [
      candidateId,
      canEdit,
      effectiveResumeUrl,
      resumeUrl,
      candidateName,
      resolveFreshExtraForSave,
      resolveCompanyLogoForSave,
      onCandidateUpdated,
      onFilesRefresh,
      onToast,
      onViewModeChange,
      closeModal,
    ]
  );

  const deleteSavedCv = useCallback(async () => {
    if (!candidateId || !canEdit) {
      onToast?.('You cannot delete HRYantra CV for this candidate.');
      return false;
    }
    setBusy(true);
    try {
      const fresh = await resolveFreshExtraForSave();
      const existingExtra = fresh.extra;
      const prevStored = readSaasaCvAnnotations(existingExtra);

      if (prevStored?.fileId) {
        try {
          await filesApiDelete('candidate', candidateId, prevStored.fileId);
        } catch {
          /* file may already be gone */
        }
      }

      const nextExtra = buildSaasaCvSaveExtra(existingExtra, {
        resumeUrl: effectiveResumeUrl,
        items: [],
        companyLogo: null,
        fileId: undefined,
        fileUrl: null,
        fileName: undefined,
      });
      const response = await apiUpdateCandidate(candidateId, { extraData: nextExtra });
      const updated = enrichBackendCandidateFromPhase1Snapshot(
        extractApiData<BackendCandidate>(response) ?? ({} as BackendCandidate)
      );
      if (updated?.id) setBackendCandidate(updated);
      await onCandidateUpdated?.();
      await onFilesRefresh?.();
      onToast?.('HRYantra CV removed from Files.');
      return true;
    } catch (error: unknown) {
      onToast?.(
        error instanceof Error ? error.message : 'Failed to delete HRYantra CV.'
      );
      return false;
    } finally {
      setBusy(false);
    }
  }, [
    candidateId,
    canEdit,
    effectiveResumeUrl,
    resolveFreshExtraForSave,
    onCandidateUpdated,
    onFilesRefresh,
    onToast,
  ]);

  useEffect(() => {
    if (!enabled) {
      setOpen(false);
      setResolvedResumeUrl(null);
      return;
    }
    if (!candidateId) return;

    let cancelled = false;
    void filesApiGet('candidate', candidateId)
      .then((raw) => {
        const files = extractApiData(raw) ?? [];
        const latest = pickLatestResumeFileUrl(files);
        const resolved = resolveCandidateResumeUrlFromSources(
          {
            resumeUrl: resumeUrl ?? undefined,
            resume: resumeUrl ?? undefined,
            extraData: extraData ?? null,
          },
          { filesResumeUrl: latest || null }
        );
        if (!cancelled) {
          setResolvedResumeUrl(resolved || resumeUrl?.trim() || null);
        }
      })
      .catch(() => {
        if (!cancelled) setResolvedResumeUrl(resumeUrl?.trim() || null);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, candidateId, resumeUrl, extraData]);

  useEffect(() => {
    if (!enabled) setOpen(false);
  }, [enabled]);

  const modals = (
    <SaasaCvAnnotationModal
      isOpen={open}
      onClose={closeModal}
      resumeUrl={effectiveResumeUrl}
      candidateName={candidateName}
      initialAnnotations={Array.isArray(stored?.items) ? stored.items : []}
      initialCompanyLogo={initialCompanyLogo}
      initialDocumentHtml={stored?.documentHtml ?? null}
      initialPdfTextLayerHtml={stored?.pdfTextLayerHtml ?? null}
      canEdit={canEdit}
      saving={busy}
      onSave={saveAnnotations}
      onExportError={onToast}
    />
  );

  return {
    open,
    openModal,
    closeModal,
    busy,
    preferredResumeViewMode,
    annotationCount: stored?.items?.length ?? 0,
    stored,
    deleteSavedCv,
    modals,
  };
}
