'use client';

import React, { useState } from 'react';
import { CalendarPlus, ChevronDown, ChevronRight } from 'lucide-react';
import { apiCreateScheduledMeeting, apiUpdateLead, type CreateScheduledMeetingData } from '../lib/api';

export interface ScheduleMeetingFormProps {
  entityType: 'client' | 'lead';
  entityId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  showBackButton?: boolean;
  onBack?: () => void;
  title?: string;
}

const MEETING_TYPES = ['Call', 'WhatsApp', 'Email', 'Meeting', 'Follow-up'];
const REMINDER_OPTIONS = ['10 minutes before', '30 minutes before', '1 hour before', '1 day before'];

export function ScheduleMeetingForm({
  entityType,
  entityId,
  onSuccess,
  onCancel,
  showBackButton = false,
  onBack,
  title = 'Schedule Meeting / Follow-up',
}: ScheduleMeetingFormProps) {
  const [formData, setFormData] = useState({
    meetingType: '',
    date: '',
    time: '',
    reminder: '',
    notes: '',
  });
  const [meetingTypeDropdownOpen, setMeetingTypeDropdownOpen] = useState(false);
  const [reminderDropdownOpen, setReminderDropdownOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!entityId) {
      alert(`No ${entityType} selected`);
      return;
    }

    if (!formData.date || !formData.time) {
      alert('Please select both date and time for the meeting/follow-up');
      return;
    }

    setIsSubmitting(true);
    try {
      const dateTime = new Date(`${formData.date}T${formData.time}`);
      const isoDateTime = dateTime.toISOString();

      if (entityType === 'client') {
        // Use scheduled meetings API for clients
        await apiCreateScheduledMeeting(entityId, {
          meetingType: formData.meetingType,
          scheduledAt: isoDateTime,
          reminder: formData.reminder || undefined,
          notes: formData.notes || undefined,
        });
      } else {
        // For leads, update the lead's nextFollowUp field
        const updateData: any = {
          nextFollowUp: isoDateTime,
          statusRemark: formData.notes
            ? `Follow-up scheduled: ${formData.meetingType || 'General'} on ${formData.date} at ${formData.time}. ${formData.notes}`
            : `Follow-up scheduled: ${formData.meetingType || 'General'} on ${formData.date} at ${formData.time}`,
        };
        await apiUpdateLead(entityId, updateData);
      }

      // Reset form
      setFormData({ meetingType: '', date: '', time: '', reminder: '', notes: '' });
      
      // Call success callback
      onSuccess?.();
    } catch (error: any) {
      console.error(`Failed to schedule ${entityType === 'client' ? 'meeting' : 'follow-up'}:`, error);
      alert(error.message || `Failed to schedule ${entityType === 'client' ? 'meeting' : 'follow-up'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData({ meetingType: '', date: '', time: '', reminder: '', notes: '' });
    onCancel?.();
  };

  return (
    <div className="space-y-5">
      {(showBackButton || onBack) && (
        <div className="flex items-center gap-3 mb-4">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="Back"
            >
              <ChevronRight size={20} className="rotate-180" />
            </button>
          )}
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        </div>
      )}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            {entityType === 'client' ? 'Meeting Type' : 'Follow-up Type'}
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setMeetingTypeDropdownOpen((v) => !v);
                setReminderDropdownOpen(false);
              }}
              className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <span className={formData.meetingType ? 'text-slate-900' : 'text-slate-400'}>
                {formData.meetingType || 'Select type'}
              </span>
              <ChevronDown size={16} className="text-slate-400" />
            </button>
            {meetingTypeDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMeetingTypeDropdownOpen(false)}
                  aria-hidden
                />
                <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg max-h-48 overflow-y-auto">
                  {MEETING_TYPES.map((name) => (
                    <li key={name}>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((p) => ({ ...p, meetingType: name }));
                          setMeetingTypeDropdownOpen(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${
                          formData.meetingType === name
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-slate-700'
                        }`}
                      >
                        {name}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="schedule-date" className="block text-sm font-medium text-slate-700 mb-2">
              Date
            </label>
            <input
              id="schedule-date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="schedule-time" className="block text-sm font-medium text-slate-700 mb-2">
              Time
            </label>
            <input
              id="schedule-time"
              type="time"
              value={formData.time}
              onChange={(e) => setFormData((p) => ({ ...p, time: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Reminder</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setReminderDropdownOpen((v) => !v);
                setMeetingTypeDropdownOpen(false);
              }}
              className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <span className={formData.reminder ? 'text-slate-900' : 'text-slate-400'}>
                {formData.reminder || 'Select reminder'}
              </span>
              <ChevronDown size={16} className="text-slate-400" />
            </button>
            {reminderDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setReminderDropdownOpen(false)}
                  aria-hidden
                />
                <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg max-h-48 overflow-y-auto">
                  {REMINDER_OPTIONS.map((opt) => (
                    <li key={opt}>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((p) => ({ ...p, reminder: opt }));
                          setReminderDropdownOpen(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${
                          formData.reminder === opt
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-slate-700'
                        }`}
                      >
                        {opt}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
        <div>
          <label htmlFor="schedule-notes" className="block text-sm font-medium text-slate-700 mb-2">
            Notes
          </label>
          <textarea
            id="schedule-notes"
            rows={4}
            value={formData.notes}
            onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
            placeholder={`Add notes for this ${entityType === 'client' ? 'meeting' : 'follow-up'}...`}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
          />
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={handleCancel}
          className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
