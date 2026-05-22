'use client';

import React from 'react';
import type { ClientReviewSection } from '@/lib/clientPresentationSections';

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function renderFieldValue(value: string) {
  if (isUrl(value)) {
    return (
      <a href={value} target="_blank" rel="noreferrer" className="font-medium text-[#2563EB] hover:underline">
        {value}
      </a>
    );
  }
  return <span className="whitespace-pre-wrap">{value}</span>;
}

type Props = {
  sections: ClientReviewSection[];
  jobTitle?: string;
  clientName?: string;
};

export function ClientReviewSectionsPanel({ sections, jobTitle, clientName }: Props) {
  if (!sections.length) return null;

  return (
    <div className="space-y-4">
      {(jobTitle || clientName) && (
        <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm text-[#4B5563]">
          {jobTitle ? <p>Role: {jobTitle}</p> : null}
          {clientName ? <p>Client: {clientName}</p> : null}
        </div>
      )}
      {sections.map((section) => (
        <div key={section.id} className="rounded-xl border border-[#E5E7EB] p-4">
          <h2 className="text-sm font-semibold text-[#111827]">{section.title}</h2>
          <dl className="mt-3 space-y-3">
            {section.fields.map((row) => (
              <div key={`${section.id}-${row.label}`}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">{row.label}</dt>
                <dd className="mt-0.5 text-sm text-[#374151]">{renderFieldValue(row.value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
