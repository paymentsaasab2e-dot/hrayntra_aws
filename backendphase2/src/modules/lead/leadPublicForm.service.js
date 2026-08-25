import crypto from 'crypto';
import { prisma, getActiveTenantDbName, runWithTenantContext } from '../../config/prisma.js';
import { leadService } from './lead.service.js';
import { generateLoginId, hashPassword } from '../../utils/credentialGenerator.js';
import { sendEmail } from '../../emails/email.service.js';
import { leadFormInviteTemplate } from '../../emails/templates/lead-form-invite.template.js';
import { headquartersAuthService } from '../auth/headquarters-auth.service.js';
import { assertCanCreateUser } from '../setting/planAccess.service.js';

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

function splitMemberName(rawName) {
  const name = String(rawName || '').trim().replace(/\s+/g, ' ');
  if (!name) return { name: '', firstName: '', lastName: '' };
  const parts = name.split(' ');
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ') || firstName;
  return { name, firstName, lastName };
}

async function recordFormInvitee(publicToken, invitee) {
  const email = String(invitee?.email || '').trim().toLowerCase();
  if (!publicToken || !email) return;
  const entry = {
    email,
    name: String(invitee?.name || '').trim(),
    userId: invitee?.userId ? String(invitee.userId) : null,
    invitedAt: new Date().toISOString(),
  };
  try {
    await prisma.$runCommandRaw({
      update: 'lead_intake_forms',
      updates: [
        {
          q: { publicToken },
          u: { $pull: { invitees: { email } } },
          multi: false,
        },
      ],
    });
    await prisma.$runCommandRaw({
      update: 'lead_intake_forms',
      updates: [
        {
          q: { publicToken },
          u: { $push: { invitees: entry } },
          multi: false,
        },
      ],
    });
  } catch {
    /* best-effort invitee log */
  }
}

async function readFormInvitees(publicToken) {
  try {
    const result = await prisma.$runCommandRaw({
      find: 'lead_intake_forms',
      filter: { publicToken },
      limit: 1,
    });
    const doc = result?.cursor?.firstBatch?.[0];
    return Array.isArray(doc?.invitees) ? doc.invitees : [];
  } catch {
    return [];
  }
}

function intakeLeadAddedBy(lead) {
  const details = Array.isArray(lead?.otherDetails) ? lead.otherDetails : [];
  const name = String(
    details.find((item) => String(item?.label || '').trim() === '_intakeAddedBy')?.value ||
      lead?.referralName ||
      ''
  ).trim();
  const email = String(
    details.find((item) => String(item?.label || '').trim() === '_intakeAddedByEmail')?.value ||
      lead?.sourceEmail ||
      ''
  )
    .trim()
    .toLowerCase();
  return { name, email, userId: typeof lead?.createdBy === 'string' ? lead.createdBy : null };
}

function isValidInviteEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function leadMatchesIntakeToken(lead, publicToken) {
  const token = String(publicToken || '').trim();
  if (!token || !lead) return false;
  if (String(lead.campaignLink || '').trim() === token) return true;
  const details = Array.isArray(lead.otherDetails) ? lead.otherDetails : [];
  return details.some(
    (item) =>
      String(item?.label || '').trim() === '_intakeFormToken' &&
      String(item?.value || '').trim() === token
  );
}

function preserveIntakeOtherDetails(nextDetails, previousDetails, publicToken) {
  const keepLabels = new Set(['_intakeFormToken', '_intakeAddedBy', '_intakeAddedByEmail']);
  const base = Array.isArray(nextDetails) ? nextDetails.filter(Boolean) : [];
  const prev = Array.isArray(previousDetails) ? previousDetails : [];
  const without = base.filter((item) => !keepLabels.has(String(item?.label || '').trim()));
  const preserved = [{ label: '_intakeFormToken', value: String(publicToken || '').trim() }];
  for (const label of ['_intakeAddedBy', '_intakeAddedByEmail']) {
    const fromNext = base.find((item) => String(item?.label || '').trim() === label);
    const fromPrev = prev.find((item) => String(item?.label || '').trim() === label);
    const value = String(fromNext?.value || fromPrev?.value || '').trim();
    if (value) preserved.push({ label, value });
  }
  return [...without, ...preserved];
}

async function recordTenantUserDirectoryEntry({ email, loginId, tenantDbName }) {
  if (!tenantDbName) return;
  try {
    await headquartersAuthService.upsertTenantUserDirectoryEntry({
      email,
      loginId,
      tenantDbName,
    });
  } catch {
    /* directory is best-effort */
  }
}

function submitterDisplayName(user) {
  if (!user || typeof user !== 'object') return '';
  const fromParts = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return fromParts || String(user.name || '').trim() || String(user.email || '').trim();
}

function normalizePublicLeadPayload(body = {}, submitter = null) {
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

  const source = ['Website', 'LinkedIn', 'Email', 'Referral', 'Campaign', 'Other'].includes(body.source)
    ? body.source
    : 'Website';

  const addedByName =
    submitterDisplayName(submitter) || String(body.addedByName || '').trim();
  const addedByEmail = String(submitter?.email || body.addedByEmail || '').trim();
  const intakeToken = String(body.intakeFormToken || '').trim();
  const otherDetails = [
    intakeToken ? { label: '_intakeFormToken', value: intakeToken } : null,
    addedByName ? { label: '_intakeAddedBy', value: addedByName } : null,
    addedByEmail ? { label: '_intakeAddedByEmail', value: addedByEmail } : null,
  ].filter(Boolean);

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
    sourceOther: source === 'Other' ? String(body.sourceOther || '').trim() || undefined : undefined,
    status: 'New',
    priority: 'Medium',
    interestedNeeds: String(body.interestedNeeds || body.notes || '').trim() || undefined,
    servicesNeeded: String(body.interestedNeeds || '').trim() || undefined,
    notes: String(body.notes || '').trim() || undefined,
    campaignName: 'Public intake form',
    campaignLink: String(body.intakeFormToken || '').trim() || undefined,
    referralName: addedByName || undefined,
    sourceEmail: addedByEmail || undefined,
    performedById: submitter?.id || undefined,
    otherDetails: otherDetails.length ? otherDetails : undefined,
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

  async submitPublicForm(token, body, tenantDbName, submitterHint = {}) {
    const tenant = requireTenantDbName(
      tenantDbName || body?.tenantDbName || getActiveTenantDbName()
    );

    return runWithTenantContext(tenant, async () => {
      await findActiveFormForTenant(token, tenant);
      let submitter = null;
      const submitterId = String(submitterHint?.userId || body?.addedById || '').trim();
      if (submitterId && /^[a-f\d]{24}$/i.test(submitterId)) {
        try {
          submitter = await prisma.user.findUnique({
            where: { id: submitterId },
            select: { id: true, email: true, name: true, firstName: true, lastName: true, isActive: true },
          });
          if (submitter && submitter.isActive === false) submitter = null;
        } catch {
          submitter = null;
        }
      }
      const payload = normalizePublicLeadPayload(
        {
          ...body,
          intakeFormToken: String(token || '').trim(),
        },
        submitter
      );
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
        createdBy: lead.createdBy || submitter?.id || null,
        addedByName: payload.referralName || submitterDisplayName(submitter) || null,
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
          referralName: true,
          sourceEmail: true,
          otherDetails: true,
          createdBy: true,
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
          referralName: true,
          sourceEmail: true,
          otherDetails: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const byId = new Map();
      for (const lead of byCampaign) byId.set(lead.id, lead);
      for (const lead of recent) {
        if (byId.has(lead.id)) continue;
        if (leadMatchesIntakeToken(lead, publicToken)) byId.set(lead.id, lead);
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

  async inviteMemberToPublicForm({
    name,
    designation,
    email,
    password,
    frontendBase,
    tenantDbName,
    createdById,
  } = {}) {
    const tenant = requireTenantDbName(tenantDbName || getActiveTenantDbName());
    const parsedName = splitMemberName(name);
    const emailNorm = String(email || '').trim().toLowerCase();
    const designationNorm = String(designation || '').trim();
    const passwordNorm = String(password || '');

    if (!parsedName.name) {
      throw Object.assign(new Error('Name is required'), { statusCode: 400 });
    }
    if (!designationNorm) {
      throw Object.assign(new Error('Designation is required'), { statusCode: 400 });
    }
    if (!isValidInviteEmail(emailNorm)) {
      throw Object.assign(new Error('A valid Gmail / email address is required'), { statusCode: 400 });
    }
    if (passwordNorm.length < 8) {
      throw Object.assign(new Error('Password must be at least 8 characters'), { statusCode: 400 });
    }

    return runWithTenantContext(tenant, async () => {
      const form = await ensureLeadIntakeFormForTenant(tenant);
      const formUrl = buildLeadPublicFormUrl(form.publicToken, frontendBase, tenant);

      const existing = await prisma.user.findUnique({ where: { email: emailNorm } });
      let memberCreated = false;
      let loginId = emailNorm;
      let userId = existing?.id || null;

      if (!existing) {
        try {
          await assertCanCreateUser();
        } catch (error) {
          throw Object.assign(error instanceof Error ? error : new Error(String(error)), {
            statusCode: 400,
          });
        }
        const hashedPassword = await hashPassword(passwordNorm);
        const user = await prisma.user.create({
          data: {
            name: parsedName.name,
            firstName: parsedName.firstName,
            lastName: parsedName.lastName,
            email: emailNorm,
            designation: designationNorm,
            passwordHash: hashedPassword,
            role: 'VIEWER',
            status: 'ACTIVE',
            isActive: true,
          },
        });
        userId = user.id;
        loginId = await generateLoginId(parsedName.firstName, parsedName.lastName);
        await prisma.userCredential.create({
          data: {
            userId: user.id,
            loginId,
            hashedPassword,
            tempPasswordFlag: false,
            inviteSentAt: new Date(),
            createdBy: createdById || null,
          },
        });
        await recordTenantUserDirectoryEntry({
          email: emailNorm,
          loginId,
          tenantDbName: tenant,
        });
        memberCreated = true;
      } else {
        const hashedPassword = await hashPassword(passwordNorm);
        const credential = await prisma.userCredential.findUnique({
          where: { userId: existing.id },
        });
        loginId = credential?.loginId || emailNorm;
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            designation: designationNorm || existing.designation,
            passwordHash: hashedPassword,
            name: parsedName.name || existing.name,
            firstName: parsedName.firstName || existing.firstName,
            lastName: parsedName.lastName || existing.lastName,
            isActive: true,
            status: 'ACTIVE',
          },
        });
        if (credential) {
          await prisma.userCredential.update({
            where: { id: credential.id },
            data: {
              hashedPassword,
              tempPasswordFlag: false,
              inviteSentAt: new Date(),
              isLocked: false,
              failedAttempts: 0,
            },
          });
        } else {
          loginId = await generateLoginId(parsedName.firstName, parsedName.lastName);
          await prisma.userCredential.create({
            data: {
              userId: existing.id,
              loginId,
              hashedPassword,
              tempPasswordFlag: false,
              inviteSentAt: new Date(),
              createdBy: createdById || null,
            },
          });
        }
        await recordTenantUserDirectoryEntry({
          email: emailNorm,
          loginId,
          tenantDbName: tenant,
        });
      }

      const html = leadFormInviteTemplate({
        name: parsedName.name,
        designation: designationNorm,
        email: emailNorm,
        password: passwordNorm,
        formUrl,
        loginId,
      });

      const mailed = await sendEmail(
        emailNorm,
        'Your lead form invitation',
        html,
        'leads.public_form_invite'
      );
      const emailSent = Boolean(mailed?.success) || Boolean(mailed?.skipped);

      await recordFormInvitee(form.publicToken, {
        email: emailNorm,
        name: parsedName.name,
        userId,
      });

      return {
        memberCreated,
        alreadyExisted: !memberCreated,
        name: parsedName.name,
        designation: designationNorm,
        email: emailNorm,
        loginId,
        formUrl,
        tenantDbName: tenant,
        emailSent,
        emailError: emailSent ? undefined : mailed?.error || 'Email service is not configured',
        userId,
      };
    });
  },

  async getPublicFormAccess({ tenantDbName } = {}) {
    const tenant = requireTenantDbName(tenantDbName || getActiveTenantDbName());

    return runWithTenantContext(tenant, async () => {
      const form = await ensureLeadIntakeFormForTenant(tenant);
      const listed = await this.listPublicSubmissions(form.publicToken, tenant);
      const leads = Array.isArray(listed?.leads) ? listed.leads : [];
      const storedInvitees = await readFormInvitees(form.publicToken);

      const people = new Map();
      const upsertPerson = ({ email, name, userId }) => {
        const key = String(email || userId || name || '').trim().toLowerCase();
        if (!key) return null;
        if (!people.has(key)) {
          people.set(key, {
            name: String(name || email || 'Member').trim(),
            email: String(email || '').trim().toLowerCase(),
            userId: userId || null,
            leadCount: 0,
          });
        }
        const row = people.get(key);
        if (name && (!row.name || row.name === row.email)) row.name = String(name).trim();
        if (email && !row.email) row.email = String(email).trim().toLowerCase();
        if (userId && !row.userId) row.userId = userId;
        return row;
      };

      for (const invitee of storedInvitees) {
        upsertPerson({
          email: invitee?.email,
          name: invitee?.name,
          userId: invitee?.userId,
        });
      }

      for (const lead of leads) {
        const added = intakeLeadAddedBy(lead);
        const row = upsertPerson(added);
        if (row) row.leadCount += 1;
      }

      const members = Array.from(people.values()).sort((a, b) => b.leadCount - a.leadCount || a.name.localeCompare(b.name));

      return {
        tenantDbName: tenant,
        token: form.publicToken,
        accessCount: members.length,
        leadsFilledCount: leads.length,
        members,
      };
    });
  },

  async updatePublicFormLead(token, leadId, body, tenantDbName, actorHint = {}) {
    const tenant = requireTenantDbName(tenantDbName || body?.tenantDbName || getActiveTenantDbName());
    const publicToken = String(token || '').trim();
    const id = String(leadId || '').trim();
    const actorId = String(actorHint?.userId || body?.performedById || '').trim();
    if (!id) {
      throw Object.assign(new Error('Lead id is required'), { statusCode: 400 });
    }
    if (!actorId) {
      throw Object.assign(new Error('Sign in to edit a lead on this form'), { statusCode: 401 });
    }

    return runWithTenantContext(tenant, async () => {
      await findActiveFormForTenant(publicToken, tenant);
      const current = await prisma.lead.findFirst({
        where: { id, isDeleted: { not: true } },
      });
      if (!current || !leadMatchesIntakeToken(current, publicToken)) {
        throw Object.assign(new Error('Lead not found on this form'), { statusCode: 404 });
      }

      const payload = { ...(body || {}) };
      delete payload.tenantDbName;
      payload.campaignLink = publicToken;
      payload.campaignName = current.campaignName || 'Public intake form';
      payload.performedById = actorId;
      if (payload.otherDetails !== undefined) {
        payload.otherDetails = preserveIntakeOtherDetails(
          payload.otherDetails,
          current.otherDetails,
          publicToken
        );
      }

      return leadService.update(id, payload, null);
    });
  },

  async deletePublicFormLead(token, leadId, tenantDbName, actorHint = {}) {
    const tenant = requireTenantDbName(tenantDbName || getActiveTenantDbName());
    const publicToken = String(token || '').trim();
    const id = String(leadId || '').trim();
    const actorId = String(actorHint?.userId || '').trim();
    if (!id) {
      throw Object.assign(new Error('Lead id is required'), { statusCode: 400 });
    }
    if (!actorId) {
      throw Object.assign(new Error('Sign in to delete a lead on this form'), { statusCode: 401 });
    }

    return runWithTenantContext(tenant, async () => {
      await findActiveFormForTenant(publicToken, tenant);
      const current = await prisma.lead.findFirst({
        where: { id, isDeleted: { not: true } },
      });
      if (!current || !leadMatchesIntakeToken(current, publicToken)) {
        throw Object.assign(new Error('Lead not found on this form'), { statusCode: 404 });
      }
      await leadService.delete(id, actorId, null);
      return { id, deleted: true };
    });
  },
};
