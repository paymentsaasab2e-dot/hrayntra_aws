'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Download, FileText, Plus, RefreshCcw, Trophy } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { FiltersBar } from '../../components/placements/FiltersBar';
import { KPICards } from '../../components/placements/KPICards';
import { PlacementsTable } from '../../components/placements/PlacementsTable';
import { CreatePlacementDrawer } from '../../components/placements/modals/CreatePlacementDrawer';
import { MarkFailedDrawer } from '../../components/placements/modals/MarkFailedDrawer';
import { MarkJoinedDrawer } from '../../components/placements/modals/MarkJoinedDrawer';
import { RequestReplacementDrawer } from '../../components/placements/modals/RequestReplacementDrawer';
import { PlacementDetailsDrawer } from '../../components/drawers/PlacementDetailsDrawer';
import { usePlacements } from '../../hooks/usePlacements';
import type { Placement, PlacementFilters } from '../../types/placement';
import { usePermissions } from '../../hooks/usePermissions';
import { requestConfirm } from '../../lib/appDialog';
import PaginationAll from '../../components/PaginationAll';
import { coerceTablePageSize, TABLE_PAGE_SIZE_OPTIONS } from '../../constants/tablePagination';
import {
  PH2_TABLE_CARD_CLASS,
  PH2_TABLE_CARD_FOOTER_CLASS,
  PH2_TOOLBAR_ROW_CLASS,
} from '../../components/layout/Ph2ModulePageLayout';
import { SummaryCardSkeleton, type SummaryCardColor } from '../../components/ui/SummaryCard';

export const dynamic = 'force-dynamic';

function getFiltersFromParams(searchParams: URLSearchParams): PlacementFilters {
  return {
    page: Number(searchParams.get('page') || 1),
    limit: coerceTablePageSize(searchParams.get('limit'), 10),
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
  const { hasPermission } = usePermissions();
  const canCreatePlacement = hasPermission('placements_create');
  const canUpdatePlacement = hasPermission('placements_update');
  const canDeletePlacement = hasPermission('placements_delete');
  const canExportData = hasPermission('export_data');
  const canCreateInvoice = hasPermission('create_invoice');
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
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [detailPlacementId, setDetailPlacementId] = useState<string | null>(null);
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
    updatePlacementStatus,
    markJoined,
    markFailed,
    requestReplacement,
    deletePlacement,
    exportPlacements,
    refresh,
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
    <>
      <Toaster position="top-right" richColors style={{ top: '5rem' }} />
      <div className="w-full min-h-screen overflow-hidden text-slate-900">
        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <header className="flex min-h-[4.5rem] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-indigo-100/50 bg-white/80 px-4 py-3 shadow-[inset_0_-1px_0_0_rgba(99,102,241,0.08)] backdrop-blur-md sm:px-6">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600 text-white shadow-lg shadow-emerald-500/25 ring-1 ring-white/20">
                <Trophy className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <div>
                <h1 className="text-xl font-bold leading-none tracking-tight text-slate-900 sm:text-[1.35rem]">Placements</h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={loading}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-200/80 bg-white text-indigo-700 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.2)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98] disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCcw size={16} strokeWidth={2.25} className={loading ? 'animate-spin' : ''} />
              </button>
              {canExportData ? (
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
                  className="flex items-center gap-1.5 rounded-lg border border-indigo-200/70 bg-white px-3 py-2 text-xs font-semibold text-indigo-900 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 hover:shadow-[0_6px_20px_-4px_rgba(99,102,241,0.35)] active:scale-[0.98]"
                >
                  <Download size={16} className="text-indigo-600" strokeWidth={2.25} />
                  <span>Export</span>
                </button>
              ) : null}
              {canCreateInvoice ? (
                <button
                  type="button"
                  onClick={() => router.push('/billing?createInvoice=1')}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-amber-800 shadow-[0_4px_14px_-4px_rgba(245,158,11,0.25)] transition-all hover:border-amber-300 hover:bg-amber-50/90 active:scale-[0.98]"
                >
                  <FileText size={16} className="text-amber-600" strokeWidth={2.25} />
                  <span>Create invoice</span>
                </button>
              ) : null}
              {canCreatePlacement ? (
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 active:scale-[0.98]"
                >
                  <Plus size={16} className="text-white" strokeWidth={2.5} />
                  <span>Add manual placement</span>
                </button>
              ) : null}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
            <div className="mx-auto max-w-[1600px]">
              <div className="mb-5">
                {loading ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
                    {(['blue', 'cyan', 'orange', 'purple', 'green'] as SummaryCardColor[]).map((c, i) => (
                      <SummaryCardSkeleton key={i} color={c} />
                    ))}
                  </div>
                ) : (
                  <KPICards stats={stats} />
                )}
              </div>

              <div className={PH2_TABLE_CARD_CLASS}>
                <div className={PH2_TOOLBAR_ROW_CLASS}>
                  <p className="max-w-xl text-xs text-slate-600">
                    Filter by client, status, employment type, and offer date range. Use <span className="font-semibold text-slate-800">Clear</span> when
                    filters are active.
                  </p>
                </div>

                <div className="border-b border-indigo-100/40 px-3 py-3 sm:px-4">
                  <FiltersBar
                    embedded
                    totalCount={pagination.total}
                    filters={filters}
                    searchValue={searchValue}
                    clientOptions={clientOptions}
                    recruiterOptions={recruiterOptions}
                    onSearchChange={setSearchValue}
                    onFilterChange={updateFilters}
                    onReset={() => router.replace(pathname)}
                  />
                </div>

                {error ? (
                  <div className="px-4 py-10 text-center text-sm font-medium text-rose-600">Error: {error}</div>
                ) : (
                  <>
                    <div className="overflow-hidden">
                      <div className="no-scrollbar overflow-x-auto">
                        <PlacementsTable
                          embedded
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
                          onView={(placement) => {
                            setDetailPlacementId(placement.id);
                            setDetailDrawerOpen(true);
                          }}
                          onMarkJoined={canUpdatePlacement ? (placement) => setJoinedPlacement(placement) : undefined}
                          onMarkFailed={
                            canUpdatePlacement
                              ? (placement, mode) => {
                                  setFailedPlacement(placement);
                                  setFailedMode(mode);
                                }
                              : undefined
                          }
                          onRequestReplacement={
                            canUpdatePlacement ? (placement) => setReplacementPlacement(placement) : undefined
                          }
                          onDelete={
                            canDeletePlacement
                              ? async (placement) => {
                                  if (!(await requestConfirm('Delete this placement?'))) return;
                                  try {
                                    await deletePlacement(placement.id);
                                    toast.success('Placement deleted successfully');
                                  } catch (deleteError: any) {
                                    toast.error(deleteError.message || 'Failed to delete placement');
                                  }
                                }
                              : undefined
                          }
                          onStatusChange={
                            canUpdatePlacement
                              ? async (placement, status) => {
                                  try {
                                    await updatePlacementStatus(placement.id, status);
                                    toast.success('Placement status updated');
                                  } catch (statusError: any) {
                                    toast.error(statusError.message || 'Failed to update status');
                                    throw statusError;
                                  }
                                }
                              : undefined
                          }
                          onPageChange={(page) => updateFilters({ page })}
                        />
                      </div>
                    </div>

                    {!loading && placements.length > 0 ? (
                      <div className={PH2_TABLE_CARD_FOOTER_CLASS}>
                        <PaginationAll
                          initialPage={pagination.page}
                          totalPages={Math.max(pagination.totalPages, 1)}
                          totalCount={pagination.total}
                          pageSize={pagination.limit}
                          pageSizeOptions={[...TABLE_PAGE_SIZE_OPTIONS]}
                          onPageSizeChange={(n) => {
                            if (!(TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) return;
                            updateFilters({ limit: n, page: 1 });
                          }}
                          itemLabel="placements"
                          onPageChange={(page) => updateFilters({ page })}
                        />
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        </main>

      <CreatePlacementDrawer
        isOpen={canCreatePlacement && createOpen}
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
        isOpen={canUpdatePlacement && Boolean(joinedPlacement)}
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
        isOpen={canUpdatePlacement && Boolean(failedPlacement)}
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
        isOpen={canUpdatePlacement && Boolean(replacementPlacement)}
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

      <PlacementDetailsDrawer
        isOpen={detailDrawerOpen}
        placementId={detailPlacementId}
        onClose={() => {
          setDetailDrawerOpen(false);
          setDetailPlacementId(null);
        }}
      />
    </div>
    </>
  );
}

export default function PlacementsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center text-gray-500">Loading placements...</div>}>
      <PlacementsPageContent />
    </Suspense>
  );
}
