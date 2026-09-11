'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Mail, Plus, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  SUBMIT_TO_CLIENT_MAIL_TEMPLATE_PLACEHOLDERS,
  applySubmitToClientMailTemplate,
  defaultSubmitToClientMailTemplate,
  deleteSubmitToClientMailTemplate,
  listSubmitToClientMailTemplates,
  setDefaultSubmitToClientMailTemplate,
  subscribeSubmitToClientMailTemplatesChanged,
  upsertSubmitToClientMailTemplate,
  type SubmitToClientMailTemplate,
} from '../../lib/submitToClientMailTemplate';

type Draft = {
  id?: string;
  name: string;
  subject: string;
  body: string;
};

const EMPTY_DRAFT: Draft = {
  name: '',
  subject: '',
  body: '',
};

function draftFromTemplate(template: SubmitToClientMailTemplate): Draft {
  return {
    id: template.id,
    name: template.name,
    subject: template.subject,
    body: template.body,
  };
}

export function SubmitToClientMailTemplateSettings() {
  const [templates, setTemplates] = useState<SubmitToClientMailTemplate[]>(() =>
    typeof window === 'undefined' ? [defaultSubmitToClientMailTemplate()] : listSubmitToClientMailTemplates(),
  );
  const [selectedId, setSelectedId] = useState<string>(() => {
    if (typeof window === 'undefined') return 'default';
    return listSubmitToClientMailTemplates().find((t) => t.isDefault)?.id || 'default';
  });
  const [draft, setDraft] = useState<Draft>(() => {
    if (typeof window === 'undefined') return draftFromTemplate(defaultSubmitToClientMailTemplate());
    const list = listSubmitToClientMailTemplates();
    const active = list.find((t) => t.isDefault) || list[0]!;
    return draftFromTemplate(active);
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const refresh = (next?: SubmitToClientMailTemplate[]) => {
      const list = next || listSubmitToClientMailTemplates();
      setTemplates(list);
      setSelectedId((prev) => {
        if (list.some((t) => t.id === prev)) return prev;
        return list.find((t) => t.isDefault)?.id || list[0]?.id || 'default';
      });
    };
    refresh();
    return subscribeSubmitToClientMailTemplatesChanged(refresh);
  }, []);

  const selected = templates.find((t) => t.id === selectedId) || templates[0] || null;

  const preview = useMemo(
    () =>
      applySubmitToClientMailTemplate(
        { subject: draft.subject, body: draft.body },
        {
          candidateName: 'Priya Sharma',
          candidateNames: 'Priya Sharma and 2 more candidates',
          jobTitle: 'Frontend Developer',
          reviewUrl: 'https://app.example.com/client-review/abc123',
          clientEmail: 'director@acme.com',
          clientName: 'Acme Corp',
          companyName: 'Acme Corp',
        },
      ),
    [draft.subject, draft.body],
  );

  const startCreate = () => {
    setCreating(true);
    setSelectedId('');
    setDraft({
      ...EMPTY_DRAFT,
      name: 'Client email template',
      subject: 'Candidate review: {{candidateNames}} — {{jobTitle}}',
      body: [
        'Hi {{clientName}},',
        '',
        'Please review {{candidateNames}} for {{jobTitle}}.',
        '',
        'Open this secure preview link:',
        '{{reviewUrl}}',
        '',
        'Thank you,',
      ].join('\n'),
    });
  };

  const selectTemplate = (template: SubmitToClientMailTemplate) => {
    setCreating(false);
    setSelectedId(template.id);
    setDraft(draftFromTemplate(template));
  };

  const insertPlaceholder = (key: string) => {
    const token = `{{${key}}}`;
    setDraft((prev) => ({
      ...prev,
      body: prev.body ? `${prev.body}${prev.body.endsWith('\n') ? '' : '\n'}${token}` : token,
    }));
  };

  const handleSave = () => {
    const name = draft.name.trim();
    const subject = draft.subject.trim();
    const body = draft.body.trim();
    if (!name) {
      toast.error('Give the template a name');
      return;
    }
    if (!subject || !body) {
      toast.error('Subject and body are required');
      return;
    }
    const { templates: next, saved } = upsertSubmitToClientMailTemplate({
      id: creating ? undefined : draft.id,
      name,
      subject,
      body,
      isDefault: creating ? templates.length === 0 : selected?.isDefault,
    });
    setTemplates(next);
    setCreating(false);
    setSelectedId(saved.id);
    setDraft(draftFromTemplate(saved));
    toast.success(creating ? 'Email template created' : 'Email template saved');
  };

  const handleSetDefault = () => {
    if (!selected || creating) return;
    const next = setDefaultSubmitToClientMailTemplate(selected.id);
    setTemplates(next);
    toast.success(`“${selected.name}” is the default for Gmail / Outlook compose`);
  };

  const handleDelete = () => {
    if (!selected || creating) return;
    if (templates.length <= 1) {
      toast.error('Keep at least one email template');
      return;
    }
    const next = deleteSubmitToClientMailTemplate(selected.id);
    setTemplates(next);
    const fallback = next.find((t) => t.isDefault) || next[0]!;
    setSelectedId(fallback.id);
    setDraft(draftFromTemplate(fallback));
    toast.success('Email template deleted');
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Create subject and body templates for Submit to Client. When you open Gmail or Outlook
        compose, the default template fills the email. Use placeholders like{' '}
        <code className="rounded bg-slate-100 px-1 text-xs">{'{{candidateNames}}'}</code> and{' '}
        <code className="rounded bg-slate-100 px-1 text-xs">{'{{reviewUrl}}'}</code>.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={startCreate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          <Plus className="h-3.5 w-3.5" />
          New template
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="space-y-2">
          {templates.map((template) => {
            const active = !creating && template.id === selectedId;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => selectTemplate(template)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                  active
                    ? 'border-indigo-300 bg-indigo-50/80 ring-1 ring-indigo-200'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-800">{template.name}</span>
                  {template.isDefault ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                      <Star className="h-2.5 w-2.5 fill-current" />
                      Default
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{template.subject}</p>
              </button>
            );
          })}
          {creating ? (
            <div className="rounded-xl border border-dashed border-indigo-300 bg-indigo-50/40 px-3 py-2.5 text-sm font-semibold text-indigo-700">
              New template…
            </div>
          ) : null}
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Mail className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              {creating ? 'Create email template' : 'Edit email template'}
            </h3>
          </div>

          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Template name
            </span>
            <input
              value={draft.name}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none ring-indigo-200 focus:ring-2"
              placeholder="e.g. Client intro email"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Subject
            </span>
            <input
              value={draft.subject}
              onChange={(e) => setDraft((prev) => ({ ...prev, subject: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none ring-indigo-200 focus:ring-2"
              placeholder="Candidate review: {{candidateNames}}"
            />
          </label>

          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Body
            </span>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {SUBMIT_TO_CLIENT_MAIL_TEMPLATE_PLACEHOLDERS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => insertPlaceholder(item.key)}
                  title={item.label}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  {`{{${item.key}}}`}
                </button>
              ))}
            </div>
            <textarea
              value={draft.body}
              onChange={(e) => setDraft((prev) => ({ ...prev, body: e.target.value }))}
              rows={10}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs leading-5 text-slate-800 outline-none ring-indigo-200 focus:ring-2"
              placeholder="Write the email body…"
            />
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Preview (sample data)
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-800">{preview.subject || '—'}</p>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-5 text-slate-600">
              {preview.body || '—'}
            </pre>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              <Check className="h-3.5 w-3.5" />
              {creating ? 'Create template' : 'Save template'}
            </button>
            {!creating && selected ? (
              <>
                {!selected.isDefault ? (
                  <button
                    type="button"
                    onClick={handleSetDefault}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
                  >
                    <Star className="h-3.5 w-3.5" />
                    Set as default
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleDelete}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </>
            ) : null}
            {creating ? (
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  if (selected) selectTemplate(selected);
                }}
                className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
