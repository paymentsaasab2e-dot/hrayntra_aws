'use client';

import React, { useMemo } from 'react';
import { buildFileHref } from '../../utils/cloudinaryUrls';
import { FileText } from 'lucide-react';
import { useFiles } from '../../hooks/useFiles';
import { DocumentUploadButton } from '../import/documentUploadUi';

interface DrawerFilesTabProps {
  interviewId: string | null;
}

export function DrawerFilesTab({ interviewId }: DrawerFilesTabProps) {
  const {
    files,
    loading,
    uploading,
    uploadSuccess,
    uploadPercent,
    error,
    uploadFile,
    deleteFile,
  } = useFiles('interview', interviewId);

  const uploadsBase = useMemo(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';
    return apiBase.replace(/\/api\/v1\/?$/, '');
  }, []);
  const toFileHref = (fileUrl?: string | null) => buildFileHref(fileUrl, uploadsBase);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Files</h3>
          <p className="mt-1 text-sm text-slate-500">Upload and manage interview documents.</p>
        </div>
        <DocumentUploadButton
          disabled={!interviewId}
          isUploading={uploading}
          uploadSuccess={uploadSuccess}
          uploadPercent={uploadPercent}
          label="Upload File"
          onFilesSelected={async (files) => {
            await uploadFile(files[0], 'Other');
          }}
        />
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

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
                      {file.fileType}
                      {file.uploadedBy?.name ? ` · ${file.uploadedBy.name}` : ''}
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
