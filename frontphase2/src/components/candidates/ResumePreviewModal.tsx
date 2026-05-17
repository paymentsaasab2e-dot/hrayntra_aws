'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Download, Eye, FileText, X } from 'lucide-react';
import {
  buildResumeHtmlPreviewUrl,
  buildResumeViewerUrl,
  canPreviewResumeAsHtml,
  canPreviewResumeInline,
  getResumeExtension,
  normalizeResumeHref,
} from '../../lib/resumePreview';

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
  const href = resumeUrl ? normalizeResumeHref(resumeUrl) : '';
  const canPdf = Boolean(href && canPreviewResumeInline(href));
  const canHtml = Boolean(href && canPreviewResumeAsHtml(href));
  const extension = getResumeExtension(href);

  const [htmlPreview, setHtmlPreview] = useState<string | null>(null);
  const [htmlLoading, setHtmlLoading] = useState(false);
  const [htmlError, setHtmlError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !href || !canHtml) {
      setHtmlPreview(null);
      setHtmlLoading(false);
      setHtmlError(null);
      return;
    }

    let cancelled = false;
    setHtmlLoading(true);
    setHtmlError(null);
    setHtmlPreview(null);

    const loadPreview = async () => {
      try {
        const response = await fetch(buildResumeHtmlPreviewUrl(href), { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Failed to load preview (${response.status})`);
        }
        const html = await response.text();
        if (!cancelled) setHtmlPreview(html);
      } catch (error: unknown) {
        if (!cancelled) {
          setHtmlError(error instanceof Error ? error.message : 'Preview unavailable');
          setHtmlPreview(null);
        }
      } finally {
        if (!cancelled) setHtmlLoading(false);
      }
    };

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [isOpen, href, canHtml]);

  return (
    <AnimatePresence>
      {isOpen && href ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-slate-950/55"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 12 }}
            transition={{ type: 'tween', duration: 0.2 }}
            className="fixed inset-4 z-[121] mx-auto flex max-h-[calc(100vh-2rem)] max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:inset-8"
            role="dialog"
            aria-modal="true"
            aria-label={`${candidateName} resume preview`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
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
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Download size={15} />
                  Download
                </a>
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

            <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-4">
              {canPdf ? (
                <iframe
                  title={`${candidateName} resume`}
                  src={buildResumeViewerUrl(href)}
                  className="h-full min-h-[min(70vh,640px)] w-full rounded-xl border border-slate-200 bg-white"
                />
              ) : canHtml ? (
                htmlLoading ? (
                  <div className="flex h-full min-h-[min(70vh,640px)] items-center justify-center rounded-xl border border-slate-200 bg-white">
                    <div className="text-center">
                      <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
                      <p className="text-sm text-slate-600">Loading document preview...</p>
                    </div>
                  </div>
                ) : htmlError ? (
                  <div className="flex h-full min-h-[320px] items-center justify-center">
                    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                      <h4 className="text-base font-semibold text-slate-900">Preview unavailable</h4>
                      <p className="mt-2 text-sm text-slate-500">{htmlError}</p>
                      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          Open Resume
                        </a>
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          download
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Download size={16} />
                          Download
                        </a>
                      </div>
                    </div>
                  </div>
                ) : htmlPreview ? (
                  <iframe
                    title={`${candidateName} resume`}
                    srcDoc={htmlPreview}
                    sandbox="allow-same-origin"
                    className="h-full min-h-[min(70vh,640px)] w-full rounded-xl border border-slate-200 bg-white"
                  />
                ) : (
                  <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-slate-200 bg-white">
                    <p className="text-sm text-slate-500">No preview data available.</p>
                  </div>
                )
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
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Download size={16} />
                        Download
                      </a>
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
}
