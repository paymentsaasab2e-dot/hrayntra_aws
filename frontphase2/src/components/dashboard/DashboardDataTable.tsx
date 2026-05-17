'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import {
  formatTableCellValue,
  formatTableHeader,
  getVisibleTableColumns,
  isHiddenTableColumn,
} from '../../lib/dashboard/tableColumns';

export type DashboardTableVariant = 'table' | 'expandable' | 'pivot';

const DASHBOARD_TABLE_PREVIEW_ROWS = 5;

type Props = {
  rows: Record<string, unknown>[];
  variant?: DashboardTableVariant;
  maxRows?: number;
  maxColumns?: number;
  previewRowLimit?: number;
  viewAllHref?: string | null;
  viewAllLabel?: string;
  className?: string;
  fillHeight?: boolean;
  'aria-label'?: string;
};

function pickPivotCategoryKey(rows: Record<string, unknown>[], columns: string[]) {
  const preferred = ['status', 'stage', 'metric', 'source', 'module', 'recordType', 'department', 'role'];
  for (const key of preferred) {
    if (columns.includes(key)) return key;
  }
  return columns.find((c) => rows.some((r) => typeof r[c] === 'string')) || columns[0];
}

function pickPivotValueKey(rows: Record<string, unknown>[], columns: string[], categoryKey: string) {
  return columns.find((c) => c !== categoryKey && rows.some((r) => typeof r[c] === 'number')) || null;
}

export function DashboardDataTable({
  rows,
  variant = 'table',
  maxRows = 100,
  maxColumns = 10,
  previewRowLimit = DASHBOARD_TABLE_PREVIEW_ROWS,
  viewAllHref = null,
  viewAllLabel = 'View all',
  className = '',
  fillHeight = true,
  'aria-label': ariaLabel = 'Dataset table',
}: Props) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const visible = useMemo(() => getVisibleTableColumns(rows, maxColumns), [rows, maxColumns]);

  const pivotData = useMemo(() => {
    if (variant !== 'pivot' || !visible.length) return null;
    const categoryKey = pickPivotCategoryKey(rows, visible);
    const valueKey = pickPivotValueKey(rows, visible, categoryKey);
    const groups = new Map<string, { count: number; sum: number }>();
    for (const row of rows) {
      const label = String(row[categoryKey] ?? 'Unknown').trim() || 'Unknown';
      const prev = groups.get(label) || { count: 0, sum: 0 };
      const num = valueKey ? Number(row[valueKey]) : 1;
      groups.set(label, {
        count: prev.count + 1,
        sum: prev.sum + (Number.isFinite(num) ? num : 0),
      });
    }
    return {
      categoryKey,
      valueKey,
      rows: [...groups.entries()].map(([name, stats]) => ({
        name,
        count: stats.count,
        total: stats.sum,
      })),
    };
  }, [rows, variant, visible]);

  const allDisplayRows = useMemo(() => {
    if (variant === 'pivot' && pivotData) return pivotData.rows as Record<string, unknown>[];
    return rows.slice(0, maxRows);
  }, [rows, maxRows, variant, pivotData]);

  const totalCount = allDisplayRows.length;
  const displayRows = useMemo(
    () => allDisplayRows.slice(0, previewRowLimit),
    [allDisplayRows, previewRowLimit]
  );
  const hasMoreRows = totalCount > previewRowLimit;

  const displayColumns = useMemo(() => {
    if (variant === 'pivot' && pivotData) {
      const cols = ['name', 'count'];
      if (pivotData.valueKey) cols.push('total');
      return cols;
    }
    return visible;
  }, [variant, pivotData, visible]);

  if (!displayRows.length || !displayColumns.length) {
    return (
      <div className="flex min-h-[120px] items-center justify-center px-4 py-8 text-center">
        <p className="text-xs font-medium text-slate-500">No data to display in this table.</p>
      </div>
    );
  }

  const scrollClass =
    'custom-scrollbar overflow-x-auto overflow-y-auto ' +
    (fillHeight && hasMoreRows ? 'min-h-0 max-h-[220px] flex-1' : fillHeight ? 'min-h-0 flex-1' : 'max-h-[220px]');

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-lg border border-indigo-100/50 bg-white ${fillHeight ? 'h-full min-h-[140px]' : ''} ${className}`}
    >
      <div className={scrollClass}>
        <table className="w-full min-w-[640px] text-left" aria-label={ariaLabel}>
          <thead className="sticky top-0 z-[1]">
            <tr className="border-b border-indigo-100/50 bg-gradient-to-r from-slate-50/95 via-indigo-50/50 to-violet-50/40 text-[9px] font-bold uppercase tracking-[0.12em] text-indigo-950/45">
              {variant === 'expandable' ? (
                <th className="w-9 px-2 py-2" aria-label="Expand" />
              ) : null}
              {displayColumns.map((key) => (
                <th key={key} className="whitespace-nowrap px-3 py-2 sm:px-4">
                  {variant === 'pivot'
                    ? key === 'name'
                      ? formatTableHeader(pivotData?.categoryKey || 'name')
                      : key === 'count'
                        ? 'Count'
                        : 'Total'
                    : formatTableHeader(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {displayRows.map((row, i) => {
              const rowKey = String(row.id ?? i);
              const isExpanded = expandedKeys.has(rowKey);
              const extraKeys =
                variant === 'expandable'
                  ? Object.keys(row).filter((k) => !isHiddenTableColumn(k) && !displayColumns.includes(k))
                  : [];

              return (
                <React.Fragment key={rowKey}>
                  <tr className="group transition-colors duration-200 even:bg-slate-50/35 hover:bg-indigo-50/45">
                    {variant === 'expandable' ? (
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(rowKey)}
                          className="rounded p-0.5 text-slate-500 hover:bg-indigo-100 hover:text-indigo-700"
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </td>
                    ) : null}
                    {displayColumns.map((key) => (
                      <td key={key} className="px-3 py-2 align-top sm:px-4">
                        <CellContent columnKey={key} value={row[key]} />
                      </td>
                    ))}
                  </tr>
                  {variant === 'expandable' && isExpanded && extraKeys.length > 0 ? (
                    <tr className="bg-indigo-50/30">
                      <td
                        colSpan={displayColumns.length + 1}
                        className="px-4 py-3"
                      >
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {extraKeys.map((key) => (
                            <div key={key} className="text-xs">
                              <span className="font-bold uppercase tracking-wider text-slate-400">
                                {formatTableHeader(key)}
                              </span>
                              <p className="mt-0.5 font-medium text-slate-800">
                                {formatTableCellValue(key, row[key])}
                              </p>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {(hasMoreRows || viewAllHref) && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-indigo-100/50 bg-slate-50/80 px-3 py-2">
          <p className="text-[11px] font-medium text-slate-500">
            Showing {displayRows.length} of {totalCount}
            {totalCount !== rows.length && rows.length > totalCount
              ? ` (${rows.length} loaded)`
              : ''}
          </p>
          {viewAllHref && (hasMoreRows || totalCount > 0) ? (
            <Link
              href={viewAllHref}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 hover:text-indigo-900"
            >
              {viewAllLabel}
              <ExternalLink size={12} aria-hidden />
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}

function CellContent({ columnKey, value }: { columnKey: string; value: unknown }) {
  const text = formatTableCellValue(columnKey, value);

  if (columnKey === 'status' || columnKey === 'stage' || columnKey === 'name') {
    if (columnKey === 'status' || columnKey === 'stage') {
      return (
        <span className="inline-flex max-w-[10rem] rounded-full bg-slate-100/80 px-2 py-0.5 text-[11px] font-semibold text-slate-800 ring-1 ring-slate-200/90">
          {text}
        </span>
      );
    }
    return <span className="line-clamp-2 text-xs font-semibold text-slate-900">{text}</span>;
  }

  if (columnKey === 'companyName' || columnKey === 'title') {
    return <span className="line-clamp-2 text-xs font-semibold text-slate-900">{text}</span>;
  }

  return <span className="text-xs font-medium text-slate-700">{text}</span>;
}

