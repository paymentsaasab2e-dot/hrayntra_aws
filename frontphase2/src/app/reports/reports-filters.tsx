'use client';

import { XCircle } from 'lucide-react';
import { PH2_TOOLBAR_SELECT_CLASS } from '../../components/layout/Ph2ModulePageLayout';
import { ALL_STATUS_LABEL } from '../../constants/filterLabels';

export type FilterOption = { id: string; name: string };
export type DateRangeOption = { value: string; label: string };
export type ValueOption = { value: string; label: string };

export const ALL_REPORT_ENTITIES =
  'leads,clients,jobs,candidates,placements,interviews,team,tasks,activities,ai_matches,ai_applied_matches';

export type ReportFilterOptions = {
  dateRanges: DateRangeOption[];
  reportEntities: ValueOption[];
  clients: FilterOption[];
  jobs: FilterOption[];
  recruiters: FilterOption[];
  jobStatuses: ValueOption[];
  jobTypes: ValueOption[];
  jobLocations: ValueOption[];
  jobDepartments: ValueOption[];
  candidateStatuses: ValueOption[];
  candidateSources: ValueOption[];
  clientStatuses: ValueOption[];
  clientIndustries: ValueOption[];
  leadStatuses: ValueOption[];
  leadSources: ValueOption[];
  interviewStatuses: ValueOption[];
  placementStatuses: ValueOption[];
  matchStatuses: ValueOption[];
  applicationStatuses: ValueOption[];
  customSources: ValueOption[];
};

export type FiltersState = {
  dateRange: string;
  startDate: string;
  endDate: string;
  entities: string;
  clientId: string;
  jobId: string;
  recruiterId: string;
  jobStatus: string;
  jobType: string;
  jobLocation: string;
  jobDepartment: string;
  candidateStatus: string;
  candidateSource: string;
  clientStatus: string;
  clientIndustry: string;
  leadStatus: string;
  leadSource: string;
  interviewStatus: string;
  placementStatus: string;
};

export const DEFAULT_REPORT_FILTERS: FiltersState = {
  dateRange: 'last_30_days',
  startDate: '',
  endDate: '',
  entities: ALL_REPORT_ENTITIES,
  clientId: '',
  jobId: '',
  recruiterId: '',
  jobStatus: '',
  jobType: '',
  jobLocation: '',
  jobDepartment: '',
  candidateStatus: '',
  candidateSource: '',
  clientStatus: '',
  clientIndustry: '',
  leadStatus: '',
  leadSource: '',
  interviewStatus: '',
  placementStatus: '',
};

export const FILTER_QUERY_KEYS: (keyof FiltersState)[] = [
  'dateRange',
  'startDate',
  'endDate',
  'entities',
  'clientId',
  'jobId',
  'recruiterId',
  'jobStatus',
  'jobType',
  'jobLocation',
  'jobDepartment',
  'candidateStatus',
  'candidateSource',
  'clientStatus',
  'clientIndustry',
  'leadStatus',
  'leadSource',
  'interviewStatus',
  'placementStatus',
];

const DATE_INPUT_CLASS = `${PH2_TOOLBAR_SELECT_CLASS} min-w-[9.5rem]`;

export function buildReportQueryString(filters: FiltersState, extra: Record<string, string> = {}) {
  const params = new URLSearchParams();
  const useCustomRange = Boolean(filters.startDate && filters.endDate);

  FILTER_QUERY_KEYS.forEach((key) => {
    if (key === 'dateRange' && useCustomRange) {
      params.set('dateRange', 'custom');
      return;
    }
    if (key === 'startDate' || key === 'endDate') {
      if (useCustomRange && filters[key]) params.set(key, filters[key]);
      return;
    }
    const value = filters[key];
    if (value) params.set(key, value);
  });

  Object.entries(extra).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params.toString();
}

function parseEntitySet(entities: string) {
  const normalized = String(entities || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set(normalized.length ? normalized : ALL_REPORT_ENTITIES.split(','));
}

function ValueFilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ValueOption[];
  onChange: (value: string) => void;
}) {
  if (!options.length) return null;
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={PH2_TOOLBAR_SELECT_CLASS} aria-label={label}>
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function ReportsFiltersToolbar({
  draftFilters,
  options,
  onPatch,
  onApply,
  onReset,
}: {
  draftFilters: FiltersState;
  options: ReportFilterOptions | null;
  onPatch: <K extends keyof FiltersState>(key: K, value: FiltersState[K]) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  const entitySet = parseEntitySet(draftFilters.entities);
  const entityOptions = options?.reportEntities || [];

  const toggleEntity = (value: string) => {
    const next = new Set(entitySet);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onPatch('entities', next.size ? [...next].join(',') : '');
  };

  const selectAllEntities = () => onPatch('entities', ALL_REPORT_ENTITIES);

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          From date
          <input
            type="date"
            value={draftFilters.startDate}
            onChange={(event) => onPatch('startDate', event.target.value)}
            className={DATE_INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          To date
          <input
            type="date"
            value={draftFilters.endDate}
            onChange={(event) => onPatch('endDate', event.target.value)}
            className={DATE_INPUT_CLASS}
          />
        </label>

        <select
          value={draftFilters.dateRange}
          onChange={(event) => onPatch('dateRange', event.target.value)}
          className={PH2_TOOLBAR_SELECT_CLASS}
          aria-label="Quick date range"
        >
          {(options?.dateRanges || []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={draftFilters.clientId}
          onChange={(event) => onPatch('clientId', event.target.value)}
          className={PH2_TOOLBAR_SELECT_CLASS}
          aria-label="Client"
        >
          <option value="">All Clients</option>
          {(options?.clients || []).map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>

        <select
          value={draftFilters.jobId}
          onChange={(event) => onPatch('jobId', event.target.value)}
          className={PH2_TOOLBAR_SELECT_CLASS}
          aria-label="Job"
        >
          <option value="">All Jobs</option>
          {(options?.jobs || []).map((job) => (
            <option key={job.id} value={job.id}>
              {job.name}
            </option>
          ))}
        </select>

        <select
          value={draftFilters.recruiterId}
          onChange={(event) => onPatch('recruiterId', event.target.value)}
          className={PH2_TOOLBAR_SELECT_CLASS}
          aria-label="Recruiter"
        >
          <option value="">All Recruiters</option>
          {(options?.recruiters || []).map((recruiter) => (
            <option key={recruiter.id} value={recruiter.id}>
              {recruiter.name}
            </option>
          ))}
        </select>

        <ValueFilterSelect label={ALL_STATUS_LABEL} value={draftFilters.jobStatus} options={options?.jobStatuses || []} onChange={(v) => onPatch('jobStatus', v)} />
        <ValueFilterSelect label="All Job Types" value={draftFilters.jobType} options={options?.jobTypes || []} onChange={(v) => onPatch('jobType', v)} />
        <ValueFilterSelect label="All Job Locations" value={draftFilters.jobLocation} options={options?.jobLocations || []} onChange={(v) => onPatch('jobLocation', v)} />
        <ValueFilterSelect label="All Departments" value={draftFilters.jobDepartment} options={options?.jobDepartments || []} onChange={(v) => onPatch('jobDepartment', v)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ValueFilterSelect label={ALL_STATUS_LABEL} value={draftFilters.candidateStatus} options={options?.candidateStatuses || []} onChange={(v) => onPatch('candidateStatus', v)} />
        <ValueFilterSelect label="All Candidate Sources" value={draftFilters.candidateSource} options={options?.candidateSources || []} onChange={(v) => onPatch('candidateSource', v)} />
        <ValueFilterSelect label={ALL_STATUS_LABEL} value={draftFilters.clientStatus} options={options?.clientStatuses || []} onChange={(v) => onPatch('clientStatus', v)} />
        <ValueFilterSelect label="All Industries" value={draftFilters.clientIndustry} options={options?.clientIndustries || []} onChange={(v) => onPatch('clientIndustry', v)} />
        <ValueFilterSelect label={ALL_STATUS_LABEL} value={draftFilters.leadStatus} options={options?.leadStatuses || []} onChange={(v) => onPatch('leadStatus', v)} />
        <ValueFilterSelect label="All Lead Sources" value={draftFilters.leadSource} options={options?.leadSources || []} onChange={(v) => onPatch('leadSource', v)} />
        <ValueFilterSelect label={ALL_STATUS_LABEL} value={draftFilters.interviewStatus} options={options?.interviewStatuses || []} onChange={(v) => onPatch('interviewStatus', v)} />
        <ValueFilterSelect label={ALL_STATUS_LABEL} value={draftFilters.placementStatus} options={options?.placementStatuses || []} onChange={(v) => onPatch('placementStatus', v)} />
      </div>

      <div className="rounded-lg border border-indigo-100/70 bg-indigo-50/25 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-900/70">Report modules</span>
          <button type="button" onClick={selectAllEntities} className="text-[11px] font-semibold text-indigo-700 hover:text-indigo-900">
            Select all
          </button>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {entityOptions.map((entity) => (
            <label key={entity.value} className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={entitySet.has(entity.value)}
                onChange={() => toggleEntity(entity.value)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>{entity.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <button
          type="button"
          onClick={onApply}
          className="rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 active:scale-[0.98]"
        >
          Apply filters
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
        >
          <XCircle size={15} className="shrink-0 text-rose-500" strokeWidth={2.35} />
          Reset
        </button>
      </div>
    </div>
  );
}