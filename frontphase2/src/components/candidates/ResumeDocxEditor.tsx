'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { SuperDoc } from 'superdoc';
import { buildResumeDocxBytesUrl } from '../../lib/resumePreview';
import { releaseSuperDocWarmWorker } from '../../lib/warmSuperDoc';
import { prepareResumeDocxForEditor, restoreResumeDocxAfterEditor } from '../../lib/docxColumnLayout';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOCUMENT_WORKER = '/superdoc/document-worker.js?v=5';
const REVIEW_WORKER = '/superdoc/review-worker.js?v=5';

function ensureSuperDocStyles(): Promise<void> {
  const href = '/superdoc/style.css?v=5';
  const existing = document.querySelector('link[data-superdoc-style]');
  if (existing instanceof HTMLLinkElement && existing.getAttribute('href') === href) {
    return Promise.resolve();
  }
  existing?.remove();
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.superdocStyle = '1';
    const finish = () => resolve();
    link.onload = finish;
    link.onerror = finish;
    document.head.appendChild(link);
    window.setTimeout(finish, 2000);
  });
}

export type ResumeDocxEditorHandle = {
  exportDocx: () => Promise<Blob>;
};

type ResumeDocxEditorProps = {
  resumeUrl: string;
  seedBytes?: Uint8Array | null;
  canEdit: boolean;
};

const EMU_PER_CSS_PX = 9525;

/** Pull a page that hangs off the left edge back into the editor. */
function showFullDocumentPage(root: HTMLElement) {
  const page = root.querySelector('.superdoc-page');
  if (!(page instanceof HTMLElement)) return;
  const hostRect = root.getBoundingClientRect();
  const pageRect = page.getBoundingClientRect();
  if (hostRect.width < 200 || pageRect.width < 80) return;
  const overflowLeft = hostRect.left - pageRect.left;
  const spareRight = hostRect.right - pageRect.right;
  if (overflowLeft > 4 && spareRight > overflowLeft) {
    const current = Number.parseFloat(page.style.marginLeft || '0') || 0;
    page.style.marginLeft = `${current + overflowLeft + 8}px`;
  }
}

/**
 * A designed resume can contain one large curve or arrow. SuperDoc sometimes
 * paints that drawing bigger than the page, so the editor shows only the
 * curve. Keep every drawing inside the page.
 */
function clampDrawingsToPage(root: HTMLElement) {
  const page = root.querySelector('.superdoc-page');
  if (!(page instanceof HTMLElement)) return;
  const limitW = page.clientWidth || page.getBoundingClientRect().width;
  const limitH = page.clientHeight || page.getBoundingClientRect().height;
  if (limitW < 240 || limitH < 240) return;
  const nodes = root.querySelectorAll<HTMLElement>(
    '.superdoc-vector-shape, .superdoc-drawing-fragment, .superdoc-shape-group, .superdoc-drawing-inner, .superdoc-image-fragment',
  );
  nodes.forEach((node) => {
    const width = Number.parseFloat(node.style.width);
    const height = Number.parseFloat(node.style.height);
    const box = node.getBoundingClientRect();
    const w = Number.isFinite(width) && width > box.width ? width : box.width;
    const h = Number.isFinite(height) && height > box.height ? height : box.height;
    if (w < limitW * 1.25 && h < limitH * 1.25) return;
    if (w >= 20000 || h >= 20000) {
      if (w >= 20000) node.style.width = `${Math.max(1, w / EMU_PER_CSS_PX)}px`;
      if (h >= 20000) node.style.height = `${Math.max(1, h / EMU_PER_CSS_PX)}px`;
    }
    const nextBox = node.getBoundingClientRect();
    const scale = Math.min(limitW / Math.max(nextBox.width, 1), limitH / Math.max(nextBox.height, 1));
    if (!Number.isFinite(scale) || scale >= 0.98 || scale < 0.02) return;
    node.style.transformOrigin = 'top left';
    node.style.transform = `scale(${scale})`;
    node.style.overflow = 'hidden';
  });
}

/** If the page is larger than the editor, show the whole page instead of one corner. */
function fitPageToEditor(root: HTMLElement) {
  const page = root.querySelector('.superdoc-page');
  if (!(page instanceof HTMLElement)) return;
  const host = root.getBoundingClientRect();
  const pageRect = page.getBoundingClientRect();
  if (host.width < 240 || pageRect.width < 240) return;
  if (pageRect.width <= host.width * 1.08 && pageRect.height <= host.height * 1.25) return;
  const scale = Math.min((host.width - 32) / pageRect.width, (host.height - 32) / pageRect.height);
  if (!Number.isFinite(scale) || scale >= 0.98 || scale < 0.05) return;
  page.style.transformOrigin = 'top center';
  page.style.transform = `scale(${scale})`;
}

/** Some Word drawings are laid out in EMUs and paint as a page-sized blob. */
function shrinkEmuSizedBoxes(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[style*="width"], [style*="height"]').forEach((node) => {
    const width = Number.parseFloat(node.style.width);
    const height = Number.parseFloat(node.style.height);
    const left = Number.parseFloat(node.style.left);
    const top = Number.parseFloat(node.style.top);
    const tooWide = Number.isFinite(width) && Math.abs(width) >= 20000;
    const tooTall = Number.isFinite(height) && Math.abs(height) >= 20000;
    const tooFarX = Number.isFinite(left) && Math.abs(left) >= 20000;
    const tooFarY = Number.isFinite(top) && Math.abs(top) >= 20000;
    if (!tooWide && !tooTall && !tooFarX && !tooFarY) return;
    if (tooWide) node.style.width = `${Math.max(1, width / EMU_PER_CSS_PX)}px`;
    if (tooTall) node.style.height = `${Math.max(1, height / EMU_PER_CSS_PX)}px`;
    if (tooFarX) node.style.left = `${left / EMU_PER_CSS_PX}px`;
    if (tooFarY) node.style.top = `${top / EMU_PER_CSS_PX}px`;
  });
}

function fileNameFromUrl(resumeUrl: string): string {
  try {
    const last = new URL(resumeUrl).pathname.split('/').filter(Boolean).pop() || 'resume.docx';
    const name = decodeURIComponent(last);
    return name.toLowerCase().endsWith('.docx') ? name : 'resume.docx';
  } catch {
    return 'resume.docx';
  }
}

async function assertDocxBlob(blob: Blob): Promise<Blob> {
  if (blob.size < 1000) {
    throw new Error('Unable to save the resume. Your changes have not been lost. Please try again.');
  }
  const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  const zip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
  if (!zip) {
    throw new Error('Unable to save the resume. Your changes have not been lost. Please try again.');
  }
  return blob;
}

export const ResumeDocxEditor = forwardRef<ResumeDocxEditorHandle, ResumeDocxEditorProps>(
  function ResumeDocxEditor({ resumeUrl, seedBytes, canEdit }, ref) {
    const toolbarRef = useRef<HTMLDivElement>(null);
    const hostRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<SuperDoc | null>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [message, setMessage] = useState('Loading resume editor...');

    const readyRef = useRef(false);

    useImperativeHandle(ref, () => ({
      async exportDocx() {
        const editor = editorRef.current;
        if (!editor || status !== 'ready') {
          throw new Error('Unable to save the resume. Your changes have not been lost. Please try again.');
        }
        const blob = await editor.export({
          exportType: ['docx'],
          triggerDownload: false,
        });
        return assertDocxBlob(await restoreResumeDocxAfterEditor(blob));
      },
    }));

    useEffect(() => {
      const host = hostRef.current;
      if (!host) return;
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Backspace' && event.key !== 'Delete') return;
        if (!event.repeat) return;
        // Key repeat queues a delete for every tick while the editor is still
        // applying the previous one, so text keeps disappearing after you let go.
        event.preventDefault();
        event.stopPropagation();
      };
      host.addEventListener('keydown', onKeyDown, true);
      return () => host.removeEventListener('keydown', onKeyDown, true);
    }, []);

    useEffect(() => {
      let cancelled = false;
      let editor: SuperDoc | null = null;
      let retryTimer = 0;
      const fitTimers: number[] = [];
      readyRef.current = false;
      const timeout = window.setTimeout(() => {
        if (!cancelled) {
          setStatus((current) => {
            if (current === 'ready') return current;
            setMessage('Unable to load this resume. Please try again.');
            return 'error';
          });
        }
      }, 120000);

      const fail = () => {
        if (cancelled || readyRef.current) return;
        window.clearTimeout(timeout);
        setStatus('error');
        setMessage('Unable to load this resume. Please try again.');
      };

      const start = async () => {
        try {
          let bytes: Uint8Array;
          if (seedBytes && seedBytes.byteLength > 1000) {
            bytes = seedBytes;
          } else {
            const response = await fetch(buildResumeDocxBytesUrl(resumeUrl));
            if (!response.ok) throw new Error('load failed');
            bytes = new Uint8Array(await response.arrayBuffer());
          }
          if (bytes.byteLength < 1000) throw new Error('load failed');
          bytes = await prepareResumeDocxForEditor(bytes);
          const file = new File([new Uint8Array(bytes)], fileNameFromUrl(resumeUrl), { type: DOCX_MIME });
          releaseSuperDocWarmWorker();
          const [{ SuperDoc: Editor }] = await Promise.all([
            import('superdoc'),
            ensureSuperDocStyles(),
          ]);
          if (cancelled || !hostRef.current || !toolbarRef.current) return;

          const mount = (attempt: number) => {
            if (cancelled || !hostRef.current || !toolbarRef.current) return;
            const toolbar = toolbarRef.current;
            const host = hostRef.current;
            host.replaceChildren();
            toolbar.replaceChildren();
            const next = new Editor({
              selector: host,
              document: file,
              documentMode: canEdit ? 'editing' : 'viewing',
              role: canEdit ? 'editor' : 'viewer',
              contained: true,
              telemetry: { enabled: false },
              workerStartupTimeoutMs: 20000,
              ui: {
                toolbar: { container: toolbar },
                comments: false,
                ruler: false,
                search: true,
              },
              workerUrls: {
                document: attempt === 0 ? DOCUMENT_WORKER : `${DOCUMENT_WORKER}&retry=1`,
                reviewIndex: REVIEW_WORKER,
              },
              onReady: () => {
                if (cancelled) return;
                readyRef.current = true;
                window.clearTimeout(timeout);
                window.clearTimeout(retryTimer);
                const fitDrawings = () => {
                  if (cancelled || !hostRef.current) return;
                  shrinkEmuSizedBoxes(hostRef.current);
                  clampDrawingsToPage(hostRef.current);
                  fitPageToEditor(hostRef.current);
                  showFullDocumentPage(hostRef.current);
                };
                fitDrawings();
                fitTimers.push(window.setTimeout(fitDrawings, 250));
                fitTimers.push(window.setTimeout(fitDrawings, 1000));
                setStatus('ready');
                setMessage('');
              },
              onContentError: ({ error }) => {
                if (cancelled || readyRef.current) return;
                console.error('[resume-docx] content error', error);
              },
              onException: () => {
                if (cancelled || readyRef.current) return;
                window.clearTimeout(retryTimer);
                if (attempt === 0) {
                  try {
                    next.destroy();
                  } catch {
                    /* already destroyed */
                  }
                  mount(1);
                  return;
                }
                fail();
              },
            });
            editor = next;
            editorRef.current = next;
            if (attempt === 0) {
              retryTimer = window.setTimeout(() => {
                if (cancelled || readyRef.current) return;
                try {
                  next.destroy();
                } catch {
                  /* already destroyed */
                }
                mount(1);
              }, 12000);
            }
          };

          mount(0);
        } catch {
          fail();
        }
      };

      void start();
      return () => {
        cancelled = true;
        window.clearTimeout(timeout);
        window.clearTimeout(retryTimer);
        fitTimers.forEach((timer) => window.clearTimeout(timer));
        editorRef.current = null;
        try {
          editor?.destroy();
        } catch {
          /* already destroyed */
        }
      };
    }, [resumeUrl, seedBytes, canEdit]);

    return (
      <div className="saasa-docx-editor relative flex h-full min-h-0 w-full flex-1 flex-col bg-[#e8eaed]">
        <style>{`
          .saasa-docx-editor .superdoc--contained,
          .saasa-docx-editor .superdoc--contained .superdoc__layers,
          .saasa-docx-editor .superdoc--contained .superdoc__document,
          .saasa-docx-editor .superdoc--contained .superdoc__sub-document,
          .saasa-docx-editor .superdoc--contained .v2-super-editor,
          .saasa-docx-editor .superdoc--contained .v2-super-editor__visuals,
          .saasa-docx-editor .superdoc--contained .v2-super-editor__stage {
            min-width: 0;
            max-width: 100%;
            width: 100%;
          }
          .saasa-docx-editor .superdoc--contained,
          .saasa-docx-editor .superdoc--contained .superdoc__layers,
          .saasa-docx-editor .superdoc--contained .superdoc__document,
          .saasa-docx-editor .superdoc--contained .superdoc__sub-document {
            height: 100%;
          }
          .saasa-docx-editor .superdoc--contained .superdoc__sub-document {
            overflow: auto;
          }
          .saasa-docx-editor .superdoc-page {
            box-sizing: border-box;
            max-width: 100%;
            margin-left: auto;
            margin-right: auto;
            overflow: hidden;
          }
          .saasa-docx-editor .superdoc-vector-shape,
          .saasa-docx-editor .superdoc-drawing-fragment,
          .saasa-docx-editor .superdoc-shape-group,
          .saasa-docx-editor .superdoc-drawing-inner,
          .saasa-docx-editor .superdoc-image-fragment {
            max-width: 100%;
            max-height: 100%;
            overflow: hidden;
          }
          .saasa-docx-editor .superdoc-drawing-fragment img,
          .saasa-docx-editor .superdoc-vector-shape img,
          .saasa-docx-editor .superdoc-vector-shape svg,
          .saasa-docx-editor .superdoc-shape-group__child img,
          .saasa-docx-editor .superdoc-image-fragment img,
          .saasa-docx-editor [data-sd-headerfooter-kind] img {
            object-fit: contain !important;
            max-width: 100%;
            max-height: 100%;
          }
        `}</style>
        <div ref={toolbarRef} className="z-20 shrink-0 border-b border-slate-200 bg-white" />
        <div ref={hostRef} className="min-h-0 w-full flex-1 overflow-auto bg-[#e8eaed]" />
        {status === 'error' ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white px-6 text-center text-sm text-slate-600">
            {message}
          </div>
        ) : null}
      </div>
    );
  }
);
