'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, GripVertical, Loader2, Plus, Save, Trash2, X } from 'lucide-react';
import {
  apiCreateLinkedInPostTemplate,
  apiDeleteLinkedInPostTemplate,
  apiListLinkedInPostTemplates,
  apiUpdateLinkedInPostTemplate,
} from '../../lib/api';
import {
  defaultLinkedInPostTemplateSchema,
  normalizeLinkedInPostTemplateSchema,
  reorderLinkedInTemplateSections,
  toggleLinkedInTemplateSectionVisible,
  type JobLinkedInPostTemplate,
  type LinkedInPostTemplateSchema,
} from '../../lib/jobLinkedInPostTemplate';
import { requestError, requestInfo } from '../../lib/appDialog';

export type LinkedInPostTemplateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Currently applied template id (if any). */
  selectedTemplateId?: string | null;
  onApply: (template: JobLinkedInPostTemplate) => void;
};

function unwrapList(res: unknown): JobLinkedInPostTemplate[] {
  const rows = (res as { data?: unknown })?.data ?? res;
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const item = row as Record<string, unknown>;
    return {
      id: String(item.id || ''),
      name: String(item.name || 'Untitled'),
      schema: normalizeLinkedInPostTemplateSchema(item.schema),
      createdAt: item.createdAt ? String(item.createdAt) : undefined,
      updatedAt: item.updatedAt ? String(item.updatedAt) : undefined,
    };
  });
}

export function LinkedInPostTemplateModal({
  isOpen,
  onClose,
  selectedTemplateId,
  onApply,
}: LinkedInPostTemplateModalProps) {
  const [templates, setTemplates] = useState<JobLinkedInPostTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<string>('');
  const [draftName, setDraftName] = useState('LinkedIn post template');
  const [draftSchema, setDraftSchema] = useState<LinkedInPostTemplateSchema>(
    defaultLinkedInPostTemplateSchema(),
  );
  const [mode, setMode] = useState<'list' | 'edit'>('list');
  const [draggedSectionKey, setDraggedSectionKey] = useState<string | null>(null);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await apiListLinkedInPostTemplates();
      const rows = unwrapList(res);
      setTemplates(rows);
      if (selectedTemplateId && rows.some((t) => t.id === selectedTemplateId)) {
        setActiveId(selectedTemplateId);
      }
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setMode('list');
    setDraftName('LinkedIn post template');
    setDraftSchema(defaultLinkedInPostTemplateSchema());
    setDraggedSectionKey(null);
    void loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedTemplateId]);

  const orderedSections = useMemo(
    () => [...draftSchema.sections].sort((a, b) => a.order - b.order),
    [draftSchema.sections],
  );

  if (!isOpen) return null;

  const startCreate = () => {
    setActiveId('');
    setDraftName(`LinkedIn template ${templates.length + 1}`);
    setDraftSchema(defaultLinkedInPostTemplateSchema());
    setDraggedSectionKey(null);
    setMode('edit');
  };

  const startEdit = (template: JobLinkedInPostTemplate) => {
    setActiveId(template.id);
    setDraftName(template.name);
    setDraftSchema(normalizeLinkedInPostTemplateSchema(template.schema));
    setDraggedSectionKey(null);
    setMode('edit');
  };

  const persistTemplate = async (): Promise<JobLinkedInPostTemplate | null> => {
    const name = draftName.trim() || 'LinkedIn post template';
    const schema = normalizeLinkedInPostTemplateSchema(draftSchema);
    setSaving(true);
    try {
      if (activeId) {
        const res = await apiUpdateLinkedInPostTemplate(activeId, { name, schema });
        const data = ((res as { data?: unknown })?.data ?? res) as {
          id: string;
          name: string;
          schema: unknown;
        };
        return {
          id: data.id,
          name: data.name,
          schema: normalizeLinkedInPostTemplateSchema(data.schema),
        };
      }
      const res = await apiCreateLinkedInPostTemplate({ name, schema });
      const data = ((res as { data?: unknown })?.data ?? res) as {
        id: string;
        name: string;
        schema: unknown;
      };
      setActiveId(data.id);
      return {
        id: data.id,
        name: data.name,
        schema: normalizeLinkedInPostTemplateSchema(data.schema),
      };
    } catch (error: any) {
      await requestError(error?.message || 'Failed to save LinkedIn post template', {
        title: 'Could not save template',
      });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const saved = await persistTemplate();
    if (!saved) return;
    await requestInfo(
      activeId
        ? `"${saved.name}" was updated for this tenant.`
        : `"${saved.name}" was created. You can make more templates anytime.`,
      { title: activeId ? 'Template updated' : 'Template created' },
    );
    await loadTemplates();
    if (!selectedTemplateId || selectedTemplateId === saved.id) {
      onApply(saved);
    }
    setMode('list');
  };

  const handleSaveAndUse = async () => {
    const saved = await persistTemplate();
    if (!saved) return;
    await loadTemplates();
    onApply(saved);
    onClose();
  };

  const handleDelete = async (template: JobLinkedInPostTemplate) => {
    setSaving(true);
    try {
      await apiDeleteLinkedInPostTemplate(template.id);
      if (activeId === template.id) setActiveId('');
      await loadTemplates();
    } catch (error: any) {
      await requestError(error?.message || 'Failed to delete template', {
        title: 'Could not delete template',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleApply = (template: JobLinkedInPostTemplate) => {
    onApply({
      ...template,
      schema: normalizeLinkedInPostTemplateSchema(template.schema),
    });
    onClose();
  };

  const handleSectionDrop = (toIndex: number) => {
    if (!draggedSectionKey) return;
    const fromIndex = orderedSections.findIndex((s) => s.key === draggedSectionKey);
    if (fromIndex < 0 || fromIndex === toIndex) {
      setDraggedSectionKey(null);
      return;
    }
    setDraftSchema((prev) => reorderLinkedInTemplateSections(prev, fromIndex, toIndex));
    setDraggedSectionKey(null);
  };

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">LinkedIn post templates</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Create multiple templates, edit any of them, and drag sections into the order used when
              posting to LinkedIn.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {mode === 'list' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Saved templates ({templates.length})
                </p>
                <button
                  type="button"
                  onClick={startCreate}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <Plus size={14} />
                  New template
                </button>
              </div>

              {loading ? (
                <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
                  <Loader2 size={16} className="animate-spin" />
                  Loading templates…
                </div>
              ) : templates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                  <p className="text-sm font-medium text-slate-700">No templates yet</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Create one, drag sections into order, then use it when posting to LinkedIn.
                  </p>
                  <button
                    type="button"
                    onClick={startCreate}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    <Plus size={14} />
                    Create first template
                  </button>
                </div>
              ) : (
                <ul className="space-y-2">
                  {templates.map((template) => {
                    const visibleCount = template.schema.sections.filter((s) => s.visible).length;
                    const isSelected = selectedTemplateId === template.id;
                    const previewOrder = [...template.schema.sections]
                      .sort((a, b) => a.order - b.order)
                      .filter((s) => s.visible)
                      .slice(0, 4)
                      .map((s) => s.label)
                      .join(' → ');
                    return (
                      <li
                        key={template.id}
                        className={`rounded-xl border px-3 py-2.5 ${
                          isSelected
                            ? 'border-blue-300 bg-blue-50/60'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {template.name}
                              {isSelected ? (
                                <span className="ml-2 text-[10px] font-bold uppercase text-blue-600">
                                  Active
                                </span>
                              ) : null}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {visibleCount} visible · {template.schema.sections.length} sections
                            </p>
                            {previewOrder ? (
                              <p className="mt-1 truncate text-[10px] text-slate-400">
                                Sequence: {previewOrder}
                                {visibleCount > 4 ? '…' : ''}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleApply(template)}
                              className="rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800"
                            >
                              Use
                            </button>
                            <button
                              type="button"
                              onClick={() => startEdit(template)}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void handleDelete(template)}
                              className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                              title="Delete template"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Template name
                </label>
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="e.g. Standard LinkedIn hire post"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  {activeId
                    ? 'Editing an existing tenant template.'
                    : 'Creating a new template. You can add as many as you need.'}
                </p>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Section sequence
                </p>
                <p className="mb-2 text-[11px] text-slate-500">
                  Drag the grip handle to reorder. Toggle the eye to show or hide each section in the
                  LinkedIn post.
                </p>
                <ul className="space-y-1.5">
                  {orderedSections.map((section, index) => (
                    <li
                      key={section.key}
                      draggable
                      onDragStart={() => setDraggedSectionKey(section.key)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleSectionDrop(index);
                      }}
                      onDragEnd={() => setDraggedSectionKey(null)}
                      className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 transition-colors ${
                        draggedSectionKey === section.key
                          ? 'border-blue-300 bg-blue-50/70 opacity-60'
                          : section.visible
                            ? 'border-slate-200 bg-white hover:border-slate-300'
                            : 'border-slate-100 bg-slate-50 opacity-70'
                      }`}
                    >
                      <span
                        className="cursor-grab text-slate-400 active:cursor-grabbing hover:text-slate-600"
                        aria-label="Drag to reorder"
                        title="Drag to reorder"
                      >
                        <GripVertical size={16} />
                      </span>
                      <span className="w-5 text-center text-[10px] font-bold text-slate-400">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{section.label}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setDraftSchema((prev) =>
                            toggleLinkedInTemplateSectionVisible(prev, section.key),
                          )
                        }
                        className={`rounded-md p-1.5 ${
                          section.visible
                            ? 'text-emerald-600 hover:bg-emerald-50'
                            : 'text-slate-400 hover:bg-slate-100'
                        }`}
                        title={section.visible ? 'Hide section' : 'Show section'}
                      >
                        {section.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-3">
          {mode === 'edit' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setDraggedSectionKey(null);
                  setMode('list');
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Back
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSave()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSaveAndUse()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save & use
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="ml-auto rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
