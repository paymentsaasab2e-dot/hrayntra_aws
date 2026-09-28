'use client';

import React from 'react';
import { DrawerSectionCard, DRAWER_LIST_SHELL } from '../drawerFormUi';
import { UserCheck, Loader2 } from 'lucide-react';
import { formatDateDMY } from '../../../utils/dateDisplay';
import type { PlacementsTabProps } from '../jobDrawerTabProps';

export function PlacementsTab(props: PlacementsTabProps) {
  const {
    candidateNameFromPlacement,
    formatPlacementStatusLabel,
    job,
    jobPlacements,
    loadingJobPlacements,
  } = props;

  return (
<DrawerSectionCard
                  title="Placements"
                  subtitle="Successful hires for this job"
                  icon={UserCheck}
                  accent="emerald"
                >
                    {loadingJobPlacements ? (
                      <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
                        <Loader2 size={18} className="animate-spin text-indigo-500" />
                        Loading placements…
                      </div>
                    ) : jobPlacements.length === 0 ? (
                      <div className="p-8 text-center">
                        <UserCheck size={32} className="mx-auto text-slate-300 mb-3" />
                        <p className="text-sm text-slate-500">No placements yet for this job.</p>
                      </div>
                    ) : (
                      <div className={DRAWER_LIST_SHELL}>
                        {jobPlacements.map((placement: any) => {
                          const joinedDate =
                            placement.actualJoiningDate ||
                            placement.joiningDate ||
                            placement.offerDate ||
                            placement.createdAt;
                          const statusLabel = formatPlacementStatusLabel(placement.status);
                          const isJoined = placement.status === 'JOINED';
                          return (
                            <div
                              key={placement.id}
                              className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-indigo-50/50"
                            >
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-2 ring-white shadow-sm shadow-emerald-500/10">
                                <UserCheck size={16} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-900">{candidateNameFromPlacement(placement)}</p>
                                <p className="text-[11px] text-slate-500">
                                  {joinedDate ? formatDateDMY(joinedDate) : '—'} · {placement.job?.title || job.title}
                                </p>
                              </div>
                              <span
                                className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                                  isJoined ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {statusLabel}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                </DrawerSectionCard>
  );
}
