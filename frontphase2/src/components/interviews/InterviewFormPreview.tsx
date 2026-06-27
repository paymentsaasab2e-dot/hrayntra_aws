'use client';

import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  Eye,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  APPLICATION_FORM_FIELD_TYPE_OPTIONS,
  generateFormFieldId,
  normalizeApplicationFormSchema,
  type ApplicationFormField,
  type ApplicationFormFieldType,
  type ApplicationFormSchema,
} from '../../lib/applicationFormTypes';
import { requestInfo } from '../../lib/appDialog';

type Props = {
  title: string;
  description?: string;
  schema: ApplicationFormSchema;
  onChange?: (schema: ApplicationFormSchema) => void;
};

function fieldTypeLabel(type: ApplicationFormFieldType): string {
  return APPLICATION_FORM_FIELD_TYPE_OPTIONS.find((o) => o.value === type)?.label || type;
}

function PreviewFieldVisual({ field }: { field: ApplicationFormField }) {
  const inputClass =
    'mt-2 w-full rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-400 pointer-events-none';

  if (field.type === 'section_title') {
    return (
      <h3 className="text-base font-medium text-slate-800 border-b border-slate-100 pb-2">
        {field.label}
      </h3>
    );
  }

  const label = (
    <p className="text-sm font-medium text-slate-800">
      {field.label}
      {field.required ? <span className="text-red-500"> *</span> : null}
    </p>
  );

  if (field.type === 'long_text') {
    return (
      <>
        {label}
        <textarea readOnly rows={2} placeholder={field.placeholder || 'Your answer'} className={`${inputClass} min-h-[64px] resize-none`} />
      </>
    );
  }

  if (field.type === 'single_choice' && field.options?.length) {
    return (
      <>
        {label}
        <div className="mt-2 space-y-1.5">
          {field.options.map((opt) => (
            <div key={opt} className="flex items-center gap-2 text-sm text-slate-600">
              <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-slate-300" />
              {opt}
            </div>
          ))}
        </div>
      </>
    );
  }

  if (field.type === 'multi_choice' && field.options?.length) {
    return (
      <>
        {label}
        <div className="mt-2 space-y-1.5">
          {field.options.map((opt) => (
            <div key={opt} className="flex items-center gap-2 text-sm text-slate-600">
              <span className="h-3.5 w-3.5 shrink-0 rounded border border-slate-300" />
              {opt}
            </div>
          ))}
        </div>
      </>
    );
  }

  if (field.type === 'yes_no') {
    return (
      <>
        {label}
        <div className="mt-2 flex gap-4 text-sm text-slate-600">
          <span className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-full border-2 border-slate-300" /> Yes
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-full border-2 border-slate-300" /> No
          </span>
        </div>
      </>
    );
  }

  if (field.type === 'photo' || field.type === 'resume') {
    return (
      <>
        {label}
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
          <Upload size={16} className="text-slate-400" />
          {field.type === 'photo' ? 'Upload photo' : 'Upload resume / CV'}
        </div>
      </>
    );
  }

  if (field.type === 'education' || field.type === 'work_history') {
    return (
      <>
        {label}
        <div className="mt-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-3 text-xs text-slate-500">
          {field.type === 'education' ? 'Repeatable education entries' : 'Repeatable work experience'}
        </div>
      </>
    );
  }

  const inputType =
    field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text';

  return (
    <>
      {label}
      <input readOnly type={inputType} placeholder={field.placeholder || 'Your answer'} className={inputClass} />
    </>
  );
}

function InlineFieldEditor({
  field,
  onUpdate,
  onClose,
}: {
  field: ApplicationFormField;
  onUpdate: (patch: Partial<ApplicationFormField>) => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-3 border-t border-indigo-100 bg-indigo-50/40 -mx-5 -mb-4 mt-3 px-5 py-4 rounded-b-xl">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-indigo-700">Edit field</span>
        <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-white">
          <X size={14} />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-slate-600">Field type</label>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
            value={field.type}
            onChange={(e) => {
              const type = e.target.value as ApplicationFormFieldType;
              const patch: Partial<ApplicationFormField> = { type };
              if (type === 'single_choice' || type === 'multi_choice') {
                patch.options = field.options?.length ? field.options : ['Option 1', 'Option 2'];
              }
              onUpdate(patch);
            }}
          >
            {APPLICATION_FORM_FIELD_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Question label</label>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
            value={field.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
          />
        </div>
        {field.type !== 'section_title' ? (
          <>
            <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
              <input
                type="checkbox"
                checked={Boolean(field.required)}
                onChange={(e) => onUpdate({ required: e.target.checked })}
              />
              Required
            </label>
            {(field.type === 'single_choice' || field.type === 'multi_choice') && (
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-600">Options (one per line)</label>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                  rows={3}
                  value={(field.options || []).join('\n')}
                  onChange={(e) =>
                    onUpdate({
                      options: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-600">Help text (optional)</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                value={field.helpText || ''}
                onChange={(e) => onUpdate({ helpText: e.target.value || undefined })}
                placeholder="Shown below the question"
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function InterviewFormPreview({ title, description = '', schema, onChange }: Props) {
  const editable = Boolean(onChange);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const normalized = useMemo(
    () => normalizeApplicationFormSchema(schema) || schema,
    [schema],
  );
  const fields = normalized?.fields ?? [];
  const displayTitle = title.trim() || 'Untitled form';

  const commitFields = (nextFields: ApplicationFormField[]) => {
    if (!onChange) return;
    const next = normalizeApplicationFormSchema({ version: 1, fields: nextFields });
    if (next) onChange(next);
  };

  const updateField = (id: string, patch: Partial<ApplicationFormField>) => {
    commitFields(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const removeField = (id: string) => {
    if (editingFieldId === id) setEditingFieldId(null);
    commitFields(fields.filter((f) => f.id !== id));
  };

  const addField = (type: ApplicationFormFieldType) => {
    const label =
      APPLICATION_FORM_FIELD_TYPE_OPTIONS.find((o) => o.value === type)?.label || 'New field';
    const newField: ApplicationFormField = {
      id: generateFormFieldId(),
      type,
      label: type === 'section_title' ? 'New section' : label,
      required: type === 'email' || type === 'resume',
      options:
        type === 'single_choice' || type === 'multi_choice' ? ['Option 1', 'Option 2'] : undefined,
    };
    commitFields([...fields, newField]);
    setEditingFieldId(newField.id);
    setAddMenuOpen(false);
  };

  return (
    <div className="flex min-h-0 flex-col">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Eye size={14} className="text-indigo-600" />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {editable ? 'Build & preview' : 'Live preview'}
          </span>
          {editable ? (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
              Click Edit on any question
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-xl bg-[#eef2f7]">
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-xl">
            <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/80">
              <div className="h-2 bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600" />
              <div className="border-b border-slate-100 px-6 py-5">
                <h2 className="text-2xl font-normal text-slate-900">{displayTitle}</h2>
                {description.trim() ? (
                  <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{description}</p>
                ) : (
                  <p className="mt-2 text-sm italic text-slate-400">Form description (optional)</p>
                )}
                <p className="mt-4 text-xs text-red-600">
                  <span className="font-medium">*</span> Indicates required question
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-3">
            {fields.length === 0 ? (
              <div className="rounded-xl border border-dashed border-indigo-300 bg-white px-6 py-10 text-center">
                <p className="text-sm font-medium text-slate-700">No questions yet</p>
                <p className="mt-1 text-xs text-slate-500">Add your first field below</p>
              </div>
            ) : (
              fields.map((field) => {
                const isEditing = editingFieldId === field.id;
                return (
                  <div
                    key={field.id}
                    className={`group relative overflow-hidden rounded-xl bg-white shadow-sm ring-1 transition ${
                      isEditing
                        ? 'ring-2 ring-indigo-400'
                        : 'ring-slate-200/60 hover:ring-indigo-200'
                    }`}
                  >
                    {editable ? (
                      <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                        <button
                          type="button"
                          onClick={() => setEditingFieldId(isEditing ? null : field.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50"
                        >
                          <Pencil size={11} />
                          {isEditing ? 'Done' : 'Edit'}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeField(field.id)}
                          className="inline-flex items-center rounded-lg border border-rose-200 bg-white p-1 text-rose-600 shadow-sm hover:bg-rose-50"
                          title="Delete field"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ) : null}

                    <div className="px-5 py-4">
                      {editable && !isEditing ? (
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          {fieldTypeLabel(field.type)}
                        </p>
                      ) : null}
                      <PreviewFieldVisual field={field} />
                    </div>

                    {editable && isEditing ? (
                      <InlineFieldEditor
                        field={field}
                        onUpdate={(patch) => updateField(field.id, patch)}
                        onClose={() => setEditingFieldId(null)}
                      />
                    ) : null}
                  </div>
                );
              })
            )}
            </div>

            {fields.length > 0 ? (
              <div className="mt-4 space-y-1">
                {editable ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void requestInfo(
                        'Preview only — candidates submit this form on the Phase 1 portal. Use Create form on the left to save your changes.',
                        { title: 'Not a real submit' },
                      );
                    }}
                    className="inline-flex rounded-lg border-2 border-dashed border-indigo-300 bg-indigo-50/80 px-6 py-2.5 text-sm font-medium text-indigo-800 cursor-default hover:bg-indigo-100/80"
                  >
                    Submit application
                  </button>
                ) : (
                  <span className="inline-flex rounded-lg bg-indigo-600/90 px-6 py-2.5 text-sm font-medium text-white shadow-sm">
                    Submit application
                  </span>
                )}
                {editable ? (
                  <p className="text-[11px] text-slate-500">Preview only — save with Create form on the left</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {editable ? (
          <div className="relative z-20 shrink-0 border-t border-slate-200/80 bg-[#eef2f7] px-4 pb-4 pt-3 sm:px-6">
            <div className="mx-auto max-w-xl">
              {addMenuOpen ? (
                <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg ring-1 ring-slate-200/80">
                  <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Choose field type
                  </p>
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {APPLICATION_FORM_FIELD_TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => addField(opt.value)}
                        className="rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-800"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setAddMenuOpen((v) => !v)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-300 bg-white py-4 text-sm font-semibold text-indigo-700 shadow-sm transition hover:border-indigo-400 hover:bg-indigo-50/50"
              >
                <Plus size={18} />
                Add question
                <ChevronDown size={16} className={`transition ${addMenuOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
