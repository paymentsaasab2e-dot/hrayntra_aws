import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CreatePlacementInvoicePayload } from '../types/recruitmentInvoice';
import {
  apiCreatePlacement,
  apiCreatePlacementInvoice,
  apiUpdatePlacement,
  apiUpdatePlacementStatus,
  apiDeletePlacement,
  apiExportPlacements,
  apiGetCandidates,
  apiGetClients,
  apiGetJobs,
  apiGetPlacementStats,
  apiGetPlacements,
  apiGetUsers,
  apiMarkPlacementFailed,
  apiMarkPlacementJoined,
  apiRequestPlacementReplacement,
} from '../lib/api';
import { PLACEMENT_FORM_JOBS_PARAMS } from '../lib/myJobsListParams';
import type {
  CreatePlacementPayload,
  MarkFailedPayload,
  MarkJoinedPayload,
  Placement,
  PlacementFilters,
  PlacementStats,
  RequestReplacementPayload,
} from '../types/placement';
import { coerceTablePageSize } from '../constants/tablePagination';

function unwrapCollection<T>(value: T[] | { data?: T[]; pagination?: any } | undefined | null): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

export function usePlacements(filters: PlacementFilters) {
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [stats, setStats] = useState<PlacementStats>({
    totalPlacements: 0,
    placementsThisMonth: 0,
    joiningPending: 0,
    joined: 0,
    revenueGenerated: 0,
  });
  const [pagination, setPagination] = useState({
    total: 0,
    page: Number(filters.page || 1),
    limit: coerceTablePageSize(filters.limit, 10),
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [candidateOptions, setCandidateOptions] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [jobOptions, setJobOptions] = useState<Array<{ id: string; title: string; clientId?: string; clientName: string }>>([]);
  const [clientOptions, setClientOptions] = useState<Array<{ id: string; companyName: string }>>([]);
  const [recruiterOptions, setRecruiterOptions] = useState<Array<{ id: string; name: string; email: string }>>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [placementRes, statsRes] = await Promise.all([apiGetPlacements(filters), apiGetPlacementStats()]);
      const payload = placementRes?.data;
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : [];
      if (process.env.NODE_ENV === 'development' && list.length >= 0) {
        console.log('[usePlacements] GET placements: count=', list.length, 'payload keys=', payload ? Object.keys(payload) : []);
      }
      setPlacements(list);
      setPagination(
        (payload && !Array.isArray(payload) && payload.pagination) || {
          total: 0,
          page: Number(filters.page || 1),
          limit: coerceTablePageSize(filters.limit, 10),
          totalPages: 1,
        }
      );
      setStats(
        statsRes?.data ?? {
          totalPlacements: 0,
          placementsThisMonth: 0,
          joiningPending: 0,
          joined: 0,
          revenueGenerated: 0,
        }
      );
    } catch (fetchError: any) {
      setError(fetchError.message || 'Failed to load placements');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchOptions = useCallback(async () => {
    try {
      const [candidatesRes, jobsRes, clientsRes, usersRes] = await Promise.all([
        apiGetCandidates({ page: 1, limit: 500 }),
        apiGetJobs(PLACEMENT_FORM_JOBS_PARAMS),
        apiGetClients({ page: 1, limit: 500 }),
        apiGetUsers({ page: 1, limit: 500, isActive: true }),
      ]);

      const candidates = unwrapCollection(candidatesRes.data as any);
      const jobs = unwrapCollection(jobsRes.data as any);
      const clients = unwrapCollection(clientsRes.data as any);
      const users = unwrapCollection(usersRes.data as any);

      setCandidateOptions(
        candidates.map((candidate: any) => ({
          id: candidate.id,
          name: `${candidate.firstName} ${candidate.lastName}`.trim(),
          email: candidate.email,
        }))
      );
      const sortedJobs = [...jobs].sort((a: any, b: any) =>
        String(a?.title || '').localeCompare(String(b?.title || ''), undefined, {
          sensitivity: 'base',
        }),
      );
      setJobOptions(
        sortedJobs.map((job: any) => ({
          id: job.id,
          title: job.title,
          clientId: job.client?.id || job.clientId || undefined,
          clientName: job.client?.companyName || 'No client linked',
          clientEmail: (() => {
            const c = job.client;
            if (!c) return '';
            const fromEmails = Array.isArray(c.emails)
              ? c.emails.map((e: string) => String(e || '').trim()).find(Boolean)
              : '';
            const fromContacts = Array.isArray(c.contacts)
              ? c.contacts.map((ct: { email?: string }) => String(ct?.email || '').trim()).find(Boolean)
              : '';
            return fromEmails || c.teamMemberEmail?.trim() || fromContacts || '';
          })(),
        }))
      );
      setClientOptions(
        clients.map((client: any) => ({
          id: client.id,
          companyName: client.companyName,
        }))
      );
      const sortedUsers = [...users].sort((a: any, b: any) =>
        String(a?.name || a?.email || '').localeCompare(String(b?.name || b?.email || ''), undefined, {
          sensitivity: 'base',
        }),
      );
      setRecruiterOptions(
        sortedUsers.map((user: any) => ({
          id: user.id,
          name:
            String(user.name || '').trim() ||
            `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
            user.email ||
            'Team member',
          email: user.email,
        })),
      );
    } catch {
      // Keep page usable even if dropdown data partially fails.
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  const actions = useMemo(
    () => ({
      async createPlacement(payload: CreatePlacementPayload, offerLetter?: File | null) {
        setSubmitting(true);
        try {
          const response = await apiCreatePlacement(payload, offerLetter);
          await fetchData();
          return response?.data;
        } finally {
          setSubmitting(false);
        }
      },
      async updatePlacement(id: string, payload: CreatePlacementPayload) {
        setSubmitting(true);
        try {
          const response = await apiUpdatePlacement(id, payload);
          await fetchData();
          return response?.data;
        } finally {
          setSubmitting(false);
        }
      },
      async updatePlacementStatus(id: string, status: string) {
        setSubmitting(true);
        try {
          await apiUpdatePlacementStatus(id, status);
          await fetchData();
        } finally {
          setSubmitting(false);
        }
      },
      async markJoined(id: string, payload: MarkJoinedPayload, joiningLetter?: File | null) {
        setSubmitting(true);
        try {
          await apiMarkPlacementJoined(id, payload, joiningLetter);
          await fetchData();
        } finally {
          setSubmitting(false);
        }
      },
      async markFailed(id: string, payload: MarkFailedPayload) {
        setSubmitting(true);
        try {
          await apiMarkPlacementFailed(id, payload);
          await fetchData();
        } finally {
          setSubmitting(false);
        }
      },
      async requestReplacement(id: string, payload: RequestReplacementPayload) {
        setSubmitting(true);
        try {
          await apiRequestPlacementReplacement(id, payload);
          await fetchData();
        } finally {
          setSubmitting(false);
        }
      },
      async deletePlacement(id: string) {
        setSubmitting(true);
        try {
          await apiDeletePlacement(id);
          await fetchData();
        } finally {
          setSubmitting(false);
        }
      },
      async createInvoice(placementId: string, payload: CreatePlacementInvoicePayload) {
        setSubmitting(true);
        try {
          const response = await apiCreatePlacementInvoice(placementId, payload);
          await fetchData();
          return response?.data;
        } finally {
          setSubmitting(false);
        }
      },
      async exportPlacements() {
        return apiExportPlacements(filters);
      },
      refresh: fetchData,
    }),
    [fetchData, filters]
  );

  return {
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
    ...actions,
  };
}
