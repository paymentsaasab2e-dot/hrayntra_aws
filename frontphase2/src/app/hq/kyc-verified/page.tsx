'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Loader2, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import {
  HqModulePageLayout,
  HQ_TABLE_BODY_SCROLL_CLASS,
  HQ_TABLE_CARD_CLASS,
  HQ_TOOLBAR_ROW_CLASS,
} from '@/components/hq/HqModulePageLayout';
import { HqPrimaryButton, HqSecondaryButton, HqStatCard } from '@/components/hq/hqUi';
import {
  apiHqListKycInterviewers,
  apiHqRejectKycInterviewer,
  apiHqVerifyKycInterviewer,
  type HqKycInterviewerRow,
} from '@/lib/api';

type KindFilter = 'all' | 'applicant' | 'interviewer';

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function listText(value: string[] | string | null | undefined) {
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item || '').trim()).filter(Boolean);
    return items.length ? items.join(', ') : '—';
  }
  const text = String(value || '').trim();
  return text || '—';
}

function asHref(value: string | null | undefined) {
  const url = String(value || '').trim();
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url.replace(/^\/+/, '')}`;
}

function rowKind(row: HqKycInterviewerRow): 'applicant' | 'interviewer' {
  if (String(row.applicationStatus || '').toUpperCase() === 'REJECTED') return 'applicant';
  return row.kind === 'interviewer' || row.hqVerified ? 'interviewer' : 'applicant';
}

function FormField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <div className="mt-1 whitespace-pre-wrap text-sm font-medium text-slate-900">{value || '—'}</div>
    </div>
  );
}

function ViewApplicationModal({
  row,
  verifying,
  rejecting,
  rejectNotes,
  onRejectNotes,
  onClose,
  onVerify,
  onReject,
}: {
  row: HqKycInterviewerRow;
  verifying: boolean;
  rejecting: boolean;
  rejectNotes: string;
  onRejectNotes: (value: string) => void;
  onClose: () => void;
  onVerify: () => void;
  onReject: () => void;
}) {
  const kind = rowKind(row);
  const rejected = String(row.applicationStatus || '').toUpperCase() === 'REJECTED';
  const alreadyVerified = Boolean(row.hqVerified || row.liveForCandidates);
  const linkedinHref = asHref(row.linkedinUrl);
  const resumeHref = asHref(row.resumeUrl);
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-label="Close" />
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Become Interviewer form</h3>
            <p className="mt-0.5 text-sm text-slate-500">
              {row.name} · {kind === 'interviewer' ? 'Interviewer' : 'Applicant'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {row.profilePhotoUrl ? (
            <img
              src={row.profilePhotoUrl}
              alt={row.name}
              className="mb-4 h-20 w-20 rounded-xl object-cover ring-1 ring-slate-200"
            />
          ) : null}

          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Application</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <FormField label="Full name" value={row.name} />
            <FormField label="Email" value={row.email || '—'} />
            <FormField label="Phone" value={row.phone || '—'} />
            <FormField label="Current role" value={row.currentRole || '—'} />
            <FormField label="Current company" value={row.currentCompany || '—'} />
            <FormField label="Years of experience" value={String(row.yearsOfExperience || 0)} />
            <FormField label="Interview price (tokens)" value={String(row.interviewPrice || 0)} />
            <FormField label="Application status" value={row.applicationStatus || '—'} />
            <FormField label="Expertise areas" value={listText(row.expertiseAreas)} />
            <FormField label="Interview types" value={listText(row.interviewTypes)} />
            <FormField label="Languages" value={listText(row.languages)} />
            <FormField label="Weekly availability" value={row.weeklyAvailability || '—'} />
            <div className="sm:col-span-2">
              <FormField label="About yourself" value={row.aboutYourself || '—'} />
            </div>
            <div className="sm:col-span-2">
              <FormField label="Feedback style" value={row.feedbackStyle || '—'} />
            </div>
            <FormField
              label="LinkedIn"
              value={
                linkedinHref ? (
                  <a href={linkedinHref} target="_blank" rel="noreferrer" className="text-teal-700 underline">
                    {row.linkedinUrl}
                  </a>
                ) : (
                  '—'
                )
              }
            />
            <FormField
              label="Resume"
              value={
                resumeHref ? (
                  <a href={resumeHref} target="_blank" rel="noreferrer" className="text-teal-700 underline">
                    Open resume
                  </a>
                ) : (
                  '—'
                )
              }
            />
            <FormField label="Submitted" value={formatDate(row.createdAt)} />
            <FormField label="Updated" value={formatDate(row.updatedAt)} />
          </div>

          <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-slate-400">KYC / identity</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <FormField label="KYC status" value={row.kycVerified ? 'Verified' : 'Unverified'} />
            <FormField label="Date of birth" value={formatDate(row.dateOfBirth)} />
            <FormField label="Passport / ID" value={row.passportNumber || '—'} />
            <FormField
              label="Missing KYC fields"
              value={row.kycVerified ? 'None' : listText(row.kycMissing)}
            />
          </div>

          {rejected ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
              Rejected{row.reviewNotes ? `: ${row.reviewNotes}` : '. Waiting for the applicant to send this form for re-verification.'}
            </div>
          ) : (
            <label className="mt-4 block text-xs font-semibold text-slate-600">
              Reject reason (optional)
              <textarea
                value={rejectNotes}
                onChange={(e) => onRejectNotes(e.target.value)}
                rows={2}
                placeholder="Tell the applicant what to fix before they send it for re-verification"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
              />
            </label>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <HqSecondaryButton onClick={onClose}>Close</HqSecondaryButton>
          {rejected ? (
            <span className="text-sm font-semibold text-rose-700">Rejected — waiting for resubmit</span>
          ) : (
            <>
              <button
                type="button"
                onClick={onReject}
                disabled={rejecting || verifying}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-60"
              >
                {rejecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Reject
              </button>
              {alreadyVerified ? (
                <span className="text-sm font-semibold text-emerald-700">Already verified</span>
              ) : (
                <HqPrimaryButton onClick={onVerify} loading={verifying} disabled={verifying || rejecting}>
                  Verify
                </HqPrimaryButton>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HqKycVerifiedPage() {
  const [rows, setRows] = useState<HqKycInterviewerRow[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    applicants: 0,
    interviewers: 0,
    kycVerified: 0,
    pendingHqVerify: 0,
    liveForCandidates: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [viewing, setViewing] = useState<HqKycInterviewerRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiHqListKycInterviewers();
      const data = res.data;
      const list = Array.isArray(data?.interviewers) ? data.interviewers : [];
      setRows(list);
      setStats({
        total: data?.stats?.total ?? list.length,
        applicants:
          data?.stats?.applicants ?? list.filter((row) => rowKind(row) === 'applicant').length,
        interviewers:
          data?.stats?.interviewers ?? list.filter((row) => rowKind(row) === 'interviewer').length,
        kycVerified: data?.stats?.kycVerified ?? list.filter((row) => row.kycVerified).length,
        pendingHqVerify: data?.stats?.pendingHqVerify ?? 0,
        liveForCandidates: data?.stats?.liveForCandidates ?? 0,
      });
      setViewing((current) => (current ? list.find((row) => row.id === current.id) || current : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load applicants and interviewers');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (kindFilter !== 'all' && rowKind(row) !== kindFilter) return false;
      if (!q) return true;
      return [row.name, row.email, row.phone, row.currentRole, row.currentCompany, row.applicationStatus, rowKind(row)]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [rows, search, kindFilter]);

  const verify = async (id: string) => {
    setVerifyingId(id);
    setError('');
    try {
      await apiHqVerifyKycInterviewer(id);
      await load();
      setViewing((current) => (current?.id === id ? null : current));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify interviewer');
    } finally {
      setVerifyingId(null);
    }
  };

  const reject = async (id: string, notes?: string) => {
    setRejectingId(id);
    setError('');
    try {
      await apiHqRejectKycInterviewer(id, notes || rejectNotes);
      await load();
      setViewing(null);
      setRejectNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject interviewer');
    } finally {
      setRejectingId(null);
    }
  };

  const tabs: Array<{ id: KindFilter; label: string; count: number }> = [
    { id: 'all', label: 'All', count: stats.total },
    { id: 'applicant', label: 'Applicants', count: stats.applicants },
    { id: 'interviewer', label: 'Interviewers', count: stats.interviewers },
  ];

  return (
    <HqModulePageLayout
      title="KYC verified"
      subtitle="Open each filled Become Interviewer form, then Verify to approve them."
      icon={<ShieldCheck className="h-5 w-5" />}
      actions={
        <HqSecondaryButton onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </HqSecondaryButton>
      }
    >
      <div className="mb-5 grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <HqStatCard label="All" value={stats.total} active={kindFilter === 'all'} />
        <HqStatCard label="Applicants" value={stats.applicants} active={kindFilter === 'applicant'} />
        <HqStatCard label="Interviewers" value={stats.interviewers} active={kindFilter === 'interviewer'} />
        <HqStatCard label="Live for candidates" value={stats.liveForCandidates} />
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <div className={HQ_TABLE_CARD_CLASS}>
        <div className={HQ_TOOLBAR_ROW_CLASS}>
          <div className="flex min-w-max items-center gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const active = kindFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setKindFilter(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    active
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      active ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search applicants and interviewers…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
            />
          </div>
          <p className="text-xs font-semibold text-slate-500">
            {loading ? 'Loading…' : `${filtered.length} listed`}
          </p>
        </div>

        <div className={HQ_TABLE_BODY_SCROLL_CLASS}>
          <table className="min-w-full text-left">
            <thead>
              <tr>
                <th>#</th>
                <th>Person</th>
                <th>Type</th>
                <th>Role</th>
                <th>KYC</th>
                <th>HQ status</th>
                <th>Updated</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    {loading
                      ? 'Loading applicants and interviewers…'
                      : 'No Become Interviewer applicants or interviewers found.'}
                  </td>
                </tr>
              ) : (
                filtered.map((row, index) => {
                  const kind = rowKind(row);
                  const rejected = String(row.applicationStatus || '').toUpperCase() === 'REJECTED';
                  const alreadyVerified = !rejected && Boolean(row.hqVerified || row.liveForCandidates);
                  return (
                    <tr key={row.id} className="border-b border-slate-100">
                      <td className="px-4 py-3 text-xs text-slate-400">{index + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{row.name}</div>
                        <div className="text-xs text-slate-500">{row.email || row.phone || '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        {kind === 'interviewer' ? (
                          <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-800 ring-1 ring-sky-200">
                            Interviewer
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800 ring-1 ring-violet-200">
                            Applicant
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {row.currentRole || '—'}
                        {row.currentCompany ? (
                          <div className="text-xs text-slate-500">{row.currentCompany}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {row.kycVerified ? (
                          <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-200">
                            KYC verified
                          </span>
                        ) : (
                          <span
                            className="inline-flex rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200"
                            title={(row.kycMissing || []).join(', ') || 'Incomplete identity'}
                          >
                            Unverified
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.liveForCandidates ? (
                          <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-800 ring-1 ring-sky-200">
                            Live for candidates
                          </span>
                        ) : String(row.applicationStatus || '').toUpperCase() === 'REJECTED' ? (
                          <span className="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-800 ring-1 ring-rose-200">
                            Rejected
                          </span>
                        ) : alreadyVerified ? (
                          <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-200">
                            HQ verified
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200">
                            Awaiting verify
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(row.updatedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setViewing(row);
                              setRejectNotes('');
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View form
                          </button>
                          {rejected ? (
                            <span className="text-xs font-semibold text-rose-700">Rejected</span>
                          ) : alreadyVerified ? (
                            <span className="text-xs font-semibold text-emerald-700">Verified</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void verify(row.id)}
                              disabled={verifyingId === row.id || rejectingId === row.id}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                            >
                              {verifyingId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                              Verify
                            </button>
                          )}
                          {rejected ? null : (
                            <button
                              type="button"
                              onClick={() => {
                                setViewing(row);
                                setRejectNotes(row.reviewNotes || '');
                              }}
                              disabled={rejectingId === row.id || verifyingId === row.id}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-60"
                            >
                              Reject
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewing ? (
        <ViewApplicationModal
          row={viewing}
          verifying={verifyingId === viewing.id}
          rejecting={rejectingId === viewing.id}
          rejectNotes={rejectNotes}
          onRejectNotes={setRejectNotes}
          onClose={() => {
            setViewing(null);
            setRejectNotes('');
          }}
          onVerify={() => void verify(viewing.id)}
          onReject={() => void reject(viewing.id)}
        />
      ) : null}
    </HqModulePageLayout>
  );
}
