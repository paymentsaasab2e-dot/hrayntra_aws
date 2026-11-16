'use client';

import React, { useEffect, useState } from 'react';
import { Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { apiDecideInbox, apiDelegateInbox, apiListPeopleInbox } from '../../../lib/api';
import { PeopleBanner, PeopleCard, PeopleFormRow, Ph2ModulePageLayout, PH2_HEADER_PILL, fieldClass } from '../_components/PeopleModule';

export default function PeopleInboxPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [delegateId, setDelegateId] = useState('');
  const load = async () => {
    const res = await apiListPeopleInbox();
    setRows((res.data as any[]) || []);
  };
  useEffect(() => {
    void load();
  }, []);

  return (
    <Ph2ModulePageLayout title="People inbox" icon={<Inbox className="h-5 w-5" />} subtitle="Leave, exit, onboarding, regularisation, bank/CTC maker-checker — one queue.">
      <PeopleBanner text="Delegate when the manager is off. Bank and CTC changes wait here until a second person approves. CRM /request stays for sales requests." />
      <PeopleCard>
        <PeopleFormRow>
          <input
            className={fieldClass}
            placeholder="Delegate to user id"
            value={delegateId}
            onChange={(e) => setDelegateId(e.target.value)}
          />
        </PeopleFormRow>
        <ul className="text-sm">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between py-2">
              <span>
                {row.kind} · {row.status} · {row.delegatedToId ? `delegated ${row.delegatedToId}` : ''}
              </span>
              {row.status === 'PENDING' ? (
                <span className="flex gap-2">
                  <button
                    type="button"
                    className={PH2_HEADER_PILL}
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
                    className={PH2_HEADER_PILL}
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
                    className={PH2_HEADER_PILL}
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
                </span>
              ) : null}
            </li>
          ))}
          {rows.length === 0 ? <li className="text-slate-500">Empty.</li> : null}
        </ul>
      </PeopleCard>
    </Ph2ModulePageLayout>
  );
}
