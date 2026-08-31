'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, Save } from 'lucide-react';
import { PublicVisibilityToggle } from '../forms/PublicVisibilityToggle';
import { requestCornerAlert, requestError } from '../../lib/appDialog';
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
  saveJobVisibilityUserDefaultsLocal,
  type JobVisibilityUserDefaults,
} from '../../lib/jobVisibilityUserDefaults';

export function JobPublicVisibilityDefaultsPanel({
  visibility,
  showClientNamePublicly,
  onChange,
}: {
  visibility: JobPublicFieldVisibility;
  showClientNamePublicly: boolean;
  onChange: (next: { publicFieldVisibility: JobPublicFieldVisibility; showClientNamePublicly: boolean }) => void;
}) {
  const current = mergeClientVisibility(parseJobPublicFieldVisibility(visibility), showClientNamePublicly);
  const [saved, setSaved] = useState<JobVisibilityUserDefaults>(() => readCachedJobVisibilityUserDefaults());
  const skipRemoteOverwriteRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadJobVisibilityUserDefaults().then((defaults) => {
      if (cancelled || skipRemoteOverwriteRef.current) return;
      setSaved(defaults);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const matchesSaved = useMemo(
    () =>
      jobVisibilityDefaultsEqual(current, saved.visibility, showClientNamePublicly, saved.showClient),
    [current, saved, showClientNamePublicly],
  );
  const canSave = !matchesSaved;

  const toggleField = (field: JobPublicVisibilityField) => {
    const nextVisibility = toggleJobPublicFieldVisibility(current, field);
    const nextShowClient = field === 'client' ? nextVisibility.client !== false : showClientNamePublicly;
    if (field === 'client') {
      nextVisibility.client = nextShowClient;
    }
    onChange({
      publicFieldVisibility: nextVisibility,
      showClientNamePublicly: nextShowClient,
    });
  };

  const handleSaveDefaults = () => {
    if (!canSave) return;
    try {
      const next = saveJobVisibilityUserDefaultsLocal(current, showClientNamePublicly);
      skipRemoteOverwriteRef.current = true;
      setSaved(next);
      void saveJobVisibilityUserDefaults(current, showClientNamePublicly);
      void requestCornerAlert('Defaults saved.', { tone: 'success', autoCloseMs: 1600, priority: 'high' });
    } catch (error) {
      void requestError(error instanceof Error ? error.message : 'Could not save your default visibility.');
    }
  };

  return (
    <div className="rounded-2xl border border-[#2098C8]/25 bg-gradient-to-br from-[#E8F6FC]/70 via-white to-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Eye className="h-4 w-4 text-[#2098C8]" />
            Public Visibility
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Choose what to show or hide on the public job page. Defaults are already saved — the save
            button turns on only after you change a setting.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSaveDefaults}
          disabled={!canSave}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#2098C8] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1A86B3] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:opacity-100"
        >
          <Save className="h-3.5 w-3.5" />
          {matchesSaved ? 'Saved' : 'Save defaults'}
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {JOB_PUBLIC_VISIBILITY_FIELDS.map((field) => (
          <div
            key={field}
            className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"
          >
            <span className="min-w-0 truncate text-xs font-medium text-slate-700">
              {JOB_PUBLIC_VISIBILITY_FIELD_LABELS[field]}
            </span>
            <PublicVisibilityToggle
              visible={current[field] !== false}
              onToggle={() => toggleField(field)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
