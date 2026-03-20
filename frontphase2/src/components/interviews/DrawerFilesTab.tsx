'use client';

import React, { useMemo, useRef } from 'react';
import { FileText, Plus } from 'lucide-react';
import { useFiles } from '../../hooks/useFiles';

interface DrawerFilesTabProps {
  interviewId: string | null;
}

export function DrawerFilesTab({ interviewId }: DrawerFilesTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    files,
    loading,
    uploading,
    error,
    uploadFile,
    deleteFile,
  } = useFiles('interview', interviewId);

  const uploadsBase = useMemo(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
    return apiBase.replace(/\/api\/v1\/?$/, '');
  }, []);
  const toFileHref = (fileUrl?: string | null) => {
    if (!fileUrl) return '#';
    return /^https?:\/\//i.test(fileUrl) ? fileUrl : `${uploadsBase}${fileUrl}`;
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Files</h3>
          <p className="mt-1 text-sm text-slate-500">Upload and manage interview documents.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                await uploadFile(f, 'Other');
              } finally {
                e.target.value = '';
              }
            }}
          />
          <button
            type="button"
            disabled={!interviewId || uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus size={16} />
            {uploading ? 'Uploading…' : 'Upload File'}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      ) : null}

      <div className="mt-4 space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">Loading files…</p>
        ) : files.length > 0 ? (
          files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
            >
              <a
                href={toFileHref(file.fileUrl)}
                target={file.fileUrl ? '_blank' : undefined}
                rel={file.fileUrl ? 'noreferrer' : undefined}
                className="min-w-0 flex-1"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{file.fileName}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {file.fileType}{file.uploadedBy?.name ? ` · ${file.uploadedBy.name}` : ''}
                    </p>
                  </div>
                  <FileText size={16} className="shrink-0 text-slate-400" />
                </div>
              </a>
              <button
                type="button"
                onClick={() => deleteFile(file.id)}
                className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Delete
              </button>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">No files yet. Upload a document to get started.</p>
        )}
      </div>
    </section>
  );
}
