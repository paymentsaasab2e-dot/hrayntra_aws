'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { SuperDoc } from 'superdoc';
import { buildResumeDocxBytesUrl } from '../../lib/resumePreview';
import { releaseSuperDocWarmWorker } from '../../lib/warmSuperDoc';
import { prepareResumeDocxForEditor, restoreResumeDocxAfterEditor } from '../../lib/docxColumnLayout';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOCUMENT_WORKER = '/api/superdoc-worker?kind=document&v=4';
const REVIEW_WORKER = '/api/superdoc-worker?kind=review&v=4';

function ensureSuperDocStyles(): Promise<void> {
  const href = '/api/superdoc-style?v=3';
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
          .saasa-docx-editor .superdoc--contained .superdoc__layers,
          .saasa-docx-editor .superdoc--contained .superdoc__document,
          .saasa-docx-editor .superdoc--contained .superdoc__sub-document,
          .saasa-docx-editor .superdoc--contained .v2-super-editor,
          .saasa-docx-editor .superdoc--contained .v2-super-editor__visuals,
          .saasa-docx-editor .superdoc--contained .v2-super-editor__stage,
          .saasa-docx-editor .superdoc--contained .presentation-editor {
            min-width: 0;
            max-width: 100%;
            width: 100%;
          }
          .saasa-docx-editor .superdoc--contained .superdoc__sub-document {
            overflow: auto;
          }
          .saasa-docx-editor .superdoc-shape-group__child img,
          .saasa-docx-editor .superdoc-drawing-inner img,
          .saasa-docx-editor .superdoc-image-fragment img {
            object-fit: fill !important;
          }
        `}</style>
        <div ref={toolbarRef} className="z-20 shrink-0 border-b border-slate-200 bg-white" />
        <div ref={hostRef} className="min-h-0 w-full flex-1 overflow-hidden" />
        {status === 'error' ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white px-6 text-center text-sm text-slate-600">
            {message}
          </div>
        ) : null}
      </div>
    );
  }
);
