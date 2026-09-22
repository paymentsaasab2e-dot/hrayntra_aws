'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  RefreshCw,
  Search,
  Ticket,
  UserRound,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { HqModulePageLayout } from '@/components/hq/HqModulePageLayout';
import {
  apiHqAccountSupportImpersonateEmployee,
  apiHqAccountSupportImpersonateEmployer,
  apiHqAccountSupportLookup,
  apiHqAccountSupportRegeneratePassword,
  type HqAccountSupportLookup,
} from '@/lib/api';

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/80 bg-white/75 p-4 shadow-[0_1px_0_rgba(255,255,255,0.85)_inset,0_18px_48px_-24px_rgba(15,23,42,0.16)] backdrop-blur-xl sm:p-5 ${className}`}
    >
      {children}
    </div>
  );
}

function StatusPill({
  ok,
  label,
  detail,
}: {
  ok: boolean | null | undefined;
  label: string;
  detail?: string | null;
}) {
  const tone =
    ok === true
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : ok === false
        ? 'border-rose-200 bg-rose-50 text-rose-800'
        : 'border-slate-200 bg-slate-50 text-slate-600';
  const Icon = ok === true ? CheckCircle2 : ok === false ? XCircle : Search;
  return (
    <div className={`rounded-xl border px-3 py-3 ${tone}`}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 shrink-0" />
        {label}
      </div>
      {detail ? <p className="mt-1 text-[11px] opacity-80">{detail}</p> : null}
    </div>
  );
}

function formatWhen(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export default function HqAccountSupportPage() {
  const searchParams = useSearchParams();
  const initialQuery = useMemo(() => {
    return (
      searchParams.get('email') ||
      searchParams.get('customerId') ||
      searchParams.get('tenantDbName') ||
      searchParams.get('q') ||
      ''
    );
  }, [searchParams]);

  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [loggingInAs, setLoggingInAs] = useState<'employer' | 'employee' | null>(null);
  const [showHiddenTools, setShowHiddenTools] = useState(false);
  const [result, setResult] = useState<HqAccountSupportLookup | null>(null);

  const employer = result?.employer || (result?.accountKind !== 'employee' && result?.exists ? result : null);
  const employee = result?.employee || null;

  const runLookup = useCallback(async (raw: string) => {
    const value = String(raw || '').trim();
    if (!value) {
      toast.error('Enter an email or customer / tenant ID');
      return;
    }
    setLoading(true);
    try {
      const isEmail = value.includes('@');
      const res = await apiHqAccountSupportLookup(
        isEmail
          ? { email: value }
          : { customerId: value, tenantDbName: value, q: value },
      );
      setResult(res.data);
      if (!res.data?.exists) {
        toast.message('No entrepreneur or job-portal account found');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lookup failed';
      toast.error(message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQuery.trim()) {
      setQuery(initialQuery);
      void runLookup(initialQuery);
    }
  }, [initialQuery, runLookup]);

  const onRegenerate = async () => {
    if (!employer?.email) return;
    setRegenerating(true);
    try {
      const res = await apiHqAccountSupportRegeneratePassword({
        email: employer.email,
        customerId: employer.customerId || undefined,
        tenantDbName: employer.tenantDbName || undefined,
      });
      if (res.data?.credentialEmailSent) {
        toast.success('New password emailed to the entrepreneur');
      } else {
        toast.warning(
          res.data?.credentialEmailError ||
            'Password regenerated, but the email could not be sent',
        );
      }
      await runLookup(employer.email);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not regenerate password';
      toast.error(message);
    } finally {
      setRegenerating(false);
    }
  };

  const loginAsEmployer = async () => {
    if (!employer?.email) return;
    setLoggingInAs('employer');
    try {
      const res = await apiHqAccountSupportImpersonateEmployer({ email: employer.email });
      const data = res.data;
      if (!data?.token) throw new Error('Unable to create entrepreneur login link');
      const loginUrl =
        data.loginUrl ||
        `${window.location.origin}/login#hqImpersonation=${encodeURIComponent(data.token)}`;
      window.open(loginUrl, '_blank', 'noopener,noreferrer');
      toast.success(`Opened entrepreneur CRM as ${employer.email}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Entrepreneur login failed');
    } finally {
      setLoggingInAs(null);
    }
  };

  const loginAsEmployee = async () => {
    if (!employee?.candidateId && !employee?.email) return;
    setLoggingInAs('employee');
    try {
      const res = await apiHqAccountSupportImpersonateEmployee({
        email: employee.email || undefined,
        candidateId: employee.candidateId,
      });
      const loginUrl = res.data?.loginUrl;
      if (!loginUrl) throw new Error('Unable to create candidate login link');
      window.open(loginUrl, '_blank', 'noopener,noreferrer');
      toast.success(`Opened job portal as ${employee.name || employee.email}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Candidate login failed');
    } finally {
      setLoggingInAs(null);
    }
  };

  return (
    <HqModulePageLayout
      title="Account support"
      subtitle="Look up entrepreneur CRM or job-portal candidate accounts by email / customer ID — status, password, tickets, and direct login."
      icon={<KeyRound className="h-5 w-5" />}
    >
      <div className="space-y-4">
        <Panel>
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              void runLookup(query);
            }}
          >
            <label className="min-w-0 flex-1 text-sm">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Email or customer / tenant / candidate ID
              </span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onDoubleClick={() => setShowHiddenTools(true)}
                  placeholder="user@company.com or tenantDbName / candidateId"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </label>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Check status
            </button>
          </form>
          <p className="mt-2 text-[10px] text-slate-400">
            Tip: double-click the search box to reveal direct login tools.
          </p>
        </Panel>

        {result && !result.exists ? (
          <Panel>
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 h-5 w-5 text-rose-500" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Account does not exist</p>
                <p className="mt-1 text-xs text-slate-500">
                  No entrepreneur CRM or job-portal candidate matched{' '}
                  <span className="font-mono">
                    {result.query?.email || result.query?.customerId || query}
                  </span>
                  .
                </p>
              </div>
            </div>
          </Panel>
        ) : null}

        {employer?.exists || (employer && result?.exists && result.accountKind !== 'employee') ? (
          <Panel>
            <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-indigo-600">
              <UserRound className="h-3.5 w-3.5" />
              Entrepreneur · CRM
            </div>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  {employer?.organizationName || employer?.name || employer?.email}
                </p>
                <p className="mt-1 text-sm text-slate-600">{employer?.email}</p>
                <p className="mt-1 font-mono text-[11px] text-slate-400">
                  loginId · {employer?.loginId || '—'}
                  {employer?.customerId ? ` · customer · ${employer.customerId}` : ''}
                  {employer?.tenantDbName ? ` · tenant · ${employer.tenantDbName}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void onRegenerate()}
                disabled={regenerating || !employer?.email}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {regenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Regenerate password email
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatusPill ok label="Account exists" detail={`Status: ${employer?.status || 'ACTIVE'}`} />
              <StatusPill
                ok={employer?.passwordGenerated}
                label={employer?.passwordGenerated ? 'Password generated' : 'Password not generated'}
                detail={
                  employer?.tempPasswordPending
                    ? 'Still on temporary password'
                    : employer?.inviteSentAt
                      ? `Invite sent ${formatWhen(employer.inviteSentAt)}`
                      : null
                }
              />
              <StatusPill
                ok={employer?.hasLoggedInToCrm}
                label={employer?.hasLoggedInToCrm ? 'Logged into CRM' : 'Not logged into CRM yet'}
                detail={
                  employer?.lastLoginAt
                    ? `Last login ${formatWhen(employer.lastLoginAt)}`
                    : employer?.crmUserExists
                      ? 'CRM user exists but never logged in'
                      : 'CRM tenant user not found'
                }
              />
              <StatusPill
                ok={(employer?.ticketCount || 0) > 0}
                label={`${employer?.ticketCount || 0} related ticket${(employer?.ticketCount || 0) === 1 ? '' : 's'}`}
                detail="Entrepreneur help tickets"
              />
            </div>
          </Panel>
        ) : null}

        {employee ? (
          <Panel>
            <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
              <UserRound className="h-3.5 w-3.5" />
              Employee · Job portal candidate
            </div>
            <div className="mb-4">
              <p className="text-lg font-semibold text-slate-900">{employee.name || employee.email}</p>
              <p className="mt-1 text-sm text-slate-600">{employee.email}</p>
              <p className="mt-1 font-mono text-[11px] text-slate-400">
                candidateId · {employee.candidateId || '—'}
                {employee.isVerified ? ' · verified' : ' · not verified'}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatusPill ok label="Portal account exists" detail={`Status: ${employee.status || '—'}`} />
              <StatusPill
                ok={employee.passwordGenerated}
                label={employee.passwordGenerated ? 'Password generated' : 'Password not set'}
              />
              <StatusPill
                ok={employee.hasLoggedInToPortal}
                label={employee.hasLoggedInToPortal ? 'Logged into portal' : 'Never logged into portal'}
                detail={
                  employee.lastLoginAt ? `Last login ${formatWhen(employee.lastLoginAt)}` : null
                }
              />
              <StatusPill
                ok={(employee.ticketCount || 0) > 0}
                label={`${employee.ticketCount || 0} related ticket${(employee.ticketCount || 0) === 1 ? '' : 's'}`}
                detail="Employee help tickets"
              />
            </div>
          </Panel>
        ) : null}

        {/* Hidden HQ direct-login tools (double-click search to reveal) */}
        {showHiddenTools && result?.exists ? (
          <Panel className="border-dashed border-slate-300 bg-slate-50/70">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                HQ direct login
              </p>
              <button
                type="button"
                onClick={() => setShowHiddenTools(false)}
                className="text-[10px] font-medium text-slate-400 hover:text-slate-600"
              >
                Hide
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {employer?.email ? (
                <button
                  type="button"
                  onClick={() => void loginAsEmployer()}
                  disabled={loggingInAs === 'employer'}
                  className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 disabled:opacity-60"
                >
                  {loggingInAs === 'employer' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ExternalLink className="h-3.5 w-3.5" />
                  )}
                  Login as entrepreneur (CRM)
                </button>
              ) : null}
              {employee?.candidateId || employee?.email ? (
                <button
                  type="button"
                  onClick={() => void loginAsEmployee()}
                  disabled={loggingInAs === 'employee'}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                >
                  {loggingInAs === 'employee' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ExternalLink className="h-3.5 w-3.5" />
                  )}
                  Login as candidate (job portal)
                </button>
              ) : null}
            </div>
          </Panel>
        ) : null}

        {((employer?.relatedTickets || []).length > 0 ||
          (employee?.relatedTickets || []).length > 0) && (
          <Panel>
            <div className="mb-3 flex items-center gap-2">
              <Ticket className="h-4 w-4 text-rose-500" />
              <h3 className="text-sm font-semibold text-slate-800">Related tickets</h3>
            </div>
            <ul className="divide-y divide-slate-100">
              {[...(employer?.relatedTickets || []), ...(employee?.relatedTickets || [])].map(
                (ticket) => (
                  <li key={`${ticket.audience}-${ticket.id}`} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{ticket.subject}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                        {ticket.id} · {ticket.audience || 'ticket'} · {ticket.status} ·{' '}
                        {formatWhen(ticket.createdAt)}
                      </p>
                    </div>
                    <Link
                      href={`/hq/tickets?audience=${ticket.audience === 'employee' ? 'employee' : 'employer'}`}
                      className="shrink-0 text-xs font-semibold text-blue-700 hover:underline"
                    >
                      Open tickets
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </Panel>
        )}
      </div>
    </HqModulePageLayout>
  );
}
