'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  Loader2,
  MapPin,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import {
  apiCreateJob,
  apiGenerateJobFromPrompt,
  apiGetClients,
  apiSuggestJobTitles,
  type BackendClient,
  type CreateJobData,
  type JobCreationPipelineResult,
} from '@/lib/api';
import { LocationAutocomplete } from '@/components/LocationAutocomplete';
import { RichTextEditor } from '@/components/RichTextEditor';
import { JOB_SALARY_CURRENCY_OPTIONS } from '@/constants/jobSalary';

type WizardStep = 'client' | 'title' | 'location' | 'prompt' | 'review';

type WizardDraft = {
  clientId: string;
  clientName: string;
  jobTitle: string;
  locationQuery: string;
  country: string;
  state: string;
  city: string;
  extraPrompt: string;
  nationality: string;
  priority: string;
  numberOfOpenings: string;
  industryType: string;
  employmentType: string;
  targetHireDate: string;
  minExperience: string;
  maxExperience: string;
  salaryCurrency: string;
  payRangeMin: string;
  payRangeMax: string;
  jobDescriptionHtml: string;
  keyResponsibilitiesText: string;
  qualificationsExperienceText: string;
  candidateRequirementsText: string;
  skillsText: string;
  languagesText: string;
};

const EMPTY_DRAFT: WizardDraft = {
  clientId: '',
  clientName: '',
  jobTitle: '',
  locationQuery: '',
  country: '',
  state: '',
  city: '',
  extraPrompt: '',
  nationality: '',
  priority: 'Medium',
  numberOfOpenings: '1',
  industryType: '',
  employmentType: 'Full Time',
  targetHireDate: '',
  minExperience: '0',
  maxExperience: '10',
  salaryCurrency: 'USD',
  payRangeMin: '',
  payRangeMax: '',
  jobDescriptionHtml: '',
  keyResponsibilitiesText: '',
  qualificationsExperienceText: '',
  candidateRequirementsText: '',
  skillsText: '',
  languagesText: '',
};

function defaultTargetHireDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

function toList(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean);
}

function mapJobType(value: string): CreateJobData['type'] {
  const v = value.toLowerCase();
  if (v.includes('part')) return 'PART_TIME';
  if (v.includes('contract')) return 'CONTRACT';
  if (v.includes('intern')) return 'INTERNSHIP';
  if (v.includes('freelance')) return 'FREELANCE';
  return 'FULL_TIME';
}

function pipelineToDraft(
  base: WizardDraft,
  data: JobCreationPipelineResult,
): WizardDraft {
  return {
    ...base,
    jobTitle: data.jobTitle || base.jobTitle,
    nationality: data.nationality || base.nationality,
    priority: data.priority || base.priority,
    numberOfOpenings: data.numberOfOpenings || base.numberOfOpenings,
    country: data.country || base.country,
    state: data.state || base.state,
    city: data.city || base.city,
    locationQuery:
      [data.city, data.state, data.country].filter(Boolean).join(', ') || base.locationQuery,
    industryType: data.industryType || base.industryType,
    employmentType: data.employmentType || base.employmentType,
    targetHireDate: data.targetHireDate || base.targetHireDate || defaultTargetHireDate(),
    minExperience:
      data.minExperience != null ? String(data.minExperience) : base.minExperience,
    maxExperience:
      data.maxExperience != null ? String(data.maxExperience) : base.maxExperience,
    salaryCurrency: data.salaryCurrency || base.salaryCurrency,
    payRangeMin: data.payRangeMin || base.payRangeMin,
    payRangeMax: data.payRangeMax || base.payRangeMax,
    jobDescriptionHtml: data.jobDescriptionHtml || base.jobDescriptionHtml,
    keyResponsibilitiesText:
      data.keyResponsibilitiesText || base.keyResponsibilitiesText,
    qualificationsExperienceText:
      data.qualificationsExperienceText || base.qualificationsExperienceText,
    candidateRequirementsText:
      data.candidateRequirementsText || base.candidateRequirementsText,
    skillsText: (data.skills || []).join('\n') || base.skillsText,
    languagesText:
      (data.languages || [])
        .map((row) => `${row.language}${row.proficiency ? ` — ${row.proficiency}` : ''}`)
        .join('\n') || base.languagesText,
  };
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onJobCreated?: () => void;
};

const STEPS: WizardStep[] = ['client', 'title', 'location', 'prompt', 'review'];

const STEP_LABELS: Record<WizardStep, string> = {
  client: 'Pick a client',
  title: 'Name the role',
  location: 'Set the location',
  prompt: 'Brief the AI',
  review: 'Preview & publish',
};

const STEP_HINTS: Record<WizardStep, string> = {
  client: 'Who is this job for? Select a client to continue.',
  title: 'Start with a clear title — AI can refine suggestions as you type.',
  location: 'Where will this role be based?',
  prompt: 'Add extra context so AI can draft a stronger job post.',
  review: 'Fine-tune everything, then publish when it looks right.',
};

export function JobAiCreateWizard({ isOpen, onClose, onJobCreated }: Props) {
  const [step, setStep] = useState<WizardStep>('client');
  const [draft, setDraft] = useState<WizardDraft>({
    ...EMPTY_DRAFT,
    targetHireDate: defaultTargetHireDate(),
  });
  const [clients, setClients] = useState<BackendClient[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [loadingClients, setLoadingClients] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
  const [loadingTitleSuggestions, setLoadingTitleSuggestions] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');

  const reset = useCallback(() => {
    setStep('client');
    setDraft({ ...EMPTY_DRAFT, targetHireDate: defaultTargetHireDate() });
    setClientSearch('');
    setError('');
    setGenerating(false);
    setPublishing(false);
    setTitleSuggestions([]);
    setLoadingTitleSuggestions(false);
    setCurrencyOpen(false);
    setCurrencySearch('');
  }, []);

  useEffect(() => {
    if (!isOpen) {
      reset();
      return;
    }
    let cancelled = false;
    setLoadingClients(true);
    void apiGetClients({ page: 1, limit: 200 })
      .then((res) => {
        if (cancelled) return;
        const raw = res.data as unknown;
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as { data?: BackendClient[] })?.data)
            ? (raw as { data: BackendClient[] }).data
            : Array.isArray((raw as { items?: BackendClient[] })?.items)
              ? (raw as { items: BackendClient[] }).items
              : [];
        setClients(list as BackendClient[]);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load clients.');
      })
      .finally(() => {
        if (!cancelled) setLoadingClients(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, reset]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      String(c.companyName || '')
        .toLowerCase()
        .includes(q),
    );
  }, [clients, clientSearch]);

  useEffect(() => {
    if (!isOpen || step !== 'title') return;
    const query = draft.jobTitle.trim();
    if (query.length < 2) {
      setTitleSuggestions([]);
      setLoadingTitleSuggestions(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoadingTitleSuggestions(true);
      void apiSuggestJobTitles({
        query,
        company: draft.clientName || undefined,
        limit: 8,
      })
        .then((res) => {
          if (cancelled) return;
          const list = Array.isArray(res.data?.suggestions) ? res.data.suggestions : [];
          setTitleSuggestions(list.filter(Boolean).slice(0, 8));
        })
        .catch(() => {
          if (!cancelled) setTitleSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) setLoadingTitleSuggestions(false);
        });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, step, draft.jobTitle, draft.clientName]);

  const filteredCurrencies = useMemo(() => {
    const q = currencySearch.trim().toLowerCase();
    if (!q) return JOB_SALARY_CURRENCY_OPTIONS;
    return JOB_SALARY_CURRENCY_OPTIONS.filter((code) => code.toLowerCase().includes(q));
  }, [currencySearch]);

  const stepIndex = STEPS.indexOf(step);

  const patchDraft = (patch: Partial<WizardDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const goNext = () => {
    setError('');
    if (step === 'client') {
      if (!draft.clientId) {
        setError('Select a client to continue.');
        return;
      }
      setStep('title');
      return;
    }
    if (step === 'title') {
      if (!draft.jobTitle.trim()) {
        setError('Enter a job title to continue.');
        return;
      }
      setStep('location');
      return;
    }
    if (step === 'location') {
      if (!draft.country.trim() && !draft.locationQuery.trim()) {
        setError('Add a location to continue.');
        return;
      }
      setStep('prompt');
      return;
    }
    if (step === 'prompt') {
      void runAiGenerate();
    }
  };

  const goBack = () => {
    setError('');
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  };

  const runAiGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const prompt = [
        `Create a complete job posting.`,
        `Client / company: ${draft.clientName}`,
        `Job title: ${draft.jobTitle}`,
        `Location: ${[draft.city, draft.state, draft.country].filter(Boolean).join(', ') || draft.locationQuery}`,
        draft.extraPrompt.trim() ? `Additional requirements and notes:\n${draft.extraPrompt.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const response = await apiGenerateJobFromPrompt({
        prompt,
        currentForm: {
          jobTitle: draft.jobTitle,
          companyId: draft.clientId,
          companyName: draft.clientName,
          country: draft.country,
          state: draft.state,
          city: draft.city,
          numberOfOpenings: draft.numberOfOpenings,
          priority: draft.priority,
          employmentType: draft.employmentType,
          targetHireDate: draft.targetHireDate || defaultTargetHireDate(),
        },
      });

      const data = response.data;
      if (!data?.jobTitle) {
        throw new Error('AI could not build a job from those details. Try adding more in the prompt.');
      }

      setDraft((prev) =>
        pipelineToDraft(
          {
            ...prev,
            clientId: prev.clientId,
            clientName: prev.clientName,
          },
          { ...data, companyId: prev.clientId, companyName: prev.clientName },
        ),
      );
      setStep('review');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'AI job creation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!draft.clientId || !draft.jobTitle.trim()) {
      setError('Client and job title are required.');
      return;
    }
    if (!draft.country.trim()) {
      setError('Country is required before publishing.');
      return;
    }
    if (!draft.targetHireDate) {
      setError('Target hire date is required.');
      return;
    }

    setPublishing(true);
    setError('');
    try {
      const keyResponsibilities = toList(draft.keyResponsibilitiesText);
      const qualifications = toList(draft.qualificationsExperienceText);
      const candidateRequirements = toList(draft.candidateRequirementsText);
      const skills = toList(draft.skillsText);
      const languages = toList(draft.languagesText).map((line) => {
        const [language, ...rest] = line.split(/[—\-–]/);
        return {
          language: (language || '').trim(),
          proficiency: rest.join('-').trim() || 'Professional',
        };
      }).filter((row) => row.language);

      const locationParts = [draft.city, draft.state, draft.country]
        .map((v) => v.trim())
        .filter(Boolean);
      const minExp = Number(draft.minExperience);
      const maxExp = Number(draft.maxExperience);

      const jobData: CreateJobData = {
        title: draft.jobTitle.trim(),
        description: draft.jobDescriptionHtml.trim() || undefined,
        clientId: draft.clientId,
        openings: parseInt(draft.numberOfOpenings, 10) || 1,
        type: mapJobType(draft.employmentType),
        status: 'OPEN',
        location: locationParts.join(', ') || draft.locationQuery || undefined,
        country: draft.country.trim() || undefined,
        state: draft.state.trim() || undefined,
        city: draft.city.trim() || undefined,
        nationality: draft.nationality.trim() || undefined,
        priority: draft.priority || undefined,
        jobCategory: draft.industryType.trim() || undefined,
        expectedClosureDate: draft.targetHireDate || undefined,
        skills,
        keyResponsibilities,
        requirements: qualifications,
        candidateRequirements,
        languages,
        experienceRequired:
          Number.isFinite(minExp) || Number.isFinite(maxExp)
            ? `${Number.isFinite(minExp) ? minExp : ''}${Number.isFinite(maxExp) ? `-${maxExp}` : ''}`.trim()
            : undefined,
        salary:
          draft.payRangeMin || draft.payRangeMax
            ? {
                currency: draft.salaryCurrency || 'USD',
                min: draft.payRangeMin ? Number(draft.payRangeMin) : undefined,
                max: draft.payRangeMax ? Number(draft.payRangeMax) : undefined,
              }
            : undefined,
      };

      await apiCreateJob(jobData);
      onJobCreated?.();
      onClose();
      reset();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to publish job.');
    } finally {
      setPublishing(false);
    }
  };

  if (!isOpen) return null;

  const fieldClass =
    'w-full rounded-2xl border border-slate-200/90 bg-white/90 px-3.5 py-3 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition placeholder:text-slate-400 hover:border-[#2098C8]/60 hover:shadow-md hover:shadow-[#2098C8]/10 focus:border-[#2098C8] focus:bg-white focus:ring-4 focus:ring-[#2098C8]/15';
  const textareaClass = `${fieldClass} min-h-[96px] resize-none leading-relaxed`;
  const labelClass =
    'mb-2 block text-[0.68rem] font-bold uppercase tracking-[0.16em] text-slate-500';
  const sectionClass =
    'rounded-[1.35rem] border border-white/80 bg-white/80 p-4 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.04] backdrop-blur-sm sm:p-5';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={() => {
          onClose();
          reset();
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        className="relative flex max-h-[min(92vh,920px)] w-full max-w-3xl flex-col overflow-hidden rounded-[1.85rem] border border-white/70 bg-gradient-to-b from-white via-white to-slate-50 shadow-[0_40px_100px_-24px_rgba(2,6,23,0.55)]"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(ellipse_at_top_right,_rgba(32,152,200,0.18),_transparent_55%),radial-gradient(ellipse_at_top_left,_rgba(32,152,200,0.12),_transparent_50%)]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage:
              'radial-gradient(rgba(15,23,42,0.055) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
            maskImage: 'linear-gradient(to bottom, black 0%, transparent 40%)',
          }}
          aria-hidden
        />

        <div className="relative border-b border-[#2098C8]/20 px-5 pb-4 pt-5 sm:px-7 sm:pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#2098C8]/35 bg-[#E8F6FC] px-3 py-1 shadow-sm shadow-[#2098C8]/10">
                <span className="relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-[#2098C8]/25">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/saasa-logo.png" alt="" className="h-5 w-5 object-contain" />
                </span>
                <span className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#176F96]">
                  AI job creation
                </span>
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22 }}
                >
                  <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.7rem]">
                    {STEP_LABELS[step]}
                  </h2>
                  <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-500">
                    {STEP_HINTS[step]}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                reset();
              }}
              className="rounded-full border border-slate-200/90 bg-white/90 p-2.5 text-slate-400 shadow-sm transition hover:scale-105 hover:border-slate-300 hover:text-slate-700 active:scale-95"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 flex items-center gap-2">
            {STEPS.map((s, i) => {
              const done = i < stepIndex;
              const active = i === stepIndex;
              return (
                <div key={s} className="flex flex-1 items-center gap-2">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold transition-all ${
                      done
                        ? 'bg-[#2098C8] text-white shadow-md shadow-[#2098C8]/30'
                        : active
                          ? 'bg-[#2098C8] text-white shadow-lg shadow-[#2098C8]/30 ring-4 ring-[#2098C8]/25'
                          : 'bg-slate-100 text-slate-400 ring-1 ring-slate-200'
                    }`}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  {i < STEPS.length - 1 ? (
                    <div
                      className={`h-1.5 flex-1 rounded-full ${
                        done
                          ? 'bg-[#2098C8]'
                          : active
                            ? 'bg-gradient-to-r from-[#2098C8] to-slate-200'
                            : 'bg-slate-200/90'
                      }`}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
          <p className="mt-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Step {stepIndex + 1} of {STEPS.length}
          </p>
        </div>

        <div className="relative min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 [scrollbar-width:thin] [scrollbar-color:#2098C8_transparent]">
          {error ? (
            <div className="mb-4 rounded-2xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-sm text-red-700 shadow-sm">
              {error}
            </div>
          ) : null}

          <AnimatePresence mode="wait">
            {step === 'client' ? (
              <motion.div
                key="client"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.22 }}
                className="space-y-4"
              >
                <div className="relative overflow-hidden rounded-[1.35rem] border border-[#2098C8]/25 bg-gradient-to-br from-[#E8F6FC] via-white to-[#E8F6FC]/70 p-4 shadow-sm sm:p-5">
                  <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[#2098C8]/25 blur-2xl" />
                  <div className="relative flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#2098C8] text-white shadow-lg shadow-[#2098C8]/30">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">Select your client</p>
                      <p className="mt-0.5 text-sm text-slate-500">
                        Search or tap a company below — this job will be linked to them.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2098C8]/80" />
                  <input
                    type="search"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="Search clients…"
                    className={`${fieldClass} pl-10`}
                  />
                </div>
                {loadingClients ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-14 text-sm text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin text-[#2098C8]" />
                    Loading clients…
                  </div>
                ) : (
                  <div className="max-h-[420px] space-y-2.5 overflow-y-auto pr-1 [scrollbar-width:thin]">
                    {filteredClients.length === 0 ? (
                      <div className="rounded-[1.35rem] border border-dashed border-slate-200 bg-white/70 py-12 text-center text-sm text-slate-500">
                        No clients found.
                      </div>
                    ) : (
                      filteredClients.map((client, index) => {
                        const selected = draft.clientId === client.id;
                        return (
                          <motion.button
                            key={client.id}
                            type="button"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(index * 0.03, 0.24) }}
                            whileHover={{ y: -1 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() =>
                              patchDraft({
                                clientId: client.id,
                                clientName: client.companyName || 'Client',
                              })
                            }
                            className={`group flex w-full items-center gap-3 rounded-[1.2rem] border px-4 py-3.5 text-left transition ${
                              selected
                                ? 'border-[#2098C8] bg-gradient-to-r from-[#E8F6FC] to-[#E8F6FC]/70 shadow-md shadow-[#2098C8]/15 ring-2 ring-[#2098C8]/25'
                                : 'border-slate-200/70 bg-white/90 shadow-sm shadow-slate-900/[0.03] hover:border-[#2098C8]/55 hover:bg-[#E8F6FC]/50 hover:shadow-md hover:shadow-[#2098C8]/10'
                            }`}
                          >
                            <div
                              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition ${
                                selected
                                  ? 'bg-[#2098C8] text-white shadow-md shadow-[#2098C8]/25'
                                  : 'bg-gradient-to-br from-slate-100 to-slate-50 text-[#2098C8] ring-1 ring-slate-200/80 group-hover:from-[#E8F6FC] group-hover:to-white'
                              }`}
                            >
                              {client.logo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={client.logo}
                                  alt=""
                                  className="h-12 w-12 rounded-2xl object-cover"
                                />
                              ) : (
                                <Building2 className="h-5 w-5" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-slate-900">
                                {client.companyName}
                              </p>
                              <p className="truncate text-xs text-slate-500">
                                {client.industry || client.location || 'Client'}
                              </p>
                            </div>
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${
                                selected
                                  ? 'bg-[#2098C8] text-white shadow-sm shadow-[#2098C8]/30'
                                  : 'bg-slate-100 text-transparent group-hover:bg-[#D6EEF8] group-hover:text-[#2098C8]/45'
                              }`}
                            >
                              <Check className="h-4 w-4" />
                            </span>
                          </motion.button>
                        );
                      })
                    )}
                  </div>
                )}
              </motion.div>
            ) : null}

            {step === 'title' ? (
              <motion.div
                key="title"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.22 }}
                className="space-y-4"
              >
                <div className={sectionClass}>
                  <label className={labelClass}>Job title *</label>
                  <input
                    type="text"
                    value={draft.jobTitle}
                    onChange={(e) => patchDraft({ jobTitle: e.target.value })}
                    placeholder="e.g. React Developer"
                    className={fieldClass}
                    autoFocus
                  />
                </div>
                <div className={`${sectionClass} relative overflow-hidden`}>
                  <div className="pointer-events-none absolute -right-8 top-0 h-24 w-24 rounded-full bg-[#D6EEF8]/60 blur-2xl" />
                  <p className="relative mb-3 inline-flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[#176F96]">
                    <Sparkles className="h-3.5 w-3.5 text-[#2098C8]" />
                    AI recommendations
                    {loadingTitleSuggestions ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#2098C8]" />
                    ) : null}
                  </p>
                  {draft.jobTitle.trim().length < 2 ? (
                    <p className="relative text-sm text-slate-500">
                      Type at least 2 characters to get AI title recommendations.
                    </p>
                  ) : loadingTitleSuggestions && titleSuggestions.length === 0 ? (
                    <p className="relative text-sm text-slate-500">Finding matching titles…</p>
                  ) : titleSuggestions.length === 0 ? (
                    <p className="relative text-sm text-slate-500">
                      No AI suggestions yet. Keep typing or enter your own title.
                    </p>
                  ) : (
                    <div className="relative flex flex-wrap gap-2">
                      {titleSuggestions.map((title) => (
                        <button
                          key={title}
                          type="button"
                          onClick={() => patchDraft({ jobTitle: title })}
                          className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                            draft.jobTitle === title
                              ? 'border-[#2098C8] bg-[#E8F6FC] text-[#176F96] shadow-sm shadow-[#2098C8]/15'
                              : 'border-slate-200 bg-slate-50/80 text-slate-700 hover:border-[#2098C8]/55 hover:bg-white hover:shadow-sm'
                          }`}
                        >
                          {title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ) : null}

            {step === 'location' ? (
              <motion.div
                key="location"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.22 }}
                className="space-y-4"
              >
                <div className={sectionClass}>
                  <label className={labelClass}>Location</label>
                  <LocationAutocomplete
                    value={draft.locationQuery}
                    onChange={(next) => patchDraft({ locationQuery: next })}
                    onSelect={(sel) =>
                      patchDraft({
                        locationQuery: sel.location,
                        country: sel.country,
                        state: sel.state,
                        city: sel.city,
                      })
                    }
                    placeholder="Search location…"
                    inputClassName={fieldClass}
                  />
                  <div className="mt-4 grid gap-3.5 sm:grid-cols-3">
                    <div>
                      <label className={labelClass}>Country *</label>
                      <input
                        className={fieldClass}
                        value={draft.country}
                        onChange={(e) => patchDraft({ country: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>State</label>
                      <input
                        className={fieldClass}
                        value={draft.state}
                        onChange={(e) => patchDraft({ state: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>City</label>
                      <input
                        className={fieldClass}
                        value={draft.city}
                        onChange={(e) => patchDraft({ city: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : null}

            {step === 'prompt' ? (
              <motion.div
                key="prompt"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="space-y-4"
              >
                <div className="rounded-2xl border border-[#2098C8]/25 bg-gradient-to-br from-[#E8F6FC]/90 via-white to-[#E8F6FC]/60 p-4 shadow-sm sm:p-5">
                  <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[#176F96]">
                    Preview so far
                  </p>
                  <div className="mt-3 space-y-2.5 text-sm text-slate-800">
                    <p>
                      <span className="font-semibold text-slate-500">Client:</span>{' '}
                      {draft.clientName}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-500">Title:</span>{' '}
                      {draft.jobTitle}
                    </p>
                    <p className="inline-flex items-start gap-1.5">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#2098C8]" />
                      {[draft.city, draft.state, draft.country].filter(Boolean).join(', ') ||
                        draft.locationQuery ||
                        '—'}
                    </p>
                  </div>
                </div>

                <div className={sectionClass}>
                  <label className={labelClass}>Tell AI what else to include</label>
                  <textarea
                    value={draft.extraPrompt}
                    onChange={(e) => patchDraft({ extraPrompt: e.target.value })}
                    rows={6}
                    placeholder="e.g. 3–5 years React experience, remote OK, salary 15–25 LPA, must know TypeScript, join within 30 days…"
                    className={`${textareaClass} min-h-[140px]`}
                  />
                  <p className="mt-2.5 text-xs leading-relaxed text-slate-500">
                    AI will generate description, responsibilities, skills, salary hints, and more.
                    You can edit everything on the next screen.
                  </p>
                </div>
              </motion.div>
            ) : null}

            {step === 'review' ? (
              <motion.div
                key="review"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="space-y-4"
              >
                <p className="rounded-2xl border border-[#2098C8]/25 bg-gradient-to-r from-[#E8F6FC]/80 to-[#E8F6FC]/60 px-4 py-3 text-sm text-slate-600 shadow-sm">
                  Review and edit the generated job, then publish.
                </p>

                <div className={`${sectionClass} space-y-4`}>
                  <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Job basics
                  </p>
                  <div className="grid gap-3.5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Job title *</label>
                    <input
                      className={fieldClass}
                      value={draft.jobTitle}
                      onChange={(e) => patchDraft({ jobTitle: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Client</label>
                    <input className={`${fieldClass} cursor-default text-slate-600`} value={draft.clientName} readOnly />
                  </div>
                  <div>
                    <label className={labelClass}>Priority</label>
                    <select
                      className={fieldClass}
                      value={draft.priority}
                      onChange={(e) => patchDraft({ priority: e.target.value })}
                    >
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>No of positions *</label>
                    <input
                      type="number"
                      min={1}
                      className={fieldClass}
                      value={draft.numberOfOpenings}
                      onChange={(e) => patchDraft({ numberOfOpenings: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Nationality</label>
                    <input
                      className={fieldClass}
                      value={draft.nationality}
                      onChange={(e) => patchDraft({ nationality: e.target.value })}
                      placeholder="e.g. Indian, American"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Country *</label>
                    <input
                      className={fieldClass}
                      value={draft.country}
                      onChange={(e) => patchDraft({ country: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>State</label>
                    <input
                      className={fieldClass}
                      value={draft.state}
                      onChange={(e) => patchDraft({ state: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>City</label>
                    <input
                      className={fieldClass}
                      value={draft.city}
                      onChange={(e) => patchDraft({ city: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Industry type</label>
                    <input
                      className={fieldClass}
                      value={draft.industryType}
                      onChange={(e) => patchDraft({ industryType: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Employment type</label>
                    <select
                      className={fieldClass}
                      value={draft.employmentType}
                      onChange={(e) => patchDraft({ employmentType: e.target.value })}
                    >
                      <option>Full Time</option>
                      <option>Part Time</option>
                      <option>Contract</option>
                      <option>Internship</option>
                      <option>Freelance</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Target hire date *</label>
                    <input
                      type="date"
                      className={fieldClass}
                      value={draft.targetHireDate}
                      onChange={(e) => patchDraft({ targetHireDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Min experience (years)</label>
                    <input
                      type="number"
                      className={fieldClass}
                      value={draft.minExperience}
                      onChange={(e) => patchDraft({ minExperience: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Max experience (years)</label>
                    <input
                      type="number"
                      className={fieldClass}
                      value={draft.maxExperience}
                      onChange={(e) => patchDraft({ maxExperience: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Salary currency</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setCurrencyOpen((open) => !open)}
                        className={`${fieldClass} flex items-center justify-between bg-white font-medium text-slate-800`}
                        aria-label="Salary currency"
                      >
                        <span>{draft.salaryCurrency || 'Currency'}</span>
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      </button>
                      {currencyOpen ? (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => {
                              setCurrencyOpen(false);
                              setCurrencySearch('');
                            }}
                          />
                          <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
                            <div className="border-b border-slate-100 bg-slate-50/80 p-2.5">
                              <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                <input
                                  type="text"
                                  value={currencySearch}
                                  onChange={(e) => setCurrencySearch(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  placeholder="Search currency…"
                                  autoFocus
                                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#2098C8] focus:ring-4 focus:ring-[#2098C8]/15"
                                />
                              </div>
                            </div>
                            <ul className="max-h-56 overflow-y-auto py-1 [scrollbar-width:thin]">
                              {filteredCurrencies.length === 0 ? (
                                <li className="px-3 py-2.5 text-sm text-slate-500">
                                  No currencies found
                                </li>
                              ) : (
                                filteredCurrencies.map((code) => (
                                  <li key={code}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        patchDraft({ salaryCurrency: code });
                                        setCurrencyOpen(false);
                                        setCurrencySearch('');
                                      }}
                                      className={`w-full px-3.5 py-2.5 text-left text-sm transition hover:bg-slate-50 ${
                                        draft.salaryCurrency === code
                                          ? 'bg-[#E8F6FC] font-semibold text-[#176F96]'
                                          : 'text-slate-700'
                                      }`}
                                    >
                                      {code}
                                    </button>
                                  </li>
                                ))
                              )}
                            </ul>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Salary min</label>
                    <input
                      className={fieldClass}
                      value={draft.payRangeMin}
                      onChange={(e) => patchDraft({ payRangeMin: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Salary max</label>
                    <input
                      className={fieldClass}
                      value={draft.payRangeMax}
                      onChange={(e) => patchDraft({ payRangeMax: e.target.value })}
                    />
                  </div>
                  </div>
                </div>

                <div className={`${sectionClass} space-y-4`}>
                  <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Description & requirements
                  </p>
                  <div>
                    <label className={labelClass}>Job description</label>
                    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                      <RichTextEditor
                        value={draft.jobDescriptionHtml}
                        onChange={(html) => patchDraft({ jobDescriptionHtml: html })}
                        placeholder="Job description will appear here after AI generation…"
                        minHeight={220}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Key responsibilities (one per line)</label>
                    <textarea
                      rows={4}
                      className={textareaClass}
                      value={draft.keyResponsibilitiesText}
                      onChange={(e) => patchDraft({ keyResponsibilitiesText: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      Preferred education / qualifications (one per line)
                    </label>
                    <textarea
                      rows={3}
                      className={textareaClass}
                      value={draft.qualificationsExperienceText}
                      onChange={(e) =>
                        patchDraft({ qualificationsExperienceText: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Candidate requirements (one per line)</label>
                    <textarea
                      rows={3}
                      className={textareaClass}
                      value={draft.candidateRequirementsText}
                      onChange={(e) => patchDraft({ candidateRequirementsText: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Skills (one per line)</label>
                    <textarea
                      rows={3}
                      className={textareaClass}
                      value={draft.skillsText}
                      onChange={(e) => patchDraft({ skillsText: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      Languages (one per line, e.g. English — Fluent)
                    </label>
                    <textarea
                      rows={2}
                      className={textareaClass}
                      value={draft.languagesText}
                      onChange={(e) => patchDraft({ languagesText: e.target.value })}
                    />
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="relative flex items-center justify-between gap-3 border-t border-[#2098C8]/25 bg-white/90 px-5 py-4 backdrop-blur-md sm:px-7">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#2098C8]/50 to-transparent" />
          <button
            type="button"
            onClick={goBack}
            disabled={step === 'client' || generating || publishing}
            className="inline-flex items-center gap-1.5 rounded-2xl px-3.5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          {step === 'review' ? (
            <button
              type="button"
              onClick={() => void handlePublish()}
              disabled={publishing}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#2098C8] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#2098C8]/30 transition hover:bg-[#1A86B3] hover:shadow-xl hover:shadow-[#2098C8]/35 active:scale-[0.98] disabled:opacity-60"
            >
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Publish job
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#2098C8] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#2098C8]/30 transition hover:bg-[#1A86B3] hover:shadow-xl hover:shadow-[#2098C8]/35 active:scale-[0.98] disabled:opacity-60"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : step === 'prompt' ? (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate with AI
                  <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
