'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Copy, FileText, Plus, RefreshCcw, Settings2, Trash2 } from 'lucide-react';
import { ApplicationFormBuilderModal } from '../../../components/jobs/ApplicationFormBuilderModal';
import { InterviewFormPreview } from '../../../components/interviews/InterviewFormPreview';
import {
  apiArchiveInterviewForm,
  apiCreateInterviewForm,
  apiDeleteInterviewForm,
  apiListInterviewForms,
  apiPublishInterviewForm,
  apiUnpublishInterviewForm,
  apiUpdateInterviewForm,
  type InterviewApplicationForm,
} from '../../../lib/api';
import {
  defaultApplicationFormSchema,
  normalizeApplicationFormSchema,
  type ApplicationFormSchema,
} from '../../../lib/applicationFormTypes';
import { requestConfirm } from '../../../lib/appDialog';

export default function InterviewFormsPage() {
  const [forms, setForms] = useState<InterviewApplicationForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<InterviewApplicationForm | null>(null);
  const [draftSchema, setDraftSchema] = useState<ApplicationFormSchema>(defaultApplicationFormSchema());
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiListInterviewForms();
      const data = (res as { data?: InterviewApplicationForm[] })?.data ?? res;
      setForms(Array.isArray(data) ? data : []);
    } catch {
      setForms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startNew = () => {
    setEditing(null);
    setTitle('Software Developer Interview Form');
    setDescription('');
    setDraftSchema(defaultApplicationFormSchema());
    setBuilderOpen(false);
  };

  const startEdit = (form: InterviewApplicationForm) => {
    setEditing(form);
    setTitle(form.title);
    setDescription(form.description || '');
    setDraftSchema(
      normalizeApplicationFormSchema(form.schema as ApplicationFormSchema) ||
        defaultApplicationFormSchema(),
    );
    setBuilderOpen(false);
  };

  const persistForm = async () => {
    const schema = normalizeApplicationFormSchema(draftSchema);
    if (!schema) return;
    if (editing) {
      await apiUpdateInterviewForm(editing.id, {
        title: title.trim() || editing.title,
        description: description.trim(),
        schema,
      });
    } else {
      await apiCreateInterviewForm({
        title: title.trim() || 'Interview application form',
        description: description.trim(),
        schema,
      });
      setEditing(null);
      setTitle('');
      setDescription('');
      setDraftSchema(defaultApplicationFormSchema());
    }
    void load();
  };

  const copyApplyLink = (form: InterviewApplicationForm) => {
    const tenant =
      typeof window !== 'undefined' ? window.localStorage.getItem('tenantDbName') || '' : '';
    const base = process.env.NEXT_PUBLIC_JOB_PORTAL_URL?.replace(/\/$/, '') || 'http://localhost:3000';
    const q = tenant ? `?tenantDbName=${encodeURIComponent(tenant)}` : '';
    const url = `${base}/en/lms/interview-prep/apply/${form.publicToken}${q}`;
    void navigator.clipboard.writeText(url);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100/80 bg-white/90 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/interviews"
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline"
          >
            <ArrowLeft size={14} />
            Interviews
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Interview forms</h1>
            <p className="text-xs text-slate-500">Build forms with live preview — like Google Forms</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-200 bg-white text-indigo-700"
          >
            <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={startNew}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-3.5 py-2 text-xs font-semibold text-white"
          >
            <Plus size={14} />
            Create form
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-7xl space-y-8">
          {/* Editor + live preview (Google Forms layout) */}
          <div className="grid gap-4 lg:grid-cols-[minmax(280px,320px)_1fr] lg:items-start">
            <aside className="sticky top-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {editing ? 'Edit form' : 'New form'}
              </h2>
              <div className="mt-3 space-y-2">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Form title"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description (optional)"
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <p className="text-[11px] text-slate-500 leading-snug">
                  Add or edit questions in the preview → hover a card and click Edit, or use Add question below.
                </p>
                <button
                  type="button"
                  onClick={() => setBuilderOpen(true)}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <Settings2 size={14} />
                  Advanced editor ({draftSchema.fields.length} fields)
                </button>
                <button
                  type="button"
                  onClick={() => void persistForm()}
                  className="w-full rounded-lg bg-indigo-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  {editing ? 'Save changes' : 'Create form'}
                </button>
              </div>
            </aside>

            <div className="min-h-[480px] lg:min-h-[560px]">
              <InterviewFormPreview
                title={title}
                description={description}
                schema={draftSchema}
                onChange={setDraftSchema}
              />
            </div>
          </div>

          {/* Saved forms list */}
          <section>
            <h2 className="mb-3 text-sm font-bold text-slate-800">Your interview forms</h2>
            {loading ? (
              <p className="text-sm text-slate-500">Loading forms…</p>
            ) : !forms.length ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-10 text-center">
                <FileText className="mx-auto text-slate-400" size={32} />
                <p className="mt-3 text-sm font-semibold text-slate-800">No saved forms yet</p>
                <p className="mt-1 text-xs text-slate-500">
                  Fill in the left panel and click Create form — preview updates as you type.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {forms.map((form) => (
                  <article
                    key={form.id}
                    className={`rounded-xl border p-4 shadow-sm transition ${
                      editing?.id === form.id
                        ? 'border-indigo-300 bg-indigo-50/30 ring-2 ring-indigo-200'
                        : 'border-slate-100 bg-white hover:border-indigo-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-slate-900">{form.title}</h3>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          form.status === 'PUBLISHED'
                            ? 'bg-emerald-50 text-emerald-800'
                            : form.status === 'ARCHIVED'
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-amber-50 text-amber-900'
                        }`}
                      >
                        {form.status}
                      </span>
                    </div>
                    {form.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600">{form.description}</p>
                    ) : null}
                    <p className="mt-2 text-[11px] text-slate-500">
                      {form.applicationCount ?? 0} application
                      {(form.applicationCount ?? 0) === 1 ? '' : 's'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => startEdit(form)}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      {form.status === 'PUBLISHED' ? (
                        <button
                          type="button"
                          onClick={() => void apiUnpublishInterviewForm(form.id).then(load)}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700"
                        >
                          Unpublish
                        </button>
                      ) : form.status !== 'ARCHIVED' ? (
                        <button
                          type="button"
                          onClick={() => void apiPublishInterviewForm(form.id).then(load)}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800"
                        >
                          Publish
                        </button>
                      ) : null}
                      {form.status === 'PUBLISHED' ? (
                        <button
                          type="button"
                          onClick={() => copyApplyLink(form)}
                          className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 px-2 py-1 text-[11px] font-semibold text-indigo-800"
                        >
                          <Copy size={11} />
                          Copy link
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void apiArchiveInterviewForm(form.id).then(load)}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600"
                      >
                        Archive
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await requestConfirm(`Delete "${form.title}"?`);
                          if (!ok) return;
                          await apiDeleteInterviewForm(form.id);
                          if (editing?.id === form.id) setEditing(null);
                          void load();
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-700"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <ApplicationFormBuilderModal
        isOpen={builderOpen}
        onClose={() => setBuilderOpen(false)}
        schema={draftSchema}
        onChange={setDraftSchema}
      />
    </div>
  );
}
