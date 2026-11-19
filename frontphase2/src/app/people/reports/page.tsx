'use client';

import React, { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { apiInspectorPack, apiListLegalEmployers, apiMuster, apiPeopleAlerts, apiPeopleReportsHome, type LegalEmployer } from '../../../lib/api';
import { PeopleBanner, PeopleCard, Ph2ModulePageLayout, fieldClass } from '../_components/PeopleModule';

export default function PeopleReportsPage() {
  const [home, setHome] = useState<any>(null);
  const [homeReady, setHomeReady] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [inspector, setInspector] = useState<any>(null);
  const [muster, setMuster] = useState<any>(null);
  const [employers, setEmployers] = useState<LegalEmployer[]>([]);
  const [legalEmployerId, setLegalEmployerId] = useState('');
  const now = new Date();

  useEffect(() => {
    void (async () => {
      try {
        const [h, e, a] = await Promise.all([apiPeopleReportsHome(), apiListLegalEmployers(), apiPeopleAlerts()]);
        setHome(h.data ?? {});
        setAlerts(((a.data as any)?.items as any[]) || []);
        const list = (e.data as LegalEmployer[]) || [];
        setEmployers(list);
        const id = list[0]?.id || '';
        setLegalEmployerId(id);
        if (id) {
          setInspector((await apiInspectorPack(id)).data);
          setMuster((await apiMuster(id, now.getFullYear(), now.getMonth() + 1)).data);
        }
      } catch {
        setHome((current) => current ?? {});
      } finally {
        setHomeReady(true);
      }
    })();
  }, []);

  return (
    <Ph2ModulePageLayout title="People reports" icon={<BarChart3 className="h-5 w-5" />} subtitle="Home exceptions + inspector pack labelled ready only for the selected country.">
      <PeopleBanner text="No performance summaries — Performance is out of Lite. Inspector reports are country-specific." />
      <div className="grid gap-3 lg:grid-cols-2">
        <PeopleCard>
          <h2 className="text-sm font-semibold">Home</h2>
          <ul className="mt-2 text-sm">
            {!homeReady || home === null ? (
              <li className="text-slate-500">Loading…</li>
            ) : (
              <>
                <li>Employees {home.employees ?? '—'}</li>
                <li>Pending leave {home.pendingLeave ?? '—'}</li>
                <li>Inbox {home.pendingInbox ?? '—'}</li>
                <li>Open exits {home.openExits ?? '—'}</li>
                <li>On leave {home.onLeave ?? '—'}</li>
                <li>Payroll blocks {home.payrollExceptions ?? '—'}</li>
              </>
            )}
          </ul>
          <ul className="mt-2 text-xs text-amber-800">
            {alerts.map((row) => (
              <li key={row.code}>{row.severity} · {row.message}</li>
            ))}
          </ul>
        </PeopleCard>
        <PeopleCard>
          <h2 className="text-sm font-semibold">Inspector pack</h2>
          <select
            className={`${fieldClass} mb-2`}
            value={legalEmployerId}
            onChange={(e) => {
              setLegalEmployerId(e.target.value);
              void apiInspectorPack(e.target.value).then((res) => setInspector(res.data));
            }}
          >
            {employers.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} ({row.country})
              </option>
            ))}
          </select>
          <p className="text-xs">Ready: {(inspector?.readyReports || []).join(', ') || '—'}</p>
          <p className="text-xs">Headcount {inspector?.headcount ?? '—'} · joiners {inspector?.joiners ?? '—'} · leavers {inspector?.leavers ?? '—'}</p>
          <p className="mt-2 text-xs">
            Muster absences this month:{' '}
            {(muster?.rows || []).reduce((sum: number, row: { absent?: number }) => sum + (row.absent || 0), 0)}
          </p>
        </PeopleCard>
      </div>
    </Ph2ModulePageLayout>
  );
}
