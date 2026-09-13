'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  mergeClientStageCatalog,
  normalizeAllowedClientStages,
  stageIdFromName,
} from '../../lib/clientTrackerOptions';
import { CLIENT_PIPELINE_STAGE_CHOICES } from '../../lib/clientReviewTypes';

type Props = {
  allowedClientStages: string[];
  clientStageCatalog: string[];
  disabled?: boolean;
  onChange: (next: { allowedClientStages: string[]; clientStageCatalog: string[] }) => void;
};

function isDefaultClientStage(stageName: string): boolean {
  const lower = String(stageName || '').trim().toLowerCase();
  return CLIENT_PIPELINE_STAGE_CHOICES.some((row) => row.name.toLowerCase() === lower);
}

export function ClientPreviewStagesPicker({
  allowedClientStages,
  clientStageCatalog,
  disabled,
  onChange,
}: Props) {
  const [newStageName, setNewStageName] = useState('');
  const [hint, setHint] = useState('');

  const stageCatalog = useMemo(
    () =>
      mergeClientStageCatalog(CLIENT_PIPELINE_STAGE_CHOICES, [
        ...(clientStageCatalog || []),
        ...(allowedClientStages || []),
      ]),
    [allowedClientStages, clientStageCatalog],
  );

  const selectedStages = useMemo(
    () => normalizeAllowedClientStages(allowedClientStages, stageCatalog, true),
    [allowedClientStages, stageCatalog],
  );

  const emit = (nextStages: string[], nextCatalog = stageCatalog) => {
    onChange({
      allowedClientStages: nextStages,
      clientStageCatalog: nextCatalog.map((row) => row.name),
    });
  };

  const toggleStage = (stageName: string) => {
    const exists = selectedStages.some((name) => name.toLowerCase() === stageName.toLowerCase());
    const nextStages = exists
      ? selectedStages.filter((name) => name.toLowerCase() !== stageName.toLowerCase())
      : [...selectedStages, stageName];
    if (!nextStages.length) {
      setHint('Select at least one stage for the client.');
      return;
    }
    setHint('');
    const ordered = stageCatalog
      .map((s) => s.name)
      .filter((name) => nextStages.some((n) => n.toLowerCase() === name.toLowerCase()));
    emit(ordered);
  };

  const addCustomStage = () => {
    const name = newStageName.trim();
    if (!name) return;
    if (stageCatalog.some((row) => row.name.toLowerCase() === name.toLowerCase())) {
      setHint('That stage already exists.');
      return;
    }
    const nextCatalog = [...stageCatalog, { id: stageIdFromName(name), name }];
    setNewStageName('');
    setHint('');
    emit([...selectedStages, name], nextCatalog);
  };

  const deleteCatalogStage = (stageName: string) => {
    if (isDefaultClientStage(stageName)) {
      setHint('Default stages cannot be deleted.');
      return;
    }
    if (stageCatalog.length <= 1) {
      setHint('Keep at least one stage option.');
      return;
    }
    const nextCatalog = stageCatalog.filter(
      (row) => row.name.toLowerCase() !== stageName.toLowerCase(),
    );
    let nextStages = selectedStages.filter(
      (name) => name.toLowerCase() !== stageName.toLowerCase(),
    );
    if (!nextStages.length) {
      nextStages = [nextCatalog[0]!.name];
    }
    setHint('');
    emit(nextStages, nextCatalog);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/90 px-3.5 py-2.5">
        <div>
          <p className="text-xs font-semibold text-slate-800">Stages shown to client</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {selectedStages.length} of {stageCatalog.length} selected · used automatically on Submit
            to Client
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => emit(stageCatalog.map((s) => s.name))}
            className="rounded-lg px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
          >
            Select all
          </button>
          <span className="text-slate-300">·</span>
          <button
            type="button"
            disabled={disabled || selectedStages.length <= 1}
            onClick={() => {
              const first = stageCatalog[0]?.name;
              if (!first) return;
              emit([first]);
            }}
            className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </div>

      <p className="border-b border-slate-100 px-3.5 py-2 text-[11px] text-slate-500">
        Tick stages for the client · add custom stages below · only custom stages can be deleted
      </p>

      <div className="grid grid-cols-2 gap-1.5 p-2.5 sm:grid-cols-3">
        {stageCatalog.map((stage) => {
          const checked = selectedStages.some(
            (name) => name.toLowerCase() === stage.name.toLowerCase(),
          );
          const canDelete = !isDefaultClientStage(stage.name);
          return (
            <div
              key={stage.id}
              className={`group flex min-w-0 items-center gap-1.5 rounded-xl px-2 py-1.5 transition ${
                checked
                  ? 'bg-indigo-50 ring-1 ring-indigo-200'
                  : 'bg-slate-50/80 ring-1 ring-transparent hover:bg-slate-50'
              }`}
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() => toggleStage(stage.name)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:opacity-60"
                title={stage.name}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                    checked
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-slate-300 bg-white text-transparent'
                  }`}
                  aria-hidden
                >
                  ✓
                </span>
                <span
                  className={`truncate text-xs sm:text-sm ${
                    checked ? 'font-semibold text-indigo-900' : 'text-slate-700'
                  }`}
                >
                  {stage.name}
                </span>
              </button>
              {canDelete ? (
                <button
                  type="button"
                  disabled={disabled || stageCatalog.length <= 1}
                  onClick={() => deleteCatalogStage(stage.name)}
                  className="shrink-0 rounded-lg p-1 text-slate-400 opacity-70 transition hover:bg-white hover:text-rose-600 group-hover:opacity-100 disabled:opacity-30"
                  title={`Delete ${stage.name}`}
                  aria-label={`Delete ${stage.name}`}
                >
                  <Trash2 size={13} strokeWidth={2.25} />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-3 py-2.5">
        <input
          type="text"
          value={newStageName}
          onChange={(e) => setNewStageName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCustomStage();
            }
          }}
          disabled={disabled}
          placeholder="Add a stage name…"
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-indigo-200 focus:ring-2 disabled:opacity-60"
        />
        <button
          type="button"
          disabled={disabled || !newStageName.trim()}
          onClick={() => addCustomStage()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Plus size={15} strokeWidth={2.5} />
          Add
        </button>
      </div>
      {hint ? <p className="border-t border-slate-100 px-3.5 py-2 text-xs text-amber-700">{hint}</p> : null}
    </div>
  );
}
