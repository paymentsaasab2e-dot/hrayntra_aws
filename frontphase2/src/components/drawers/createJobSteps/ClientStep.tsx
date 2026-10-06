'use client';

import React from 'react';
import { DrawerSectionCard } from '../drawerFormUi';
import { Building2, Home, Users, Check } from 'lucide-react';

export function CreateJobClientStep(props: any) {
  const {
    crmClients,
    formData,
    isStandaloneMode,
    ownCompanyClient,
    ownCompanyDisplayName,
    setFormData,
  } = props;

  return (
<DrawerSectionCard
                  title="Select Your Client"
                  icon={Building2}
                  accent="blue"
                >
                  <div className="space-y-3">
                    {ownCompanyClient ? (
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev: any) => ({ ...prev, companyId: ownCompanyClient.id }))
                        }
                        className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
                          formData.companyId === ownCompanyClient.id
                            ? 'border-[#2098C8] bg-[#E8F6FC] shadow-sm ring-2 ring-[#2098C8]/20'
                            : 'border-[#2098C8]/35 bg-gradient-to-r from-[#F3FBFE] to-white hover:border-[#2098C8]/70'
                        }`}
                      >
                        <span
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                            formData.companyId === ownCompanyClient.id
                              ? 'bg-[#2098C8] text-white'
                              : 'bg-gradient-to-br from-[#2098C8] to-[#176F96] text-white'
                          }`}
                        >
                          <Home className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#176F96]">
                            Own company
                          </span>
                          <span className="block truncate text-sm font-semibold text-slate-900">
                            {ownCompanyDisplayName}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                            <Users className="h-3.5 w-3.5 shrink-0 text-[#2098C8]" />
                            Visible to all team members in this company
                          </span>
                        </span>
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                            formData.companyId === ownCompanyClient.id
                              ? 'bg-[#2098C8] text-white'
                              : 'bg-slate-100 text-slate-300'
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    ) : null}
                    {!isStandaloneMode ? (
                      <>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Client *
                        </label>
                        <select
                          value={
                            ownCompanyClient && formData.companyId === ownCompanyClient.id
                              ? ''
                              : formData.companyId
                          }
                          onChange={(e: any) =>
                            setFormData((prev: any) => ({ ...prev, companyId: e.target.value }))
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="">Select a client…</option>
                          {crmClients.map((client: any) => (
                            <option key={client.id} value={client.id}>
                              {client.companyName || client.id}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-slate-500">
                          Hire under your own company above, or link this job to a client. Continue to upload a JD.
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-slate-500">
                        This job will be created under your organization and visible to all team members.
                      </p>
                    )}
                  </div>
                </DrawerSectionCard>
  );
}
