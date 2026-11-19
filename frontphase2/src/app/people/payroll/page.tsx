'use client';

import React, { useEffect, useState } from 'react';
import { ChevronDown, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import {
  apiApprovePayroll,
  apiFetch,
  apiListLegalEmployers,
  apiListPayrollRuns,
  apiListPayslips,
  apiPayrollPaymentFile,
  apiLockPayroll,
  apiPayrollExceptions,
  apiRunPayroll,
  type LegalEmployer,
} from '../../../lib/api';
import {
  PeopleBanner,
  PeopleCard,
  PeopleFormRow,
  Ph2ModulePageLayout,
  PH2_HEADER_PILL,
  PH2_HEADER_PILL_PRIMARY,
  fieldClass,
} from '../_components/PeopleModule';

export default function PayrollPage() {
  const [employers, setEmployers] = useState<LegalEmployer[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [legalEmployerId, setLegalEmployerId] = useState('');
  const [selectedRunId, setSelectedRunId] = useState('');
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [paymentFile, setPaymentFile] = useState<any>(null);
  const [periodLocked, setPeriodLocked] = useState<boolean | null>(null);
  const now = new Date();

  const load = async () => {
    // Keep the current rows visible until the refreshed list arrives.
    const emp = await apiListLegalEmployers();
    const list = (emp.data as LegalEmployer[]) || [];
    setEmployers(list);
    const id = legalEmployerId || list[0]?.id || '';
    if (!legalEmployerId && id) setLegalEmployerId(id);
    if (id) {
      const qs = new URLSearchParams({
        legalEmployerId: id,
        year: String(now.getFullYear()),
        month: String(now.getMonth() + 1),
      });
      const [res, period] = await Promise.all([
        apiListPayrollRuns(id),
        apiFetch<{ locked?: boolean | null } | null>(`/attendance/periods?${qs}`, {
          auth: true,
          includeTenantHeader: true,
        }).catch(() => null),
      ]);
      setRuns((res.data as any[]) || []);
      setPeriodLocked(period ? Boolean(period.data?.locked) : null);
    }
  };

  const loadRunDetail = async (runId: string) => {
    setSelectedRunId(runId);
    if (!runId) return;
    const [ex, slips, file] = await Promise.all([
      apiPayrollExceptions(runId),
      apiListPayslips(runId),
      apiPayrollPaymentFile(runId),
    ]);
    setExceptions((ex.data as any[]) || []);
    setPayslips((slips.data as any[]) || []);
    setPaymentFile(file.data);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legalEmployerId]);

  const employer = employers.find((row) => row.id === legalEmployerId);

  return (
    <Ph2ModulePageLayout title="Payroll" icon={<Wallet className="h-5 w-5" />} subtitle="Close ritual: lock attendance → calculate or export → exceptions → approve → lock.">
      <PeopleBanner
        text={
          employer?.payrollCapability === 'export'
            ? 'Cameroon is export-only. This will never calculate Indian PF/ESI. Lock attendance first. LOP days ride on the export file; net stays blank.'
            : employer?.payrollCapability === 'calculate'
              ? 'India pack calculates PF (₹15,000 cap) and ESI (₹21,000 ceiling) after the month is locked. Unapproved absences become LOP. CA still files returns.'
              : 'Payroll is not certified for this country. Attendance can still be locked. This run does not calculate pay and does not use India or Cameroon rules.'
        }
      />
      <PeopleCard>
        <PeopleFormRow>
          <select className={fieldClass} value={legalEmployerId} onChange={(e) => setLegalEmployerId(e.target.value)}>
            {employers.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} ({row.country})
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`${PH2_HEADER_PILL_PRIMARY} !w-auto !px-4`}
            onClick={async () => {
              try {
                const res = await apiRunPayroll({
                  legalEmployerId,
                  year: now.getFullYear(),
                  month: now.getMonth() + 1,
                });
                toast.success('Run created — review exceptions before approve');
                await load();
                const runId = (res.data as any)?.run?.id;
                if (runId) await loadRunDetail(runId);
              } catch (error: any) {
                toast.error(error?.message);
              }
            }}
          >
            Run payroll
          </button>
        </PeopleFormRow>
        <ul className="mt-3 text-sm">
          {runs.map((row) => (
            <li key={row.id} className="flex items-center justify-between py-2">
              <button type="button" className="text-left" onClick={() => void loadRunDetail(row.id)}>
                {row.year}-{row.month} · {row.status} · {row.capability}
              </button>
              <details className="group shrink-0">
                <summary className={`${PH2_HEADER_PILL} !w-auto cursor-pointer list-none !px-3 [&::-webkit-details-marker]:hidden`}>
                  More
                  <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className={`${PH2_HEADER_PILL} !w-auto !px-3`}
                    onClick={() =>
                      void apiApprovePayroll(row.id)
                        .then(load)
                        .catch((error: any) => toast.error(error?.message))
                    }
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className={`${PH2_HEADER_PILL} !w-auto !px-3`}
                    onClick={() =>
                      void apiLockPayroll(row.id)
                        .then(load)
                        .catch((error: any) => toast.error(error?.message))
                    }
                  >
                    Lock
                  </button>
                </div>
              </details>
            </li>
          ))}
          {runs.length === 0 ? (
            <li className="py-2 text-slate-500">
              {periodLocked === false
                ? 'No locked attendance month. Lock attendance first, then run payroll.'
                : periodLocked === null
                  ? 'Loading…'
                  : 'No payroll runs yet.'}
            </li>
          ) : null}
        </ul>
      </PeopleCard>
      {selectedRunId ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <PeopleCard>
            <h2 className="text-sm font-semibold">Exceptions</h2>
            <ul className="mt-2 text-xs">
              {exceptions.map((row) => (
                <li key={row.id} className="py-1">
                  {row.severity} · {row.code} · {row.message}
                </li>
              ))}
              {exceptions.length === 0 ? <li className="text-slate-500">None.</li> : null}
            </ul>
          </PeopleCard>
          <PeopleCard>
            <h2 className="text-sm font-semibold">Payslips / export lines</h2>
            <ul className="mt-2 text-xs">
              {payslips.map((row) => (
                <li key={row.id} className="py-1">
                  {row.exportOnly ? 'Export' : 'Calculated'} · {row.currency} gross {row.gross} net {row.net ?? '—'}
                </li>
              ))}
              {payslips.length === 0 ? <li className="text-slate-500">None yet.</li> : null}
            </ul>
            {paymentFile ? (
              <p className="mt-2 text-xs text-slate-500">
                File: {paymentFile.format} · {paymentFile.currency} · {paymentFile.rows?.length || 0} rows
              </p>
            ) : null}
          </PeopleCard>
        </div>
      ) : null}
    </Ph2ModulePageLayout>
  );
}
