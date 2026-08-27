import React from 'react';
import { ShieldAlert, History, Clock, KeyRound, Database, Lock } from 'lucide-react';
import { SettingsPageHero, SettingsPanel } from './settings/SettingsPageHero';

/**
 * Visual badge for features that aren't wired to the backend yet so the UI
 * doesn't lie to admins. Pair with `disabled`/`pointer-events-none` controls.
 */
function ComingSoonBadge() {
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
      <Clock className="h-3 w-3" />
      Coming soon
    </span>
  );
}

function DisabledToggle({ defaultChecked = false }: { defaultChecked?: boolean }) {
  return (
    <label
      className="relative inline-flex cursor-not-allowed items-center opacity-60"
      title="This control will be available in a future release"
    >
      <input
        type="checkbox"
        className="peer sr-only"
        defaultChecked={defaultChecked}
        disabled
      />
      <div className="peer peer-checked:bg-slate-400 peer-focus:outline-none after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white h-6 w-11 rounded-full bg-slate-200" />
    </label>
  );
}

function DisabledMiniToggle({ defaultChecked = false }: { defaultChecked?: boolean }) {
  return (
    <label
      className="relative inline-flex cursor-not-allowed items-center opacity-60"
      title="This control will be available in a future release"
    >
      <input
        type="checkbox"
        className="peer sr-only"
        defaultChecked={defaultChecked}
        disabled
      />
      <div className="peer peer-checked:bg-slate-400 peer-focus:outline-none after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white h-5 w-9 rounded-full bg-slate-200" />
    </label>
  );
}

export function SecuritySettings() {
  return (
    <div className="space-y-6">
      <SettingsPageHero
        eyebrow="Security"
        title="Data & security controls"
        description="Backups, access policies, and retention settings for your workspace. Some controls are still rolling out."
        icon={<Lock className="h-3.5 w-3.5 text-indigo-200" />}
      />

      <SettingsPanel
        title="Data management"
        description="Backup and retention options for recruitment data."
        icon={<Database className="h-4 w-4 text-indigo-600" />}
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white ring-1 ring-slate-200">
                <Clock className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="flex flex-wrap items-center text-sm font-semibold text-slate-900">
                  Automated backups
                  <ComingSoonBadge />
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Daily encrypted backups of recruitment data once the scheduled-backup service is
                  live.
                </p>
              </div>
            </div>
            <DisabledToggle defaultChecked />
          </div>
        </div>
      </SettingsPanel>

      <SettingsPanel
        title="Security & access"
        description="Authentication and audit controls for your team."
        icon={<ShieldAlert className="h-4 w-4 text-rose-500" />}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-900">Two-factor auth (2FA)</span>
                <ComingSoonBadge />
              </div>
              <DisabledMiniToggle />
            </div>
            <p className="text-xs leading-5 text-slate-500">
              Add an extra layer of security to all team accounts.
            </p>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-900">Audit logs</span>
                <ComingSoonBadge />
              </div>
              <button
                type="button"
                disabled
                className="cursor-not-allowed text-xs font-medium text-slate-400"
                title="Audit log viewer is not yet available"
              >
                View logs
              </button>
            </div>
            <p className="text-xs leading-5 text-slate-500">
              Track administrative changes and sensitive operations.
            </p>
          </div>

          <div className="space-y-1.5 rounded-2xl border border-slate-200 p-4">
            <label className="flex flex-wrap items-center text-sm font-medium text-slate-700">
              <Lock className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
              Password policy
              <ComingSoonBadge />
            </label>
            <select
              disabled
              className="mt-2 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
            >
              <option>Standard (Min 8 chars)</option>
              <option>Strict (Uppercase, Special Char)</option>
              <option>Enterprise (Min 12 chars, No common words)</option>
            </select>
            <p className="text-[11px] text-slate-400">
              Accounts currently use the standard 8-character minimum in auth.
            </p>
          </div>

          <div className="space-y-1.5 rounded-2xl border border-slate-200 p-4">
            <label className="flex flex-wrap items-center text-sm font-medium text-slate-700">
              <Database className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
              Data retention period
              <ComingSoonBadge />
            </label>
            <select
              disabled
              className="mt-2 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
            >
              <option>1 Year</option>
              <option>3 Years</option>
              <option>7 Years (Compliance standard)</option>
              <option>Indefinite</option>
            </select>
            <p className="text-[11px] text-slate-400">
              Records are kept indefinitely today; configurable retention is on the roadmap.
            </p>
          </div>
        </div>
      </SettingsPanel>
    </div>
  );
}
