'use client';

import React from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import type { EntityFile } from '@/lib/api';
import { buildFileHref } from '@/utils/cloudinaryUrls';

type Props = {
  files: EntityFile[];
  uploadsBase: string;
  loading?: boolean;
};

export function ClientOfferLetterCard({ files, uploadsBase, loading = false }: Props) {
  const offerFile = files
    .filter((file) => String(file.fileType || '').toLowerCase() === 'offer')
    .sort((a, b) => new Date(b.uploadDate || 0).getTime() - new Date(a.uploadDate || 0).getTime())[0];

  if (loading) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
        Loading offer letter…
      </div>
    );
  }

  if (!offerFile?.fileUrl) return null;

  const href = buildFileHref(offerFile.fileUrl, uploadsBase);
  const label = offerFile.fileName || 'Offer letter';

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-white p-2 text-amber-700 shadow-sm ring-1 ring-amber-200/80">
            <FileText size={18} />
          </span>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Offer letter</h4>
            <p className="mt-0.5 text-xs text-slate-600">
              Uploaded by the client during offer confirmation.
            </p>
            <p className="mt-1 text-sm font-medium text-slate-800">{label}</p>
          </div>
        </div>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
        >
          <ExternalLink size={14} />
          Open
        </a>
      </div>
    </section>
  );
}
