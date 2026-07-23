import crypto from 'crypto';
import { prisma, getActiveTenantDbName, runWithTenantContext } from '../../config/prisma.js';
import { leadService } from './lead.service.js';

function requireTenantDbName(tenantDbName) {
  const tenant = String(tenantDbName || getActiveTenantDbName() || '').trim();
  if (!tenant) {
    throw Object.assign(
      new Error('Tenant is required. Use a full lead form link that includes ?tenantDbName=…'),
      { statusCode: 400 }
    );
  }
  return tenant;
}

function tenantTokenPrefix(tenantDbName) {
  return String(tenantDbName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 12);
}

function generateLeadFormToken(tenantDbName) {
  const prefix = tenantTokenPrefix(tenantDbName) || 'tenant';
  return `${prefix}_${crypto.randomBytes(16).toString('hex')}`;
}

function tokenBelongsToTenant(token, tenantDbName) {
  const publicToken = String(token || '').trim();
  const prefix = tenantTokenPrefix(tenantDbName);
  if (!publicToken || !prefix) return false;
  // New links are tenant-prefixed. Legacy hex-only tokens still work inside that tenant DB.
  if (!publicToken.includes('_')) return true;
  return publicToken.startsWith(`${prefix}_`);
}

export function buildLeadPublicFormUrl(token, frontendBase, tenantDbName) {
  const base = String(frontendBase || process.env.FRONTEND_URL || 'http://localhost:3001').replace(
    /\/$/,
    ''
  );
  const tenant = requireTenantDbName(tenantDbName);
  return `${base}/lead-form/${token}?tenantDbName=${encodeURIComponent(tenant)}`;
}

async function ensureLeadIntakeFormForTenant(tenantDbName) {
  const tenant = requireTenantDbName(tenantDbName);
  const prefix = `${tenantTokenPrefix(tenant)}_`;

  const existing = await prisma.leadIntakeForm.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  if (existing?.publicToken) {
    // Rotate legacy / wrong-prefix tokens so each tenant keeps a distinct share link.
    if (!String(existing.publicToken).startsWith(prefix)) {
      return prisma.leadIntakeForm.update({
        where: { id: existing.id },
        data: { publicToken: generateLeadFormToken(tenant) },
      });
    }
    return existing;
  }

  return prisma.leadIntakeForm.create({
    data: {
      publicToken: generateLeadFormToken(tenant),
      isActive: true,
      title: 'Add Lead',
    },
  });
}

async function findActiveFormForTenant(token, tenantDbName) {
  const tenant = requireTenantDbName(tenantDbName);
  const publicToken = String(token || '').trim();
  if (!publicToken) {
    throw Object.assign(new Error('Lead form link not found or is no longer active'), {
      statusCode: 404,
    });
  }

  if (!tokenBelongsToTenant(publicToken, tenant)) {
    throw Object.assign(new Error('This lead form link does not belong to the selected tenant'), {
      statusCode: 403,
    });
  }

  const form = await prisma.leadIntakeForm.findFirst({
    where: {
      publicToken,
      isActive: true,
    },
  });

  if (!form) {
    throw Object.assign(new Error('Lead form link not found or is no longer active'), {
      statusCode: 404,
    });
  }

  return form;
}

function normalizePublicLeadPayload(body = {}) {
  const companyName = String(body.companyName || '').trim();
  const contactPerson = String(body.contactPerson || body.directorName || '').trim();
  const email = String(body.email || '').trim();
  const phone = String(body.phone || '').trim();

  if (!companyName) {
    throw Object.assign(new Error('Company name is required'), { statusCode: 400 });
  }
  if (!contactPerson) {
    throw Object.assign(new Error('Contact person is required'), { statusCode: 400 });
  }
  if (!email && !phone) {
    throw Object.assign(new Error('Email or phone is required'), { statusCode: 400 });
  }

  const source = ['Website', 'LinkedIn', 'Email', 'Referral', 'Campaign'].includes(body.source)
    ? body.source
    : 'Website';

  return {
    companyName,
    contactPerson,
    directorName: contactPerson,
    directorSalutation: String(body.directorSalutation || '').trim() || undefined,
    email: email || undefined,
    phone: phone || undefined,
    emails: email ? [email] : undefined,
    phones: phone ? [phone] : undefined,
    designation: String(body.designation || '').trim() || undefined,
    industry: String(body.industry || '').trim() || undefined,
    sector: String(body.industry || body.sector || '').trim() || undefined,
    website: String(body.website || '').trim() || undefined,
    linkedIn: String(body.linkedIn || '').trim() || undefined,
    location: String(body.location || '').trim() || undefined,
    country: String(body.country || '').trim() || undefined,
    city: String(body.city || '').trim() || undefined,
    state: String(body.state || '').trim() || undefined,
    type: body.type === 'Individual' ? 'Individual' : 'Company',
    source,
    status: 'New',
    priority: 'Medium',
    interestedNeeds: String(body.interestedNeeds || body.notes || '').trim() || undefined,
    servicesNeeded: String(body.interestedNeeds || '').trim() || undefined,
    notes: String(body.notes || '').trim() || undefined,
    campaignName: 'Public intake form',
    campaignLink: String(body.intakeFormToken || '').trim() || undefined,
    otherDetails: String(body.intakeFormToken || '').trim()
      ? [{ label: '_intakeFormToken', value: String(body.intakeFormToken).trim() }]
      : undefined,
  };
}

export const leadPublicFormService = {
  async ensurePublicFormLink({ frontendBase, tenantDbName } = {}) {
    const tenant = requireTenantDbName(tenantDbName || getActiveTenantDbName());

    return runWithTenantContext(tenant, async () => {
      const form = await ensureLeadIntakeFormForTenant(tenant);
      return {
        token: form.publicToken,
        formUrl: buildLeadPublicFormUrl(form.publicToken, frontendBase, tenant),
        title: form.title,
        tenantDbName: tenant,
      };
    });
  },

  async getPublicForm(token, tenantDbName) {
    const tenant = requireTenantDbName(tenantDbName || getActiveTenantDbName());

    return runWithTenantContext(tenant, async () => {
      const form = await findActiveFormForTenant(token, tenant);
      return {
        title: form.title || 'Add Lead',
        token: form.publicToken,
        tenantDbName: tenant,
        fields: [
          'companyName',
          'contactPerson',
          'email',
          'phone',
          'designation',
          'industry',
          'website',
          'linkedIn',
          'location',
          'country',
          'city',
          'state',
          'type',
          'source',
          'interestedNeeds',
          'notes',
        ],
      };
    });
  },

  async submitPublicForm(token, body, tenantDbName) {
    const tenant = requireTenantDbName(
      tenantDbName || body?.tenantDbName || getActiveTenantDbName()
    );

    return runWithTenantContext(tenant, async () => {
      await findActiveFormForTenant(token, tenant);
      const payload = normalizePublicLeadPayload({
        ...body,
        intakeFormToken: String(token || '').trim(),
      });
      const lead = await leadService.create(payload, null);
      return {
        id: lead.id,
        companyName: lead.companyName,
        contactPerson: lead.contactPerson,
        email: lead.email,
        phone: lead.phone,
        status: lead.status,
        source: lead.source,
        industry: lead.industry,
        location: lead.location,
        createdAt: lead.createdAt,
        tenantDbName: tenant,
        message: 'Lead submitted successfully',
      };
    });
  },

  async listPublicSubmissions(token, tenantDbName) {
    const tenant = requireTenantDbName(tenantDbName || getActiveTenantDbName());
    const publicToken = String(token || '').trim();

    return runWithTenantContext(tenant, async () => {
      await findActiveFormForTenant(publicToken, tenant);

      const byCampaign = await prisma.lead.findMany({
        where: {
          isDeleted: { not: true },
          campaignLink: publicToken,
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        take: 100,
        select: {
          id: true,
          companyName: true,
          contactPerson: true,
          directorName: true,
          email: true,
          phone: true,
          emails: true,
          phones: true,
          status: true,
          source: true,
          type: true,
          priority: true,
          industry: true,
          designation: true,
          website: true,
          linkedIn: true,
          location: true,
          country: true,
          city: true,
          state: true,
          notes: true,
          interestedNeeds: true,
          campaignName: true,
          campaignLink: true,
          otherDetails: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Also pick up rows tagged only via otherDetails (in case campaignLink was cleared).
      const recent = await prisma.lead.findMany({
        where: {
          isDeleted: { not: true },
          campaignName: 'Public intake form',
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        take: 200,
        select: {
          id: true,
          companyName: true,
          contactPerson: true,
          directorName: true,
          email: true,
          phone: true,
          emails: true,
          phones: true,
          status: true,
          source: true,
          type: true,
          priority: true,
          industry: true,
          designation: true,
          website: true,
          linkedIn: true,
          location: true,
          country: true,
          city: true,
          state: true,
          notes: true,
          interestedNeeds: true,
          campaignName: true,
          campaignLink: true,
          otherDetails: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const byId = new Map();
      for (const lead of byCampaign) byId.set(lead.id, lead);
      for (const lead of recent) {
        if (byId.has(lead.id)) continue;
        const details = Array.isArray(lead.otherDetails) ? lead.otherDetails : [];
        const matchesToken =
          String(lead.campaignLink || '').trim() === publicToken ||
          details.some(
            (item) =>
              String(item?.label || '').trim() === '_intakeFormToken' &&
              String(item?.value || '').trim() === publicToken
          );
        if (matchesToken) byId.set(lead.id, lead);
      }

      const leads = Array.from(byId.values()).sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      });

      return {
        token: publicToken,
        tenantDbName: tenant,
        leads,
      };
    });
  },
};
