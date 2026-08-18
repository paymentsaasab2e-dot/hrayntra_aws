'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Sidenav } from '../../components/Sidenav';
import { PortalStatusCard } from '../../components/status/PortalStatusCard';
import { AccessDenied } from '../../components/AccessDenied';
import { TenantPausedModal } from '../../components/tenant/TenantPausedModal';
import { TrialExpiredPurchaseModal } from '../../components/trial/TrialExpiredPurchaseModal';
import {
  CONNECTION_STATUS,
  EMPLOYER_PORTAL_STATUS,
  PORTAL_STATUS_CATALOG,
} from '../../lib/portalStatusCopy';

export default function StatusScreensPage() {
  const [pausedOpen, setPausedOpen] = useState(false);
  const [trialOpen, setTrialOpen] = useState(false);

  const fireToast = (copy: { title: string; message: string }) => {
    toast.error(copy.title, { description: copy.message });
  };

  return (
    <div className="min-h-screen font-['Arimo',sans-serif]">
      <Sidenav>
        <div className="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
          <header>
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">Portal status catalog</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Status screens and alerts</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Title plus short message for connection delays, Job Portal, and Employer Portal. No status
              codes. Use the toast buttons to preview network alerts.
            </p>
          </header>

          <section className="rounded-2xl border border-sky-100 bg-sky-50/60 p-5">
            <h2 className="text-sm font-bold text-slate-900">Live network toasts</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  ['Slow', CONNECTION_STATUS.slow],
                  ['Failed', CONNECTION_STATUS.failed],
                  ['Timeout', CONNECTION_STATUS.timeout],
                  ['Offline', CONNECTION_STATUS.offline],
                  ['Too many requests', CONNECTION_STATUS.rateLimit],
                ] as const
              ).map(([label, copy]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => fireToast(copy)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPausedOpen(true)}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
              >
                Open workspace paused
              </button>
              <button
                type="button"
                onClick={() => setTrialOpen(true)}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900"
              >
                Open trial ended
              </button>
            </div>
          </section>

          {PORTAL_STATUS_CATALOG.map((group) => (
            <section key={group.heading}>
              <h2 className="mb-4 text-lg font-bold text-slate-900">{group.heading}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.items.map((item) => (
                  <PortalStatusCard
                    key={item.id}
                    trigger={item.trigger}
                    title={item.copy.title}
                    message={item.copy.message}
                  />
                ))}
              </div>
            </section>
          ))}

          <section>
            <h2 className="mb-4 text-lg font-bold text-slate-900">Employer components (live layout)</h2>
            <div className="space-y-4">
              <AccessDenied />
              <AccessDenied
                title={EMPLOYER_PORTAL_STATUS.hqModuleOff.title}
                message={EMPLOYER_PORTAL_STATUS.hqModuleOff.message}
              />
            </div>
          </section>
        </div>
      </Sidenav>

      <TenantPausedModal open={pausedOpen} />
      {pausedOpen ? (
        <button
          type="button"
          onClick={() => setPausedOpen(false)}
          className="fixed bottom-6 right-6 z-[20001] rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-lg"
        >
          Close paused preview
        </button>
      ) : null}

      <TrialExpiredPurchaseModal open={trialOpen} plan={null} onDismiss={() => setTrialOpen(false)} />
    </div>
  );
}
