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
  buildResumeCvViewExtra,
  candidateToCvEditorData,
  cvEditorDataToCandidatePatch,
  listAvailableResumeCvModes,
  type CVEditorData,
  type ResumeCvViewMode,
} from '../lib/cvEditorMapping';
import { buildFileHref } from '../utils/cloudinaryUrls';
import { isResumeHttpUrl, normalizeResumeHref } from '../lib/resumePreview';

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
    if (isResumeHttpUrl(raw)) return normalizeResumeHref(raw);
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

  const openEditor = useCallback(async () => {
    if (!candidateId) {
      onToastRef.current?.('Candidate not loaded');
      return;
    }
    setCvEditorLoading(true);
    try {
      const data = (await refreshBackend()) ?? extractApiData<BackendCandidate>(await apiGetCandidate(candidateId));
      setCvEditorData(candidateToCvEditorData(data));
      setCvEditorOpen(true);
    } catch (error: unknown) {
      onToastRef.current?.(error instanceof Error ? error.message : 'Unable to open CV editor');
    } finally {
      setCvEditorLoading(false);
    }
  }, [candidateId, refreshBackend]);

  const openStructuredPreview = useCallback(() => {
    if (!backendCandidate) {
      onToastRef.current?.('Loading CV data…');
      return;
    }
    setCvViewData(candidateToCvEditorData(backendCandidate));
    setCvViewOpen(true);
  }, [backendCandidate]);

  const handleSave = useCallback(
    async (data: CVEditorData) => {
      if (!backendCandidate?.id) return;
      setSaving(true);
      try {
        const persist = await buildCvEditorPersistPatch(
          data,
          backendCandidate.id,
          backendCandidate.extraData ?? null
        );
        const patch = {
          ...cvEditorDataToCandidatePatch(data),
          ...persist,
        };
        const updatedRaw = await apiUpdateCandidate(backendCandidate.id, patch);
        const updated = extractApiData<BackendCandidate>(updatedRaw);
        setBackendCandidate(updated);
        onBackendCandidateChange?.(updated);
        setCvEditorData(candidateToCvEditorData(updated));
        setCvViewData(candidateToCvEditorData(updated));

        const modes = listAvailableResumeCvModes(
          updated,
          resumeHref || updated.resume || updated.resumeUrl
        );
        const nextMode: ResumeCvViewMode = modes.includes('edited')
          ? 'edited'
          : modes.includes('updated')
            ? 'updated'
            : modes[0];
        if (nextMode) {
          onViewModeChange?.(nextMode);
          const extraData = buildResumeCvViewExtra(updated.extraData ?? null, nextMode);
          await apiUpdateCandidate(updated.id, { extraData });
          const withPref = extractApiData<BackendCandidate>(await apiGetCandidate(updated.id));
          setBackendCandidate(withPref);
          onBackendCandidateChange?.(withPref);
        }

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
    [backendCandidate, onViewModeChange, resumeHref]
  );

  const busy = cvEditorLoading || saving;

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
    openEditor,
    openStructuredPreview,
    refreshBackend,
    modals,
  };
}
