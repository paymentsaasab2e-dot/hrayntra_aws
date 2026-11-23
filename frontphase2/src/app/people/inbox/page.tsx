'use client';

import React, { useEffect, useState } from 'react';
import { ChevronDown, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { apiDecideInbox, apiDelegateInbox, apiGetEmployees, apiListPeopleInbox, type BackendEmployee } from '../../../lib/api';
import { PeopleBanner, PeopleCard, PeopleFormRow, Ph2ModulePageLayout, PH2_HEADER_PILL, PH2_HEADER_PILL_PRIMARY, employeeDisplayName, fieldClass, readableStatus } from '../_components/PeopleModule';

export default function PeopleInboxPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [employees, setEmployees] = useState<BackendEmployee[]>([]);
  const [delegateId, setDelegateId] = useState('');
  const load = async () => {
    // Keep the current rows visible until the refreshed list arrives.
    const [res, people] = await Promise.all([apiListPeopleInbox(), apiGetEmployees({ limit: 50 })]);
    setRows((res.data as any[]) || []);
    setEmployees(people.data?.data || []);
  };
  useEffect(() => {
    void load();
  }, []);

  const oldestPending = rows.reduce<any>((oldest, row) => {
    if (row.status !== 'PENDING') return oldest;
    if (!oldest) return row;
    const rowAt = row.createdAt ? new Date(row.createdAt).getTime() : Number.POSITIVE_INFINITY;
    const oldestAt = oldest.createdAt ? new Date(oldest.createdAt).getTime() : Number.POSITIVE_INFINITY;
    if (rowAt !== oldestAt) return rowAt < oldestAt ? row : oldest;
    return row;
  }, null);

  return (
    <Ph2ModulePageLayout title="People inbox" icon={<Inbox className="h-5 w-5" />} subtitle="Leave, exit, onboarding, regularisation, bank/CTC maker-checker — one queue.">
      <PeopleBanner text="Delegate when the manager is off. Bank and CTC changes wait here until a second person approves. CRM /request stays for sales requests." />
      <PeopleCard>
        <PeopleFormRow>
          <button
            type="button"
            className={`${PH2_HEADER_PILL_PRIMARY} !w-auto !px-4`}
            disabled={!oldestPending}
            onClick={async () => {
              if (!oldestPending) return;
              try {
                await apiDecideInbox(oldestPending.id, 'APPROVED');
                await load();
              } catch (error: any) {
                toast.error(error?.message);
              }
            }}
          >
            Approve oldest
          </button>
          <input
            className={fieldClass}
            placeholder="Delegate to user id"
            value={delegateId}
            onChange={(e) => setDelegateId(e.target.value)}
          />
        </PeopleFormRow>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 text-left">Employee</th>
                <th className="px-4 py-2 text-left">Request</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="py-2 pl-4 text-right" />
              </tr>
            </thead>
            <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100">
              <td className="py-2 pr-4 text-left font-semibold text-slate-800">{employeeDisplayName(employees, row.employeeId)}</td>
              <td className="px-4 py-2 text-left text-slate-800">{({ LEAVE: 'Leave', EXIT: 'Exit', ONBOARDING: 'Onboarding', REGULARISATION: 'Attendance correction', BANK: 'Bank details', CTC: 'Pay structure' } as Record<string, string>)[row.kind] || readableStatus(row.kind)}</td>
              <td className="px-4 py-2 text-left text-slate-700">{readableStatus(row.status)}{row.delegatedToId ? ' · delegated' : ''}</td>
              <td className="py-2 pl-4 text-right">
              {row.status === 'PENDING' ? (
                <details className="group inline-block text-left">
                  <summary className={`${PH2_HEADER_PILL} !w-auto cursor-pointer list-none !px-3 [&::-webkit-details-marker]:hidden`}>
                    More
                    <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className={`${PH2_HEADER_PILL} !w-auto !px-3`}
                      onClick={async () => {
                        try {
                          await apiDecideInbox(row.id, 'APPROVED');
                          await load();
                        } catch (error: any) {
                          toast.error(error?.message);
                        }
                      }}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className={`${PH2_HEADER_PILL} !w-auto !px-3`}
                      onClick={async () => {
                        try {
                          await apiDecideInbox(row.id, 'REJECTED');
                          await load();
                        } catch (error: any) {
                          toast.error(error?.message);
                        }
                      }}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      className={`${PH2_HEADER_PILL} !w-auto !px-3`}
                      onClick={async () => {
                        if (!delegateId.trim()) {
                          toast.error('Enter a user id to delegate');
                          return;
                        }
                        try {
                          await apiDelegateInbox(row.id, delegateId.trim());
                          toast.success('Delegated');
                          await load();
                        } catch (error: any) {
                          toast.error(error?.message);
                        }
                      }}
                    >
                      Delegate
                    </button>
                  </div>
                </details>
              ) : null}
              </td>
            </tr>
          ))}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="py-3 text-sm text-slate-500">Nothing waiting.</p> : null}
        </div>
      </PeopleCard>
    </Ph2ModulePageLayout>
  );
}
