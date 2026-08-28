'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Code2, Eye, FileText, RotateCcw, Save, X } from 'lucide-react';
import type { NotificationTriggerEffectiveTemplate } from '@/lib/api';
import { getSystemDefaultTemplate } from '@/lib/notificationTriggerDefaults';
import {
  buildPreviewVariables,
  interpolateNotificationTemplate,
} from '@/lib/notificationTriggerTemplateUtils';

type Props = {
  triggerId: string;
  /** Human label of the owning trigger, shown as the modal heading. */
  triggerLabel?: string;
  /** Controls the modal. Kept as `expanded` so the parent contract is unchanged. */
  expanded: boolean;
  onToggle: () => void;
  effective: NotificationTriggerEffectiveTemplate | undefined;
  onSave: (subject: string, bodyHtml: string) => void;
  onReset: () => void;
  saving?: boolean;
};

type Tab = 'preview' | 'html';

export function NotificationTriggerTemplatePanel({
  triggerId,
  triggerLabel,
  expanded,
  onToggle,
  effective,
  onSave,
  onReset,
  saving = false,
}: Props) {
  const [tab, setTab] = useState<Tab>('preview');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const resolved =
    effective ||
    getSystemDefaultTemplate(triggerId) ||
    ({
      subject: '',
      bodyHtml: '',
      variables: [],
      customized: false,
    } satisfies NotificationTriggerEffectiveTemplate);

  const variables = resolved.variables ?? [];
  const customized = Boolean(resolved.customized);
  const previewVars = useMemo(() => buildPreviewVariables(variables), [variables]);

  const syncFromResolved = () => {
    setSubject(resolved.subject || '');
    setBodyHtml(resolved.bodyHtml || '');
  };

  useEffect(() => {
    if (!expanded) {
      setTab('preview');
      return;
    }
    syncFromResolved();
  }, [expanded, triggerId, resolved.subject, resolved.bodyHtml, resolved.customized]);

  // Escape closes the modal; body scroll is locked while it is open.
  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onToggle();
    };
    window.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [expanded, onToggle]);

  const dirty = subject !== (resolved.subject || '') || bodyHtml !== (resolved.bodyHtml || '');

  const previewSubject = useMemo(
    () => interpolateNotificationTemplate(dirty ? subject : resolved.subject, previewVars),
    [dirty, subject, resolved.subject, previewVars],
  );
  const previewHtml = useMemo(
    () => interpolateNotificationTemplate(dirty ? bodyHtml : resolved.bodyHtml, previewVars),
    [dirty, bodyHtml, resolved.bodyHtml, previewVars],
  );

  const insertVariable = (name: string) => {
    const token = `{{${name}}}`;
    setBodyHtml((prev) => `${prev}${prev.endsWith('\n') || !prev ? '' : '\n'}${token}`);
  };

  const handleSave = () => {
    onSave(subject.trim(), bodyHtml.trim());
  };

  const handleReset = () => {
    onReset();
  };

  const hasContent = Boolean(resolved.subject?.trim() && resolved.bodyHtml?.trim());

  const modal = (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" onClick={onToggle} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Email template — ${triggerLabel || triggerId}`}
        className="relative z-10 flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">
              <FileText className="h-3.5 w-3.5" />
              Email template
            </p>
            <h2 className="mt-1 flex items-center gap-2 truncate text-lg font-bold text-slate-900">
              {triggerLabel || triggerId}
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  customized ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {customized ? 'Custom' : 'System default'}
              </span>
            </h2>
            <p className="mt-0.5 text-[12px] text-slate-500">
              {customized
                ? 'You are using a customized template. Reset to restore the HRYANTRA system default.'
                : 'This is the HRYANTRA system default email. Edit the HTML tab to customize it.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close email template"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex shrink-0 items-center gap-1 border-b border-slate-100 bg-slate-50/70 px-5 py-2">
          <button
            type="button"
            onClick={() => setTab('preview')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              tab === 'preview'
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                : 'text-slate-600 hover:bg-white/70'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </button>
          <button
            type="button"
            onClick={() => setTab('html')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              tab === 'html'
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                : 'text-slate-600 hover:bg-white/70'
            }`}
          >
            <Code2 className="h-3.5 w-3.5" />
            HTML
          </button>
          {dirty ? (
            <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
              Unsaved changes
            </span>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!hasContent ? (
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Loading template… If this stays empty, close and refresh the page.
            </p>
          ) : null}

          {tab === 'preview' ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Subject (with sample data)
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900">{previewSubject || '—'}</p>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <p className="border-b border-slate-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Email body preview
                </p>
                <iframe
                  title={`Preview ${triggerId}`}
                  srcDoc={previewHtml}
                  className="h-[52vh] w-full border-0 bg-white"
                  sandbox=""
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Placeholders are filled with sample data here. Recipients see real values when the
                email is sent.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {variables.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Variables — click to insert
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {variables.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => insertVariable(name)}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-slate-700 hover:border-blue-300 hover:text-blue-700"
                      >
                        {`{{${name}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Subject line
                </span>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="Email subject"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  HTML code
                </span>
                <textarea
                  value={bodyHtml}
                  onChange={(e) => setBodyHtml(e.target.value)}
                  rows={20}
                  spellCheck={false}
                  className="w-full rounded-lg border border-slate-200 bg-slate-900 px-3 py-2.5 font-mono text-[12px] leading-relaxed text-slate-100 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <p className="text-[11px] text-slate-500">
                Switch to the Preview tab to see your edits rendered with sample data before saving.
              </p>
            </div>
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-3.5">
          <button
            type="button"
            disabled={saving || !customized}
            onClick={handleReset}
            className="mr-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to system default
          </button>
          <button
            type="button"
            onClick={onToggle}
            className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
          <button
            type="button"
            disabled={saving || !dirty || !subject.trim() || !bodyHtml.trim()}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving…' : 'Save custom template'}
          </button>
        </footer>
      </div>
    </div>
  );

  return (
    <div className="mt-2 border-t border-slate-100 pt-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-left text-xs font-semibold text-blue-700 hover:bg-blue-50"
      >
        <span className="inline-flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          Email template
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              customized ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {customized ? 'Custom' : 'System default'}
          </span>
        </span>
        <span className="text-[11px] font-semibold text-slate-400">Open</span>
      </button>

      {expanded && mounted ? createPortal(modal, document.body) : null}
    </div>
  );
}
