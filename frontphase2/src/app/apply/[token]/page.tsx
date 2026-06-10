'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Briefcase, ChevronRight, CheckCircle2 } from 'lucide-react';
import { apiGetPublicApplyPage, apiSubmitPublicApply } from '../../../lib/api';
import {
  normalizeApplicationFormSchema,
  type ApplicationFormSchema,
} from '../../../lib/applicationFormTypes';
import { PublicJobApplyForm } from '../../../components/jobs/PublicJobApplyForm';
import { PublicJobOverviewPanel } from '../../../components/jobs/PublicJobOverviewPanel';

interface PublicJobSummary {
  id: string;
  title: string;
  company?: string | null;
  companyLogo?: string | null;
  location?: string | null;
  description?: string | null;
  overview?: string | null;
  keyResponsibilities?: string[];
  requirements?: string[];
  candidateRequirements?: string[];
  skills?: string[];
  preferredSkills?: string[];
  experienceRequired?: string | null;
  education?: string | null;
  benefits?: string[];
  employmentType?: string | null;
  workMode?: string | null;
  openings?: number;
  salary?: unknown;
  applicationFormNote?: string | null;
  applicationFormLogo?: string | null;
}

type Step = 'overview' | 'form' | 'done';

export default function PublicJobApplyPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = typeof params?.token === 'string' ? params.token : '';
  const tenantDbName =
    searchParams.get('tenantDbName')?.trim() ||
    searchParams.get('tenant')?.trim() ||
    '';

  const [step, setStep] = useState<Step>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [job, setJob] = useState<PublicJobSummary | null>(null);
  const [formSchema, setFormSchema] = useState<ApplicationFormSchema | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid apply link');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    void apiGetPublicApplyPage(token, tenantDbName || undefined)
      .then((res) => {
        const payload = (res as { data?: { job?: PublicJobSummary; formSchema?: unknown } })?.data ?? res;
        const data = payload as { job?: PublicJobSummary; formSchema?: unknown };
        if (cancelled) return;
        setJob(data.job || null);
        const schema = normalizeApplicationFormSchema(data.formSchema);
        setFormSchema(schema);
        if (!data.job) setError('Job not found');
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load application');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, tenantDbName]);

  const handleSubmit = async (payload: {
    answers: Record<string, unknown>;
    files: Record<string, File>;
  }) => {
    setSubmitting(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('answers', JSON.stringify(payload.answers));
      if (tenantDbName) {
        fd.append('tenantDbName', tenantDbName);
      }
      Object.entries(payload.files).forEach(([fieldId, file]) => {
        fd.append(fieldId, file);
      });
      await apiSubmitPublicApply(token, fd, tenantDbName || undefined);
      setStep('done');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <p className="text-slate-600">Loading application…</p>
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <p className="text-red-700 font-medium">{error}</p>
          {!tenantDbName ? (
            <p className="mt-3 text-sm text-slate-600">
              This apply link is missing the tenant parameter. Ask the recruiter for a full link that
              includes <span className="font-mono text-slate-800">?tenantDbName=…</span> in the URL.
            </p>
          ) : (
            <p className="mt-3 text-sm text-slate-600">
              Tenant: <span className="font-mono font-medium">{tenantDbName}</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-lg">
          <CheckCircle2 className="mx-auto text-emerald-500" size={48} />
          <h1 className="mt-4 text-xl font-bold text-slate-900">Application submitted</h1>
          <p className="mt-2 text-slate-600">
            Thank you for applying to {job?.title}
            {job?.company ? ` at ${job.company}` : ''}. We will review your submission and get back to you.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-white">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center gap-3">
          {job?.companyLogo ? (
            <img src={job.companyLogo} alt="" className="h-10 w-10 rounded-lg object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Briefcase className="text-indigo-600" size={20} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Job application
            </p>
            <h1 className="text-lg font-bold text-slate-900">{job?.title}</h1>
            {job?.company ? (
              <p className="text-sm text-slate-600">{job.company}</p>
            ) : null}
            {tenantDbName ? (
              <p className="mt-1 text-xs text-slate-500">
                <span className="font-medium text-slate-600">Tenant:</span>{' '}
                <span className="font-mono text-indigo-700">{tenantDbName}</span>
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {step === 'overview' && job ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            <PublicJobOverviewPanel job={job} />
            <button
              type="button"
              onClick={() => setStep('form')}
              className="w-full mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Next — fill application form
              <ChevronRight size={18} />
            </button>
          </div>
        ) : null}

        {step === 'form' && formSchema ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <button
              type="button"
              onClick={() => setStep('overview')}
              className="mb-4 text-sm text-indigo-600 hover:underline"
            >
              ← Back to job details
            </button>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Application form</h2>
            <p className="text-sm text-slate-600 mb-6">
              Complete all required fields. Your responses will be saved as your application.
            </p>
            {error ? (
              <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}
            <PublicJobApplyForm
              schema={formSchema}
              note={job?.applicationFormNote}
              logoUrl={job?.applicationFormLogo}
              submitting={submitting}
              onSubmit={handleSubmit}
            />
          </div>
        ) : step === 'form' ? (
          <p className="text-center text-slate-600">No application form configured for this job.</p>
        ) : null}
      </main>
    </div>
  );
}
