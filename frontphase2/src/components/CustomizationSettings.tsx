import React from 'react';
import { Sliders, Sparkles, Clock } from 'lucide-react';

/**
 * Customization (branding, pipeline templates, custom fields, etc.) is on
 * the roadmap but not yet wired to any backend. Surface a "Coming soon"
 * placeholder so the tab is clickable and discoverable without showing
 * fake controls that would silently swallow user input.
 */
export function CustomizationSettings() {
  const upcoming = [
    'Branding & theme controls (primary colour, logo upload, light/dark mode)',
    'Custom fields per entity (candidates, jobs, clients, leads)',
    'Pipeline templates with drag-and-drop stage editing',
    'Email & document template editor with merge tags',
    'Tenant-level form / view layout customization',
  ];

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-blue-50/40 to-indigo-50/30 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 p-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-100 text-indigo-600">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Customization</h2>
            <p className="text-sm text-slate-500">
              Branding, custom fields, pipeline templates, and more.
            </p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700">
            <Clock className="h-3 w-3" />
            Coming soon
          </span>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                What you&apos;ll be able to do here
              </h3>
            </div>
            <ul className="mt-4 space-y-3">
              {upcoming.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-slate-700">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs text-slate-400">
              We&apos;re building this iteratively — controls will appear here as each
              feature ships, with no need for a settings rewrite on your end.
            </p>
          </div>

          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
            <h3 className="text-sm font-semibold text-slate-900">In the meantime</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Per-record customization (resume, notes, files, activity timestamps) is
              already available inside each Candidate, Job, Client, and Lead drawer.
              Tenant-wide customization will land on this tab.
            </p>
            <p className="mt-4 text-xs text-slate-400">
              Need a specific customization sooner? Reach out from the Help Center
              and we&apos;ll prioritize the request.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
