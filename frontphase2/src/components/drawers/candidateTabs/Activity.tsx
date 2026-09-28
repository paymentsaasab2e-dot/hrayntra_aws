'use client';

import React from 'react';
import { EntityAuditSummary } from '../../table/TableAuditCell';
import { extractAuditMeta } from '../../../utils/auditMeta';
import { DrawerSectionCard } from '../drawerFormUi';
import { Activity, Briefcase, Calendar } from 'lucide-react';
import { getTimelineConfig, getAvatarInitials } from '../candidateProfileShared';
import { formatDateTimeDMY } from '../../../utils/dateDisplay';
import { DrawerLinkActions } from '../DrawerLinkActions';

export function CandidateActivityTab(props: any) {
  const {
    activityContainerRef,
    candidate,
    groupedActivity,
  } = props;

  return (
<div className="space-y-5">
                    <EntityAuditSummary
                      audit={
                        candidate?.auditMeta ??
                        extractAuditMeta(candidate as unknown as Record<string, unknown> | undefined)
                      }
                    />
                    <DrawerSectionCard
                      title="Recent Activity"
                      subtitle="Stage changes, interviews, notes, and resume parsing"
                      icon={Activity}
                      accent="blue"
                    >
                    <div ref={activityContainerRef} className="max-h-[32rem] space-y-6 overflow-y-auto pr-1">
                      {groupedActivity.length > 0 ? (
                        groupedActivity.map((group: any, groupIndex: any) => (
                          <div key={`${group.label || 'activity'}-${groupIndex}`}>
                            <div className="sticky top-0 z-[1] mb-4 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                              {group.label}
                            </div>

                            <div className="relative ml-3 space-y-5 border-l-2 border-slate-200 pl-8">
                              {group.items.map((item: any, itemIndex: any) => {
                                const config = getTimelineConfig(item.type);
                                const Icon = config.Icon;

                                return (
                                  <div
                                    key={item.id || `${groupIndex}-${itemIndex}-${item.timestamp || item.type}`}
                                    className="relative rounded-2xl border border-slate-200 bg-slate-50 p-4"
                                  >
                                    <span
                                      className={`absolute -left-[2.15rem] top-6 h-3.5 w-3.5 rounded-full border-2 border-white ${config.dotClass}`}
                                    />

                                    <div className="flex items-start gap-3">
                                      <div className={`rounded-xl p-2 ${config.iconClass}`}>
                                        <Icon size={16} />
                                      </div>

                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <div>
                                            <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
                                            {item.description ? (
                                              <p className="mt-1 text-sm leading-6 text-slate-600">
                                                {item.description}
                                              </p>
                                            ) : null}
                                          </div>
                                          <span className="text-xs text-slate-500">
                                            {formatDateTimeDMY(item.timestamp)}
                                          </span>
                                        </div>

                                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                          <div className="flex items-center gap-2">
                                            {item.performedBy.avatar ? (
                                              <img
                                                src={item.performedBy.avatar}
                                                alt={item.performedBy.name}
                                                className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200"
                                              />
                                            ) : (
                                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                                                {getAvatarInitials(item.performedBy.name)}
                                              </div>
                                            )}
                                            <div>
                                              <p className="text-xs text-slate-400">Performed by</p>
                                              <p className="text-sm font-medium text-slate-700">{item.performedBy.name}</p>
                                            </div>
                                          </div>

                                          {item.relatedJob ? (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                                              <Briefcase size={12} />
                                              {item.relatedJob}
                                            </span>
                                          ) : null}
                                          {item.reviewUrl ? (
                                            <DrawerLinkActions
                                              url={item.reviewUrl}
                                              shareTitle="Client preview"
                                            />
                                          ) : null}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="flex min-h-[18rem] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
                          <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
                            <div className="absolute h-10 w-0.5 bg-slate-200" />
                            <span className="absolute h-3 w-3 rounded-full bg-slate-300" />
                            <Calendar size={22} className="text-slate-400" />
                          </div>
                          <h4 className="text-sm font-semibold text-slate-800">No activity yet</h4>
                          <p className="mt-1 max-w-sm text-sm text-slate-500">
                            Candidate actions like stage changes, interviews, notes, and resume parsing will appear here.
                          </p>
                        </div>
                      )}
                    </div>
                    </DrawerSectionCard>
                  </div>
  );
}
