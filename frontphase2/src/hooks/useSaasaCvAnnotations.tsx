'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  apiUpdateCandidate,
  filesApiDelete,
  filesApiGet,
  filesApiUpload,
  type BackendCandidate,
} from '../lib/api';
import { extractApiData } from '../lib/mapCandidateProfile';
import {
  pickLatestResumeFileUrl,
  resolveCandidateResumeUrlFromSources,
} from '../lib/phase1ProfileSnapshot';
import { buildResumeCvViewExtra, dataUrlToFile } from '../lib/cvEditorMapping';
import {
  buildSaasaCvAnnotationsExtra,
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
}: UseSaasaCvAnnotationsOptions) {
  const [open, setOpen] = useState(false);
  const [backendCandidate, setBackendCandidate] = useState<BackendCandidate | null>(null);
  const [busy, setBusy] = useState(false);
  const [resolvedResumeUrl, setResolvedResumeUrl] = useState<string | null>(null);

  const effectiveResumeUrl =
    resolvedResumeUrl?.trim() || resumeUrl?.trim() || null;

  const stored = useMemo(
    () => readSaasaCvAnnotations(extraData ?? backendCandidate?.extraData ?? null),
    [extraData, backendCandidate?.extraData]
  );

  const initialCompanyLogo = useMemo(
    () =>
      readSaasaCvCompanyLogo(extraData ?? backendCandidate?.extraData ?? null) ??
      stored?.companyLogo ??
      null,
    [extraData, backendCandidate?.extraData, stored?.companyLogo]
  );

  const openModal = useCallback(() => {
    if (!effectiveResumeUrl) {
      onToast?.('No original resume on file for this candidate.');
      return;
    }
    setOpen(true);
  }, [effectiveResumeUrl, onToast]);

  const closeModal = useCallback(() => setOpen(false), []);

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
      fullSnapshot = false
    ) => {
      if (!candidateId || !canEdit) {
        onToast?.('You cannot save annotations for this candidate.');
        return false;
      }
      setBusy(true);
      try {
        const existingExtra =
          (backendCandidate?.extraData as Record<string, unknown> | undefined) ??
          (extraData && typeof extraData === 'object' && !Array.isArray(extraData) ? extraData : {});

        const prevStored = readSaasaCvAnnotations(existingExtra);
        let fileId = prevStored?.fileId;
        let fileUrl = prevStored?.fileUrl ?? null;
        let fileName = prevStored?.fileName;

        const paintMarks = hasPaintMarks(items);
        const hasPins = items.some((a) => a.type === 'comment' || a.type === 'important');
        const resolvedLogo = await resolveCompanyLogoForSave(
          companyLogo,
          prevStored?.companyLogo?.url
        );

        const shouldUploadSnapshot =
          Boolean(exportPayload) &&
          (fullSnapshot || paintMarks || resolvedLogo?.url || hasPins);

        let savedFullSnapshot = fullSnapshot;
        let savedSnapshotFormat: 'pdf' | 'png' | undefined;
        if (shouldUploadSnapshot && exportPayload) {
          let blob: Blob | null = null;
          if (exportPayload instanceof Blob) {
            blob = exportPayload;
          } else if (exportPayload instanceof HTMLCanvasElement) {
            if (fullSnapshot) {
              throw new Error(
                'Full CV PDF export failed. Wait for the CV to load completely, then save again.'
              );
            }
            if (resolvedLogo?.url) {
              await compositeCompanyLogoOnCanvas(exportPayload, resolvedLogo);
            }
            blob = await exportPaintLayerPdf(exportPayload);
            savedFullSnapshot = false;
          }
          if (fullSnapshot && !blob) {
            throw new Error(
              'Full CV PDF export failed. Wait for the CV to load completely, then save again.'
            );
          }
          if (blob) {
            savedSnapshotFormat =
              blob.type === 'application/pdf' || blob.type.includes('pdf') ? 'pdf' : 'png';
            if (fileId) {
              try {
                await filesApiDelete('candidate', candidateId, fileId);
              } catch {
                /* replace previous export */
              }
            }
            const safeName = (candidateName || 'Candidate').replace(/[^\w\s-]/g, '').trim() || 'Candidate';
            const isPdf = blob.type === 'application/pdf' || blob.type.includes('pdf');
            const file = new File(
              [blob],
              `SAASA CV - ${safeName}.${isPdf ? 'pdf' : 'png'}`,
              { type: isPdf ? 'application/pdf' : 'image/png' }
            );
            const uploadRes = await filesApiUpload('candidate', candidateId, file, SAASA_CV_FILE_TYPE);
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
          }
        } else if (!shouldUploadSnapshot && fileId) {
          try {
            await filesApiDelete('candidate', candidateId, fileId);
          } catch {
            /* ignore */
          }
          fileId = undefined;
          fileUrl = null;
          fileName = undefined;
        }

        const annotationsExtra = buildSaasaCvAnnotationsExtra(existingExtra, {
          resumeUrl: effectiveResumeUrl,
          items,
          companyLogo: resolvedLogo,
          fileId,
          fileUrl,
          fileName,
          fullSnapshot: fileUrl ? savedFullSnapshot : false,
          snapshotFormat: fileUrl ? savedSnapshotFormat : undefined,
        });
        const nextExtra =
          fileUrl || items.length > 0 || resolvedLogo?.url
            ? buildResumeCvViewExtra(annotationsExtra, 'saasa')
            : annotationsExtra;
        const response = await apiUpdateCandidate(candidateId, { extraData: nextExtra });
        const updated = extractApiData<BackendCandidate>(response);
        if (updated) setBackendCandidate(updated);
        await onCandidateUpdated?.();
        await onFilesRefresh?.();
        onToast?.(
          fileId
            ? 'SAASA CV saved and added to Files.'
            : 'SAASA CV annotations saved.'
        );
        closeModal();
        return true;
      } catch (error: unknown) {
        onToast?.(
          error instanceof Error ? error.message : 'Failed to save SAASA CV.'
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [
      candidateId,
      canEdit,
      backendCandidate?.extraData,
      extraData,
      effectiveResumeUrl,
      candidateName,
      resolveCompanyLogoForSave,
      onCandidateUpdated,
      onFilesRefresh,
      onToast,
      closeModal,
    ]
  );

  const deleteSavedCv = useCallback(async () => {
    if (!candidateId || !canEdit) {
      onToast?.('You cannot delete SAASA CV for this candidate.');
      return false;
    }
    setBusy(true);
    try {
      const existingExtra =
        (backendCandidate?.extraData as Record<string, unknown> | undefined) ??
        (extraData && typeof extraData === 'object' && !Array.isArray(extraData) ? extraData : {});
      const prevStored = readSaasaCvAnnotations(existingExtra);

      if (prevStored?.fileId) {
        try {
          await filesApiDelete('candidate', candidateId, prevStored.fileId);
        } catch {
          /* file may already be gone */
        }
      }

      const nextExtra = buildSaasaCvAnnotationsExtra(existingExtra, {
        resumeUrl: effectiveResumeUrl,
        items: [],
        companyLogo: null,
        fileId: undefined,
        fileUrl: null,
        fileName: undefined,
      });
      const response = await apiUpdateCandidate(candidateId, { extraData: nextExtra });
      const updated = extractApiData<BackendCandidate>(response);
      if (updated) setBackendCandidate(updated);
      await onCandidateUpdated?.();
      await onFilesRefresh?.();
      onToast?.('SAASA CV removed from Files.');
      return true;
    } catch (error: unknown) {
      onToast?.(
        error instanceof Error ? error.message : 'Failed to delete SAASA CV.'
      );
      return false;
    } finally {
      setBusy(false);
    }
  }, [
    candidateId,
    canEdit,
    backendCandidate?.extraData,
    extraData,
    effectiveResumeUrl,
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
      initialAnnotations={stored?.items ?? []}
      initialCompanyLogo={initialCompanyLogo}
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
    annotationCount: stored?.items?.length ?? 0,
    stored,
    deleteSavedCv,
    modals,
  };
}
