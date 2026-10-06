'use client';

import React from 'react';
import { DrawerSectionCard } from '../drawerFormUi';
import { BarChart2, Timer, TrendingUp } from 'lucide-react';
import type { AnalyticsTabProps } from '../jobDrawerTabProps';

export function AnalyticsTab(props: AnalyticsTabProps) {
  const {
    job,
  } = props;

  return (
<DrawerSectionCard
                  title="Job Analytics"
                  subtitle="Stats dashboard for job performance and hiring effectiveness"
                  icon={BarChart2}
                  accent="amber"
                >
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Applications received</p>
                          <p className="text-xl font-bold text-slate-900 mt-1">{job.applied}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Candidates screened</p>
                          <p className="text-xl font-bold text-slate-900 mt-1">{job.interviewed}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Interviews scheduled</p>
                          <p className="text-xl font-bold text-slate-900 mt-1">{job.interviewed}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Offers made</p>
                          <p className="text-xl font-bold text-slate-900 mt-1">{job.offered}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center flex flex-col items-center justify-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                            <Timer size={10} /> Time-to-fill
                          </p>
                          <p className="text-xl font-bold text-slate-900 mt-1">18 days</p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center flex flex-col items-center justify-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                            <TrendingUp size={10} /> Source performance
                          </p>
                          <p className="text-xl font-bold text-slate-900 mt-1">—</p>
                        </div>
                      </div>
                </DrawerSectionCard>
  );
}
