'use client';

import { useCallback, useEffect, useState } from 'react';
import CVEditorModal from '../components/CVEditorModal';
import {
  apiGetCandidate,
  apiUpdateCandidate,
  type BackendCandidate,
} from '../lib/api';
import { extractApiData } from '../lib/mapCandidateProfile';
import {
  buildCvEditorPersistPatch,
  buildResumeCvViewExtra,
  candidateToCvEditorData,
  cvEditorDataToCandidatePatch,
  listAvailableResumeCvModes,
  type CVEditorData,
  type ResumeCvViewMode,
} from '../lib/cvEditorMapping';
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

  const resumeRaw = resumeUrl || backendCandidate?.resume || backendCandidate?.resumeUrl || '';
  const resumeHref =
    resumeRaw && isResumeHttpUrl(resumeRaw) ? normalizeResumeHref(resumeRaw) : '';

  const refreshBackend = useCallback(async () => {
    if (!candidateId) return null;
    try {
      const raw = await apiGetCandidate(candidateId);
      const data = extractApiData<BackendCandidate>(raw);
      setBackendCandidate(data);
      onBackendCandidateChange?.(data);
      return data;
    } catch (error: unknown) {
      onToast?.(error instanceof Error ? error.message : 'Unable to load CV data');
      return null;
    }
  }, [candidateId, onBackendCandidateChange, onToast]);

  useEffect(() => {
    if (!enabled || !candidateId) return;
    void refreshBackend();
  }, [enabled, candidateId, refreshBackend]);

  const openEditor = useCallback(async () => {
    if (!candidateId) {
      onToast?.('Candidate not loaded');
      return;
    }
    setCvEditorLoading(true);
    try {
      const data = (await refreshBackend()) ?? extractApiData<BackendCandidate>(await apiGetCandidate(candidateId));
      setCvEditorData(candidateToCvEditorData(data));
      setCvEditorOpen(true);
    } catch (error: unknown) {
      onToast?.(error instanceof Error ? error.message : 'Unable to open CV editor');
    } finally {
      setCvEditorLoading(false);
    }
  }, [candidateId, onToast, refreshBackend]);

  const openStructuredPreview = useCallback(() => {
    if (!backendCandidate) {
      onToast?.('Loading CV data…');
      return;
    }
    setCvViewData(candidateToCvEditorData(backendCandidate));
    setCvViewOpen(true);
  }, [backendCandidate, onToast]);

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

        await onCandidateUpdated?.();
        onToast?.('CV saved');
        setCvEditorOpen(false);
      } catch (error: unknown) {
        onToast?.(error instanceof Error ? error.message : 'Unable to save CV');
        throw error;
      } finally {
        setSaving(false);
      }
    },
    [
      backendCandidate,
      onBackendCandidateChange,
      onCandidateUpdated,
      onToast,
      onViewModeChange,
      resumeHref,
    ]
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
