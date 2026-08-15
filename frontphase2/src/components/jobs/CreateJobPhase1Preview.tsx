'use client';

import React, { useMemo } from 'react';
import type { CreateJobDetailsFormData } from '../drawers/CreateJobDetailsForm';
import { buildPhase1JobPreviewFromForm } from '../../lib/buildPhase1JobPreview';
import {
  isJobFieldPubliclyVisible,
  parseJobPublicFieldVisibility,
} from '../../lib/jobPublicFieldVisibility';
import { PublicJobOverviewPanel } from './PublicJobOverviewPanel';

interface CreateJobPhase1PreviewProps {
  form: CreateJobDetailsFormData;
  companyName?: string | null;
  jobDescriptionHtml?: string;
  users?: Array<{
    id: string;
    name: string;
    avatar?: string | null;
    designation?: string | null;
  }>;
}

export function CreateJobPhase1Preview({
  form,
  companyName = null,
  jobDescriptionHtml = '',
  users = [],
}: CreateJobPhase1PreviewProps) {
  const previewJob = useMemo(() => {
    const assigned = users.find((user) => user.id === form.assignedToId);
    return buildPhase1JobPreviewFromForm(form, {
      companyName,
      jobDescriptionHtml,
      recruiterProfile: assigned
        ? {
            name: assigned.name,
            designation: assigned.designation || null,
            avatarUrl: assigned.avatar || null,
          }
        : null,
    });
  }, [form, companyName, jobDescriptionHtml, users]);

  const visibility = parseJobPublicFieldVisibility(previewJob.publicFieldVisibility);
  const show = (field: Parameters<typeof isJobFieldPubliclyVisible>[1]) =>
    isJobFieldPubliclyVisible(visibility, field, previewJob.showClientNamePublicly);

  const showTitle = show('jobTitle') && Boolean(previewJob.title?.trim());
  const showCompany = show('client') && Boolean(previewJob.company?.trim());
  const headerLine = [showCompany ? previewJob.company : null, show('location') ? previewJob.location : null]
    .filter(Boolean)
    .join(' • ');

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80">
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Phase 1 candidate preview</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Matches what candidates see on the job portal. Fields marked hidden are omitted here.
        </p>
      </div>
      <div className="space-y-3 p-4">
        {showTitle ? (
          <h3 className="text-lg font-bold text-slate-900">{previewJob.title}</h3>
        ) : null}
        {headerLine ? <p className="text-sm text-slate-500">{headerLine}</p> : null}
        <PublicJobOverviewPanel job={previewJob} />
        {!showTitle && !headerLine && (
          <p className="text-sm text-slate-500">
            No public fields are visible yet. Turn on visibility toggles next to each field to include
            them on Phase 1.
          </p>
        )}
      </div>
    </div>
  );
}
