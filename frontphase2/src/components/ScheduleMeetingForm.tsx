'use client';

import React, { useEffect, useState } from 'react';
import { CalendarPlus, ChevronRight } from 'lucide-react';
import {
  apiCreateScheduledMeeting,
  apiGetClient,
  apiGetLead,
  apiGetLeadAssignableMembers,
  apiUpdateLead,
} from '../lib/api';
import { getActiveOrgUnitId } from '../lib/org/orgWorkspaceStorage';
import { requestError, requestWarning } from '../lib/appDialog';
import {
  buildFollowUpStatusRemark,
  LeadFollowUpScheduler,
  type LeadFollowUpScheduleFields,
} from './LeadFollowUpScheduler';
import type { TeamMember } from '../types/team';
import { isLocalDateTimeNotPast } from '../utils/dateInputConstraints';
import { startAsyncLoad } from '../lib/asyncLoadGuard';

export interface ScheduleMeetingFormProps {
  entityType: 'client' | 'lead';
  entityId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  showBackButton?: boolean;
  onBack?: () => void;
  title?: string;
  /** When true, omit outer card chrome (for embedding in a parent panel). */
  embedded?: boolean;
}

function isoFromDateAndTime(date: string, time: string): string {
  const dateTime = new Date(`${date}T${time}`);
  return Number.isNaN(dateTime.getTime()) ? '' : dateTime.toISOString();
}

function splitIso(iso: string): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${mi}` };
}

export function ScheduleMeetingForm({
  entityType,
  entityId,
  onSuccess,
  onCancel,
  showBackButton = false,
  onBack,
  title = 'Schedule Meeting / Follow-up',
  embedded = false,
}: ScheduleMeetingFormProps) {
  const [schedule, setSchedule] = useState<LeadFollowUpScheduleFields>({
    nextFollowUp: '',
    followUpType: 'Call',
    followUpContact: '',
    followUpMeetLink: '',
    followUpReminder: 'No reminder',
    followUpTimezone: 'Asia/Kolkata',
    followUpAttendeeIds: [],
    followUpNotes: '',
  });
  const [phoneOptions, setPhoneOptions] = useState<string[]>([]);
  const [emailOptions, setEmailOptions] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const load = startAsyncLoad(setLoadingMembers);
    const run = async () => {
      try {
        const response = await apiGetLeadAssignableMembers(getActiveOrgUnitId() || undefined);
        const members = Array.isArray(response?.data) ? response.data : [];
        if (load.isActive()) {
          setTeamMembers(
            members.map((member) => ({
              id: member.id,
              firstName: member.firstName,
              lastName: member.lastName,
              name:
                member.name ||
                `${member.firstName || ''} ${member.lastName || ''}`.trim() ||
                member.email ||
                'User',
              email: member.email || '',
              role: member.role
                ? {
                    id: member.role.id,
                    roleName: member.role.roleName || '',
                    color: member.role.color,
                  }
                : undefined,
              department: member.department
                ? { id: member.department.id, name: member.department.name || '' }
                : undefined,
              status: 'ACTIVE' as const,
            })),
          );
        }
      } catch {
        if (load.isActive()) setTeamMembers([]);
      } finally {
        load.finish();
      }

      if (!load.isActive()) return;

      if (entityType === 'lead' && entityId) {
        try {
          const leadRes = await apiGetLead(entityId);
          const lead = leadRes?.data as any;
          if (!lead || !load.isActive()) return;
          const phones = [
            ...(Array.isArray(lead.phones) ? lead.phones : []),
            lead.phone,
            lead.teamMemberPhone,
          ].filter(Boolean);
          const emails = [
            ...(Array.isArray(lead.emails) ? lead.emails : []),
            lead.email,
            lead.teamMemberEmail,
          ].filter(Boolean);
          setPhoneOptions(phones.map(String));
          setEmailOptions(emails.map(String));
        } catch {
          /* ignore */
        }
      } else if (entityType === 'client' && entityId) {
        try {
          const clientRes = await apiGetClient(entityId);
          const client = (clientRes?.data ?? clientRes) as any;
          if (!client || !load.isActive()) return;
          const phones = [
            ...(Array.isArray(client.phones) ? client.phones : []),
            client.teamMemberPhone,
          ].filter(Boolean);
          const emails = [
            ...(Array.isArray(client.emails) ? client.emails : []),
            client.teamMemberEmail,
          ].filter(Boolean);
          setPhoneOptions(phones.map(String));
          setEmailOptions(emails.map(String));
        } catch {
          /* ignore */
        }
      }
    };
    void run();
    return () => {
      load.abort();
    };
  }, [entityType, entityId]);

  const resetForm = () => {
    setSchedule({
      nextFollowUp: '',
      followUpType: 'Call',
      followUpContact: '',
      followUpMeetLink: '',
      followUpReminder: 'No reminder',
      followUpTimezone: 'Asia/Kolkata',
      followUpAttendeeIds: [],
      followUpNotes: '',
    });
  };

  const handleSubmit = async () => {
    if (!entityId) {
      void requestWarning(`No ${entityType} selected`);
      return;
    }

    const { date, time } = splitIso(schedule.nextFollowUp);
    if (!date || !time) {
      void requestWarning('Please select both date and time for the meeting/follow-up');
      return;
    }

    if (!isLocalDateTimeNotPast(date, time)) {
      void requestWarning('Please choose a date and time in the future.');
      return;
    }

    setIsSubmitting(true);
    try {
      const isoDateTime = isoFromDateAndTime(date, time) || schedule.nextFollowUp;
      const resolvedType = schedule.followUpType || 'General';

      if (entityType === 'client') {
        await apiCreateScheduledMeeting(entityId, {
          meetingType: resolvedType,
          scheduledAt: isoDateTime,
          reminder:
            schedule.followUpReminder && schedule.followUpReminder !== 'No reminder'
              ? schedule.followUpReminder
              : undefined,
          notes: buildFollowUpStatusRemark({ ...schedule, nextFollowUp: isoDateTime }),
          followUpSchedule: {
            type: schedule.followUpType || resolvedType,
            contact: schedule.followUpContact,
            meetLink: schedule.followUpMeetLink,
            reminder: schedule.followUpReminder,
            timezone: schedule.followUpTimezone,
            attendeeIds: schedule.followUpAttendeeIds,
            notes: schedule.followUpNotes,
          },
        });
      } else {
        await apiUpdateLead(entityId, {
          nextFollowUp: isoDateTime,
          statusRemark: buildFollowUpStatusRemark({ ...schedule, nextFollowUp: isoDateTime }),
          followUpSchedule: {
            type: schedule.followUpType || 'General',
            contact: schedule.followUpContact,
            meetLink: schedule.followUpMeetLink,
            reminder: schedule.followUpReminder,
            timezone: schedule.followUpTimezone,
            attendeeIds: schedule.followUpAttendeeIds,
            notes: schedule.followUpNotes,
          },
        } as any);
      }

      resetForm();
      onSuccess?.();
    } catch (error: any) {
      console.error(`Failed to schedule ${entityType === 'client' ? 'meeting' : 'follow-up'}:`, error);
      void requestError(
        error.message || `Failed to schedule ${entityType === 'client' ? 'meeting' : 'follow-up'}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    resetForm();
    onCancel?.();
  };

  return (
    <div className="space-y-5">
      {(showBackButton || onBack) && (
        <div className="mb-4 flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="-ml-2 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              title="Back"
            >
              <ChevronRight size={20} className="rotate-180" />
            </button>
          )}
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        </div>
      )}
      <div
        className={
          embedded
            ? 'space-y-5'
            : 'space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm'
        }
      >
        <LeadFollowUpScheduler
          value={schedule}
          onChange={(patch) => setSchedule((p) => ({ ...p, ...patch }))}
          phoneOptions={phoneOptions}
          emailOptions={emailOptions}
          teamMembers={teamMembers}
          loadingMembers={loadingMembers}
          showPostpone={false}
        />
      </div>
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CalendarPlus size={16} />
          {isSubmitting
            ? 'Scheduling...'
            : entityType === 'client'
              ? 'Schedule Meeting'
              : 'Schedule Follow-up'}
        </button>
      </div>
    </div>
  );
}
