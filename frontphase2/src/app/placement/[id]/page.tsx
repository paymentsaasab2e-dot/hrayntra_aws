'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { apiGetPlacement } from '../../../lib/api';
import type { Placement } from '../../../types/placement';
import {
  formatCurrency,
  formatPlacementDate,
  getEmploymentTypeBadgeStyle,
  getPlacementStatusLabel,
  getStatusBadgeStyle,
} from '../../../utils/placements';

export default function PlacementDetailPage() {
  const params = useParams<{ id: string }>();
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPlacement() {
      try {
        setLoading(true);
        const response = await apiGetPlacement(params.id);
        setPlacement(response.data);
        setError(null);
      } catch (detailError: any) {
        setError(detailError.message || 'Failed to load placement');
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      loadPlacement();
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="mx-auto max-w-6xl space-y-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-xl bg-[#F3F4F6]" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !placement) {
    return (
      <div className="p-8">
        <div className="mx-auto max-w-4xl rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
          {error || 'Placement not found'}
        </div>
      </div>
    );
  }

  const statusStyle = getStatusBadgeStyle(placement.status);
  const typeStyle = getEmploymentTypeBadgeStyle(placement.employmentType);

  return (
    <div className="min-h-screen bg-[#F8F9FB] p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/placements" className="inline-flex items-center gap-2 text-sm font-medium text-[#2563EB] hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Back to placements
        </Link>

        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <h1 className="text-2xl font-bold text-[#111827]">
                {placement.candidate.firstName} {placement.candidate.lastName}
              </h1>
              <p className="mt-1 text-sm text-[#6B7280]">
                {placement.job.title} • {placement.client.companyName}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyle.bg} ${statusStyle.text}`}>
                {getPlacementStatusLabel(placement.status)}
              </span>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${typeStyle.bg} ${typeStyle.text}`}>
                {placement.employmentType || '—'}
              </span>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-[#F9FAFB] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Offer Salary</p>
              <p className="mt-1 text-lg font-semibold text-[#111827]">{formatCurrency(placement.salaryOffered)}</p>
            </div>
            <div className="rounded-xl bg-[#F9FAFB] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Placement Fee</p>
              <p className="mt-1 text-lg font-semibold text-[#111827]">{formatCurrency(placement.placementFee)}</p>
            </div>
            <div className="rounded-xl bg-[#F9FAFB] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Offer Date</p>
              <p className="mt-1 text-lg font-semibold text-[#111827]">{formatPlacementDate(placement.offerDate)}</p>
            </div>
            <div className="rounded-xl bg-[#F9FAFB] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Joining Date</p>
              <p className="mt-1 text-lg font-semibold text-[#111827]">{formatPlacementDate(placement.joiningDate)}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-[#111827]">Placement Details</h2>
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
                  <p className="text-sm font-medium text-[#111827]">Notes</p>
                  <p className="mt-1 text-sm text-[#4B5563]">{placement.notes}</p>
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-[#111827]">Activity Log</h2>
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
              <h2 className="text-lg font-semibold text-[#111827]">Documents</h2>
              <div className="mt-4 space-y-3">
                {(placement.documents || []).length ? (
                  placement.documents?.map((document) => (
                    <a
                      key={document.id}
                      href={document.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-xl border border-[#E5E7EB] p-4 hover:bg-[#F9FAFB]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-[#2563EB]">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-[#111827]">{document.fileName || document.documentType}</p>
                          <p className="text-sm text-[#6B7280]">{document.documentType}</p>
                        </div>
                      </div>
                      <Download className="h-4 w-4 text-[#6B7280]" />
                    </a>
                  ))
                ) : (
                  <p className="text-sm text-[#6B7280]">No documents uploaded.</p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-[#111827]">Billing</h2>
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
    </div>
  );
}
