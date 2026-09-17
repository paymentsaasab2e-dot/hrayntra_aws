'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ChevronDown, ChevronUp, Eye, EyeOff, GripVertical, Layers, Linkedin, Loader2, Mail, Plus, Save, Send, Table2, X } from 'lucide-react';
import { toast } from 'sonner';
import { PublicVisibilityToggle } from '../forms/PublicVisibilityToggle';
import { SubmitToClientMailTemplateSettings } from './SubmitToClientMailTemplateSettings';
import {
  JOB_PUBLIC_VISIBILITY_FIELD_LABELS,
  JOB_PUBLIC_VISIBILITY_FIELDS,
  mergeClientVisibility,
  parseJobPublicFieldVisibility,
  toggleJobPublicFieldVisibility,
  type JobPublicFieldVisibility,
  type JobPublicVisibilityField,
} from '../../lib/jobPublicFieldVisibility';
import {
  jobVisibilityDefaultsEqual,
  loadJobVisibilityUserDefaults,
  readCachedJobVisibilityUserDefaults,
  saveJobVisibilityUserDefaults,
  subscribeJobVisibilityDefaultsChanged,
} from '../../lib/jobVisibilityUserDefaults';
import {
  hiddenSubmitToClientFieldCount,
  parseSubmitToClientFieldVisibility,
  parseSubmitToClientTableColumns,
  SUBMIT_TO_CLIENT_FIELD_GROUPS,
  SUBMIT_TO_CLIENT_FIELD_LABELS,
  SUBMIT_TO_CLIENT_FIELDS,
  submitToClientFieldVisibilityEqual,
  submitToClientTableColumnsEqual,
  toggleSubmitToClientFieldVisibility,
  type SubmitToClientFieldId,
  type SubmitToClientFieldVisibility,
} from '../../lib/submitToClientFieldVisibility';
import {
  loadSubmitToClientVisibilityDefaults,
  readCachedSubmitToClientVisibilityDefaults,
  saveSubmitToClientVisibilityDefaults,
  stagesDefaultsEqual,
  subscribeSubmitToClientVisibilityDefaultsChanged,
} from '../../lib/submitToClientFieldVisibilityDefaults';
import { SettingsPageHero, SettingsPanel } from './SettingsPageHero';
import { LinkedInPublishingDefaultsPanel } from '../jobs/LinkedInPublishingDefaultsPanel';
import { ClientPreviewStagesPicker } from './ClientPreviewStagesPicker';

const TABLE_COLUMN_DND = 'submit-to-client-table-column';

type TableColumnDragItem = { index: number; fieldId: SubmitToClientFieldId };

function SortableTableColumnRow({
  fieldId,
  index,
  total,
  onMove,
  onRemove,
}: {
  fieldId: SubmitToClientFieldId;
  index: number;
  total: number;
  onMove: (fromIndex: number, toIndex: number) => void;
  onRemove: (field: SubmitToClientFieldId) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: TABLE_COLUMN_DND,
      item: { index, fieldId } satisfies TableColumnDragItem,
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [index, fieldId],
  );
  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: TABLE_COLUMN_DND,
      hover: (item: TableColumnDragItem, monitor) => {
        if (!ref.current) return;
        const dragIndex = item.index;
        const hoverIndex = index;
        if (dragIndex === hoverIndex) return;
        const hoverBoundingRect = ref.current.getBoundingClientRect();
        const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
        const clientOffset = monitor.getClientOffset();
        if (!clientOffset) return;
        const hoverClientY = clientOffset.y - hoverBoundingRect.top;
        if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
        if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;
        onMove(dragIndex, hoverIndex);
        item.index = hoverIndex;
      },
      collect: (monitor) => ({ isOver: monitor.isOver({ shallow: true }) }),
    }),
    [index, onMove],
  );

  drag(drop(ref));
  const label = SUBMIT_TO_CLIENT_FIELD_LABELS[fieldId];

  return (
    <div
      ref={ref}
      className={`flex cursor-grab items-center gap-2 rounded-xl border bg-white px-3 py-2.5 active:cursor-grabbing ${
        isDragging
          ? 'border-indigo-300 opacity-40'
          : isOver
            ? 'border-indigo-400 ring-1 ring-indigo-200'
            : 'border-indigo-100'
      }`}
    >
      <span className="shrink-0 text-slate-400" aria-hidden>
        <GripVertical className="h-4 w-4" />
      </span>
      <span className="w-6 shrink-0 text-center text-xs font-bold text-indigo-500">{index + 1}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{label}</span>
      <button
        type="button"
        aria-label={`Move ${label} up`}
        disabled={index === 0}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={() => onMove(index, index - 1)}
        className="cursor-pointer rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <ChevronUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={`Move ${label} down`}
        disabled={index === total - 1}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={() => onMove(index, index + 1)}
        className="cursor-pointer rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={`Remove ${label} from table`}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={() => onRemove(fieldId)}
        className="cursor-pointer rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function PublicVisibilitySettings() {
  const cached = readCachedJobVisibilityUserDefaults();
  const cachedSubmit = readCachedSubmitToClientVisibilityDefaults();
  const [visibility, setVisibility] = useState<JobPublicFieldVisibility>(cached.visibility);
  const [showClientNamePublicly, setShowClientNamePublicly] = useState(cached.showClient);
  const [savedVisibility, setSavedVisibility] = useState<JobPublicFieldVisibility>(cached.visibility);
  const [savedShowClient, setSavedShowClient] = useState(cached.showClient);
  const [submitVisibility, setSubmitVisibility] = useState<SubmitToClientFieldVisibility>(
    cachedSubmit.visibility,
  );
  const [savedSubmitVisibility, setSavedSubmitVisibility] = useState<SubmitToClientFieldVisibility>(
    cachedSubmit.visibility,
  );
  const [tableColumns, setTableColumns] = useState<SubmitToClientFieldId[]>(cachedSubmit.tableColumns);
  const [savedTableColumns, setSavedTableColumns] = useState<SubmitToClientFieldId[]>(
    cachedSubmit.tableColumns,
  );
  const [allowedClientStages, setAllowedClientStages] = useState<string[]>(
    cachedSubmit.allowedClientStages,
  );
  const [clientStageCatalog, setClientStageCatalog] = useState<string[]>(
    cachedSubmit.clientStageCatalog,
  );
  const [savedAllowedClientStages, setSavedAllowedClientStages] = useState<string[]>(
    cachedSubmit.allowedClientStages,
  );
  const [savedClientStageCatalog, setSavedClientStageCatalog] = useState<string[]>(
    cachedSubmit.clientStageCatalog,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitSaving, setSubmitSaving] = useState(false);
  const [stagesSaving, setStagesSaving] = useState(false);
  const [submitTab, setSubmitTab] = useState<'visible' | 'hidden' | 'table'>('visible');

  const current = mergeClientVisibility(
    parseJobPublicFieldVisibility(visibility),
    showClientNamePublicly,
  );

  useEffect(() => {
    let cancelled = false;
    void loadJobVisibilityUserDefaults().then((defaults) => {
      if (cancelled) return;
      setVisibility(defaults.visibility);
      setShowClientNamePublicly(defaults.showClient);
      setSavedVisibility(defaults.visibility);
      setSavedShowClient(defaults.showClient);
      setLoading(false);
    });
    const unsubscribe = subscribeJobVisibilityDefaultsChanged((defaults) => {
      if (cancelled) return;
      setSavedVisibility(defaults.visibility);
      setSavedShowClient(defaults.showClient);
    });
    void loadSubmitToClientVisibilityDefaults().then((defaults) => {
      if (cancelled) return;
      setSubmitVisibility(defaults.visibility);
      setSavedSubmitVisibility(defaults.visibility);
      setTableColumns(defaults.tableColumns);
      setSavedTableColumns(defaults.tableColumns);
      setAllowedClientStages(defaults.allowedClientStages);
      setClientStageCatalog(defaults.clientStageCatalog);
      setSavedAllowedClientStages(defaults.allowedClientStages);
      setSavedClientStageCatalog(defaults.clientStageCatalog);
    });
    const unsubscribeSubmit = subscribeSubmitToClientVisibilityDefaultsChanged((defaults) => {
      if (cancelled) return;
      setSavedSubmitVisibility(defaults.visibility);
      setSavedTableColumns(defaults.tableColumns);
      setSavedAllowedClientStages(defaults.allowedClientStages);
      setSavedClientStageCatalog(defaults.clientStageCatalog);
    });
    return () => {
      cancelled = true;
      unsubscribe();
      unsubscribeSubmit();
    };
  }, []);

  const matchesSaved = useMemo(
    () =>
      jobVisibilityDefaultsEqual(current, savedVisibility, showClientNamePublicly, savedShowClient),
    [current, savedVisibility, showClientNamePublicly, savedShowClient],
  );

  const submitMatchesSaved = useMemo(
    () =>
      submitToClientFieldVisibilityEqual(submitVisibility, savedSubmitVisibility) &&
      submitToClientTableColumnsEqual(tableColumns, savedTableColumns),
    [submitVisibility, savedSubmitVisibility, tableColumns, savedTableColumns],
  );

  const stagesMatchSaved = useMemo(
    () =>
      stagesDefaultsEqual(
        { allowedClientStages, clientStageCatalog },
        {
          allowedClientStages: savedAllowedClientStages,
          clientStageCatalog: savedClientStageCatalog,
        },
      ),
    [
      allowedClientStages,
      clientStageCatalog,
      savedAllowedClientStages,
      savedClientStageCatalog,
    ],
  );

  const pageMatchesSaved = matchesSaved && submitMatchesSaved && stagesMatchSaved;

  const hiddenCount = useMemo(
    () => JOB_PUBLIC_VISIBILITY_FIELDS.filter((field) => current[field] === false).length,
    [current],
  );

  const submitHiddenCount = useMemo(
    () => hiddenSubmitToClientFieldCount(submitVisibility),
    [submitVisibility],
  );

  const submitVisibleCount = SUBMIT_TO_CLIENT_FIELDS.length - submitHiddenCount;

  const assignedTableColumns = useMemo(
    () => parseSubmitToClientTableColumns(tableColumns, submitVisibility),
    [tableColumns, submitVisibility],
  );

  const tableAvailableGroups = useMemo(() => {
    const assigned = new Set(assignedTableColumns);
    return SUBMIT_TO_CLIENT_FIELD_GROUPS.map((group) => ({
      ...group,
      fields: group.fields.filter(
        (field) => submitVisibility[field.id] !== false && !assigned.has(field.id),
      ),
    })).filter((group) => group.fields.length > 0);
  }, [assignedTableColumns, submitVisibility]);

  const submitTabGroups = useMemo(
    () =>
      SUBMIT_TO_CLIENT_FIELD_GROUPS.map((group) => ({
        ...group,
        fields: group.fields.filter((field) => {
          const isVisible = submitVisibility[field.id] !== false;
          return submitTab === 'visible' ? isVisible : !isVisible;
        }),
      })).filter((group) => group.fields.length > 0),
    [submitTab, submitVisibility],
  );

  const persist = async (
    nextVisibility: JobPublicFieldVisibility,
    nextShowClient: boolean,
    { notify }: { notify: boolean },
  ) => {
    setSaving(true);
    try {
      const next = await saveJobVisibilityUserDefaults(nextVisibility, nextShowClient);
      setSavedVisibility(next.visibility);
      setSavedShowClient(next.showClient);
      setVisibility(next.visibility);
      setShowClientNamePublicly(next.showClient);
      if (notify) toast.success('Public Visibility defaults saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save Public Visibility defaults');
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const persistSubmit = async ({ notify }: { notify: boolean }) => {
    setSubmitSaving(true);
    try {
      const next = await saveSubmitToClientVisibilityDefaults(
        parseSubmitToClientFieldVisibility(submitVisibility),
        { tableColumns: assignedTableColumns, allowedClientStages, clientStageCatalog },
      );
      setSubmitVisibility(next.visibility);
      setSavedSubmitVisibility(next.visibility);
      setTableColumns(next.tableColumns);
      setSavedTableColumns(next.tableColumns);
      setAllowedClientStages(next.allowedClientStages);
      setClientStageCatalog(next.clientStageCatalog);
      setSavedAllowedClientStages(next.allowedClientStages);
      setSavedClientStageCatalog(next.clientStageCatalog);
      if (notify) toast.success('Submit to Client visibility saved');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not save Submit to Client visibility',
      );
      throw error;
    } finally {
      setSubmitSaving(false);
    }
  };

  const persistStages = async ({ notify }: { notify: boolean }) => {
    setStagesSaving(true);
    try {
      const next = await saveSubmitToClientVisibilityDefaults(
        parseSubmitToClientFieldVisibility(submitVisibility),
        { tableColumns: assignedTableColumns, allowedClientStages, clientStageCatalog },
      );
      setSubmitVisibility(next.visibility);
      setSavedSubmitVisibility(next.visibility);
      setTableColumns(next.tableColumns);
      setSavedTableColumns(next.tableColumns);
      setAllowedClientStages(next.allowedClientStages);
      setClientStageCatalog(next.clientStageCatalog);
      setSavedAllowedClientStages(next.allowedClientStages);
      setSavedClientStageCatalog(next.clientStageCatalog);
      if (notify) toast.success('Client stages saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save client stages');
      throw error;
    } finally {
      setStagesSaving(false);
    }
  };

  const toggleField = (field: JobPublicVisibilityField) => {
    const nextVisibility = toggleJobPublicFieldVisibility(current, field);
    const nextShowClient = field === 'client' ? nextVisibility.client !== false : showClientNamePublicly;
    if (field === 'client') {
      nextVisibility.client = nextShowClient;
    }
    setVisibility(nextVisibility);
    setShowClientNamePublicly(nextShowClient);
  };

  const toggleSubmitField = (field: SubmitToClientFieldId) => {
    const nextVisibility = toggleSubmitToClientFieldVisibility(
      parseSubmitToClientFieldVisibility(submitVisibility),
      field,
    );
    setSubmitVisibility(nextVisibility);
    setTableColumns(parseSubmitToClientTableColumns(tableColumns, nextVisibility));
  };

  const addTableColumn = (field: SubmitToClientFieldId) => {
    setTableColumns(parseSubmitToClientTableColumns([...assignedTableColumns, field], submitVisibility));
  };

  const removeTableColumn = (field: SubmitToClientFieldId) => {
    setTableColumns(assignedTableColumns.filter((id) => id !== field));
  };

  const moveTableColumn = useCallback(
    (fromIndex: number, toIndex: number) => {
      setTableColumns((current) => {
        const list = parseSubmitToClientTableColumns(current, submitVisibility);
        if (
          fromIndex === toIndex ||
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= list.length ||
          toIndex >= list.length
        ) {
          return current;
        }
        const next = [...list];
        const [moved] = next.splice(fromIndex, 1);
        if (!moved) return current;
        next.splice(toIndex, 0, moved);
        return next;
      });
    },
    [submitVisibility],
  );

  const handleSaveJobs = async () => {
    if (matchesSaved || saving) return;
    try {
      await persist(current, showClientNamePublicly, { notify: true });
    } catch {
      /* persist already toasts */
    }
  };

  const handleSaveSubmit = async () => {
    if (submitMatchesSaved || submitSaving) return;
    try {
      await persistSubmit({ notify: true });
    } catch {
      /* persistSubmit already toasts */
    }
  };

  const handleSaveStages = async () => {
    if (stagesMatchSaved || stagesSaving) return;
    try {
      await persistStages({ notify: true });
    } catch {
      /* persistStages already toasts */
    }
  };

  const handleSave = async () => {
    if (pageMatchesSaved || saving || submitSaving || stagesSaving) return;
    const jobsDirty = !matchesSaved;
    const submitDirty = !submitMatchesSaved || !stagesMatchSaved;
    try {
      if (jobsDirty) await persist(current, showClientNamePublicly, { notify: false });
      if (submitDirty) await persistSubmit({ notify: false });
      toast.success('Public Visibility saved');
    } catch {
      /* persist helpers already toast */
    }
  };

  return (
    <div className="space-y-6">
      <SettingsPageHero
        eyebrow="Jobs"
        title="Public job page defaults"
        description="Choose what jobs show on the public job page, Phase 1 portal, and social posts. These same defaults appear when you create a job — changing them here or on a job keeps both in sync."
        icon={<Eye className="h-3.5 w-3.5 text-indigo-200" />}
        stats={
          <div className="rounded-2xl border border-indigo-100/70 bg-white/90 px-4 py-3 backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-400">
              Hidden fields
            </p>
            <p className="mt-0.5 text-lg font-semibold text-slate-900">
              {hiddenCount}
              <span className="text-sm font-medium text-slate-400">
                {' '}
                / {JOB_PUBLIC_VISIBILITY_FIELDS.length}
              </span>
            </p>
          </div>
        }
        actions={
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={pageMatchesSaved || saving || submitSaving || stagesSaving || loading}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving || submitSaving || stagesSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {pageMatchesSaved ? 'Saved' : 'Save'}
          </button>
        }
      />

      <SettingsPanel
        title="Public Visibility"
        description="Show or hide each field on the public job page. Hidden fields stay inside HRYANTRA for your team. Click Save after you change fields."
        icon={<Eye className="h-4 w-4 text-indigo-600" />}
        actions={
          <button
            type="button"
            onClick={() => void handleSaveJobs()}
            disabled={matchesSaved || saving || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {matchesSaved ? 'Saved' : 'Save'}
          </button>
        }
      >
        {loading ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {JOB_PUBLIC_VISIBILITY_FIELDS.map((field) => (
              <div
                key={field}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
              >
                <span className="min-w-0 truncate text-sm font-medium text-slate-700">
                  {JOB_PUBLIC_VISIBILITY_FIELD_LABELS[field]}
                </span>
                <PublicVisibilityToggle
                  visible={current[field] !== false}
                  onToggle={() => toggleField(field)}
                />
              </div>
            ))}
          </div>
        )}
      </SettingsPanel>

      <SettingsPanel
        title="Submit to Client"
        description="Choose which candidate fields the client sees when you share a profile. Visible fields stay on the Visible tab; hide one and it moves to Hidden. Use Table to pick columns and their order. Hidden fields cannot be added to the table. Click Save after you change fields."
        icon={<Send className="h-4 w-4 text-indigo-600" />}
        actions={
          <button
            type="button"
            onClick={() => void handleSaveSubmit()}
            disabled={submitMatchesSaved || submitSaving || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {submitMatchesSaved ? 'Saved' : 'Save'}
          </button>
        }
      >
        {loading ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={`submit-skel-${index}`} className="h-12 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            <div
              role="tablist"
              aria-label="Submit to Client field visibility"
              className="grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={submitTab === 'visible'}
                onClick={() => setSubmitTab('visible')}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                  submitTab === 'visible'
                    ? 'bg-white text-emerald-800 shadow-sm ring-1 ring-emerald-200'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Eye className="h-4 w-4" />
                Visible
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                    submitTab === 'visible' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {submitVisibleCount}
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={submitTab === 'hidden'}
                onClick={() => setSubmitTab('hidden')}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                  submitTab === 'hidden'
                    ? 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-300'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <EyeOff className="h-4 w-4" />
                Hidden
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                    submitTab === 'hidden' ? 'bg-slate-200 text-slate-700' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {submitHiddenCount}
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={submitTab === 'table'}
                onClick={() => setSubmitTab('table')}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                  submitTab === 'table'
                    ? 'bg-white text-indigo-800 shadow-sm ring-1 ring-indigo-200'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Table2 className="h-4 w-4" />
                Table
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                    submitTab === 'table' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {assignedTableColumns.length}
                </span>
              </button>
            </div>

            {submitTab === 'table' ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">In the client table</h3>
                    <p className="text-xs text-slate-500">
                      This is the column order on the shared client page. Drag the grip to change sequence, or use the arrows.
                    </p>
                  </div>
                  {assignedTableColumns.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                      No table columns yet. Add a visible field from the list on the right.
                    </div>
                  ) : (
                    <DndProvider backend={HTML5Backend}>
                      <div className="space-y-2">
                        {assignedTableColumns.map((fieldId, index) => (
                          <SortableTableColumnRow
                            key={fieldId}
                            fieldId={fieldId}
                            index={index}
                            total={assignedTableColumns.length}
                            onMove={moveTableColumn}
                            onRemove={removeTableColumn}
                          />
                        ))}
                      </div>
                    </DndProvider>
                  )}
                </div>
                <div className="space-y-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Available visible fields</h3>
                    <p className="text-xs text-slate-500">
                      Hidden fields are not listed here. Make a field Visible first, then add it to the table.
                    </p>
                  </div>
                  {tableAvailableGroups.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                      {submitVisibleCount === 0
                        ? 'No visible fields. Open Visible and mark a field Visible to client.'
                        : 'Every visible field is already in the table.'}
                    </div>
                  ) : (
                    tableAvailableGroups.map((group) => (
                      <div key={group.id} className="space-y-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {group.title}
                        </h4>
                        <div className="space-y-2">
                          {group.fields.map((field) => (
                            <div
                              key={field.id}
                              className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                            >
                              <span className="min-w-0 truncate text-sm font-medium text-slate-700">
                                {field.label}
                              </span>
                              <button
                                type="button"
                                onClick={() => addTableColumn(field.id)}
                                className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Add
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : submitTabGroups.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                {submitTab === 'visible'
                  ? 'No visible fields. Open Hidden and mark a field Visible to client to move it here.'
                  : 'No hidden fields. Open Visible and mark a field Hidden from client to move it here.'}
              </div>
            ) : (
              submitTabGroups.map((group) => (
                <div key={group.id} className="space-y-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">{group.title}</h3>
                    {group.description ? (
                      <p className="text-xs text-slate-500">{group.description}</p>
                    ) : null}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {group.fields.map((field) => (
                      <div
                        key={field.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                      >
                        <span className="min-w-0 truncate text-sm font-medium text-slate-700">
                          {field.label}
                        </span>
                        <PublicVisibilityToggle
                          visible={submitVisibility[field.id] !== false}
                          onToggle={() => toggleSubmitField(field.id)}
                          visibleLabel="Visible to client"
                          hiddenLabel="Hidden from client"
                          titleVisible="This field is included when you submit a candidate to a client"
                          titleHidden="This field is hidden when you submit a candidate to a client"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </SettingsPanel>

      <SettingsPanel
        title="Stages shown to client"
        description="Pick which pipeline stages appear when Change stage is enabled on a Submit to Client link. These defaults apply automatically every time you generate a client preview."
        icon={<Layers className="h-4 w-4 text-indigo-600" />}
        actions={
          <button
            type="button"
            onClick={() => void handleSaveStages()}
            disabled={stagesMatchSaved || stagesSaving || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {stagesSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {stagesMatchSaved ? 'Saved' : 'Save'}
          </button>
        }
      >
        {loading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        ) : (
          <ClientPreviewStagesPicker
            allowedClientStages={allowedClientStages}
            clientStageCatalog={clientStageCatalog}
            disabled={stagesSaving}
            onChange={({ allowedClientStages: nextAllowed, clientStageCatalog: nextCatalog }) => {
              setAllowedClientStages(nextAllowed);
              setClientStageCatalog(nextCatalog);
            }}
          />
        )}
      </SettingsPanel>

      <SettingsPanel
        title="Submit to Client email templates"
        description="Create subject and body templates for client emails. The default template fills Gmail or Outlook compose when you share a preview link."
        icon={<Mail className="h-4 w-4 text-indigo-600" />}
      >
        <SubmitToClientMailTemplateSettings />
      </SettingsPanel>

      <SettingsPanel
        title="LinkedIn platforms & templates"
        description="LinkedIn is the live social platform for job posts. The selected template is also used on Create Job."
        icon={<Linkedin className="h-4 w-4 text-indigo-600" />}
      >
        <LinkedInPublishingDefaultsPanel variant="settings" />
      </SettingsPanel>
    </div>
  );
}
