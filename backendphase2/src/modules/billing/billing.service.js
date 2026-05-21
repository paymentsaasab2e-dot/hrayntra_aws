import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { prisma } from '../../config/prisma.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';
import { clientBillingEmailSelect, resolveClientBillingEmail } from '../../utils/resolveClientBillingEmail.js';
import { sendPlacementInvoiceEmail } from '../../services/emailService.js';

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

function sanitizePdfValue(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (value instanceof Date) return value.toISOString().split('T')[0];
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return String(value);
    return Number(value).toFixed(2);
  }
  return String(value);
}

function wrapPdfText(text, maxChars) {
  const value = sanitizePdfValue(text);
  const limit = Math.max(8, Number(maxChars || 32));
  const words = value.split(/\s+/).filter(Boolean);
  if (!words.length) return ['-'];
  const lines = [];
  let current = '';
  for (const word of words) {
    if (!current.length) {
      current = word;
      continue;
    }
    if ((current + ' ' + word).length <= limit) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length) lines.push(current);
  return lines.length ? lines : ['-'];
}

function makePdfLine(text, x, y, fontSize = 9, font = 'F1') {
  return `0 0 0 rg BT /${font} ${fontSize} Tf 1 0 0 1 ${x} ${y} Tm (${escapePdfText(text)}) Tj ET`;
}

function drawPdfRect(x, y, width, height, stroke = '0.82 0.85 0.9 RG', fill = null) {
  const commands = [];
  if (fill) commands.push(`${fill} rg`);
  commands.push(`${stroke}`);
  commands.push(`${x} ${y} ${width} ${height} re ${fill ? 'B' : 'S'}`);
  return commands.join(' ');
}

function estimateColumnWidths(headers, rows, availableWidth) {
  const weights = headers.map((header) => {
    const samples = rows.slice(0, 12).map((row) => sanitizePdfValue(row?.[header]));
    const sampleLength = Math.max(
      header.length,
      ...samples.map((value) => String(value).length),
      10
    );
    return Math.min(Math.max(sampleLength * 4.8, 56), 160);
  });
  const total = weights.reduce((sum, value) => sum + value, 0) || 1;
  return weights.map((weight) => Math.max(46, Math.floor((weight / total) * availableWidth)));
}

function createSimplePdfBuffer(title, rows) {
  const printableRows = Array.isArray(rows) ? rows.slice(0, 48) : [];
  const headers = printableRows.length ? Object.keys(printableRows[0]) : [];
  const pageWidth = 842;
  const pageHeight = 595;
  const marginX = 24;
  const marginTop = 26;
  const marginBottom = 24;
  const tableWidth = pageWidth - marginX * 2;
  const availableRowWidth = tableWidth;
  const columnWidths = headers.length ? estimateColumnWidths(headers, printableRows, availableRowWidth) : [];

  const contentLines = [];

  const pushPageHeader = (isFirstPage) => {
    let y = pageHeight - marginTop;
    contentLines.push(makePdfLine(title, marginX, y, 16, 'F2'));
    y -= 16;
    contentLines.push(makePdfLine(`Summary: Total records ${printableRows.length}`, marginX, y, 9, 'F1'));
    y -= 16;
    return { y, isFirstPage };
  };

  const addTableHeader = (y) => {
    const headerHeight = 20;
    let x = marginX;
    headers.forEach((header, index) => {
      const width = columnWidths[index] || 80;
      contentLines.push(drawPdfRect(x, y - headerHeight + 4, width, headerHeight, '0.76 0.8 0.86 RG', '0.95 0.97 1 rg'));
      const wrappedHeader = wrapPdfText(header, Math.max(10, Math.floor(width / 5.2)));
      wrappedHeader.slice(0, 2).forEach((line, lineIndex) => {
        contentLines.push(makePdfLine(line, x + 4, y - 8 - (lineIndex * 8), 8.5, 'F2'));
      });
      x += width;
    });
    return y - headerHeight;
  };

  let yState = pushPageHeader(true);
  let y = yState.y;

  if (!printableRows.length || !headers.length) {
    contentLines.push(makePdfLine('No data available', marginX, y - 8, 10, 'F1'));
  } else {
    y = addTableHeader(y);
    const rowGap = 8;

    printableRows.forEach((row, rowIndex) => {
      const cellLines = headers.map((header, index) => {
        const width = columnWidths[index] || 80;
        return wrapPdfText(row?.[header], Math.max(10, Math.floor((width - 8) / 4.9)));
      });
      const rowHeight = Math.max(22, ...cellLines.map((lines) => 12 + ((lines.length - 1) * 7))) + rowGap;

      if (y - rowHeight < marginBottom) {
        contentLines.push('BT ET');
        yState = pushPageHeader(false);
        y = addTableHeader(yState.y);
      }

      let x = marginX;
      headers.forEach((header, index) => {
        const width = columnWidths[index] || 80;
        contentLines.push(drawPdfRect(x, y - rowHeight + 4, width, rowHeight, '0.86 0.88 0.92 RG'));
        const lines = cellLines[index];
        const textYStart = y - 10;
        lines.slice(0, 4).forEach((line, lineIndex) => {
          contentLines.push(makePdfLine(line, x + 4, textYStart - (lineIndex * 7.2), 8.2, index === 0 ? 'F2' : 'F1'));
        });
        x += width;
      });

      y -= rowHeight;
      if (rowIndex < printableRows.length - 1) {
        y -= 1;
      }
    });
  }

  const stream = contentLines.join('\n');
  const objects = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
  objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj');
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj');
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj');
  objects.push(`6 0 obj\n<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream\nendobj`);

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
  if (record.status === 'DRAFT') return 'Draft';
  if (record.status === 'SENT') return 'Sent';
  if (record.status === 'PAID' || record.paidAt) return 'Paid';
  if (record.status === 'CANCELLED') return 'Cancelled';
  const dueDate = record.dueDate ? new Date(record.dueDate) : null;
  if (record.status === 'OVERDUE') return 'Overdue';
  if (dueDate && dueDate.getTime() < Date.now() && record.status !== 'PAID') return 'Overdue';
  return 'Pending';
}

function isDraftBillingRecord(record) {
  return String(record?.recordStatus || record?.status || '').toUpperCase() === 'DRAFT';
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
  return (summary.invoices || []).map((invoice) => ({
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
    receiptNumber: payment.receiptNumber,
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

function getDraftInvoiceExportRows(summary) {
  return (summary.draftInvoices || []).map((invoice) => ({
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

function tabToRows(tab, summary) {
  const normalized = String(tab || '').trim().toLowerCase();
  if (normalized === 'saved-drafts' || normalized === 'invoice-drafts') return getDraftInvoiceExportRows(summary);
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

async function generateNextInvoiceNumber(userId) {
  const settings = await loadBillingSettings(userId);
  const prefix = String(settings.invoicePrefix || 'INV').trim() || 'INV';
  const year = new Date().getFullYear();

  const records = await prisma.billingRecord.findMany({
    where: {
      invoiceNumber: { startsWith: `${prefix}-${year}-` },
    },
    select: { invoiceNumber: true },
  });

  let max = 0;
  const pattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-${year}-(\\d+)$`);
  for (const row of records) {
    const match = String(row.invoiceNumber || '').match(pattern);
    if (match) {
      max = Math.max(max, Number(match[1]) || 0);
    }
  }

  const next = max + 1;
  return `${prefix}-${year}-${String(next).padStart(4, '0')}`;
}

export const billingService = {
  async getNextInvoiceNumber(userId) {
    const nextInvoiceNo = await generateNextInvoiceNumber(userId);
    return { nextInvoiceNo };
  },
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
            client: { select: clientBillingEmailSelect },
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
    const existing = await prisma.billingRecord.findUnique({
      where: { id },
      select: { id: true, placementId: true, invoiceNumber: true, status: true },
    });
    if (!existing) throw new Error('Invoice not found');

    const nextStatus = data.status ? String(data.status).toUpperCase() : undefined;
    const markingPaid = nextStatus === 'PAID';
    const paidAt =
      markingPaid && !data.paidAt
        ? new Date()
        : data.paidAt
          ? new Date(data.paidAt)
          : nextStatus && nextStatus !== 'PAID'
            ? null
            : undefined;

    const updated = await prisma.billingRecord.update({
      where: { id },
      data: {
        amount: data.amount == null ? undefined : Number(data.amount),
        currency: data.currency,
        status: nextStatus,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        paidAt,
        invoiceUrl: data.invoiceUrl,
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : undefined,
        notes: data.notes,
      },
    });

    if (markingPaid && existing.placementId) {
      const placementBillingWhere = {
        placementId: existing.placementId,
        ...(existing.invoiceNumber ? { invoiceNumber: existing.invoiceNumber } : {}),
      };
      await prisma.placementBilling.updateMany({
        where: placementBillingWhere,
        data: {
          paymentStatus: 'PAID',
          paymentDate: paidAt || new Date(),
        },
      });
    }

    return updated;
  },

  async updateDraftInvoice(id, data = {}) {
    const existing = await prisma.billingRecord.findUnique({
      where: { id },
      include: {
        placement: {
          include: {
            candidate: true,
            job: true,
            client: true,
          },
        },
      },
    });
    if (!existing) throw new Error('Invoice not found');
    if (existing.status !== 'DRAFT') {
      throw new Error('Only draft invoices can be edited');
    }
    if (!existing.placementId) {
      throw new Error('This invoice is not linked to a placement');
    }

    const { recalcInvoiceTotals } = await import('../../utils/invoiceCalculations.js');

    const rawLineItems = Array.isArray(data.lineItems) ? data.lineItems : [];
    const rawCharges = Array.isArray(data.additionalCharges) ? data.additionalCharges : [];
    const taxRate = Math.max(Number(data.taxRate) || 0, 0);

    const { lineItems, subtotal, taxAmount, total } = recalcInvoiceTotals(rawLineItems, rawCharges, taxRate);

    const filteredLineItems = lineItems.filter((item) => item.name && item.quantity > 0);
    const additionalCharges = rawCharges
      .map((charge) => ({
        name: String(charge?.name || '').trim(),
        amount: Math.max(Number(charge?.amount) || 0, 0),
      }))
      .filter((charge) => charge.name && charge.amount > 0);

    if (!filteredLineItems.length) {
      throw new Error('At least one line item with a description is required');
    }
    if (!Number.isFinite(total) || total <= 0) {
      throw new Error('Invoice total must be greater than zero');
    }

    const currency = String(data.currency || existing.currency || 'USD').trim() || 'USD';
    const nextStatus = String(data.status || 'DRAFT').trim().toUpperCase() === 'SENT' ? 'SENT' : 'DRAFT';
    const invoiceDate = data.invoiceDate ? new Date(data.invoiceDate) : existing.invoiceDate || new Date();
    const dueDate = data.dueDate
      ? new Date(data.dueDate)
      : existing.dueDate ||
        (() => {
          const next = new Date(invoiceDate);
          next.setDate(next.getDate() + 30);
          return next;
        })();

    const placement = existing.placement;
    const candidateName = `${placement?.candidate?.firstName || ''} ${placement?.candidate?.lastName || ''}`.trim();
    const invoiceNumber = String(data.invoiceNo || data.invoiceNumber || existing.invoiceNumber || '').trim();
    if (!invoiceNumber) {
      throw new Error('Invoice number is required');
    }

    const duplicate = await prisma.billingRecord.findFirst({
      where: {
        invoiceNumber,
        id: { not: id },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new Error(`Invoice number ${invoiceNumber} is already in use`);
    }

    const invoicePayload = {
      lineItems: filteredLineItems,
      additionalCharges,
      subtotal,
      taxRate,
      taxAmount,
      total,
      buyer: data.buyer || null,
      seller: data.seller || null,
      placementSummary: {
        candidateName,
        jobTitle: placement?.job?.title || '',
        clientName: placement?.client?.companyName || '',
        offerDate: placement?.offerDate,
        joiningDate: placement?.joiningDate,
      },
    };

    await prisma.$transaction(async (tx) => {
      await tx.billingRecord.update({
        where: { id },
        data: {
          amount: total,
          subtotal,
          taxAmount,
          currency,
          status: nextStatus,
          dueDate,
          invoiceNumber,
          invoiceDate,
          invoicePayload,
          notes: data.notes?.trim() || existing.notes,
        },
      });

      const placementBillingWhere = {
        placementId: existing.placementId,
        ...(existing.invoiceNumber ? { invoiceNumber: existing.invoiceNumber } : {}),
      };
      await tx.placementBilling.updateMany({
        where: placementBillingWhere,
        data: {
          invoiceNumber,
          invoiceDate,
          amount: subtotal || total,
          taxPercentage: taxRate,
          taxAmount,
          totalAmount: total,
        },
      });
    });

    return this.getById(id);
  },

  async sendInvoiceToClient(id, data = {}, senderUserId) {
    const existing = await prisma.billingRecord.findUnique({
      where: { id },
      include: {
        client: {
          select: clientBillingEmailSelect,
        },
        placement: {
          include: {
            candidate: { select: { firstName: true, lastName: true } },
            job: { select: { title: true } },
            client: { select: clientBillingEmailSelect },
          },
        },
      },
    });

    if (!existing) {
      throw new Error('Invoice not found');
    }
    if (existing.status === 'CANCELLED') {
      throw new Error('Cannot send a cancelled invoice');
    }

    const payload = (existing.invoicePayload || {}) || {};
    const buyer = payload.buyer || {};
    const toEmail =
      String(data.toEmail || buyer.email || '').trim() ||
      resolveClientBillingEmail(existing.client, existing.client?.contacts) ||
      resolveClientBillingEmail(existing.placement?.client, existing.placement?.client?.contacts);

    if (!toEmail) {
      throw new Error('Client billing email is required before sending the invoice');
    }

    const settings = await this.getSettings({ id: senderUserId });
    const lineItems = Array.isArray(payload.lineItems) ? payload.lineItems : [];
    const additionalCharges = Array.isArray(payload.additionalCharges) ? payload.additionalCharges : [];

    const pdfBase64 = String(data.pdfBase64 || '').trim();
    const pdfFilename =
      String(data.pdfFilename || '').trim() ||
      `${String(existing.invoiceNumber || 'invoice').replace(/[^\w-]+/g, '_')}.pdf`;

    const emailResult = await sendPlacementInvoiceEmail({
      senderUserId,
      toEmail,
      pdfBase64: pdfBase64 || undefined,
      pdfFilename,
      invoiceNumber: existing.invoiceNumber,
      invoiceDate: existing.invoiceDate,
      dueDate: existing.dueDate,
      currency: existing.currency,
      status: 'SENT',
      seller: payload.seller || { name: settings?.companyName || 'Your agency' },
      buyer: { ...buyer, email: toEmail },
      lineItems,
      additionalCharges,
      subtotal: payload.subtotal ?? existing.subtotal ?? existing.amount,
      taxRate: payload.taxRate ?? 0,
      taxAmount: payload.taxAmount ?? existing.taxAmount ?? 0,
      total: payload.total ?? existing.amount,
      notes: existing.notes,
      placementSummary: payload.placementSummary,
      settings,
    });

    if (!emailResult?.success) {
      throw new Error(emailResult?.error || 'Failed to send invoice email');
    }

    if (existing.status !== 'SENT') {
      await prisma.billingRecord.update({
        where: { id },
        data: { status: 'SENT' },
      });
    }

    if (existing.placementId) {
      await prisma.placementActivityLog.create({
        data: {
          placementId: existing.placementId,
          action: 'Invoice emailed to client',
          performedBy: senderUserId || null,
          details: {
            billingRecordId: id,
            invoiceNumber: existing.invoiceNumber,
            toEmail,
          },
        },
      });
    }

    return {
      billingRecordId: id,
      toEmail,
      invoiceNumber: existing.invoiceNumber,
    };
  },

  async delete(id) {
    const existing = await prisma.billingRecord.findUnique({
      where: { id },
      select: { id: true, status: true, placementId: true, invoiceNumber: true },
    });
    if (!existing) throw new Error('Invoice not found');
    if (existing.status !== 'DRAFT') {
      throw new Error('Only draft invoices can be deleted');
    }

    await prisma.$transaction(async (tx) => {
      if (existing.placementId) {
        const placementBillingWhere = {
          placementId: existing.placementId,
          ...(existing.invoiceNumber ? { invoiceNumber: existing.invoiceNumber } : {}),
        };
        await tx.placementBilling.deleteMany({ where: placementBillingWhere });
      }
      await tx.billingRecord.delete({ where: { id } });
    });

    return { message: 'Draft invoice deleted successfully' };
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
        recordStatus: record.status,
        placementId: record.placementId || '',
        invoiceUrl: record.invoiceUrl || '',
      };
    });

    // Payments tab is the "receipts" view — only show invoices/placement
    // billing entries that have actually been settled. The placement-billing
    // mirror used to duplicate rows that the Invoices tab already lists with
    // their pending status, so we now skip pending placement-billing and only
    // surface settled rows. Receipt numbers come from the invoice number when
    // available, otherwise we synthesize one from the row id.
    const paymentsFromPlacementBilling = placementBillingsRaw
      .filter((record) => record.paymentStatus === 'PAID' || record.paymentDate)
      .map((record) => ({
        id: record.id,
        clientId: record.placement?.client?.id || '',
        clientName: record.placement?.client?.companyName || '-',
        recruiterId: record.placement?.recruiterId || '',
        receiptNumber: record.invoiceNumber || `RCP-${record.id.slice(-6).toUpperCase()}`,
        invoiceNumber: record.invoiceNumber || '',
        amount: formatMoney(record.totalAmount || record.amount),
        mode: record.paymentMethod || '-',
        transactionId: record.invoiceNumber || record.id,
        date: displayDate(record.paymentDate || record.invoiceDate || record.createdAt),
        receivedBy: record.placement?.recruiter?.name || 'System',
        status: 'Confirmed',
      }));

    const paymentsFromBillingRecords = billingRecordsRaw
      .filter((record) => record.paidAt || record.status === 'PAID')
      .map((record) => ({
        id: record.id,
        clientId: record.clientId,
        clientName: record.client?.companyName || '-',
        recruiterId: record.placement?.recruiterId || record.client?.assignedToId || '',
        receiptNumber: record.invoiceNumber || `RCP-${record.id.slice(-6).toUpperCase()}`,
        invoiceNumber: record.invoiceNumber || '',
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

    let scopedInvoices = invoicesMapped;
    // BillingRecord is the canonical invoice ledger — prefer it. Only pull in
    // a PlacementBilling row when its invoiceNumber doesn't already appear on
    // an invoice-record receipt. This eliminates the duplicate "same payment
    // shown twice in different rows" problem.
    const seenInvoiceNumbers = new Set(
      paymentsFromBillingRecords
        .map((p) => String(p.invoiceNumber || '').trim().toLowerCase())
        .filter(Boolean)
    );
    const dedupedPlacementBillingPayments = paymentsFromPlacementBilling.filter((p) => {
      const key = String(p.invoiceNumber || '').trim().toLowerCase();
      return !key || !seenInvoiceNumbers.has(key);
    });
    let payments = [...paymentsFromBillingRecords, ...dedupedPlacementBillingPayments];
    let placements = placementsMapped;
    let clients = clientsMapped;
    let commissions = commissionsMapped;

    if (clientId) {
      scopedInvoices = scopedInvoices.filter((item) => item.clientId === clientId);
      payments = payments.filter((item) => item.clientId === clientId);
      placements = placements.filter((item) => item.clientId === clientId);
      clients = clients.filter((item) => item.id === clientId);
      commissions = commissions.filter((item) => item.clientId === clientId);
    }

    if (recruiterId) {
      scopedInvoices = scopedInvoices.filter((item) => item.recruiterId === recruiterId);
      payments = payments.filter((item) => item.recruiterId === recruiterId);
      placements = placements.filter((item) => item.recruiterId === recruiterId);
      commissions = commissions.filter((item) => item.recruiterId === recruiterId);
    }

    let draftInvoices = scopedInvoices.filter(isDraftBillingRecord);
    let invoices = scopedInvoices.filter((item) => !isDraftBillingRecord(item));

    if (invoiceStatus) {
      const statusFilter = lower(invoiceStatus);
      if (statusFilter === 'draft') {
        draftInvoices = draftInvoices.filter((item) => lower(item.status) === 'draft');
        invoices = [];
      } else {
        invoices = invoices.filter((item) => lower(item.status) === statusFilter);
      }
    }

    draftInvoices = applySearch(draftInvoices, search, [
      'invoiceNumber',
      'clientName',
      'candidateName',
      'jobTitle',
      'status',
    ]);
    invoices = applySearch(invoices, search, ['invoiceNumber', 'clientName', 'candidateName', 'jobTitle', 'status']);
    payments = applySearch(payments, search, [
      'clientName',
      'receiptNumber',
      'invoiceNumber',
      'mode',
      'transactionId',
      'status',
    ]);
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
        invoiceStatuses: ['Draft', 'Sent', 'Paid', 'Pending', 'Overdue', 'Cancelled'],
      },
      kpis: {
        totalBilled: formatMoney(totalBilled),
        totalReceived: formatMoney(totalReceived),
        pendingAmount: formatMoney(pendingAmount),
        overdueAmount: formatMoney(overdueAmount),
        monthRevenue: formatMoney(monthRevenue),
        nextPayout: formatMoney(nextPayout),
        invoiceCount: invoices.length,
        draftCount: draftInvoices.length,
        collectionRate,
      },
      draftInvoices,
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

  /**
   * Build a unified activity timeline for a single invoice. Walks the chain:
   *
   *   Lead (matched by client name/email) → Client → Job → Candidate
   *   → Pipeline stage history → Interviews → Placement → BillingRecord
   *   → PlacementBilling (legacy) → Activity log entries
   *
   * Each step is best-effort — if a relation isn't found we just skip it.
   */
  async getInvoiceActivity(invoiceId) {
    if (!invoiceId) throw new Error('invoiceId is required');

    const invoice = await prisma.billingRecord.findUnique({
      where: { id: invoiceId },
      include: {
        client: true,
        placement: {
          include: {
            candidate: true,
            job: true,
            recruiter: { select: { id: true, name: true, email: true } },
            commission: true,
            billing: true,
          },
        },
      },
    });

    if (!invoice) throw new Error('Invoice not found');

    const placement = invoice.placement || null;
    const candidate = placement?.candidate || null;
    const job = placement?.job || null;
    const client = invoice.client || null;

    // Pipeline stage moves for this candidate within this job.
    let pipelineHistory = [];
    if (candidate?.id && job?.id) {
      try {
        pipelineHistory = await prisma.pipelineEntry.findMany({
          where: { candidateId: candidate.id, jobId: job.id },
          include: { stage: { select: { id: true, name: true, order: true } } },
          orderBy: [{ movedAt: 'asc' }, { createdAt: 'asc' }],
        });
      } catch (err) {
        console.warn('[billing] pipeline history failed:', err?.message || err);
      }
    }

    // Interviews scheduled for this candidate + job pair.
    let interviews = [];
    if (candidate?.id && job?.id) {
      try {
        interviews = await prisma.interview.findMany({
          where: { candidateId: candidate.id, jobId: job.id },
          orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
        });
      } catch (err) {
        console.warn('[billing] interview history failed:', err?.message || err);
      }
    }

    // Build a focused candidate-journey timeline. We deliberately stay narrow
    // here: from "candidate applied to this job" → every pipeline stage move
    // → interviews → placement → this invoice → payment. Lead/client/sibling
    // invoices and free-form Activity rows are out of scope to keep the
    // drawer readable.
    const events = [];

    if (job) {
      events.push({
        kind: 'job',
        title: 'Job opened',
        description: job.title || '-',
        at: job.createdAt,
        meta: { status: job.status },
      });
    }

    if (candidate) {
      // Candidate.createdAt approximates "applied to job" — the platform
      // creates the row when the candidate enters this job's pipeline.
      events.push({
        kind: 'candidate',
        title: 'Candidate applied',
        description:
          [`${candidate.firstName || ''} ${candidate.lastName || ''}`.trim(), candidate.email]
            .filter(Boolean)
            .join(' · ') || '-',
        at: candidate.createdAt,
      });
    }

    pipelineHistory.forEach((entry) => {
      events.push({
        kind: 'pipeline',
        title: `Stage update — ${entry.stage?.name || 'Moved'}`,
        description: entry.notes || null,
        at: entry.movedAt || entry.createdAt,
        meta: { stage: entry.stage?.name },
      });
    });

    interviews.forEach((iv) => {
      const statusLabel = String(iv.status || 'scheduled').toLowerCase();
      events.push({
        kind: 'interview',
        title: `Interview ${statusLabel}`,
        description: iv.round || iv.notes || iv.location || null,
        at: iv.scheduledAt || iv.createdAt,
        meta: { mode: iv.mode, type: iv.type, round: iv.round },
      });
    });

    if (placement) {
      if (placement.offerDate) {
        events.push({
          kind: 'placement',
          title: 'Offer extended',
          description: placement.salaryOffered
            ? `Offered ${placement.salaryOffered}`
            : null,
          at: placement.offerDate,
        });
      }
      if (placement.actualJoiningDate || placement.joiningDate || placement.startDate) {
        events.push({
          kind: 'placement',
          title: 'Candidate joined',
          description: `Placement ${placement.status || 'PLACED'}`,
          at: placement.actualJoiningDate || placement.joiningDate || placement.startDate,
          meta: { fee: placement.placementFee || placement.fee || placement.revenue || 0 },
        });
      } else {
        events.push({
          kind: 'placement',
          title: 'Placement created',
          description: `Placement ${placement.status || 'PENDING'}`,
          at: placement.createdAt,
        });
      }
    }

    // The current invoice itself + its payment.
    events.push({
      kind: 'invoice',
      title: 'Invoice issued',
      description: invoice.invoiceNumber || `INV-${invoice.id.slice(-6).toUpperCase()}`,
      at: invoice.invoiceDate || invoice.createdAt,
      meta: {
        amount: invoice.amount,
        currency: invoice.currency,
        status: deriveInvoiceStatus(invoice),
      },
    });

    if (invoice.paidAt) {
      events.push({
        kind: 'payment',
        title: 'Payment received',
        description: invoice.invoiceNumber
          ? `Invoice ${invoice.invoiceNumber} settled`
          : null,
        at: invoice.paidAt,
        meta: { amount: invoice.amount, currency: invoice.currency },
      });
    }

    // Sort the merged events by timestamp ascending; rows without a timestamp
    // sink to the end so they don't disrupt the chronological flow.
    const eventsSorted = events
      .filter((e) => Boolean(e.at))
      .map((e) => ({ ...e, at: new Date(e.at).toISOString() }))
      .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

    return {
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber || `INV-${invoice.id.slice(-6).toUpperCase()}`,
        amount: formatMoney(invoice.amount),
        currency: invoice.currency || 'USD',
        status: deriveInvoiceStatus(invoice),
        date: displayDate(invoice.invoiceDate || invoice.createdAt),
        dueDate: displayDate(invoice.dueDate),
        paidAt: invoice.paidAt ? displayDate(invoice.paidAt) : null,
      },
      // `lead` is no longer surfaced — the timeline is candidate-centric, so
      // top-of-funnel data is intentionally elided. Kept null for backwards
      // compat with the existing TypeScript interface.
      lead: null,
      client: client
        ? {
            id: client.id,
            companyName: client.companyName,
            status: client.status,
            industry: client.industry,
          }
        : null,
      job: job
        ? { id: job.id, title: job.title, status: job.status }
        : null,
      candidate: candidate
        ? {
            id: candidate.id,
            name: `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim(),
            email: candidate.email,
          }
        : null,
      placement: placement
        ? {
            id: placement.id,
            status: placement.status,
            joiningDate: displayDate(
              placement.actualJoiningDate || placement.joiningDate || placement.startDate
            ),
            recruiter: placement.recruiter?.name || null,
            fee: placement.placementFee || placement.fee || placement.revenue || 0,
          }
        : null,
      events: eventsSorted,
    };
  },

  /**
   * Update the currency on a single invoice and propagate the change to all
   * sibling BillingRecord rows + any PlacementBilling entries belonging to
   * the same placement. This keeps the entire revenue chain for a hire in
   * one currency, matching the user's mental model of "switch currency on
   * the invoice = switch currency for that placement everywhere".
   */
  async updateInvoiceCurrency(invoiceId, rawCurrency) {
    if (!invoiceId) throw new Error('invoiceId is required');
    const currency = String(rawCurrency || '').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new Error('currency must be a 3-letter ISO code');
    }

    const invoice = await prisma.billingRecord.findUnique({
      where: { id: invoiceId },
      select: { id: true, placementId: true },
    });
    if (!invoice) throw new Error('Invoice not found');

    let updatedSiblings = 0;
    if (invoice.placementId) {
      // Cascade to all BillingRecords for the same placement so a placement's
      // currency stays consistent across original invoice, revisions, etc.
      const result = await prisma.billingRecord.updateMany({
        where: { placementId: invoice.placementId },
        data: { currency },
      });
      updatedSiblings = result.count;
    } else {
      // Standalone invoice — just patch this row.
      await prisma.billingRecord.update({
        where: { id: invoiceId },
        data: { currency },
      });
      updatedSiblings = 1;
    }

    // PlacementBilling has no currency column today — skip silently. When the
    // schema gains it, propagate here in the same transaction.

    return {
      invoiceId,
      placementId: invoice.placementId,
      currency,
      updatedRecords: updatedSiblings,
    };
  },
};
