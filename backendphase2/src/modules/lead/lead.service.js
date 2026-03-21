import { prisma } from '../../config/prisma.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';
import { dbLogger } from '../../utils/db-logger.js';
import { sendLeadFollowUpEmail } from '../../emails/email.service.js';
import { activityService } from '../activity/activity.service.js';

export const leadService = {
  async getAll(req) {
    const { page, limit, skip } = getPaginationParams(req);
    const { status, source, assignedToId, search, type, priority } = req.query;

    const where = {};
    if (status) where.status = status;
    if (source) where.source = source;
    if (type) where.type = type;
    if (priority) where.priority = priority;
    if (assignedToId) where.assignedToId = assignedToId;
    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

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

    return formatPaginationResponse(leads, page, limit, total);
  },

  async getById(id) {
    return prisma.lead.findUnique({
      where: { id },
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
  },

  async create(data) {
    // Map frontend fields to backend model
    const leadData = {
      companyName: data.companyName,
      contactPerson: data.contactPerson,
      email: data.email,
      phone: data.phone || null,
      type: data.type || 'Company',
      source: data.source || 'Website',
      status: data.status || 'New',
      priority: data.priority || 'Medium',
      interestedNeeds: data.interestedNeeds || null,
      notes: data.notes || null,
      // Extended company fields
      industry: data.industry || null,
      companySize: data.companySize || null,
      website: data.website || null,
      linkedIn: data.linkedIn || null,
      location: data.location || null,
      // Extended contact fields
      designation: data.designation || null,
      country: data.country || null,
      city: data.city || null,
      // Lead management fields
      campaignName: data.campaignName || null,
      campaignLink: data.campaignLink || null,
      referralName: data.referralName || null,
      sourceWebsiteUrl: data.sourceWebsiteUrl || null,
      sourceLinkedInUrl: data.sourceLinkedInUrl || null,
      sourceEmail: data.sourceEmail || null,
      lastFollowUp: data.lastFollowUp ? new Date(data.lastFollowUp) : null,
      nextFollowUp: data.nextFollowUp ? new Date(data.nextFollowUp) : null,
      // Relations
      assignedToId: data.assignedToId || null,
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

    // Log the created lead
    dbLogger.logCreate('Lead', lead);

    // Create activity log
    if (data.performedById) {
      try {
        await activityService.create({
          action: 'Lead Created',
          description: `New lead "${lead.companyName}" was created`,
          performedById: data.performedById,
          entityType: 'LEAD',
          entityId: lead.id,
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

  async update(id, data) {
    // Get the current lead to track changes
    const currentLead = await prisma.lead.findUnique({ where: { id } });
    if (!currentLead) {
      throw new Error('Lead not found');
    }

    // Map frontend fields to backend model
    const updateData = {};
    
    if (data.companyName !== undefined) updateData.companyName = data.companyName;
    if (data.contactPerson !== undefined) updateData.contactPerson = data.contactPerson;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone || null;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.source !== undefined) updateData.source = data.source;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.interestedNeeds !== undefined) updateData.interestedNeeds = data.interestedNeeds || null;
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    // Extended company fields
    if (data.industry !== undefined) updateData.industry = data.industry || null;
    if (data.companySize !== undefined) updateData.companySize = data.companySize || null;
    if (data.website !== undefined) updateData.website = data.website || null;
    if (data.linkedIn !== undefined) updateData.linkedIn = data.linkedIn || null;
    if (data.location !== undefined) updateData.location = data.location || null;
    // Extended contact fields
    if (data.designation !== undefined) updateData.designation = data.designation || null;
    if (data.country !== undefined) updateData.country = data.country || null;
    if (data.city !== undefined) updateData.city = data.city || null;
    // Lead management fields
    if (data.campaignName !== undefined) updateData.campaignName = data.campaignName || null;
    if (data.campaignLink !== undefined) updateData.campaignLink = data.campaignLink || null;
    if (data.referralName !== undefined) updateData.referralName = data.referralName || null;
    if (data.sourceWebsiteUrl !== undefined) updateData.sourceWebsiteUrl = data.sourceWebsiteUrl || null;
    if (data.sourceLinkedInUrl !== undefined) updateData.sourceLinkedInUrl = data.sourceLinkedInUrl || null;
    if (data.sourceEmail !== undefined) updateData.sourceEmail = data.sourceEmail || null;
    if (data.lastFollowUp !== undefined) updateData.lastFollowUp = data.lastFollowUp ? new Date(data.lastFollowUp) : null;
    if (data.nextFollowUp !== undefined) updateData.nextFollowUp = data.nextFollowUp ? new Date(data.nextFollowUp) : null;
    if (data.lostReason !== undefined) updateData.lostReason = data.lostReason || null;
    // Relations
    if (data.assignedToId !== undefined) updateData.assignedToId = data.assignedToId || null;
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

    // Log the updated lead
    dbLogger.logUpdate('Lead', id, updated);

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
          await activityService.create({
            action: 'Lead Updated',
            description: changes.join(', '),
            performedById: data.performedById,
            entityType: 'LEAD',
            entityId: id,
            metadata: baseMetadata,
          });
        } else {
          // General update
          await activityService.create({
            action: 'Lead Updated',
            description: data.statusRemark
              ? `Lead "${updated.companyName}" was updated. Remark: ${data.statusRemark}`
              : `Lead "${updated.companyName}" was updated`,
            performedById: data.performedById,
            entityType: 'LEAD',
            entityId: id,
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

  async convertToClient(id, clientData) {
    const lead = await prisma.lead.findUnique({ where: { id } });
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
      nextFollowUp: lead.nextFollowUp,
    }, null, 2));

    // Map all lead fields to client
    const clientCreateData = {
      companyName: clientData.companyName || lead.companyName,
      industry: clientData.industry || lead.industry,
      website: clientData.website || lead.website,
      status: 'PROSPECT',
      assignedToId: lead.assignedToId,
      location: clientData.location || lead.location || lead.city || lead.country || null,
      address: clientData.address || lead.location || (lead.city && lead.country ? `${lead.city}, ${lead.country}` : lead.city || lead.country || null),
      companySize: clientData.companySize || lead.companySize,
      linkedin: clientData.linkedin || lead.linkedIn || null, // Map linkedIn to linkedin
      hiringLocations: clientData.hiringLocations || (lead.city && lead.country ? `${lead.city}, ${lead.country}` : lead.city || lead.country || null),
      timezone: clientData.timezone || null,
      clientSince: new Date(), // Set to conversion date
      priority: clientData.priority || (lead.priority ? lead.priority.charAt(0) + lead.priority.slice(1).toLowerCase() : null), // Convert enum to string
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
            ownerId: lead.assignedToId || null,
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
        await activityService.create({
          action: 'Lead Converted to Client',
          description: `Lead "${lead.companyName}" was converted to client "${client.companyName}"`,
          performedById: clientData.performedById,
          entityType: 'LEAD',
          entityId: id,
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

  async delete(id, performedById) {
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      throw new Error('Lead not found');
    }

    await prisma.lead.delete({ where: { id } });

    // Create activity log
    if (performedById) {
      try {
        await activityService.create({
          action: 'Lead Deleted',
          description: `Lead "${lead.companyName}" was deleted`,
          performedById: performedById,
          entityType: 'LEAD',
          entityId: id,
          metadata: {
            companyName: lead.companyName,
            contactPerson: lead.contactPerson,
          },
        });
      } catch (err) {
        console.error('Failed to create activity log:', err);
      }
    }

    return { message: 'Lead deleted successfully' };
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
