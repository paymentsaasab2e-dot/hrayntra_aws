'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { ClipboardList, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  getCurrentUserRequestIdentity,
  reviewCrossDeptRequest,
  type CrossDepartmentWorkRequest,
  type CrossDeptTargetMember,
} from '../../lib/api/teamApi';
import { getLocalDateInputMinToday } from '../../utils/dateInputConstraints';

export type CrossDeptRequestDrawerMode = 'accept' | 'view';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  request: CrossDepartmentWorkRequest | null;
  members: CrossDeptTargetMember[];
  mode: CrossDeptRequestDrawerMode;
  onSuccess?: (updated: CrossDepartmentWorkRequest) => void;
};

function memberLabel(member: CrossDeptTargetMember) {
  return member.name?.trim() || member.email || 'Team member';
}

export function CrossDeptRequestActionDrawer({
  isOpen,
  onClose,
  request,
  members,
  mode,
  onSuccess,
}: Props) {
  const router = useRouter();
  const [assignToId, setAssignToId] = useState('');
  const [dueDate, setDueDate] = useState(() => getLocalDateInputMinToday());
  const [setSelfAsApprover, setSetSelfAsApprover] = useState(true);
  const [reviewNote, setReviewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentUserId = getCurrentUserRequestIdentity().id || '';

  const assignOptions = useMemo(() => {
    const rows = members.filter((member) => member.id !== currentUserId);
    if (rows.length > 0) return rows;
    return members;
  }, [members, currentUserId]);

  const needsAssignment =
    request?.workType === 'CLIENT' || request?.workType === 'TASK';
  const showAssignForm = mode === 'accept' && needsAssignment && !request?.createdTaskId;

  useEffect(() => {
    if (!isOpen) {
      setAssignToId('');
      setDueDate(getLocalDateInputMinToday());
      setSetSelfAsApprover(true);
      setReviewNote('');
      return;
    }

    if (request?.targetUserId) {
      setAssignToId(request.targetUserId);
    } else if (assignOptions.length === 1) {
      setAssignToId(assignOptions[0].id);
    }
  }, [isOpen, request?.targetUserId, assignOptions]);

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
      const updated = await reviewCrossDeptRequest(request.id, {
        action: 'accept',
        note: reviewNote.trim() || undefined,
        assignToId: showAssignForm ? assignToId : request.targetUserId || undefined,
        dueDate: showAssignForm ? dueDate : undefined,
        setSelfAsApprover: showAssignForm ? setSelfAsApprover : undefined,
      });
      toast.success('Request accepted and task assigned');
      onSuccess?.(updated);
      onClose();
      if (updated.createdTaskId) {
        router.push(`/Task&Activites?taskId=${encodeURIComponent(updated.createdTaskId)}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !request) return null;

  const workTypeLabel =
    request.workType === 'CLIENT' ? 'Client handoff' : 'Cross-department work';

  const title = mode === 'accept' ? 'Accept & assign task' : 'Request details';

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
                  {workTypeLabel}
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
                {request.description ? (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Handoff remark (task description)
                    </p>
                    <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{request.description}</p>
                  </div>
                ) : null}
              </div>

              {mode === 'accept' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Acceptance note <span className="text-slate-400 font-normal">(optional)</span>
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
                    <p className="text-sm font-semibold">Assign task to department member</p>
                  </div>
                  <p className="text-xs text-slate-600">
                    Pick any active member in your department. The handoff remark above becomes the task
                    description.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Assign to</label>
                    <select
                      value={assignToId}
                      onChange={(e) => setAssignToId(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Select team member…</option>
                      {assignOptions.map((member) => (
                        <option key={member.id} value={member.id}>
                          {memberLabel(member)}
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
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={setSelfAsApprover}
                      onChange={(e) => setSetSelfAsApprover(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    I will verify completion when the work is done
                  </label>
                </div>
              ) : request.createdTaskId ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  A task has already been created for this handoff.
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
              {mode === 'view' && request.createdTaskId ? (
                <button
                  type="button"
                  onClick={() => {
                    router.push(`/Task&Activites?taskId=${encodeURIComponent(request.createdTaskId || '')}`);
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
                  Accept & assign task
                </button>
              ) : mode === 'accept' ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleSubmit()}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                  Accept request
                </button>
              ) : null}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
