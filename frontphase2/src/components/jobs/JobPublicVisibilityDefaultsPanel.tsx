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
  subscribeJobVisibilityDefaultsChanged,
  type JobVisibilityUserDefaults,
} from '../../lib/jobVisibilityUserDefaults';

function defaultsToForm(defaults: JobVisibilityUserDefaults) {
  return {
    publicFieldVisibility: defaults.visibility,
    showClientNamePublicly: defaults.showClient,
  };
}

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
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const currentRef = useRef({ visibility: current, showClient: showClientNamePublicly });
  currentRef.current = { visibility: current, showClient: showClientNamePublicly };
  const skipStaleRemoteRef = useRef(false);

  const applySharedDefaults = (defaults: JobVisibilityUserDefaults) => {
    setSaved(defaults);
    if (
      jobVisibilityDefaultsEqual(
        currentRef.current.visibility,
        defaults.visibility,
        currentRef.current.showClient,
        defaults.showClient,
      )
    ) {
      return;
    }
    onChangeRef.current(defaultsToForm(defaults));
  };

  useEffect(() => {
    let cancelled = false;
    void loadJobVisibilityUserDefaults().then((defaults) => {
      if (cancelled || skipStaleRemoteRef.current) return;
      applySharedDefaults(defaults);
    });
    const unsubscribe = subscribeJobVisibilityDefaultsChanged((defaults) => {
      applySharedDefaults(defaults);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
    // Load once on mount; parent onChange is kept via ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const matchesSaved = useMemo(
    () =>
      jobVisibilityDefaultsEqual(current, saved.visibility, showClientNamePublicly, saved.showClient),
    [current, saved, showClientNamePublicly],
  );
  const canSave = !matchesSaved;

  const persistDefaults = (
    nextVisibility: JobPublicFieldVisibility,
    nextShowClient: boolean,
    { notify }: { notify: boolean },
  ) => {
    try {
      skipStaleRemoteRef.current = true;
      const next = saveJobVisibilityUserDefaults(nextVisibility, nextShowClient);
      setSaved(next);
      if (notify) {
        void requestCornerAlert('Defaults saved.', { tone: 'success', autoCloseMs: 1600, priority: 'high' });
      }
    } catch (error) {
      void requestError(error instanceof Error ? error.message : 'Could not save your default visibility.');
    }
  };

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
    persistDefaults(nextVisibility, nextShowClient, { notify: false });
  };

  const handleSaveDefaults = () => {
    if (!canSave) return;
    persistDefaults(current, showClientNamePublicly, { notify: true });
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
            Same defaults as Settings → Public Visibility. Changes here are saved for every new job
            and for the public job page.
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
