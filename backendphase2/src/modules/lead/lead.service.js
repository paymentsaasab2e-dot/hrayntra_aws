import { prisma } from '../../config/prisma.js';
import { formatPaginationResponse } from '../../utils/pagination.js';
import { dbLogger } from '../../utils/db-logger.js';
import { sendLeadFollowUpEmail } from '../../emails/email.service.js';
import activityService from '../../services/activityService.js';
import { sendLeadAssignmentEmail } from '../../services/emailService.js';
import { canViewAllLeads } from '../../utils/permissionScope.js';

function isValidObjectId(value) {
  return typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value.trim());
}

function normalizeOtherDetails(value) {
  if (!Array.isArray(value)) return null;

  const normalized = value
    .map((item) => ({
      label: String(item?.label || '').trim(),
      value: String(item?.value || '').trim(),
    }))
    .filter((item) => item.label && item.value);

  return normalized.length ? normalized : null;
}

/** Strip NBSP (Excel) and trim — used for import + URL checks. */
function stripNbsp(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\u00a0/g, ' ');
}

const IMPORT_WEB_TLD_RE = /\.(com|net|org|io|co|cm|uk|eu|fr|de|au|ca|in|biz|info|app|dev)(\/|$|\?|#|:)/i;
const IMPORT_WEB_TLD_END_RE = /\.(com|net|org|io|co|cm|uk|eu|fr|de|au|ca|in|biz|info|app|dev)$/i;

/** True if the string looks like a real web address (not a plain company name). */
function isLikelyWebAddress(raw) {
  const s = stripNbsp(raw).trim();
  if (!s) return false;
  if (/^https?:\/\//i.test(s)) return true;
  if (/^www\./i.test(s)) return true;
  if (IMPORT_WEB_TLD_RE.test(s) || IMPORT_WEB_TLD_END_RE.test(s)) return true;
  return false;
}

function normalizeImportColumnHeader(value = '') {
  return stripNbsp(value)
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function buildLeadAccessWhere(id, req) {
  if (canViewAllLeads(req) || !req?.user?.id) {
    return { id };
  }
  return {
    AND: [
      { id },
      {
        OR: [
          { assignedToId: req.user.id },
          { assignedToIds: { has: req.user.id } },
          { createdBy: req.user.id },
        ],
      },
    ],
  };
}

async function resolveAssignedToId(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return null;

  if (isValidObjectId(normalized)) {
    const userById = await prisma.user.findUnique({
      where: { id: normalized },
      select: { id: true },
    });
    return userById?.id || null;
  }

  const lowered = normalized.toLowerCase();
  const userByIdentity = await prisma.user.findFirst({
    where: {
      OR: [
        { email: lowered },
        { name: normalized },
      ],
    },
    select: { id: true },
  });

  return userByIdentity?.id || null;
}

/**
 * Resolve a list of ids/emails/names to **deduped** ObjectIds, preserving
 * input order. Used by multi-assignee fields (`assignedToIds`).
 */
async function resolveAssignedToIds(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const id = await resolveAssignedToId(value);
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/** Hydrate lead.assignedToUsers from `assignedToIds` (single query per page). */
async function attachAssignees(leads) {
  const isArray = Array.isArray(leads);
  const list = isArray ? leads : [leads];
  const allIds = new Set();
  for (const lead of list) {
    if (!lead) continue;
    const ids = Array.isArray(lead.assignedToIds) ? lead.assignedToIds : [];
    for (const id of ids) if (id) allIds.add(id);
    if (lead.assignedToId) allIds.add(lead.assignedToId);
  }
  if (allIds.size === 0) {
    for (const lead of list) if (lead) lead.assignedToUsers = lead.assignedToUsers || [];
    return isArray ? list : list[0];
  }
  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(allIds) } },
    select: { id: true, name: true, email: true, avatar: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  for (const lead of list) {
    if (!lead) continue;
    const ids = Array.isArray(lead.assignedToIds) && lead.assignedToIds.length
      ? lead.assignedToIds
      : (lead.assignedToId ? [lead.assignedToId] : []);
    lead.assignedToUsers = ids.map((id) => byId.get(id)).filter(Boolean);
  }
  return isArray ? list : list[0];
}

export const leadService = {
  async getAll(req) {
    // Default page size higher than generic API (10): assignees and super admins must see assigned leads
    // without missing rows due to createdAt ordering + small first page.
    const page = Math.max(Number.parseInt(String(req.query.page ?? '1'), 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit ?? '100'), 10) || 100, 1), 500);
    const skip = (page - 1) * limit;
    const { status, source, assignedToId, search, type, priority } = req.query;

    const baseFilters = {};
    if (status) baseFilters.status = status;
    if (source) baseFilters.source = source;
    if (type) baseFilters.type = type;
    if (priority) baseFilters.priority = priority;
    if (assignedToId) {
      baseFilters.OR = [
        { assignedToId },
        { assignedToIds: { has: assignedToId } },
      ];
    }

    const andParts = [{ ...baseFilters }];
    // Recycle Bin: hide soft-deleted rows from the normal Leads page (always opt-in via /trash).
    // `not: true` matches false, null, and missing-field documents (legacy rows from before
    // the soft-delete column existed) without tripping Prisma's "Argument isDeleted is missing".
    andParts.push({ isDeleted: { not: true } });
    if (search) {
      andParts.push({
        OR: [
          { companyName: { contains: search, mode: 'insensitive' } },
          { contactPerson: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    if (!canViewAllLeads(req) && req.user?.id) {
      andParts.push({
        OR: [
          { assignedToId: req.user.id },
          { assignedToIds: { has: req.user.id } },
          { createdBy: req.user.id },
        ],
      });
    }

    const filteredParts = andParts.filter((part) => part && Object.keys(part).length > 0);
    const where =
      filteredParts.length === 0
        ? {}
        : filteredParts.length === 1
          ? filteredParts[0]
          : { AND: filteredParts };

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take: limit,
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true, avatar: true },
          },
          client: {
            select: { id: true, companyName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.lead.count({ where }),
    ]);

    await attachAssignees(leads);
    return formatPaginationResponse(leads, page, limit, total);
  },

  async getById(id, req = null) {
    const where = buildLeadAccessWhere(id, req);

    const lead = await prisma.lead.findFirst({
      where,
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        client: true,
        noteList: {
          include: {
            createdBy: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!lead) return null;
    await attachAssignees(lead);
    return lead;
  },

  async create(data) {
    const normalizeNullableString = (value) => {
      if (value === undefined || value === null) return null;
      const normalized = stripNbsp(value).trim();
      return normalized || null;
    };
    const normalizeRequiredLeadField = (value) => normalizeNullableString(value) || '';

    const rawCompanyLinkSources = Array.isArray(data.companyLinks)
      ? data.companyLinks.map((item) => stripNbsp(String(item)).trim()).filter(Boolean)
      : String(data.website || '')
          .split('\n')
          .map((item) => stripNbsp(item).trim())
          .filter(Boolean);

    const normalizedCompanyLinks = rawCompanyLinkSources.filter(isLikelyWebAddress);

    const normalizedContactPerson = normalizeNullableString(data.contactPerson) || normalizeNullableString(data.directorName);
    const normalizedDirectorSalutation = normalizeNullableString(data.directorSalutation);
    const normalizedIndustry = normalizeNullableString(data.industry) || normalizeNullableString(data.sector);
    const normalizedCompanySize = normalizeNullableString(data.companySize) || normalizeNullableString(data.teamName);
    const normalizedInterestedNeeds = normalizeNullableString(data.interestedNeeds) || normalizeNullableString(data.servicesNeeded);
    const normalizedNotes = normalizeNullableString(data.notes);
    const normalizedExpectedBusinessValue = normalizeNullableString(data.expectedBusinessValue);
    const resolvedAssignedToId = await resolveAssignedToId(data.assignedToId || data.assignedToName);
    const resolvedAssignedToIds = Array.isArray(data.assignedToIds)
      ? await resolveAssignedToIds(data.assignedToIds)
      : [];
    const normalizedOtherDetails = normalizeOtherDetails(data.otherDetails);

    // Map frontend fields to backend model
    const websiteInput = normalizeNullableString(data.website);
    const websiteClean = websiteInput && isLikelyWebAddress(websiteInput) ? websiteInput : null;
    const linkedInInput = normalizeNullableString(data.linkedIn);
    const linkedInClean =
      linkedInInput && (isLikelyWebAddress(linkedInInput) || linkedInInput.toLowerCase().includes('linkedin.com'))
        ? linkedInInput
        : null;

    const leadData = {
      companyName: normalizeRequiredLeadField(data.companyName),
      contactPerson: normalizeRequiredLeadField(normalizedContactPerson),
      directorName: normalizeNullableString(data.directorName) || null,
      directorSalutation: normalizedDirectorSalutation || null,
      email: normalizeRequiredLeadField(normalizeNullableString(data.email)?.toLowerCase()),
      phone: normalizeNullableString(data.phone),
      type: data.type || 'Company',
      source: data.source || 'Website',
      status: data.status || 'New',
      priority: data.priority || 'Medium',
      interestedNeeds: normalizedInterestedNeeds || null,
      servicesNeeded: data.servicesNeeded || normalizedInterestedNeeds || null,
      notes: normalizedNotes || null,
      expectedBusinessValue: normalizedExpectedBusinessValue || null,
      // Extended company fields
      industry: normalizedIndustry || null,
      sector: data.sector || normalizedIndustry || null,
      companySize: normalizedCompanySize || null,
      teamName: data.teamName || normalizedCompanySize || null,
      website: websiteClean || (normalizedCompanyLinks.length ? normalizedCompanyLinks[0] : null),
      companyLinks: normalizedCompanyLinks,
      linkedIn: linkedInClean,
      location: normalizeNullableString(data.location),
      // Extended contact fields
      designation: normalizeNullableString(data.designation),
      country: normalizeNullableString(data.country),
      city: normalizeNullableString(data.city),
      // Smart-location autofill metadata (Nominatim) — all optional.
      state: normalizeNullableString(data.state),
      latitude: Number.isFinite(Number(data.latitude)) ? Number(data.latitude) : null,
      longitude: Number.isFinite(Number(data.longitude)) ? Number(data.longitude) : null,
      // Lead management fields
      campaignName: normalizeNullableString(data.campaignName),
      campaignLink: normalizeNullableString(data.campaignLink),
      referralName: normalizeNullableString(data.referralName),
      sourceWebsiteUrl: normalizeNullableString(data.sourceWebsiteUrl),
      sourceLinkedInUrl: normalizeNullableString(data.sourceLinkedInUrl),
      sourceEmail: normalizeNullableString(data.sourceEmail),
      otherDetails: normalizedOtherDetails,
      lastFollowUp: data.lastFollowUp ? new Date(data.lastFollowUp) : null,
      nextFollowUp: data.nextFollowUp ? new Date(data.nextFollowUp) : null,
      // Agreements & Terms — single primary document attached during onboarding.
      agreementsFileName: normalizeNullableString(data.agreementsFileName),
      agreementsFileUrl: normalizeNullableString(data.agreementsFileUrl),
      agreementsUploadedAt: data.agreementsUploadedAt
        ? new Date(data.agreementsUploadedAt)
        : (normalizeNullableString(data.agreementsFileUrl) ? new Date() : null),
      // Relations
      assignedToId:
        resolvedAssignedToId ||
        resolvedAssignedToIds[0] ||
        (data.performedByRole === 'SUPER_ADMIN' && data.performedById ? data.performedById : null),
      assignedToIds: (() => {
        if (resolvedAssignedToIds.length > 0) {
          const out = [...resolvedAssignedToIds];
          if (resolvedAssignedToId && !out.includes(resolvedAssignedToId)) out.unshift(resolvedAssignedToId);
          return out;
        }
        if (resolvedAssignedToId) return [resolvedAssignedToId];
        if (data.performedByRole === 'SUPER_ADMIN' && data.performedById) return [String(data.performedById)];
        return [];
      })(),
      createdBy: data.performedById ? String(data.performedById) : null,
    };

    // Log the received data in JSON format
    dbLogger.logCreate('Lead', leadData);

    const lead = await prisma.lead.create({
      data: leadData,
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    await attachAssignees(lead);

    // Log the created lead
    dbLogger.logCreate('Lead', lead);

    // Create activity log
    if (data.performedById) {
      try {
        await activityService.logLeadActivity({
          entityId: lead.id,
          performedById: data.performedById,
          action: 'Lead Created',
          description: `New lead "${lead.companyName}" was created`,
          metadata: {
            companyName: lead.companyName,
            contactPerson: lead.contactPerson,
            status: lead.status,
            source: lead.source,
          },
        });
      } catch (err) {
        console.error('Failed to create activity log:', err);
        // Don't throw - activity logging is non-critical
      }
    }

    return lead;
  },

  async update(id, data, req = null) {
    // Get the current lead to track changes
    const currentLead = await prisma.lead.findFirst({
      where: buildLeadAccessWhere(id, req),
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
    });
    if (!currentLead) {
      throw new Error('Lead not found');
    }

    // Map frontend fields to backend model
    const updateData = {};
    const normalizedCompanyLinks = Array.isArray(data.companyLinks)
      ? data.companyLinks
          .map((item) => stripNbsp(String(item)).trim())
          .filter(Boolean)
          .filter(isLikelyWebAddress)
      : undefined;
    const normalizedOtherDetails = data.otherDetails !== undefined ? normalizeOtherDetails(data.otherDetails) : undefined;
    const resolvedAssignedToId =
      data.assignedToId !== undefined || data.assignedToName !== undefined
        ? await resolveAssignedToId(data.assignedToId || data.assignedToName)
        : undefined;
    const resolvedAssignedToIdsUpdate = Array.isArray(data.assignedToIds)
      ? await resolveAssignedToIds(data.assignedToIds)
      : undefined;
    
    if (data.companyName !== undefined) updateData.companyName = data.companyName || '';
    if (data.contactPerson !== undefined) updateData.contactPerson = data.contactPerson || '';
    if (data.directorName !== undefined) updateData.directorName = data.directorName || null;
    if (data.directorSalutation !== undefined) {
      const s = data.directorSalutation == null ? '' : String(data.directorSalutation).trim();
      updateData.directorSalutation = s || null;
    }
    if (data.contactPerson === undefined && data.directorName !== undefined) updateData.contactPerson = data.directorName || '';
    if (data.email !== undefined) updateData.email = data.email || '';
    if (data.phone !== undefined) updateData.phone = data.phone || null;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.source !== undefined) updateData.source = data.source;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.interestedNeeds !== undefined) updateData.interestedNeeds = data.interestedNeeds || null;
    if (data.servicesNeeded !== undefined) updateData.servicesNeeded = data.servicesNeeded || null;
    if (data.interestedNeeds === undefined && data.servicesNeeded !== undefined) updateData.interestedNeeds = data.servicesNeeded || null;
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.expectedBusinessValue !== undefined) updateData.expectedBusinessValue = data.expectedBusinessValue || null;
    // Extended company fields
    if (data.industry !== undefined) updateData.industry = data.industry || null;
    if (data.sector !== undefined) updateData.sector = data.sector || null;
    if (data.industry === undefined && data.sector !== undefined) updateData.industry = data.sector || null;
    if (data.companySize !== undefined) updateData.companySize = data.companySize || null;
    if (data.teamName !== undefined) updateData.teamName = data.teamName || null;
    if (data.companySize === undefined && data.teamName !== undefined) updateData.companySize = data.teamName || null;
    if (data.website !== undefined) updateData.website = data.website || null;
    if (normalizedCompanyLinks !== undefined) {
      updateData.companyLinks = normalizedCompanyLinks;
      if (data.website === undefined) {
        updateData.website = normalizedCompanyLinks.length ? normalizedCompanyLinks[0] : null;
      }
    }
    if (data.linkedIn !== undefined) updateData.linkedIn = data.linkedIn || null;
    if (data.location !== undefined) updateData.location = data.location || null;
    // Extended contact fields
    if (data.designation !== undefined) updateData.designation = data.designation || null;
    if (data.country !== undefined) updateData.country = data.country || null;
    if (data.city !== undefined) updateData.city = data.city || null;
    if (data.state !== undefined) updateData.state = data.state || null;
    if (data.latitude !== undefined) {
      const n = Number(data.latitude);
      updateData.latitude = Number.isFinite(n) ? n : null;
    }
    if (data.longitude !== undefined) {
      const n = Number(data.longitude);
      updateData.longitude = Number.isFinite(n) ? n : null;
    }
    // Lead management fields
    if (data.campaignName !== undefined) updateData.campaignName = data.campaignName || null;
    if (data.campaignLink !== undefined) updateData.campaignLink = data.campaignLink || null;
    if (data.referralName !== undefined) updateData.referralName = data.referralName || null;
    if (data.sourceWebsiteUrl !== undefined) updateData.sourceWebsiteUrl = data.sourceWebsiteUrl || null;
    if (data.sourceLinkedInUrl !== undefined) updateData.sourceLinkedInUrl = data.sourceLinkedInUrl || null;
    if (data.sourceEmail !== undefined) updateData.sourceEmail = data.sourceEmail || null;
    if (data.otherDetails !== undefined) updateData.otherDetails = normalizedOtherDetails;
    if (data.lastFollowUp !== undefined) updateData.lastFollowUp = data.lastFollowUp ? new Date(data.lastFollowUp) : null;
    if (data.nextFollowUp !== undefined) updateData.nextFollowUp = data.nextFollowUp ? new Date(data.nextFollowUp) : null;
    if (data.lostReason !== undefined) updateData.lostReason = data.lostReason || null;
    // Agreements & Terms — only touch when the field was sent.
    if (data.agreementsFileName !== undefined) {
      updateData.agreementsFileName = data.agreementsFileName || null;
    }
    if (data.agreementsFileUrl !== undefined) {
      updateData.agreementsFileUrl = data.agreementsFileUrl || null;
      if (data.agreementsUploadedAt === undefined) {
        updateData.agreementsUploadedAt = data.agreementsFileUrl ? new Date() : null;
      }
    }
    if (data.agreementsUploadedAt !== undefined) {
      updateData.agreementsUploadedAt = data.agreementsUploadedAt
        ? new Date(data.agreementsUploadedAt)
        : null;
    }
    // Relations
    if (resolvedAssignedToIdsUpdate !== undefined) {
      // Multi-assignee: array drives both list + primary owner.
      const next = [...resolvedAssignedToIdsUpdate];
      const explicitPrimary = resolvedAssignedToId !== undefined ? resolvedAssignedToId : undefined;
      if (explicitPrimary && !next.includes(explicitPrimary)) next.unshift(explicitPrimary);
      updateData.assignedToIds = next;
      updateData.assignedToId = explicitPrimary ?? next[0] ?? null;
    } else if (data.assignedToId !== undefined || data.assignedToName !== undefined) {
      // Single-assignee legacy path — mirror into the list so reads stay in sync.
      updateData.assignedToId = resolvedAssignedToId ?? null;
      const existing = Array.isArray(currentLead.assignedToIds) ? currentLead.assignedToIds : [];
      if (resolvedAssignedToId) {
        updateData.assignedToIds = [resolvedAssignedToId, ...existing.filter((id) => id !== resolvedAssignedToId)];
      } else {
        updateData.assignedToIds = [];
      }
    }
    if (data.convertedToClientId !== undefined) updateData.convertedToClientId = data.convertedToClientId || null;
    if (data.convertedToCandidateId !== undefined) updateData.convertedToCandidateId = data.convertedToCandidateId || null;
    if (data.convertedAt !== undefined) updateData.convertedAt = data.convertedAt ? new Date(data.convertedAt) : null;

    // Log the update data in JSON format
    dbLogger.logUpdate('Lead', id, updateData);

    const updated = await prisma.lead.update({
      where: { id },
      data: updateData,
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    await attachAssignees(updated);

    // Log the updated lead
    dbLogger.logUpdate('Lead', id, updated);

    if (
      data.assignedToId !== undefined &&
      data.assignedToId &&
      data.assignedToId !== currentLead.assignedToId &&
      updated.assignedTo?.email
    ) {
      try {
        const assignedBy = data.performedById
          ? await prisma.user.findUnique({
              where: { id: data.performedById },
              select: { name: true },
            })
          : null;

        await sendLeadAssignmentEmail({
          toEmail: updated.assignedTo.email,
          assigneeName: updated.assignedTo.name,
          leadCompanyName: updated.companyName,
          contactPerson: updated.contactPerson,
          leadEmail: updated.email,
          leadPhone: updated.phone,
          leadStatus: updated.status,
          leadPriority: updated.priority,
          assignedByName: assignedBy?.name || null,
          senderUserId: data.performedById,
        });
      } catch (emailError) {
        console.error('Failed to send lead assignment email:', emailError);
      }
    }

    // Create activity log for significant changes
    if (data.performedById) {
      try {
        const changes = [];
        if (data.status && data.status !== currentLead.status) {
          changes.push(`Status changed from "${currentLead.status}" to "${data.status}"`);
        }
        if (data.assignedToId && data.assignedToId !== currentLead.assignedToId) {
          const newAssignee = await prisma.user.findUnique({
            where: { id: data.assignedToId },
            select: { name: true },
          });
          changes.push(`Assigned to ${newAssignee?.name || 'new user'}`);
        }
        if (data.priority && data.priority !== currentLead.priority) {
          changes.push(`Priority changed to "${data.priority}"`);
        }
        if (data.nextFollowUp) {
          const followUpDate = new Date(data.nextFollowUp);
          const formattedDate = followUpDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

          // Extract follow-up details from statusRemark if available
          let followUpDescription = `Follow-up scheduled for ${formattedDate}`;
          let followUpType = 'Follow-up';
          let followUpNotes = '';

          if (data.statusRemark && data.statusRemark.includes('Follow-up scheduled:')) {
            // statusRemark example:
            // Follow-up scheduled: Call on 2026-03-15 at 14:30. Some notes...
            const remark = data.statusRemark.replace('Follow-up scheduled: ', '');
            followUpDescription = remark;

            // Try to parse type and notes from remark (best-effort)
            const onIndex = remark.indexOf(' on ');
            if (onIndex > 0) {
              followUpType = remark.substring(0, onIndex);
            }
            const notesIndex = remark.indexOf('. ');
            if (notesIndex > 0 && notesIndex + 2 < remark.length) {
              followUpNotes = remark.substring(notesIndex + 2);
            }
          }

          changes.push(followUpDescription);

          // Send follow-up email to the lead contact (best-effort, non-blocking)
          try {
            if (currentLead.email) {
              await sendLeadFollowUpEmail(
                currentLead.email,
                currentLead.companyName,
                data.nextFollowUp,
                followUpType,
                followUpNotes || data.statusRemark || null
              );
            }
          } catch (emailError) {
            console.error('Failed to send follow-up email:', emailError);
          }
        }
        if (data.lostReason) {
          changes.push(`Marked as Lost: ${data.lostReason}`);
        }
        if (data.statusRemark) {
          changes.push(`Remark: ${data.statusRemark}`);
        }

        const baseMetadata = {
          changes: Object.keys(updateData),
          previousStatus: currentLead.status,
          newStatus: data.status || currentLead.status,
          statusRemark: data.statusRemark || null,
        };

        if (changes.length > 0) {
          await activityService.logLeadActivity({
            entityId: id,
            performedById: data.performedById,
            action: 'Lead Updated',
            description: changes.join(', '),
            metadata: baseMetadata,
          });
        } else {
          // General update
          await activityService.logLeadActivity({
            entityId: id,
            performedById: data.performedById,
            action: 'Lead Updated',
            description: data.statusRemark
              ? `Lead "${updated.companyName}" was updated. Remark: ${data.statusRemark}`
              : `Lead "${updated.companyName}" was updated`,
            metadata: baseMetadata,
          });
        }
      } catch (err) {
        console.error('Failed to create activity log:', err);
        // Don't throw - activity logging is non-critical
      }
    }

    return updated;
  },

  /** Best image URL from lead uploads (newest first) — reused as client logo after conversion so jobs show the same art. */
  inferLogoUrlFromLeadFiles(files) {
    if (!Array.isArray(files) || !files.length) return null;
    const imgExt = /\.(png|jpe?g|gif|webp|svg)$/i;
    const sorted = [...files].sort(
      (a, b) => new Date(b.uploadDate || b.createdAt || 0) - new Date(a.uploadDate || a.createdAt || 0)
    );
    for (const f of sorted) {
      const url = String(f.fileUrl || '').trim();
      const name = String(f.fileName || '');
      if (!/^https?:\/\//i.test(url)) continue;
      if (
        imgExt.test(name) ||
        /\/image\/upload|res\.cloudinary\.com[^/]*\/image\//i.test(url) ||
        /\.s3[.-][^/]*amazonaws\.com\/.+\.(png|jpe?g|gif|webp)($|[?#])/i.test(url)
      ) {
        return url;
      }
    }
    return null;
  },

  async convertToClient(id, clientData) {
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        files: {
          orderBy: { uploadDate: 'desc' },
          select: { fileName: true, fileUrl: true, uploadDate: true, createdAt: true },
        },
      },
    });
    if (!lead) {
      throw new Error('Lead not found');
    }

    // Log the lead data to see what we're working with
    console.log('\n=== LEAD DATA BEING CONVERTED ===');
    console.log(JSON.stringify({
      id: lead.id,
      companyName: lead.companyName,
      industry: lead.industry,
      companySize: lead.companySize,
      teamName: lead.teamName,
      website: lead.website,
      linkedIn: lead.linkedIn,
      location: lead.location,
      city: lead.city,
      country: lead.country,
      designation: lead.designation,
      contactPerson: lead.contactPerson,
      email: lead.email,
      phone: lead.phone,
      priority: lead.priority,
      servicesNeeded: lead.servicesNeeded,
      interestedNeeds: lead.interestedNeeds,
      expectedBusinessValue: lead.expectedBusinessValue,
      notes: lead.notes,
      nextFollowUp: lead.nextFollowUp,
    }, null, 2));

    // Owner for RBAC client lists: lead assignee, else explicit payload, else the user who converts
    // (unassigned leads would otherwise create clients with no assignee — Sales would not see them.)
    const resolvedAssignedToId =
      clientData.assignedToId ||
      lead.assignedToId ||
      clientData.performedById ||
      null;

    // Map all lead fields to client
    const leadInferredLogo =
      typeof clientData.logo === 'string' && clientData.logo.trim()
        ? clientData.logo.trim()
        : this.inferLogoUrlFromLeadFiles(lead.files || []);

    const clientCreateData = {
      companyName: clientData.companyName || lead.companyName,
      industry: clientData.industry || lead.industry,
      website: clientData.website || lead.website,
      logo: leadInferredLogo || null,
      status: 'PROSPECT',
      assignedToId: resolvedAssignedToId,
      createdById: clientData.performedById || null,
      location: clientData.location || lead.location || lead.city || lead.country || null,
      address: clientData.address || lead.location || (lead.city && lead.country ? `${lead.city}, ${lead.country}` : lead.city || lead.country || null),
      companySize: clientData.companySize || lead.teamName || lead.companySize || null,
      linkedin: clientData.linkedin || lead.linkedIn || null, // Map linkedIn to linkedin
      hiringLocations: clientData.hiringLocations || (lead.city && lead.country ? `${lead.city}, ${lead.country}` : lead.city || lead.country || null),
      timezone: clientData.timezone || null,
      clientSince: new Date(), // Set to conversion date
      priority: clientData.priority || (lead.priority ? lead.priority.charAt(0) + lead.priority.slice(1).toLowerCase() : null), // Convert enum to string
      servicesNeeded: clientData.servicesNeeded || lead.servicesNeeded || lead.interestedNeeds || null,
      expectedBusinessValue: clientData.expectedBusinessValue || lead.expectedBusinessValue || lead.notes || null,
      sla: clientData.sla || null,
      nextFollowUpDue: lead.nextFollowUp || null,
    };

    // Log the client data being created
    console.log('\n=== CLIENT DATA BEING CREATED ===');
    console.log(JSON.stringify(clientCreateData, null, 2));

    const client = await prisma.client.create({
      data: clientCreateData,
    });

    // Log the created client
    console.log('\n=== CREATED CLIENT ===');
    console.log(JSON.stringify({
      id: client.id,
      companyName: client.companyName,
      industry: client.industry,
      companySize: client.companySize,
      servicesNeeded: client.servicesNeeded,
      expectedBusinessValue: client.expectedBusinessValue,
      website: client.website,
      linkedin: client.linkedin,
      location: client.location,
      hiringLocations: client.hiringLocations,
      timezone: client.timezone,
      priority: client.priority,
      sla: client.sla,
    }, null, 2));

    await prisma.lead.update({
      where: { id },
      data: {
        status: 'Converted',
        convertedToClientId: client.id,
        convertedAt: new Date(),
      },
    });

    // Create a Contact record from the lead's contact person data
    if (lead.contactPerson && lead.email) {
      try {
        const nameParts = lead.contactPerson.trim().split(' ');
        const firstName = nameParts[0] || lead.contactPerson;
        const lastName = nameParts.slice(1).join(' ') || '';
        
        await prisma.contact.create({
          data: {
            salutation: lead.directorSalutation ? String(lead.directorSalutation).trim() || null : null,
            firstName: firstName,
            lastName: lastName,
            email: lead.email.toLowerCase().trim(),
            phone: lead.phone || null,
            companyId: client.id,
            designation: lead.designation || null,
            location: lead.city && lead.country ? `${lead.city}, ${lead.country}` : lead.city || lead.country || lead.location || null,
            linkedinUrl: lead.linkedIn || null,
            contactType: 'CLIENT',
            status: 'ACTIVE',
            ownerId: resolvedAssignedToId || null,
          },
        });
      } catch (error) {
        // If contact already exists (email unique constraint), log but don't fail
        console.error('Failed to create contact from lead:', error.message);
      }
    }

    dbLogger.logUpdate('Lead', id, { status: 'Converted', convertedToClientId: client.id });

    // Create activity log
    if (clientData.performedById) {
      try {
        await activityService.logLeadActivity({
          entityId: id,
          performedById: clientData.performedById,
          action: 'Lead Converted to Client',
          description: `Lead "${lead.companyName}" was converted to client "${client.companyName}"`,
          metadata: {
            clientId: client.id,
            clientName: client.companyName,
          },
        });
      } catch (err) {
        console.error('Failed to create activity log:', err);
      }
    }

    return client;
  },

  async delete(id, performedById, req = null) {
    // Soft delete — flips isDeleted=true and stamps deletedAt/deletedBy so the row
    // shows up on the Recycle Bin page and can be restored.
    const lead = await prisma.lead.findFirst({
      where: buildLeadAccessWhere(id, req),
    });
    if (!lead) {
      throw new Error('Lead not found');
    }

    await prisma.lead.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: performedById || null,
      },
    });

    // Create activity log
    if (performedById) {
      try {
        await activityService.logLeadActivity({
          entityId: id,
          performedById,
          action: 'Lead Deleted',
          description: `Lead "${lead.companyName}" was moved to Recycle Bin`,
          metadata: {
            companyName: lead.companyName,
            contactPerson: lead.contactPerson,
            softDelete: true,
          },
        });
      } catch (err) {
        console.error('Failed to create activity log:', err);
      }
    }

    return { message: 'Lead moved to Recycle Bin' };
  },

  /**
   * Recycle Bin — list soft-deleted leads (newest first).
   * Scope mirrors getAll: assignees see only their own deleted records, admins see all.
   */
  async listTrash(req) {
    const page = Math.max(Number.parseInt(String(req.query.page ?? '1'), 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 500);
    const skip = (page - 1) * limit;

    const andParts = [{ isDeleted: true }];
    if (!canViewAllLeads(req) && req.user?.id) {
      andParts.push({
        OR: [
          { assignedToId: req.user.id },
          { assignedToIds: { has: req.user.id } },
          { createdBy: req.user.id },
          { deletedBy: req.user.id },
        ],
      });
    }
    const where = { AND: andParts };

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy: { deletedAt: 'desc' },
        include: {
          assignedTo: { select: { id: true, name: true, email: true, avatar: true } },
        },
      }),
      prisma.lead.count({ where }),
    ]);
    await attachAssignees(leads);
    return formatPaginationResponse(leads, page, limit, total);
  },

  /** Recycle Bin — restore a soft-deleted lead. */
  async restore(id, performedById, req = null) {
    const lead = await prisma.lead.findFirst({
      where: { id, isDeleted: true },
    });
    if (!lead) {
      throw new Error('Deleted lead not found');
    }
    await prisma.lead.update({
      where: { id },
      data: { isDeleted: false, deletedAt: null, deletedBy: null },
    });
    if (performedById) {
      try {
        await activityService.logLeadActivity({
          entityId: id,
          performedById,
          action: 'Lead Restored',
          description: `Lead "${lead.companyName}" was restored from the Recycle Bin`,
          metadata: { companyName: lead.companyName },
        });
      } catch (err) {
        console.error('Failed to create activity log:', err);
      }
    }
    return { message: 'Lead restored' };
  },

  /** Recycle Bin — permanently delete a soft-deleted lead. */
  /**
   * Bulk permanent-delete (Recycle Bin → Delete forever). Sequential so each lead's
   * transactional cleanup is isolated.
   */
  async bulkPurge(ids, performedById, req = null) {
    const unique = Array.from(new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean)));
    if (!unique.length) {
      return { success: 0, failed: 0, failures: [] };
    }
    let success = 0;
    const failures = [];
    for (const leadId of unique) {
      try {
        await this.purge(leadId, performedById, req);
        success += 1;
      } catch (err) {
        failures.push({ id: leadId, message: err?.message || 'Failed to purge lead' });
      }
    }
    return { success, failed: failures.length, failures };
  },

  async purge(id, performedById, req = null) {
    const lead = await prisma.lead.findFirst({
      where: { id, isDeleted: true },
    });
    if (!lead) {
      throw new Error('Deleted lead not found');
    }
    await prisma.lead.delete({ where: { id } });
    if (performedById) {
      try {
        await activityService.logLeadActivity({
          entityId: id,
          performedById,
          action: 'Lead Purged',
          description: `Lead "${lead.companyName}" was permanently deleted`,
          metadata: { companyName: lead.companyName },
        });
      } catch (err) {
        console.error('Failed to create activity log:', err);
      }
    }
    return { message: 'Lead permanently deleted' };
  },

  async importLeads({ rows = [], mapping = {}, duplicateRule = 'skip', performedById, performedByRole }) {
    const results = {
      total: rows.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    const EBV_IMPORT_HEADERS = new Set(['expected business value', 'expected value', 'business value']);
    const CAMPAIGN_IMPORT_HEADERS = new Set(['campaign', 'campaign name']);

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || {};

      const cleanMapped = (crmFieldKey) => {
        const column = mapping[crmFieldKey];
        if (!column || typeof column !== 'string') return null;
        const raw = row[column];
        if (raw === undefined || raw === null) return null;
        const s = stripNbsp(String(raw)).trim();
        return s === '' ? null : s;
      };

      const mappedHeaderNorm = (crmFieldKey) => {
        const column = mapping[crmFieldKey];
        if (!column || typeof column !== 'string') return null;
        return normalizeImportColumnHeader(column);
      };

      const valueIfHeaderIn = (crmFieldKey, allowedHeaders) => {
        const h = mappedHeaderNorm(crmFieldKey);
        if (!h || !allowedHeaders.has(h)) return null;
        return cleanMapped(crmFieldKey);
      };

      const normalizeImportPriority = (value) => {
        const n = stripNbsp(value).trim().toLowerCase();
        if (!n) return 'Low';
        if (n === 'cold' || n === 'low') return 'Low';
        if (n === 'warm' || n === 'medium' || n === 'med' || n === 'moderate') return 'Medium';
        if (n === 'hot' || n === 'high') return 'High';
        return 'Low';
      };

      const normalizeStatus = (value) => {
        const normalized = stripNbsp(value).trim().toLowerCase();
        if (!normalized) return undefined;
        if (normalized === 'new') return 'New';
        if (normalized === 'contacted') return 'Contacted';
        if (normalized === 'qualified') return 'Qualified';
        if (normalized === 'converted') return 'Converted';
        if (normalized === 'lost') return 'Lost';
        return undefined;
      };

      const normalizeType = (value) => {
        const normalized = stripNbsp(value).trim().toLowerCase();
        if (!normalized) return undefined;
        if (normalized === 'company') return 'Company';
        if (normalized === 'individual') return 'Individual';
        if (normalized === 'referral') return 'Referral';
        return undefined;
      };

      const normalizeSource = (value) => {
        const normalized = stripNbsp(value).trim().toLowerCase();
        if (!normalized) return undefined;
        if (normalized === 'website') return 'Website';
        if (normalized === 'linkedin') return 'LinkedIn';
        if (normalized === 'email') return 'Email';
        if (normalized === 'referral') return 'Referral';
        if (normalized === 'campaign') return 'Campaign';
        return undefined;
      };

      const parseDateValue = (value) => {
        if (value === undefined || value === null) return undefined;
        const s = stripNbsp(String(value)).trim();
        if (!s) return undefined;
        const parsed = new Date(s);
        return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
      };

      const companyName = cleanMapped('companyName');
      const contactPerson = cleanMapped('contactPerson');
      const directorName = cleanMapped('directorName');
      const emailRaw = cleanMapped('email');
      const email = emailRaw ? emailRaw.toLowerCase() : null;
      const phone = cleanMapped('phone');

      const websiteRaw = cleanMapped('website');
      const website = websiteRaw && isLikelyWebAddress(websiteRaw) ? websiteRaw : null;

      const linkedInRaw = cleanMapped('linkedIn');
      const linkedIn =
        linkedInRaw && (isLikelyWebAddress(linkedInRaw) || linkedInRaw.toLowerCase().includes('linkedin.com'))
          ? linkedInRaw
          : null;

      const companyLinks = [website, linkedIn].filter(Boolean);

      const sectorVal = cleanMapped('industry');
      const servicesVal = cleanMapped('interestedNeeds');
      const expectedBusinessValue = valueIfHeaderIn('expectedBusinessValue', EBV_IMPORT_HEADERS);
      const campaignName = valueIfHeaderIn('campaignName', CAMPAIGN_IMPORT_HEADERS);

      const countryRaw = cleanMapped('country');
      const country = countryRaw || 'Cameroon';

      const payload = {
        companyName,
        contactPerson,
        directorName: directorName || null,
        directorSalutation: cleanMapped('directorSalutation'),
        email,
        phone,
        type: normalizeType(cleanMapped('type')) || 'Company',
        source: normalizeSource(cleanMapped('source')) || 'Website',
        status: normalizeStatus(cleanMapped('status')) || 'New',
        priority: normalizeImportPriority(cleanMapped('priority') || ''),
        interestedNeeds: servicesVal,
        servicesNeeded: servicesVal,
        notes: cleanMapped('notes'),
        expectedBusinessValue,
        industry: sectorVal,
        sector: sectorVal,
        companySize: cleanMapped('companySize'),
        teamName: cleanMapped('companySize'),
        website,
        linkedIn,
        companyLinks,
        location: cleanMapped('location'),
        designation: cleanMapped('designation'),
        city: cleanMapped('city'),
        country,
        state: cleanMapped('state'),
        latitude: (() => {
          const n = Number(cleanMapped('latitude'));
          return Number.isFinite(n) ? n : null;
        })(),
        longitude: (() => {
          const n = Number(cleanMapped('longitude'));
          return Number.isFinite(n) ? n : null;
        })(),
        campaignName,
        nextFollowUp: parseDateValue(cleanMapped('nextFollowUpDue')) || null,
        sourceWebsiteUrl: null,
        sourceLinkedInUrl: null,
        sourceEmail: null,
        referralName: null,
        performedById,
      };

      try {
        const duplicateChecks = [];

        if (email) {
          duplicateChecks.push({ email: { equals: email, mode: 'insensitive' } });
        }

        if (companyName && contactPerson) {
          duplicateChecks.push({
            companyName: { equals: companyName, mode: 'insensitive' },
            contactPerson: { equals: contactPerson, mode: 'insensitive' },
          });
        }

        const existing = duplicateChecks.length > 0
          ? await prisma.lead.findFirst({
              where: {
                isDeleted: { not: true },
                OR: duplicateChecks,
              },
            })
          : null;

        if (existing && duplicateRule === 'skip') {
          results.skipped += 1;
          continue;
        }

        if (existing && duplicateRule === 'update') {
          await this.update(existing.id, payload);
          results.updated += 1;
          continue;
        }

        await this.create({ ...payload, performedByRole });
        results.created += 1;
      } catch (error) {
        results.failed += 1;
        results.errors.push(`Row ${index + 1}: ${error.message}`);
      }
    }

    return results;
  },

  async getActivities(leadId) {
    const activities = await prisma.activity.findMany({
      where: {
        entityType: 'LEAD',
        entityId: leadId,
      },
      include: {
        performedBy: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return activities;
  },
};
