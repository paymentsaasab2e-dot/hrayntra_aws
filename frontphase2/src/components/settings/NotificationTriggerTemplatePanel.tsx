'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Eye, FileText, Pencil, RotateCcw, Save } from 'lucide-react';
import type { NotificationTriggerEffectiveTemplate } from '@/lib/api';
import { getSystemDefaultTemplate } from '@/lib/notificationTriggerDefaults';
import {
  buildPreviewVariables,
  interpolateNotificationTemplate,
} from '@/lib/notificationTriggerTemplateUtils';

type Props = {
  triggerId: string;
  expanded: boolean;
  onToggle: () => void;
  effective: NotificationTriggerEffectiveTemplate | undefined;
  onSave: (subject: string, bodyHtml: string) => void;
  onReset: () => void;
  saving?: boolean;
};

export function NotificationTriggerTemplatePanel({
  triggerId,
  expanded,
  onToggle,
  effective,
  onSave,
  onReset,
  saving = false,
}: Props) {
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');

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
      setMode('preview');
      return;
    }
    syncFromResolved();
  }, [expanded, triggerId, resolved.subject, resolved.bodyHtml, resolved.customized]);

  const previewSubject = useMemo(
    () => interpolateNotificationTemplate(resolved.subject, previewVars),
    [resolved.subject, previewVars],
  );
  const previewHtml = useMemo(
    () => interpolateNotificationTemplate(resolved.bodyHtml, previewVars),
    [resolved.bodyHtml, previewVars],
  );

  const editPreviewSubject = useMemo(
    () => interpolateNotificationTemplate(subject, previewVars),
    [subject, previewVars],
  );
  const editPreviewHtml = useMemo(
    () => interpolateNotificationTemplate(bodyHtml, previewVars),
    [bodyHtml, previewVars],
  );

  const insertVariable = (name: string) => {
    const token = `{{${name}}}`;
    setBodyHtml((prev) => `${prev}${prev.endsWith('\n') || !prev ? '' : '\n'}${token}`);
  };

  const startCustomize = () => {
    syncFromResolved();
    setMode('edit');
  };

  const handleSave = () => {
    onSave(subject.trim(), bodyHtml.trim());
    setMode('preview');
  };

  const handleReset = () => {
    setMode('preview');
    onReset();
  };

  const hasContent = Boolean(resolved.subject?.trim() && resolved.bodyHtml?.trim());

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
              customized
                ? 'bg-violet-100 text-violet-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {customized ? 'Custom' : 'System default'}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded ? (
        <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <p className="text-xs leading-5 text-slate-600">
            {customized
              ? 'You are using a customized template. Reset to restore the HRYANTRA system default below.'
              : 'This is the HRYANTRA system default email. Recipients see real data when the email is sent. Click Customize to change the template.'}
          </p>

          {!hasContent ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Loading template… If this stays empty, refresh the page.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode('preview')}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                mode === 'preview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              System template (sample data)
            </button>
            <button
              type="button"
              onClick={startCustomize}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                mode === 'edit' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              <Pencil className="h-3.5 w-3.5" />
              Customize
            </button>
          </div>

          {mode === 'preview' ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Subject (with sample data)
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900">{previewSubject || '—'}</p>
              </div>
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <p className="border-b border-slate-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Email body preview
                </p>
                <iframe
                  title={`Preview ${triggerId}`}
                  srcDoc={previewHtml}
                  className="h-80 w-full border-0 bg-white"
                  sandbox=""
                />
              </div>
              <details className="rounded-lg border border-slate-200 bg-white">
                <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-600">
                  View raw HTML template (placeholders)
                </summary>
                <pre className="max-h-48 overflow-auto border-t border-slate-100 p-3 font-mono text-[10px] leading-relaxed text-slate-700">
                  {`Subject: ${resolved.subject}\n\n${resolved.bodyHtml}`}
                </pre>
              </details>
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
                  HTML body
                </span>
                <textarea
                  value={bodyHtml}
                  onChange={(e) => setBodyHtml(e.target.value)}
                  rows={14}
                  spellCheck={false}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <p className="border-b border-slate-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Live preview while editing
                </p>
                <iframe
                  title={`Edit preview ${triggerId}`}
                  srcDoc={editPreviewHtml}
                  className="h-56 w-full border-0 bg-white"
                  sandbox=""
                />
                <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-600">
                  Subject: {editPreviewSubject || '—'}
                </p>
              </div>
            </div>
          )}

          {mode === 'edit' ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={saving || !subject.trim() || !bodyHtml.trim()}
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                Save custom template
              </button>
              <button
                type="button"
                disabled={saving || !customized}
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset to system default
              </button>
              <button
                type="button"
                onClick={() => {
                  syncFromResolved();
                  setMode('preview');
                }}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startCustomize}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
            >
              <Pencil className="h-3.5 w-3.5" />
              Customize this template
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
