'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Trash2, FileText, AlertCircle, RotateCcw, Loader2, Cloud } from 'lucide-react';
import {
  FAILED_BULK_RESUMES_CHANGED,
  getActiveFailedBulkResumes,
  moveFailedBulkResumeToTrash,
  moveFailedBulkResumesToTrash,
  type FailedBulkResumeRecord,
} from '@/lib/failedBulkResumesStore';
import { getFailedBulkResumeFile } from '@/lib/failedBulkResumesFilesDb';
import {
  apiBulkCvDownloadFailedResumeFile,
  apiBulkCvListFailedResumes,
  apiBulkCvTrashFailedResumes,
  type ServerFailedBulkResume,
} from '@/lib/api';
import { RECYCLE_BIN_SYNC_EVENT } from '@/constants/recycleBin';
import { requestConfirm } from '@/lib/appDialog';
import { BULK_CV_ACCEPT_INPUT } from '@/lib/bulkCvFileTypes';
import { formatDateTimeDMY } from '@/utils/dateDisplay';
import { toast } from 'sonner';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onReupload: (file: File) => void;
  /** Retry with files (+ optional server ids in the same order). */
  onRetryFiles?: (files: File[], serverIds?: string[]) => void;
};

type UnifiedRow = {
  key: string;
  fileName: string;
  reason: string;
  failedAt: string;
  source: 'server' | 'local';
  serverId?: string;
  localId?: string;
  hasFile: boolean;
};

function mapServerRow(row: ServerFailedBulkResume): UnifiedRow {
  return {
    key: `server:${row.id}`,
    fileName: row.fileName,
    reason: row.reason,
    failedAt: row.failedAt,
    source: 'server',
    serverId: row.id,
    hasFile: row.hasFile !== false,
  };
}

function mapLocalRow(row: FailedBulkResumeRecord): UnifiedRow {
  return {
    key: `local:${row.id}`,
    fileName: row.fileName,
    reason: row.reason,
    failedAt: row.failedAt,
    source: 'local',
    localId: row.id,
    hasFile: Boolean(row.hasFile),
  };
}

export default function FailedBulkResumesDrawer({
  isOpen,
  onClose,
  onReupload,
  onRetryFiles,
}: Props) {
  const [portalMounted, setPortalMounted] = useState(false);
  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [retryingKey, setRetryingKey] = useState<string | null>(null);
  const [retryingBatch, setRetryingBatch] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      let serverItems: ServerFailedBulkResume[] = [];
      try {
        const listed = await apiBulkCvListFailedResumes();
        serverItems = Array.isArray(listed.items) ? listed.items : [];
      } catch {
        serverItems = [];
      }
      const localItems = getActiveFailedBulkResumes();
      const serverNames = new Set(serverItems.map((r) => String(r.fileName || '').toLowerCase()));
      const localOnly = localItems.filter(
        (r) => !serverNames.has(String(r.fileName || '').toLowerCase())
      );
      setRows([...serverItems.map(mapServerRow), ...localOnly.map(mapLocalRow)]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPortalMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      void refresh();
    } else {
      setSelectedKeys([]);
      setRetryingKey(null);
      setRetryingBatch(false);
    }
  }, [isOpen, refresh]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => {
      void refresh();
    };
    window.addEventListener(FAILED_BULK_RESUMES_CHANGED, handler);
    return () => window.removeEventListener(FAILED_BULK_RESUMES_CHANGED, handler);
  }, [refresh]);

  useEffect(() => {
    setSelectedKeys((prev) => prev.filter((key) => rows.some((row) => row.key === key)));
  }, [rows]);

  const count = rows.length;
  const allSelected = count > 0 && selectedKeys.length === count;
  const someSelected = selectedKeys.length > 0 && !allSelected;
  const selectedRows = rows.filter((r) => selectedKeys.includes(r.key));
  const retryableSelected = selectedRows.filter((r) => r.hasFile);
  const retryableAll = rows.filter((r) => r.hasFile);
  const serverCount = rows.filter((r) => r.source === 'server').length;

  const openPicker = () => {
    fileInputRef.current?.click();
  };

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    onReupload(file);
    onClose();
  };

  const notifyRecycleBin = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(RECYCLE_BIN_SYNC_EVENT));
    }
  };

  const loadFilesForRows = async (
    target: UnifiedRow[]
  ): Promise<{ files: File[]; serverIds: string[] }> => {
    const files: File[] = [];
    const serverIds: string[] = [];
    for (const row of target) {
      let file: File | null = null;
      if (row.source === 'server' && row.serverId) {
        try {
          file = await apiBulkCvDownloadFailedResumeFile(row.serverId);
        } catch {
          file = null;
        }
      } else if (row.localId) {
        file = await getFailedBulkResumeFile(row.localId);
      }
      if (file) {
        files.push(file);
        serverIds.push(row.serverId || '');
      }
    }
    return { files, serverIds };
  };

  const handleRetryRows = async (target: UnifiedRow[], mode: 'one' | 'batch') => {
    if (!onRetryFiles || !target.length) return;
    if (mode === 'one') setRetryingKey(target[0].key);
    else setRetryingBatch(true);
    try {
      const { files, serverIds } = await loadFilesForRows(target);
      if (!files.length) {
        toast.error('Could not load saved CV(s) — use Re-upload');
        return;
      }
      if (files.length < target.length) {
        toast.info(`Loaded ${files.length} of ${target.length} saved file(s)`);
      }
      onRetryFiles(files, serverIds);
      onClose();
    } finally {
      setRetryingKey(null);
      setRetryingBatch(false);
    }
  };

  const handleTrash = async (row: UnifiedRow) => {
    if (row.source === 'server' && row.serverId) {
      try {
        await apiBulkCvTrashFailedResumes([row.serverId]);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not delete');
        return;
      }
    }
    if (row.localId) {
      moveFailedBulkResumeToTrash(row.localId);
      notifyRecycleBin();
    }
    setSelectedKeys((prev) => prev.filter((k) => k !== row.key));
    await refresh();
  };

  const handleToggleSelect = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  const handleToggleSelectAll = () => {
    if (allSelected) {
      setSelectedKeys([]);
      return;
    }
    setSelectedKeys(rows.map((row) => row.key));
  };

  const handleBulkDelete = async () => {
    if (!selectedRows.length || bulkDeleting) return;
    const confirmed = await requestConfirm(
      `Remove ${selectedRows.length} failed resume${selectedRows.length === 1 ? '' : 's'}?`
    );
    if (!confirmed) return;

    try {
      setBulkDeleting(true);
      const serverIds = selectedRows.map((r) => r.serverId).filter(Boolean) as string[];
      const localIds = selectedRows.map((r) => r.localId).filter(Boolean) as string[];
      if (serverIds.length) {
        await apiBulkCvTrashFailedResumes(serverIds);
      }
      if (localIds.length) {
        moveFailedBulkResumesToTrash(localIds);
        notifyRecycleBin();
      }
      setSelectedKeys([]);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete');
    } finally {
      setBulkDeleting(false);
    }
  };

  const title = useMemo(() => `Failed resumes (${count})`, [count]);

  if (!isOpen || !portalMounted) return null;

  return createPortal(
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={BULK_CV_ACCEPT_INPUT}
        onChange={onFilePicked}
      />
      <div className="fixed inset-0 z-[95] flex justify-end" dir="ltr">
        <button
          type="button"
          className="absolute inset-0 bg-slate-900/40"
          aria-label="Close failed resumes"
          onClick={onClose}
        />
        <div className="relative flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Failed CVs are stored on the server. Use <strong>Reparse all</strong> to retry in one
                click — no re-upload needed.
                {serverCount ? ` ${serverCount} on server.` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={20} />
            </button>
          </div>

          {count > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-5 py-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={handleToggleSelectAll}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Select all
              </label>
              {retryableAll.length > 0 && onRetryFiles ? (
                <button
                  type="button"
                  disabled={retryingBatch || Boolean(retryingKey) || loading}
                  onClick={() => void handleRetryRows(retryableAll, 'batch')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {retryingBatch ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <RotateCcw size={14} />
                  )}
                  Reparse all ({retryableAll.length})
                </button>
              ) : null}
              {retryableSelected.length > 0 && onRetryFiles ? (
                <button
                  type="button"
                  disabled={retryingBatch || Boolean(retryingKey)}
                  onClick={() => void handleRetryRows(retryableSelected, 'batch')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-900 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw size={14} />
                  Reparse selected ({retryableSelected.length})
                </button>
              ) : null}
              <button
                type="button"
                disabled={!selectedKeys.length || bulkDeleting}
                onClick={() => void handleBulkDelete()}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 size={14} />
                {bulkDeleting
                  ? 'Deleting…'
                  : `Delete${selectedKeys.length ? ` (${selectedKeys.length})` : ''}`}
              </button>
            </div>
          ) : null}

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {loading && !rows.length ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-slate-500">
                <Loader2 className="animate-spin text-slate-400" size={28} />
                Loading failed resumes…
              </div>
            ) : !rows.length ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 py-16 text-center text-sm text-slate-500">
                <FileText className="text-slate-300" size={40} />
                <p>No failed resumes right now.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {rows.map((row) => {
                  const isSelected = selectedKeys.includes(row.key);
                  const isRetrying = retryingKey === row.key;
                  return (
                    <li
                      key={row.key}
                      className={`rounded-xl border p-4 shadow-sm transition-colors ${
                        isSelected
                          ? 'border-indigo-200 bg-indigo-50/50'
                          : 'border-red-100 bg-red-50/40'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(row.key)}
                          className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          aria-label={`Select ${row.fileName}`}
                        />
                        <AlertCircle className="mt-0.5 shrink-0 text-red-500" size={18} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p
                              className="truncate text-sm font-semibold text-slate-900"
                              title={row.fileName}
                            >
                              {row.fileName}
                            </p>
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">
                              Failed
                            </span>
                            {row.source === 'server' ? (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-800">
                                <Cloud size={10} />
                                Server
                              </span>
                            ) : row.hasFile ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                                Saved locally
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-red-800/90">{row.reason}</p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            {formatDateTimeDMY(row.failedAt)}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={
                                isRetrying || retryingBatch || !row.hasFile || !onRetryFiles
                              }
                              onClick={() => void handleRetryRows([row], 'one')}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isRetrying ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <RotateCcw size={14} />
                              )}
                              Reparse
                            </button>
                            <button
                              type="button"
                              onClick={openPicker}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-900 transition hover:bg-sky-100"
                            >
                              <Upload size={14} />
                              Re-upload
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleTrash(row)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              <Trash2 size={14} />
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
