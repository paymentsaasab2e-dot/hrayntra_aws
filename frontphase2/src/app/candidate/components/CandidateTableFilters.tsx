'use client';

import React, { useMemo } from 'react';
import { SearchableToolbarFilterSelect } from '../../../components/forms/SearchableToolbarFilterSelect';

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

/** Width only — border/padding live on the button inside SearchableToolbarFilterSelect. */
const FILTER_EXP_WIDTH = 'w-[7.25rem]';
const FILTER_WIDE_WIDTH = 'w-[10rem] max-w-[12rem]';

const EXPERIENCE_FILTER_OPTIONS = [
  { value: '0-2', label: '0–2 yrs' },
  { value: '2-5', label: '2–5 yrs' },
  { value: '5-10', label: '5–10 yrs' },
  { value: '10+', label: '10+ yrs' },
] as const;

const STAGE_FILTER_OPTIONS = [
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

  const companyFilterOptions = useMemo(
    () => companyOptions.map((company) => ({ value: company, label: company })),
    [companyOptions],
  );

  const locationFilterOptions = useMemo(
    () => locationOptions.map((location) => ({ value: location, label: location })),
    [locationOptions],
  );

  const jobFilterOptions = useMemo(
    () => jobOptions.map((job) => ({ value: job.id, label: job.title, searchText: job.id })),
    [jobOptions],
  );

  const ownerFilterOptions = useMemo(
    () => [
      { value: 'unassigned', label: 'Unassigned' },
      ...ownerOptions.map((owner) => ({
        value: owner.id,
        label: owner.name,
        searchText: owner.id,
      })),
    ],
    [ownerOptions],
  );

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <SearchableToolbarFilterSelect
        value={filters.company}
        onChange={(company) => patch({ company })}
        options={companyFilterOptions}
        placeholder="All clients"
        allLabel="All clients"
        className={FILTER_WIDE_WIDTH}
        ariaLabel="Filter by client"
        searchPlaceholder="Search clients…"
      />
      <SearchableToolbarFilterSelect
        value={filters.experienceRange}
        onChange={(experienceRange) => patch({ experienceRange })}
        options={EXPERIENCE_FILTER_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
        placeholder="All exp"
        allLabel="All exp"
        className={FILTER_EXP_WIDTH}
        ariaLabel="Filter by experience"
        searchPlaceholder="Search experience…"
      />
      <SearchableToolbarFilterSelect
        value={filters.location}
        onChange={(location) => patch({ location })}
        options={locationFilterOptions}
        placeholder="All locations"
        allLabel="All locations"
        className={FILTER_WIDE_WIDTH}
        ariaLabel="Filter by location"
        searchPlaceholder="Search locations…"
      />
      <SearchableToolbarFilterSelect
        value={filters.jobId}
        onChange={(jobId) => patch({ jobId })}
        options={jobFilterOptions}
        placeholder="All jobs"
        allLabel="All jobs"
        className={FILTER_WIDE_WIDTH}
        ariaLabel="Filter by job"
        searchPlaceholder="Search jobs…"
      />
      <SearchableToolbarFilterSelect
        value={filters.stage}
        onChange={(stage) => patch({ stage })}
        options={STAGE_FILTER_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
        placeholder="All stages"
        allLabel="All stages"
        className={FILTER_WIDE_WIDTH}
        ariaLabel="Filter by stage"
        searchPlaceholder="Search stages…"
      />
      <SearchableToolbarFilterSelect
        value={filters.ownerId}
        onChange={(ownerId) => patch({ ownerId })}
        options={ownerFilterOptions}
        placeholder="All team members"
        allLabel="All team members"
        className={FILTER_WIDE_WIDTH}
        ariaLabel="Filter by team member"
        searchPlaceholder="Search team members…"
      />
    </div>
  );
};
