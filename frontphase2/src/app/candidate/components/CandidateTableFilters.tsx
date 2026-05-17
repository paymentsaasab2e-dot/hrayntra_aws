'use client';

import React from 'react';
import { PH2_TOOLBAR_SELECT_CLASS } from '../../../components/layout/Ph2ModulePageLayout';

export interface CandidateTableColumnFilters {
  company: string;
  experienceRange: string;
  location: string;
  jobId: string;
  stage: string;
  ownerId: string;
}

export const EMPTY_CANDIDATE_TABLE_COLUMN_FILTERS: CandidateTableColumnFilters = {
  company: '',
  experienceRange: '',
  location: '',
  jobId: '',
  stage: '',
  ownerId: '',
};

const TOOLBAR_FILTER_SELECT_EXP_CLASS = `${PH2_TOOLBAR_SELECT_CLASS} h-9 w-[5.75rem] min-w-0 shrink-0`;

const TOOLBAR_FILTER_SELECT_WIDE_CLASS = `${PH2_TOOLBAR_SELECT_CLASS} h-9 w-[10rem] min-w-0 shrink-0 max-w-[12rem]`;

const EXPERIENCE_FILTER_OPTIONS = [
  { value: '', label: 'All exp' },
  { value: '0-2', label: '0–2 yrs' },
  { value: '2-5', label: '2–5 yrs' },
  { value: '5-10', label: '5–10 yrs' },
  { value: '10+', label: '10+ yrs' },
] as const;

const STAGE_FILTER_OPTIONS = [
  { value: '', label: 'All stages' },
  { value: 'new', label: 'New' },
  { value: 'applied', label: 'Applied' },
  { value: 'longlist', label: 'Longlist' },
  { value: 'shortlist', label: 'Shortlist' },
  { value: 'screening', label: 'Screening' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'interviewing', label: 'Interviewing' },
  { value: 'offered', label: 'Offered' },
  { value: 'hired', label: 'Hired' },
  { value: 'rejected', label: 'Rejected' },
] as const;

interface CandidateTableFiltersProps {
  filters: CandidateTableColumnFilters;
  onChange: (filters: CandidateTableColumnFilters) => void;
  companyOptions?: string[];
  locationOptions?: string[];
  jobOptions?: Array<{ id: string; title: string }>;
  ownerOptions?: Array<{ id: string; name: string }>;
  showClear?: boolean;
  onClear?: () => void;
}

export const CandidateTableFilters: React.FC<CandidateTableFiltersProps> = ({
  filters,
  onChange,
  companyOptions = [],
  locationOptions = [],
  jobOptions = [],
  ownerOptions = [],
}) => {
  const patch = (patch: Partial<CandidateTableColumnFilters>) => {
    onChange({ ...filters, ...patch });
  };

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <select
        value={filters.company}
        onChange={(e) => patch({ company: e.target.value })}
        className={TOOLBAR_FILTER_SELECT_WIDE_CLASS}
        aria-label="Filter by client"
        title={filters.company || 'All clients'}
      >
        <option value="">All clients</option>
        {companyOptions.map((company) => (
          <option key={company} value={company}>
            {company}
          </option>
        ))}
      </select>
      <select
        value={filters.experienceRange}
        onChange={(e) => patch({ experienceRange: e.target.value })}
        className={TOOLBAR_FILTER_SELECT_EXP_CLASS}
        aria-label="Filter by experience"
      >
        {EXPERIENCE_FILTER_OPTIONS.map((opt) => (
          <option key={opt.value || 'all'} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <select
        value={filters.location}
        onChange={(e) => patch({ location: e.target.value })}
        className={TOOLBAR_FILTER_SELECT_WIDE_CLASS}
        aria-label="Filter by location"
        title={filters.location || 'All locations'}
      >
        <option value="">All locations</option>
        {locationOptions.map((location) => (
          <option key={location} value={location}>
            {location}
          </option>
        ))}
      </select>
      <select
        value={filters.jobId}
        onChange={(e) => patch({ jobId: e.target.value })}
        className={TOOLBAR_FILTER_SELECT_WIDE_CLASS}
        aria-label="Filter by job"
        title={jobOptions.find((j) => j.id === filters.jobId)?.title || 'All jobs'}
      >
        <option value="">All jobs</option>
        {jobOptions.map((job) => (
          <option key={job.id} value={job.id}>
            {job.title}
          </option>
        ))}
      </select>
      <select
        value={filters.stage}
        onChange={(e) => patch({ stage: e.target.value })}
        className={TOOLBAR_FILTER_SELECT_WIDE_CLASS}
        aria-label="Filter by stage"
      >
        {STAGE_FILTER_OPTIONS.map((opt) => (
          <option key={opt.value || 'all'} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <select
        value={filters.ownerId}
        onChange={(e) => patch({ ownerId: e.target.value })}
        className={TOOLBAR_FILTER_SELECT_WIDE_CLASS}
        aria-label="Filter by owner"
      >
        <option value="">All owners</option>
        <option value="unassigned">Unassigned</option>
        {ownerOptions.map((owner) => (
          <option key={owner.id} value={owner.id}>
            {owner.name}
          </option>
        ))}
      </select>
    </div>
  );
};
