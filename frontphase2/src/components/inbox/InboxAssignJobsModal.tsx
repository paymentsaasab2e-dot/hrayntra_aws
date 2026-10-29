'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase, Loader2, Search, X } from 'lucide-react';
import { apiGetJobs, type BackendJob } from '../../lib/api';
import { parseJobsListFromResponse } from '../../lib/parseApiList';

type InboxAssignJobsModalProps = {
  open: boolean;
  filename?: string;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: (jobIds: string[]) => void;
};

export function InboxAssignJobsModal({
  open,
  filename,
  submitting = false,
  onClose,
  onConfirm,
}: InboxAssignJobsModalProps) {
  const [jobs, setJobs] = useState<BackendJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setSelectedIds([]);
    setError('');
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const res = await apiGetJobs({ page: 1, limit: 200 });
        if (cancelled) return;
        setJobs(parseJobsListFromResponse(res));
      } catch (loadError: unknown) {
        if (cancelled) return;
        setJobs([]);
        setError(loadError instanceof Error ? loadError.message : 'Failed to load jobs');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const filteredJobs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return jobs;
    return jobs.filter((job) => {
      const haystack = [
        job.title,
        job.client?.companyName,
        job.location,
        job.statusLabel || job.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [jobs, search]);

  if (!open) return null;

  const toggleJob = (jobId: string) => {
    setSelectedIds((prev) =>
      prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId],
    );
  };

  const allFilteredSelected =
    filteredJobs.length > 0 && filteredJobs.every((job) => selectedIds.includes(job.id));

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={submitting ? undefined : onClose} />
      <div className="relative flex max-h-[min(36rem,86vh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#dadce0] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#eceff1] px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[#202124]">
              <Briefcase className="h-4 w-4 text-[#1a73e8]" />
              <h2 className="text-lg font-semibold">Assign the job</h2>
            </div>
            <p className="mt-1 text-xs text-[#5f6368]">
              Select one or more jobs this candidate should be applied to
              {filename ? ` after parsing ${filename}` : ''}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-full p-1.5 text-[#5f6368] hover:bg-[#f1f3f4] disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-[#eceff1] px-5 py-3">
          <div className="flex items-center gap-2 rounded-full border border-[#dadce0] bg-[#f8f9fa] px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-[#5f6368]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search jobs you can access"
              className="w-full bg-transparent text-sm text-[#202124] outline-none placeholder:text-[#80868b]"
              disabled={submitting}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#5f6368]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading jobs…
            </div>
          ) : error ? (
            <p className="px-3 py-8 text-center text-sm text-rose-600">{error}</p>
          ) : filteredJobs.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-[#5f6368]">
              {jobs.length === 0 ? 'No jobs available for your account.' : 'No jobs match this search.'}
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  if (allFilteredSelected) {
                    const visible = new Set(filteredJobs.map((job) => job.id));
                    setSelectedIds((prev) => prev.filter((id) => !visible.has(id)));
                  } else {
                    setSelectedIds((prev) => [
                      ...new Set([...prev, ...filteredJobs.map((job) => job.id)]),
                    ]);
                  }
                }}
                disabled={submitting}
                className="mb-1 w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium text-[#1a73e8] hover:bg-[#e8f0fe]"
              >
                {allFilteredSelected ? 'Clear visible jobs' : 'Select all visible jobs'}
              </button>
              {filteredJobs.map((job) => {
                const checked = selectedIds.includes(job.id);
                return (
                  <label
                    key={job.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-[#f8f9fa] ${
                      checked ? 'bg-[#e8f0fe]' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleJob(job.id)}
                      disabled={submitting}
                      className="mt-1 h-4 w-4 rounded border-[#9aa0a6] text-[#1a73e8]"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-[#202124]">{job.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-[#5f6368]">
                        {[job.client?.companyName, job.location, job.statusLabel || job.status]
                          .filter(Boolean)
                          .join(' · ') || 'Job'}
                      </span>
                    </span>
                  </label>
                );
              })}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#eceff1] px-5 py-3">
          <p className="text-xs text-[#5f6368]">
            {selectedIds.length} job{selectedIds.length === 1 ? '' : 's'} selected
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-full border border-[#dadce0] px-4 py-2 text-sm text-[#202124] hover:bg-[#f1f3f4] disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting || selectedIds.length === 0}
              onClick={() => onConfirm(selectedIds)}
              className="inline-flex items-center gap-2 rounded-full bg-[#1a73e8] px-4 py-2 text-sm font-medium text-white hover:bg-[#1557b0] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Parse & apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
