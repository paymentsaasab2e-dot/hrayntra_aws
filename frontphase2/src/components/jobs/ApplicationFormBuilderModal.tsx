'use client';

import React, { useEffect, useState } from 'react';
import { X, Plus, Trash2, GripVertical, Save } from 'lucide-react';
import {
  type ApplicationFormField,
  type ApplicationFormSchema,
  APPLICATION_FORM_FIELD_TYPE_OPTIONS,
  generateFormFieldId,
  defaultApplicationFormSchema,
  normalizeApplicationFormSchema,
} from '../../lib/applicationFormTypes';
import {
  apiCreateApplicationFormTemplate,
  apiListApplicationFormTemplates,
} from '../../lib/api';
import { requestError, requestInfo } from '../../lib/appDialog';

interface ApplicationFormBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  schema?: ApplicationFormSchema | null;
  onChange: (schema: ApplicationFormSchema) => void;
}

function resolveSchema(schema?: ApplicationFormSchema | null): ApplicationFormSchema {
  return normalizeApplicationFormSchema(schema) ?? defaultApplicationFormSchema();
}

export function ApplicationFormBuilderModal({
  isOpen,
  onClose,
  schema,
  onChange,
}: ApplicationFormBuilderModalProps) {
  const safeSchema = resolveSchema(schema);
  const [fields, setFields] = useState<ApplicationFormField[]>(safeSchema.fields);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; schema: unknown }>>([]);
  const [templateName, setTemplateName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const next = resolveSchema(schema);
    setFields(next.fields);
  }, [isOpen, schema]);

  useEffect(() => {
    if (!isOpen) return;
    void apiListApplicationFormTemplates()
      .then((res) => {
        const rows = (res as { data?: unknown })?.data ?? res;
        setTemplates(Array.isArray(rows) ? rows : []);
      })
      .catch(() => setTemplates([]));
  }, [isOpen]);

  if (!isOpen) return null;

  const updateField = (id: string, patch: Partial<ApplicationFormField>) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  const addField = (type: ApplicationFormField['type']) => {
    const label =
      APPLICATION_FORM_FIELD_TYPE_OPTIONS.find((o) => o.value === type)?.label || 'New field';
    setFields((prev) => [
      ...prev,
      {
        id: generateFormFieldId(),
        type,
        label: type === 'section_title' ? 'Section' : label,
        required: type === 'email' || type === 'resume',
        options: type === 'single_choice' || type === 'multi_choice' ? ['Option 1', 'Option 2'] : undefined,
      },
    ]);
  };

  const handleSave = () => {
    const normalized = normalizeApplicationFormSchema({ version: 1, fields });
    if (!normalized) {
      void requestError('Add at least one field to the form.');
      return;
    }
    onChange(normalized);
    onClose();
  };

  const loadTemplate = (id: string) => {
    const row = templates.find((t) => t.id === id);
    if (!row) return;
    const parsed = normalizeApplicationFormSchema(row.schema);
    if (parsed) setFields(parsed.fields);
  };

  const saveAsTemplate = async () => {
    const name = templateName.trim() || 'Application form template';
    const normalized = normalizeApplicationFormSchema({ version: 1, fields });
    if (!normalized) return;
    try {
      await apiCreateApplicationFormTemplate({ name, schema: normalized });
      void requestInfo('Template saved.');
      setTemplateName('');
      const res = await apiListApplicationFormTemplates();
      const rows = (res as { data?: unknown })?.data ?? res;
      setTemplates(Array.isArray(rows) ? rows : []);
    } catch (e) {
      void requestError(e instanceof Error ? e.message : 'Failed to save template');
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Application form builder</h2>
            <p className="text-sm text-slate-500">Add fields like Google Forms — text, email, resume, education, etc.</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={22} />
          </button>
        </div>

        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 flex flex-wrap gap-2 items-end">
          <div className="min-w-[200px] flex-1">
            <label className="text-xs font-medium text-slate-600">Load saved template</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={selectedTemplateId}
              onChange={(e) => {
                setSelectedTemplateId(e.target.value);
                if (e.target.value) loadTemplate(e.target.value);
              }}
            >
              <option value="">— Select template —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[180px] flex-1">
            <label className="text-xs font-medium text-slate-600">Save as template</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Template name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => void saveAsTemplate()}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Save template
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {fields.map((field) => (
            <div key={field.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-2">
                <GripVertical size={16} className="mt-2 text-slate-300 shrink-0" />
                <div className="flex-1 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-500">Field type</label>
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                      value={field.type}
                      onChange={(e) =>
                        updateField(field.id, {
                          type: e.target.value as ApplicationFormField['type'],
                        })
                      }
                    >
                      {APPLICATION_FORM_FIELD_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Label</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                      value={field.label}
                      onChange={(e) => updateField(field.id, { label: e.target.value })}
                    />
                  </div>
                  {field.type !== 'section_title' && (
                    <>
                      <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
                        <input
                          type="checkbox"
                          checked={Boolean(field.required)}
                          onChange={(e) => updateField(field.id, { required: e.target.checked })}
                        />
                        Required
                      </label>
                      {(field.type === 'single_choice' || field.type === 'multi_choice') && (
                        <div className="sm:col-span-2">
                          <label className="text-xs text-slate-500">Options (one per line)</label>
                          <textarea
                            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                            rows={3}
                            value={(field.options || []).join('\n')}
                            onChange={(e) =>
                              updateField(field.id, {
                                options: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                              })
                            }
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeField(field.id)}
                  className="text-rose-500 hover:text-rose-700 p-1"
                  title="Remove field"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-200 px-5 py-3 flex flex-wrap gap-2">
          {APPLICATION_FORM_FIELD_TYPE_OPTIONS.slice(0, 8).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => addField(opt.value)}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              <Plus size={12} /> {opt.label}
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Save size={16} /> Use this form
          </button>
        </div>
      </div>
    </div>
  );
}
