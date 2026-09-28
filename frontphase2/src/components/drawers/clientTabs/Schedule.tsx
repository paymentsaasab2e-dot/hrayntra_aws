'use client';

import React from 'react';
import { formatDateDMY, formatTime12hEnGb } from '../../../utils/dateDisplay';
import { CalendarPlus, Calendar, Clock, Bell, User, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { ScheduleMeetingForm } from '../../ScheduleMeetingForm';
import { apiGetClientScheduledMeetings, apiUpdateScheduledMeeting, apiDeleteScheduledMeeting } from '../../../lib/api';
import { ImageWithFallback } from '../../ImageWithFallback';
import { requestError, requestConfirm } from '../../../lib/appDialog';

export function ClientScheduleTab(props: any) {
  const {
    client,
    loadingMeetings,
    meetingStatusFilter,
    scheduledMeetings,
    setMeetingStatusFilter,
    setScheduledMeetings,
    setShowScheduleMeetingForm,
    showScheduleMeetingForm,
  } = props;

const filteredMeetings = meetingStatusFilter === 'All'
                    ? scheduledMeetings
                    : scheduledMeetings.filter((m: any) => m.status === meetingStatusFilter);
const sortedMeetings = [...filteredMeetings].sort((a: any, b: any) => {
                    const dateA = new Date(a.scheduledAt).getTime();
                    const dateB = new Date(b.scheduledAt).getTime();
                    return dateA - dateB;
                  });
const formatDateTime = (dateString: string) => {
                    const date = new Date(dateString);
                    return {
                      date: formatDateDMY(date),
                      time: formatTime12hEnGb(date),
                    };
                  };
const getStatusBadgeStyle = (status: string) => {
                    switch (status) {
                      case 'SCHEDULED':
                        return 'bg-blue-100 text-blue-700 border-blue-200';
                      case 'COMPLETED':
                        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
                      case 'CANCELLED':
                        return 'bg-red-100 text-red-700 border-red-200';
                      case 'RESCHEDULED':
                        return 'bg-amber-100 text-amber-700 border-amber-200';
                      default:
                        return 'bg-slate-100 text-slate-700 border-slate-200';
                    }
                  };

  return (
<div className="space-y-4">
                      {/* Top bar: Schedule Meeting button + status filters */}
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => setShowScheduleMeetingForm(true)}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <CalendarPlus size={16} />
                            Schedule Meeting / Follow-up
                          </button>
                          <div className="flex flex-wrap items-center gap-2 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                            {(['All', 'SCHEDULED', 'COMPLETED', 'CANCELLED'] as const).map((status: any) => (
                              <button
                                key={status}
                                type="button"
                                onClick={() => setMeetingStatusFilter(status)}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 ${meetingStatusFilter === status ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                              >
                                {status}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Schedule Meeting Form */}
                      {showScheduleMeetingForm && (
                        <ScheduleMeetingForm
                          entityType="client"
                          entityId={client?.id || ''}
                          onSuccess={async () => {
                            setShowScheduleMeetingForm(false);
                            // Refresh scheduled meetings list
                            if (client?.id) {
                              try {
                                const meetings = await apiGetClientScheduledMeetings(client.id);
                                setScheduledMeetings(meetings.data || []);
                              } catch (error) {
                                console.error('Failed to refresh meetings:', error);
                              }
                            }
                          }}
                          onCancel={() => setShowScheduleMeetingForm(false)}
                        />
                      )}

                      {/* Meetings list */}
                      {!showScheduleMeetingForm && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scheduled Meetings</h4>
                            <p className="text-xs text-slate-500">{filteredMeetings.length} {filteredMeetings.length === 1 ? 'meeting' : 'meetings'}</p>
                          </div>
                          <div className="p-4 max-h-[500px] overflow-y-auto space-y-3">
                            {loadingMeetings ? (
                              <div className="py-8 text-center text-sm text-slate-500">Loading meetings...</div>
                            ) : sortedMeetings.length === 0 ? (
                              <div className="py-8 text-center text-sm text-slate-500">
                                {meetingStatusFilter === 'All' 
                                  ? 'No scheduled meetings. Click "Schedule Meeting / Follow-up" to create one.'
                                  : `No ${meetingStatusFilter.toLowerCase()} meetings.`}
                              </div>
                            ) : (
                              sortedMeetings.map((meeting: any) => {
                                const { date, time } = formatDateTime(meeting.scheduledAt);
                                const scheduledByName = meeting.scheduledBy
                                  ? `${meeting.scheduledBy.firstName || ''} ${meeting.scheduledBy.lastName || ''}`.trim() || meeting.scheduledBy.email
                                  : 'Unknown';
                                
                                return (
                                  <div
                                    key={meeting.id}
                                    className="rounded-xl border border-slate-200 bg-slate-50/80 hover:border-slate-300 p-4 transition-colors"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                          <h5 className="text-sm font-semibold text-slate-900">{meeting.meetingType}</h5>
                                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${getStatusBadgeStyle(meeting.status)}`}>
                                            {meeting.status}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-slate-600 mb-2">
                                          <span className="flex items-center gap-1">
                                            <Calendar size={12} className="text-slate-400" />
                                            {date}
                                          </span>
                                          <span className="flex items-center gap-1">
                                            <Clock size={12} className="text-slate-400" />
                                            {time}
                                          </span>
                                        </div>
                                        {meeting.reminder && (
                                          <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
                                            <Bell size={12} className="text-slate-400" />
                                            Reminder: {meeting.reminder}
                                          </div>
                                        )}
                                        {meeting.notes && (
                                          <p className="text-xs text-slate-600 mt-2 line-clamp-2">{meeting.notes}</p>
                                        )}
                                        <div className="flex items-center gap-2 mt-2">
                                          {meeting.scheduledBy?.avatar ? (
                                            <ImageWithFallback 
                                              src={meeting.scheduledBy.avatar} 
                                              alt={scheduledByName} 
                                              className="w-5 h-5 rounded-full border border-slate-200 shrink-0" 
                                            />
                                          ) : (
                                            <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                                              <User size={10} className="text-slate-500" />
                                            </div>
                                          )}
                                          <span className="text-[11px] font-medium text-slate-600">Scheduled by {scheduledByName}</span>
                                          <span className="text-[11px] text-slate-400">·</span>
                                          <span className="text-[11px] text-slate-500">
                                            {formatDateDMY(meeting.createdAt)}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        {meeting.status === 'SCHEDULED' && (
                                          <>
                                            <button
                                              type="button"
                                              onClick={async () => {
                                                if (!client?.id) return;
                                                try {
                                                  await apiUpdateScheduledMeeting(client.id, meeting.id, { status: 'COMPLETED' });
                                                  const meetings = await apiGetClientScheduledMeetings(client.id);
                                                  setScheduledMeetings(meetings.data || []);
                                                } catch (error) {
                                                  console.error('Failed to mark as completed:', error);
                                                  void requestError('Failed to update meeting status');
                                                }
                                              }}
                                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                              title="Mark as completed"
                                            >
                                              <CheckCircle size={14} />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={async () => {
                                                if (!client?.id) return;
                                                if (!(await requestConfirm('Are you sure you want to cancel this meeting?'))) return;
                                                try {
                                                  await apiUpdateScheduledMeeting(client.id, meeting.id, { status: 'CANCELLED' });
                                                  const meetings = await apiGetClientScheduledMeetings(client.id);
                                                  setScheduledMeetings(meetings.data || []);
                                                } catch (error) {
                                                  console.error('Failed to cancel meeting:', error);
                                                  void requestError('Failed to cancel meeting');
                                                }
                                              }}
                                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                              title="Cancel"
                                            >
                                              <XCircle size={14} />
                                            </button>
                                          </>
                                        )}
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            if (!client?.id) return;
                                            if (!(await requestConfirm('Are you sure you want to delete this meeting?'))) return;
                                            try {
                                              await apiDeleteScheduledMeeting(client.id, meeting.id);
                                              const meetings = await apiGetClientScheduledMeetings(client.id);
                                              setScheduledMeetings(meetings.data || []);
                                            } catch (error) {
                                              console.error('Failed to delete meeting:', error);
                                              void requestError('Failed to delete meeting');
                                            }
                                          }}
                                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                          title="Delete"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
  );
}
