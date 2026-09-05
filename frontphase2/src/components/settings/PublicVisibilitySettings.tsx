'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Linkedin, Loader2, Save, Send } from 'lucide-react';
import { toast } from 'sonner';
import { PublicVisibilityToggle } from '../forms/PublicVisibilityToggle';
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
  SUBMIT_TO_CLIENT_FIELD_GROUPS,
  SUBMIT_TO_CLIENT_FIELDS,
  submitToClientFieldVisibilityEqual,
  toggleSubmitToClientFieldVisibility,
  type SubmitToClientFieldId,
  type SubmitToClientFieldVisibility,
} from '../../lib/submitToClientFieldVisibility';
import {
  loadSubmitToClientVisibilityDefaults,
  readCachedSubmitToClientVisibilityDefaults,
  saveSubmitToClientVisibilityDefaults,
  subscribeSubmitToClientVisibilityDefaultsChanged,
} from '../../lib/submitToClientFieldVisibilityDefaults';
import { SettingsPageHero, SettingsPanel } from './SettingsPageHero';
import { LinkedInPublishingDefaultsPanel } from '../jobs/LinkedInPublishingDefaultsPanel';

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitSaving, setSubmitSaving] = useState(false);
  const [submitTab, setSubmitTab] = useState<'visible' | 'hidden'>('visible');

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
    });
    const unsubscribeSubmit = subscribeSubmitToClientVisibilityDefaultsChanged((defaults) => {
      if (cancelled) return;
      setSavedSubmitVisibility(defaults.visibility);
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
    () => submitToClientFieldVisibilityEqual(submitVisibility, savedSubmitVisibility),
    [submitVisibility, savedSubmitVisibility],
  );

  const pageMatchesSaved = matchesSaved && submitMatchesSaved;

  const hiddenCount = useMemo(
    () => JOB_PUBLIC_VISIBILITY_FIELDS.filter((field) => current[field] === false).length,
    [current],
  );

  const submitHiddenCount = useMemo(
    () => hiddenSubmitToClientFieldCount(submitVisibility),
    [submitVisibility],
  );

  const submitVisibleCount = SUBMIT_TO_CLIENT_FIELDS.length - submitHiddenCount;

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
      );
      setSubmitVisibility(next.visibility);
      setSavedSubmitVisibility(next.visibility);
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
    setSubmitVisibility(
      toggleSubmitToClientFieldVisibility(
        parseSubmitToClientFieldVisibility(submitVisibility),
        field,
      ),
    );
  };

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

  const handleSave = async () => {
    if (pageMatchesSaved || saving || submitSaving) return;
    const jobsDirty = !matchesSaved;
    const submitDirty = !submitMatchesSaved;
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
            disabled={pageMatchesSaved || saving || submitSaving || loading}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving || submitSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
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
        description="Choose which candidate fields the client sees when you share a profile. Visible fields stay on the Visible tab; hide one and it moves to Hidden. Click Save after you change fields."
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
              className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1"
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
            </div>

            {submitTabGroups.length === 0 ? (
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
        title="LinkedIn platforms & templates"
        description="LinkedIn is the live social platform for job posts. The selected template is also used on Create Job."
        icon={<Linkedin className="h-4 w-4 text-indigo-600" />}
      >
        <LinkedInPublishingDefaultsPanel variant="settings" />
      </SettingsPanel>
    </div>
  );
}
