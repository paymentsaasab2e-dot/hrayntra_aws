'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Eye, Loader2, Save } from 'lucide-react';
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
} from '../../lib/jobVisibilityUserDefaults';
import { SettingsPageHero, SettingsPanel } from './SettingsPageHero';

export function PublicVisibilitySettings() {
  const cached = readCachedJobVisibilityUserDefaults();
  const [visibility, setVisibility] = useState<JobPublicFieldVisibility>(cached.visibility);
  const [showClientNamePublicly, setShowClientNamePublicly] = useState(cached.showClient);
  const [savedVisibility, setSavedVisibility] = useState<JobPublicFieldVisibility>(cached.visibility);
  const [savedShowClient, setSavedShowClient] = useState(cached.showClient);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
    return () => {
      cancelled = true;
    };
  }, []);

  const matchesSaved = useMemo(
    () =>
      jobVisibilityDefaultsEqual(current, savedVisibility, showClientNamePublicly, savedShowClient),
    [current, savedVisibility, showClientNamePublicly, savedShowClient],
  );

  const hiddenCount = useMemo(
    () => JOB_PUBLIC_VISIBILITY_FIELDS.filter((field) => current[field] === false).length,
    [current],
  );

  const toggleField = (field: JobPublicVisibilityField) => {
    const nextVisibility = toggleJobPublicFieldVisibility(current, field);
    const nextShowClient = field === 'client' ? nextVisibility.client !== false : showClientNamePublicly;
    if (field === 'client') {
      nextVisibility.client = nextShowClient;
    }
    setVisibility(nextVisibility);
    setShowClientNamePublicly(nextShowClient);
  };

  const handleSave = async () => {
    if (matchesSaved || saving) return;
    setSaving(true);
    try {
      const next = await saveJobVisibilityUserDefaults(current, showClientNamePublicly);
      setSavedVisibility(next.visibility);
      setSavedShowClient(next.showClient);
      setVisibility(next.visibility);
      setShowClientNamePublicly(next.showClient);
      toast.success('Public Visibility defaults saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save Public Visibility defaults');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsPageHero
        eyebrow="Jobs"
        title="Public job page defaults"
        description="Choose what new jobs show on the public job page, Phase 1 portal, and social posts. These defaults apply when you create a job; you can still change them on a single job."
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
            disabled={matchesSaved || saving || loading}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {matchesSaved ? 'Saved' : 'Save defaults'}
          </button>
        }
      />

      <SettingsPanel
        title="Public Visibility"
        description="Show or hide each field on the public job page. Hidden fields stay inside HRYANTRA for your team."
        icon={<Eye className="h-4 w-4 text-indigo-600" />}
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
    </div>
  );
}
