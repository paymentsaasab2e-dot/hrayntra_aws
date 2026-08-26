import { prisma } from '../../config/prisma.js';
import {
  getCommissionSlabs,
  jobSalaryAnchor,
  jobSalaryCurrency,
  resolveCommissionFromContext,
} from '../setting/commissionSlabs.service.js';

function moneyRound(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * When a candidate is moved to Offer or Hired/Placed, create (or refresh) the
 * placement + draft invoice using org commission slabs. Skips if slabs are off,
 * there is no salary to match, or an invoice is already paid/sent.
 */
export async function ensureSlabBackedPlacement({
  candidateId,
  jobId,
  performedById,
  stage,
} = {}) {
  if (!candidateId || !jobId) return null;
  const config = await getCommissionSlabs();
  if (!config.enabled) return null;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      title: true,
      clientId: true,
      salary: true,
      assignedToId: true,
    },
  });
  if (!job?.clientId) return null;

  const existing = await prisma.placement.findFirst({
    where: { candidateId, jobId, deletedAt: null },
    include: {
      billingRecords: { orderBy: { createdAt: 'desc' }, take: 3 },
      billing: { orderBy: { createdAt: 'desc' }, take: 3 },
    },
  });

  const offerSalary = existing?.salaryOffered || existing?.salary || jobSalaryAnchor(job.salary);
  if (!offerSalary) return null;

  const offerCurrency =
    jobSalaryCurrency(job.salary) || config.salaryCurrency;
  const resolved = await resolveCommissionFromContext({
    offerSalary,
    offerCurrency,
    jobId,
    jobSalary: job.salary,
  });
  if (!resolved.enabled) return null;

  const fee = moneyRound(resolved.fee);
  if (!(fee > 0)) return null;

  const nextStatus = String(stage || '').toUpperCase() === 'HIRED' ? 'JOINED' : 'OFFER_SENT';

  if (existing) {
    const locked = (existing.billingRecords || []).some((row) =>
      ['PAID', 'SENT', 'OVERDUE'].includes(String(row.status || '').toUpperCase()),
    );
    if (locked) return existing;

    await prisma.placement.update({
      where: { id: existing.id },
      data: {
        commissionPercentage: resolved.percent,
        placementFee: fee,
        fee,
        revenue: fee,
        salaryOffered: existing.salaryOffered || offerSalary,
        salary: existing.salary || offerSalary,
        ...(existing.status === 'PENDING' || existing.status === 'OFFER_SENT'
          ? { status: nextStatus }
          : {}),
      },
    });

    const pendingBilling = await prisma.billingRecord.findFirst({
      where: { placementId: existing.id, status: { in: ['DRAFT', 'PENDING'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (pendingBilling) {
      await prisma.billingRecord.update({
        where: { id: pendingBilling.id },
        data: { amount: fee, currency: resolved.commissionCurrency },
      });
    }
    const pendingLine = await prisma.placementBilling.findFirst({
      where: { placementId: existing.id, paymentStatus: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    if (pendingLine) {
      await prisma.placementBilling.update({
        where: { id: pendingLine.id },
        data: { amount: fee, totalAmount: fee },
      });
    }
    return existing;
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { assignedToId: true },
  });
  let recruiterId = performedById || job.assignedToId || candidate?.assignedToId || null;
  if (!recruiterId) {
    const anyUser = await prisma.user.findFirst({ select: { id: true } });
    recruiterId = anyUser?.id || null;
  }
  if (!recruiterId) return null;

  const { placementService } = await import('./placement.service.js');
  return placementService.create(
    {
      candidateId,
      jobId,
      companyId: job.clientId,
      recruiterId,
      offerSalary,
      placementFee: fee,
      commissionPercentage: resolved.percent,
      currency: resolved.commissionCurrency,
      offerDate: new Date().toISOString().slice(0, 10),
      employmentType: 'PERMANENT',
      status: nextStatus,
      commissionSource: 'slab',
      skipSlabPlacement: true,
    },
    recruiterId,
    null,
  );
}
