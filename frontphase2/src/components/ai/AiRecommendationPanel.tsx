'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
  apiGetEntryRecommendations,
  apiRegenerateEntryRecommendation,
  type AiEntryRecommendation,
  type AiEntryEntityType,
} from '../../lib/apiAiRecommendations';

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: 'bg-rose-100 text-rose-800 border-rose-200',
  MEDIUM: 'bg-amber-100 text-amber-800 border-amber-200',
  LOW: 'bg-slate-100 text-slate-700 border-slate-200',
};

type AiRecommendationPanelProps = {
  entityType: AiEntryEntityType;
  entityId: string | null | undefined;
  entityLabel?: string;
  className?: string;
};

export function AiRecommendationPanel({
  entityType,
  entityId,
  entityLabel,
  className = '',
}: AiRecommendationPanelProps) {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [items, setItems] = useState<AiEntryRecommendation[]>([]);

  const load = useCallback(async () => {
    const id = String(entityId || '').trim();
    if (!id) return;
    setLoading(true);
    try {
      const res = await apiGetEntryRecommendations(entityType, id);
      const data = res.data;
      setItems(Array.isArray(data?.recommendations) ? data.recommendations : []);
      setConfigured(data?.configured !== false);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRefresh = async () => {
    const id = String(entityId || '').trim();
    if (!id) return;
    if (!configured) {
      toast.error('OpenAI is not configured on the server');
      return;
    }
    setRefreshing(true);
    try {
      const res = await apiRegenerateEntryRecommendation({
        entityType,
        entityId: id,
        entityLabel: entityLabel || entityType,
        trigger: 'manual',
      });
      const recommendation = res.data?.recommendation;
      if (recommendation) {
        setItems((prev) => [recommendation, ...prev.filter((r) => r.id !== recommendation.id)]);
        toast.success('New AI recommendation ready — check your email and notifications');
      } else {
        await load();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate recommendation');
    } finally {
      setRefreshing(false);
    }
  };

  const id = String(entityId || '').trim();
  if (!id) return null;

  const latest = items[0];

  return (
    <section
      className={`overflow-hidden rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/90 via-white to-violet-50/60 shadow-sm ${className}`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-indigo-100/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <Sparkles size={16} />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">AI Recommendation</p>
            <p className="text-xs text-slate-500">Smart next steps from OpenAI</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={refreshing || loading || !configured}
          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
          title={configured ? 'Generate a fresh recommendation' : 'OpenAI API key not configured'}
        >
          {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Refresh
        </button>
      </div>

      <div className="px-4 py-3">
        {loading && !latest ? (
          <div className="flex items-center gap-2 py-2 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin text-indigo-600" />
            Loading recommendation…
          </div>
        ) : !configured ? (
          <p className="text-sm text-slate-500">
            Set <code className="rounded bg-slate-100 px-1">OPENAI_API_KEY</code> on the backend to enable AI
            recommendations.
          </p>
        ) : !latest ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">
              No recommendation yet. One is generated automatically when this record is created or updated.
            </p>
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
              className="text-sm font-semibold text-indigo-700 hover:text-indigo-900"
            >
              Generate now
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                  PRIORITY_STYLES[latest.priority] || PRIORITY_STYLES.MEDIUM
                }`}
              >
                {latest.priority}
              </span>
              {(latest.tags || ['AI Recommendation']).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800"
                >
                  {tag}
                </span>
              ))}
            </div>
            <p className="text-sm leading-relaxed text-slate-700">{latest.summary}</p>
            {latest.actions?.length ? (
              <ul className="space-y-2 border-t border-indigo-100/80 pt-3">
                {latest.actions.map((action, index) => (
                  <li key={`${action.title}-${index}`} className="text-sm">
                    <p className="font-semibold text-slate-800">
                      {index + 1}. {action.title}
                      {action.dueInDays != null ? (
                        <span className="ml-1 font-normal text-slate-500">· within {action.dueInDays} days</span>
                      ) : null}
                    </p>
                    {action.detail ? <p className="mt-0.5 text-slate-600">{action.detail}</p> : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {items.length > 1 ? (
              <p className="text-xs text-slate-400">{items.length - 1} earlier recommendation(s) on file</p>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
