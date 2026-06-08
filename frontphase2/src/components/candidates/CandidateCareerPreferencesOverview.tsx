'use client';

import React from 'react';
import type { CandidateProfileDrawerData } from '../drawers/candidateProfileDrawerData';
import {
  buildCareerPreferencesViewModel,
  countCareerPreferencesFilled,
  type CareerPreferencesViewModel,
} from '@/lib/candidateCareerPreferencesModel';
import { formatIsoDateOnlyForDisplay } from '@/utils/dateDisplay';

function display(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return formatIsoDateOnlyForDisplay(String(value).trim());
}

function PreferenceCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

function CompactField({ label, value }: { label: string; value?: string | null }) {
  const text = display(value);
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-sm ${text ? 'font-medium text-slate-800' : 'italic text-slate-400'}`}>
        {text || 'Not provided'}
      </p>
    </div>
  );
}

function ChipField({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      {items.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span
              key={`${label}-${item}`}
              className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-800"
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-sm italic text-slate-400">Not provided</p>
      )}
    </div>
  );
}


function ResumeField({ resumeUrl }: { resumeUrl: string }) {
  const text = display(resumeUrl);
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Resume</p>
      {text && /^https?:\/\//i.test(text) ? (
        <a
          href={text}
          target="_blank"
          rel="noreferrer"
          className="mt-1 block break-all text-sm font-medium text-blue-700 hover:underline"
        >
          Attached — open resume
        </a>
      ) : text ? (
        <p className="mt-1 text-sm font-medium text-slate-800">Attached</p>
      ) : (
        <p className="mt-1 text-sm italic text-slate-400">Not provided</p>
      )}
    </div>
  );
}

export function CareerPreferencesCards({
  model,
  showResume = false,
}: {
  model: CareerPreferencesViewModel;
  showResume?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <PreferenceCard title="Current Package">
          <CompactField label="Current Role" value={model.currentPackage.role} />
          <CompactField label="Currency" value={model.currentPackage.currency} />
          <CompactField label="Salary Type" value={model.currentPackage.salaryType} />
          <CompactField label="Current Salary" value={model.currentPackage.salary} />
          <CompactField label="Current Location" value={model.currentPackage.location} />
          <ChipField label="Benefits" items={model.currentPackage.benefits} />
        </PreferenceCard>

        <PreferenceCard title="Preferred Package">
          <ChipField label="Preferred Role" items={model.preferredPackage.roles} />
          <CompactField label="Currency" value={model.preferredPackage.currency} />
          <CompactField label="Salary Type" value={model.preferredPackage.salaryType} />
          <CompactField label="Preferred Salary" value={model.preferredPackage.salary} />
          <ChipField label="Preferred Locations" items={model.preferredPackage.locations} />
          <ChipField label="Preferred Work Mode" items={model.preferredPackage.workModes} />
          <ChipField label="Benefits" items={model.preferredPackage.benefits} />
        </PreferenceCard>
      </div>

      <PreferenceCard title="Role & Domain">
        <ChipField label="Preferred Industries" items={model.roleDomain.industries} />
        <ChipField label="Functional Areas" items={model.roleDomain.functionalAreas} />
        <ChipField label="Job Types" items={model.roleDomain.jobTypes} />
      </PreferenceCard>

      <div className="grid gap-3 lg:grid-cols-2">
        <PreferenceCard title="Relocation">
          <CompactField label="Relocation Preference" value={model.availability.relocation} />
        </PreferenceCard>

        <PreferenceCard title="Availability">
          <CompactField label="Experience" value={model.experienceLabel} />
          <CompactField label="Earliest Start Date" value={model.availability.earliestStartDate} />
          <CompactField label="Describe Availability" value={model.availability.describeAvailability} />
          <CompactField label="Notice Period" value={model.availability.noticePeriod} />
        </PreferenceCard>
      </div>

      {showResume ? (
        <PreferenceCard title="Resume">
          <ResumeField resumeUrl={model.resume} />
        </PreferenceCard>
      ) : null}
    </div>
  );
}

type Props = {
  candidate: CandidateProfileDrawerData;
  careerPrefs?: Record<string, unknown> | null;
  showResume?: boolean;
  emptyMessage?: string;
};

/** Phase 1-style career section: current vs preferred package in two columns. */
export function CandidateCareerPreferencesOverview({
  candidate,
  careerPrefs,
  showResume = false,
  emptyMessage = 'No career preferences added yet',
}: Props) {
  const model = buildCareerPreferencesViewModel(candidate, careerPrefs);
  const filled = countCareerPreferencesFilled(model);

  if (filled === 0) {
    return <p className="text-sm italic text-slate-400">{emptyMessage}</p>;
  }

  return <CareerPreferencesCards model={model} showResume={showResume} />;
}
