'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import CVEditorModal from '../components/CVEditorModal';
import {
  apiGetCandidate,
  apiUpdateCandidate,
  type BackendCandidate,
} from '../lib/api';
import { extractApiData } from '../lib/mapCandidateProfile';
import {
  enrichBackendCandidateFromPhase1Snapshot,
  resolveCandidateResumeUrlFromSources,
} from '../lib/phase1ProfileSnapshot';
import {
  buildCvEditorPersistPatch,
  buildEditedCvRemovalExtra,
  buildResumeCvViewExtra,
  buildUpdatedCvRemovalExtra,
  candidateToCvEditorData,
  cvEditorDataToCandidatePatch,
  overlayEditorSaveOnCandidate,
  hasCustomCvEditorLayout,
  hasResumeTabUpdatedCv,
  hasUpdatedCvFromEditor,
  listAvailableResumeCvModes,
  type CVEditorData,
  type ResumeCvViewMode,
} from '../lib/cvEditorMapping';
import { buildFileHref } from '../utils/cloudinaryUrls';
import {
  buildResumePdfProxyUrl,
  isResumeHttpUrl,
  normalizeResumeHref,
} from '../lib/resumePreview';

interface UseCandidateCvEditorOptions {
  candidateId: string | undefined;
  resumeUrl?: string | null;
  enabled?: boolean;
  canEdit?: boolean;
  onCandidateUpdated?: () => void | Promise<void>;
  onToast?: (message: string) => void;
  /** Called when backend candidate or view mode changes (for resume tab). */
  onBackendCandidateChange?: (candidate: BackendCandidate | null) => void;
  onViewModeChange?: (mode: ResumeCvViewMode | null) => void;
}

export function useCandidateCvEditor({
  candidateId,
  resumeUrl,
  enabled = true,
  canEdit = true,
  onCandidateUpdated,
  onToast,
  onBackendCandidateChange,
  onViewModeChange,
}: UseCandidateCvEditorOptions) {
  const [backendCandidate, setBackendCandidate] = useState<BackendCandidate | null>(null);
  const [cvEditorOpen, setCvEditorOpen] = useState(false);
  const [cvViewOpen, setCvViewOpen] = useState(false);
  const [cvEditorData, setCvEditorData] = useState<CVEditorData | null>(null);
  const [cvViewData, setCvViewData] = useState<CVEditorData | null>(null);
  const [cvEditorLoading, setCvEditorLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingCv, setDeletingCv] = useState(false);
  const [preferredResumeViewMode, setPreferredResumeViewMode] =
    useState<ResumeCvViewMode | null>(null);

  const uploadsBase =
    typeof process !== 'undefined'
      ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1').replace(
          /\/api\/v1\/?$/,
          ''
        )
      : '';
  const resumeRaw = resumeUrl || backendCandidate?.resume || backendCandidate?.resumeUrl || '';
  const resumeHref = (() => {
    const raw = String(resumeRaw || '').trim();
    if (!raw) return '';
    if (isResumeHttpUrl(raw)) {
      const normalized = normalizeResumeHref(raw);
      return buildResumePdfProxyUrl(normalized) || normalized;
    }
    return uploadsBase ? buildFileHref(raw, uploadsBase) : raw;
  })();

  const onToastRef = useRef(onToast);
  const onBackendCandidateChangeRef = useRef(onBackendCandidateChange);
  const onCandidateUpdatedRef = useRef(onCandidateUpdated);
  const resumeUrlRef = useRef(resumeUrl);
  const fetchInflightRef = useRef<Promise<BackendCandidate | null> | null>(null);

  useEffect(() => {
    onToastRef.current = onToast;
  }, [onToast]);
  useEffect(() => {
    onBackendCandidateChangeRef.current = onBackendCandidateChange;
  }, [onBackendCandidateChange]);
  useEffect(() => {
    onCandidateUpdatedRef.current = onCandidateUpdated;
  }, [onCandidateUpdated]);
  useEffect(() => {
    resumeUrlRef.current = resumeUrl;
  }, [resumeUrl]);

  const refreshBackend = useCallback(async () => {
    if (!candidateId) return null;
    if (fetchInflightRef.current) {
      return fetchInflightRef.current;
    }

    const run = (async () => {
      try {
        const raw = await apiGetCandidate(candidateId);
        const data = enrichBackendCandidateFromPhase1Snapshot(extractApiData<BackendCandidate>(raw));
        setBackendCandidate(data);
        onBackendCandidateChangeRef.current?.(data);
        return data;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unable to load CV data';
        const hasListResume = Boolean(String(resumeUrlRef.current || '').trim());
        if (!/candidate not found/i.test(message) || !hasListResume) {
          onToastRef.current?.(message);
        }
        return null;
      } finally {
        fetchInflightRef.current = null;
      }
    })();

    fetchInflightRef.current = run;
    return run;
  }, [candidateId]);

  useEffect(() => {
    if (!enabled || !candidateId) {
      fetchInflightRef.current = null;
      return;
    }
    void refreshBackend();
  }, [enabled, candidateId, refreshBackend]);

  const resolveBackendCandidate = useCallback(async () => {
    if (!candidateId) return null;
    const refreshed = await refreshBackend();
    if (refreshed?.id) return refreshed;
    try {
      const fetched = extractApiData<BackendCandidate>(await apiGetCandidate(candidateId));
      if (fetched?.id) {
        const enriched = enrichBackendCandidateFromPhase1Snapshot(fetched);
        setBackendCandidate(enriched);
        onBackendCandidateChangeRef.current?.(enriched);
        return enriched;
      }
    } catch {
      /* handled below */
    }
    return backendCandidate;
  }, [candidateId, refreshBackend, backendCandidate]);

  const openEditor = useCallback(async () => {
    if (!candidateId) {
      onToastRef.current?.('Candidate not loaded');
      return;
    }
    setCvEditorLoading(true);
    try {
      const fetched = await resolveBackendCandidate();
      if (!fetched?.id) {
        throw new Error('Unable to load candidate for CV editor');
      }
      const memExtra =
        backendCandidate?.extraData &&
        typeof backendCandidate.extraData === 'object' &&
        !Array.isArray(backendCandidate.extraData)
          ? (backendCandidate.extraData as Record<string, unknown>)
          : {};
      const fetchedExtra =
        fetched.extraData && typeof fetched.extraData === 'object' && !Array.isArray(fetched.extraData)
          ? (fetched.extraData as Record<string, unknown>)
          : {};
      const memSavedAt = String(memExtra.cvEditorContentSavedAt || '');
      const fetchedSavedAt = String(fetchedExtra.cvEditorContentSavedAt || '');
      const source =
        backendCandidate?.id === fetched.id &&
        memExtra.cvEditorContentSaved === true &&
        memSavedAt &&
        memSavedAt >= fetchedSavedAt
          ? backendCandidate
          : fetched;
      setCvEditorData(candidateToCvEditorData(source));
      setCvEditorOpen(true);
    } catch (error: unknown) {
      onToastRef.current?.(error instanceof Error ? error.message : 'Unable to open CV editor');
    } finally {
      setCvEditorLoading(false);
    }
  }, [candidateId, resolveBackendCandidate, backendCandidate]);

  const openStructuredPreview = useCallback(async () => {
    const latest = (await refreshBackend()) ?? backendCandidate;
    if (!latest) {
      onToastRef.current?.('Loading CV data…');
      return;
    }
    setCvViewData(candidateToCvEditorData(latest));
    setCvViewOpen(true);
  }, [backendCandidate, refreshBackend]);

  const handleSave = useCallback(
    async (data: CVEditorData) => {
      const baseCandidate = await resolveBackendCandidate();
      if (!baseCandidate?.id) {
        throw new Error('Candidate not loaded — refresh and try again');
      }
      setSaving(true);
      try {
        const persist = await buildCvEditorPersistPatch(
          data,
          baseCandidate.id,
          baseCandidate.extraData ?? null
        );
        const contentPatch = cvEditorDataToCandidatePatch(data);
        const patch = overlayEditorSaveOnCandidate(baseCandidate, contentPatch, persist);

        const updatedRaw = await apiUpdateCandidate(baseCandidate.id, {
          ...contentPatch,
          ...persist,
          extraData: patch.extraData,
        });
        const updated = extractApiData<BackendCandidate>(updatedRaw);
        let hydrated = overlayEditorSaveOnCandidate(
          enrichBackendCandidateFromPhase1Snapshot({
            ...baseCandidate,
            ...patch,
            ...updated,
            id: updated?.id ?? baseCandidate.id,
          } as BackendCandidate),
          contentPatch,
          persist
        );
        try {
          const hydratedRaw =
            extractApiData<BackendCandidate>(await apiGetCandidate(baseCandidate.id)) ??
            updated ??
            baseCandidate;
          hydrated = overlayEditorSaveOnCandidate(
            enrichBackendCandidateFromPhase1Snapshot(hydratedRaw),
            contentPatch,
            persist
          );
        } catch {
          /* PATCH + overlay response is enough */
        }

        const editorCvData = candidateToCvEditorData(hydrated);
        setBackendCandidate(hydrated);
        onBackendCandidateChange?.(hydrated);
        setCvEditorData(editorCvData);
        setCvViewData(editorCvData);
        setPreferredResumeViewMode('updated');
        onViewModeChange?.('updated');

        await onCandidateUpdatedRef.current?.();
        onToastRef.current?.('CV saved');
        setCvEditorOpen(false);
      } catch (error: unknown) {
        onToastRef.current?.(error instanceof Error ? error.message : 'Unable to save CV');
        throw error;
      } finally {
        setSaving(false);
      }
    },
    [resolveBackendCandidate, onViewModeChange, resumeHref]
  );

  const applyCvDeletionResult = useCallback(
    async (hydrated: BackendCandidate, nextMode: ResumeCvViewMode | null) => {
      setBackendCandidate(hydrated);
      onBackendCandidateChangeRef.current?.(hydrated);
      setPreferredResumeViewMode(nextMode);
      onViewModeChange?.(nextMode);
      await onCandidateUpdatedRef.current?.();
    },
    [onViewModeChange]
  );

  const resolveNextViewModeAfterDelete = useCallback(
    (hydrated: BackendCandidate): ResumeCvViewMode | null => {
      const modes = listAvailableResumeCvModes(
        hydrated,
        resumeHref || hydrated.resume || hydrated.resumeUrl
      );
      if (modes.includes('original')) return 'original';
      if (modes.includes('updated')) return 'updated';
      if (modes.includes('saasa')) return 'saasa';
      return modes[0] ?? null;
    },
    [resumeHref]
  );

  const deleteEditedCv = useCallback(async () => {
    if (!candidateId || !canEdit) {
      onToastRef.current?.('You cannot delete the edited CV for this candidate.');
      return false;
    }
    const baseCandidate = await resolveBackendCandidate();
    if (!baseCandidate?.id || !hasCustomCvEditorLayout(baseCandidate)) {
      onToastRef.current?.('No edited CV layout to remove.');
      return false;
    }
    setDeletingCv(true);
    try {
      const existingExtra =
        baseCandidate.extraData &&
        typeof baseCandidate.extraData === 'object' &&
        !Array.isArray(baseCandidate.extraData)
          ? (baseCandidate.extraData as Record<string, unknown>)
          : {};
      const hasOriginalResume = Boolean(
        String(resumeHref || baseCandidate.resume || baseCandidate.resumeUrl || '').trim()
      );
      const hasUpdatedCv = hasUpdatedCvFromEditor(baseCandidate);
      const extraData = buildEditedCvRemovalExtra(existingExtra, {
        hasOriginalResume,
        hasUpdatedCv,
      });
      const updatedRaw = await apiUpdateCandidate(baseCandidate.id, { extraData });
      let hydrated = enrichBackendCandidateFromPhase1Snapshot(
        extractApiData<BackendCandidate>(updatedRaw) as BackendCandidate
      );
      try {
        const refreshed = enrichBackendCandidateFromPhase1Snapshot(
          extractApiData<BackendCandidate>(await apiGetCandidate(baseCandidate.id)) as BackendCandidate
        );
        if (refreshed?.id) hydrated = refreshed;
      } catch {
        /* PATCH response is enough */
      }
      await applyCvDeletionResult(hydrated, resolveNextViewModeAfterDelete(hydrated));
      onToastRef.current?.('Edited CV removed');
      return true;
    } catch (error: unknown) {
      onToastRef.current?.(
        error instanceof Error ? error.message : 'Failed to delete edited CV'
      );
      return false;
    } finally {
      setDeletingCv(false);
    }
  }, [
    candidateId,
    canEdit,
    resolveBackendCandidate,
    resumeHref,
    resolveNextViewModeAfterDelete,
    applyCvDeletionResult,
  ]);

  const deleteUpdatedCv = useCallback(async () => {
    if (!candidateId || !canEdit) {
      onToastRef.current?.('You cannot delete the updated CV for this candidate.');
      return false;
    }
    const baseCandidate = await resolveBackendCandidate();
    if (!baseCandidate?.id || !hasResumeTabUpdatedCv(baseCandidate)) {
      onToastRef.current?.('No updated CV to remove.');
      return false;
    }
    setDeletingCv(true);
    try {
      const existingExtra =
        baseCandidate.extraData &&
        typeof baseCandidate.extraData === 'object' &&
        !Array.isArray(baseCandidate.extraData)
          ? (baseCandidate.extraData as Record<string, unknown>)
          : {};
      const hasOriginalResume = Boolean(
        String(resumeHref || baseCandidate.resume || baseCandidate.resumeUrl || '').trim()
      );
      const extraData = buildUpdatedCvRemovalExtra(existingExtra, {
        hasOriginalResume,
      });
      const updatedRaw = await apiUpdateCandidate(baseCandidate.id, {
        cvSummary: null,
        cvEducationEntries: null,
        cvWorkExperienceEntries: null,
        avatar: null,
        extraData,
      });
      let hydrated = enrichBackendCandidateFromPhase1Snapshot(
        extractApiData<BackendCandidate>(updatedRaw) as BackendCandidate
      );
      try {
        const refreshed = enrichBackendCandidateFromPhase1Snapshot(
          extractApiData<BackendCandidate>(await apiGetCandidate(baseCandidate.id)) as BackendCandidate
        );
        if (refreshed?.id) hydrated = refreshed;
      } catch {
        /* PATCH response is enough */
      }
      await applyCvDeletionResult(hydrated, resolveNextViewModeAfterDelete(hydrated));
      onToastRef.current?.('Updated CV removed');
      return true;
    } catch (error: unknown) {
      onToastRef.current?.(
        error instanceof Error ? error.message : 'Failed to delete updated CV'
      );
      return false;
    } finally {
      setDeletingCv(false);
    }
  }, [
    candidateId,
    canEdit,
    resolveBackendCandidate,
    resumeHref,
    resolveNextViewModeAfterDelete,
    applyCvDeletionResult,
  ]);

  const busy = cvEditorLoading || saving || deletingCv;

  const modals = (
    <>
      {cvEditorOpen && cvEditorData ? (
        <CVEditorModal
          initialData={cvEditorData}
          onClose={() => setCvEditorOpen(false)}
          onSave={handleSave}
          primaryButtonLabel="Save CV"
        />
      ) : null}
      {cvViewOpen && cvViewData ? (
        <CVEditorModal initialData={cvViewData} readOnly onClose={() => setCvViewOpen(false)} />
      ) : null}
    </>
  );

  return {
    backendCandidate,
    resumeHref,
    resumeRaw,
    canEdit,
    busy,
    cvEditorLoading,
    preferredResumeViewMode,
    openEditor,
    openStructuredPreview,
    refreshBackend,
    deleteEditedCv,
    deleteUpdatedCv,
    modals,
  };
}
