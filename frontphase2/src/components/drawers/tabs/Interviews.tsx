'use client';

import React from 'react';
import { DrawerSectionCard, DRAWER_TABLE_SHELL, DRAWER_TABLE_SCROLL, DRAWER_TABLE_HEAD_ROW, DRAWER_TABLE_TH, DRAWER_TABLE_BODY, DRAWER_TABLE_TD, DRAWER_TABLE_TR } from '../drawerFormUi';
import { Calendar, Loader2 } from 'lucide-react';
import { InterviewRoundTabs } from '../../interviews/InterviewRoundTabs';
import { formatTimezoneDisplay, resolveIanaFromTimezoneValue } from '../../../utils/inferTimezone';
import { formatInterviewDateInTimezone, formatInterviewTimeInTimezone } from '../../../lib/interview-schedule-helpers';
import type { InterviewsTabProps } from '../jobDrawerTabProps';

export function InterviewsTab(props: InterviewsTabProps) {
  const {
    candidateNameFromInterview,
    filteredJobInterviews,
    formatInterviewListStatus,
    formatInterviewTypeLabel,
    interviewListStatusBadgeClass,
    jobInterviewAllCandidateCount,
    jobInterviewCountsByRound,
    jobInterviewRoundById,
    jobInterviewRoundNumbers,
    jobInterviews,
    loadingJobInterviews,
    onScheduleInterview,
    openScheduleInterviewCandidatePicker,
    panelNamesFromInterview,
    selectedInterviewRound,
    setJobInterviewDetailOpen,
    setSelectedInterviewRound,
    setSelectedJobInterview,
  } = props;

  return (
<DrawerSectionCard
                  title="Interviews"
                  subtitle="Scheduled and completed interviews for this job"
                  icon={Calendar}
                  accent="amber"
                  headerRight={
                    onScheduleInterview ? (
                      <button
                        type="button"
                        onClick={() => void openScheduleInterviewCandidatePicker()}
                        className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700"
                        title="Schedule interview for candidates assigned to this job"
                      >
                        <Calendar size={14} strokeWidth={2.25} />
                        Schedule Interview
                      </button>
                    ) : null
                  }
                >
                  <div className="space-y-3">
                    {!loadingJobInterviews && jobInterviews.length > 0 ? (
                      <InterviewRoundTabs
                        rounds={jobInterviewRoundNumbers}
                        active={selectedInterviewRound}
                        onChange={setSelectedInterviewRound}
                        countsByRound={jobInterviewCountsByRound}
                        allCount={jobInterviewAllCandidateCount}
                      />
                    ) : null}
                    <div className={DRAWER_TABLE_SHELL}>
                    <div className={DRAWER_TABLE_SCROLL}>
                      <table className="w-full min-w-[780px] border-collapse text-left">
                        <thead>
                          <tr className={DRAWER_TABLE_HEAD_ROW}>
                            <th className={`${DRAWER_TABLE_TH} first:pl-4 sm:first:pl-5`}>Candidate</th>
                            <th className={DRAWER_TABLE_TH}>Date &amp; time</th>
                            <th className={DRAWER_TABLE_TH}>Round</th>
                            <th className={DRAWER_TABLE_TH}>Type</th>
                            <th className={DRAWER_TABLE_TH}>Panel</th>
                            <th className={`${DRAWER_TABLE_TH} sm:pr-5`}>Status</th>
                          </tr>
                        </thead>
                        <tbody className={DRAWER_TABLE_BODY}>
                      {loadingJobInterviews ? (
                            <tr>
                              <td
                                colSpan={6}
                                className={`${DRAWER_TABLE_TD} py-12 text-center text-sm text-slate-500`}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <Loader2 size={16} className="animate-spin text-indigo-500" />
                          Loading interviews…
                                </span>
                              </td>
                            </tr>
                      ) : jobInterviews.length === 0 ? (
                            <tr>
                              <td
                                colSpan={6}
                                className={`${DRAWER_TABLE_TD} py-12 text-center text-sm text-slate-500`}
                              >
                                <p>No interviews scheduled for this job yet.</p>
                                {onScheduleInterview ? (
                                  <button
                                    type="button"
                                    onClick={() => void openScheduleInterviewCandidatePicker()}
                                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
                                  >
                                    <Calendar size={16} />
                                    Schedule Interview
                                  </button>
                                ) : null}
                              </td>
                            </tr>
                          ) : filteredJobInterviews.length === 0 ? (
                            <tr>
                              <td
                                colSpan={6}
                                className={`${DRAWER_TABLE_TD} py-12 text-center text-sm text-slate-500`}
                              >
                                <p className="font-medium text-slate-700">No candidates in this round</p>
                                <p className="mt-1 text-xs text-slate-500">
                                  Schedule an interview for this job, or switch to another round tab.
                                </p>
                              </td>
                            </tr>
                          ) : (
                            filteredJobInterviews.map((item: any) => {
                          const statusLabel = formatInterviewListStatus(item.status);
                              const candidateEmail = String(item.candidate?.email || '').trim();
                              const timezoneLabel = item.timezone
                                ? formatTimezoneDisplay(resolveIanaFromTimezoneValue(item.timezone))
                                : '';
                              const roundNumber = jobInterviewRoundById[item.id] || 1;
                              const roundType = String(item.round || '').trim() || 'Screening';
                          return (
                                <tr
                              key={item.id}
                                  className={`${DRAWER_TABLE_TR} cursor-pointer`}
                                  onClick={() => {
                                    setSelectedJobInterview(item);
                                    setJobInterviewDetailOpen(true);
                                  }}
                                  onKeyDown={(event: any) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault();
                                      setSelectedJobInterview(item);
                                      setJobInterviewDetailOpen(true);
                                    }
                                  }}
                                  tabIndex={0}
                                  role="button"
                                  aria-label={`Open interview for ${candidateNameFromInterview(item)}`}
                                >
                                  <td className={`${DRAWER_TABLE_TD} first:pl-4 sm:first:pl-5`}>
                                    <p className="max-w-[200px] truncate text-sm font-semibold text-slate-900">
                                      {candidateNameFromInterview(item)}
                                    </p>
                                    {candidateEmail ? (
                                      <p className="max-w-[200px] truncate text-[11px] text-slate-500">
                                        {candidateEmail}
                                      </p>
                                    ) : null}
                                  </td>
                                  <td className={DRAWER_TABLE_TD}>
                                    <p className="text-sm font-medium text-slate-800">
                                      {formatInterviewDateInTimezone(item.scheduledAt, item.timezone)}
                                    </p>
                                <p className="text-[11px] text-slate-500">
                                  {formatInterviewTimeInTimezone(item.scheduledAt, item.timezone)}
                                      {timezoneLabel ? ` · ${timezoneLabel}` : ''}
                                      {item.duration ? ` · ${item.duration} min` : ''}
                                    </p>
                                  </td>
                                  <td className={DRAWER_TABLE_TD}>
                                    <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                                      R{roundNumber}
                                      <span className="font-medium text-indigo-500/80">·</span>
                                      <span className="font-medium text-slate-700">{roundType}</span>
                              </span>
                                  </td>
                                  <td className={`${DRAWER_TABLE_TD} text-sm text-slate-700`}>
                                    {formatInterviewTypeLabel(item)}
                                  </td>
                                  <td className={`${DRAWER_TABLE_TD} max-w-[180px]`}>
                                    <p className="truncate text-sm text-slate-600" title={panelNamesFromInterview(item)}>
                                      {panelNamesFromInterview(item)}
                                    </p>
                                  </td>
                                  <td className={`${DRAWER_TABLE_TD} sm:pr-5`}>
                              <span
                                      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${interviewListStatusBadgeClass(statusLabel)}`}
                              >
                                {statusLabel}
                              </span>
                                  </td>
                                </tr>
                          );
                        })
                      )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                    </div>
                </DrawerSectionCard>
  );
}
