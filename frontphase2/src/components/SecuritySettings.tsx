import React from 'react';
import { ShieldAlert, History, Clock, KeyRound, Database, Lock } from 'lucide-react';

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
      <div className="peer peer-checked:bg-indigo-300 peer-focus:outline-none after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white h-6 w-11 rounded-full bg-slate-200" />
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
      <div className="peer peer-checked:bg-[#2b7fff]/40 peer-focus:outline-none after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white h-5 w-9 rounded-full bg-slate-200" />
    </label>
  );
}

export function SecuritySettings() {
  return (
    <div className="space-y-6">
      {/* Data Management — backups card only; Import/Export removed because
          every primary tab (Candidates / Jobs / Clients / Leads) already
          exposes its own import flow, so a generic admin-level Import here
          was redundant and confusing. */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-100 p-6">
          <Database className="h-5 w-5 text-indigo-500" />
          <h2 className="text-lg font-semibold text-slate-900">Data Management</h2>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200">
                <Clock className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="flex items-center text-sm font-medium text-slate-900">
                  Automated Backups
                  <ComingSoonBadge />
                </p>
                <p className="text-xs text-slate-500">
                  Daily encrypted backups of all recruitment data. We&apos;ll enable this once the
                  scheduled-backup service is live.
                </p>
              </div>
            </div>
            <DisabledToggle defaultChecked />
          </div>
        </div>
      </div>

      {/* Security & Access — none of these are wired to the backend yet,
          so each control is shown disabled with a "Coming soon" badge to
          set the right expectation. */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-100 p-6">
          <ShieldAlert className="h-5 w-5 text-rose-500" />
          <h2 className="text-lg font-semibold text-slate-900">Security &amp; Access</h2>
        </div>
        <div className="space-y-6 p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-900">
                    Two-Factor Auth (2FA)
                  </span>
                  <ComingSoonBadge />
                </div>
                <DisabledMiniToggle />
              </div>
              <p className="text-xs text-slate-500">
                Add an extra layer of security to all team accounts.
              </p>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-900">Audit Logs</span>
                  <ComingSoonBadge />
                </div>
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed text-xs font-medium text-slate-400"
                  title="Audit log viewer is not yet available"
                >
                  View Logs
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Track all administrative changes and sensitive operations.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 pt-2 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="flex items-center text-sm font-medium text-slate-700">
                <Lock className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
                Password Policy
                <ComingSoonBadge />
              </label>
              <select
                disabled
                className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
              >
                <option>Standard (Min 8 chars)</option>
                <option>Strict (Uppercase, Special Char)</option>
                <option>Enterprise (Min 12 chars, No common words)</option>
              </select>
              <p className="text-[11px] text-slate-400">
                Until policy enforcement is wired in, all accounts use the standard 8-character
                minimum baked into the auth service.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center text-sm font-medium text-slate-700">
                <Database className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
                Data Retention Period
                <ComingSoonBadge />
              </label>
              <select
                disabled
                className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
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
        </div>
      </div>
    </div>
  );
}
