'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { isStaleClientBundleError, reloadOnceForStaleBundle } from '@/lib/staleClientBundle';

type PageErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type PageErrorBoundaryState = {
  error: Error | null;
};

function hardReload() {
  if (typeof window === 'undefined') return;
  window.location.reload();
}

export function WorkspaceErrorCard({
  error,
  onRetry,
}: {
  error?: Error | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-[#F8FAFC] px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">HRYANTRA</p>
        <h1 className="mt-2 text-xl font-bold text-slate-900">This page couldn’t load</h1>
        <p className="mt-2 text-sm text-slate-500">
          Something went wrong on this screen. The rest of the workspace is still available — open
          another page from the menu, or retry without signing in again.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (error && isStaleClientBundleError(error) && reloadOnceForStaleBundle()) return;
              onRetry();
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Go to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

/** Catches render errors so one screen cannot blank the whole entrepreneur workspace. */
export class PageErrorBoundary extends React.Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  state: PageErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(error, info.componentStack);
    if (isStaleClientBundleError(error)) {
      reloadOnceForStaleBundle();
    }
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;
    return (
      <WorkspaceErrorCard
        error={this.state.error}
        onRetry={() => {
          this.reset();
          hardReload();
        }}
      />
    );
  }
}

/** Remounts on route change so a crash on /candidate cannot stick on /jobs or /dashboard. */
export function RouteErrorBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  return <PageErrorBoundary key={pathname}>{children}</PageErrorBoundary>;
}
