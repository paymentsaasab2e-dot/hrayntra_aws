'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Download, FileText, Plus, Send, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import type {
  CreatePlacementPayload,
  EmploymentType,
  Placement,
} from '../../../types/placement';
import type {
  BillingSettingsSnapshot,
  CreatePlacementInvoicePayload,
  RecruitmentInvoiceData,
} from '../../../types/recruitmentInvoice';
import { RecruitmentInvoicePreview } from '../../billing/RecruitmentInvoicePreview';
import {
  apiGetBillingRecord,
  apiGetBillingSettings,
  apiGetCandidates,
  apiGetClient,
  apiGetJobs,
  apiGetNextInvoiceNumber,
  apiGetUsers,
  apiSendBillingInvoice,
  type BackendClient,
} from '../../../lib/api';
import { PlacementInvoiceEditableSidePanel } from '../PlacementInvoiceEditableSidePanel';
// Replaced PlacementInvoiceLegalDetailsPanel — use PlacementInvoiceEditableSidePanel only.
import {
  applyClientContextToInvoice,
  migrateLegacyInvoiceNotesToTerms,
  parseAgreementPercent,
  resolveAgencySignatory,
  resolveSellerBankDetails,
} from '../../../lib/placementInvoiceClientContext';
import type { InvoiceBankDetails } from '../../../types/recruitmentInvoice';
import { invoiceFromBillingRecord } from '../../../lib/invoiceFromBillingRecord';
import { MY_JOBS_LIST_PARAMS } from '../../../lib/myJobsListParams';
import { addDaysIso, recalcInvoiceTotals, recalcLineItem } from '../../../lib/invoiceCalculations';
import {
  resolveClientEmail,
  resolveOrgDefaultCurrency,
  resolvePlacementInvoiceCurrency,
} from '../../../lib/invoiceCurrency';
import { calculatePlacementFee } from '../../../utils/placements';
import { formatCurrencyAmount, SUPPORTED_CURRENCIES } from '../../../utils/currency';
import {
  generateInvoicePdfBlobFromComponent,
  generateInvoicePdfFromElement,
} from '../../../utils/generateInvoicePdf';

function paymentTermsDays(terms: string): number {
  const match = String(terms || '').match(/(\d+)/);
  return match ? Number(match[1]) : 30;
}

function orgNameFromStorage(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = localStorage.getItem('currentUser');
    if (!raw) return '';
    const u = JSON.parse(raw);
    return (
      u.companyName ||
      u.organizationName ||
      u.tenantName ||
      u.name ||
      ''
    );
  } catch {
    return '';
  }
}

function buildInitialInvoice(
  placement: Placement,
  settings: BillingSettingsSnapshot,
  invoiceNo: string,
): RecruitmentInvoiceData {
  const fee = placement.placementFee ?? 0;
  const candidateName = `${placement.candidate.firstName} ${placement.candidate.lastName}`.trim();
  const lineItem = recalcLineItem({
    name: `Placement fee — ${placement.job.title}`,
    quantity: 1,
    price: fee,
    total: fee,
  });
  const taxRate = settings.taxRate ?? 0;
  const totals = recalcInvoiceTotals([lineItem], [], taxRate);
  const days = paymentTermsDays(settings.defaultPaymentTerms);
  const today = new Date().toISOString().slice(0, 10);

  return {
    invoiceNo,
    invoiceDate: today,
    dueDate: addDaysIso(days),
    placementId: placement.id,
    currency: resolvePlacementInvoiceCurrency(placement, settings),
    status: 'DRAFT',
    seller: {
      name: settings.companyName || orgNameFromStorage() || 'Your agency',
      email: '',
      phone: '',
      address: '',
    },
    buyer: {
      name: placement.client.companyName,
      email: resolveClientEmail(placement.client),
      phone: '',
      address: '',
    },
    lineItems: [lineItem],
    additionalCharges: [],
    taxRate,
    notes: `Placement invoice for ${candidateName || placement.job.title}.`,
    placementSummary: {
      candidateName,
      jobTitle: placement.job.title,
      clientName: placement.client.companyName,
      offerDate: placement.offerDate,
      joiningDate: placement.joiningDate,
    },
    sellerBank: resolveSellerBankDetails(settings),
    agencySignatory: resolveAgencySignatory(settings),
    ...totals,
  };
}

type SelectOption = { id: string; name: string; email: string };
type JobOption = {
  id: string;
  title: string;
  clientId?: string;
  clientName: string;
  clientEmail?: string;
};

function buildInvoiceFromManual(
  candidate: SelectOption,
  job: JobOption,
  placementFee: number,
  settings: BillingSettingsSnapshot,
  invoiceNo: string,
  offerDate?: string,
): RecruitmentInvoiceData {
  const lineItem = recalcLineItem({
    name: `Placement fee — ${job.title}`,
    quantity: 1,
    price: placementFee,
    total: placementFee,
  });
  const taxRate = settings.taxRate ?? 0;
  const totals = recalcInvoiceTotals([lineItem], [], taxRate);
  const days = paymentTermsDays(settings.defaultPaymentTerms);
  const today = new Date().toISOString().slice(0, 10);

  return {
    invoiceNo,
    invoiceDate: today,
    dueDate: addDaysIso(days),
    placementId: '',
    currency: resolveOrgDefaultCurrency(settings),
    status: 'DRAFT',
    seller: {
      name: settings.companyName || orgNameFromStorage() || 'Your agency',
      email: '',
      phone: '',
      address: '',
    },
    buyer: {
      name: job.clientName,
      email: job.clientEmail || '',
      phone: '',
      address: '',
    },
    lineItems: [lineItem],
    additionalCharges: [],
    taxRate,
    notes: `Placement invoice for ${candidate.name || job.title}.`,
    placementSummary: {
      candidateName: candidate.name,
      jobTitle: job.title,
      clientName: job.clientName,
      offerDate: offerDate || today,
      joiningDate: null,
    },
    sellerBank: resolveSellerBankDetails(settings),
    agencySignatory: resolveAgencySignatory(settings),
    ...totals,
  };
}

function buildBlankInvoice(settings: BillingSettingsSnapshot, invoiceNo: string): RecruitmentInvoiceData {
  const taxRate = settings.taxRate ?? 0;
  const totals = recalcInvoiceTotals(
    [recalcLineItem({ name: '', quantity: 1, price: 0, total: 0 })],
    [],
    taxRate,
  );
  const today = new Date().toISOString().slice(0, 10);
  return {
    invoiceNo,
    invoiceDate: today,
    dueDate: addDaysIso(paymentTermsDays(settings.defaultPaymentTerms)),
    placementId: '',
    currency: resolveOrgDefaultCurrency(settings),
    status: 'DRAFT',
    seller: {
      name: settings.companyName || orgNameFromStorage() || 'Your agency',
      email: '',
      phone: '',
      address: '',
    },
    buyer: { name: '', email: '', phone: '', address: '' },
    lineItems: [recalcLineItem({ name: '', quantity: 1, price: 0, total: 0 })],
    additionalCharges: [],
    taxRate,
    notes: '',
    sellerBank: resolveSellerBankDetails(settings),
    agencySignatory: resolveAgencySignatory(settings),
    ...totals,
  };
}

function unwrapCollection<T>(value: T[] | { data?: T[] } | undefined | null): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

const manualInitial = {
  candidateId: '',
  jobId: '',
  recruiterId: '',
  offerSalary: '',
  placementFee: '',
  commissionPercentage: '20',
  offerDate: '',
  employmentType: 'PERMANENT' as EmploymentType,
};

export type CreatePlacementInvoiceSubmitArgs = {
  placementId?: string;
  billingRecordId?: string;
  newPlacement?: CreatePlacementPayload;
  invoice: CreatePlacementInvoicePayload;
  /** When `send`, parent should persist but keep the modal open for email delivery. */
  intent?: 'save' | 'send';
};

export type CreatePlacementInvoiceResult = {
  placement: Placement;
  invoiceNumber: string;
  billingRecordId?: string;
};

interface CreatePlacementInvoiceModalProps {
  isOpen: boolean;
  placements: Placement[];
  initialPlacementId?: string;
  /** When set, opens the modal in edit mode for an existing draft billing record. */
  initialBillingRecordId?: string;
  isSubmitting: boolean;
  canCreatePlacement?: boolean;
  currentUserId?: string;
  candidates?: SelectOption[];
  jobs?: JobOption[];
  recruiters?: SelectOption[];
  onClose: () => void;
  onSubmit: (args: CreatePlacementInvoiceSubmitArgs) => Promise<CreatePlacementInvoiceResult>;
}

export function CreatePlacementInvoiceModal({
  isOpen,
  placements,
  initialPlacementId,
  initialBillingRecordId,
  isSubmitting,
  canCreatePlacement = false,
  currentUserId,
  candidates: candidatesProp = [],
  jobs: jobsProp = [],
  recruiters: recruitersProp = [],
  onClose,
  onSubmit,
}: CreatePlacementInvoiceModalProps) {
  const eligible = useMemo(
    () => placements.filter((p) => (p.placementFee ?? 0) > 0),
    [placements],
  );

  const [sourceMode, setSourceMode] = useState<'existing' | 'manual'>('existing');
  const [placementId, setPlacementId] = useState('');
  const [manual, setManual] = useState(manualInitial);
  const [feeEditedManually, setFeeEditedManually] = useState(false);
  const [candidateOptions, setCandidateOptions] = useState<SelectOption[]>(candidatesProp);
  const [jobOptions, setJobOptions] = useState<JobOption[]>(jobsProp);
  const [recruiterOptions, setRecruiterOptions] = useState<SelectOption[]>(recruitersProp);
  const [invoice, setInvoice] = useState<RecruitmentInvoiceData | null>(null);
  const [settings, setSettings] = useState<BillingSettingsSnapshot | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [previewCurrency, setPreviewCurrency] = useState<string>('USD');
  const [billingClientId, setBillingClientId] = useState<string | undefined>();
  const [billingClientSnapshot, setBillingClientSnapshot] = useState<Parameters<
    typeof resolveClientEmail
  >[0]>(null);
  const [loadedClient, setLoadedClient] = useState<BackendClient | null>(null);
  const [loadingClientContext, setLoadingClientContext] = useState(false);
  const agreementCommissionKeyRef = useRef('');
  const clientContextKeyRef = useRef('');
  const termsEditedRef = useRef(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const placementRow = useMemo(
    () => placements.find((p) => p.id === placementId) || null,
    [placements, placementId],
  );
  const selected = eligible.find((p) => p.id === placementId) || placementRow;
  const selectedJob = jobOptions.find((j) => j.id === manual.jobId) || null;
  const selectedCandidate =
    candidateOptions.find((c) => c.id === manual.candidateId) || null;

  const resolvedClientId = useMemo(() => {
    return (
      placementRow?.clientId ||
      placementRow?.client?.id ||
      selected?.client?.id ||
      billingClientId ||
      selectedJob?.clientId ||
      ''
    );
  }, [
    placementRow,
    selected?.client?.id,
    billingClientId,
    selectedJob?.clientId,
  ]);
  const showManualMode = canCreatePlacement && !initialBillingRecordId;
  const editingDraft = Boolean(initialBillingRecordId);
  const canSubmit = editingDraft
    ? Boolean(invoice)
    : sourceMode === 'manual'
      ? showManualMode
      : eligible.length > 0;

  useEffect(() => {
    setCandidateOptions(candidatesProp);
    setJobOptions(jobsProp);
    setRecruiterOptions(recruitersProp);
  }, [candidatesProp, jobsProp, recruitersProp]);

  const refreshTotals = useCallback((draft: RecruitmentInvoiceData): RecruitmentInvoiceData => {
    const lineItems = (draft.lineItems || []).map(recalcLineItem);
    const additionalCharges = draft.additionalCharges || [];
    const totals = recalcInvoiceTotals(lineItems, additionalCharges, draft.taxRate);
    return { ...draft, lineItems, additionalCharges, ...totals };
  }, []);

  useEffect(() => {
    if (!isOpen || !initialBillingRecordId) return;

    let cancelled = false;
    setLoadingMeta(true);
    setError('');
    setInvoice(null);
    setSettings(null);
    setBillingClientId(undefined);
    setBillingClientSnapshot(null);
    setLoadedClient(null);
    setSourceMode('existing');
    setActiveTab('edit');
    setSendingEmail(false);

    (async () => {
      try {
        const [settingsRes, recordRes] = await Promise.all([
          apiGetBillingSettings(),
          apiGetBillingRecord(initialBillingRecordId),
        ]);
        if (cancelled) return;
        const billingSettings = settingsRes.data as BillingSettingsSnapshot;
        const record = recordRes.data;
        if (!record?.placementId) {
          throw new Error('This draft is not linked to a placement');
        }
        setSettings(billingSettings);
        setPlacementId(record.placementId);
        setBillingClientId(record.clientId || record.client?.id);
        setBillingClientSnapshot(
          (record.client || record.placement?.client) as Parameters<typeof resolveClientEmail>[0],
        );
        setInvoice(invoiceFromBillingRecord(record, billingSettings));
        setPreviewCurrency(String(record.currency || billingSettings.defaultCurrency || 'USD').toUpperCase());
      } catch (loadError: any) {
        if (!cancelled) {
          setError(loadError?.message || 'Failed to load draft invoice');
        }
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, initialBillingRecordId]);

  useEffect(() => {
    if (!isOpen || initialBillingRecordId) return;

    const preferred =
      initialPlacementId && eligible.some((p) => p.id === initialPlacementId)
        ? initialPlacementId
        : eligible[0]?.id || '';
    const defaultMode =
      initialPlacementId && eligible.some((p) => p.id === initialPlacementId)
        ? 'existing'
        : eligible.length > 0
          ? 'existing'
          : showManualMode
            ? 'manual'
            : 'existing';

    setPlacementId(preferred);
    setSourceMode(defaultMode);
    setManual({
      ...manualInitial,
      recruiterId: currentUserId || '',
      offerDate: new Date().toISOString().slice(0, 10),
    });
    setFeeEditedManually(false);
    setError('');
    setActiveTab('edit');
    setSendingEmail(false);
    setPreviewCurrency(resolveOrgDefaultCurrency());
    setInvoice(null);
    setSettings(null);
    setBillingClientId(undefined);
    setBillingClientSnapshot(null);
    setLoadedClient(null);
    agreementCommissionKeyRef.current = '';
    clientContextKeyRef.current = '';
    termsEditedRef.current = false;

    let cancelled = false;
    (async () => {
      setLoadingMeta(true);
      try {
        const tasks: Promise<unknown>[] = [
          apiGetBillingSettings(),
          apiGetNextInvoiceNumber(),
        ];
        if (showManualMode && candidatesProp.length === 0) {
          tasks.push(
            apiGetCandidates({ page: 1, limit: 100 }),
            apiGetJobs({ page: 1, ...MY_JOBS_LIST_PARAMS }),
            apiGetUsers({ assignable: true, page: 1, limit: 100, role: 'RECRUITER' }),
          );
        }
        const results = await Promise.all(tasks);
        if (cancelled) return;

        const settingsRes = results[0] as Awaited<ReturnType<typeof apiGetBillingSettings>>;
        const numberRes = results[1] as Awaited<ReturnType<typeof apiGetNextInvoiceNumber>>;
        const billingSettings = settingsRes.data as BillingSettingsSnapshot;
        const nextNo = numberRes.data?.nextInvoiceNo || `INV-${new Date().getFullYear()}-0001`;
        setSettings(billingSettings);

        if (showManualMode && candidatesProp.length === 0 && results.length > 2) {
          const candidatesRes = results[2] as Awaited<ReturnType<typeof apiGetCandidates>>;
          const jobsRes = results[3] as Awaited<ReturnType<typeof apiGetJobs>>;
          const usersRes = results[4] as Awaited<ReturnType<typeof apiGetUsers>>;
          const candidates = unwrapCollection(candidatesRes.data as any);
          const jobs = unwrapCollection(jobsRes.data as any);
          const users = unwrapCollection(usersRes.data as any);
          setCandidateOptions(
            candidates.map((c: any) => ({
              id: c.id,
              name: `${c.firstName} ${c.lastName}`.trim(),
              email: c.email,
            })),
          );
          setJobOptions(
            jobs.map((j: any) => ({
              id: j.id,
              title: j.title,
              clientId: j.client?.id,
              clientName: j.client?.companyName || 'Unknown Client',
              clientEmail: resolveClientEmail(j.client),
            })),
          );
          setRecruiterOptions(
            users.map((u: any) => ({
              id: u.id,
              name: u.name,
              email: u.email,
            })),
          );
        }

        const placement = eligible.find((p) => p.id === preferred) || eligible[0];
        if (defaultMode === 'existing' && placement) {
          setInvoice(buildInitialInvoice(placement, billingSettings, nextNo));
        } else if (defaultMode === 'manual') {
          setInvoice(buildBlankInvoice(billingSettings, nextNo));
        }
      } catch {
        if (cancelled) return;
        const fallback: BillingSettingsSnapshot = {
          invoicePrefix: 'INV',
          defaultCurrency: 'USD',
          defaultPaymentTerms: 'Net 30 Days',
          bankName: '',
          accountNumber: '',
          swiftCode: '',
          taxLabel: 'Tax',
          taxRate: 0,
        };
        setSettings(fallback);
        const nextNo = `INV-${new Date().getFullYear()}-0001`;
        const placement = eligible.find((p) => p.id === preferred) || eligible[0];
        if (defaultMode === 'existing' && placement) {
          setInvoice(buildInitialInvoice(placement, fallback, nextNo));
        } else if (defaultMode === 'manual') {
          setInvoice(buildBlankInvoice(fallback, nextNo));
        }
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    initialBillingRecordId,
    initialPlacementId,
    eligible,
    showManualMode,
    currentUserId,
    candidatesProp.length,
  ]);

  useEffect(() => {
    if (!isOpen || !settings || sourceMode !== 'existing' || !placementId) return;
    const placement = eligible.find((p) => p.id === placementId);
    if (!placement || invoice?.placementId === placementId) return;
    setInvoice((prev) => {
      const no = prev?.invoiceNo || `INV-${new Date().getFullYear()}-0001`;
      return buildInitialInvoice(placement, settings, no);
    });
  }, [placementId, eligible, settings, isOpen, invoice?.placementId, sourceMode]);

  const agreementCommissionPct = useMemo(
    () => parseAgreementPercent(loadedClient?.agreementServiceChargePercent),
    [loadedClient?.agreementServiceChargePercent],
  );

  useEffect(() => {
    const salary = Number(manual.offerSalary || 0);
    const pct = agreementCommissionPct ?? (Number(manual.commissionPercentage) || 0);
    if (salary > 0 && pct > 0 && !feeEditedManually) {
      setManual((current) => ({
        ...current,
        placementFee: String(Math.round(calculatePlacementFee(salary, pct))),
      }));
    }
  }, [manual.offerSalary, manual.commissionPercentage, agreementCommissionPct, feeEditedManually]);

  useEffect(() => {
    termsEditedRef.current = false;
  }, [resolvedClientId, manual.jobId, placementId]);

  useEffect(() => {
    if (!isOpen || !settings || sourceMode !== 'manual') return;
    if (!selectedCandidate || !selectedJob) return;
    const fee = Number(manual.placementFee) || 0;
    setInvoice((prev) => {
      const no = prev?.invoiceNo || `INV-${new Date().getFullYear()}-0001`;
      const next = buildInvoiceFromManual(
        selectedCandidate,
        selectedJob,
        fee,
        settings,
        no,
        manual.offerDate,
      );
      if (prev) {
        const migrated = migrateLegacyInvoiceNotesToTerms(prev);
        next.termsAndConditions =
          prev.termsAndConditions || migrated.termsAndConditions || next.termsAndConditions;
        next.notes = migrated.notes || prev.notes || next.notes;
        if (prev.legalTerms) next.legalTerms = prev.legalTerms;
        if (prev.sellerBank) next.sellerBank = prev.sellerBank;
        if (prev.buyerBank) next.buyerBank = prev.buyerBank;
        if (prev.clientSignatory) next.clientSignatory = prev.clientSignatory;
        if (prev.agencySignatory) next.agencySignatory = prev.agencySignatory;
        if (prev.buyer.address) next.buyer.address = prev.buyer.address;
        if (prev.buyer.email) next.buyer.email = prev.buyer.email;
        if (prev.seller.address) next.seller.address = prev.seller.address;
      }
      return next;
    });
  }, [
    isOpen,
    settings,
    sourceMode,
    manual.candidateId,
    manual.jobId,
    manual.placementFee,
    manual.offerDate,
    selectedCandidate?.id,
    selectedJob?.id,
  ]);

  const updateInvoice = (patch: Partial<RecruitmentInvoiceData>) => {
    setInvoice((prev) => {
      if (!prev) return prev;
      const next = refreshTotals({ ...prev, ...patch });
      if (patch.currency) {
        setPreviewCurrency(String(patch.currency).toUpperCase());
      }
      return next;
    });
  };

  useEffect(() => {
    if (invoice?.currency) {
      setPreviewCurrency(invoice.currency.toUpperCase());
    }
  }, [invoice?.currency]);

  const clientDisplayName =
    selectedJob?.clientName ||
    selected?.client?.companyName ||
    placementRow?.client?.companyName ||
    loadedClient?.companyName ||
    '';

  /** Fetch full client record (agreement + KYC) when job or placement is selected. */
  useEffect(() => {
    if (!isOpen || !resolvedClientId) {
      setLoadedClient(null);
      setLoadingClientContext(false);
      return;
    }

    let cancelled = false;
    setLoadingClientContext(true);
    setLoadedClient(null);

    (async () => {
      try {
        const res = await apiGetClient(resolvedClientId);
        if (!cancelled) {
          const client = res.data as BackendClient;
          setLoadedClient(client);
          setBillingClientSnapshot(client);
        }
      } catch {
        if (!cancelled) setLoadedClient(null);
      } finally {
        if (!cancelled) setLoadingClientContext(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, resolvedClientId]);

  /** Apply client agreement metadata once per client/job (does not overwrite user edits). */
  useEffect(() => {
    if (!isOpen || !settings || !invoice || !resolvedClientId || loadingClientContext) return;

    const contextKey = `${resolvedClientId}-${manual.jobId || placementId}`;
    const isSameClientContext = clientContextKeyRef.current === contextKey;
    if (!isSameClientContext) {
      clientContextKeyRef.current = contextKey;
      termsEditedRef.current = false;
    }
    const preserveUserEdits = isSameClientContext;
    const preserveTermsEdits = termsEditedRef.current;

    const offerSalary =
      sourceMode === 'manual'
        ? Number(manual.offerSalary || 0)
        : Number(placementRow?.salaryOffered ?? selected?.salaryOffered ?? 0);
    const placementFee =
      sourceMode === 'manual'
        ? Number(manual.placementFee || 0)
        : Number(placementRow?.placementFee ?? selected?.placementFee ?? 0);
    const candidateName =
      sourceMode === 'manual'
        ? selectedCandidate?.name || ''
        : selected
          ? `${selected.candidate.firstName} ${selected.candidate.lastName}`.trim()
          : '';
    const jobTitle =
      sourceMode === 'manual'
        ? selectedJob?.title || ''
        : selected?.job.title || '';

    const agreementPct = agreementCommissionPct;
    const commissionPercent = agreementPct ?? undefined;

    if (sourceMode === 'manual' && agreementPct != null) {
      setManual((m) =>
        m.commissionPercentage === String(agreementPct)
          ? m
          : { ...m, commissionPercentage: String(agreementPct) },
      );
      if (!isSameClientContext) {
        setFeeEditedManually(false);
      }
    }

    setInvoice((prev) => {
      if (!prev) return prev;
      const next = applyClientContextToInvoice(prev, loadedClient, settings, {
        offerSalary,
        placementFee,
        candidateName,
        jobTitle,
        clientName: loadedClient?.companyName || clientDisplayName,
        commissionPercent,
        feeEditedManually,
        preserveUserEdits,
        preserveTermsEdits,
      });
      const email = String(prev.buyer.email || '').trim();
      if (email) next.buyer = { ...next.buyer, email };
      if (!next.sellerBank) {
        next.sellerBank = resolveSellerBankDetails(settings);
      }
      return next;
    });

    if (
      sourceMode === 'manual' &&
      !feeEditedManually &&
      offerSalary > 0 &&
      commissionPercent != null &&
      commissionPercent > 0
    ) {
      const computedFee = String(Math.round(calculatePlacementFee(offerSalary, commissionPercent)));
      setManual((m) =>
        m.placementFee === computedFee ? m : { ...m, placementFee: computedFee },
      );
    }
  }, [
    isOpen,
    settings,
    loadingClientContext,
    loadedClient,
    resolvedClientId,
    sourceMode,
    manual.jobId,
    manual.offerSalary,
    manual.placementFee,
    manual.commissionPercentage,
    feeEditedManually,
    placementId,
    selectedCandidate?.name,
    selectedJob?.title,
    selected?.id,
    clientDisplayName,
    placementRow?.salaryOffered,
    placementRow?.placementFee,
  ]);

  const updateLineItem = (index: number, patch: Partial<RecruitmentInvoiceData['lineItems'][0]>) => {
    setInvoice((prev) => {
      if (!prev) return prev;
      const lineItems = (prev.lineItems || []).map((item, i) =>
        i === index ? recalcLineItem({ ...item, ...patch }) : item,
      );
      return refreshTotals({ ...prev, lineItems });
    });
  };

  const addLineItem = () => {
    setInvoice((prev) => {
      if (!prev) return prev;
      const lineItems = [
        ...(prev.lineItems || []),
        recalcLineItem({ name: '', quantity: 1, price: 0, total: 0 }),
      ];
      return refreshTotals({ ...prev, lineItems });
    });
  };

  const removeLineItem = (index: number) => {
    setInvoice((prev) => {
      if (!prev || (prev.lineItems || []).length <= 1) return prev;
      const lineItems = (prev.lineItems || []).filter((_, i) => i !== index);
      return refreshTotals({ ...prev, lineItems });
    });
  };

  const updateCharge = (index: number, patch: Partial<RecruitmentInvoiceData['additionalCharges'][0]>) => {
    setInvoice((prev) => {
      if (!prev) return prev;
      const additionalCharges = (prev.additionalCharges || []).map((c, i) =>
        i === index ? { ...c, ...patch } : c,
      );
      return refreshTotals({ ...prev, additionalCharges });
    });
  };

  const addCharge = () => {
    setInvoice((prev) => {
      if (!prev) return prev;
      return refreshTotals({
        ...prev,
        additionalCharges: [...(prev.additionalCharges || []), { name: '', amount: 0 }],
      });
    });
  };

  const removeCharge = (index: number) => {
    setInvoice((prev) => {
      if (!prev) return prev;
      return refreshTotals({
        ...prev,
        additionalCharges: (prev.additionalCharges || []).filter((_, i) => i !== index),
      });
    });
  };

  const buildPayload = (status: 'DRAFT' | 'SENT'): CreatePlacementInvoicePayload => {
    if (!invoice) throw new Error('Invoice not ready');
    return {
      invoiceNo: invoice.invoiceNo,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      currency: invoice.currency,
      status,
      notes: invoice.notes,
      lineItems: invoice.lineItems || [],
      additionalCharges: invoice.additionalCharges || [],
      subtotal: invoice.subtotal,
      taxRate: invoice.taxRate,
      taxAmount: invoice.taxAmount,
      total: invoice.total,
      buyer: invoice.buyer,
      seller: invoice.seller,
      placementSummary: invoice.placementSummary,
      termsAndConditions: invoice.termsAndConditions,
      legalTerms: invoice.legalTerms,
      sellerBank: invoice.sellerBank,
      buyerBank: invoice.buyerBank,
      clientSignatory: invoice.clientSignatory,
      agencySignatory: invoice.agencySignatory,
    };
  };

  const updateSellerBank = (patch: Partial<InvoiceBankDetails>) => {
    setInvoice((prev) => {
      if (!prev) return prev;
      const sellerBank = {
        bankName: '',
        accountNumber: '',
        swiftCode: '',
        ...(prev.sellerBank || {}),
        ...patch,
      };
      return { ...prev, sellerBank };
    });
  };

  const updateAgencySignatory = (patch: {
    name?: string;
    designation?: string;
    signatureImageUrl?: string;
  }) => {
    setInvoice((prev) => {
      if (!prev) return prev;
      const agencySignatory = {
        label: 'Agency',
        name: prev.agencySignatory?.name || 'Authorized Signatory',
        ...prev.agencySignatory,
        ...patch,
      };
      return { ...prev, agencySignatory };
    });
  };

  const buildManualPlacementPayload = (): CreatePlacementPayload => {
    if (!selectedJob || !manual.candidateId) {
      throw new Error('Select candidate and job');
    }
    return {
      candidateId: manual.candidateId,
      jobId: manual.jobId,
      companyId: selectedJob.clientId,
      recruiterId: manual.recruiterId || undefined,
      offerSalary: manual.offerSalary,
      placementFee: manual.placementFee,
      commissionPercentage:
        agreementCommissionPct != null
          ? String(agreementCommissionPct)
          : manual.commissionPercentage,
      currency: invoice?.currency || resolveOrgDefaultCurrency(settings),
      offerDate: manual.offerDate,
      employmentType: manual.employmentType,
      notes: invoice?.notes,
    };
  };

  const validate = (): boolean => {
    if (sourceMode === 'existing') {
      if (!placementId) {
        setError('Select a placement');
        return false;
      }
    } else {
      if (!manual.candidateId) {
        setError('Select a candidate');
        return false;
      }
      if (!manual.jobId) {
        setError('Select a job');
        return false;
      }
      if (!manual.offerSalary || Number(manual.offerSalary) <= 0) {
        setError('Offer salary is required');
        return false;
      }
      if (!manual.placementFee || Number(manual.placementFee) <= 0) {
        setError('Placement fee is required');
        return false;
      }
      if (!manual.offerDate) {
        setError('Offer date is required');
        return false;
      }
    }
    if (!invoice?.invoiceNo?.trim()) {
      setError('Invoice number is required');
      return false;
    }
    const validLines = (invoice.lineItems || []).filter((l) => l.name.trim() && l.quantity > 0);
    if (!validLines.length) {
      setError('Add at least one line item with a description');
      return false;
    }
    if (invoice.total <= 0) {
      setError('Invoice total must be greater than zero');
      return false;
    }
    setError('');
    return true;
  };

  const downloadPdf = async () => {
    const el = previewRef.current;
    if (!el || !invoice) return;
    const safeNo = invoice.invoiceNo.replace(/[^\w-]+/g, '_');
    await generateInvoicePdfFromElement(el, `${safeNo}.pdf`);
  };

  const handleSave = async (
    status: 'DRAFT' | 'SENT',
    options: { withPdf?: boolean; intent?: 'save' | 'send' } = {},
  ) => {
    if (!validate() || !invoice) return;
    try {
      const invoicePayload = buildPayload(status);
      const result = await onSubmit(
        editingDraft
          ? {
              billingRecordId: initialBillingRecordId,
              placementId,
              invoice: invoicePayload,
              intent: options.intent ?? 'save',
            }
          : sourceMode === 'manual'
            ? {
                newPlacement: buildManualPlacementPayload(),
                invoice: invoicePayload,
                intent: options.intent ?? 'save',
              }
            : { placementId, invoice: invoicePayload, intent: options.intent ?? 'save' },
      );
      if (options.withPdf) {
        await downloadPdf();
      }
      return result;
    } catch (submitError: any) {
      setError(submitError?.message || 'Failed to create invoice');
      throw submitError;
    }
  };

  const handleSendInvoiceToClient = async () => {
    if (!validate() || !invoice) return;
    const email = String(invoice.buyer.email || '').trim();
    if (!email) {
      setError('Enter the client billing email in Bill to (client) before sending.');
      return;
    }
    setSendingEmail(true);
    setError('');
    try {
      if (!settings) {
        throw new Error('Invoice settings are not loaded yet');
      }
      const safeNo = invoice.invoiceNo.replace(/[^\w-]+/g, '_') || 'invoice';
      const pdfFilename = `${safeNo}.pdf`;
      const pdfBlob = await generateInvoicePdfBlobFromComponent(
        <RecruitmentInvoicePreview invoice={invoice} settings={settings} />,
      );
      const pdfBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = String(reader.result || '');
          resolve(result.includes(',') ? result.split(',')[1] : result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(pdfBlob);
      });

      const result = await handleSave('SENT', { intent: 'send' });
      if (!result) return;
      const recordId = result.billingRecordId || initialBillingRecordId;
      if (!recordId) {
        throw new Error('Invoice was saved but could not be sent. Try again from Billing.');
      }
      await apiSendBillingInvoice(recordId, { toEmail: email, pdfBase64, pdfFilename });
      toast.success(`Invoice ${result.invoiceNumber || invoice.invoiceNo} sent to ${email} with PDF attached`);
      window.dispatchEvent(new CustomEvent('jobportal:billing-changed'));
      window.dispatchEvent(new CustomEvent('jobportal:placements-changed'));
      onClose();
    } catch (sendError: any) {
      setError(sendError?.message || 'Failed to send invoice to client');
    } finally {
      setSendingEmail(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20';
  const labelClass = 'mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400';

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-slate-900/50 backdrop-blur-[1px]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            className="fixed inset-4 z-[100] mx-auto flex max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl md:inset-6 lg:inset-8"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {editingDraft ? 'Edit invoice draft' : 'Create placement invoice'}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {editingDraft
                      ? 'Update this draft, preview it, then send it to the client.'
                      : 'Review details, preview the invoice, then send it to the client.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {!canSubmit && !loadingMeta ? (
              <div className="flex-1 overflow-y-auto p-6">
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  No billable placements found and manual placement is not available. Add a placement with a
                  fee, or enable placement creation.
                </p>
              </div>
            ) : loadingMeta || !invoice ? (
              <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
                {loadingMeta ? 'Loading invoice settings…' : 'Preparing invoice…'}
              </div>
            ) : (
              <>
                <div className="flex shrink-0 gap-2 border-b border-slate-100 px-5 py-2 lg:hidden">
                  <button
                    type="button"
                    onClick={() => setActiveTab('edit')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      activeTab === 'edit' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('preview')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      activeTab === 'preview' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Preview
                  </button>
                </div>

                <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                  <div
                    className={`${
                      activeTab === 'preview' ? 'hidden lg:flex' : 'flex'
                    } min-h-0 w-full flex-col border-r border-slate-100 lg:w-[42%]`}
                  >
                    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                      {editingDraft && invoice ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                          <p className="font-semibold text-slate-900">
                            {invoice.placementSummary?.candidateName ||
                              `${invoice.buyer?.name || 'Placement'} invoice`}
                          </p>
                          <p className="mt-0.5 text-slate-500">
                            {invoice.placementSummary?.jobTitle || '—'} •{' '}
                            {invoice.placementSummary?.clientName || invoice.buyer?.name || '—'}
                          </p>
                          <p className="mt-2 text-xs text-slate-500">
                            Invoice {invoice.invoiceNo} — placement cannot be changed while editing a draft.
                          </p>
                        </div>
                      ) : null}

                      {showManualMode ? (
                        <>
                          <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                            <button
                              type="button"
                              onClick={() => setSourceMode('existing')}
                              disabled={eligible.length === 0}
                              className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                                sourceMode === 'existing'
                                  ? 'bg-white text-slate-900 shadow-sm'
                                  : 'text-slate-600 hover:text-slate-900 disabled:opacity-40'
                              }`}
                            >
                              Existing placement
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSourceMode('manual');
                                if (settings && invoice && !selectedCandidate) {
                                  setInvoice(buildBlankInvoice(settings, invoice.invoiceNo));
                                }
                              }}
                              className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                                sourceMode === 'manual'
                                  ? 'bg-white text-slate-900 shadow-sm'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              New placement
                            </button>
                          </div>
                          {sourceMode === 'manual' ? (
                            <p className="text-xs text-slate-500 -mt-2">
                              Create placement, then invoice — candidate and job are saved when you send or save
                              the draft.
                            </p>
                          ) : null}
                        </>
                      ) : null}

                      {sourceMode === 'existing' && !editingDraft ? (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="sm:col-span-2">
                            <label className={labelClass}>Placement</label>
                            {eligible.length === 0 ? (
                              <p className="text-sm text-amber-700 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                                No placements with a billable fee. Switch to{' '}
                                <strong>New placement</strong> to bill a candidate now.
                              </p>
                            ) : (
                              <select
                                value={placementId}
                                onChange={(e) => setPlacementId(e.target.value)}
                                className={inputClass}
                              >
                                {eligible.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {`${p.candidate.firstName} ${p.candidate.lastName}`.trim()} —{' '}
                                    {p.client.companyName} (
                                    {formatCurrencyAmount(
                                      p.placementFee ?? 0,
                                      invoice?.currency || resolveOrgDefaultCurrency(settings),
                                    )}
                                    )
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                          {invoice ? (
                            <div>
                              <label className={labelClass}>Invoice currency</label>
                              <select
                                className={inputClass}
                                value={invoice.currency}
                                onChange={(e) =>
                                  updateInvoice({ currency: e.target.value.toUpperCase() })
                                }
                              >
                                {SUPPORTED_CURRENCIES.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : null}
                        </div>
                      ) : editingDraft && invoice ? (
                        <div className="space-y-3">
                          <div>
                            <label className={labelClass}>Invoice currency</label>
                            <select
                              className={inputClass}
                              value={invoice.currency}
                              onChange={(e) => updateInvoice({ currency: e.target.value.toUpperCase() })}
                            >
                              {SUPPORTED_CURRENCIES.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/30 p-4">
                          <p className="text-xs font-semibold text-indigo-900">
                            Create placement, then invoice
                          </p>
                          <div>
                            <label className={labelClass}>Candidate</label>
                            <select
                              value={manual.candidateId}
                              onChange={(e) =>
                                setManual((m) => ({ ...m, candidateId: e.target.value }))
                              }
                              className={inputClass}
                            >
                              <option value="">Select candidate</option>
                              {candidateOptions.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} • {c.email}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className={labelClass}>Job</label>
                            <select
                              value={manual.jobId}
                              onChange={(e) => setManual((m) => ({ ...m, jobId: e.target.value }))}
                              className={inputClass}
                            >
                              <option value="">Select job</option>
                              {jobOptions.map((j) => (
                                <option key={j.id} value={j.id}>
                                  {j.title} • {j.clientName}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className={labelClass}>Client (company)</label>
                            <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                              {selectedJob?.clientName || 'Select a job to see the client'}
                            </p>
                          </div>
                          {recruiterOptions.length > 0 ? (
                            <div>
                              <label className={labelClass}>Team Member</label>
                              <select
                                value={manual.recruiterId}
                                onChange={(e) =>
                                  setManual((m) => ({ ...m, recruiterId: e.target.value }))
                                }
                                className={inputClass}
                              >
                                <option value="">Optional</option>
                                {recruiterOptions.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : null}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className={labelClass}>Offer salary</label>
                              <input
                                type="number"
                                min={0}
                                className={inputClass}
                                value={manual.offerSalary}
                                onChange={(e) =>
                                  setManual((m) => ({ ...m, offerSalary: e.target.value }))
                                }
                              />
                            </div>
                            {invoice ? (
                              <div>
                                <label className={labelClass}>Invoice currency</label>
                                <select
                                  className={inputClass}
                                  value={invoice.currency}
                                  onChange={(e) =>
                                    updateInvoice({ currency: e.target.value.toUpperCase() })
                                  }
                                >
                                  {SUPPORTED_CURRENCIES.map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : null}
                            <div>
                              <label className={labelClass}>
                                Commission %{' '}
                                {agreementCommissionPct != null ? (
                                  <span className="font-normal normal-case text-slate-500">
                                    (from client agreement)
                                  </span>
                                ) : null}
                              </label>
                              <input
                                type="number"
                                min={0}
                                readOnly={agreementCommissionPct != null}
                                className={
                                  agreementCommissionPct != null
                                    ? `${inputClass} bg-slate-50 text-slate-700`
                                    : inputClass
                                }
                                value={
                                  agreementCommissionPct != null
                                    ? String(agreementCommissionPct)
                                    : manual.commissionPercentage
                                }
                                onChange={(e) => {
                                  if (agreementCommissionPct != null) return;
                                  setFeeEditedManually(false);
                                  setManual((m) => ({
                                    ...m,
                                    commissionPercentage: e.target.value,
                                  }));
                                }}
                              />
                            </div>
                            <div>
                              <label className={labelClass}>Placement fee</label>
                              <input
                                type="number"
                                min={0}
                                className={inputClass}
                                value={manual.placementFee}
                                onChange={(e) => {
                                  setFeeEditedManually(true);
                                  setManual((m) => ({ ...m, placementFee: e.target.value }));
                                }}
                              />
                            </div>
                            <div>
                              <label className={labelClass}>Offer date</label>
                              <input
                                type="date"
                                className={inputClass}
                                value={manual.offerDate}
                                onChange={(e) =>
                                  setManual((m) => ({ ...m, offerDate: e.target.value }))
                                }
                              />
                            </div>
                          </div>
                          <div>
                            <label className={labelClass}>Employment type</label>
                            <select
                              value={manual.employmentType}
                              onChange={(e) =>
                                setManual((m) => ({
                                  ...m,
                                  employmentType: e.target.value as EmploymentType,
                                }))
                              }
                              className={inputClass}
                            >
                              {(['PERMANENT', 'CONTRACT', 'FREELANCE'] as EmploymentType[]).map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>Invoice #</label>
                          <input
                            className={inputClass}
                            value={invoice.invoiceNo}
                            onChange={(e) => updateInvoice({ invoiceNo: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Invoice date</label>
                          <input
                            type="date"
                            className={inputClass}
                            value={invoice.invoiceDate}
                            onChange={(e) => updateInvoice({ invoiceDate: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Due date</label>
                          <input
                            type="date"
                            className={inputClass}
                            value={invoice.dueDate}
                            onChange={(e) => updateInvoice({ dueDate: e.target.value })}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <label className={labelClass}>Line items</label>
                          <button
                            type="button"
                            onClick={addLineItem}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                          >
                            <Plus size={14} /> Add line
                          </button>
                        </div>
                        <div className="space-y-2">
                          {(invoice.lineItems || []).map((item, idx) => (
                            <div
                              key={idx}
                              className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2"
                            >
                              <input
                                className={inputClass}
                                placeholder="Description"
                                value={item.name}
                                onChange={(e) => updateLineItem(idx, { name: e.target.value })}
                              />
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <span className="text-[10px] text-slate-400">Qty</span>
                                  <input
                                    type="number"
                                    min={0}
                                    className={inputClass}
                                    value={item.quantity}
                                    onChange={(e) =>
                                      updateLineItem(idx, { quantity: Number(e.target.value) })
                                    }
                                  />
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-400">Rate</span>
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    className={inputClass}
                                    value={item.price}
                                    onChange={(e) =>
                                      updateLineItem(idx, { price: Number(e.target.value) })
                                    }
                                  />
                                </div>
                                <div className="flex items-end gap-1">
                                  <div className="flex-1">
                                    <span className="text-[10px] text-slate-400">Total</span>
                                    <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium tabular-nums">
                                      {formatCurrencyAmount(item.total, invoice.currency)}
                                    </p>
                                  </div>
                                  {(invoice.lineItems || []).length > 1 ? (
                                    <button
                                      type="button"
                                      onClick={() => removeLineItem(idx)}
                                      className="mb-0.5 rounded-lg p-2 text-red-500 hover:bg-red-50"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <label className={labelClass}>Additional charges</label>
                          <button
                            type="button"
                            onClick={addCharge}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                          >
                            <Plus size={14} /> Add charge
                          </button>
                        </div>
                        {(invoice.additionalCharges || []).length === 0 ? (
                          <p className="text-xs text-slate-400">No extra charges.</p>
                        ) : (
                          <div className="space-y-2">
                            {(invoice.additionalCharges || []).map((charge, idx) => (
                              <div key={idx} className="flex gap-2">
                                <input
                                  className={`${inputClass} flex-1`}
                                  placeholder="Charge name"
                                  value={charge.name}
                                  onChange={(e) => updateCharge(idx, { name: e.target.value })}
                                />
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  className={`${inputClass} w-28`}
                                  value={charge.amount}
                                  onChange={(e) =>
                                    updateCharge(idx, { amount: Number(e.target.value) })
                                  }
                                />
                                <button
                                  type="button"
                                  onClick={() => removeCharge(idx)}
                                  className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className={labelClass}>
                          {settings?.taxLabel || 'Tax'} rate (%)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className={inputClass}
                          value={invoice.taxRate}
                          onChange={(e) => updateInvoice({ taxRate: Number(e.target.value) })}
                        />
                      </div>

                      <PlacementInvoiceEditableSidePanel
                        invoice={invoice}
                        settings={settings}
                        loadingClient={loadingClientContext}
                        hasClient={Boolean(resolvedClientId)}
                        clientName={clientDisplayName}
                        previewCurrency={previewCurrency}
                        onPreviewCurrencyChange={setPreviewCurrency}
                        onUpdate={updateInvoice}
                        onTermsUserEdit={() => {
                          termsEditedRef.current = true;
                        }}
                        onUpdateSellerBank={updateSellerBank}
                        onUpdateAgencySignatory={updateAgencySignatory}
                      />

                      <div>
                        <label className={labelClass}>Bill to (client)</label>
                        <input
                          className={`${inputClass} mb-2`}
                          value={invoice.buyer.name}
                          onChange={(e) =>
                            updateInvoice({ buyer: { ...invoice.buyer, name: e.target.value } })
                          }
                        />
                        <input
                          type="email"
                          className={`${inputClass} mb-2`}
                          placeholder="Client email"
                          value={invoice.buyer.email || ''}
                          onChange={(e) =>
                            updateInvoice({ buyer: { ...invoice.buyer, email: e.target.value } })
                          }
                        />
                        {!invoice.buyer.email ? (
                          <p className="mb-2 text-xs text-amber-600">
                            No client email on file — enter the billing email for this invoice.
                          </p>
                        ) : null}
                        <textarea
                          className={`${inputClass} min-h-[60px]`}
                          placeholder="Billing address"
                          value={invoice.buyer.address || ''}
                          onChange={(e) =>
                            updateInvoice({ buyer: { ...invoice.buyer, address: e.target.value } })
                          }
                        />
                      </div>

                      <div>
                        <label className={labelClass}>From (your agency)</label>
                        <input
                          className={`${inputClass} mb-2`}
                          value={invoice.seller.name}
                          onChange={(e) =>
                            updateInvoice({ seller: { ...invoice.seller, name: e.target.value } })
                          }
                        />
                        <textarea
                          className={`${inputClass} min-h-[60px]`}
                          placeholder="Agency address"
                          value={invoice.seller.address || ''}
                          onChange={(e) =>
                            updateInvoice({ seller: { ...invoice.seller, address: e.target.value } })
                          }
                        />
                      </div>

                      <div>
                        <label className={labelClass}>Notes (optional)</label>
                        <p className="text-[10px] text-slate-500 mb-1">
                          Short internal note on page 1 only. Agreement terms belong in Terms &amp;
                          conditions above.
                        </p>
                        <textarea
                          className={`${inputClass} min-h-[56px]`}
                          value={invoice.notes}
                          onChange={(e) => updateInvoice({ notes: e.target.value })}
                          placeholder="Placement invoice for candidate name…"
                        />
                      </div>

                      {sourceMode === 'existing' && selected ? (
                        <p className="text-xs text-slate-500">
                          Placement fee on record:{' '}
                          {formatCurrencyAmount(selected.placementFee ?? 0, invoice.currency)}
                        </p>
                      ) : null}
                      {sourceMode === 'manual' && selectedJob ? (
                        <p className="text-xs text-slate-500">
                          New placement for {selectedJob.clientName} — fee{' '}
                          {formatCurrencyAmount(Number(manual.placementFee) || 0, invoice.currency)}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div
                    className={`${
                      activeTab === 'edit' ? 'hidden lg:flex' : 'flex'
                    } min-h-0 flex-1 flex-col bg-slate-50`}
                  >
                    <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Live preview</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Scroll for page 2 — terms, banks &amp; signatures
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void downloadPdf()}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Download size={14} />
                        Download PDF
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5">
                      <RecruitmentInvoicePreview
                        key={`${invoice.subtotal}-${invoice.taxAmount}-${invoice.total}-${previewCurrency}-${invoice.lineItems.map((l) => l.total).join('-')}`}
                        ref={previewRef}
                        invoice={invoice}
                        settings={settings}
                        displayCurrency={previewCurrency}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {error ? (
              <p className="shrink-0 px-5 pb-2 text-sm text-red-600">{error}</p>
            ) : null}

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              {invoice && canSubmit ? (
                <>
                  <button
                    type="button"
                    disabled={isSubmitting || loadingMeta || sendingEmail}
                    onClick={() => void handleSave('DRAFT', { intent: 'save' })}
                    className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving…' : 'Save draft'}
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting || loadingMeta || sendingEmail || !invoice.buyer.email?.trim()}
                    onClick={() => void handleSendInvoiceToClient()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50"
                  >
                    <Send size={16} />
                    {sendingEmail ? 'Sending…' : 'Send invoice to client'}
                  </button>
                </>
              ) : null}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
