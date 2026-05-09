'use client';

import React from 'react';

/**
 * Skeleton primitives that share a single left-to-right shimmer animation.
 *
 *  - `<Skeleton />` — a single bar/rounded block. Pass width/height via
 *    Tailwind classes (`h-4 w-32`, `rounded-xl`, etc.). The shimmer keyframes
 *    are scoped to this component via `<style jsx>` so no global CSS is
 *    required.
 *
 *  - `<SkeletonCard />` — a generic card-shaped loader (header strip + a few
 *    text rows) used as a default tile placeholder.
 *
 *  - `<PageSkeleton />` — a full page scaffold: title bar + KPI tile row +
 *    chart row + activity row. This is what most list/dashboard pages render
 *    while they fetch their first page of data.
 *
 * The shimmer animation moves a translucent gradient from left to right
 * across each placeholder ~1.4s/loop — chosen to feel responsive without
 * being distracting.
 */

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** When true the element renders without the moving shimmer overlay. */
  noShimmer?: boolean;
}

export function Skeleton({ className = '', noShimmer = false, ...rest }: SkeletonProps) {
  return (
    <div
      {...rest}
      className={`relative overflow-hidden bg-slate-100 ${className}`}
      aria-hidden
    >
      {!noShimmer ? <span className="ph2-skel-shimmer" /> : null}
      <style jsx>{`
        :global(.ph2-skel-shimmer) {
          position: absolute;
          inset: 0;
          background-image: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.6) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          animation: ph2-skel-shimmer 1.4s linear infinite;
          will-change: transform;
        }
        @keyframes ph2-skel-shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}

interface SkeletonCardProps {
  /** Optional extra height (e.g. 'h-32', 'h-44'). Default 'h-32'. */
  heightClass?: string;
  /** Number of body lines under the header strip. Default 3. */
  lines?: number;
  className?: string;
}

export function SkeletonCard({ heightClass = 'h-32', lines = 3, className = '' }: SkeletonCardProps) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <Skeleton className="rounded-md h-4 w-1/3 mb-4" />
      <Skeleton className={`rounded-md w-full ${heightClass}`} />
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={`h-3 rounded-full ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
        ))}
      </div>
    </div>
  );
}

interface PageSkeletonProps {
  /** How many KPI tiles to show. Default 4. */
  kpiCount?: number;
  /** Show the chart row (jobs/clients/pie). Default true. */
  showCharts?: boolean;
  /** Show the activity strip. Default true. */
  showActivity?: boolean;
  /** Outer padding (matches dashboard / list pages). */
  className?: string;
}

export function PageSkeleton({
  kpiCount = 4,
  showCharts = true,
  showActivity = true,
  className = '',
}: PageSkeletonProps) {
  return (
    <div className={`space-y-8 p-8 ${className}`} role="status" aria-label="Loading…">
      <div className="flex items-end justify-between">
        <Skeleton className="rounded-md h-7 w-48" />
        <Skeleton className="rounded-xl h-9 w-24" />
      </div>

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}
      >
        {Array.from({ length: kpiCount }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between">
              <Skeleton className="rounded-xl h-10 w-10" />
              <Skeleton className="rounded-md h-4 w-12" />
            </div>
            <Skeleton className="rounded-md h-3 w-1/2 mb-2" />
            <Skeleton className="rounded-md h-6 w-1/3" />
          </div>
        ))}
      </div>

      {showCharts ? (
        <div
          className="grid gap-6"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" style={{ gridColumn: 'span 2' }}>
            <Skeleton className="rounded-md h-4 w-1/3 mb-6" />
            <Skeleton className="rounded-md h-[260px] w-full" />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <Skeleton className="rounded-md h-4 w-1/3 mb-6" />
            <div className="flex h-[260px] items-center justify-center">
              <Skeleton className="rounded-full h-44 w-44" />
            </div>
          </div>
        </div>
      ) : null}

      {showActivity ? (
        <div
          className="grid gap-6"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
        >
          {[0, 1, 2].map((card) => (
            <div key={card} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <Skeleton className="rounded-md h-4 w-1/3 mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="rounded-full h-8 w-8" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-3/4 rounded-full" />
                      <Skeleton className="h-2 w-1/3 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

/** Lightweight table-style skeleton for list pages (Jobs, Leads, Clients…). */
export function TableSkeleton({ rows = 8, columns = 6, className = '' }: TableSkeletonProps) {
  const colTemplate = `repeat(${columns}, minmax(0, 1fr))`;
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${className}`} role="status" aria-label="Loading…">
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: colTemplate }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 rounded-full" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="grid gap-4 items-center" style={{ gridTemplateColumns: colTemplate }}>
            {Array.from({ length: columns }).map((__, c) => (
              <Skeleton
                key={c}
                className={`rounded-md ${c === 0 ? 'h-6' : 'h-3'} ${c === columns - 1 ? 'w-1/2' : 'w-full'}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
