'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus, RefreshCcw, UserPlus, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import {
  Ph2ModulePageLayout,
  PH2_HEADER_PILL,
  PH2_HEADER_PILL_PRIMARY,
  PH2_TABLE_CARD_CLASS,
  PH2_TABLE_CLASS,
  PH2_TOOLBAR_SELECT_CLASS,
} from '../../components/layout/Ph2ModulePageLayout';
import {
  apiCreateEmployee,
  apiGetCandidates,
  apiGetEmployees,
  apiGetPeopleCoreSettings,
  apiHireEmployeeFromCandidate,
  apiListLegalEmployers,
  type BackendCandidate,
  type BackendEmployee,
  type LegalEmployer,
  type PeopleCoreSettings,
} from '../../lib/api';
import {
  ENGAGEMENT_TYPES,
  getCountryPack,
  payrollCapabilityLabel,
} from '../../lib/peoplecore/countryPacks';

export const dynamic = 'force-dynamic';

function displayName(row: { firstName?: string | null; lastName?: string | null }) {
  return [row.firstName, row.lastName].filter(Boolean).join(' ').trim() || '—';
}

function PeoplePageContent() {
  const [settings, setSettings] = useState<PeopleCoreSettings | null>(null);
  const [employers, setEmployers] = useState<LegalEmployer[]>([]);
  const [legalEmployerId, setLegalEmployerId] = useState('');
  const [employees, setEmployees] = useState<BackendEmployee[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [hireOpen, setHireOpen] = useState(false);
  const [hiredCandidates, setHiredCandidates] = useState<BackendCandidate[]>([]);
  const [hiredLoading, setHiredLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    designation: '',
    engagementType: 'EMPLOYEE',
    employmentStartDate: '',
  });

  const selectedEmployer = employers.find((row) => row.id === legalEmployerId) || employers[0] || null;
  const pack = getCountryPack(selectedEmployer?.country || settings?.legalEmployerCountry);
  const countryReady = Boolean(selectedEmployer?.id || settings?.defaultLegalEmployerId);
  const searchRef = useRef(search);
  searchRef.current = search;

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const [settingsRes, listRes, empRes] = await Promise.all([
        apiGetPeopleCoreSettings(),
        apiGetEmployees({ search: searchRef.current.trim() || undefined, limit: 50, page: 1 }),
        apiListLegalEmployers(),
      ]);
      setSettings(settingsRes.data);
      const employerRows = (empRes.data as LegalEmployer[]) || [];
      setEmployers(employerRows);
      setLegalEmployerId((current) => current || settingsRes.data?.defaultLegalEmployerId || employerRows[0]?.id || '');
      const payload = listRes.data;
      setEmployees(payload?.data || []);
      setTotal(payload?.pagination?.total || payload?.data?.length || 0);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load PeopleCore');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openHire = async () => {
    if (!countryReady) {
      toast.error('Create a legal employer in People → Settings first');
      return;
    }
    setHireOpen(true);
    setHiredLoading(true);
    try {
      const res = await apiGetCandidates({ stage: 'Hired', limit: 50 });
      const payload = res.data as BackendCandidate[] | { data?: BackendCandidate[] } | undefined;
      const rows = Array.isArray(payload) ? payload : payload?.data || [];
      setHiredCandidates(rows);
    } catch (error: any) {
      toast.error(error?.message || 'Could not load hired candidates');
    } finally {
      setHiredLoading(false);
    }
  };

  const hireCandidate = async (candidateId: string) => {
    setSaving(true);
    try {
      const res = await apiHireEmployeeFromCandidate(candidateId, {
        legalEmployerId: selectedEmployer?.id,
      });
      toast.success(
        res.data.alreadyHired
          ? 'This candidate is already on the employee master'
          : `${displayName(res.data.employee)} hired as employee (same personId)`,
      );
      setHireOpen(false);
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Hire failed');
    } finally {
      setSaving(false);
    }
  };

  const createEmployee = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!countryReady) {
      toast.error('Create a legal employer in People → Settings first');
      return;
    }
    if (!form.firstName.trim()) {
      toast.error('First name is required');
      return;
    }
    setSaving(true);
    try {
      await apiCreateEmployee({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        designation: form.designation.trim() || undefined,
        engagementType: form.engagementType as (typeof ENGAGEMENT_TYPES)[number],
        employmentStartDate: form.employmentStartDate || undefined,
        legalEmployerId: selectedEmployer?.id,
      });
      toast.success('Employee added');
      setAddOpen(false);
      setForm({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        designation: '',
        engagementType: 'EMPLOYEE',
        employmentStartDate: '',
      });
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Could not add employee');
    } finally {
      setSaving(false);
    }
  };

  const subtitle = useMemo(() => {
    if (!selectedEmployer) return 'Create a legal employer in Settings first. Phase 3 stores people — it does not print payslips.';
    return `${selectedEmployer.name} · ${pack?.name || selectedEmployer.country} · ${payrollCapabilityLabel(selectedEmployer.payrollCapability)}`;
  }, [pack, selectedEmployer]);

  return (
    <Ph2ModulePageLayout
      title="Employees"
      icon={<UsersRound className="h-5 w-5" />}
      subtitle={subtitle}
      actions={
        <>
          <select
            className={PH2_TOOLBAR_SELECT_CLASS}
            value={legalEmployerId}
            onChange={(event) => setLegalEmployerId(event.target.value)}
            aria-label="Legal employer"
          >
            <option value="">Legal employer…</option>
            {employers.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} ({row.country})
              </option>
            ))}
          </select>
          <Link href="/people/settings" className={PH2_HEADER_PILL}>
            Settings
          </Link>
          <button type="button" className={PH2_HEADER_PILL} onClick={() => void load()} title="Refresh">
            <RefreshCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button type="button" className={PH2_HEADER_PILL} onClick={() => void openHire()}>
            <UserPlus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Hire from candidate</span>
          </button>
          <button type="button" className={PH2_HEADER_PILL_PRIMARY} onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Add employee</span>
          </button>
        </>
      }
    >
      <div className="mb-3 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs text-amber-950">
        <p className="font-semibold">Phase 3 PeopleCore — no payslips until attendance is locked</p>
        <p className="mt-1 text-amber-900/80">
          {pack?.payrollNote ||
            'Hire onto a legal employer. Cameroon never inherits India PF/ESI. Payroll close needs a locked attendance month.'}
        </p>
      </div>

      <div className={PH2_TABLE_CARD_CLASS}>
        <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
          <input
            className="h-9 w-full max-w-sm rounded-full border border-slate-200 bg-white px-3 text-xs"
            placeholder="Search name, email, personId"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void load({ silent: employees.length > 0 });
            }}
          />
          <span className="ml-auto text-[11px] font-medium text-slate-500">{total} people</span>
        </div>
        {loading ? (
          <div className="p-8 text-sm text-slate-500">Loading employees…</div>
        ) : employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <UsersRound className="h-8 w-8 text-slate-300" />
            <p className="text-sm font-semibold text-slate-800">No employees yet</p>
            <p className="max-w-md text-xs text-slate-500">
              Hire a Hired candidate onto this master. Same <code>personId</code> on both records — no CSV
              between recruitment and HR.
            </p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className={PH2_TABLE_CLASS}>
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">Person ID</th>
                  <th className="px-3 py-2 font-semibold">Engagement</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Country</th>
                  <th className="px-3 py-2 font-semibold">Hired from</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 text-sm text-slate-800">
                    <td className="px-3 py-2">
                      <div className="font-medium">
                        <Link className="text-[#3867FF] hover:underline" href={`/people/${row.id}`}>
                          {displayName(row)}
                        </Link>
                      </div>
                      <div className="text-[11px] text-slate-500">{row.email || row.phone || '—'}</div>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px]">{row.personId || '—'}</td>
                    <td className="px-3 py-2 text-xs">{row.engagementType}</td>
                    <td className="px-3 py-2 text-xs">{row.status}</td>
                    <td className="px-3 py-2 text-xs">{row.legalEmployerCountry}</td>
                    <td className="px-3 py-2 text-xs">
                      {row.candidateId ? 'Candidate' : 'Manual'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {addOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4">
          <form
            onSubmit={createEmployee}
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
          >
            <h2 className="text-base font-semibold text-slate-900">Add employee</h2>
            <p className="mt-1 text-xs text-slate-500">
              Direct add for people who did not come from recruitment. CTC/payslip is not here.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <input
                className="h-9 rounded-lg border border-slate-200 px-3 text-xs"
                placeholder="First name"
                value={form.firstName}
                onChange={(event) => setForm((c) => ({ ...c, firstName: event.target.value }))}
              />
              <input
                className="h-9 rounded-lg border border-slate-200 px-3 text-xs"
                placeholder="Last name"
                value={form.lastName}
                onChange={(event) => setForm((c) => ({ ...c, lastName: event.target.value }))}
              />
              <input
                className="col-span-2 h-9 rounded-lg border border-slate-200 px-3 text-xs"
                placeholder="Email"
                value={form.email}
                onChange={(event) => setForm((c) => ({ ...c, email: event.target.value }))}
              />
              <input
                className="h-9 rounded-lg border border-slate-200 px-3 text-xs"
                placeholder="Phone"
                value={form.phone}
                onChange={(event) => setForm((c) => ({ ...c, phone: event.target.value }))}
              />
              <input
                className="h-9 rounded-lg border border-slate-200 px-3 text-xs"
                placeholder="Designation"
                value={form.designation}
                onChange={(event) => setForm((c) => ({ ...c, designation: event.target.value }))}
              />
              <select
                className="h-9 rounded-lg border border-slate-200 px-3 text-xs"
                value={form.engagementType}
                onChange={(event) => setForm((c) => ({ ...c, engagementType: event.target.value }))}
              >
                {ENGAGEMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <input
                type="date"
                className="h-9 rounded-lg border border-slate-200 px-3 text-xs"
                value={form.employmentStartDate}
                onChange={(event) => setForm((c) => ({ ...c, employmentStartDate: event.target.value }))}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={PH2_HEADER_PILL} onClick={() => setAddOpen(false)}>
                Cancel
              </button>
              <button type="submit" className={PH2_HEADER_PILL_PRIMARY} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {hireOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4">
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-base font-semibold text-slate-900">Hire from candidate</h2>
            <p className="mt-1 text-xs text-slate-500">
              Copies name, email, phone, and personId. Candidate stays a candidate; employee is a new
              row.
            </p>
            <div className="mt-3 min-h-0 flex-1 overflow-auto">
              {hiredLoading ? (
                <p className="py-8 text-center text-sm text-slate-500">Loading hired candidates…</p>
              ) : hiredCandidates.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  No Hired-stage candidates. Move someone to Hired in Recruitment first.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {hiredCandidates.map((row) => (
                    <li key={row.id} className="flex items-center gap-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {displayName(row)}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">
                          {row.email || row.phone || row.id}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={PH2_HEADER_PILL_PRIMARY}
                        disabled={saving}
                        onClick={() => void hireCandidate(row.id)}
                      >
                        Hire
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" className={PH2_HEADER_PILL} onClick={() => setHireOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Ph2ModulePageLayout>
  );
}

export default function PeoplePage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading People…</div>}>
      <PeoplePageContent />
    </Suspense>
  );
}
