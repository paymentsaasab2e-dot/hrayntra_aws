'use client';

import React from 'react';
import { CandidateScheduledInterview } from '../candidateProfileDrawerData';
import { Video, Phone, MapPin, Calendar, Briefcase, SquarePen } from 'lucide-react';
import { DrawerSectionCard } from '../drawerFormUi';
import { formatDateDMY } from '../../../utils/dateDisplay';
import { formatTimezoneDisplay, resolveIanaFromTimezoneValue } from '../../../utils/inferTimezone';
import { DrawerLinkActions } from '../DrawerLinkActions';
import { getAvatarInitials } from '../candidateProfileShared';

export function CandidateInterviewsTab(props: any) {
  const {
    candidate,
    existingInterviews,
    handleAction,
    setEditInterview,
    setShowScheduleInterviewModal,
  } = props;

  return (
(() => {
                  const interviews =
                    (existingInterviews.length ? existingInterviews : candidate.scheduledInterviews || []).slice();
                  interviews.sort((a: any, b: any) => {
                    const aTs = new Date(`${a.date} ${a.time}`).getTime();
                    const bTs = new Date(`${b.date} ${b.time}`).getTime();
                    return bTs - aTs;
                  });

                  const ModeIcon = ({ mode }: { mode: CandidateScheduledInterview['mode'] }) => {
                    if (mode === 'video') return <Video size={14} className="text-indigo-600" />;
                    if (mode === 'phone') return <Phone size={14} className="text-emerald-600" />;
                    return <MapPin size={14} className="text-amber-600" />;
                  };
                  const statusStyles: Record<CandidateScheduledInterview['status'], string> = {
                    scheduled: 'bg-blue-50 text-blue-700 ring-blue-200',
                    completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
                    cancelled: 'bg-rose-50 text-rose-700 ring-rose-200',
                  };

                  return (
                    <DrawerSectionCard
                      title="Interviews"
                      subtitle="Scheduled and completed interviews for this candidate"
                      icon={Calendar}
                      accent="amber"
                    >
                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => handleAction('schedule-interview')}
                          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        >
                          <Calendar size={16} />
                          Schedule Interview
                        </button>
                      </div>

                      <div className="space-y-3">
                        {interviews.length === 0 ? (
                          <div className="flex min-h-[14rem] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
                            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
                              <Calendar size={20} className="text-slate-400" />
                            </div>
                            <h4 className="text-sm font-semibold text-slate-800">No interviews scheduled</h4>
                            <p className="mt-1 max-w-sm text-sm text-slate-500">
                              Schedule an interview to track rounds, interviewers, and meeting details.
                            </p>
                          </div>
                        ) : (
                          interviews.map((it: any) => (
                            <div
                              key={it.id}
                              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                                      <ModeIcon mode={it.mode} />
                                      {it.mode === 'video' ? 'Video' : it.mode === 'phone' ? 'Phone' : 'In-person'}
                                    </span>
                                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${(statusStyles as Record<string, string>)[it.status]}`}>
                                      {it.status === 'scheduled' ? 'Scheduled' : it.status === 'completed' ? 'Completed' : 'Cancelled'}
                                    </span>
                                    <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                                      Round {it.round}
                                    </span>
                                    {it.jobTitle ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                                        <Briefcase size={12} />
                                        {it.jobTitle}
                                      </span>
                                    ) : null}
                                  </div>
                                  <h4 className="mt-3 text-sm font-semibold text-slate-900">{it.type}</h4>
                                  <p className="mt-1 text-sm text-slate-600">
                                    {formatDateDMY(it.date) || it.date} · {it.time} · {it.duration}
                                    {it.timezone
                                      ? ` · ${formatTimezoneDisplay(resolveIanaFromTimezoneValue(it.timezone))}`
                                      : ''}
                                  </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  {it.status !== 'completed' ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditInterview(it);
                                        setShowScheduleInterviewModal(true);
                                      }}
                                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                    >
                                      <SquarePen size={16} />
                                      Edit
                                    </button>
                                  ) : null}
                                  {it.meetingLink ? (
                                    <DrawerLinkActions url={it.meetingLink} shareTitle="Interview meeting link" />
                                  ) : null}
                                  {it.location ? (
                                    <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                                      <MapPin size={16} />
                                      <span className="max-w-[220px] truncate">{it.location}</span>
                                    </span>
                                  ) : null}
                                  {it.phoneNumber ? (
                                    <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                                      <Phone size={16} />
                                      {it.phoneNumber}
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              <div className="mt-4 border-t border-slate-200 pt-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                  Interview panel
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {it.interviewers.map((p: any) => (
                                    <span
                                      key={p.id}
                                      className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
                                    >
                                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[10px] font-semibold text-blue-700">
                                        {getAvatarInitials(p.name)}
                                      </span>
                                      <span className="truncate">{p.name}</span>
                                      <span className="text-slate-400">·</span>
                                      <span className="text-slate-500">{p.role}</span>
                                    </span>
                                  ))}
                                </div>
                                {it.notes ? (
                                  <p className="mt-3 text-sm text-slate-600">{it.notes}</p>
                                ) : null}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </DrawerSectionCard>
                  );
                })()
  );
}
