'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  type ApplicationFormField,
  type ApplicationFormSchema,
} from '../../lib/applicationFormTypes';

type EducationRow = {
  institution?: string;
  degree?: string;
  startYear?: string;
  endYear?: string;
};

type WorkRow = {
  company?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
};

export interface PublicJobApplyFormProps {
  schema: ApplicationFormSchema;
  note?: string | null;
  logoUrl?: string | null;
  submitting?: boolean;
  onSubmit: (payload: { answers: Record<string, unknown>; files: Record<string, File> }) => void;
}

export function PublicJobApplyForm({
  schema,
  note,
  logoUrl,
  submitting = false,
  onSubmit,
}: PublicJobApplyFormProps) {
  const fields = useMemo(
    () => (schema?.fields || []).filter((f) => f.type !== 'section_title' || true),
    [schema]
  );

  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [error, setError] = useState('');

  const setAnswer = (id: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    for (const field of fields) {
      if (field.type === 'section_title') continue;
      if (!field.required) continue;
      if (field.type === 'photo' || field.type === 'resume') {
        if (!files[field.id]) {
          setError(`${field.label} is required`);
          return;
        }
        continue;
      }
      const val = answers[field.id];
      if (val == null || String(val).trim() === '') {
        setError(`${field.label} is required`);
        return;
      }
      if (field.type === 'education' || field.type === 'work_history') {
        const rows = Array.isArray(val) ? val : [];
        if (rows.length === 0) {
          setError(`${field.label} is required`);
          return;
        }
      }
    }
    onSubmit({ answers, files });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {logoUrl ? (
        <img src={logoUrl} alt="" className="h-12 w-auto object-contain" />
      ) : null}
      {note ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {note}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {fields.map((field) => (
        <FieldBlock
          key={field.id}
          field={field}
          value={answers[field.id]}
          file={files[field.id]}
          onValueChange={(v) => setAnswer(field.id, v)}
          onFileChange={(f) => {
            if (f) setFiles((prev) => ({ ...prev, [field.id]: f }));
            else
              setFiles((prev) => {
                const next = { ...prev };
                delete next[field.id];
                return next;
              });
          }}
        />
      ))}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {submitting ? 'Submitting…' : 'Submit application'}
      </button>
    </form>
  );
}

function FieldBlock({
  field,
  value,
  file,
  onValueChange,
  onFileChange,
}: {
  field: ApplicationFormField;
  value: unknown;
  file?: File;
  onValueChange: (v: unknown) => void;
  onFileChange: (f: File | null) => void;
}) {
  if (field.type === 'section_title') {
    return (
      <h3 className="border-b border-slate-200 pb-2 text-base font-bold text-slate-900">
        {field.label}
      </h3>
    );
  }

  const label = (
    <label className="block text-sm font-semibold text-slate-800">
      {field.label}
      {field.required ? <span className="text-red-500"> *</span> : null}
    </label>
  );

  const help = field.helpText ? (
    <p className="mt-1 text-xs text-slate-500">{field.helpText}</p>
  ) : null;

  if (field.type === 'education') {
    const rows = (Array.isArray(value) ? value : []) as EducationRow[];
    return (
      <div className="space-y-3">
        {label}
        {help}
        {rows.map((row, idx) => (
          <div
            key={idx}
            className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3 sm:grid-cols-2"
          >
            <input
              placeholder="Institution"
              value={row.institution || ''}
              onChange={(e) => {
                const next = [...rows];
                next[idx] = { ...row, institution: e.target.value };
                onValueChange(next);
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              placeholder="Degree"
              value={row.degree || ''}
              onChange={(e) => {
                const next = [...rows];
                next[idx] = { ...row, degree: e.target.value };
                onValueChange(next);
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              placeholder="Start year"
              value={row.startYear || ''}
              onChange={(e) => {
                const next = [...rows];
                next[idx] = { ...row, startYear: e.target.value };
                onValueChange(next);
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              placeholder="End year"
              value={row.endYear || ''}
              onChange={(e) => {
                const next = [...rows];
                next[idx] = { ...row, endYear: e.target.value };
                onValueChange(next);
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => onValueChange(rows.filter((_, i) => i !== idx))}
              className="text-xs text-red-600 hover:underline sm:col-span-2 justify-self-start inline-flex items-center gap-1"
            >
              <Trash2 size={12} /> Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onValueChange([...rows, {}])}
          className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          <Plus size={14} /> Add education
        </button>
      </div>
    );
  }

  if (field.type === 'work_history') {
    const rows = (Array.isArray(value) ? value : []) as WorkRow[];
    return (
      <div className="space-y-3">
        {label}
        {help}
        {rows.map((row, idx) => (
          <div
            key={idx}
            className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3 sm:grid-cols-2"
          >
            <input
              placeholder="Company"
              value={row.company || ''}
              onChange={(e) => {
                const next = [...rows];
                next[idx] = { ...row, company: e.target.value };
                onValueChange(next);
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              placeholder="Job title"
              value={row.title || ''}
              onChange={(e) => {
                const next = [...rows];
                next[idx] = { ...row, title: e.target.value };
                onValueChange(next);
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              placeholder="Start date"
              value={row.startDate || ''}
              onChange={(e) => {
                const next = [...rows];
                next[idx] = { ...row, startDate: e.target.value };
                onValueChange(next);
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              placeholder="End date"
              value={row.endDate || ''}
              onChange={(e) => {
                const next = [...rows];
                next[idx] = { ...row, endDate: e.target.value };
                onValueChange(next);
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <textarea
              placeholder="Description"
              value={row.description || ''}
              onChange={(e) => {
                const next = [...rows];
                next[idx] = { ...row, description: e.target.value };
                onValueChange(next);
              }}
              className="sm:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[72px]"
            />
            <button
              type="button"
              onClick={() => onValueChange(rows.filter((_, i) => i !== idx))}
              className="text-xs text-red-600 hover:underline sm:col-span-2 justify-self-start inline-flex items-center gap-1"
            >
              <Trash2 size={12} /> Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onValueChange([...rows, {}])}
          className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          <Plus size={14} /> Add experience
        </button>
      </div>
    );
  }

  if (field.type === 'photo' || field.type === 'resume') {
    const accept =
      field.type === 'photo' ? 'image/*' : '.pdf,.doc,.docx,application/pdf';
    return (
      <div>
        {label}
        {help}
        <input
          type="file"
          accept={accept}
          className="mt-2 block w-full text-sm text-slate-600"
          onChange={(e) => onFileChange(e.target.files?.[0] || null)}
        />
        {file ? (
          <p className="mt-1 text-xs text-slate-500">Selected: {file.name}</p>
        ) : null}
      </div>
    );
  }

  if (field.type === 'long_text') {
    return (
      <div>
        {label}
        {help}
        <textarea
          value={String(value ?? '')}
          placeholder={field.placeholder}
          onChange={(e) => onValueChange(e.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[100px]"
        />
      </div>
    );
  }

  if (field.type === 'yes_no') {
    return (
      <div>
        {label}
        {help}
        <div className="mt-2 flex gap-4">
          {(['Yes', 'No'] as const).map((opt) => (
            <label key={opt} className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={field.id}
                checked={value === opt}
                onChange={() => onValueChange(opt)}
              />
              {opt}
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === 'single_choice' && field.options?.length) {
    return (
      <div>
        {label}
        {help}
        <select
          value={String(value ?? '')}
          onChange={(e) => onValueChange(e.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">Select…</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === 'multi_choice' && field.options?.length) {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div>
        {label}
        {help}
        <div className="mt-2 space-y-2">
          {field.options.map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(o)}
                onChange={(e) => {
                  if (e.target.checked) onValueChange([...selected, o]);
                  else onValueChange(selected.filter((x) => x !== o));
                }}
              />
              {o}
            </label>
          ))}
        </div>
      </div>
    );
  }

  const inputType =
    field.type === 'email'
      ? 'email'
      : field.type === 'phone'
        ? 'tel'
        : field.type === 'number'
          ? 'number'
          : field.type === 'date'
            ? 'date'
            : 'text';

  return (
    <div>
      {label}
      {help}
      <input
        type={inputType}
        value={String(value ?? '')}
        placeholder={field.placeholder}
        onChange={(e) => onValueChange(e.target.value)}
        className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
    </div>
  );
}
