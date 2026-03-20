import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  apiCreatePlacement,
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
import type {
  CreatePlacementPayload,
  MarkFailedPayload,
  MarkJoinedPayload,
  Placement,
  PlacementFilters,
  PlacementStats,
  RequestReplacementPayload,
} from '../types/placement';

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
    limit: Number(filters.limit || 20),
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
          limit: Number(filters.limit || 20),
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
        apiGetCandidates({ page: 1, limit: 100 }),
        apiGetJobs({ page: 1, limit: 100, status: 'OPEN' }),
        apiGetClients({ page: 1, limit: 100 }),
        apiGetUsers({ page: 1, limit: 100, role: 'RECRUITER' }),
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
      setJobOptions(
        jobs.map((job: any) => ({
          id: job.id,
          title: job.title,
          clientId: job.client?.id,
          clientName: job.client?.companyName || 'Unknown Client',
        }))
      );
      setClientOptions(
        clients.map((client: any) => ({
          id: client.id,
          companyName: client.companyName,
        }))
      );
      setRecruiterOptions(
        users.map((user: any) => ({
          id: user.id,
          name: user.name,
          email: user.email,
        }))
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
          await apiCreatePlacement(payload, offerLetter);
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
