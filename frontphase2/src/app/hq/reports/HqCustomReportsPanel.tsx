'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BookmarkPlus, Copy, Download, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { requestConfirm } from '@/lib/appDialog';
import {
  apiHqCreateCustomReport,
  apiHqDeleteCustomReport,
  apiHqUpdateCustomReport,
  type HqCustomReportRow,
} from '@/lib/api';
import { HqReportChart } from './HqReportCharts';
import { HqReportRecordsTable } from './HqReportRecordsTable';
import {
  downloadCsv,
  HQ_REPORT_DATASETS,
  HQ_REPORT_GROUP_BY,
  pickCustomChartKind,
  runCustomHqReport,
  type HqNamedCount,
} from './hqReportsBuild';
import type { HqReportSourceData } from './hqReportsViews';
import { HQ_REPORTS_BTN_PRIMARY, HQ_REPORTS_BTN_SECONDARY, HQ_REPORTS_CARD, HQ_REPORTS_INPUT } from './hqReportsChrome';

const INPUT_CLASS = HQ_REPORTS_INPUT;

export function HqCustomReportsPanel({
  mode,
  data,
  savedReports,
  setSavedReports,
  fromIso,
  toIso,
  onOpenInBuilder,
}: {
  mode: 'builder' | 'saved';
  data: HqReportSourceData;
  savedReports: HqCustomReportRow[];
  setSavedReports: React.Dispatch<React.SetStateAction<HqCustomReportRow[]>>;
  fromIso: string | null;
  toIso: string | null;
  onOpenInBuilder?: () => void;
}) {
  const [customName, setCustomName] = useState('');
  const [customDataset, setCustomDataset] = useState<HqCustomReportRow['dataset']>('leads');
  const [customGroupBy, setCustomGroupBy] = useState('stage');
  const [customMetric, setCustomMetric] = useState<HqCustomReportRow['metric']>('count');
  const [activeCustomId, setActiveCustomId] = useState<string | null>(null);
  const [savingCustom, setSavingCustom] = useState(false);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    const options = HQ_REPORT_GROUP_BY[customDataset];
    if (!options.some((item) => item.id === customGroupBy)) {
      setCustomGroupBy(options[0]?.id || 'status');
    }
  }, [customDataset, customGroupBy]);

  const customRows = useMemo(
    () => runCustomHqReport({ dataset: customDataset, groupBy: customGroupBy }, data),
    [customDataset, customGroupBy, data],
  );

  const previewRows = customMetric === 'pipeline' ? customRows.map((row) => ({ ...row, count: Math.round(Number(row.value || 0)) })) : customRows;
  const chartKind = pickCustomChartKind(previewRows, customMetric);

  const handleGenerate = () => setGenerated(true);

  const persist = async (asNew = false) => {
    const name = customName.trim();
    if (!name) {
      toast.error('Enter a name for this custom report');
      return;
    }
    setSavingCustom(true);
    try {
      const body = {
        name,
        dataset: customDataset,
        groupBy: customGroupBy,
        metric: customMetric,
        dateFrom: fromIso || '',
        dateTo: toIso || '',
      };
      const result =
        activeCustomId && !asNew
          ? await apiHqUpdateCustomReport(activeCustomId, body)
          : await apiHqCreateCustomReport(body);
      const saved = result.data?.report;
      if (saved) {
        setSavedReports((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)]);
        setActiveCustomId(saved.id);
      }
      toast.success(activeCustomId && !asNew ? 'Custom report updated' : 'Custom report saved');
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err ? String((err as { message?: string }).message) : '';
      toast.error(message || 'Failed to save custom report');
    } finally {
      setSavingCustom(false);
    }
  };

  const loadReport = (report: HqCustomReportRow, switchToBuilder = false) => {
    setActiveCustomId(report.id);
    setCustomName(report.name);
    setCustomDataset(report.dataset);
    setCustomGroupBy(report.groupBy);
    setCustomMetric(report.metric || 'count');
    setGenerated(true);
    if (switchToBuilder) onOpenInBuilder?.();
  };

  const exportRows = (rows: HqNamedCount[]) => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `hq-custom-${customDataset}-${stamp}.csv`,
      ['Group', customMetric === 'pipeline' ? 'Pipeline' : 'Count'],
      rows.map((row) => [row.label, customMetric === 'pipeline' ? Number(row.value || 0) : row.count]),
    );
    toast.success('Report exported');
  };

  const builder = (
    <div className="space-y-4">
      <div className={`${HQ_REPORTS_CARD} p-5`}>
        <div className="mb-4 flex items-center gap-2.5">
          <span className="h-4 w-1 shrink-0 rounded-full bg-gradient-to-b from-slate-900 to-blue-900" />
          <div>
            <h3 className="text-[13px] font-semibold tracking-tight text-slate-800">Custom report builder</h3>
            <p className="mt-0.5 text-sm text-slate-500">Choose a dataset, group it, generate a chart, then save or export.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Report name
            <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="e.g. Demo leads by owner" className={`${INPUT_CLASS} mt-1.5`} />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Dataset
            <select value={customDataset} onChange={(e) => setCustomDataset(e.target.value as HqCustomReportRow['dataset'])} className={`${INPUT_CLASS} mt-1.5`}>
              {HQ_REPORT_DATASETS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Group by
            <select value={customGroupBy} onChange={(e) => setCustomGroupBy(e.target.value)} className={`${INPUT_CLASS} mt-1.5`}>
              {HQ_REPORT_GROUP_BY[customDataset].map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Metric
            <select value={customMetric} onChange={(e) => setCustomMetric(e.target.value as HqCustomReportRow['metric'])} className={`${INPUT_CLASS} mt-1.5`}>
              <option value="count">Count</option>
              {(customDataset === 'leads' || customDataset === 'clients' || customDataset === 'companies') && <option value="pipeline">Pipeline value</option>}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={handleGenerate} className={HQ_REPORTS_BTN_PRIMARY}>
            Generate
          </button>
          <button type="button" onClick={() => void persist(false)} disabled={savingCustom} className={HQ_REPORTS_BTN_PRIMARY}>
            <BookmarkPlus className="h-4 w-4" />
            {savingCustom ? 'Saving…' : 'Save report'}
          </button>
          <button type="button" onClick={() => exportRows(previewRows)} className={HQ_REPORTS_BTN_SECONDARY}>
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>
      {generated ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className={`${HQ_REPORTS_CARD} px-4 py-3`}>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Total records</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{previewRows.reduce((sum, row) => sum + row.count, 0)}</p>
            </div>
            <div className={`${HQ_REPORTS_CARD} px-4 py-3`}>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Metric</p>
              <p className="mt-1 text-2xl font-bold capitalize text-slate-900">{customMetric}</p>
            </div>
          </div>
          <HqReportChart
            spec={{
              id: 'custom',
              title: `${HQ_REPORT_DATASETS.find((item) => item.id === customDataset)?.label || 'Custom'} by ${
                HQ_REPORT_GROUP_BY[customDataset].find((item) => item.id === customGroupBy)?.label || customGroupBy
              }`,
              kind: chartKind,
              rows: previewRows,
            }}
            metric={customMetric}
          />
          <HqReportRecordsTable
            title="Grouped data"
            columns={[
              { key: 'label', label: 'Group' },
              { key: 'count', label: customMetric === 'pipeline' ? 'Pipeline' : 'Count', align: 'right' },
            ]}
            rows={previewRows.map((row) => ({ id: row.label, label: row.label, count: row.count }))}
            search=""
            onSearchChange={() => undefined}
            filterOptions={[]}
            filters={{}}
            onFilterChange={() => undefined}
          />
        </>
      ) : null}
    </div>
  );

  const saved = (
    <div className={`${HQ_REPORTS_CARD} overflow-hidden`}>
      <div className="flex items-center gap-2.5 border-b border-indigo-50/80 px-5 py-4">
        <span className="h-4 w-1 shrink-0 rounded-full bg-gradient-to-b from-slate-900 to-blue-900" />
        <h3 className="text-[13px] font-semibold tracking-tight text-slate-800">Saved HQ reports</h3>
      </div>
      {savedReports.length === 0 ? (
        <p className="px-5 py-8 text-sm text-slate-500">No custom reports yet. Save one from the builder.</p>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Report name</th>
                <th className="px-4 py-2">Dataset</th>
                <th className="px-4 py-2">Group by</th>
                <th className="px-4 py-2">Metric</th>
                <th className="px-4 py-2">Date range</th>
                <th className="px-4 py-2">Created by</th>
                <th className="px-4 py-2">Created</th>
                <th className="px-4 py-2">Updated</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {savedReports.map((report) => (
                <tr key={report.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-semibold text-slate-900">{report.name}</td>
                  <td className="px-4 py-2 capitalize">{report.dataset}</td>
                  <td className="px-4 py-2">{report.groupBy}</td>
                  <td className="px-4 py-2">{report.metric}</td>
                  <td className="px-4 py-2">
                    {report.dateFrom || report.dateTo
                      ? `${report.dateFrom ? new Date(report.dateFrom).toLocaleDateString() : '…'} – ${
                          report.dateTo ? new Date(report.dateTo).toLocaleDateString() : '…'
                        }`
                      : 'All'}
                  </td>
                  <td className="px-4 py-2">{report.createdByEmail || '—'}</td>
                  <td className="px-4 py-2">{report.createdAt ? new Date(report.createdAt).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-2">{report.updatedAt ? new Date(report.updatedAt).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <button type="button" className="rounded px-2 py-1 text-xs font-semibold hover:bg-slate-100" title="Open" onClick={() => loadReport(report, true)}>
                        Open
                      </button>
                      <button
                        type="button"
                        className="rounded p-1.5 hover:bg-slate-100"
                        title="Duplicate"
                        onClick={() => {
                          loadReport({ ...report, id: '', name: `${report.name} copy` }, true);
                          setActiveCustomId(null);
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button type="button" className="rounded p-1.5 hover:bg-slate-100" title="Edit" onClick={() => loadReport(report, true)}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="rounded p-1.5 hover:bg-slate-100"
                        title="Export"
                        onClick={() => {
                          const rows = runCustomHqReport({ dataset: report.dataset, groupBy: report.groupBy }, data);
                          const metric = report.metric || 'count';
                          const stamp = new Date().toISOString().slice(0, 10);
                          downloadCsv(
                            `hq-custom-${report.dataset}-${stamp}.csv`,
                            ['Group', metric === 'pipeline' ? 'Pipeline' : 'Count'],
                            rows.map((row) => [row.label, metric === 'pipeline' ? Number(row.value || 0) : row.count]),
                          );
                          toast.success('Report exported');
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="rounded p-1.5 text-rose-500 hover:bg-rose-50"
                        title="Delete"
                        onClick={async () => {
                          const ok = await requestConfirm('Delete this custom report?', {
                            tone: 'warning',
                            title: 'Delete report',
                            confirmLabel: 'Delete',
                            cancelLabel: 'Cancel',
                          });
                          if (!ok) return;
                          try {
                            await apiHqDeleteCustomReport(report.id);
                            setSavedReports((prev) => prev.filter((item) => item.id !== report.id));
                            if (activeCustomId === report.id) setActiveCustomId(null);
                            toast.success('Custom report deleted');
                          } catch (err: unknown) {
                            const message = err && typeof err === 'object' && 'message' in err ? String((err as { message?: string }).message) : '';
                            toast.error(message || 'Failed to delete custom report');
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {mode === 'saved' ? null : builder}
    </div>
  );

  return mode === 'saved' ? saved : builder;
}
