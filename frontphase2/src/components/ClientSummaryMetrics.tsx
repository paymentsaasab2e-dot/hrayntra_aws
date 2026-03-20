'use client';

import React, { useState, useEffect } from 'react';
import { Users, Briefcase, Award, Banknote, TrendingUp, TrendingDown } from 'lucide-react';
import { apiGetClientMetrics, type ClientMetrics } from '../lib/api';

const colorMap = {
  activeClients: { bg: 'bg-blue-50', text: 'text-blue-600' },
  openJobs: { bg: 'bg-teal-50', text: 'text-teal-600' },
  placementsThisMonth: { bg: 'bg-purple-50', text: 'text-purple-600' },
  revenueGenerated: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
};

const iconMap = {
  activeClients: Users,
  openJobs: Briefcase,
  placementsThisMonth: Award,
  revenueGenerated: Banknote,
};

const labelMap = {
  activeClients: 'ACTIVE CLIENTS',
  openJobs: 'OPEN JOBS',
  placementsThisMonth: 'PLACEMENTS (THIS MONTH)',
  revenueGenerated: 'REVENUE GENERATED',
};

export function ClientSummaryMetrics() {
  const [metrics, setMetrics] = useState<ClientMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        if (!token) {
          // No token, skip API call
          setLoading(false);
          return;
        }

        const response = await apiGetClientMetrics();
        setMetrics(response.data);
      } catch (err: any) {
        console.error('Failed to fetch client metrics:', err);
        // Don't set error state - just use default metrics
        // This prevents UI crashes when backend is unavailable
        setError(null);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  // Default/fallback metrics if not loaded or error
  const defaultMetrics: ClientMetrics = {
    activeClients: { value: 0, trend: 0, trendUp: true },
    openJobs: { value: 0, trend: 0, trendUp: true },
    candidatesInProgress: { value: 0, trend: 0, trendUp: true },
    placementsThisMonth: { value: 0, trend: 0, trendUp: true },
    revenueGenerated: { value: 0, formatted: '$0', trend: 0, trendUp: true },
  };

  const displayMetrics = metrics || defaultMetrics;

  const metricKeys: (keyof ClientMetrics)[] = [
    'activeClients',
    'openJobs',
    'placementsThisMonth',
    'revenueGenerated',
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {metricKeys.map((key) => {
        const metric = displayMetrics[key];
        const Icon = iconMap[key];
        const color = colorMap[key];
        const label = labelMap[key];
        
        const value = key === 'revenueGenerated' 
          ? (metric as ClientMetrics['revenueGenerated']).formatted 
          : String(metric.value);
        
        const trend = metric.trend !== 0 
          ? `${metric.trendUp ? '+' : ''}${metric.trend}%`
          : '0%';

        return (
          <div key={key} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 rounded-lg ${color.bg} ${color.text}`}>
                <Icon className="w-5 h-5" />
              </div>
              {loading ? (
                <div className="w-12 h-4 bg-slate-200 rounded animate-pulse"></div>
              ) : (
                <div className={`flex items-center gap-1 text-xs font-medium ${metric.trendUp ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {metric.trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {trend}
                </div>
              )}
            </div>
            <div>
              {loading ? (
                <div className="h-8 w-20 bg-slate-200 rounded animate-pulse mb-2"></div>
              ) : (
                <p className="text-2xl font-bold text-slate-800">{value}</p>
              )}
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
