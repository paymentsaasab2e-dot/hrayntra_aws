import React from 'react';
import { Sliders, Sparkles, Clock } from 'lucide-react';
import { SettingsPageHero, SettingsPanel } from './settings/SettingsPageHero';

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
      <SettingsPageHero
        eyebrow="Customization"
        title="Make the workspace yours"
        description="Branding, custom fields, pipeline templates, and layout controls will land here as each feature ships."
        icon={<Sliders className="h-3.5 w-3.5 text-indigo-200" />}
        stats={
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-700">
            <Clock className="h-3 w-3" />
            Coming soon
          </span>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <SettingsPanel
          title="What you'll be able to do"
          icon={<Sparkles className="h-4 w-4 text-indigo-600" />}
        >
          <ul className="space-y-3">
            {upcoming.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-slate-700">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                <span className="leading-6">{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs text-slate-400">
            Controls will appear here as each feature ships — no settings rewrite required on your
            side.
          </p>
        </SettingsPanel>

        <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-6">
          <h3 className="text-sm font-semibold text-slate-900">In the meantime</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Per-record customization (resume, notes, files, activity) is already available inside
            Candidate, Job, Client, and Lead drawers. Tenant-wide customization will land on this
            tab.
          </p>
          <p className="mt-4 text-xs text-slate-400">
            Need something sooner? Reach out from the Help Center and we will prioritize the
            request.
          </p>
        </section>
      </div>
    </div>
  );
}
