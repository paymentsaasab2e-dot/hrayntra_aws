'use client';

import React, { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { toast } from 'sonner';
import {
  apiApprovePayroll,
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
  const now = new Date();

  const load = async () => {
    const emp = await apiListLegalEmployers();
    const list = (emp.data as LegalEmployer[]) || [];
    setEmployers(list);
    const id = legalEmployerId || list[0]?.id || '';
    if (!legalEmployerId && id) setLegalEmployerId(id);
    if (id) {
      const res = await apiListPayrollRuns(id);
      setRuns((res.data as any[]) || []);
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
            className={PH2_HEADER_PILL_PRIMARY}
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
            Run this month
          </button>
        </PeopleFormRow>
        <ul className="mt-3 text-sm">
          {runs.map((row) => (
            <li key={row.id} className="flex items-center justify-between py-2">
              <button type="button" className="text-left" onClick={() => void loadRunDetail(row.id)}>
                {row.year}-{row.month} · {row.status} · {row.capability}
              </button>
              <span className="flex gap-2">
                <button
                  type="button"
                  className={PH2_HEADER_PILL}
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
                  className={PH2_HEADER_PILL}
                  onClick={() =>
                    void apiLockPayroll(row.id)
                      .then(load)
                      .catch((error: any) => toast.error(error?.message))
                  }
                >
                  Lock
                </button>
              </span>
            </li>
          ))}
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
