'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import {
  apiGetWorkspaceBriefEntityAlerts,
  WORKSPACE_BRIEF_UPDATED_EVENT,
  type AiWorkspaceBriefAlert,
  type AiWorkspaceBriefEntityType,
} from '@/lib/apiAiWorkspaceBrief';
import { startAsyncLoad } from '@/lib/asyncLoadGuard';

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: 'bg-rose-100 text-rose-800 ring-rose-200',
  MEDIUM: 'bg-amber-100 text-amber-800 ring-amber-200',
  LOW: 'bg-slate-100 text-slate-700 ring-slate-200',
};

type EntityWorkspaceAlertsPanelProps = {
  entityType: AiWorkspaceBriefEntityType;
  entityId: string | null | undefined;
  entityLabel?: string;
  className?: string;
};

export function EntityWorkspaceAlertsPanel({
  entityType,
  entityId,
  entityLabel,
  className = '',
}: EntityWorkspaceAlertsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<AiWorkspaceBriefAlert[]>([]);

  const load = useCallback(async () => {
    const id = String(entityId || '').trim();
    if (!id) {
      setAlerts([]);
      setLoading(false);
      return;
    }
    const session = startAsyncLoad(setLoading);
    try {
      const res = await apiGetWorkspaceBriefEntityAlerts(entityType, id);
      if (session.isActive()) {
        setAlerts(Array.isArray(res.data?.alerts) ? res.data.alerts : []);
      }
    } catch {
      if (session.isActive()) setAlerts([]);
    } finally {
      session.finish();
    }
  }, [entityType, entityId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onUpdated = () => void load();
    window.addEventListener(WORKSPACE_BRIEF_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(WORKSPACE_BRIEF_UPDATED_EVENT, onUpdated);
  }, [load]);

  if (!entityId) return null;

  if (loading) {
    return (
      <div
        className={`flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/40 px-3 py-2.5 text-xs text-slate-600 ${className}`}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
        Loading AI workspace alerts…
      </div>
    );
  }

  if (!alerts.length) return null;

  return (
    <div
      className={`overflow-hidden rounded-xl border border-rose-200/80 bg-gradient-to-br from-rose-50/90 via-white to-amber-50/50 shadow-sm ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-rose-100/80 bg-rose-50/60 px-3 py-2">
        <AlertTriangle className="h-4 w-4 text-rose-600" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-rose-900">AI workspace alerts</p>
          <p className="truncate text-[10px] text-rose-700/80">
            From latest Analyze run{entityLabel ? ` · ${entityLabel}` : ''}
          </p>
        </div>
      </div>
      <div className="divide-y divide-rose-100/70">
        {alerts.map((alert, index) => (
          <div key={`${alert.alertCode || alert.title}-${index}`} className="px-3 py-2.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 ${
                      PRIORITY_STYLES[String(alert.priority || 'MEDIUM').toUpperCase()] ||
                      PRIORITY_STYLES.MEDIUM
                    }`}
                  >
                    {alert.priority || 'MEDIUM'}
                  </span>
                  {alert.area ? (
                    <span className="text-[10px] font-medium text-slate-500">{alert.area}</span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-900">{alert.title}</p>
                {alert.detail ? (
                  <p className="mt-0.5 text-[11px] leading-4 text-slate-600">{alert.detail}</p>
                ) : null}
              </div>
              {alert.actionPath ? (
                <Link
                  href={alert.actionPath}
                  className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  Open
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
