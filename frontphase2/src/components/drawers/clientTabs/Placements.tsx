'use client';

import React from 'react';
import { PLACEMENT_STATUS_STYLES } from '../clientDetailsShared';
import { Pencil, FileText, UserCheck, Shield } from 'lucide-react';

export function ClientPlacementsTab(props: any) {
  const {
    client,
  } = props;

  return (
<div className="space-y-4">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Placements</h4>
                        <p className="text-xs text-slate-500">{(client?.placementList ?? []).length} placements</p>
                      </div>
                      <div className="overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        <table className="w-full text-left border-collapse min-w-[900px]">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Candidate name</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Job / role</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Placement date</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Team Member</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Fee type</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Amount</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Warranty (days left)</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right w-40">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(!client?.placementList || client.placementList.length === 0) ? (
                              <tr>
                                <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                                  No placements yet.
                                </td>
                              </tr>
                            ) : (
                              (client.placementList ?? []).map((pl: any) => (
                                <tr key={pl.id} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="px-4 py-3">
                                    <p className="text-sm font-medium text-slate-900">{pl.candidateName}</p>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-600">{pl.jobRole}</td>
                                  <td className="px-4 py-3 text-sm text-slate-600">{pl.placementDate}</td>
                                  <td className="px-4 py-3 text-sm text-slate-600">{pl.recruiter}</td>
                                  <td className="px-4 py-3">
                                    <span className="text-xs font-medium text-slate-600">{pl.feeType}</span>
                                  </td>
                                  <td className="px-4 py-3 text-sm font-medium text-slate-700">{pl.amount}</td>
                                  <td className="px-4 py-3">
                                    <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                                      {pl.warrantyDaysLeft}d
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${PLACEMENT_STATUS_STYLES[pl.status as keyof typeof PLACEMENT_STATUS_STYLES]}`}>
                                      {pl.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-1">
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Edit placement"><Pencil size={14} /></button>
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Generate invoice"><FileText size={14} /></button>
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors" title="Mark joined"><UserCheck size={14} /></button>
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Warranty claim"><Shield size={14} /></button>
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
