'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DrawerCloseButton } from '../drawers/DrawerCloseButton';
import { createTeamRequest, getTeamMembersForRequestPicker } from '../../lib/api/teamApi';
import type {
  CreateTeamRequestPayload,
  TeamMember,
  TeamRequest,
  TeamRequestPriority,
} from '../../types/team';

const PRIORITY_OPTIONS: Array<{ value: TeamRequestPriority; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const INPUT_CLASS =
  'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20';

type RequestFormState = {
  sendToId: string;
  subject: string;
  description: string;
  priority: TeamRequestPriority;
};

function getMemberLabel(member: TeamMember) {
  const fromParts = [member.firstName, member.lastName].filter(Boolean).join(' ').trim();
  const fromName = String((member as TeamMember & { name?: string }).name || '').trim();
  const name = fromParts || fromName || member.email || 'Unnamed member';
  const suffix = member.designation || member.role?.roleName;
  return suffix ? `${name} — ${suffix}` : name;
}

interface TeamRequestDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (request: TeamRequest) => void;
}

export function TeamRequestDrawer({ isOpen, onClose, onSuccess }: TeamRequestDrawerProps) {
  const [formData, setFormData] = useState<RequestFormState>({
    sendToId: '',
    subject: '',
    description: '',
    priority: 'medium',
  });
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const recipientOptions = useMemo(() => {
    return teamMembers
      .map((member) => ({
        id: member.id,
        email: member.email,
        label: getMemberLabel(member),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [teamMembers]);

  useEffect(() => {
    if (!isOpen) return;

    setFormData({
      sendToId: '',
      subject: '',
      description: '',
      priority: 'medium',
    });
    setErrors({});
    setIsSubmitting(false);

    let cancelled = false;
    const loadMembers = async () => {
      setLoadingMembers(true);
      try {
        const members = await getTeamMembersForRequestPicker();
        if (!cancelled) {
          setTeamMembers(Array.isArray(members) ? members : []);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'Failed to load team members');
          setTeamMembers([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingMembers(false);
        }
      }
    };

    void loadMembers();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!formData.sendToId.trim()) {
      nextErrors.sendToId = 'Send to is required';
    }
    if (!formData.subject.trim()) {
      nextErrors.subject = 'Subject is required';
    }
    if (!formData.description.trim()) {
      nextErrors.description = 'Description is required';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const recipient = teamMembers.find((member) => member.id === formData.sendToId);
    if (!recipient) {
      setErrors((prev) => ({ ...prev, sendToId: 'Select a valid team member' }));
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateTeamRequestPayload = {
        sendToId: formData.sendToId,
        sendToName: getMemberLabel(recipient),
        sendToEmail: recipient.email,
        subject: formData.subject.trim(),
        description: formData.description.trim(),
        priority: formData.priority || 'medium',
      };
      const res = await createTeamRequest(payload);
      toast.success('Request sent successfully');
      onSuccess(res.data);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-slate-900/40"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed right-0 top-0 z-[100] flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Send Request</h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  Send a request to a team member.
                </p>
              </div>
              <DrawerCloseButton onClick={onClose} disabled={isSubmitting} />
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Send To
                </label>
                {loadingMembers ? (
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-500">
                    <Loader2 className="size-4 animate-spin text-indigo-600" />
                    Loading team members…
                  </div>
                ) : (
                  <select
                    value={formData.sendToId}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, sendToId: event.target.value }))
                    }
                    className={`${INPUT_CLASS} ${errors.sendToId ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-500/20' : ''}`}
                  >
                    <option value="">Select team member</option>
                    {recipientOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
                {errors.sendToId ? (
                  <p className="mt-1 text-xs text-rose-600">{errors.sendToId}</p>
                ) : null}
                {!loadingMembers && recipientOptions.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-500">No team members available.</p>
                ) : null}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Priority
                </label>
                <select
                  value={formData.priority || 'medium'}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      priority: event.target.value as TeamRequestPriority,
                    }))
                  }
                  className={INPUT_CLASS}
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Subject
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, subject: event.target.value }))
                  }
                  placeholder="Brief summary of your request"
                  className={`${INPUT_CLASS} ${errors.subject ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-500/20' : ''}`}
                />
                {errors.subject ? (
                  <p className="mt-1 text-xs text-rose-600">{errors.subject}</p>
                ) : null}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Description
                </label>
                <textarea
                  rows={5}
                  value={formData.description}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, description: event.target.value }))
                  }
                  placeholder="Provide details about what you need"
                  className={`${INPUT_CLASS} resize-y ${errors.description ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-500/20' : ''}`}
                />
                {errors.description ? (
                  <p className="mt-1 text-xs text-rose-600">{errors.description}</p>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4 sm:px-6">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting || loadingMembers || recipientOptions.length === 0}
                onClick={() => void handleSubmit()}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  'Send Request'
                )}
              </button>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
