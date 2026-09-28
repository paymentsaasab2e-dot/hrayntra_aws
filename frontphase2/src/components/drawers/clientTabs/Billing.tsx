'use client';

import React from 'react';
import { TrendingUp, Clock, DollarSign, AlertCircle, Pencil, Download, Send, FilePlus } from 'lucide-react';
import { cleanDisplayText } from '../../../lib/sanitizeMojibake';
import { INVOICE_STATUS_STYLES } from '../clientDetailsShared';

export function ClientBillingTab(props: any) {
  const {
    client,
  } = props;

  return (
<div className="space-y-4">
                    {/* Finance summary cards - same soft card layout as Jobs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                          <TrendingUp size={20} className="text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total revenue</p>
                          <p className="text-lg font-bold text-slate-900">{cleanDisplayText(client?.billingTotalRevenue ?? client?.revenue)}</p>
                        </div>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                          <Clock size={20} className="text-amber-600" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Outstanding</p>
                          <p className="text-lg font-bold text-slate-900">{cleanDisplayText(client?.billingOutstanding)}</p>
                        </div>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                          <DollarSign size={20} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Paid amount</p>
                          <p className="text-lg font-bold text-slate-900">{cleanDisplayText(client?.billingPaid)}</p>
                        </div>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                          <AlertCircle size={20} className="text-red-600" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Overdue invoices</p>
                          <p className="text-lg font-bold text-slate-900">{client?.billingOverdueCount ?? 0}</p>
                        </div>
                      </div>
                    </div>
                    {/* Invoices table */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Invoices</h4>
                        <p className="text-xs text-slate-500">{(client?.invoiceList ?? []).length} invoices</p>
                      </div>
                      <div className="overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Invoice #</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Amount</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Due date</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right w-44">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(!client?.invoiceList || client.invoiceList.length === 0) ? (
                              <tr>
                                <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
                                  No invoices yet.
                                </td>
                              </tr>
                            ) : (
                              (client?.invoiceList ?? []).map((inv: any) => (
                                <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="px-4 py-3">
                                    <p className="text-sm font-medium text-slate-900">{inv.invoiceNumber}</p>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-600">{inv.date}</td>
                                  <td className="px-4 py-3 text-sm font-medium text-slate-700">{inv.amount}</td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${INVOICE_STATUS_STYLES[inv.status as keyof typeof INVOICE_STATUS_STYLES]}`}>
                                      {inv.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-600">{inv.dueDate}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-1">
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Edit invoice"><Pencil size={14} /></button>
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Download PDF"><Download size={14} /></button>
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Send reminder"><Send size={14} /></button>
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Record payment"><DollarSign size={14} /></button>
                                      <button type="button" className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors" title="Add credit note"><FilePlus size={14} /></button>
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
