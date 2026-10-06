'use client';

import React, { useState, useEffect } from 'react';
import { Gauge, Zap, CheckCircle2, ChevronRight, Activity } from 'lucide-react';

export interface SpeedMetricBadgeProps {
  /** Elapsed time in milliseconds */
  timeMs: number | null;
  /** Label for what is being measured (e.g., "Render", "Load", "Submit") */
  label?: string;
  /** Optional network or backend latency in ms */
  serverMs?: number | null;
  /** Visual variant: 'pill' for headers, 'floating' for top-right fixed overlay, 'compact' for tight spaces */
  variant?: 'pill' | 'floating' | 'compact';
  /** Optional custom position class if variant is 'floating' */
  positionClass?: string;
  /** Additional custom className */
  className?: string;
  /** If true, shows expanded diagnostics on click or hover */
  showDetails?: boolean;
}

export function SpeedMetricBadge({
  timeMs,
  label = 'Speed',
  serverMs = null,
  variant = 'pill',
  positionClass = 'top-4 right-14 z-[9999]',
  className = '',
  showDetails = true,
}: SpeedMetricBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (timeMs === null || timeMs === undefined) return null;

  const isFast = timeMs < 100;
  const isModerate = timeMs >= 100 && timeMs < 400;

  const colorClasses = isFast
    ? 'border-emerald-200/90 bg-emerald-50/90 text-emerald-800'
    : isModerate
    ? 'border-amber-200/90 bg-amber-50/90 text-amber-800'
    : 'border-rose-200/90 bg-rose-50/90 text-rose-800';

  const dotClasses = isFast
    ? 'bg-emerald-500'
    : isModerate
    ? 'bg-amber-500'
    : 'bg-rose-500';

  const pingClasses = isFast
    ? 'bg-emerald-400'
    : isModerate
    ? 'bg-amber-400'
    : 'bg-rose-400';

  if (variant === 'floating') {
    return (
      <div
        className={`fixed ${positionClass} flex items-center gap-2 select-none shadow-md backdrop-blur-md rounded-full px-3 py-1 text-xs font-medium border transition-all duration-200 ${colorClasses} ${className}`}
        onClick={() => showDetails && setIsExpanded(!isExpanded)}
        title={`${label}: ${timeMs}ms ${serverMs ? `(Server: ${serverMs}ms)` : ''}`}
      >
        <span className="relative flex h-2 w-2">
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${pingClasses}`} />
          <span className={`relative inline-flex h-2 w-2 rounded-full ${dotClasses}`} />
        </span>
        <Zap size={13} className="shrink-0 opacity-80" />
        <span className="font-semibold">{label}:</span>
        <span className="font-mono tabular-nums font-bold">{timeMs}ms</span>
        {serverMs ? (
          <span className="text-[10px] opacity-75 font-mono">(srv {serverMs}ms)</span>
        ) : null}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-mono font-semibold border ${colorClasses} ${className}`}
        title={`${label}: ${timeMs}ms`}
      >
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotClasses}`} />
        <span>{timeMs}ms</span>
      </span>
    );
  }

  // Default 'pill' variant (for drawer headers & toolbars)
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-xs backdrop-blur-sm transition-all duration-150 ${colorClasses} ${className}`}
      title={`${label} duration: ${timeMs}ms ${serverMs ? `(Backend: ${serverMs}ms)` : ''}`}
    >
      <span className="relative flex h-2 w-2">
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${pingClasses}`} />
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dotClasses}`} />
      </span>
      <span className="text-[10px] uppercase tracking-wider opacity-75">{label}</span>
      <span className="font-mono tabular-nums">{timeMs} ms</span>
      {serverMs ? (
        <span className="border-l border-current/20 pl-1 text-[10px] opacity-80 font-mono">
          API {serverMs}ms
        </span>
      ) : null}
    </div>
  );
}

/**
 * Hook to measure rendering / execution speed of any component or modal
 */
export function useSpeedMeasure(active: boolean, triggerKey?: string | number | null) {
  const [speedMs, setSpeedMs] = useState<number | null>(null);

  useEffect(() => {
    if (active) {
      const t0 = performance.now();
      const raf = requestAnimationFrame(() => {
        const elapsed = Math.max(1, Math.round(performance.now() - t0));
        setSpeedMs(elapsed);
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setSpeedMs(null);
    }
  }, [active, triggerKey]);

  return speedMs;
}
