'use client';

import React from 'react';
import { Pencil, Plus, Save } from 'lucide-react';

type Props = {
  editMode: boolean;
  saving?: boolean;
  onAddWidget: () => void;
  onSaveLayout: () => void;
  onDone: () => void;
  onCustomize: () => void;
  /** When false, only show Add widget (e.g. compact header). */
  showCustomizeWhenIdle?: boolean;
};

export function DashboardWidgetToolbar({
  editMode,
  saving = false,
  onAddWidget,
  onSaveLayout,
  onDone,
  onCustomize,
  showCustomizeWhenIdle = true,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onAddWidget}
        className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-800 shadow-sm hover:bg-indigo-50"
      >
        <Plus size={14} strokeWidth={2.25} /> Add widget
      </button>
      {editMode ? (
        <>
          <button
            type="button"
            onClick={onSaveLayout}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            <Save size={14} strokeWidth={2.25} /> {saving ? 'Saving…' : 'Save layout'}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            Done
          </button>
        </>
      ) : showCustomizeWhenIdle ? (
        <button
          type="button"
          onClick={onCustomize}
          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-800 shadow-sm hover:bg-indigo-50"
        >
          <Pencil size={14} strokeWidth={2.25} /> Customize
        </button>
      ) : null}
    </div>
  );
}
