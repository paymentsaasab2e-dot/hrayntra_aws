'use client';

import React, { useEffect, useState } from 'react';
import { CalendarClock, Clock, Loader2 } from 'lucide-react';
import { ScheduleMeetingForm } from '../ScheduleMeetingForm';
import { formatFollowUpDisplay } from '../../utils/formatLeadDateTime';
import { formatDateTimeDMY } from '../../utils/dateDisplay';
import { apiGetLeadActivities, type BackendActivity } from '../../lib/api';

type FollowUpHistoryItem = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
};

function isFollowUpActivity(activity: BackendActivity): boolean {
  const haystack = `${activity.action || ''} ${activity.description || ''}`.toLowerCase();
  return haystack.includes('follow-up') || haystack.includes('follow up');
}

export function LeadFollowUpTabPanel({
  leadId,
  nextFollowUp,
  lastFollowUp,
  onScheduled,
}: {
  leadId: string;
  nextFollowUp?: string | null;
  lastFollowUp?: string | null;
  onScheduled?: () => void;
}) {
  const [history, setHistory] = useState<FollowUpHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);

  useEffect(() => {
    if (!leadId) return;
    let cancelled = false;
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) {
      setHistory([]);
      return;
    }

    setLoadingHistory(true);
    void apiGetLeadActivities(leadId)
      .then((response) => {
        if (cancelled) return;
        const backendActivities = Array.isArray(response.data) ? response.data : [];
        const items = backendActivities
          .filter(isFollowUpActivity)
          .map((activity) => ({
            id: activity.id,
            title: activity.action || 'Follow-up',
            description: activity.description || activity.action || '',
            createdAt: activity.createdAt,
          }));
        setHistory(items);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [leadId, historyKey]);

  const handleSuccess = () => {
    setHistoryKey((k) => k + 1);
    onScheduled?.();
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-blue-50/60 p-4 shadow-sm">
          <p className="inline-flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-sky-700">
            <CalendarClock className="h-3.5 w-3.5" />
            Next follow-up
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {formatFollowUpDisplay(nextFollowUp) || 'Not scheduled'}
          </p>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
          <p className="inline-flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-slate-500">
            <Clock className="h-3.5 w-3.5" />
            Last contacted
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {formatFollowUpDisplay(lastFollowUp) || '—'}
          </p>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-900">Schedule a follow-up</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Pick a type, date and time. This updates the lead’s next follow-up.
          </p>
        </div>
        <div className="px-4 pb-4 pt-2">
          <ScheduleMeetingForm
            entityType="lead"
            entityId={leadId}
            title=""
            embedded
            onSuccess={handleSuccess}
          />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900">Follow-up history</h3>
          {loadingHistory ? <Loader2 className="h-4 w-4 animate-spin text-sky-600" /> : null}
        </div>
        {loadingHistory && history.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            Loading history…
          </p>
        ) : history.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            No follow-ups scheduled yet. Use the form above to schedule one.
          </p>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500">{formatDateTimeDMY(item.createdAt)}</p>
                </div>
                {item.description ? (
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.description}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
