'use client';

import { HqPanel, HqPanelTitle } from '../hqUi';

export function HqAnalyticsTable({
  title,
  meta,
  columns,
  rows,
  empty = 'No rows yet.',
}: {
  title: string;
  meta?: React.ReactNode;
  columns: Array<{ key: string; label: string; align?: 'left' | 'right' }>;
  rows: Array<Record<string, React.ReactNode>>;
  empty?: string;
}) {
  return (
    <HqPanel className="overflow-x-auto">
      <HqPanelTitle title={title} meta={meta} />
      {rows.length === 0 ? (
        <p className="text-xs text-slate-500">{empty}</p>
      ) : (
        <table className="w-full min-w-[520px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-2 py-2 font-semibold ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="border-b border-slate-50 last:border-b-0">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-2 py-2.5 text-slate-700 ${col.align === 'right' ? 'text-right font-semibold text-slate-900' : ''}`}
                  >
                    {row[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </HqPanel>
  );
}
