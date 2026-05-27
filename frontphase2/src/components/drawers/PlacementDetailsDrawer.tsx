'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { Download, Eye, FileText, X } from 'lucide-react';
import { apiGetPlacement } from '../../lib/api';
import type { Placement } from '../../types/placement';
import { buildFileHref } from '../../utils/cloudinaryUrls';
import {
  formatCurrency,
  formatPlacementDate,
  getEmploymentTypeBadgeStyle,
  getPlacementStatusLabel,
  getStatusBadgeStyle,
} from '../../utils/placements';

interface PlacementDetailsDrawerProps {
  isOpen: boolean;
  placementId: string | null;
  onClose: () => void;
}

export function PlacementDetailsDrawer({
  isOpen,
  placementId,
  onClose,
}: PlacementDetailsDrawerProps) {
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadsBase = useMemo(
    () =>
      (typeof window !== 'undefined'
        ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1'
        : 'http://localhost:5001/api/v1'
      ).replace(/\/api\/v1\/?$/, ''),
    []
  );
  const toFileHref = (fileUrl?: string | null) => buildFileHref(fileUrl, uploadsBase);

  useEffect(() => {
    if (!isOpen || !placementId) {
      setPlacement(null);
      setError(null);
      return;
    }

    let cancelled = false;

    async function loadPlacement() {
      try {
        setLoading(true);
        setError(null);
        const response = await apiGetPlacement(placementId);
        if (!cancelled) {
          setPlacement(response.data);
        }
      } catch (detailError: any) {
        if (!cancelled) {
          setPlacement(null);
          setError(detailError.message || 'Failed to load placement');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPlacement();

    return () => {
      cancelled = true;
    };
  }, [isOpen, placementId]);

  const statusStyle = placement ? getStatusBadgeStyle(placement.status) : null;
  const typeStyle = placement ? getEmploymentTypeBadgeStyle(placement.employmentType) : null;

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-slate-900/40"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed right-0 top-0 z-[100] flex h-full w-full max-w-4xl flex-col border-l border-[#E5E7EB] bg-[#F8F9FB] shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[#E5E7EB] bg-white px-6 py-4">
              <h2 className="text-lg font-semibold text-[#111827]">Placement Details</h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="h-20 animate-pulse rounded-xl bg-[#F3F4F6]" />
                  ))}
                </div>
              ) : error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">{error}</div>
              ) : placement ? (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                      <div>
                        <h3 className="text-2xl font-bold text-[#111827]">
                          {placement.candidate.firstName} {placement.candidate.lastName}
                        </h3>
                        <p className="mt-1 text-sm text-[#6B7280]">
                          {placement.job.title} • {placement.client.companyName}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {statusStyle ? (
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyle.bg} ${statusStyle.text}`}
                          >
                            {getPlacementStatusLabel(placement.status)}
                          </span>
                        ) : null}
                        {typeStyle ? (
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${typeStyle.bg} ${typeStyle.text}`}
                          >
                            {placement.employmentType || '—'}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-xl bg-[#F9FAFB] p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Offer Salary</p>
                        <p className="mt-1 text-lg font-semibold text-[#111827]">
                          {formatCurrency(placement.salaryOffered)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-[#F9FAFB] p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Placement Fee</p>
                        <p className="mt-1 text-lg font-semibold text-[#111827]">
                          {formatCurrency(placement.placementFee)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-[#F9FAFB] p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Offer Date</p>
                        <p className="mt-1 text-lg font-semibold text-[#111827]">
                          {formatPlacementDate(placement.offerDate)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-[#F9FAFB] p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Joining Date</p>
                        <p className="mt-1 text-lg font-semibold text-[#111827]">
                          {formatPlacementDate(placement.joiningDate)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
                    <div className="space-y-6">
                      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
                        <h4 className="text-lg font-semibold text-[#111827]">Placement Details</h4>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div>
                            <p className="text-sm text-[#6B7280]">Recruiter</p>
                            <p className="font-medium text-[#111827]">{placement.recruiter?.name || '—'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-[#6B7280]">Payment Status</p>
                            <p className="font-medium text-[#111827]">{placement.paymentStatus || 'PENDING'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-[#6B7280]">Commission %</p>
                            <p className="font-medium text-[#111827]">{placement.commissionPercentage || 0}%</p>
                          </div>
                          <div>
                            <p className="text-sm text-[#6B7280]">Revenue</p>
                            <p className="font-medium text-[#111827]">{formatCurrency(placement.revenue)}</p>
                          </div>
                        </div>
                        {placement.notes ? (
                          <div className="mt-4 rounded-xl bg-[#F9FAFB] p-4">
                            <p className="text-sm font-medium text-[#111827]">Remarks</p>
                            <p className="mt-1 text-sm text-[#4B5563]">{placement.notes}</p>
                          </div>
                        ) : null}
                      </section>

                      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
                        <h4 className="text-lg font-semibold text-[#111827]">Activity Log</h4>
                        <div className="mt-4 space-y-4">
                          {(placement.activityLog || []).length ? (
                            placement.activityLog?.map((entry) => (
                              <div key={entry.id} className="rounded-xl border border-[#E5E7EB] p-4">
                                <p className="font-medium text-[#111827]">{entry.action}</p>
                                <p className="mt-1 text-sm text-[#6B7280]">
                                  {entry.actor?.name || 'System'} • {formatPlacementDate(entry.createdAt)}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-[#6B7280]">No placement activity yet.</p>
                          )}
                        </div>
                      </section>
                    </div>

                    <div className="space-y-6">
                      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
                        <h4 className="text-lg font-semibold text-[#111827]">Documents</h4>
                        <div className="mt-4 space-y-3">
                          {(placement.documents || []).length ? (
                            placement.documents?.map((document) => {
                              const href = toFileHref(document.fileUrl);
                              const hasFile = Boolean(document.fileUrl);
                              return (
                                <div
                                  key={document.id}
                                  className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] p-4 hover:bg-[#F9FAFB]"
                                >
                                  <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#2563EB]">
                                      <FileText className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="truncate font-medium text-[#111827]">
                                        {document.fileName || document.documentType}
                                      </p>
                                      <p className="text-sm text-[#6B7280]">{document.documentType}</p>
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1">
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
                                          ? 'text-slate-500 hover:bg-blue-50 hover:text-[#2563EB]'
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
                            <p className="text-sm text-[#6B7280]">No documents uploaded.</p>
                          )}
                        </div>
                      </section>

                      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="text-lg font-semibold text-[#111827]">Billing</h4>
                          {!(placement.billing || []).length && (placement.placementFee ?? 0) > 0 ? (
                            <Link
                              href={`/billing?createInvoice=1&placementId=${placement.id}`}
                              onClick={onClose}
                              className="text-xs font-semibold text-[#2563EB] hover:underline"
                            >
                              Create invoice in Billing
                            </Link>
                          ) : null}
                        </div>
                        <div className="mt-4 space-y-3">
                          {(placement.billing || []).length ? (
                            placement.billing?.map((bill) => (
                              <div key={bill.id} className="rounded-xl border border-[#E5E7EB] p-4">
                                <p className="font-medium text-[#111827]">{bill.invoiceNumber}</p>
                                <p className="mt-1 text-sm text-[#6B7280]">
                                  {bill.paymentStatus} • {formatCurrency(bill.totalAmount)}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-[#6B7280]">No billing records available.</p>
                          )}
                        </div>
                      </section>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
