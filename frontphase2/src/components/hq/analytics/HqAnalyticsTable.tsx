'use client';

import { HqPanel, HqPanelTitle, HqTableShell } from '../hqUi';

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
    <HqPanel className="!p-0 overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4">
        <HqPanelTitle title={title} meta={meta} />
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-xs font-medium text-slate-500">{empty}</p>
      ) : (
        <HqTableShell className="rounded-none border-0 shadow-none">
          <table className="min-w-[520px] text-left">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={col.align === 'right' ? 'text-right' : 'text-left'}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx}>
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={
                        col.align === 'right' ? 'text-right font-semibold text-slate-900' : ''
                      }
                    >
                      {row[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </HqTableShell>
      )}
    </HqPanel>
  );
}
