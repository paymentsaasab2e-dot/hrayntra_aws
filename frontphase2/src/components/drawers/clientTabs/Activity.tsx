'use client';

import React from 'react';
import { ClientActivityItem } from '@/app/client/types';
import { Briefcase, User, Calendar, CreditCard, StickyNote, Paperclip, Activity } from 'lucide-react';
import { EntityAuditSummary } from '../../table/TableAuditCell';
import { extractAuditMeta } from '../../../utils/auditMeta';
import { formatDateDMY } from '../../../utils/dateDisplay';
import { ACTIVITY_CATEGORY_BG } from '../clientDetailsShared';
import { ImageWithFallback } from '../../ImageWithFallback';

export function ClientActivityTab(props: any) {
  const {
    ACTIVITY_TIMELINE_FILTERS,
    activityFilter,
    client,
    clientActivities,
    loadingActivities,
    setActivityFilter,
  } = props;

const allActivities = clientActivities.length > 0 ? clientActivities : (client?.activityList ?? []);
const activities = allActivities.filter(
                    (a: any) => activityFilter === 'All' || a.category === activityFilter
                  );
const sortedActivities = [...activities].sort((a: any, b: any) => {
                    const dateA = a.timestampFull ? new Date(a.timestampFull).getTime() : 0;
                    const dateB = b.timestampFull ? new Date(b.timestampFull).getTime() : 0;
                    return dateB - dateA;
                  });
const CategoryIcon = ({ category }: { category: ClientActivityItem['category'] }) => {
                    switch (category) {
                      case 'Jobs': return <Briefcase size={16} className="text-blue-600" />;
                      case 'Candidates': return <User size={16} className="text-emerald-600" />;
                      case 'Interviews': return <Calendar size={16} className="text-amber-600" />;
                      case 'Billing': return <CreditCard size={16} className="text-violet-600" />;
                      case 'Notes': return <StickyNote size={16} className="text-slate-600" />;
                      case 'Files': return <Paperclip size={16} className="text-slate-600" />;
                      default: return <Activity size={16} className="text-slate-500" />;
                    }
                  };

  return (
<div className="space-y-4">
                    <EntityAuditSummary
                      audit={client?.auditMeta ?? extractAuditMeta(client ? (client as unknown as Record<string, unknown>) : undefined)}
                    />
                    {/* Timeline filters - same soft card layout as Billing */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {ACTIVITY_TIMELINE_FILTERS.map((f: any) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setActivityFilter(f)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activityFilter === f ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Vertical timeline */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Activity timeline</h4>
                        <p className="text-xs text-slate-500">{sortedActivities.length} events</p>
                      </div>
                      <div className="p-4 max-h-[420px] overflow-y-auto">
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
                            {sortedActivities.map((item: ClientActivityItem, idx: number) => {
                              // Group by date for better visualization
                              const prevItem = idx > 0 ? sortedActivities[idx - 1] : null;
                              const currentDate = item.timestampFull ? new Date(item.timestampFull).toDateString() : '';
                              const prevDate = prevItem?.timestampFull ? new Date(prevItem.timestampFull).toDateString() : '';
                              const showDateSeparator = idx === 0 || currentDate !== prevDate;
                              
                              return (
                                <div key={item.id}>
                                  {showDateSeparator && idx > 0 && (
                                    <div className="my-4 border-t border-slate-200"></div>
                                  )}
                                  {showDateSeparator && (
                                    <div className="mb-3 -ml-6">
                                      <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">
                                        {item.timestampFull ? (() => {
                                          const date = new Date(item.timestampFull);
                                          const now = new Date();
                                          const isToday = date.toDateString() === now.toDateString();
                                          const isYesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString() === date.toDateString();
                                          
                                          if (isToday) return 'Today';
                                          if (isYesterday) return 'Yesterday';
                                          return formatDateDMY(date);
                                        })() : ''}
                                      </span>
                                    </div>
                                  )}
                                  <div className="relative pb-6 last:pb-0">
                                    {/* Timeline dot + icon */}
                                    <div className={`absolute -left-[1.625rem] top-0 w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${ACTIVITY_CATEGORY_BG[item.category]}`}>
                                      <CategoryIcon category={item.category} />
                                    </div>
                                    {/* Event card */}
                                    <div className="bg-slate-50/80 rounded-xl border border-slate-200 p-3 hover:border-slate-300 transition-colors">
                                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                                      {item.description && <p className="text-xs text-slate-600 mt-1">{item.description}</p>}
                                      <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                                        <div className="flex items-center gap-2 min-w-0">
                                          {item.user.avatar ? (
                                            <ImageWithFallback src={item.user.avatar} alt={item.user.name} className="w-6 h-6 rounded-full border border-slate-200 shrink-0" />
                                          ) : (
                                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0"><User size={12} className="text-slate-500" /></div>
                                          )}
                                          <span className="text-xs font-medium text-slate-700 truncate">{item.user.name}</span>
                                        </div>
                                        <span className="text-[11px] text-slate-500 shrink-0">{item.timestamp}</span>
                                      </div>
                                      {item.relatedLabel && (
                                        <button type="button" className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline">
                                          {item.relatedLabel}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
  );
}
