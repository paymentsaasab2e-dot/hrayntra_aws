'use client';

import React from 'react';
import { Briefcase, AlertCircle, BarChart3, Pencil, Pause, Copy } from 'lucide-react';
import { ClientJob } from '@/app/client/types';
import { JOB_STATUS_STYLES } from '../clientDetailsShared';

export function ClientJobsTab(props: any) {
  const {
    canCreateJob,
    client,
    handlePauseJob,
    loadingJobs,
    openCreateJobDrawer,
    openDuplicateJobDrawer,
    openJobDrawerFromClientJob,
    phaseOneJobs,
  } = props;

  return (
<div className="space-y-4">
                    {/* Jobs overview widgets */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                          <Briefcase size={20} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Open Jobs</p>
                          <p className="text-lg font-bold text-slate-900">{phaseOneJobs.filter((j: any) => j.status === 'Open').length || client?.openJobs || 0}</p>
                        </div>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                          <AlertCircle size={20} className="text-amber-600" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Aging Jobs</p>
                          <p className="text-lg font-bold text-slate-900">{phaseOneJobs.filter((j: any) => j.isAging).length}</p>
                        </div>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <BarChart3 size={16} className="text-slate-400" />
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">By department</p>
                        </div>
                        <div className="space-y-1.5">
                          {(() => {
                            const byDept = (phaseOneJobs as any[]).reduce<Record<string, number>>((acc: any, j: any) => {
                              acc[j.department] = (acc[j.department] ?? 0) + 1;
                              return acc;
                            }, {});
                            const max = Math.max(...Object.values(byDept), 1);
                            return Object.entries(byDept).map(([dept, count]: any) => (
                              <div key={dept} className="flex items-center gap-2">
                                <span className="text-xs font-medium text-slate-600 w-20 truncate">{dept}</span>
                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(count / max) * 100}%` }} />
                                </div>
                                <span className="text-xs font-bold text-slate-700 w-5">{count}</span>
                              </div>
                            ));
                          })()}
                          {phaseOneJobs.length === 0 && (
                            <p className="text-xs text-slate-500">No jobs</p>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Jobs table */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Jobs</h4>
                        <button
                          type="button"
                          onClick={() => void openCreateJobDrawer()}
                          disabled={!canCreateJob}
                          title={canCreateJob ? 'Add Job' : "You don't have permission to create jobs"}
                          className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                            canCreateJob
                              ? 'text-white bg-blue-600 hover:bg-blue-700'
                              : 'text-slate-400 bg-slate-100 cursor-not-allowed'
                          }`}
                        >
                          <Briefcase size={16} />
                          Add Job
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Job title</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Department</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Location</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Team Member</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">Openings</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pipeline</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Created</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right w-36">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {loadingJobs ? (
                              <tr>
                                <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                                  Loading jobs...
                                </td>
                              </tr>
                            ) : phaseOneJobs.length === 0 ? (
                              <tr>
                                <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                                  No jobs yet. Click Add Job to create one.
                                </td>
                              </tr>
                            ) : (
                              phaseOneJobs.map((job: ClientJob) => (
                                <tr key={job.id} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="px-4 py-3">
                                    <p className="text-sm font-medium text-slate-900">{job.title}</p>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-600">{job.department}</td>
                                  <td className="px-4 py-3 text-sm text-slate-600">{job.location}</td>
                                  <td className="px-4 py-3 text-sm text-slate-600">{job.hiringManager}</td>
                                  <td className="px-4 py-3 text-center">
                                    <span className="inline-flex items-center justify-center min-w-[1.5rem] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                                      {job.openings}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-wrap gap-1">
                                      {(job.pipelineStages ?? []).slice(0, 3).map((s: any, stageIndex: any) => (
                                        <span
                                          key={`${job.id || job.title}-${s.stage}-${stageIndex}`}
                                          className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium"
                                        >
                                          {s.stage}: {s.count}
                                        </span>
                                      ))}
                                      {(!job.pipelineStages || job.pipelineStages.length === 0) && <span className="text-xs text-slate-400">—</span>}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${JOB_STATUS_STYLES[job.status]}`}>
                                      {job.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-xs text-slate-500">{job.createdDate}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-1">
                                      <button
                                        type="button"
                                        onClick={(e: any) => {
                                          e.stopPropagation();
                                          // debug
                                          // eslint-disable-next-line no-console
                                          console.log('ClientDetailsDrawer: View job clicked', job?.id);
                                          openJobDrawerFromClientJob(job);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                        title="Edit job"
                                      >
                                        <Pencil size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e: any) => {
                                          e.stopPropagation();
                                          void handlePauseJob(job);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                        title="Pause job"
                                      >
                                        <Pause size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e: any) => {
                                          e.stopPropagation();
                                          openDuplicateJobDrawer(job);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                        title="Duplicate job"
                                      >
                                        <Copy size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
  );
}
