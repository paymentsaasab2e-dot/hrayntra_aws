import { useCallback, useEffect, useState } from 'react';
import type { CreatePlacementInvoicePayload } from '../types/recruitmentInvoice';
import {
  apiCreatePlacement,
  apiCreatePlacementInvoice,
  apiGetCandidates,
  apiGetJobs,
  apiGetPlacements,
  apiGetUsers,
  apiUpdateBillingDraftInvoice,
} from '../lib/api';
import { MY_JOBS_LIST_PARAMS } from '../lib/myJobsListParams';
import { resolveClientEmail } from '../lib/invoiceCurrency';
import type { CreatePlacementPayload, Placement } from '../types/placement';

function unwrapCollection<T>(value: T[] | { data?: T[] } | undefined | null): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

export function usePlacementInvoiceModal(isOpen: boolean) {
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [candidateOptions, setCandidateOptions] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [jobOptions, setJobOptions] = useState<
    Array<{ id: string; title: string; clientId?: string; clientName: string; clientEmail?: string }>
  >([]);
  const [recruiterOptions, setRecruiterOptions] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [placementRes, candidatesRes, jobsRes, usersRes] = await Promise.all([
        apiGetPlacements({ page: 1, limit: 500, sortBy: 'offerDate', sortOrder: 'desc' }),
        apiGetCandidates({ page: 1, limit: 100 }),
        apiGetJobs({ page: 1, ...MY_JOBS_LIST_PARAMS }),
        apiGetUsers({ assignable: true, page: 1, limit: 100, role: 'RECRUITER' }),
      ]);

      const payload = placementRes?.data;
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : [];
      setPlacements(list);

      const candidates = unwrapCollection(candidatesRes.data as any);
      const jobs = unwrapCollection(jobsRes.data as any);
      const users = unwrapCollection(usersRes.data as any);

      setCandidateOptions(
        candidates.map((candidate: any) => ({
          id: candidate.id,
          name: `${candidate.firstName} ${candidate.lastName}`.trim(),
          email: candidate.email,
        })),
      );
      setJobOptions(
        jobs.map((job: any) => ({
          id: job.id,
          title: job.title,
          clientId: job.client?.id,
          clientName: job.client?.companyName || 'Unknown Client',
          clientEmail: resolveClientEmail(job.client),
        })),
      );
      setRecruiterOptions(
        users.map((user: any) => ({
          id: user.id,
          name: user.name,
          email: user.email,
        })),
      );
    } catch {
      // Modal still opens; empty lists show validation in the form.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void load();
    }
  }, [isOpen, load]);

  const createPlacement = useCallback(async (payload: CreatePlacementPayload, offerLetter?: File | null) => {
    setSubmitting(true);
    try {
      const response = await apiCreatePlacement(payload, offerLetter);
      await load();
      return response?.data;
    } finally {
      setSubmitting(false);
    }
  }, [load]);

  const createInvoice = useCallback(
    async (placementId: string, payload: CreatePlacementInvoicePayload) => {
      setSubmitting(true);
      try {
        const response = await apiCreatePlacementInvoice(placementId, payload);
        await load();
        return response?.data;
      } finally {
        setSubmitting(false);
      }
    },
    [load],
  );

  const updateDraftInvoice = useCallback(
    async (billingRecordId: string, payload: CreatePlacementInvoicePayload) => {
      setSubmitting(true);
      try {
        const response = await apiUpdateBillingDraftInvoice(billingRecordId, payload);
        await load();
        return response?.data;
      } finally {
        setSubmitting(false);
      }
    },
    [load],
  );

  return {
    placements,
    candidateOptions,
    jobOptions,
    recruiterOptions,
    loading,
    submitting,
    createPlacement,
    createInvoice,
    updateDraftInvoice,
    refresh: load,
  };
}
