import { PrismaClient } from '@prisma/client';
import { Levenshtein } from '../utils/levenshtein.js';

const prisma = new PrismaClient();

function getTenantPrisma(orgId) {
  void orgId;
  return prisma;
}

function generateLeadCode() {
  const suffix = String(Date.now()).slice(-6);
  return `LEAD-${suffix}`;
}

function addBusinessDays(date, days) {
  let d = new Date(date);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d.toISOString().split('T')[0];
}

function scoreLeadQuality(data) {
  let score = 0;
  if (data.email) score += 20;
  if (data.phone) score += 20;
  if (data.companyName) score += 15;
  if (data.designation) score += 10;
  if (data.industry || data.sector) score += 10;
  if (data.source === 'LinkedIn') score += 10;
  if (data.source === 'Referral') score += 15;
  if (data.notes || data.interestedNeeds || data.servicesNeeded) score += 10;
  if (data.priority === 'High') score += 5;
  return Math.min(score, 100);
}

function normalizeSource(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'linkedin') return 'LinkedIn';
  if (v === 'email') return 'Email';
  if (v === 'referral') return 'Referral';
  if (v === 'campaign') return 'Campaign';
  return 'Website';
}

function normalizeType(value, companyName) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'individual') return 'Individual';
  if (v === 'referral') return 'Referral';
  if (v === 'company') return 'Company';
  return companyName ? 'Company' : 'Individual';
}

function normalizeStatus(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'contacted') return 'Contacted';
  if (v === 'qualified') return 'Qualified';
  if (v === 'converted') return 'Converted';
  if (v === 'lost') return 'Lost';
  return 'New';
}

function normalizePriority(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'high') return 'High';
  if (v === 'low') return 'Low';
  return 'Medium';
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function mapLeadForUi(lead, aiScore) {
  return {
    ...lead,
    leadCode:
      lead?.otherDetails && typeof lead.otherDetails === 'object'
        ? lead.otherDetails.leadCode
        : null,
    aiScore,
    nextFollowUpAt: lead.nextFollowUp,
    assignedTo: lead.assignedToId || null,
  };
}

export async function checkDuplicate(
  orgId,
  email,
  phone,
  companyName
) {
  const db = getTenantPrisma(orgId);
  if (email) {
    const existing = await db.lead.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        isDeleted: false,
        orgId
      }
    });
    if (existing) return {
      isDuplicate: true,
      matchedOn: 'email',
      record: existing
    };
  }
  if (phone) {
    const normalized = normalizePhone(phone);
    const existing = await db.lead.findMany({
      where: {
        phone: { not: null },
        isDeleted: false,
        orgId
      },
      select: { id: true, phone: true, companyName: true, contactName: true, email: true, createdAt: true }
    });
    const hit = existing.find((row) => normalizePhone(row.phone).includes(normalized) || normalized.includes(normalizePhone(row.phone)));
    if (hit) return {
      isDuplicate: true,
      matchedOn: 'phone',
      record: hit
    };
  }
  if (companyName) {
    const allLeads = await db.lead.findMany({
      where: { isDeleted: false, orgId },
      select: { id: true, companyName: true, contactName: true, email: true, createdAt: true }
    });
    for (const lead of allLeads) {
      if (!lead.companyName) continue;
      const dist = Levenshtein(
        companyName.toLowerCase(),
        lead.companyName.toLowerCase()
      );
      if (dist <= 2) return {
        isDuplicate: true,
        matchedOn: 'companyName',
        record: lead,
        fuzzy: true
      };
    }
  }
  return { isDuplicate: false };
}

export async function createLead(orgId, userId, data) {
  const db = getTenantPrisma(orgId);
  const aiScore = scoreLeadQuality(data);
  const leadCode = data.leadCode || generateLeadCode();
  const nextFollowUpAt = data.nextFollowUpAt
    || addBusinessDays(new Date(), 2);

  const lead = await db.lead.create({
    data: {
      companyName: data.companyName || null,
      contactName: data.contactName || data.directorName || null,
      contactPerson: data.contactName || data.directorName || null,
      directorName: data.directorName || data.contactName || null,
      email: data.email
        ? data.email.toLowerCase().trim()
        : null,
      phone: data.phone || null,
      type: normalizeType(data.type, data.companyName),
      source: normalizeSource(data.source),
      status: normalizeStatus(data.status || 'New'),
      priority: normalizePriority(data.priority || 'Medium'),
      designation: data.designation || null,
      industry: data.industry || null,
      sector: data.sector || null,
      city: data.city || null,
      country: data.country || null,
      location: data.location || null,
      notes: data.notes || null,
      interestedNeeds: data.interestedNeeds || null,
      servicesNeeded: data.servicesNeeded || null,
      expectedBusinessValue: data.expectedBusinessValue ? String(data.expectedBusinessValue) : null,
      nextFollowUp: new Date(nextFollowUpAt),
      orgId,
      createdBy: userId,
      assignedToId: data.assignedToId || null,
      isDeleted: false,
      otherDetails: {
        leadCode,
        aiScore,
      },
    }
  });

  return { lead: mapLeadForUi(lead, aiScore), aiScore };
}

export async function bulkCreateLeads(
  orgId,
  userId,
  records
) {
  const results = {
    created: [],
    skipped: [],
    failed: []
  };

  const seenEmails = new Set();
  const seenPhones = new Set();

  for (const record of records) {
    try {
      if (record.email) {
        const normalized =
          record.email.toLowerCase().trim();
        if (seenEmails.has(normalized)) {
          results.skipped.push({
            label: `${record.companyName || record.contactName || record.directorName || 'Unknown'}`,
            reason: 'Duplicate within batch (email)'
          });
          continue;
        }
        seenEmails.add(normalized);
      }

      if (record.phone) {
        const normalized = normalizePhone(record.phone);
        if (seenPhones.has(normalized)) {
          results.skipped.push({
            label: `${record.companyName || record.contactName || record.directorName || 'Unknown'}`,
            reason: 'Duplicate within batch (phone)'
          });
          continue;
        }
        seenPhones.add(normalized);
      }

      const dupCheck = await checkDuplicate(
        orgId,
        record.email,
        record.phone,
        null
      );

      if (dupCheck.isDuplicate) {
        results.skipped.push({
          label: `${record.companyName || record.contactName || record.directorName || 'Unknown'}`,
          reason: `Duplicate: ${dupCheck.matchedOn} already exists`,
          existingId: dupCheck.record?.id
        });
        continue;
      }

      const { lead, aiScore } =
        await createLead(orgId, userId, record);
      results.created.push({
        id: lead.id,
        label: `${lead.companyName || lead.contactName || 'Unknown'}`,
        leadCode: lead.leadCode || generateLeadCode(),
        aiScore,
        ...lead,
      });
    } catch (err) {
      results.failed.push({
        label: `${record.companyName || record.contactName || record.directorName || 'Unknown'}`,
        reason: err.message
      });
    }
  }

  return results;
}

export async function updateLead(
  orgId,
  leadId,
  data
) {
  const db = getTenantPrisma(orgId);
  const existing = await db.lead.findFirst({
    where: { id: leadId, orgId, isDeleted: false }
  });
  if (!existing) {
    throw new Error('Lead not found for this organization');
  }

  const lead = await db.lead.update({
    where: { id: leadId },
    data: {
      ...data,
      assignedToId: data.assignedToId || data.assignedTo || existing.assignedToId,
      nextFollowUp: data.nextFollowUpAt
        ? new Date(data.nextFollowUpAt)
        : data.nextFollowUp
          ? new Date(data.nextFollowUp)
          : existing.nextFollowUp,
      updatedAt: new Date()
    }
  });
  return mapLeadForUi(lead, scoreLeadQuality(lead));
}

export async function softDeleteLead(
  orgId,
  leadId
) {
  const db = getTenantPrisma(orgId);
  const existing = await db.lead.findFirst({
    where: { id: leadId, orgId, isDeleted: false }
  });
  if (!existing) {
    throw new Error('Lead not found for this organization');
  }

  const lead = await db.lead.update({
    where: { id: leadId },
    data: {
      isDeleted: true,
      updatedAt: new Date()
    }
  });
  return mapLeadForUi(lead, scoreLeadQuality(lead));
}

export async function restoreLead(
  orgId,
  leadId
) {
  const db = getTenantPrisma(orgId);
  const existing = await db.lead.findFirst({
    where: { id: leadId, orgId }
  });
  if (!existing) {
    throw new Error('Lead not found for this organization');
  }

  const lead = await db.lead.update({
    where: { id: leadId },
    data: {
      isDeleted: false,
      updatedAt: new Date()
    }
  });
  return mapLeadForUi(lead, scoreLeadQuality(lead));
}

export async function fetchLeads(orgId, filters) {
  const db = getTenantPrisma(orgId);
  const where = {
    orgId,
    isDeleted: false
  };

  if (filters.status) where.status = normalizeStatus(filters.status);
  if (filters.source) where.source = normalizeSource(filters.source);
  if (filters.assignedTo) {
    where.assignedToId = filters.assignedTo;
  }
  if (filters.search) {
    where.OR = [
      {
        companyName: {
          contains: filters.search,
          mode: 'insensitive'
        }
      },
      {
        contactName: {
          contains: filters.search,
          mode: 'insensitive'
        }
      },
      {
        email: {
          contains: filters.search,
          mode: 'insensitive'
        }
      }
    ];
  }

  const leads = await db.lead.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: filters.limit || 50,
    skip: filters.skip || 0
  });

  return leads.map((lead) => mapLeadForUi(lead, scoreLeadQuality(lead)));
}

export async function getLeadMetrics(orgId) {
  const db = getTenantPrisma(orgId);
  const counts = await db.lead.groupBy({
    by: ['status'],
    where: { orgId, isDeleted: false },
    _count: { status: true }
  });

  const metrics = {
    NEW_LEADS: 0,
    CONTACTED: 0,
    QUALIFIED: 0,
    CONVERTED: 0,
    LOST: 0
  };

  for (const row of counts) {
    if (row.status === 'New') {
      metrics.NEW_LEADS = row._count.status;
    } else if (row.status === 'Contacted') {
      metrics.CONTACTED = row._count.status;
    } else if (row.status === 'Qualified') {
      metrics.QUALIFIED = row._count.status;
    } else if (row.status === 'Converted') {
      metrics.CONVERTED = row._count.status;
    } else if (row.status === 'Lost') {
      metrics.LOST = row._count.status;
    }
  }

  return metrics;
}
