'use client';

import React from 'react';
import Link from 'next/link';
import { ExternalLink, X } from 'lucide-react';
import { useEnterpriseDashboard } from './smartDashboardFilters';

export function DrillDownModal() {
  const { drillDown, closeDrillDown } = useEnterpriseDashboard();
  if (!drillDown) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={closeDrillDown}
      />
      <div className="relative z-10 max-h-[80vh] w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Drill-down</p>
            <h3 className="text-lg font-bold text-slate-900">{drillDown.title}</h3>
          </div>
          <button
            type="button"
            onClick={closeDrillDown}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto px-5 py-4">
          {drillDown.rows?.length ? (
            drillDown.rows.map((row, i) => (
              <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm">
                {Object.entries(row)
                  .slice(0, 4)
                  .map(([k, v]) => (
                    <span key={k} className="mr-3 text-slate-600">
                      <span className="font-semibold text-slate-800">{k}:</span> {String(v)}
                    </span>
                  ))}
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">
              Open the filtered module list to inspect live records for this metric. Navigation stays
              in a modal context — use the link below.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={closeDrillDown}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
          {drillDown.href ? (
            <Link
              href={drillDown.href}
              onClick={closeDrillDown}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2098C8] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1a86b3]"
            >
              Open records <ExternalLink size={14} />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
