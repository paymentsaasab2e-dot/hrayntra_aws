'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Download, Eye, FileText, Loader2, X } from 'lucide-react';
import { ResumeDocxPreview } from './ResumeDocxPreview';
import { ResumeFilePreview } from './ResumeFilePreview';
import { SaasaCvSavedPreview } from './SaasaCvSavedPreview';
import {
  canPreviewResumeAsHtml,
  canPreviewResumeInline,
  getResumeExtension,
  isImageResume,
  normalizeResumeHref,
} from '../../lib/resumePreview';
import { triggerFileDownload } from '../../utils/triggerFileDownload';

interface ResumePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  resumeUrl: string | null;
  candidateName?: string;
}

export function ResumePreviewModal({
  isOpen,
  onClose,
  resumeUrl,
  candidateName = 'Candidate',
}: ResumePreviewModalProps) {
  const [portalReady, setPortalReady] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const uploadsBase = useMemo(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';
    return apiBase.replace(/\/api\/v1\/?$/, '');
  }, []);
  const href = resumeUrl ? normalizeResumeHref(resumeUrl) : '';
  const canPdf = Boolean(href && canPreviewResumeInline(href));
  const canHtml = Boolean(href && canPreviewResumeAsHtml(href));
  const extension = getResumeExtension(href);
  const isImage = isImageResume(href);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  const handleDownload = async () => {
    if (!resumeUrl || downloading) return;
    setDownloading(true);
    try {
      const ext = getResumeExtension(resumeUrl);
      const base = String(candidateName || 'candidate').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'candidate';
      await triggerFileDownload(resumeUrl, {
        uploadsBase,
        filename: ext ? `${base}-resume.${ext}` : `${base}-resume.pdf`,
      });
    } finally {
      setDownloading(false);
    }
  };

  if (!portalReady) return null;

  const modal = (
    <AnimatePresence>
      {isOpen && href ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[220] bg-slate-950/60"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 12 }}
            transition={{ type: 'tween', duration: 0.2 }}
            className="fixed inset-3 z-[221] mx-auto flex h-[calc(100vh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-[min(96vw,1400px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:inset-6 sm:h-[calc(100vh-3rem)] sm:w-[calc(100vw-3rem)]"
            role="dialog"
            aria-modal="true"
            aria-label={`${candidateName} resume preview`}
          >
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                  <FileText size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-slate-900">{candidateName}</h3>
                  <p className="text-xs text-slate-500">Resume / CV preview</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Eye size={15} />
                  Open in tab
                </a>
                <button
                  type="button"
                  onClick={() => void handleDownload()}
                  disabled={downloading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                  Download
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                  aria-label="Close resume preview"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden bg-slate-100">
              {canPdf ? (
                <div className="h-full overflow-auto p-3 sm:p-5">
                  <ResumeFilePreview
                    resumeUrl={href}
                    candidateName={candidateName}
                    layout="modal"
                  />
                </div>
              ) : canHtml ? (
                <ResumeDocxPreview
                  resumeUrl={href}
                  candidateName={candidateName}
                  enabled={isOpen}
                  minHeightClass="min-h-full h-full"
                  className="h-full"
                />
              ) : isImage ? (
                <SaasaCvSavedPreview
                  fileUrl={href}
                  candidateName={candidateName}
                  enabled={isOpen}
                  minHeightClass="min-h-full h-full"
                  className="h-full"
                />
              ) : (
                <div className="flex h-full min-h-[320px] items-center justify-center">
                  <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                    <h4 className="text-base font-semibold text-slate-900">Preview not available inline</h4>
                    <p className="mt-2 text-sm text-slate-500">
                      This file is stored as{' '}
                      <span className="font-medium">{extension.toUpperCase() || 'a document'}</span>. Open or
                      download it to view the CV.
                    </p>
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        Open Resume
                      </a>
                      <button
                        type="button"
                        onClick={() => void handleDownload()}
                        disabled={downloading}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                        Download
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
}
