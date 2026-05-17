'use client';

import React from 'react';
import {
  formatTableCellValue,
  formatTableHeader,
  getVisibleTableColumns,
} from '../../lib/dashboard/tableColumns';

type Props = {
  rows: Record<string, unknown>[];
  maxRows?: number;
  maxColumns?: number;
  className?: string;
  'aria-label'?: string;
};

/** Table styling aligned with the Leads page (`leads-main-table`). */
export function DashboardDataTable({
  rows,
  maxRows = 25,
  maxColumns = 8,
  className = '',
  'aria-label': ariaLabel = 'Dataset table',
}: Props) {
  const visible = getVisibleTableColumns(rows, maxColumns);
  const slice = rows.slice(0, maxRows);

  if (!slice.length || !visible.length) {
    return (
      <div className="flex min-h-[120px] items-center justify-center px-4 py-8 text-center">
        <p className="text-xs font-medium text-slate-500">No data to display in this table.</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col overflow-hidden ${className}`}>
      <div className="no-scrollbar max-h-[280px] overflow-x-auto overflow-y-auto">
        <table className="w-full min-w-[520px] text-left" aria-label={ariaLabel}>
          <thead>
            <tr className="border-b border-indigo-100/50 bg-gradient-to-r from-slate-50/95 via-indigo-50/50 to-violet-50/40 text-[9px] font-bold uppercase tracking-[0.12em] text-indigo-950/45">
              {visible.map((key) => (
                <th key={key} className="whitespace-nowrap px-3 py-2 sm:px-4">
                  {formatTableHeader(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {slice.map((row, i) => (
              <tr
                key={i}
                className="group transition-colors duration-200 even:bg-slate-50/35 hover:bg-indigo-50/45"
              >
                {visible.map((key) => (
                  <td key={key} className="px-3 py-2 align-top sm:px-4">
                    <CellContent columnKey={key} value={row[key]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CellContent({ columnKey, value }: { columnKey: string; value: unknown }) {
  const text = formatTableCellValue(columnKey, value);

  if (columnKey === 'status' || columnKey === 'stage') {
    return (
      <span className="inline-flex max-w-[10rem] rounded-full bg-slate-100/80 px-2 py-0.5 text-[11px] font-semibold text-slate-800 ring-1 ring-slate-200/90">
        {text}
      </span>
    );
  }

  if (columnKey === 'companyName' || columnKey === 'name' || columnKey === 'title') {
    return <span className="line-clamp-2 text-xs font-semibold text-slate-900">{text}</span>;
  }

  return <span className="text-xs font-medium text-slate-700">{text}</span>;
}

