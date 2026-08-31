'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { ClipboardList, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { TeamRequest } from '../../types/team';
import {
  forwardTeamRequestToTask,
  getCurrentUserRequestIdentity,
  updateTeamRequestStatus,
} from '../../lib/api/teamApi';
import { apiGetTaskAssignableMembers } from '../../lib/api';
import { getLocalDateInputMinToday } from '../../utils/dateInputConstraints';
import { useAssignableMembers } from '../../hooks/useAssignableMembers';
import { AssignCompanySelect } from '../assign/AssignCompanySelect';

export type TeamRequestDrawerMode = 'approve' | 'assign' | 'view';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  request: TeamRequest | null;
  mode: TeamRequestDrawerMode;
  onSuccess?: (updated: TeamRequest) => void;
};

function memberLabel(member: {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}) {
  const full = `${member.firstName || ''} ${member.lastName || ''}`.trim();
  return member.name?.trim() || full || member.email || 'Team member';
}

export function TeamRequestActionDrawer({
  isOpen,
  onClose,
  request,
  mode,
  onSuccess,
}: Props) {
  const router = useRouter();
  const [assignToId, setAssignToId] = useState('');
  const [dueDate, setDueDate] = useState(() => getLocalDateInputMinToday());
  const [setSelfAsApprover, setSetSelfAsApprover] = useState(true);
  const [reviewNote, setReviewNote] = useState('');
  const [assignees, setAssignees] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const assignable = useAssignableMembers(isOpen, 'Tasks');

  const currentUserId = getCurrentUserRequestIdentity().id || '';

  const assignToSelf = Boolean(assignToId && currentUserId && assignToId === currentUserId);

  const canAssign = mode === 'assign' || mode === 'approve';
  const showAssignForm = canAssign && !request?.linkedTaskId;

  useEffect(() => {
    if (!isOpen) {
      setAssignToId('');
      setDueDate(getLocalDateInputMinToday());
      setSetSelfAsApprover(true);
      setReviewNote('');
      return;
    }

    if (assignable.canSelectCompany) {
      setAssignees(
        assignable.members.map((member) => ({
          id: member.id,
          name: memberLabel(member),
        })),
      );
      setLoadingMembers(assignable.loading);
      return;
    }

    setLoadingMembers(true);
    void apiGetTaskAssignableMembers()
      .then((response) => {
        const rows = Array.isArray(response.data) ? response.data : [];
        setAssignees(
          rows.map((member) => ({
            id: member.id,
            name: memberLabel(member),
          })),
        );
      })
      .catch(() => setAssignees([]))
      .finally(() => setLoadingMembers(false));
  }, [isOpen, assignable.canSelectCompany, assignable.loading, assignable.members]);

  const handleSubmit = async () => {
    if (!request) return;
    if (showAssignForm && !assignToId) {
      toast.error('Select a team member to assign this task');
      return;
    }

    if (showAssignForm && !dueDate) {
      toast.error('Task due date is required');
      return;
    }

    setSubmitting(true);
    try {
      let workingRequest = request;

      if (mode === 'approve' && request.status === 'pending') {
        const approved = await updateTeamRequestStatus(request.id, {
          status: 'approved',
          reviewNote: reviewNote.trim() || undefined,
        });
        workingRequest = approved.data;
      }

      if (showAssignForm) {
        const assigned = await forwardTeamRequestToTask(request.id, assignToId, {
          setSelfAsApprover: assignToSelf ? false : setSelfAsApprover,
          dueDate,
        });
        workingRequest = assigned.data;
        toast.success('Request approved and task assigned');
        onSuccess?.(workingRequest);
        onClose();
        if (workingRequest.linkedTaskId) {
          router.push(`/Task&Activites?taskId=${encodeURIComponent(workingRequest.linkedTaskId)}`);
        }
        return;
      }

      toast.success(mode === 'approve' ? 'Request approved' : 'Saved');
      onSuccess?.(workingRequest);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !request) return null;

  const title =
    mode === 'approve'
      ? 'Approve & assign task'
      : mode === 'assign'
        ? 'Assign task'
        : 'Request details';

  const submitLabel =
    mode === 'approve'
      ? 'Approve & assign task'
      : mode === 'assign'
        ? 'Assign task'
        : 'Close';

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed right-0 top-0 z-[61] flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                  Hiring request
                </p>
                <h2 className="mt-0.5 text-lg font-bold text-slate-900">{title}</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Subject</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{request.subject}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">From</p>
                  <p className="mt-1 text-sm text-slate-800">{request.requestedByName || '—'}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Priority</p>
                    <p className="mt-1 text-sm capitalize text-slate-800">{request.priority}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Status</p>
                    <p className="mt-1 text-sm capitalize text-slate-800">{request.status}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Description</p>
                  <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{request.description}</p>
                </div>
                {request.reviewNote ? (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Review note</p>
                    <p className="mt-1 text-sm text-slate-700">{request.reviewNote}</p>
                  </div>
                ) : null}
              </div>

              {mode === 'approve' && request.status === 'pending' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Approval note <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Optional remark"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              ) : null}

              {showAssignForm ? (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-indigo-800">
                    <ClipboardList size={16} />
                    <p className="text-sm font-semibold">Assign task to team member</p>
                  </div>
                  <p className="text-xs text-slate-600">
                    Choose yourself or a team member who will work on this request. You can verify completion yourself when assigning to someone else.
                  </p>
                  <div>
                    {assignable.canSelectCompany ? (
                      <AssignCompanySelect
                        companies={assignable.companies}
                        value={assignable.companyId}
                        onChange={(id) => {
                          assignable.setCompanyId(id);
                          setAssignToId('');
                        }}
                        className="mb-3"
                      />
                    ) : null}
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Assign to</label>
                    <select
                      value={assignToId}
                      onChange={(e) => setAssignToId(e.target.value)}
                      disabled={loadingMembers}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">
                        {loadingMembers ? 'Loading team members…' : 'Select team member…'}
                      </option>
                      {assignees.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                          {member.id === currentUserId ? ' (Me)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Task due date</label>
                    <input
                      type="date"
                      value={dueDate}
                      min={getLocalDateInputMinToday()}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  {assignToSelf ? (
                    <p className="text-xs text-slate-500">
                      Assigning to yourself — completion verification is not needed.
                    </p>
                  ) : (
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={setSelfAsApprover}
                        onChange={(e) => setSetSelfAsApprover(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      I will verify completion when the job is created
                    </label>
                  )}
                </div>
              ) : request.linkedTaskId ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  A task has already been created for this request.
                </div>
              ) : null}
            </div>

            <div className="border-t border-slate-200 px-5 py-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              {mode === 'view' && request.linkedTaskId ? (
                <button
                  type="button"
                  onClick={() => {
                    router.push(`/Task&Activites?taskId=${encodeURIComponent(request.linkedTaskId || '')}`);
                    onClose();
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  <ClipboardList size={16} />
                  Open task
                </button>
              ) : showAssignForm ? (
                <button
                  type="button"
                  disabled={submitting || !assignToId}
                  onClick={() => void handleSubmit()}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                  {submitLabel}
                </button>
              ) : null}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
