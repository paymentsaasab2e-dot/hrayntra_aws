'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { BarChart3, BookmarkPlus, Download, FileText, RefreshCcw } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '../../lib/api';
import { usePermissions } from '../../hooks/usePermissions';
import { usePageAutoRefresh } from '../../hooks/usePageAutoRefresh';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { SummaryCardSkeleton, type SummaryCardColor } from '../../components/ui/SummaryCard';
import { PH2_TABLE_CARD_CLASS } from '../../components/layout/Ph2ModulePageLayout';
import {
  buildReportQueryString,
  DEFAULT_REPORT_FILTERS,
  ReportsTopBar,
  type FiltersState,
  type ReportFilterOptions,
} from './reports-filters';
import { ReportsMobileNav, ReportsSidebar } from './ReportsSidebar';
import { buildDownloadHref } from './reports-utils';
import {
  ActivityAnalyticsSection,
  CandidateAnalyticsSection,
  ClientAnalyticsSection,
  ExecutiveDashboardSection,
  InterviewAnalyticsSection,
  PlacementAnalyticsSection,
  RecruitmentAnalyticsSection,
  RevenueAnalyticsSection,
  TeamAnalyticsSection,
} from './sections/ReportSections';
import { RawDataExplorer } from './sections/RawDataExplorer';
import type { ReportSection, ReportsSummary, SavedReport } from './types';
import { SECTION_EXPORT_TABS, SECTION_LABELS, SECTION_TO_REPORT_TYPE } from './types';

const VALID_SECTIONS: ReportSection[] = [
  'executive',
  'recruitment',
  'clients',
  'candidates',
  'interviews',
  'placements',
  'revenue',
  'team',
  'activity',
  'raw',
];

function parseSection(value: string | null): ReportSection {
  if (value && VALID_SECTIONS.includes(value as ReportSection)) return value as ReportSection;
  return 'executive';
}

function filtersFromSaved(raw: Record<string, unknown> | null): FiltersState {
  if (!raw) return { ...DEFAULT_REPORT_FILTERS };
  const next = { ...DEFAULT_REPORT_FILTERS };
  (Object.keys(DEFAULT_REPORT_FILTERS) as (keyof FiltersState)[]).forEach((key) => {
    const value = raw[key];
    if (typeof value === 'string') next[key] = value;
  });
  return next;
}

export default function ReportsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission } = usePermissions();
  const canExportData = hasPermission('export_data');
  const canSaveReports = hasPermission('reports_create');

  const [section, setSection] = useState<ReportSection>(() => parseSection(searchParams.get('section')));
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_REPORT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<FiltersState>(DEFAULT_REPORT_FILTERS);
  const [filterOptions, setFilterOptions] = useState<ReportFilterOptions | null>(null);
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [saveName, setSaveName] = useState('');

  const loadFilterOptions = useCallback(async () => {
    const response = await apiFetch<ReportFilterOptions>('/reports/filter-options', { auth: true });
    setFilterOptions(response.data);
  }, []);

  const loadSavedReports = useCallback(async () => {
    try {
      const response = await apiFetch<{ data: SavedReport[] }>('/reports?limit=20', { auth: true });
      setSavedReports(response.data?.data || []);
    } catch {
      setSavedReports([]);
    }
  }, []);

  const loadSummary = useCallback(
    async (nextFilters: FiltersState, opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const query = buildReportQueryString(nextFilters);
        const response = await apiFetch<ReportsSummary>(`/reports/summary?${query}`, { auth: true });
        setSummary(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load reports');
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadFilterOptions();
    void loadSavedReports();
  }, [loadFilterOptions, loadSavedReports]);

  useEffect(() => {
    void loadSummary(filters);
  }, [filters, loadSummary]);

  useEffect(() => {
    setSection(parseSection(searchParams.get('section')));
  }, [searchParams]);

  usePageAutoRefresh(
    ({ silent }) => {
      void loadSummary(filters, { silent });
    },
    { events: ['jobportal:placements-changed', 'jobportal:jobs-changed'] },
  );

  const handleSectionChange = (next: ReportSection) => {
    setSection(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set('section', next);
    router.replace(`/reports?${params.toString()}`, { scroll: false });
  };

  const handleApplyFilters = () => {
    setFilters({ ...draftFilters });
  };

  const handleResetFilters = () => {
    setDraftFilters({ ...DEFAULT_REPORT_FILTERS });
    setFilters({ ...DEFAULT_REPORT_FILTERS });
  };

  const patchDraft = <K extends keyof FiltersState>(key: K, value: FiltersState[K]) => {
    setDraftFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleRefresh = async () => {
    setPullRefreshing(true);
    try {
      await loadSummary(filters, { silent: true });
    } finally {
      setPullRefreshing(false);
    }
  };

  const handleExport = async (format: 'csv' | 'pdf' | 'excel') => {
    const tabKey = SECTION_EXPORT_TABS[section];
    if (!tabKey) return;
    setExporting(format);
    setError(null);
    try {
      const query = buildReportQueryString(filters);
      const response = await apiFetch<{ downloadUrl: string; fileName?: string }>(
        `/reports/summary/export/${tabKey}/${format}?${query}`,
        { auth: true },
      );
      const extension = format === 'excel' ? 'xlsx' : format;
      const downloadName =
        response.data.fileName || `${tabKey}-${new Date().toISOString().split('T')[0]}.${extension}`;
      window.open(buildDownloadHref(response.data.downloadUrl, downloadName), '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export report');
    } finally {
      setExporting(null);
    }
  };

  const handleSaveReport = async () => {
    const name = saveName.trim();
    if (!name) return;
    try {
      await apiFetch('/reports', {
        auth: true,
        method: 'POST',
        body: JSON.stringify({
          name,
          type: SECTION_TO_REPORT_TYPE[section],
          filters,
        }),
      });
      setSavePromptOpen(false);
      setSaveName('');
      await loadSavedReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save report');
    }
  };

  const handleLoadSavedReport = (report: SavedReport) => {
    const restored = filtersFromSaved(report.filters);
    setDraftFilters(restored);
    setFilters(restored);
    const sectionFromType = (Object.entries(SECTION_TO_REPORT_TYPE).find(([, type]) => type === report.type)?.[0] ||
      'executive') as ReportSection;
    handleSectionChange(sectionFromType);
  };

  const renderSection = () => {
    if (!summary) return null;
    switch (section) {
      case 'executive':
        return <ExecutiveDashboardSection summary={summary} />;
      case 'recruitment':
        return <RecruitmentAnalyticsSection summary={summary} />;
      case 'clients':
        return <ClientAnalyticsSection summary={summary} />;
      case 'candidates':
        return <CandidateAnalyticsSection summary={summary} />;
      case 'interviews':
        return <InterviewAnalyticsSection summary={summary} />;
      case 'placements':
        return <PlacementAnalyticsSection summary={summary} />;
      case 'revenue':
        return <RevenueAnalyticsSection summary={summary} />;
      case 'team':
        return <TeamAnalyticsSection summary={summary} />;
      case 'activity':
        return <ActivityAnalyticsSection summary={summary} />;
      case 'raw':
        return <RawDataExplorer filters={filters} filterOptions={filterOptions} canExport={canExportData} />;
      default:
        return <ExecutiveDashboardSection summary={summary} />;
    }
  };

  const showSummarySkeleton = loading && section !== 'raw';

  return (
    <div className="flex min-h-screen w-full overflow-hidden text-slate-900">
      <ReportsSidebar
        section={section}
        onSectionChange={handleSectionChange}
        savedReports={savedReports}
        onLoadSavedReport={handleLoadSavedReport}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-indigo-100/50 bg-white/80 px-4 py-3 shadow-[inset_0_-1px_0_0_rgba(99,102,241,0.08)] backdrop-blur-md sm:px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 lg:hidden">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">{SECTION_LABELS[section]}</h1>
              <p className="text-[11px] text-slate-500">Power BI-style insights, simplified for recruiting</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canSaveReports ? (
              <button
                type="button"
                onClick={() => setSavePromptOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200/70 bg-white px-3 py-2 text-xs font-semibold text-indigo-900"
              >
                <BookmarkPlus size={15} />
                Save
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={pullRefreshing || loading}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-200/80 bg-white text-indigo-700 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCcw size={16} className={pullRefreshing ? 'animate-spin' : ''} />
            </button>
            {canExportData && section !== 'raw' && SECTION_EXPORT_TABS[section] ? (
              <>
                <button
                  type="button"
                  onClick={() => void handleExport('csv')}
                  disabled={!!exporting}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200/70 bg-white px-3 py-2 text-xs font-semibold text-indigo-900 disabled:opacity-60"
                >
                  <Download size={15} />
                  {exporting === 'csv' ? 'Exporting…' : 'CSV'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleExport('pdf')}
                  disabled={!!exporting}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200/70 bg-white px-3 py-2 text-xs font-semibold text-indigo-900 disabled:opacity-60"
                >
                  <FileText size={15} />
                  {exporting === 'pdf' ? 'Exporting…' : 'PDF'}
                </button>
              </>
            ) : null}
          </div>
        </header>

        <ReportsMobileNav section={section} onSectionChange={handleSectionChange} />
        <ReportsTopBar
          draftFilters={draftFilters}
          options={filterOptions}
          onPatch={patchDraft}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
        />

        <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5">
          <div className="mx-auto max-w-[1600px]">
            {error ? (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : null}

            {savePromptOpen ? (
              <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
                <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-[10px] font-semibold uppercase text-slate-500">
                  Report name
                  <input
                    value={saveName}
                    onChange={(event) => setSaveName(event.target.value)}
                    placeholder="Monthly Revenue"
                    className="rounded-lg border border-indigo-100 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <button type="button" onClick={() => void handleSaveReport()} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white">
                  Save report
                </button>
                <button type="button" onClick={() => setSavePromptOpen(false)} className="text-xs font-semibold text-slate-500">
                  Cancel
                </button>
              </div>
            ) : null}

            <div className={PH2_TABLE_CARD_CLASS}>
              <div className="p-4 sm:p-5 lg:p-6">
                {showSummarySkeleton ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                      {(['blue', 'cyan', 'orange', 'indigo', 'green', 'rose'] as SummaryCardColor[]).map((c, i) => (
                        <SummaryCardSkeleton key={i} color={c} />
                      ))}
                    </div>
                    <SkeletonCard heightClass="h-[280px]" lines={4} />
                  </div>
                ) : section === 'raw' ? (
                  renderSection()
                ) : summary ? (
                  renderSection()
                ) : (
                  <div className="py-12 text-center text-sm text-slate-500">No report data available.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
