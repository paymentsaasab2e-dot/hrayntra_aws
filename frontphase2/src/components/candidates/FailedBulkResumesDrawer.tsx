'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Upload, Trash2, FileText, AlertCircle } from 'lucide-react';
import {
  FAILED_BULK_RESUMES_CHANGED,
  getActiveFailedBulkResumes,
  moveFailedBulkResumeToTrash,
  type FailedBulkResumeRecord,
} from '@/lib/failedBulkResumesStore';
import { RECYCLE_BIN_SYNC_EVENT } from '@/constants/recycleBin';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onReupload: (file: File) => void;
};

export default function FailedBulkResumesDrawer({ isOpen, onClose, onReupload }: Props) {
  const [rows, setRows] = useState<FailedBulkResumeRecord[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(() => {
    setRows(getActiveFailedBulkResumes());
  }, []);

  useEffect(() => {
    refresh();
  }, [isOpen, refresh]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => refresh();
    window.addEventListener(FAILED_BULK_RESUMES_CHANGED, handler);
    return () => window.removeEventListener(FAILED_BULK_RESUMES_CHANGED, handler);
  }, [refresh]);

  const count = rows.length;

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

  const handleTrash = (id: string) => {
    moveFailedBulkResumeToTrash(id);
    refresh();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(RECYCLE_BIN_SYNC_EVENT));
    }
  };

  const title = useMemo(() => `Failed resumes (${count})`, [count]);

  if (!isOpen) return null;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={onFilePicked}
      />
      <div className="fixed inset-0 z-[95] flex justify-end">
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
                Re-upload opens Bulk CV with this file. Delete moves the entry to Recycle Bin (local).
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

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {!rows.length ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 py-16 text-center text-sm text-slate-500">
                <FileText className="text-slate-300" size={40} />
                <p>No failed resumes right now.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    className="rounded-xl border border-red-100 bg-red-50/40 p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 shrink-0 text-red-500" size={18} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900" title={row.fileName}>
                            {row.fileName}
                          </p>
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">
                            Failed
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-red-800/90">{row.reason}</p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          {new Date(row.failedAt).toLocaleString()}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
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
                            onClick={() => handleTrash(row.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
