import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { prisma } from '../../config/prisma.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';

const EXPORT_DIR = path.join(process.cwd(), 'uploads', 'reports');
const DEFAULT_SETTINGS = {
  invoicePrefix: 'INV',
  defaultCurrency: 'USD',
  defaultPaymentTerms: 'Net 30 Days',
  bankName: '',
  accountNumber: '',
  swiftCode: '',
  taxLabel: 'Tax',
  taxRate: 0,
};

function ensureExportDir() {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

function toPublicUploadUrl(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  const uploadsIndex = normalized.lastIndexOf('/uploads/');
  return uploadsIndex >= 0 ? normalized.slice(uploadsIndex) : normalized;
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? '');
  if (!/[",\n]/.test(stringValue)) return stringValue;
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function createCsvBuffer(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return Buffer.from('No data available', 'utf8');
  }
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map((header) => escapeCsvValue(header)).join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row?.[header])).join(',')),
  ];
  return Buffer.from(lines.join('\n'), 'utf8');
}

function escapePdfText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function createSimplePdfBuffer(title, rows) {
  const lines = [title];
  rows.slice(0, 35).forEach((row) => {
    const parts = Object.entries(row || {})
      .slice(0, 5)
      .map(([key, value]) => `${key}: ${value ?? ''}`);
    lines.push(parts.join(' | '));
  });

  const contentLines = ['BT', '/F1 12 Tf', '40 790 Td'];
  lines.forEach((line, index) => {
    if (index > 0) contentLines.push('0 -18 Td');
    contentLines.push(`(${escapePdfText(line)}) Tj`);
  });
  contentLines.push('ET');
  const stream = contentLines.join('\n');

  const objects = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
  objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj');
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj');
  objects.push(`5 0 obj\n<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream\nendobj`);

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${object}\n`;
  }
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

function normalizeDateRange(value) {
  const normalized = String(value || 'last_30_days').trim().toLowerCase();
  if (['last_7_days', 'last_30_days', 'this_month', 'this_quarter', 'all_time'].includes(normalized)) {
    return normalized;
  }
  return 'last_30_days';
}

function startOfQuarter(date) {
  const month = date.getMonth();
  const quarterStartMonth = Math.floor(month / 3) * 3;
  return new Date(date.getFullYear(), quarterStartMonth, 1);
}

function getRangeStart(dateRange) {
  const now = new Date();
  if (dateRange === 'last_7_days') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (dateRange === 'last_30_days') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (dateRange === 'this_month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (dateRange === 'this_quarter') return startOfQuarter(now);
  return null;
}

function buildCreatedAtWhere(dateRange, fieldName = 'createdAt') {
  const start = getRangeStart(dateRange);
  if (!start) return {};
  return { [fieldName]: { gte: start } };
}

function hasFullAccess(user) {
  const role = user?.role;
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER';
}

function lower(value) {
  return String(value || '').trim().toLowerCase();
}

function containsText(value, search) {
  return lower(value).includes(lower(search));
}

function sumBy(items, selector) {
  return items.reduce((total, item) => total + Number(selector(item) || 0), 0);
}

function formatMoney(value) {
  return Number(value || 0);
}

function displayDate(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toISOString().split('T')[0];
}

function deriveInvoiceStatus(record) {
  if (!record) return 'Pending';
  if (record.status === 'PAID' || record.paidAt) return 'Paid';
  if (record.status === 'CANCELLED') return 'Cancelled';
  const dueDate = record.dueDate ? new Date(record.dueDate) : null;
  if (record.status === 'OVERDUE') return 'Overdue';
  if (dueDate && dueDate.getTime() < Date.now() && record.status !== 'PAID') return 'Overdue';
  return 'Pending';
}

function recruiterScopedClientWhere(user, clientId) {
  const where = {};
  if (clientId) where.id = clientId;
  return where;
}

function recruiterScopedPlacementWhere(user, clientId, recruiterId, dateRange) {
  const where = { ...buildCreatedAtWhere(dateRange) };
  if (clientId) where.clientId = clientId;
  if (recruiterId) {
    where.recruiterId = recruiterId;
  }
  return where;
}

function recruiterScopedBillingWhere(user, clientId, dateRange) {
  const where = { ...buildCreatedAtWhere(dateRange) };
  if (clientId) where.clientId = clientId;
  return where;
}

function recruiterScopedCommissionWhere(user, recruiterId, clientId, dateRange) {
  const where = { ...buildCreatedAtWhere(dateRange) };
  if (recruiterId) where.recruiterId = recruiterId;
  return where;
}

function applySearch(rows, search, fields) {
  const term = String(search || '').trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((row) => fields.some((field) => containsText(row?.[field], term)));
}

function getInvoiceExportRows(summary) {
  return summary.invoices.map((invoice) => ({
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.clientName,
    candidateName: invoice.candidateName,
    jobTitle: invoice.jobTitle,
    invoiceDate: invoice.date,
    dueDate: invoice.dueDate,
    amount: invoice.amount,
    tax: invoice.tax,
    total: invoice.total,
    status: invoice.status,
  }));
}

function getPaymentExportRows(summary) {
  return summary.payments.map((payment) => ({
    paymentId: payment.id,
    source: payment.source,
    clientName: payment.clientName,
    invoiceNumber: payment.invoiceNumber,
    amount: payment.amount,
    mode: payment.mode,
    transactionId: payment.transactionId,
    paymentDate: payment.date,
    receivedBy: payment.receivedBy,
    status: payment.status,
  }));
}

function getPlacementExportRows(summary) {
  return summary.placements.map((placement) => ({
    candidate: placement.candidate,
    jobTitle: placement.jobTitle,
    clientName: placement.client,
    joiningDate: placement.joiningDate,
    billingType: placement.billingType,
    fee: placement.fee,
    invoiceGenerated: placement.invoiceGenerated,
    status: placement.status,
    recruiter: placement.recruiter,
  }));
}

function getClientExportRows(summary) {
  return summary.clients.map((client) => ({
    clientName: client.name,
    status: client.status,
    industry: client.industry,
    location: client.location,
    owner: client.owner,
    placements: client.placements,
    invoices: client.invoices,
    totalBilled: client.totalBilled,
    outstanding: client.outstanding,
    sla: client.sla,
  }));
}

function getCommissionExportRows(summary) {
  return summary.commissions.map((commission) => ({
    recruiter: commission.recruiter,
    placement: commission.placement,
    percentage: commission.percentage,
    amount: commission.amount,
    status: commission.status,
    payoutDate: commission.date,
  }));
}

function getTaxExportRows(summary) {
  return [
    {
      outputTax: summary.taxes.outputTax,
      inputCredit: summary.taxes.inputCredit,
      netPayable: summary.taxes.netPayable,
      effectiveRate: summary.taxes.effectiveRate,
    },
    ...summary.taxes.compliance.map((item) => ({
      outputTax: '',
      inputCredit: '',
      netPayable: '',
      effectiveRate: `${item.status}: ${item.title}`,
      details: item.description,
    })),
  ];
}

function getSettingsExportRows(summary) {
  return [
    {
      invoicePrefix: summary.settings.invoicePrefix,
      defaultCurrency: summary.settings.defaultCurrency,
      defaultPaymentTerms: summary.settings.defaultPaymentTerms,
      bankName: summary.settings.bankName,
      accountNumber: summary.settings.accountNumber,
      swiftCode: summary.settings.swiftCode,
      taxLabel: summary.settings.taxLabel,
      taxRate: summary.settings.taxRate,
    },
  ];
}

function tabToRows(tab, summary) {
  const normalized = String(tab || '').trim().toLowerCase();
  if (normalized === 'invoices') return getInvoiceExportRows(summary);
  if (normalized === 'payments') return getPaymentExportRows(summary);
  if (normalized === 'placements-billing') return getPlacementExportRows(summary);
  if (normalized === 'clients-contracts') return getClientExportRows(summary);
  if (normalized === 'commission-payouts') return getCommissionExportRows(summary);
  if (normalized === 'taxes-compliance') return getTaxExportRows(summary);
  if (normalized === 'billing-settings') return getSettingsExportRows(summary);
  return getInvoiceExportRows(summary);
}

async function buildExportFile(tab, format, summary) {
  const rows = tabToRows(tab, summary);
  const normalizedFormat = String(format || 'csv').trim().toLowerCase();
  const timestamp = Date.now();
  ensureExportDir();

  if (normalizedFormat === 'excel' || normalizedFormat === 'xlsx') {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Billing');
    const filePath = path.join(EXPORT_DIR, `billing-${tab}-${timestamp}.xlsx`);
    XLSX.writeFile(workbook, filePath);
    return { fileName: path.basename(filePath), fileUrl: toPublicUploadUrl(filePath), format: 'excel' };
  }

  if (normalizedFormat === 'pdf') {
    const filePath = path.join(EXPORT_DIR, `billing-${tab}-${timestamp}.pdf`);
    fs.writeFileSync(filePath, createSimplePdfBuffer(`Billing ${tab}`, rows));
    return { fileName: path.basename(filePath), fileUrl: toPublicUploadUrl(filePath), format: 'pdf' };
  }

  const filePath = path.join(EXPORT_DIR, `billing-${tab}-${timestamp}.csv`);
  fs.writeFileSync(filePath, createCsvBuffer(rows));
  return { fileName: path.basename(filePath), fileUrl: toPublicUploadUrl(filePath), format: 'csv' };
}

async function loadBillingSettings(userId) {
  const record = await prisma.setting.findFirst({
    where: {
      OR: [
        { userId, key: 'billing_config', scope: 'USER' },
        { userId: null, key: 'billing_config', scope: 'ORG' },
      ],
    },
    orderBy: { updatedAt: 'desc' },
  });

  return {
    ...DEFAULT_SETTINGS,
    ...(record?.value && typeof record.value === 'object' ? record.value : {}),
  };
}

async function saveBillingSettings(userId, payload) {
  const existing = await prisma.setting.findFirst({
    where: {
      userId,
      key: 'billing_config',
      scope: 'USER',
    },
  });

  const value = {
    ...DEFAULT_SETTINGS,
    ...(existing?.value && typeof existing.value === 'object' ? existing.value : {}),
    ...(payload && typeof payload === 'object' ? payload : {}),
  };

  if (existing) {
    await prisma.setting.update({
      where: { id: existing.id },
      data: { value },
    });
  } else {
    await prisma.setting.create({
      data: {
        userId,
        key: 'billing_config',
        scope: 'USER',
        value,
      },
    });
  }

  return value;
}

export const billingService = {
  async getAll(req) {
    const { page, limit, skip } = getPaginationParams(req);
    const { clientId, status, dueDate } = req.query;

    const where = {};
    if (clientId) where.clientId = clientId;
    if (status) where.status = status;
    if (dueDate) {
      const date = new Date(dueDate);
      where.dueDate = {
        gte: new Date(date.setHours(0, 0, 0, 0)),
        lte: new Date(date.setHours(23, 59, 59, 999)),
      };
    }

    const [records, total] = await Promise.all([
      prisma.billingRecord.findMany({
        where,
        skip,
        take: limit,
        include: {
          client: {
            select: { id: true, companyName: true },
          },
          placement: {
            select: {
              id: true,
              candidate: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.billingRecord.count({ where }),
    ]);

    return formatPaginationResponse(records, page, limit, total);
  },

  async getById(id) {
    return prisma.billingRecord.findUnique({
      where: { id },
      include: {
        client: true,
        placement: {
          include: {
            candidate: true,
            job: true,
            recruiter: {
              select: { id: true, name: true, email: true },
            },
            billing: true,
            commission: true,
          },
        },
      },
    });
  },

  async create(data) {
    return prisma.billingRecord.create({
      data: {
        clientId: data.clientId,
        placementId: data.placementId || null,
        amount: Number(data.amount || 0),
        currency: data.currency || 'USD',
        status: data.status || 'DRAFT',
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        invoiceUrl: data.invoiceUrl || null,
        invoiceNumber: data.invoiceNumber || null,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : null,
        notes: data.notes || null,
      },
    });
  },

  async update(id, data) {
    return prisma.billingRecord.update({
      where: { id },
      data: {
        amount: data.amount == null ? undefined : Number(data.amount),
        currency: data.currency,
        status: data.status,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        paidAt:
          data.status === 'PAID' && !data.paidAt
            ? new Date()
            : data.paidAt
              ? new Date(data.paidAt)
              : undefined,
        invoiceUrl: data.invoiceUrl,
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : undefined,
        notes: data.notes,
      },
    });
  },

  async delete(id) {
    await prisma.billingRecord.delete({ where: { id } });
    return { message: 'Billing record deleted successfully' };
  },

  async getSummary(query, user) {
    const dateRange = normalizeDateRange(query?.dateRange);
    const clientId = String(query?.clientId || '').trim();
    const recruiterId = String(query?.recruiterId || '').trim();
    const search = String(query?.search || '').trim();
    const invoiceStatus = String(query?.invoiceStatus || '').trim();

    const [settings, billingRecordsRaw, placementsRaw, clientsRaw, commissionsRaw, placementBillingsRaw, recruiters] =
      await Promise.all([
        loadBillingSettings(user?.id),
        prisma.billingRecord.findMany({
          where: recruiterScopedBillingWhere(user, clientId, dateRange),
          include: {
            client: {
              select: {
                id: true,
                companyName: true,
                assignedToId: true,
                assignedTo: { select: { id: true, name: true } },
              },
            },
            placement: {
              include: {
                candidate: { select: { id: true, firstName: true, lastName: true } },
                job: { select: { id: true, title: true, assignedToId: true, createdById: true } },
                recruiter: { select: { id: true, name: true, email: true } },
                billing: true,
              },
            },
          },
          orderBy: [{ createdAt: 'desc' }],
        }),
        prisma.placement.findMany({
          where: recruiterScopedPlacementWhere(user, clientId, recruiterId, dateRange),
          include: {
            client: {
              select: {
                id: true,
                companyName: true,
                assignedToId: true,
                assignedTo: { select: { id: true, name: true } },
                status: true,
                industry: true,
                location: true,
                sla: true,
              },
            },
            candidate: { select: { id: true, firstName: true, lastName: true, email: true } },
            job: { select: { id: true, title: true, assignedToId: true, createdById: true } },
            recruiter: { select: { id: true, name: true, email: true } },
            billing: true,
            billingRecords: true,
            commission: true,
          },
          orderBy: [{ createdAt: 'desc' }],
        }),
        prisma.client.findMany({
          where: recruiterScopedClientWhere(user, clientId),
          include: {
            assignedTo: { select: { id: true, name: true, email: true } },
            _count: {
              select: {
                jobs: true,
                contacts: true,
                placements: true,
                billingRecords: true,
              },
            },
            billingRecords: {
              select: {
                id: true,
                amount: true,
                status: true,
                paidAt: true,
                dueDate: true,
              },
            },
            placements: {
              select: {
                id: true,
                revenue: true,
                placementFee: true,
                fee: true,
              },
            },
          },
          orderBy: [{ updatedAt: 'desc' }],
        }),
        prisma.placementCommission.findMany({
          where: recruiterScopedCommissionWhere(user, recruiterId, clientId, dateRange),
          include: {
            recruiter: { select: { id: true, name: true, email: true } },
            placement: {
              include: {
                candidate: { select: { firstName: true, lastName: true } },
                client: { select: { id: true, companyName: true, assignedToId: true } },
                job: { select: { title: true, assignedToId: true, createdById: true } },
              },
            },
          },
          orderBy: [{ createdAt: 'desc' }],
        }),
        prisma.placementBilling.findMany({
          where: {
            ...buildCreatedAtWhere(dateRange),
          },
          include: {
            placement: {
              include: {
                client: { select: { id: true, companyName: true } },
                candidate: { select: { firstName: true, lastName: true } },
                recruiter: { select: { name: true } },
              },
            },
          },
          orderBy: [{ createdAt: 'desc' }],
        }),
        prisma.user.findMany({
          where: {
            isActive: true,
            ...(hasFullAccess(user) ? {} : { id: user?.id }),
          },
          select: { id: true, name: true, email: true, role: true },
          orderBy: { name: 'asc' },
        }),
      ]);

    const invoicesMapped = billingRecordsRaw.map((record) => {
      const invoiceStatusValue = deriveInvoiceStatus(record);
      const candidateName = `${record.placement?.candidate?.firstName || ''} ${record.placement?.candidate?.lastName || ''}`.trim();
      const total = formatMoney(record.amount);
      const recruiter = record.placement?.recruiter || null;

      return {
        id: record.id,
        invoiceNumber: record.invoiceNumber || `INV-${record.id.slice(-6).toUpperCase()}`,
        clientId: record.clientId,
        recruiterId: recruiter?.id || record.client?.assignedToId || '',
        clientName: record.client?.companyName || 'Unknown client',
        jobTitle: record.placement?.job?.title || '-',
        candidateName: candidateName || '-',
        date: displayDate(record.invoiceDate || record.createdAt),
        dueDate: displayDate(record.dueDate),
        amount: formatMoney(record.amount),
        tax: 0,
        total,
        status: invoiceStatusValue,
        invoiceUrl: record.invoiceUrl || '',
      };
    });

    const paymentsFromPlacementBilling = placementBillingsRaw.map((record) => ({
      id: record.id,
      source: 'Placement billing',
      clientId: record.placement?.client?.id || '',
      clientName: record.placement?.client?.companyName || '-',
      recruiterId: record.placement?.recruiterId || '',
      invoiceNumber: record.invoiceNumber || `PB-${record.id.slice(-6).toUpperCase()}`,
      amount: formatMoney(record.totalAmount || record.amount),
      mode: record.paymentMethod || '-',
      transactionId: record.invoiceNumber || record.id,
      date: displayDate(record.paymentDate || record.invoiceDate || record.createdAt),
      receivedBy: record.placement?.recruiter?.name || 'System',
      status: record.paymentStatus === 'PAID' ? 'Confirmed' : 'Pending',
    }));

    const paymentsFromBillingRecords = billingRecordsRaw
      .filter((record) => record.paidAt || record.status === 'PAID')
      .map((record) => ({
        id: record.id,
        source: 'Invoice record',
        clientId: record.clientId,
        clientName: record.client?.companyName || '-',
        recruiterId: record.placement?.recruiterId || record.client?.assignedToId || '',
        invoiceNumber: record.invoiceNumber || `INV-${record.id.slice(-6).toUpperCase()}`,
        amount: formatMoney(record.amount),
        mode: 'Recorded payment',
        transactionId: record.invoiceNumber || record.id,
        date: displayDate(record.paidAt || record.invoiceDate || record.createdAt),
        receivedBy: record.placement?.recruiter?.name || record.client?.assignedTo?.name || 'System',
        status: 'Confirmed',
      }));

    const placementsMapped = placementsRaw.map((placement) => {
      const candidateName = `${placement.candidate?.firstName || ''} ${placement.candidate?.lastName || ''}`.trim();
      const feeValue = formatMoney(
        placement.placementFee || placement.fee || placement.revenue || placement.salaryOffered || 0
      );

      return {
        id: placement.id,
        clientId: placement.clientId,
        recruiterId: placement.recruiterId || '',
        candidate: candidateName || '-',
        jobTitle: placement.job?.title || '-',
        client: placement.client?.companyName || '-',
        joiningDate: displayDate(placement.actualJoiningDate || placement.joiningDate || placement.startDate),
        billingType:
          placement.feeType === 'PERCENTAGE'
            ? '% of value'
            : placement.feeType === 'FLAT'
              ? 'Fixed fee'
              : 'Not set',
        fee: feeValue,
        invoiceGenerated: placement.billingRecords.length > 0 || placement.billing.length > 0,
        status: placement.status || 'PENDING',
        recruiter: placement.recruiter?.name || placement.client?.assignedTo?.name || '-',
      };
    });

    const commissionsMapped = commissionsRaw.map((commission) => {
      const candidateName = `${commission.placement?.candidate?.firstName || ''} ${commission.placement?.candidate?.lastName || ''}`.trim();
      const clientName = commission.placement?.client?.companyName || '-';
      return {
        id: commission.id,
        clientId: commission.placement?.client?.id || '',
        recruiterId: commission.recruiterId,
        recruiter: commission.recruiter?.name || '-',
        placement: candidateName ? `${candidateName} (${clientName})` : clientName,
        percentage: Number(commission.commissionPercentage || 0),
        amount: formatMoney(commission.commissionAmount),
        status: commission.paymentStatus === 'PAID' ? 'Paid' : 'Pending',
        date: displayDate(commission.paymentDate || commission.createdAt),
      };
    });

    const clientStatsById = new Map();
    invoicesMapped.forEach((invoice) => {
      const current = clientStatsById.get(invoice.clientId) || {
        invoices: 0,
        totalBilled: 0,
        outstanding: 0,
      };
      current.invoices += 1;
      current.totalBilled += Number(invoice.total || 0);
      if (invoice.status !== 'Paid') current.outstanding += Number(invoice.total || 0);
      clientStatsById.set(invoice.clientId, current);
    });

    const clientsMapped = clientsRaw.map((client) => {
      const invoiceStats = clientStatsById.get(client.id) || {
        invoices: client._count?.billingRecords || 0,
        totalBilled: sumBy(client.billingRecords || [], (record) => record.amount),
        outstanding: sumBy(
          (client.billingRecords || []).filter((record) => !record.paidAt && record.status !== 'PAID'),
          (record) => record.amount
        ),
      };

      return {
        id: client.id,
        name: client.companyName,
        status: client.status,
        industry: client.industry || '-',
        location: client.location || '-',
        owner: client.assignedTo?.name || '-',
        placements: client._count?.placements || 0,
        invoices: invoiceStats.invoices,
        totalBilled: formatMoney(invoiceStats.totalBilled),
        outstanding: formatMoney(invoiceStats.outstanding),
        currency: settings.defaultCurrency,
        sla: client.sla || '-',
      };
    });

    let invoices = invoicesMapped;
    let payments = [...paymentsFromPlacementBilling, ...paymentsFromBillingRecords];
    let placements = placementsMapped;
    let clients = clientsMapped;
    let commissions = commissionsMapped;

    if (clientId) {
      invoices = invoices.filter((item) => item.clientId === clientId);
      payments = payments.filter((item) => item.clientId === clientId);
      placements = placements.filter((item) => item.clientId === clientId);
      clients = clients.filter((item) => item.id === clientId);
      commissions = commissions.filter((item) => item.clientId === clientId);
    }

    if (recruiterId) {
      invoices = invoices.filter((item) => item.recruiterId === recruiterId);
      payments = payments.filter((item) => item.recruiterId === recruiterId);
      placements = placements.filter((item) => item.recruiterId === recruiterId);
      commissions = commissions.filter((item) => item.recruiterId === recruiterId);
    }

    if (invoiceStatus) {
      invoices = invoices.filter((item) => lower(item.status) === lower(invoiceStatus));
    }

    invoices = applySearch(invoices, search, ['invoiceNumber', 'clientName', 'candidateName', 'jobTitle', 'status']);
    payments = applySearch(payments, search, ['clientName', 'invoiceNumber', 'mode', 'transactionId', 'status']);
    placements = applySearch(placements, search, ['candidate', 'jobTitle', 'client', 'billingType', 'status', 'recruiter']);
    clients = applySearch(clients, search, ['name', 'industry', 'location', 'owner', 'status', 'sla']);
    commissions = applySearch(commissions, search, ['recruiter', 'placement', 'status']);

    const totalBilled = sumBy(invoices, (item) => item.total);
    const totalReceived = sumBy(invoices.filter((item) => item.status === 'Paid'), (item) => item.total);
    const pendingAmount = sumBy(invoices.filter((item) => item.status === 'Pending'), (item) => item.total);
    const overdueAmount = sumBy(invoices.filter((item) => item.status === 'Overdue'), (item) => item.total);
    const now = new Date();
    const monthRevenue = sumBy(
      invoices.filter((item) => {
        const parsed = new Date(item.date);
        return !Number.isNaN(parsed.getTime()) && parsed.getMonth() === now.getMonth() && parsed.getFullYear() === now.getFullYear();
      }),
      (item) => item.total
    );
    const nextPayout = sumBy(commissions.filter((item) => item.status !== 'Paid'), (item) => item.amount);
    const collectionRate = totalBilled > 0 ? Number(((totalReceived / totalBilled) * 100).toFixed(1)) : 0;

    const outputTax = formatMoney(sumBy(placementBillingsRaw, (item) => item.taxAmount));
    const inputCredit = 0;
    const netPayable = formatMoney(outputTax - inputCredit);
    const effectiveRate = totalBilled > 0 ? Number(((outputTax / totalBilled) * 100).toFixed(2)) : 0;

    const overdueInvoicesCount = invoices.filter((item) => item.status === 'Overdue').length;
    const missingInvoiceNumberCount = billingRecordsRaw.filter((item) => !item.invoiceNumber).length;
    const pendingCommissionsCount = commissions.filter((item) => item.status !== 'Paid').length;

    return {
      filters: {
        dateRange,
        clientId: clientId || '',
        recruiterId: recruiterId || '',
        search,
        invoiceStatus: invoiceStatus || '',
      },
      options: {
        dateRanges: [
          { value: 'last_7_days', label: 'Last 7 Days' },
          { value: 'last_30_days', label: 'Last 30 Days' },
          { value: 'this_month', label: 'This Month' },
          { value: 'this_quarter', label: 'This Quarter' },
          { value: 'all_time', label: 'All Time' },
        ],
        clients: clientsRaw.map((client) => ({ id: client.id, name: client.companyName })),
        recruiters: recruiters.map((recruiter) => ({ id: recruiter.id, name: recruiter.name || recruiter.email })),
        invoiceStatuses: ['Paid', 'Pending', 'Overdue', 'Cancelled'],
      },
      kpis: {
        totalBilled: formatMoney(totalBilled),
        totalReceived: formatMoney(totalReceived),
        pendingAmount: formatMoney(pendingAmount),
        overdueAmount: formatMoney(overdueAmount),
        monthRevenue: formatMoney(monthRevenue),
        nextPayout: formatMoney(nextPayout),
        invoiceCount: invoices.length,
        collectionRate,
      },
      invoices,
      payments,
      placements,
      clients,
      commissions,
      taxes: {
        outputTax,
        inputCredit,
        netPayable,
        effectiveRate,
        compliance: [
          {
            status: overdueInvoicesCount > 0 ? 'warning' : 'success',
            title: 'Overdue invoices',
            description:
              overdueInvoicesCount > 0
                ? `${overdueInvoicesCount} overdue invoice(s) need follow-up.`
                : 'No overdue invoices in the current billing scope.',
          },
          {
            status: missingInvoiceNumberCount > 0 ? 'warning' : 'success',
            title: 'Invoice numbering hygiene',
            description:
              missingInvoiceNumberCount > 0
                ? `${missingInvoiceNumberCount} invoice record(s) do not have an invoice number yet.`
                : 'All invoice records have invoice numbers.',
          },
          {
            status: pendingCommissionsCount > 0 ? 'info' : 'success',
            title: 'Commission payouts',
            description:
              pendingCommissionsCount > 0
                ? `${pendingCommissionsCount} commission payout(s) are still pending.`
                : 'All visible commission payouts are settled.',
          },
        ],
      },
      settings,
    };
  },

  async exportTab(tab, format, query, user) {
    const summary = await this.getSummary(query, user);
    return buildExportFile(tab, format, summary);
  },

  async getSettings(user) {
    return loadBillingSettings(user?.id);
  },

  async updateSettings(payload, user) {
    return saveBillingSettings(user?.id, payload);
  },
};
