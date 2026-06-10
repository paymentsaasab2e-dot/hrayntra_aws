'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Download, Eye, FileText, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { filesApiUpload } from '@/lib/api';
import {
  formatWorkExperienceDocumentSize,
  type CandidateWorkExperienceDocument,
} from '@/lib/candidateWorkExperienceFields';
import { phase1FieldLabelClass } from '@/lib/phase1Typography';
import { buildFileHref } from '@/utils/cloudinaryUrls';

function resolveUploadsBase(): string {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';
  return apiBase.replace(/\/api\/v1\/?$/, '');
}

export function CandidateWorkExperienceDocumentsField({
  candidateId,
  documents,
  onChange,
  readOnly = false,
  hideWhenEmpty = false,
  uploadLabel = 'Upload Your Work Experience Certificates/Documents',
  readOnlyListLabel = 'Work Experience Certificates/Documents',
  uploadCategory = 'Work Experience Certificate',
}: {
  candidateId?: string;
  documents: CandidateWorkExperienceDocument[];
  onChange?: (documents: CandidateWorkExperienceDocument[]) => void;
  readOnly?: boolean;
  hideWhenEmpty?: boolean;
  uploadLabel?: string;
  readOnlyListLabel?: string;
  uploadCategory?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploadsBase = useMemo(() => resolveUploadsBase(), []);

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length || readOnly || !onChange) return;

    const next = [...documents];
    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} is larger than 5MB`);
          continue;
        }

        if (candidateId) {
          try {
            const response = await filesApiUpload(
              'candidate',
              candidateId,
              file,
              uploadCategory,
            );
            const uploaded = response?.data;
            const fileUrl = String(uploaded?.fileUrl || '').trim();
            if (!fileUrl) {
              throw new Error('Upload succeeded but no file URL was returned.');
            }
            next.push({
              id: uploaded?.id || `${Date.now()}-${file.name}`,
              name: uploaded?.fileName || file.name,
              fileName: uploaded?.fileName || file.name,
              url: fileUrl,
              size: file.size,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Upload failed';
            toast.error(`${file.name}: ${message}`);
          }
        } else {
          const objectUrl = URL.createObjectURL(file);
          next.push({
            id: `${Date.now()}-${file.name}`,
            name: file.name,
            fileName: file.name,
            url: objectUrl,
            size: file.size,
          });
        }
      }

      onChange(next);
      if (next.length > documents.length) {
        toast.success('Work experience document uploaded');
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeDocument = (docId: string) => {
    if (!onChange || readOnly) return;
    onChange(documents.filter((doc) => String(doc.id || doc.name) !== docId));
  };

  const openDocument = (doc: CandidateWorkExperienceDocument) => {
    const url = String(doc.url || '').trim();
    if (!url) return;
    const href = url.startsWith('blob:') ? url : buildFileHref(url, uploadsBase);
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  const downloadDocument = (doc: CandidateWorkExperienceDocument) => {
    const url = String(doc.url || '').trim();
    if (!url) return;
    const href = url.startsWith('blob:') ? url : buildFileHref(url, uploadsBase);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = doc.name || doc.fileName || 'document';
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.click();
  };

  if (hideWhenEmpty && readOnly && documents.length === 0) {
    return null;
  }

  return (
    <div>
      {!readOnly ? (
        <p className={phase1FieldLabelClass}>{uploadLabel}</p>
      ) : documents.length > 0 ? (
        <p className={phase1FieldLabelClass}>{readOnlyListLabel}</p>
      ) : null}

      {!readOnly ? (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            multiple
            className="hidden"
            onChange={(e) => void handleUpload(e.target.files)}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="mt-2 flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
            ) : (
              <Upload className="h-5 w-5 text-slate-500" />
            )}
            <span className="mt-2 text-sm font-medium text-slate-700">
              {uploading ? 'Uploading…' : 'Click to upload or drag files here'}
            </span>
            <span className="mt-1 text-xs text-slate-400">PDF, PNG, JPG (MAX. 5MB per file)</span>
          </button>
        </>
      ) : null}

      {documents.length > 0 ? (
        <div className={`space-y-2 ${readOnly ? 'mt-2' : 'mt-4'}`}>
          <p className="text-sm font-semibold text-slate-800">
            Uploaded Documents ({documents.length})
          </p>
          {documents.map((doc) => {
            const docId = String(doc.id || doc.name);
            const hasUrl = Boolean(String(doc.url || '').trim());
            return (
              <div
                key={docId}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-5 w-5 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {doc.name || doc.fileName || 'Document'}
                    </p>
                    {doc.size ? (
                      <p className="text-xs text-slate-500">{formatWorkExperienceDocumentSize(doc.size)}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {hasUrl ? (
                    <>
                      <button
                        type="button"
                        onClick={() => openDocument(doc)}
                        className="rounded-md p-1.5 text-violet-600 hover:bg-violet-50"
                        title="View document"
                        aria-label={`View ${doc.name || 'document'}`}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadDocument(doc)}
                        className="rounded-md p-1.5 text-orange-600 hover:bg-orange-50"
                        title="Download document"
                        aria-label={`Download ${doc.name || 'document'}`}
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <span className="text-[11px] font-medium uppercase tracking-wide text-amber-700">
                      Pending upload
                    </span>
                  )}
                  {!readOnly ? (
                    <button
                      type="button"
                      onClick={() => removeDocument(docId)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Remove document"
                      aria-label={`Remove ${doc.name || 'document'}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : readOnly && !hideWhenEmpty ? (
        <p className="mt-2 text-sm italic text-slate-400">No documents uploaded</p>
      ) : null}
    </div>
  );
}
