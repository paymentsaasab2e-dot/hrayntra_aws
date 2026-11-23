'use client';

import React, { useEffect, useState } from 'react';
import { ChevronDown, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import {
  apiCompleteOnboardingTask,
  apiDeferEmployee,
  apiJoinEmployee,
  apiListOnboarding,
  apiMarkNoShow,
  apiOnboardingQueue,
  type BackendEmployee,
} from '../../../lib/api';
import { PeopleBanner, PeopleCard, Ph2ModulePageLayout, PH2_HEADER_PILL, PH2_HEADER_PILL_PRIMARY, fieldClass } from '../_components/PeopleModule';

export default function OnboardingPage() {
  const [employees, setEmployees] = useState<BackendEmployee[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [tasks, setTasks] = useState<any[]>([]);

  const loadPeople = async () => {
    // Keep the current rows visible until the refreshed list arrives.
    const res = await apiOnboardingQueue();
    const rows = ((res.data as BackendEmployee[]) || []) as BackendEmployee[];
    setEmployees(rows);
    setEmployeeId((current) => current || rows[0]?.id || '');
  };

  const loadTasks = async (id: string) => {
    if (!id) {
      setTasks([]);
      return;
    }
    const res = await apiListOnboarding(id);
    setTasks((res.data as any[]) || []);
  };

  useEffect(() => {
    void loadPeople();
  }, []);

  useEffect(() => {
    void loadTasks(employeeId);
  }, [employeeId]);

  const selected = employees.find((row) => row.id === employeeId);
  const pendingTasks = tasks.filter((task) => task.status !== 'DONE').length;

  return (
    <Ph2ModulePageLayout title="Onboarding" icon={<ClipboardList className="h-5 w-5" />} subtitle="Checklist from the country pack. Day-1 join only after READY.">
      <PeopleBanner text="Hired candidates land in PREBOARDING. Complete pack documents, then Join on Day-1. Mark no-show if they never arrive." />
      <select className={`${fieldClass} mb-3`} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
        {employees.map((row) => (
          <option key={row.id} value={row.id}>
            {row.firstName} {row.lastName} · {row.status}
          </option>
        ))}
      </select>
      <PeopleCard>
        <p className="mb-2 text-sm font-semibold text-slate-800">
          Checklist for {selected ? `${selected.firstName || ''} ${selected.lastName || ''}`.trim() : 'the selected employee'}
        </p>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-4 text-left">Task</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="py-2 pl-4 text-right" />
            </tr>
          </thead>
          <tbody>
          {tasks.map((task) => (
            <tr key={task.id} className="border-b border-slate-100">
              <td className="py-2 pr-4 text-left text-slate-800">{task.label}</td>
              <td className="px-4 py-2 text-left text-slate-700">{task.status === 'DONE' ? 'Done' : 'Waiting'}</td>
              <td className="py-2 pl-4 text-right">
              {task.status !== 'DONE' ? (
                <details className="group shrink-0">
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
                          await apiCompleteOnboardingTask(task.id);
                          await loadTasks(employeeId);
                          await loadPeople();
                        } catch (error: any) {
                          toast.error(error?.message);
                        }
                      }}
                    >
                      Complete
                    </button>
                  </div>
                </details>
              ) : null}
              </td>
            </tr>
          ))}
          </tbody>
        </table>
        {employeeId ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {selected?.status === 'PREBOARDING' ? (
              <button
                type="button"
                className={`${PH2_HEADER_PILL_PRIMARY} !w-auto !px-4`}
                disabled={pendingTasks === 0}
                onClick={async () => {
                  try {
                    const pending = tasks.filter((task) => task.status !== 'DONE');
                    for (const task of pending) {
                      await apiCompleteOnboardingTask(task.id);
                    }
                    toast.success('Checklist complete — marked ready');
                    await loadTasks(employeeId);
                    await loadPeople();
                  } catch (error: any) {
                    toast.error(error?.message);
                  }
                }}
              >
                Mark ready
              </button>
            ) : null}
            {selected?.status === 'READY' || selected?.status === 'DEFERRED' ? (
              <button
                type="button"
                className={`${PH2_HEADER_PILL_PRIMARY} !w-auto !px-4`}
                onClick={async () => {
                  try {
                    await apiJoinEmployee(employeeId);
                    toast.success('Joined — status JOINED');
                    await loadPeople();
                  } catch (error: any) {
                    toast.error(error?.message);
                  }
                }}
              >
                Join on Day-1
              </button>
            ) : null}
            <details className="group shrink-0">
              <summary className={`${PH2_HEADER_PILL} !w-auto cursor-pointer list-none !px-3 [&::-webkit-details-marker]:hidden`}>
                More
                <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-2 flex flex-wrap gap-2">
                {selected?.status === 'PREBOARDING' || selected?.status === 'READY' ? (
                  <button
                    type="button"
                    className={`${PH2_HEADER_PILL} !w-auto !px-3`}
                    onClick={async () => {
                      try {
                        await apiDeferEmployee(employeeId);
                        toast.success('Deferred');
                        await loadPeople();
                      } catch (error: any) {
                        toast.error(error?.message);
                      }
                    }}
                  >
                    Defer
                  </button>
                ) : null}
                <button
                  type="button"
                  className="text-xs text-rose-600"
                  onClick={async () => {
                    await apiMarkNoShow(employeeId);
                    toast.success('Marked no-show');
                    await loadPeople();
                  }}
                >
                  Mark no-show
                </button>
              </div>
            </details>
          </div>
        ) : null}
      </PeopleCard>
    </Ph2ModulePageLayout>
  );
}
