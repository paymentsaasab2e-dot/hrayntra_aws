'use client';

import React from 'react';
import type { BackendClient } from '../../lib/api';
import type { SubmitToClientClientFormState } from '../../lib/submitToClientClientForm';

const inputClass =
  'mt-1 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium normal-case text-[#111827]';
const labelClass = 'text-xs font-semibold uppercase text-[#6B7280]';

function FieldLabel({
  label,
  children,
  span = 1,
}: {
  label: string;
  children: React.ReactNode;
  span?: 1 | 2;
}) {
  return (
    <label className={span === 2 ? 'sm:col-span-2' : undefined}>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value?: string | null }) {
  const text = String(value || '').trim();
  return (
    <div>
      <p className={labelClass}>{label}</p>
      <p className="mt-1 text-sm text-[#111827]">{text || '—'}</p>
    </div>
  );
}

interface SubmitToClientClientDetailsPanelProps {
  client: BackendClient;
  form: SubmitToClientClientFormState;
  onPatchForm: (patch: Partial<SubmitToClientClientFormState>) => void;
}

export function SubmitToClientClientDetailsPanel({
  client,
  form,
  onPatchForm,
}: SubmitToClientClientDetailsPanelProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[#E5E7EB] bg-white p-4">
        <h3 className="text-sm font-semibold text-[#111827]">Client Information</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldLabel label="Company *">
            <input
              value={form.companyName}
              onChange={(e) => onPatchForm({ companyName: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Company Links">
            <textarea
              value={form.companyLinks}
              onChange={(e) => onPatchForm({ companyLinks: e.target.value })}
              rows={2}
              placeholder="One link per line (website, LinkedIn)"
              className={inputClass}
            />
          </FieldLabel>

          <div className="sm:col-span-2 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FieldLabel label="Director Name">
                <input
                  value={form.directorName}
                  onChange={(e) => onPatchForm({ directorName: e.target.value })}
                  className={inputClass}
                />
              </FieldLabel>
              <FieldLabel label="Email *">
                <input
                  type="email"
                  value={form.directorEmail}
                  onChange={(e) => onPatchForm({ directorEmail: e.target.value })}
                  className={inputClass}
                />
              </FieldLabel>
              <FieldLabel label="Mobile Number">
                <input
                  value={form.directorPhone}
                  onChange={(e) => onPatchForm({ directorPhone: e.target.value })}
                  className={inputClass}
                />
              </FieldLabel>
            </div>
          </div>

          <FieldLabel label="Location">
            <input
              value={form.location}
              onChange={(e) => onPatchForm({ location: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="City">
            <input value={form.city} onChange={(e) => onPatchForm({ city: e.target.value })} className={inputClass} />
          </FieldLabel>
          <FieldLabel label="State">
            <input value={form.state} onChange={(e) => onPatchForm({ state: e.target.value })} className={inputClass} />
          </FieldLabel>
          <FieldLabel label="Country">
            <input
              value={form.country}
              onChange={(e) => onPatchForm({ country: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Timezone">
            <input
              value={form.timezone}
              onChange={(e) => onPatchForm({ timezone: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Industry">
            <input
              value={form.industry}
              onChange={(e) => onPatchForm({ industry: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Status">
            <input
              value={form.leadStatus}
              onChange={(e) => onPatchForm({ leadStatus: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Interest Level">
            <input
              value={form.priority}
              onChange={(e) => onPatchForm({ priority: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <ReadOnlyField label="Assigned To" value={client.assignedTo?.name || client.assignedTo?.email} />
          <FieldLabel label="Services Needed">
            <input
              value={form.servicesNeeded}
              onChange={(e) => onPatchForm({ servicesNeeded: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Expected Business Value" span={2}>
            <textarea
              value={form.expectedBusinessValue}
              onChange={(e) => onPatchForm({ expectedBusinessValue: e.target.value })}
              rows={3}
              className={inputClass}
            />
          </FieldLabel>
        </div>
      </section>
    </div>
  );
}
