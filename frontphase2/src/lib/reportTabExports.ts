import { apiFetch } from './api';
import { downloadCsv } from '../utils/csv';
import { buildReportQueryString, type FiltersState } from '../app/reports/reports-filters';

export type ReportDataset = {
  entity?: string;
  title: string;
  columns: string[];
  rows: Record<string, string | number>[];
  totalRows?: number;
};

export type TabDetailResponse = {
  tab: string;
  jobs?: ReportDataset;
  clients?: ReportDataset;
  candidates?: ReportDataset;
  interviews?: ReportDataset;
  placements?: ReportDataset;
};

export async function fetchReportTabDetail(tabKey: string, filters: FiltersState): Promise<TabDetailResponse> {
  const query = buildReportQueryString(filters);
  const response = await apiFetch<TabDetailResponse>(`/reports/tab-detail/${tabKey}?${query}`, { auth: true });
  return response.data;
}

export async function fetchReportDataset(entity: string, filters: FiltersState): Promise<ReportDataset> {
  const query = buildReportQueryString(filters);
  const response = await apiFetch<ReportDataset>(`/reports/dataset/${entity}?${query}`, { auth: true });
  return response.data;
}

export function downloadReportDatasetCsv(dataset: ReportDataset, filename: string) {
  const rows = dataset.rows || [];
  if (!rows.length) {
    throw new Error('No rows to export for the current filters.');
  }
  const columns = (dataset.columns || []).map((column) => ({
    id: column,
    accessor: (row: Record<string, string | number>) => row[column] ?? '',
  }));
  downloadCsv(filename, columns, rows);
}

export async function exportReportEntityCsv(
  entity: 'jobs' | 'clients' | 'candidates' | 'interviews' | 'placements',
  filters: FiltersState,
) {
  const dataset = await fetchReportDataset(entity, filters);
  const date = new Date().toISOString().slice(0, 10);
  downloadReportDatasetCsv(dataset, `${entity}-${date}.csv`);
  return dataset.rows.length;
}
