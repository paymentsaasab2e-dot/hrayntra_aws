'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePageDrawerLifecycle } from '../../lib/pageDrawerEvents';
import { useDrawerUnsavedGuard } from '../../hooks/useDrawerUnsavedGuard';
import { AnimatePresence } from 'motion/react';
import { DetailsModalShell } from './DetailsModalShell';
import Link from 'next/link';
import {
  Activity,
  Award,
  Briefcase,
  Building2,
  Calendar,
  CreditCard,
  Download,
  Eye,
  FileText,
  IndianRupee,
  Undo2,
  User,
  X,
} from 'lucide-react';
import { apiGetPlacement, apiUploadPlacementDocument } from '../../lib/api';
import { startAsyncLoad } from '../../lib/asyncLoadGuard';
import { buildFileHref } from '../../utils/cloudinaryUrls';
import {
  formatCurrency,
  formatPlacementDate,
  getEmploymentTypeBadgeStyle,
  getPlacementStatusLabel,
  getStatusBadgeStyle,
} from '../../utils/placements';
import type { Placement, PlacementStatus } from '../../types/placement';
import { EntityAuditSummary } from '../table/TableAuditCell';
import { EntityWorkspaceAlertsPanel } from '../ai/EntityWorkspaceAlertsPanel';
import {
  DRAWER_FORM_CONTENT_CLASS,
  DRAWER_FORM_SELECT,
  DrawerFieldLabel,
  DrawerSectionCard,
} from './drawerFormUi';
import {
  DocumentUploadButton,
  useDocumentUploadFeedback,
} from '../import/documentUploadUi';

const PLACEMENT_UPLOAD_DOCUMENT_TYPES = [
  { value: 'OTHER', label: 'Other document' },
  { value: 'OFFER_LETTER', label: 'Offer letter' },
  { value: 'JOINING_LETTER', label: 'Joining letter' },
  { value: 'AGREEMENT', label: 'Agreement' },
  { value: 'INVOICE', label: 'Invoice' },
] as const;
interface PlacementDetailsDrawerProps {
  isOpen: boolean;
  placementId: string | null;
  onClose: () => void;
  canUpdate?: boolean;
  onStatusChange?: (placement: Placement, status: PlacementStatus) => Promise<void>;
  onScheduleJoining?: (placement: Placement) => void;
  onUndo?: (placement: Placement) => Promise<void>;
  onResendOffer?: (placement: Placement) => void;
  onRejectOfferCandidate?: (placement: Placement) => void;
}

function MetricCard({
  label,
  value,
  icon: Icon,
  accentClass,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accentClass: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-100/70 bg-gradient-to-br from-white via-slate-50/80 to-indigo-50/40 p-4 shadow-[0_10px_28px_-18px_rgba(79,70,229,0.22)] ring-1 ring-indigo-50/80">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-900/45">{label}</p>
          <p className="mt-1.5 truncate text-lg font-bold tracking-tight text-slate-900">{value}</p>
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-md ${accentClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

export function PlacementDetailsDrawer({
  isOpen,
  placementId,
  onClose,
  canUpdate = false,
  onStatusChange,
  onScheduleJoining,
  onUndo,
  onResendOffer,
  onRejectOfferCandidate,
}: PlacementDetailsDrawerProps) {
  usePageDrawerLifecycle(isOpen);
  const {
    panelRef: placementDrawerPanelRef,
    requestClose: requestPlacementDrawerClose,
  } = useDrawerUnsavedGuard<HTMLElement>({
    isOpen,
    onClose,
  });
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [uploadDocumentType, setUploadDocumentType] =
    useState<(typeof PLACEMENT_UPLOAD_DOCUMENT_TYPES)[number]['value']>('OTHER');
  const documentUploadFeedback = useDocumentUploadFeedback(uploadingDocument);

  const uploadsBase = useMemo(
    () =>
      (typeof window !== 'undefined'
        ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1'
        : 'http://localhost:5001/api/v1'
      ).replace(/\/api\/v1\/?$/, ''),
    [],
  );
  const toFileHref = (fileUrl?: string | null) => buildFileHref(fileUrl, uploadsBase);

  useEffect(() => {
    if (!isOpen || !placementId) {
      setPlacement(null);
      setError(null);
      setLoading(false);
      return;
    }

    const load = startAsyncLoad(setLoading);

    async function loadPlacement() {
      try {
        setError(null);
        const response = await apiGetPlacement(placementId);
        if (load.isActive()) setPlacement(response.data);
      } catch (detailError: any) {
        if (load.isActive()) {
          setPlacement(null);
          setError(detailError.message || 'Failed to load placement');
        }
      } finally {
        load.finish();
      }
    }

    void loadPlacement();

    return () => {
      load.abort();
    };
  }, [isOpen, placementId]);

  const reloadPlacement = async () => {
    if (!placementId) return;
    const response = await apiGetPlacement(placementId);
    setPlacement(response.data);
  };

  const handleStatusSelect = async (nextStatus: PlacementStatus) => {
    if (!placement || !onStatusChange || statusUpdating) return;
    if (nextStatus === placement.status) return;
    if (nextStatus === 'JOINING_SCHEDULED') {
      onScheduleJoining?.(placement);
      return;
    }
    try {
      setStatusUpdating(true);
      await onStatusChange(placement, nextStatus);
      await reloadPlacement();
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleUploadDocuments = async (files: File[]) => {
    if (!placementId || !files.length || uploadingDocument) return;
    const file = files[0];
    const name = file.name.toLowerCase();
    const type = (file.type || '').toLowerCase();
    const isPdf =
      type === 'application/pdf' ||
      type === 'application/x-pdf' ||
      name.endsWith('.pdf') ||
      (type === 'application/octet-stream' && name.endsWith('.pdf'));
    if (!isPdf) {
      documentUploadFeedback.markError('Only PDF files are allowed');
      return;
    }
    try {
      setUploadingDocument(true);
      const response = await apiUploadPlacementDocument(placementId, file, uploadDocumentType);
      setPlacement(response.data);
      documentUploadFeedback.markSuccess(file.name);
    } catch (uploadError: any) {
      documentUploadFeedback.markError(uploadError?.message || 'Failed to upload document');
    } finally {
      setUploadingDocument(false);
    }
  };

  const statusStyle = placement ? getStatusBadgeStyle(placement.status) : null;
  const typeStyle = placement ? getEmploymentTypeBadgeStyle(placement.employmentType) : null;
  const candidateName = placement
    ? `${placement.candidate.firstName} ${placement.candidate.lastName}`.trim()
    : '';

  return (
    <AnimatePresence>
      {isOpen ? (
        <DetailsModalShell
          panelRef={placementDrawerPanelRef}
          onBackdropClick={() => void requestPlacementDrawerClose()}
          size="md"
          zIndexClass="z-[100]"
          dialogTitleId="placement-detail-modal-title"
        >
          <div className="relative shrink-0 overflow-hidden border-b border-indigo-100/60 bg-gradient-to-br from-white via-indigo-50/45 to-violet-50/35 px-5 pb-4 pt-5 sm:px-6">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.12),_transparent_55%)]"
              aria-hidden
            />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white shadow-md shadow-indigo-500/25">
                  <Award className="h-3 w-3 text-indigo-100" />
                  Placement details
                </div>
                <h2
                  id="placement-detail-modal-title"
                  className="mt-2.5 truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
                >
                  {loading ? 'Loading…' : candidateName || 'Placement Details'}
                </h2>
                {placement ? (
                  <>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                          <Briefcase size={12} />
                        </span>
                        {placement.job.title}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-50 text-violet-600 ring-1 ring-violet-100">
                          <Building2 size={12} />
                        </span>
                        {placement.client.companyName}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {statusStyle ? (
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold shadow-sm ${statusStyle.bg} ${statusStyle.text}`}
                        >
                          {getPlacementStatusLabel(placement.status)}
                        </span>
                      ) : null}
                      {typeStyle ? (
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold shadow-sm ${typeStyle.bg} ${typeStyle.text}`}
                        >
                          {placement.employmentType || '—'}
                        </span>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">Offer, billing, and joining overview</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void requestPlacementDrawerClose()}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-white/80 hover:text-slate-700"
                aria-label="Close"
                data-drawer-skip-dirty="true"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className={`flex-1 overflow-y-auto ${DRAWER_FORM_CONTENT_CLASS}`}>
            <div className="space-y-5 px-5 py-5 sm:px-6">
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-24 animate-pulse rounded-2xl border border-indigo-100/60 bg-gradient-to-r from-slate-100 via-indigo-50/50 to-violet-50/40"
                    />
                  ))}
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700 shadow-sm">
                  {error}
                </div>
              ) : placement ? (
                <>
                  <EntityWorkspaceAlertsPanel
                    entityType="PLACEMENT"
                    entityId={placement.id}
                    entityLabel={`${candidateName} — ${placement.job.title}`}
                  />

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                      label="Offer Salary"
                      value={formatCurrency(placement.salaryOffered)}
                      icon={IndianRupee}
                      accentClass="bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/20"
                    />
                    <MetricCard
                      label="Placement Fee"
                      value={formatCurrency(placement.placementFee)}
                      icon={CreditCard}
                      accentClass="bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 shadow-indigo-500/25"
                    />
                    <MetricCard
                      label="Offer Date"
                      value={formatPlacementDate(placement.offerDate)}
                      icon={Calendar}
                      accentClass="bg-gradient-to-br from-amber-500 to-orange-500 shadow-amber-500/20"
                    />
                    <MetricCard
                      label="Joining Date"
                      value={formatPlacementDate(placement.joiningDate)}
                      icon={Calendar}
                      accentClass="bg-gradient-to-br from-sky-500 to-blue-600 shadow-sky-500/20"
                    />
                  </div>

                  {(canUpdate &&
                    onScheduleJoining &&
                    ['OFFER_ACCEPTED', 'JOINING_SCHEDULED'].includes(placement.status)) ||
                  (canUpdate && onUndo && placement.status !== 'JOINED') ||
                  (canUpdate && placement.status === 'OFFER_REJECTED') ? (
                    <div className="flex flex-wrap gap-2">
                      {canUpdate &&
                      onScheduleJoining &&
                      ['OFFER_ACCEPTED', 'JOINING_SCHEDULED'].includes(placement.status) ? (
                        <button
                          type="button"
                          onClick={() => onScheduleJoining(placement)}
                          className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-amber-500/20 transition hover:brightness-110"
                        >
                          {placement.status === 'JOINING_SCHEDULED'
                            ? 'Edit joining schedule'
                            : 'Schedule joining'}
                        </button>
                      ) : null}

                      {canUpdate && onUndo && placement.status !== 'JOINED' ? (
                        <button
                          type="button"
                          onClick={() => onUndo(placement)}
                          className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-800 shadow-sm transition hover:bg-sky-100"
                        >
                          <Undo2 className="h-4 w-4" />
                          Undo placement
                        </button>
                      ) : null}

                      {canUpdate && placement.status === 'OFFER_REJECTED' ? (
                        <>
                          {onResendOffer ? (
                            <button
                              type="button"
                              onClick={() => onResendOffer(placement)}
                              className="rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:brightness-110"
                            >
                              Resend offer letter
                            </button>
                          ) : null}
                          {onRejectOfferCandidate ? (
                            <button
                              type="button"
                              onClick={() => onRejectOfferCandidate(placement)}
                              className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50"
                            >
                              Reject candidate
                            </button>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  {placement.reportingToName ? (
                    <div className="rounded-2xl border border-amber-100/90 bg-gradient-to-br from-amber-50/90 via-white to-orange-50/40 p-4 shadow-sm ring-1 ring-amber-50/80">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-800/70">
                        Reporting contact
                      </p>
                      <p className="mt-1.5 font-semibold text-slate-900">{placement.reportingToName}</p>
                      {placement.reportingToTitle ? (
                        <p className="text-sm text-slate-500">{placement.reportingToTitle}</p>
                      ) : null}
                      {placement.reportingToEmail ? (
                        <p className="text-sm font-medium text-indigo-600">{placement.reportingToEmail}</p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
                    <div className="space-y-5">
                      <DrawerSectionCard
                        title="Placement summary"
                        subtitle="Team, commission, and revenue"
                        icon={User}
                        accent="indigo"
                      >
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <DrawerFieldLabel label="Team Member" />
                            <p className="text-sm font-semibold text-slate-900">
                              {placement.recruiter?.name || '—'}
                            </p>
                          </div>
                          <div>
                            <DrawerFieldLabel label="Payment Status" />
                            <p className="text-sm font-semibold text-slate-900">
                              {placement.paymentStatus || 'PENDING'}
                            </p>
                          </div>
                          <div>
                            <DrawerFieldLabel label="Commission %" />
                            <p className="text-sm font-semibold text-slate-900">
                              {placement.commissionPercentage || 0}%
                            </p>
                          </div>
                          <div>
                            <DrawerFieldLabel label="Revenue" />
                            <p className="text-sm font-semibold text-slate-900">
                              {formatCurrency(placement.revenue)}
                            </p>
                          </div>
                        </div>
                        {placement.notes ? (
                          <div className="rounded-xl border border-indigo-50 bg-slate-50/80 p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                              Internal remarks
                            </p>
                            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{placement.notes}</p>
                          </div>
                        ) : null}
                      </DrawerSectionCard>

                      {placement.candidateOfferRemark ? (
                        <DrawerSectionCard
                          title="Candidate remarks"
                          subtitle="Shared when declining the offer"
                          icon={FileText}
                          accent="rose"
                        >
                          <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-4">
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-rose-950">
                              {placement.candidateOfferRemark}
                            </p>
                          </div>
                        </DrawerSectionCard>
                      ) : null}

                      <DrawerSectionCard
                        title="Activity log"
                        subtitle="Recent placement events"
                        icon={Activity}
                        accent="sky"
                      >
                        <EntityAuditSummary audit={placement.auditMeta} className="mb-1" />
                        <div className="space-y-3">
                          {(placement.activityLog || []).length ? (
                            placement.activityLog?.map((entry) => (
                              <div
                                key={entry.id}
                                className="rounded-xl border border-sky-100/80 bg-gradient-to-r from-white to-sky-50/40 p-4 shadow-sm"
                              >
                                <p className="font-semibold text-slate-900">{entry.action}</p>
                                <p className="mt-1 text-sm text-slate-500">
                                  {entry.actor?.name || 'System'} •{' '}
                                  {formatPlacementDate(entry.createdAt)}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-slate-500">No placement activity yet.</p>
                          )}
                        </div>
                      </DrawerSectionCard>
                    </div>

                    <div className="space-y-5">
                      <DrawerSectionCard
                        title="Documents & Notes"
                        subtitle="Upload PDFs and review internal notes"
                        icon={FileText}
                        accent="blue"
                      >
                        {canUpdate ? (
                          <div className="space-y-3 rounded-xl border border-dashed border-indigo-200 bg-gradient-to-br from-white via-indigo-50/30 to-violet-50/20 p-4">
                            <div>
                              <DrawerFieldLabel label="Document type" />
                              <select
                                value={uploadDocumentType}
                                onChange={(event) =>
                                  setUploadDocumentType(
                                    event.target
                                      .value as (typeof PLACEMENT_UPLOAD_DOCUMENT_TYPES)[number]['value'],
                                  )
                                }
                                className={DRAWER_FORM_SELECT}
                                disabled={uploadingDocument}
                              >
                                {PLACEMENT_UPLOAD_DOCUMENT_TYPES.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <DocumentUploadButton
                              label="Upload document (PDF)"
                              accept="application/pdf,.pdf"
                              isUploading={uploadingDocument}
                              uploadSuccess={documentUploadFeedback.uploadSuccess}
                              uploadPercent={documentUploadFeedback.uploadPercent}
                              onFilesSelected={handleUploadDocuments}
                            />
                            <p className="text-xs text-slate-500">PDF only · max 5 MB</p>
                          </div>
                        ) : null}

                        <div className="space-y-3">
                          {(placement.documents || []).length ? (
                            placement.documents?.map((document) => {
                              const href = toFileHref(document.fileUrl);
                              const hasFile = Boolean(document.fileUrl);
                              return (
                                <div
                                  key={document.id}
                                  className="flex items-center justify-between gap-3 rounded-xl border border-indigo-100/70 bg-gradient-to-r from-white to-indigo-50/30 p-3.5 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/40"
                                >
                                  <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25">
                                      <FileText className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold text-slate-900">
                                        {document.fileName || document.documentType}
                                      </p>
                                      <p className="text-xs text-slate-500">{document.documentType}</p>
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-0.5 rounded-2xl bg-indigo-50/60 p-1 ring-1 ring-indigo-100/80">
                                    <a
                                      href={hasFile ? href : undefined}
                                      target={hasFile ? '_blank' : undefined}
                                      rel={hasFile ? 'noreferrer' : undefined}
                                      aria-disabled={!hasFile}
                                      title="View"
                                      className={`rounded-lg p-2 ${
                                        hasFile
                                          ? 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'
                                          : 'cursor-not-allowed text-slate-300'
                                      }`}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </a>
                                    <a
                                      href={hasFile ? href : undefined}
                                      download={document.fileName || undefined}
                                      target={hasFile ? '_blank' : undefined}
                                      rel={hasFile ? 'noreferrer' : undefined}
                                      aria-disabled={!hasFile}
                                      title="Download"
                                      className={`rounded-lg p-2 ${
                                        hasFile
                                          ? 'text-slate-500 hover:bg-blue-50 hover:text-indigo-600'
                                          : 'cursor-not-allowed text-slate-300'
                                      }`}
                                    >
                                      <Download className="h-4 w-4" />
                                    </a>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-sm text-slate-500">No documents uploaded yet.</p>
                          )}
                        </div>

                        <div className="rounded-xl border border-indigo-50 bg-slate-50/80 p-4">
                          <DrawerFieldLabel label="Internal notes" />
                          {placement.notes ? (
                            <p className="mt-1 text-sm leading-relaxed text-slate-600">{placement.notes}</p>
                          ) : (
                            <p className="mt-1 text-sm text-slate-500">No internal notes for this placement.</p>
                          )}
                        </div>
                      </DrawerSectionCard>

                      <DrawerSectionCard
                        title="Billing"
                        subtitle="Invoices linked to this placement"
                        icon={CreditCard}
                        accent="emerald"
                      >
                        <div className="flex items-center justify-between gap-3">
                          {!(placement.billing || []).length && (placement.placementFee ?? 0) > 0 ? (
                            <Link
                              href={`/billing?createInvoice=1&placementId=${placement.id}`}
                              onClick={onClose}
                              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
                            >
                              Create invoice in Billing
                            </Link>
                          ) : (
                            <span />
                          )}
                        </div>
                        <div className="space-y-3">
                          {(placement.billing || []).length ? (
                            placement.billing?.map((bill) => (
                              <div
                                key={bill.id}
                                className="rounded-xl border border-emerald-100/80 bg-gradient-to-r from-white to-emerald-50/40 p-4 shadow-sm"
                              >
                                <p className="font-semibold text-slate-900">{bill.invoiceNumber}</p>
                                <p className="mt-1 text-sm text-slate-500">
                                  {bill.paymentStatus} • {formatCurrency(bill.totalAmount)}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-slate-500">No billing records available.</p>
                          )}
                        </div>
                      </DrawerSectionCard>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </DetailsModalShell>
      ) : null}
    </AnimatePresence>
  );
}
