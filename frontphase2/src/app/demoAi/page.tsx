'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  Download,
  FileText,
  Coins,
  DollarSign,
  TrendingUp,
  Upload,
  Loader2,
  X,
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { SummaryCard } from '../../components/ui/SummaryCard';
import { usePermissions } from '../../hooks/usePermissions';
import { apiParseCandidateResume } from '../../lib/api';
import { filterBulkCvFiles } from '../../lib/bulkCvCollect';
import { formatDateTimeDMY } from '../../utils/dateDisplay';
import { downloadCsv } from '../../utils/csv';
import {
  OPENAI_PRICING_MODELS,
  estimateCostForOpenAiModel,
  formatUsd,
  getOpenAiPricingModel,
} from './openAiPricing';
import {
  appendDemoAiParseRecords,
  clearDemoAiParseSession,
  failedRecord,
  readDemoAiParseSession,
  recordFromFileAndUsage,
  tokenUsageFromParseResponse,
  type DemoAiParseRecord,
} from './parseSession';

export const dynamic = 'force-dynamic';

const DEMO_SAMPLE_RECORDS: DemoAiParseRecord[] = [
  {
    id: 'demo-1',
    resumeName: 'John_Doe_Resume.pdf',
    inputTokens: 2700,
    outputTokens: 1060,
    totalTokens: 3760,
    actualGptModel: 'gpt-4o-mini',
    parsedOn: '2025-05-25T10:30:00.000Z',
    status: 'parsed',
  },
];

function formatTokenCount(n: number): string {
  return n.toLocaleString('en-US');
}

function rowMatchesDateRange(parsedOn: string, from: string, to: string): boolean {
  if (!from && !to) return true;
  const ts = new Date(parsedOn).getTime();
  if (Number.isNaN(ts)) return true;
  if (from) {
    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    if (ts < start.getTime()) return false;
  }
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    if (ts > end.getTime()) return false;
  }
  return true;
}

type DisplayRow = DemoAiParseRecord & { estimatedCostUsd: number };

export default function DemoAiPage() {
  const { hasAnyPermission, isSuperAdmin } = usePermissions();
  const canParse =
    isSuperAdmin() ||
    hasAnyPermission(['candidates_create', 'add_candidate', 'candidates_read']);

  const [records, setRecords] = useState<DemoAiParseRecord[]>([]);
  const [hasLiveData, setHasLiveData] = useState(false);
  const [pricingModelId, setPricingModelId] = useState('gpt-4o-mini');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState({ current: 0, total: 0 });
  const [uploadOpen, setUploadOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    const stored = readDemoAiParseSession();
    if (stored.length > 0) {
      setRecords(stored);
      setHasLiveData(true);
    } else {
      setRecords([]);
      setHasLiveData(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const sourceRecords = hasLiveData ? records : DEMO_SAMPLE_RECORDS;
  const isSampleView = !hasLiveData;

  const filteredRecords = useMemo(() => {
    return sourceRecords.filter((row) => rowMatchesDateRange(row.parsedOn, dateFrom, dateTo));
  }, [sourceRecords, dateFrom, dateTo]);

  const displayRows: DisplayRow[] = useMemo(() => {
    return filteredRecords.map((row) => ({
      ...row,
      estimatedCostUsd:
        row.status === 'parsed'
          ? estimateCostForOpenAiModel(row.inputTokens, row.outputTokens, pricingModelId)
          : 0,
    }));
  }, [filteredRecords, pricingModelId]);

  const summary = useMemo(() => {
    const parsedOnly = displayRows.filter((r) => r.status === 'parsed');
    const totalResumes = parsedOnly.length;
    const totalTokens = parsedOnly.reduce((sum, row) => sum + row.totalTokens, 0);
    const totalCostUsd = parsedOnly.reduce((sum, row) => sum + row.estimatedCostUsd, 0);
    const avgCostPerResume = totalResumes > 0 ? totalCostUsd / totalResumes : 0;
    return { totalResumes, totalTokens, totalCostUsd, avgCostPerResume };
  }, [displayRows]);

  const pricingModel = getOpenAiPricingModel(pricingModelId);

  const addFiles = (files: FileList | File[] | null) => {
    if (!files?.length) return;
    const accepted = filterBulkCvFiles(Array.from(files));
    if (!accepted.length) {
      toast.error('Only PDF, DOC, and DOCX files are supported.');
      return;
    }
    setPendingFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      const next = [...prev];
      accepted.forEach((file) => {
        if (!names.has(file.name)) next.push(file);
      });
      return next;
    });
    setUploadOpen(true);
  };

  const runParseOnly = async () => {
    if (!canParse) {
      toast.error('You do not have permission to parse resumes.');
      return;
    }
    if (!pendingFiles.length) {
      toast.message('Add at least one resume file first.');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setParsing(true);
    setParseProgress({ current: 0, total: pendingFiles.length });
    const batch: DemoAiParseRecord[] = [];

    try {
      for (let i = 0; i < pendingFiles.length; i += 1) {
        if (controller.signal.aborted) break;
        const file = pendingFiles[i];
        setParseProgress({ current: i + 1, total: pendingFiles.length });
        try {
          const response = await apiParseCandidateResume(file, { signal: controller.signal });
          const usage = tokenUsageFromParseResponse(response);
          batch.push(recordFromFileAndUsage(file.name, usage));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Parse failed';
          batch.push(failedRecord(file.name, message));
        }
      }

      if (batch.length) {
        appendDemoAiParseRecords(batch);
        setHasLiveData(true);
        setRecords(readDemoAiParseSession());
        setPendingFiles([]);
        setUploadOpen(false);
        toast.success(
          `Parsed ${batch.filter((r) => r.status === 'parsed').length} of ${batch.length} resume${batch.length === 1 ? '' : 's'} (not saved to Candidates).`,
        );
      }
    } finally {
      setParsing(false);
      setParseProgress({ current: 0, total: 0 });
      abortRef.current = null;
    }
  };

  const handleExport = () => {
    downloadCsv(
      'resume-parsing-summary.csv',
      [
        { id: 'resumeName', label: 'Resume Name', accessor: (row: DisplayRow) => row.resumeName },
        { id: 'totalTokens', label: 'Total Token', accessor: (row: DisplayRow) => row.totalTokens },
        {
          id: 'totalCost',
          label: `Total Cost (${pricingModel.label})`,
          accessor: (row: DisplayRow) => formatUsd(row.estimatedCostUsd),
        },
        { id: 'actualModel', label: 'Parsed with (API)', accessor: (row: DisplayRow) => row.actualGptModel },
        { id: 'parsedOn', label: 'Parsed On', accessor: (row: DisplayRow) => formatDateTimeDMY(row.parsedOn) },
      ],
      displayRows,
    );
  };

  const handleClearSession = () => {
    clearDemoAiParseSession();
    setRecords([]);
    setHasLiveData(false);
    setPendingFiles([]);
    toast.message('Parse history cleared.');
  };

  return (
    <div className="min-h-screen bg-slate-100 font-['Arimo',sans-serif] text-slate-900">
      <Toaster position="top-right" richColors style={{ top: '5rem' }} />
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.65rem]">
              Resume Parsing Overview
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Parse-only — resumes are not stored. Token usage comes from the real parse API; costs are estimated for
              the OpenAI model you select below.
              {isSampleView ? (
                <span className="ml-2 inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
                  Sample row
                </span>
              ) : (
                <span className="ml-2 inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
                  Live parse session
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
              <Calendar size={14} className="text-slate-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="border-0 bg-transparent p-0 text-xs focus:outline-none focus:ring-0"
                aria-label="From date"
              />
              <span className="text-slate-400">–</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="border-0 bg-transparent p-0 text-xs focus:outline-none focus:ring-0"
                aria-label="To date"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setUploadOpen((v) => !v);
                if (!uploadOpen) fileInputRef.current?.click();
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold shadow-sm transition-colors ${
                uploadOpen
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-900'
                  : 'border-indigo-200/70 bg-white text-indigo-900 hover:border-indigo-300 hover:bg-indigo-50/90'
              }`}
            >
              <Upload size={14} className="text-indigo-600" strokeWidth={2.25} />
              Bulk CV
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
            >
              <Download size={14} />
              Export
            </button>
            {hasLiveData ? (
              <button
                type="button"
                onClick={handleClearSession}
                className="rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
              >
                Clear history
              </button>
            ) : null}
          </div>
        </header>

        {uploadOpen ? (
          <div className="mb-6 rounded-xl border border-indigo-200/80 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Bulk CV — parse only</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Same resume parsing API as Candidates. Nothing is written to your candidate database.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !parsing && setUploadOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                aria-label="Close upload panel"
              >
                <X size={16} />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                addFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 px-4 py-8 text-center transition-colors hover:border-indigo-300 hover:bg-indigo-50/50"
            >
              <Upload className="mb-2 text-indigo-500" size={28} />
              <p className="text-sm font-semibold text-slate-800">Drop resumes here or click to browse</p>
              <p className="mt-1 text-xs text-slate-500">PDF, DOC, DOCX — multiple files supported</p>
            </div>
            {pendingFiles.length > 0 ? (
              <ul className="mt-3 max-h-32 space-y-1 overflow-y-auto text-xs text-slate-700">
                {pendingFiles.map((file) => (
                  <li key={file.name} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1">
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      className="shrink-0 text-rose-600 hover:underline"
                      onClick={() => setPendingFiles((prev) => prev.filter((f) => f.name !== file.name))}
                      disabled={parsing}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={parsing || pendingFiles.length === 0}
                onClick={() => void runParseOnly()}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {parsing ? <Loader2 size={16} className="animate-spin" /> : null}
                {parsing
                  ? `Parsing ${parseProgress.current}/${parseProgress.total}…`
                  : `Parse ${pendingFiles.length || 0} resume${pendingFiles.length === 1 ? '' : 's'}`}
              </button>
              <button
                type="button"
                disabled={parsing}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Add more files
              </button>
            </div>
          </div>
        ) : null}

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Total Resumes Parsed"
            count={summary.totalResumes}
            color="blue"
            icon={<FileText size={18} strokeWidth={2.2} />}
          />
          <SummaryCard
            label="Total Tokens Used"
            count={formatTokenCount(summary.totalTokens)}
            color="green"
            icon={<Coins size={18} strokeWidth={2.2} />}
            hint={isSampleView ? 'sample' : undefined}
          />
          <SummaryCard
            label="Total Cost (USD)"
            count={formatUsd(summary.totalCostUsd)}
            color="purple"
            icon={<DollarSign size={18} strokeWidth={2.2} />}
            hint={pricingModel.label}
          />
          <SummaryCard
            label="Avg. Cost / Resume"
            count={formatUsd(summary.avgCostPerResume)}
            color="orange"
            icon={<TrendingUp size={18} strokeWidth={2.2} />}
            hint={pricingModel.label}
          />
        </div>

        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="min-w-[14rem] flex-1 sm:max-w-sm">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Estimate cost using (OpenAI model)
            </label>
            <div className="relative">
              <select
                value={pricingModelId}
                onChange={(e) => setPricingModelId(e.target.value)}
                className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-9 text-sm text-slate-800 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {OPENAI_PRICING_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              Token counts stay the same; cost uses ${pricingModel.inputPerM}/1M input · $
              {pricingModel.outputPerM}/1M output for {pricingModel.label}.
            </p>
          </div>
          <div className="min-w-[10rem]">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Date from
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div className="min-w-[10rem]">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Date to
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
              }}
              className="h-10 rounded-lg px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50"
            >
              Clear dates
            </button>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
            <h2 className="text-sm font-bold text-slate-900">Parsing Summary</h2>
            <p className="text-[11px] text-slate-500">
              Cost column uses <span className="font-semibold text-slate-700">{pricingModel.label}</span> · Parsed with
              shows the model the API actually used
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="w-12 px-4 py-3 sm:px-5">#</th>
                  <th className="px-4 py-3 sm:px-5">Resume Name</th>
                  <th className="px-4 py-3 sm:px-5">Total Token</th>
                  <th className="px-4 py-3 sm:px-5">Total Cost</th>
                  <th className="px-4 py-3 sm:px-5">Parsed with (API)</th>
                  <th className="px-4 py-3 sm:px-5">Parsed On</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                      No rows in this date range.
                    </td>
                  </tr>
                ) : (
                  displayRows.map((row, index) => (
                    <tr
                      key={row.id}
                      className={`border-b border-slate-50 transition-colors hover:bg-slate-50/60 ${
                        row.status === 'failed' ? 'bg-rose-50/40' : ''
                      }`}
                    >
                      <td className="px-4 py-3.5 text-slate-500 sm:px-5">{index + 1}</td>
                      <td className="px-4 py-3.5 font-medium text-slate-900 sm:px-5">
                        {row.resumeName}
                        {row.status === 'failed' && row.errorMessage ? (
                          <p className="mt-0.5 text-[11px] font-normal text-rose-600">{row.errorMessage}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3.5 tabular-nums text-slate-800 sm:px-5">
                        {row.status === 'parsed' ? formatTokenCount(row.totalTokens) : '—'}
                      </td>
                      <td className="px-4 py-3.5 tabular-nums font-medium text-slate-900 sm:px-5">
                        {row.status === 'parsed' ? formatUsd(row.estimatedCostUsd) : '—'}
                      </td>
                      <td className="px-4 py-3.5 sm:px-5">
                        <span className="inline-flex rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
                          {row.actualGptModel}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 sm:px-5">
                        {formatDateTimeDMY(row.parsedOn)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {isSampleView ? (
          <p className="mt-4 text-center text-xs text-slate-500">
            Sample row uses <span className="font-semibold">3,760</span> tokens — change the OpenAI model above to see
            cost change (e.g. GPT-4.1 vs GPT-4o mini). Click <span className="font-semibold">Bulk CV</span> to parse
            real files.
          </p>
        ) : null}
      </div>
    </div>
  );
}
