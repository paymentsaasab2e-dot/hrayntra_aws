'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Download, Plus } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { FiltersBar } from '../../components/placements/FiltersBar';
import { KPICards } from '../../components/placements/KPICards';
import { PlacementsTable } from '../../components/placements/PlacementsTable';
import { CreatePlacementDrawer } from '../../components/placements/modals/CreatePlacementDrawer';
import { MarkFailedDrawer } from '../../components/placements/modals/MarkFailedDrawer';
import { MarkJoinedDrawer } from '../../components/placements/modals/MarkJoinedDrawer';
import { RequestReplacementDrawer } from '../../components/placements/modals/RequestReplacementDrawer';
import { usePlacements } from '../../hooks/usePlacements';
import type { Placement, PlacementFilters } from '../../types/placement';

export const dynamic = 'force-dynamic';

function getFiltersFromParams(searchParams: URLSearchParams): PlacementFilters {
  return {
    page: Number(searchParams.get('page') || 1),
    limit: Number(searchParams.get('limit') || 20),
    search: searchParams.get('search') || '',
    status: (searchParams.get('status') || '') as any,
    companyId: searchParams.get('companyId') || '',
    recruiterId: searchParams.get('recruiterId') || '',
    employmentType: (searchParams.get('employmentType') || '') as any,
    offerDateFrom: searchParams.get('offerDateFrom') || '',
    offerDateTo: searchParams.get('offerDateTo') || '',
    joiningDateFrom: searchParams.get('joiningDateFrom') || '',
    joiningDateTo: searchParams.get('joiningDateTo') || '',
    revenueMin: searchParams.get('revenueMin') || '',
    revenueMax: searchParams.get('revenueMax') || '',
    feeMin: searchParams.get('feeMin') || '',
    feeMax: searchParams.get('feeMax') || '',
    sortBy: searchParams.get('sortBy') || 'offerDate',
    sortOrder: (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc',
  };
}

function PlacementsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(() => getFiltersFromParams(new URLSearchParams(searchParams.toString())), [searchParams]);
  const [searchValue, setSearchValue] = useState(filters.search || '');
  const [createOpen, setCreateOpen] = useState(false);
  const createPrefill = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    const shouldOpen = params.get('create') === '1' || params.get('create') === 'true';
    const candidateId = params.get('candidateId') || '';
    const jobId = params.get('jobId') || '';
    const recruiterId = params.get('recruiterId') || '';
    return {
      shouldOpen,
      prefill: {
        ...(candidateId ? { candidateId } : null),
        ...(jobId ? { jobId } : null),
        ...(recruiterId ? { recruiterId } : null),
      },
    };
  }, [searchParams]);
  const [joinedPlacement, setJoinedPlacement] = useState<Placement | null>(null);
  const [failedPlacement, setFailedPlacement] = useState<Placement | null>(null);
  const [failedMode, setFailedMode] = useState<'FAILED' | 'NO_SHOW'>('FAILED');
  const [replacementPlacement, setReplacementPlacement] = useState<Placement | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();

  const {
    placements,
    stats,
    pagination,
    loading,
    error,
    submitting,
    candidateOptions,
    jobOptions,
    clientOptions,
    recruiterOptions,
    createPlacement,
    markJoined,
    markFailed,
    requestReplacement,
    deletePlacement,
    exportPlacements,
  } = usePlacements(filters);

  useEffect(() => {
    setSearchValue(filters.search || '');
  }, [filters.search]);

  useEffect(() => {
    try {
      const currentUser = localStorage.getItem('currentUser');
      if (!currentUser) return;
      const parsed = JSON.parse(currentUser);
      setCurrentUserId(parsed.id);
    } catch {
      setCurrentUserId(undefined);
    }
  }, []);

  const updateFilters = (patch: Partial<PlacementFilters>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });

    const resetPage = Object.keys(patch).some((key) => key !== 'page');
    if (resetPage) {
      params.set('page', '1');
    }

    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`);
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (searchValue !== (filters.search || '')) {
        updateFilters({ search: searchValue });
      }
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchValue, filters.search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (createPrefill.shouldOpen) {
      setCreateOpen(true);
    }
  }, [createPrefill.shouldOpen]);

  return (
    <div className="min-h-screen w-full bg-[#F8F9FB] text-[#111827]">
      <Toaster position="top-right" richColors />
      <main className="p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Placements</h1>
              <p className="mt-1 text-sm text-slate-500">Manage and track candidates who have accepted offers.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const blob = await exportPlacements();
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'placements-export.csv';
                    link.click();
                    URL.revokeObjectURL(url);
                    toast.success('Placement export downloaded');
                  } catch (exportError: any) {
                    toast.error(exportError.message || 'Failed to export placements');
                  }
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-[#D1D5DB] bg-white px-4 py-2.5 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB]"
              >
                <Download className="h-4 w-4" />
                Export Data
              </button>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8]"
              >
                <Plus className="h-4 w-4" />
                Add Manual Placement
              </button>
            </div>
          </div>

          <KPICards stats={stats} />

          <FiltersBar
            filters={filters}
            searchValue={searchValue}
            clientOptions={clientOptions}
            recruiterOptions={recruiterOptions}
            onSearchChange={setSearchValue}
            onFilterChange={updateFilters}
            onReset={() => router.replace(pathname)}
          />

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}

          <PlacementsTable
            data={placements}
            pagination={pagination}
            isLoading={loading}
            sortBy={filters.sortBy}
            sortOrder={filters.sortOrder}
            onSort={(column) =>
              updateFilters({
                sortBy: column,
                sortOrder: filters.sortBy === column && filters.sortOrder === 'desc' ? 'asc' : 'desc',
              })
            }
            onView={(placement) => router.push(`/placements/${placement.id}`)}
            onMarkJoined={(placement) => setJoinedPlacement(placement)}
            onMarkFailed={(placement, mode) => {
              setFailedPlacement(placement);
              setFailedMode(mode);
            }}
            onRequestReplacement={(placement) => setReplacementPlacement(placement)}
            onDelete={async (placement) => {
              if (!window.confirm('Delete this placement?')) return;
              try {
                await deletePlacement(placement.id);
                toast.success('Placement deleted successfully');
              } catch (deleteError: any) {
                toast.error(deleteError.message || 'Failed to delete placement');
              }
            }}
            onPageChange={(page) => updateFilters({ page })}
          />
        </div>
      </main>

      <CreatePlacementDrawer
        isOpen={createOpen}
        isSubmitting={submitting}
        currentUserId={currentUserId}
        candidates={candidateOptions}
        jobs={jobOptions}
        recruiters={recruiterOptions}
        prefill={createPrefill.prefill}
        onClose={() => setCreateOpen(false)}
        onSubmit={async (payload, file) => {
          try {
            await createPlacement(payload, file);
            setCreateOpen(false);
            toast.success('Placement created successfully');
          } catch (submitError: any) {
            toast.error(submitError.message || 'Failed to create placement');
          }
        }}
      />

      <MarkJoinedDrawer
        isOpen={Boolean(joinedPlacement)}
        placement={joinedPlacement}
        isSubmitting={submitting}
        onClose={() => setJoinedPlacement(null)}
        onSubmit={async (payload, file) => {
          if (!joinedPlacement) return;
          try {
            await markJoined(joinedPlacement.id, payload, file);
            setJoinedPlacement(null);
            toast.success('Marked as joined');
          } catch (submitError: any) {
            toast.error(submitError.message || 'Failed to update placement');
          }
        }}
      />

      <MarkFailedDrawer
        isOpen={Boolean(failedPlacement)}
        placement={failedPlacement}
        mode={failedMode}
        isSubmitting={submitting}
        onClose={() => setFailedPlacement(null)}
        onSubmit={async (payload) => {
          if (!failedPlacement) return;
          try {
            await markFailed(failedPlacement.id, payload);
            setFailedPlacement(null);
            toast.success('Placement status updated');
          } catch (submitError: any) {
            toast.error(submitError.message || 'Failed to update placement');
          }
        }}
      />

      <RequestReplacementDrawer
        isOpen={Boolean(replacementPlacement)}
        placement={replacementPlacement}
        isSubmitting={submitting}
        onClose={() => setReplacementPlacement(null)}
        onSubmit={async (payload) => {
          if (!replacementPlacement) return;
          try {
            await requestReplacement(replacementPlacement.id, payload);
            setReplacementPlacement(null);
            toast.success('Replacement requested');
          } catch (submitError: any) {
            toast.error(submitError.message || 'Failed to request replacement');
          }
        }}
      />
    </div>
  );
}

export default function PlacementsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center text-gray-500">Loading placements...</div>}>
      <PlacementsPageContent />
    </Suspense>
  );
}
