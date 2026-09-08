'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { toast as sonnerToast } from 'sonner';
import { InterviewDrawer } from './InterviewDrawer';
import { CancelInterviewModal } from './CancelInterviewModal';
import { FeedbackModal } from './FeedbackModal';
import { NoShowModal } from './NoShowModal';
import { PanelAssignmentModal } from './PanelAssignmentModal';
import { RejectCandidateModal } from './RejectCandidateModal';
import { RescheduleModal } from './RescheduleModal';
import { useInterviewDrawer } from '../../hooks/useInterviewDrawer';
import { useInterviewModals } from '../../hooks/useInterviewModals';
import { mapBackendInterviewToUi } from '../../hooks/useInterviews';
import { useSubmitToClientModal } from '../../hooks/useSubmitToClientModal';
import { usePermissions } from '../../hooks/usePermissions';
import { requestConfirm } from '../../lib/appDialog';
import { getActiveOrgUnitId } from '../../lib/org/orgWorkspaceStorage';
import {
  apiAddInterviewNote,
  apiAddInterviewPanelMember,
  apiCancelInterview,
  apiDeleteInterview,
  apiGenerateInterviewFeedbackSummary,
  apiGetInterview,
  apiGetUsers,
  apiMarkInterviewNoShow,
  apiRejectCandidate,
  apiRemoveInterviewPanelMember,
  apiRescheduleInterview,
  apiScheduleCandidateInterview,
  apiSubmitInterviewFeedback,
  apiUpdateInterview,
  type BackendInterviewListItem,
  type BackendUser,
} from '../../lib/api';
import {
  mapCandidateScheduledToUpdatePayload,
  mapInterviewToCandidateScheduled,
  mapInterviewUiTypeToBackend,
} from '../../lib/interview-schedule-helpers';
import { extractApiData } from '../../lib/mapCandidateProfile';
import type {
  FeedbackPayload,
  Interview,
  InterviewPanelMember,
} from '../../types/interview.types';
import { COMPLETED_INTERVIEW_LOCKED_ACTIONS, isInterviewCompleted } from '../../types/interview.types';
import type { InterviewAction } from './ActionsDropdown';

const CandidateScheduleInterviewModal = dynamic(
  () =>
    import('../drawers/CandidateProfileDrawer').then((mod) => ({
      default: mod.ScheduleInterviewModal,
    })),
  { ssr: false },
);

function unwrapList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') {
    const payload = value as { data?: unknown; items?: unknown };
    if (Array.isArray(payload.data)) return payload.data as T[];
    if (Array.isArray(payload.items)) return payload.items as T[];
  }
  return [];
}

function initialsFromName(name: string, fallback = 'NA') {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return fallback;
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function mapUsersToPanel(users: BackendUser[]): InterviewPanelMember[] {
  return users.map((user) => ({
    id: String(user.id || ''),
    userId: String(user.id || ''),
    name: String(user.name || user.email || 'Unknown Interviewer'),
    role: 'Technical',
    department: String((user as { department?: string }).department || 'General'),
    email: String(user.email || 'No email available'),
    phone: String((user as { phone?: string }).phone || '-'),
    avatar: initialsFromName(String(user.name || user.email || ''), 'NA'),
  }));
}

type Props = {
  interviewItem: BackendInterviewListItem | null;
  isOpen: boolean;
  onClose: () => void;
  onChanged?: () => void;
  zIndexClass?: string;
};

export function InterviewDetailHost({
  interviewItem,
  isOpen,
  onClose,
  onChanged,
  zIndexClass = 'z-[110]',
}: Props) {
  const drawer = useInterviewDrawer();
  const modals = useInterviewModals();
  const { hasPermission } = usePermissions();
  const canUpdateInterview =
    hasPermission('interviews_update') ||
    hasPermission('interviews_manage') ||
    hasPermission('all');
  const canDeleteInterview =
    hasPermission('interviews_delete') ||
    hasPermission('interviews_manage') ||
    hasPermission('all');
  const canCreateInterview =
    hasPermission('interviews_create') ||
    hasPermission('interviews_manage') ||
    hasPermission('all');

  const [interview, setInterview] = useState<Interview | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [interviewerOptions, setInterviewerOptions] = useState<InterviewPanelMember[]>([]);
  const [editInterview, setEditInterview] = useState<Interview | null>(null);
  const [scheduleNextRoundFrom, setScheduleNextRoundFrom] = useState<Interview | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const { openFromInterview, submitModalElement } = useSubmitToClientModal({
    onSubmitted: () => onChanged?.(),
  });

  const refreshInterview = useCallback(async (id: string) => {
    const response = await apiGetInterview(id);
    const raw =
      extractApiData<BackendInterviewListItem>(response) ||
      (response as { data?: BackendInterviewListItem }).data;
    if (!raw?.id) return null;
    const mapped = mapBackendInterviewToUi(raw);
    setInterview(mapped);
    return mapped;
  }, []);

  useEffect(() => {
    if (!isOpen || !interviewItem?.id) {
      setInterview(null);
      return;
    }
    let cancelled = false;
    const initial = mapBackendInterviewToUi(interviewItem);
    setInterview(initial);
    drawer.openDrawer(initial);
    void apiGetInterview(interviewItem.id)
      .then((response) => {
        if (cancelled) return;
        const raw =
          extractApiData<BackendInterviewListItem>(response) ||
          (response as { data?: BackendInterviewListItem }).data;
        if (raw?.id) {
          const mapped = mapBackendInterviewToUi(raw);
          setInterview(mapped);
          drawer.openDrawer(mapped);
        }
      })
      .catch(() => {
        /* keep list snapshot */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once per interview id
  }, [isOpen, interviewItem?.id]);

  useEffect(() => {
    if (!panelOpen && !scheduleOpen) return;
    let cancelled = false;
    void apiGetUsers({
      assignable: true,
      isActive: true,
      limit: 100,
      companyId: getActiveOrgUnitId() || undefined,
    })
      .then((response) => {
        if (cancelled) return;
        setInterviewerOptions(mapUsersToPanel(unwrapList<BackendUser>(response.data)));
      })
      .catch(() => {
        if (!cancelled) setInterviewerOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [panelOpen, scheduleOpen]);

  const selectedInterview = interview;

  const closeAll = useCallback(() => {
    drawer.closeDrawer();
    modals.close();
    setRejectOpen(false);
    setPanelOpen(false);
    setEditInterview(null);
    setScheduleNextRoundFrom(null);
    setScheduleOpen(false);
    setInterview(null);
    onClose();
  }, [drawer, modals, onClose]);

  const afterMutation = useCallback(async () => {
    if (selectedInterview?.id) {
      const mapped = await refreshInterview(selectedInterview.id);
      if (mapped) drawer.openDrawer(mapped);
    }
    onChanged?.();
  }, [drawer, onChanged, refreshInterview, selectedInterview?.id]);

  const openEditFlow = (row: Interview) => {
    if (isInterviewCompleted(row)) return;
    setScheduleNextRoundFrom(null);
    setEditInterview(row);
    // Open edit popup first so closing the detail drawer cannot unmount / dismiss it.
    setScheduleOpen(true);
  };

  const openScheduleNextRoundFlow = (row: Interview) => {
    if (!isInterviewCompleted(row)) return;
    setEditInterview(null);
    setScheduleNextRoundFrom(row);
    setScheduleOpen(true);
  };

  const openRejectFlow = (row: Interview) => {
    if (isInterviewCompleted(row)) return;
    setRejectOpen(true);
  };

  const handleAction = (action: InterviewAction, row: Interview) => {
    if (
      (COMPLETED_INTERVIEW_LOCKED_ACTIONS as readonly InterviewAction[]).includes(action) &&
      isInterviewCompleted(row)
    ) {
      return;
    }
    if (
      (action === 'feedback' ||
        action === 'edit' ||
        action === 'reschedule' ||
        action === 'noShow' ||
        action === 'reject') &&
      !canUpdateInterview
    ) {
      return;
    }
    if ((action === 'cancel' || action === 'delete') && !canDeleteInterview) return;

    if (action === 'view') {
      drawer.openDrawer(row);
      return;
    }
    if (action === 'edit') {
      openEditFlow(row);
      return;
    }
    if (action === 'reschedule') {
      drawer.openDrawer(row);
      modals.open('reschedule');
      return;
    }
    if (action === 'cancel') {
      drawer.openDrawer(row);
      modals.open('cancel');
      return;
    }
    if (action === 'delete') {
      void (async () => {
        const confirmed = await requestConfirm(
          `Delete ${row.candidate.name}'s interview? This will remove it from the schedule.`,
        );
        if (!confirmed) return;
        try {
          await apiDeleteInterview(row.id);
          sonnerToast.success('Interview deleted');
          closeAll();
          onChanged?.();
        } catch (err: unknown) {
          sonnerToast.error(err instanceof Error ? err.message : 'Unable to delete interview');
        }
      })();
      return;
    }
    if (action === 'reject') {
      openRejectFlow(row);
      return;
    }
    if (action === 'feedback') {
      drawer.openDrawer(row);
      modals.open('feedback');
      return;
    }
    if (action === 'copyLink') {
      void navigator.clipboard.writeText(row.meetingLink || '');
      sonnerToast.success('Meeting link copied');
      return;
    }
    if (action === 'noShow') {
      drawer.openDrawer(row);
      modals.open('noShow');
    }
  };

  const scheduleCandidate = useMemo(() => {
    const row = editInterview || scheduleNextRoundFrom;
    if (!row) return null;
    return {
      id: row.candidate.id,
      name: row.candidate.name,
      phone: null as string | null,
      stage: row.candidate.stage ?? null,
      assignedJob: row.job.title,
      assignedJobId: row.job.id,
    };
  }, [editInterview, scheduleNextRoundFrom]);

  const editInterviewForPopup = useMemo(() => {
    if (!editInterview) return null;
    return mapInterviewToCandidateScheduled(editInterview, 1);
  }, [editInterview]);

  const scheduleNextRoundExisting = useMemo(() => {
    if (!scheduleNextRoundFrom) return [];
    return [mapInterviewToCandidateScheduled(scheduleNextRoundFrom, 1)];
  }, [scheduleNextRoundFrom]);

  if (!isOpen && !scheduleOpen && !rejectOpen) return null;

  return (
    <>
      <InterviewDrawer
        isOpen={Boolean(isOpen && selectedInterview && !scheduleOpen && !rejectOpen)}
        interview={selectedInterview}
        zIndexClass={zIndexClass}
        onClose={closeAll}
        onOpenFeedback={canUpdateInterview ? () => modals.open('feedback') : undefined}
        onOpenCancel={canDeleteInterview ? () => modals.open('cancel') : undefined}
        onOpenPanelAssignment={canUpdateInterview ? () => setPanelOpen(true) : undefined}
        onOpenReject={
          canUpdateInterview && selectedInterview ? () => openRejectFlow(selectedInterview) : undefined
        }
        onOpenSubmitToClient={
          canUpdateInterview && selectedInterview
            ? () => openFromInterview(selectedInterview)
            : undefined
        }
        onScheduleNextRound={
          canCreateInterview && selectedInterview && isInterviewCompleted(selectedInterview)
            ? () => openScheduleNextRoundFlow(selectedInterview)
            : undefined
        }
        onAction={selectedInterview ? (action) => handleAction(action, selectedInterview) : undefined}
        onAddNote={
          canUpdateInterview
            ? async (text) => {
                if (!selectedInterview) return;
                await apiAddInterviewNote(selectedInterview.id, text);
                sonnerToast.success('Note added');
                await afterMutation();
              }
            : undefined
        }
      />

      {submitModalElement}

      <RejectCandidateModal
        isOpen={canUpdateInterview && rejectOpen}
        interview={selectedInterview}
        onClose={() => {
          setRejectOpen(false);
          if (selectedInterview) drawer.openDrawer(selectedInterview);
        }}
        onReject={async ({ reason, feedback, sendEmail, showFeedbackToCandidate }) => {
          if (!selectedInterview) return;
          await apiRejectCandidate(selectedInterview.candidate.id, {
            reason,
            feedback,
            sendEmail,
            showFeedbackToCandidate,
            jobId: selectedInterview.job?.id,
          });
          sonnerToast.success(`${selectedInterview.candidate.name} rejected`);
          setRejectOpen(false);
          closeAll();
          onChanged?.();
        }}
      />

      <RescheduleModal
        isOpen={canUpdateInterview && modals.isModalOpen('reschedule')}
        interview={selectedInterview}
        onClose={modals.close}
        onSubmit={async (payload) => {
          if (!selectedInterview) return;
          await apiRescheduleInterview(selectedInterview.id, {
            newDate: new Date(payload.date).toISOString(),
            newTime: payload.time,
            reason: payload.reason,
            notifyCandidate: payload.notifyCandidate,
            notifyInterviewer: payload.notifyInterviewer,
          });
          sonnerToast.success('Interview rescheduled');
          modals.close();
          await afterMutation();
        }}
      />

      <CancelInterviewModal
        isOpen={canDeleteInterview && modals.isModalOpen('cancel')}
        interview={selectedInterview}
        onClose={modals.close}
        onSubmit={async (payload) => {
          if (!selectedInterview) return;
          await apiCancelInterview(selectedInterview.id, payload);
          sonnerToast.success('Interview cancelled');
          modals.close();
          await afterMutation();
        }}
      />

      <FeedbackModal
        isOpen={canUpdateInterview && modals.isModalOpen('feedback')}
        interview={selectedInterview}
        onClose={modals.close}
        onSubmit={async (payload: FeedbackPayload) => {
          if (!selectedInterview) return;
          await apiSubmitInterviewFeedback(selectedInterview.id, {
            technicalScore: payload.ratings.technicalSkills,
            communicationScore: payload.ratings.communication,
            problemSolvingScore: payload.ratings.problemSolving,
            cultureFitScore: payload.ratings.cultureFit,
            experienceMatchScore: payload.ratings.experienceMatch,
            overallScore: payload.ratings.overallRating,
            strengths: payload.strengths,
            weakness: payload.weaknesses,
            comments: payload.comments,
            recommendation:
              payload.recommendation === 'Pass'
                ? 'PASS'
                : payload.recommendation === 'Reject'
                  ? 'REJECT'
                  : 'HOLD',
            salaryFit: payload.salaryFit,
            availableToJoin: payload.availableToJoin,
          });
          const refreshed = await refreshInterview(selectedInterview.id);
          const entryId = refreshed?.feedbackEntries?.[0]?.id;
          if (entryId) {
            try {
              await apiGenerateInterviewFeedbackSummary(selectedInterview.id, entryId);
              await refreshInterview(selectedInterview.id);
            } catch {
              /* keep feedback success */
            }
          }
          if (refreshed) drawer.openDrawer(refreshed);
          sonnerToast.success(payload.saveAsDraft ? 'Feedback saved' : 'Feedback submitted');
          modals.close();
          onChanged?.();
        }}
      />

      <NoShowModal
        isOpen={canUpdateInterview && modals.isModalOpen('noShow')}
        interview={selectedInterview}
        onClose={modals.close}
        onSubmit={async (payload) => {
          if (!selectedInterview) return;
          await apiMarkInterviewNoShow(selectedInterview.id, payload);
          sonnerToast.success('Interview marked as no show');
          modals.close();
          await afterMutation();
        }}
      />

      <PanelAssignmentModal
        isOpen={canUpdateInterview && panelOpen}
        interviewers={interviewerOptions}
        initialSelectedIds={selectedInterview?.panel?.map((member) => member.userId || member.id) || []}
        onClose={() => setPanelOpen(false)}
        onSave={async (panelIds) => {
          if (!selectedInterview) return;
          const panel = Array.isArray(selectedInterview.panel) ? selectedInterview.panel : [];
          const toRemove = panel.filter((member) => !panelIds.includes(member.userId || member.id));
          const toAdd = panelIds.filter(
            (id) => !panel.some((member) => (member.userId || member.id) === id),
          );
          await Promise.all([
            ...toRemove.map((member) => apiRemoveInterviewPanelMember(selectedInterview.id, member.id)),
            ...toAdd.map((userId) =>
              apiAddInterviewPanelMember(selectedInterview.id, {
                userId,
                role: 'TECHNICAL',
              }),
            ),
          ]);
          sonnerToast.success('Interview panel updated');
          setPanelOpen(false);
          await afterMutation();
        }}
      />

      <CandidateScheduleInterviewModal
        isOpen={
          scheduleOpen &&
          ((!!editInterview && canUpdateInterview) || (!!scheduleNextRoundFrom && canCreateInterview))
        }
        candidate={scheduleCandidate}
        initialJobId={scheduleNextRoundFrom?.job.id ?? editInterview?.job.id ?? undefined}
        jobs={
          (editInterview || scheduleNextRoundFrom)?.job.id
            ? [
                {
                  id: (editInterview || scheduleNextRoundFrom)!.job.id,
                  title: (editInterview || scheduleNextRoundFrom)!.job.title,
                  clientId: (editInterview || scheduleNextRoundFrom)!.job.clientId ?? null,
                  clientName: (editInterview || scheduleNextRoundFrom)!.job.client ?? null,
                },
              ]
            : []
        }
        interviewers={interviewerOptions.map((member) => ({
          id: member.userId || member.id,
          name: member.name,
          role: member.role,
          department: member.department,
        }))}
        existingInterviews={scheduleNextRoundExisting}
        editInterview={editInterviewForPopup}
        onClose={() => {
          setScheduleOpen(false);
          setEditInterview(null);
          setScheduleNextRoundFrom(null);
          // Keep the interview detail host open; only re-show the detail drawer.
        }}
        onScheduledSuccess={(message) => sonnerToast.success(message)}
        onSchedule={async (interviewData) => {
          await apiScheduleCandidateInterview(interviewData.candidateId, {
            jobId: interviewData.jobId,
            clientId: interviewData.clientId || undefined,
            type: interviewData.type,
            round: interviewData.round,
            date: interviewData.date,
            time: interviewData.time,
            duration: interviewData.duration,
            timezone: interviewData.timezone,
            mode: interviewData.mode,
            platform:
              interviewData.platform === 'Google Meet'
                ? 'GOOGLE_MEET'
                : interviewData.platform === 'Zoom'
                  ? 'ZOOM'
                  : null,
            meetingLink: interviewData.meetingLink,
            location: interviewData.location,
            phoneNumber: interviewData.phoneNumber,
            interviewers: interviewData.interviewers,
            notes: interviewData.notes,
            sendCandidateInvite: interviewData.sendCandidateInvite,
            sendInterviewerInvite: interviewData.sendInterviewerInvite,
          });
          setScheduleNextRoundFrom(null);
          setScheduleOpen(false);
          sonnerToast.success('Next round scheduled');
          onChanged?.();
        }}
        onUpdate={async (interviewId, interviewData) => {
          const payload = mapCandidateScheduledToUpdatePayload(
            interviewData,
            editInterview?.timezone,
            editInterview?.notes,
          );
          await apiUpdateInterview(interviewId, {
            candidateId: payload.candidateId,
            jobId: payload.jobId,
            clientId: payload.clientId,
            round: payload.round,
            type: payload.type ? mapInterviewUiTypeToBackend(String(payload.type)) : undefined,
            mode: payload.mode === 'Online' ? 'ONLINE' : 'OFFLINE',
            date: payload.date,
            duration: payload.duration,
            timezone: payload.timezone,
            meetingPlatform:
              payload.mode === 'Online' && payload.meetingPlatform
                ? payload.meetingPlatform === 'Zoom'
                  ? 'ZOOM'
                  : payload.meetingPlatform === 'Google Meet'
                    ? 'GOOGLE_MEET'
                    : 'MS_TEAMS'
                : null,
            location: payload.location,
            notes: payload.notes,
            panelUserIds: payload.panelUserIds,
          });
          setEditInterview(null);
          setScheduleOpen(false);
          sonnerToast.success('Interview updated');
          onChanged?.();
          const mapped = await refreshInterview(interviewId);
          if (mapped) drawer.openDrawer(mapped);
        }}
      />
    </>
  );
}
