'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import {
  apiAddDocument,
  apiGetEmployee,
  apiJoinEmployee,
  apiListDocuments,
  apiListOnboarding,
  apiUpdateEmployee,
  type BackendEmployee,
} from '../../../lib/api';
import { getCountryPack } from '../../../lib/peoplecore/countryPacks';
import {
  PeopleBanner,
  PeopleCard,
  Ph2ModulePageLayout,
  PH2_HEADER_PILL,
  PH2_HEADER_PILL_PRIMARY,
  fieldClass,
} from '../_components/PeopleModule';

type Tab = 'profile' | 'identity' | 'bank' | 'pay' | 'emergency' | 'docs';

export default function Employee360Page() {
  const params = useParams();
  const id = String(params?.id || '');
  const [row, setRow] = useState<BackendEmployee | null>(null);
  const [tab, setTab] = useState<Tab>('profile');
  const [docs, setDocs] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [docName, setDocName] = useState('');
  const pack = getCountryPack(row?.legalEmployerCountry);

  const load = async () => {
    try {
      const res = await apiGetEmployee(id);
      setRow(res.data);
      const [d, t] = await Promise.all([apiListDocuments(id), apiListOnboarding(id)]);
      setDocs((d.data as any[]) || []);
      setTasks((t.data as any[]) || []);
    } catch (error: any) {
      toast.error(error?.message || 'Employee not found');
    }
  };

  useEffect(() => {
    if (id) void load();
  }, [id]);

  const save = async (patch: Record<string, unknown>) => {
    try {
      const res = await apiUpdateEmployee(id, patch);
      setRow(res.data);
      const pending = (res.data as any)?.pendingMakerChecker as string[] | undefined;
      toast.success(
        pending?.length
          ? `${pending.join(', ')} sent to inbox for maker-checker`
          : 'Saved',
      );
    } catch (error: any) {
      toast.error(error?.message || 'Save failed');
    }
  };

  if (!row) {
    return <div className="p-8 text-sm text-slate-500">Loading employee…</div>;
  }

  return (
    <Ph2ModulePageLayout
      title={row.legalName || `${row.firstName} ${row.lastName}`}
      icon={<UsersRound className="h-5 w-5" />}
      subtitle={`${row.engagementType} · ${row.status} · ${row.personId || 'no personId'} · ${row.legalEmployerCountry}`}
    >
      <PeopleBanner text="Employee 360. CTC is structure only until payroll close. Bank/CTC edits wait in inbox. Same personId as the candidate when hired from ATS." />
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {(['profile', 'identity', 'bank', 'pay', 'emergency', 'docs'] as const).map((key) => (
          <button
            key={key}
            type="button"
            className={`rounded-full px-3 py-1 ${tab === key ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200'}`}
            onClick={() => setTab(key)}
          >
            {key}
          </button>
        ))}
      </div>
      {tab === 'profile' ? (
        <PeopleCard>
          <p className="text-sm">{row.email} · {row.phone || '—'}</p>
          <p className="mt-1 text-xs text-slate-500">Candidate {row.candidateId || 'direct hire'}</p>
          {row.status === 'READY' || row.status === 'DEFERRED' ? (
            <button
              type="button"
              className={`${PH2_HEADER_PILL_PRIMARY} mt-3`}
              onClick={async () => {
                try {
                  await apiJoinEmployee(id);
                  toast.success('Joined');
                  await load();
                } catch (error: any) {
                  toast.error(error?.message);
                }
              }}
            >
              Join on Day-1
            </button>
          ) : null}
        </PeopleCard>
      ) : null}
      {tab === 'identity' ? (
        <PeopleCard>
          {(pack?.identityFields || []).map((field) => (
            <input
              key={field.id}
              className={`${fieldClass} mb-2 w-full`}
              placeholder={field.label}
              defaultValue={(row.countryFields || {})[field.id] || ''}
              onBlur={(e) =>
                void save({ countryFields: { ...(row.countryFields || {}), [field.id]: e.target.value } })
              }
            />
          ))}
        </PeopleCard>
      ) : null}
      {tab === 'bank' ? (
        <PeopleCard>
          <p className="mb-2 text-xs text-slate-500">Changes go to inbox for a second approver.</p>
          {(pack?.bankFields || []).map((field) => (
            <input
              key={field.id}
              className={`${fieldClass} mb-2 w-full`}
              placeholder={field.label}
              defaultValue={(row.bank || {})[field.id] || (row.bank || {})[`${field.id}Masked`] || ''}
              onBlur={(e) => void save({ bank: { ...(row.bank || {}), [field.id]: e.target.value } })}
            />
          ))}
        </PeopleCard>
      ) : null}
      {tab === 'pay' ? (
        <PeopleCard>
          <p className="text-xs text-slate-500 mb-2">Annual / monthly package — not a payslip. CTC edits need inbox approval.</p>
          <input
            className={fieldClass}
            type="number"
            placeholder={`Amount ${pack?.currency || ''}`}
            defaultValue={row.compensation?.amount ?? ''}
            onBlur={(e) =>
              void save({
                compensation: {
                  amount: Number(e.target.value),
                  currency: pack?.currency,
                  period: 'ANNUAL',
                },
              })
            }
          />
        </PeopleCard>
      ) : null}
      {tab === 'emergency' ? (
        <PeopleCard>
          <input
            className={`${fieldClass} mb-2 w-full`}
            placeholder="Name"
            defaultValue={row.emergencyContact?.name || ''}
            onBlur={(e) => void save({ emergencyContact: { ...(row.emergencyContact || {}), name: e.target.value } })}
          />
          <input
            className={`${fieldClass} mb-2 w-full`}
            placeholder="Phone"
            defaultValue={row.emergencyContact?.phone || ''}
            onBlur={(e) => void save({ emergencyContact: { ...(row.emergencyContact || {}), phone: e.target.value } })}
          />
        </PeopleCard>
      ) : null}
      {tab === 'docs' ? (
        <PeopleCard>
          <p className="mb-2 text-xs font-semibold">Onboarding</p>
          <ul className="mb-3 text-xs">
            {tasks.map((task) => (
              <li key={task.id}>
                {task.label} · {task.status}
              </li>
            ))}
          </ul>
          <p className="mb-2 text-xs font-semibold">Documents</p>
          <ul className="mb-3 text-xs">
            {docs.map((doc) => (
              <li key={doc.id}>
                {doc.category} · {doc.fileName}
              </li>
            ))}
          </ul>
          <input
            className={`${fieldClass} mb-2 w-full`}
            placeholder="File name"
            value={docName}
            onChange={(e) => setDocName(e.target.value)}
          />
          <button
            type="button"
            className={PH2_HEADER_PILL}
            onClick={async () => {
              if (!docName.trim()) return;
              try {
                await apiAddDocument(id, { category: 'OTHER', fileName: docName.trim() });
                setDocName('');
                await load();
              } catch (error: any) {
                toast.error(error?.message);
              }
            }}
          >
            Add document
          </button>
        </PeopleCard>
      ) : null}
    </Ph2ModulePageLayout>
  );
}
