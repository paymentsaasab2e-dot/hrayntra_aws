'use client';

import React from 'react';
import { Briefcase, User, Calendar, StickyNote, Paperclip, Activity } from 'lucide-react';
import { EntityAuditSummary } from '../../table/TableAuditCell';
import { extractAuditMeta } from '../../../utils/auditMeta';
import { DrawerSectionCard } from '../drawerFormUi';
import { BackendActivity } from '../../../lib/api';
import { formatDateDMY, formatTime12hEnGb } from '../../../utils/dateDisplay';
import { ImageWithFallback } from '../../ImageWithFallback';
import type { ActivityTabProps } from '../jobDrawerTabProps';

export function ActivityTab(props: ActivityTabProps) {
  const {
    activityFilter,
    job,
    jobActivities,
    loadingActivities,
    setActivityFilter,
  } = props;

  return (
(() => {
                const ACTIVITY_TIMELINE_FILTERS: Array<'All' | 'Jobs' | 'Candidates' | 'Interviews' | 'Notes' | 'Files'> = ['All', 'Jobs', 'Candidates', 'Interviews', 'Notes', 'Files'];
                
                const activities = jobActivities.filter(
                  (a: any) => activityFilter === 'All' || a.action.toLowerCase().includes(activityFilter.toLowerCase())
                );
                
                // Sort activities by timestamp (newest first)
                const sortedActivities = [...activities].sort((a: any, b: any) => {
                  const dateA = new Date(a.createdAt).getTime();
                  const dateB = new Date(b.createdAt).getTime();
                  return dateB - dateA;
                });
                
                const CategoryIcon = ({ category }: { category: string }) => {
                  const catLower = category.toLowerCase();
                  if (catLower.includes('job')) return <Briefcase size={16} className="text-blue-600" />;
                  if (catLower.includes('candidate')) return <User size={16} className="text-emerald-600" />;
                  if (catLower.includes('interview')) return <Calendar size={16} className="text-amber-600" />;
                  if (catLower.includes('note')) return <StickyNote size={16} className="text-slate-600" />;
                  if (catLower.includes('file')) return <Paperclip size={16} className="text-slate-600" />;
                  return <Activity size={16} className="text-slate-500" />;
                };
                
                return (
                  <div className="space-y-5">
                    <EntityAuditSummary
                      audit={job?.auditMeta ?? extractAuditMeta(job as unknown as Record<string, unknown> | undefined)}
                    />
                    <DrawerSectionCard
                      title="Activity Filters"
                      subtitle="Filter timeline by category"
                      icon={Activity}
                      accent="indigo"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {ACTIVITY_TIMELINE_FILTERS.map((f: any) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setActivityFilter(f)}
                            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${activityFilter === f ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </DrawerSectionCard>
                    <DrawerSectionCard
                      title="Activity Timeline"
                      subtitle={`${sortedActivities.length} events`}
                      icon={Activity}
                      accent="blue"
                    >
                      <div className="max-h-[420px] overflow-y-auto">
                        {loadingActivities ? (
                          <div className="py-8 text-center">
                            <p className="text-sm text-slate-500">Loading activities...</p>
                          </div>
                        ) : sortedActivities.length === 0 ? (
                          <div className="py-8 text-center">
                            <Activity size={24} className="mx-auto text-slate-300 mb-2" />
                            <p className="text-sm text-slate-500">No activity for this filter.</p>
                          </div>
                        ) : (
                          <div className="relative border-l-2 border-slate-200 pl-6 space-y-0">
                            {sortedActivities.map((item: BackendActivity, idx: number) => {
                              const prevItem = idx > 0 ? sortedActivities[idx - 1] : null;
                              const currentDate = new Date(item.createdAt).toDateString();
                              const prevDate = prevItem ? new Date(prevItem.createdAt).toDateString() : '';
                              const showDateSeparator = idx === 0 || currentDate !== prevDate;
                              
                              const date = new Date(item.createdAt);
                              const now = new Date();
                              const isToday = date.toDateString() === now.toDateString();
                              const isYesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString() === date.toDateString();
                              
                              let dateLabel = '';
                              if (isToday) dateLabel = 'Today';
                              else if (isYesterday) dateLabel = 'Yesterday';
                              else {
                                dateLabel = formatDateDMY(date);
                              }

                              const timeLabel = formatTime12hEnGb(date);
                              
                              return (
                                <div key={item.id}>
                                  {showDateSeparator && idx > 0 && (
                                    <div className="my-4 border-t border-slate-200"></div>
                                  )}
                                  {showDateSeparator && (
                                    <div className="mb-3 -ml-6">
                                      <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">
                                        {dateLabel}
                                      </span>
                                    </div>
                                  )}
                                  <div className="relative pb-6 last:pb-0">
                                    {/* Timeline dot + icon */}
                                    <div className="absolute -left-[1.625rem] top-0 w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center bg-slate-100">
                                      <CategoryIcon category={item.action} />
                                    </div>
                                    {/* Event card */}
                                    <div className="bg-slate-50/80 rounded-xl border border-slate-200 p-3 hover:border-slate-300 transition-colors">
                                      <p className="text-sm font-semibold text-slate-900">{item.action}</p>
                                      {item.description && <p className="text-xs text-slate-600 mt-1">{item.description}</p>}
                                      <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                                        <div className="flex items-center gap-2 min-w-0">
                                          {item.user?.avatar ? (
                                            <ImageWithFallback src={item.user.avatar} alt={item.user.name} className="w-6 h-6 rounded-full border border-slate-200 shrink-0" />
                                          ) : (
                                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0"><User size={12} className="text-slate-500" /></div>
                                          )}
                                          <span className="text-xs font-medium text-slate-700 truncate">{item.user?.name || 'System'}</span>
                                        </div>
                                        <span className="text-[11px] text-slate-500 shrink-0">{timeLabel}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </DrawerSectionCard>
                  </div>
                );
              })()
  );
}
