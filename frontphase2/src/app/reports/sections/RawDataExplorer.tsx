'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { PH2_TOOLBAR_SELECT_CLASS } from '../../../components/layout/Ph2ModulePageLayout';
import { downloadReportDatasetCsv } from '../../../lib/reportTabExports';
import { apiFetch } from '../../../lib/api';
import {
  buildReportQueryString,
  ENTITY_RAW_FILTER_KEYS,
  RAW_ENTITY_OPTIONS,
  type FiltersState,
  type RawEntityKey,
  type ReportFilterOptions,
} from '../reports-filters';
import { buildDownloadHref, EmptyState, ReportCard, SimpleTable } from '../reports-utils';

type RawDataExplorerProps = {
  filters: FiltersState;
  filterOptions: ReportFilterOptions | null;
  canExport: boolean;
};

function RawEntityFilters({
  entity,
  draftFilters,
  options,
  onPatch,
}: {
  entity: RawEntityKey;
  draftFilters: FiltersState;
  options: ReportFilterOptions | null;
  onPatch: <K extends keyof FiltersState>(key: K, value: FiltersState[K]) => void;
}) {
  const keys = ENTITY_RAW_FILTER_KEYS[entity] || [];

  return (
    <div className="flex flex-wrap items-end gap-2">
      {keys.includes('candidateStatus') ? (
        <select value={draftFilters.candidateStatus} onChange={(e) => onPatch('candidateStatus', e.target.value)} className={PH2_TOOLBAR_SELECT_CLASS}>
          <option value="">All Statuses</option>
          {(options?.candidateStatuses || []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : null}
      {keys.includes('candidateSource') ? (
        <select value={draftFilters.candidateSource} onChange={(e) => onPatch('candidateSource', e.target.value)} className={PH2_TOOLBAR_SELECT_CLASS}>
          <option value="">All Sources</option>
          {(options?.candidateSources || []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : null}
      {keys.includes('jobStatus') ? (
        <select value={draftFilters.jobStatus} onChange={(e) => onPatch('jobStatus', e.target.value)} className={PH2_TOOLBAR_SELECT_CLASS}>
          <option value="">All Statuses</option>
          {(options?.jobStatuses || []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : null}
      {keys.includes('jobType') ? (
        <select value={draftFilters.jobType} onChange={(e) => onPatch('jobType', e.target.value)} className={PH2_TOOLBAR_SELECT_CLASS}>
          <option value="">All Types</option>
          {(options?.jobTypes || []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : null}
      {keys.includes('jobDepartment') ? (
        <select value={draftFilters.jobDepartment} onChange={(e) => onPatch('jobDepartment', e.target.value)} className={PH2_TOOLBAR_SELECT_CLASS}>
          <option value="">All Departments</option>
          {(options?.jobDepartments || []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : null}
      {keys.includes('jobLocation') ? (
        <select value={draftFilters.jobLocation} onChange={(e) => onPatch('jobLocation', e.target.value)} className={PH2_TOOLBAR_SELECT_CLASS}>
          <option value="">All Locations</option>
          {(options?.jobLocations || []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : null}
      {keys.includes('clientStatus') ? (
        <select value={draftFilters.clientStatus} onChange={(e) => onPatch('clientStatus', e.target.value)} className={PH2_TOOLBAR_SELECT_CLASS}>
          <option value="">All Statuses</option>
          {(options?.clientStatuses || []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : null}
      {keys.includes('clientIndustry') ? (
        <select value={draftFilters.clientIndustry} onChange={(e) => onPatch('clientIndustry', e.target.value)} className={PH2_TOOLBAR_SELECT_CLASS}>
          <option value="">All Industries</option>
          {(options?.clientIndustries || []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : null}
      {keys.includes('leadStatus') ? (
        <select value={draftFilters.leadStatus} onChange={(e) => onPatch('leadStatus', e.target.value)} className={PH2_TOOLBAR_SELECT_CLASS}>
          <option value="">All Statuses</option>
          {(options?.leadStatuses || []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : null}
      {keys.includes('leadSource') ? (
        <select value={draftFilters.leadSource} onChange={(e) => onPatch('leadSource', e.target.value)} className={PH2_TOOLBAR_SELECT_CLASS}>
          <option value="">All Sources</option>
          {(options?.leadSources || []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : null}
      {keys.includes('interviewStatus') ? (
        <select value={draftFilters.interviewStatus} onChange={(e) => onPatch('interviewStatus', e.target.value)} className={PH2_TOOLBAR_SELECT_CLASS}>
          <option value="">All Statuses</option>
          {(options?.interviewStatuses || []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : null}
      {keys.includes('placementStatus') ? (
        <select value={draftFilters.placementStatus} onChange={(e) => onPatch('placementStatus', e.target.value)} className={PH2_TOOLBAR_SELECT_CLASS}>
          <option value="">All Statuses</option>
          {(options?.placementStatuses || []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : null}
      {keys.includes('clientId') ? (
        <select value={draftFilters.clientId} onChange={(e) => onPatch('clientId', e.target.value)} className={PH2_TOOLBAR_SELECT_CLASS}>
          <option value="">All Clients</option>
          {(options?.clients || []).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      ) : null}
      {keys.includes('jobId') ? (
        <select value={draftFilters.jobId} onChange={(e) => onPatch('jobId', e.target.value)} className={PH2_TOOLBAR_SELECT_CLASS}>
          <option value="">All Jobs</option>
          {(options?.jobs || []).map((j) => (
            <option key={j.id} value={j.id}>{j.name}</option>
          ))}
        </select>
      ) : null}
      {keys.includes('recruiterId') ? (
        <select value={draftFilters.recruiterId} onChange={(e) => onPatch('recruiterId', e.target.value)} className={PH2_TOOLBAR_SELECT_CLASS}>
          <option value="">All Recruiters</option>
          {(options?.recruiters || []).map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

export function RawDataExplorer({ filters, filterOptions, canExport }: RawDataExplorerProps) {
  const [entity, setEntity] = useState<RawEntityKey>('candidates');
  const [localFilters, setLocalFilters] = useState<FiltersState>(filters);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [dataset, setDataset] = useState<{ title: string; columns: string[]; rows: Record<string, string | number>[] } | null>(null);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const loadDataset = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const extra: Record<string, string> = search.trim() ? { search: search.trim() } : {};
      const query = buildReportQueryString(localFilters, extra);
      const response = await apiFetch<{ title: string; columns: string[]; rows: Record<string, string | number>[] }>(
        `/reports/dataset/${entity}?${query}`,
        { auth: true },
      );
      setDataset(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dataset');
      setDataset(null);
    } finally {
      setLoading(false);
    }
  }, [entity, localFilters, search]);

  useEffect(() => {
    void loadDataset();
  }, [loadDataset]);

  const handleExportCsv = async () => {
    if (!dataset) return;
    setExporting(true);
    try {
      downloadReportDatasetCsv(dataset, `${entity}-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleServerExport = async (format: 'csv' | 'excel' | 'pdf') => {
    setExporting(true);
    setError(null);
    try {
      const extra: Record<string, string> = search.trim() ? { search: search.trim() } : {};
      const query = buildReportQueryString(localFilters, extra);
      const response = await apiFetch<{ downloadUrl: string; fileName?: string }>(
        `/reports/export/${entity}/${format}?${query}`,
        { auth: true },
      );
      const fileName = response.data.fileName || `${entity}.${format === 'excel' ? 'xlsx' : format}`;
      window.open(buildDownloadHref(response.data.downloadUrl, fileName), '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const tableColumns = (dataset?.columns || []).slice(0, 8).map((col) => ({ key: col, label: col }));
  const previewRows = (dataset?.rows || []).slice(0, 50).map((row) => {
    const out: Record<string, string | number> = {};
    (dataset?.columns || []).slice(0, 8).forEach((col) => {
      out[col] = row[col] ?? '';
    });
    return out;
  });

  return (
    <div className="space-y-4">
      <ReportCard title="Raw Data Explorer">
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Entity
            <select
              value={entity}
              onChange={(event) => setEntity(event.target.value as RawEntityKey)}
              className={PH2_TOOLBAR_SELECT_CLASS}
            >
              {RAW_ENTITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <RawEntityFilters
            entity={entity}
            draftFilters={localFilters}
            options={filterOptions}
            onPatch={(key, value) => setLocalFilters((prev) => ({ ...prev, [key]: value }))}
          />
          <div className="relative min-w-[12rem] flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search..."
              className={`${PH2_TOOLBAR_SELECT_CLASS} w-full pl-8`}
            />
          </div>
          <button
            type="button"
            onClick={() => void loadDataset()}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white"
          >
            Load
          </button>
        </div>

        {error ? (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
        ) : null}

        {loading ? (
          <EmptyState text="Loading dataset..." />
        ) : dataset?.rows?.length ? (
          <>
            <p className="mb-2 text-xs text-slate-500">
              {dataset.title} — showing {Math.min(50, dataset.rows.length)} of {dataset.rows.length} rows
              {dataset.columns.length > 8 ? ' (first 8 columns)' : ''}
            </p>
            <SimpleTable columns={tableColumns} rows={previewRows} />
          </>
        ) : (
          <EmptyState text="No rows for the current filters." />
        )}

        {canExport && dataset?.rows?.length ? (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-indigo-100/50 pt-4">
            <button
              type="button"
              onClick={() => void handleExportCsv()}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-800"
            >
              <Download size={14} />
              Quick CSV
            </button>
            <button type="button" onClick={() => void handleServerExport('csv')} disabled={exporting} className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-800">
              Export CSV
            </button>
            <button type="button" onClick={() => void handleServerExport('excel')} disabled={exporting} className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-800">
              Export Excel
            </button>
            <button type="button" onClick={() => void handleServerExport('pdf')} disabled={exporting} className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-800">
              Export PDF
            </button>
          </div>
        ) : null}
      </ReportCard>
    </div>
  );
}
