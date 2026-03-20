import { prisma } from '../../config/prisma.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';
import { dbLogger } from '../../utils/db-logger.js';

export const contactService = {
  async getAll(filters = {}) {
    const { page, limit, skip } = getPaginationParams({ query: filters });
    const {
      contactType,
      companyId,
      location,
      tags,
      ownerId,
      status,
      recentlyContacted,
      search,
    } = filters;

    const where = {};

    // Search filter (full text search)
    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
      ];
      
      // Also search in company name if company relation exists
      if (!companyId) {
        where.OR.push({
          company: {
            companyName: { contains: search },
          },
        });
      }
    }

    // Contact type filter
    if (contactType) {
      const typeMap = {
        'CANDIDATE': 'CANDIDATE',
        'CLIENT': 'CLIENT',
        'HIRING_MANAGER': 'HIRING_MANAGER',
        'INTERVIEWER': 'INTERVIEWER',
        'VENDOR': 'VENDOR',
        'DECISION_MAKER': 'DECISION_MAKER',
        'FINANCE': 'FINANCE',
      };
      where.contactType = typeMap[contactType] || contactType;
    }

    // Company filter
    if (companyId) {
      where.companyId = companyId;
    }

    // Location filter
    if (location) {
      where.location = { contains: location };
    }

    // Tags filter (array contains)
    if (tags && Array.isArray(tags) && tags.length > 0) {
      where.tags = { hasSome: tags };
    }

    // Owner filter
    if (ownerId) {
      where.ownerId = ownerId;
    }

    // Status filter
    if (status) {
      const statusMap = {
        'ACTIVE': 'ACTIVE',
        'INACTIVE': 'INACTIVE',
      };
      where.status = statusMap[status] || status;
    }

    // Recently contacted filter
    if (recentlyContacted) {
      const now = new Date();
      let daysAgo;
      if (recentlyContacted === '7d') {
        daysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (recentlyContacted === '30d') {
        daysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else if (recentlyContacted === 'all') {
        // No filter
      }
      if (daysAgo) {
        where.lastContacted = { gte: daysAgo };
      }
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take: limit,
        include: {
          company: {
            select: { id: true, companyName: true },
          },
          owner: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.contact.count({ where }),
    ]);

    return formatPaginationResponse(contacts, page, limit, total);
  },

  async getById(id) {
    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        company: true,
        owner: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        notes: {
          include: {
            author: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        activities: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { timestamp: 'desc' },
        },
        communications: {
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    if (!contact) return null;

    // Get associated jobs
    const associatedJobs = contact.associatedJobIds.length > 0
      ? await prisma.job.findMany({
          where: { id: { in: contact.associatedJobIds } },
          select: { id: true, title: true, status: true },
        })
      : [];

    return {
      ...contact,
      associatedJobs,
    };
  },

  async create(data, userId) {
    // Check for duplicate email
    if (data.email) {
      const existing = await prisma.contact.findUnique({
        where: { email: data.email.toLowerCase().trim() },
      });

      if (existing) {
        return {
          duplicate: true,
          existingContact: existing,
        };
      }
    }

    const contactData = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email?.toLowerCase().trim() || null,
      phone: data.phone || null,
      companyId: data.companyId || null,
      designation: data.designation || null,
      department: data.department || null,
      location: data.location || null,
      linkedinUrl: data.linkedinUrl || null,
      contactType: data.contactType || 'CLIENT',
      status: data.status || 'ACTIVE',
      ownerId: data.ownerId || userId || null,
      avatarUrl: data.avatarUrl || null,
      tags: data.tags || [],
      associatedJobIds: data.associatedJobIds || [],
    };

    dbLogger.logCreate('CONTACT', contactData);

    const contact = await prisma.contact.create({
      data: contactData,
      include: {
        company: {
          select: { id: true, companyName: true },
        },
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Log activity
    await prisma.contactActivity.create({
      data: {
        contactId: contact.id,
        activityType: 'created',
        description: `Contact created`,
        userId: userId || contact.ownerId,
      },
    });

    console.log(`✅ Contact created successfully with ID: ${contact.id}\n`);

    return contact;
  },

  async update(id, data, userId) {
    const updateData = {};

    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.email !== undefined) {
      // Check for duplicate email if changing
      const existing = await prisma.contact.findFirst({
        where: {
          email: data.email.toLowerCase().trim(),
          id: { not: id },
        },
      });
      if (existing) {
        throw new Error('Email already exists for another contact');
      }
      updateData.email = data.email.toLowerCase().trim();
    }
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.companyId !== undefined) updateData.companyId = data.companyId || null;
    if (data.designation !== undefined) updateData.designation = data.designation;
    if (data.department !== undefined) updateData.department = data.department;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.linkedinUrl !== undefined) updateData.linkedinUrl = data.linkedinUrl;
    if (data.contactType !== undefined) updateData.contactType = data.contactType;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.ownerId !== undefined) updateData.ownerId = data.ownerId || null;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.associatedJobIds !== undefined) updateData.associatedJobIds = data.associatedJobIds;

    dbLogger.logUpdate('CONTACT', id, updateData);

    const updated = await prisma.contact.update({
      where: { id },
      data: updateData,
      include: {
        company: {
          select: { id: true, companyName: true },
        },
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Log activity
    await prisma.contactActivity.create({
      data: {
        contactId: id,
        activityType: 'updated',
        description: `Contact updated`,
        userId: userId,
      },
    });

    console.log(`✅ Contact updated successfully (ID: ${id})\n`);

    return updated;
  },

  async delete(id, userId) {
    // Log activity before deletion
    await prisma.contactActivity.create({
      data: {
        contactId: id,
        activityType: 'deleted',
        description: `Contact deleted`,
        userId: userId,
      },
    });

    await prisma.contact.delete({ where: { id } });
    return { message: 'Contact deleted successfully' };
  },

  async bulkAction(action, contactIds, payload = {}, userId) {
    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds } },
    });

    if (contacts.length === 0) {
      throw new Error('No contacts found');
    }

    switch (action) {
      case 'assign_owner':
        await prisma.contact.updateMany({
          where: { id: { in: contactIds } },
          data: { ownerId: payload.ownerId },
        });
        // Log activity for each contact
        for (const contactId of contactIds) {
          await prisma.contactActivity.create({
            data: {
              contactId,
              activityType: 'owner_assigned',
              description: `Owner assigned`,
              userId,
            },
          });
        }
        return { message: `${contacts.length} contacts updated` };

      case 'add_tags':
        const tagsToAdd = payload.tags || [];
        for (const contact of contacts) {
          const updatedTags = [...new Set([...contact.tags, ...tagsToAdd])];
          await prisma.contact.update({
            where: { id: contact.id },
            data: { tags: updatedTags },
          });
        }
        return { message: `Tags added to ${contacts.length} contacts` };

      case 'delete':
        await prisma.contact.deleteMany({
          where: { id: { in: contactIds } },
        });
        return { message: `${contacts.length} contacts deleted` };

      case 'export':
        // Return contacts for export
        return contacts;

      default:
        throw new Error(`Unknown bulk action: ${action}`);
    }
  },

  async mergeContacts(primaryId, duplicateId, userId) {
    const primary = await prisma.contact.findUnique({ where: { id: primaryId } });
    const duplicate = await prisma.contact.findUnique({ where: { id: duplicateId } });

    if (!primary || !duplicate) {
      throw new Error('One or both contacts not found');
    }

    // Merge notes
    await prisma.contactNote.updateMany({
      where: { contactId: duplicateId },
      data: { contactId: primaryId },
    });

    // Merge activities
    await prisma.contactActivity.updateMany({
      where: { contactId: duplicateId },
      data: { contactId: primaryId },
    });

    // Merge communications
    await prisma.contactCommunication.updateMany({
      where: { contactId: duplicateId },
      data: { contactId: primaryId },
    });

    // Merge tags
    const mergedTags = [...new Set([...primary.tags, ...duplicate.tags])];
    
    // Merge associated jobs
    const mergedJobIds = [...new Set([...primary.associatedJobIds, ...duplicate.associatedJobIds])];

    // Update primary contact with merged data
    await prisma.contact.update({
      where: { id: primaryId },
      data: {
        tags: mergedTags,
        associatedJobIds: mergedJobIds,
        // Keep primary's data, but fill in missing fields from duplicate
        phone: primary.phone || duplicate.phone,
        location: primary.location || duplicate.location,
        linkedinUrl: primary.linkedinUrl || duplicate.linkedinUrl,
        designation: primary.designation || duplicate.designation,
        department: primary.department || duplicate.department,
      },
    });

    // Delete duplicate
    await prisma.contact.delete({ where: { id: duplicateId } });

    // Log activity
    await prisma.contactActivity.create({
      data: {
        contactId: primaryId,
        activityType: 'merged',
        description: `Merged with contact ${duplicate.firstName} ${duplicate.lastName}`,
        userId,
      },
    });

    return { message: 'Contacts merged successfully' };
  },

  async addNote(contactId, note, authorId) {
    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact) {
      throw new Error('Contact not found');
    }

    const contactNote = await prisma.contactNote.create({
      data: {
        contactId,
        note,
        authorId,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Log activity
    await prisma.contactActivity.create({
      data: {
        contactId,
        activityType: 'note_added',
        description: `Note added`,
        userId: authorId,
      },
    });

    return contactNote;
  },

  async addActivity(contactId, activityType, description, userId) {
    const activity = await prisma.contactActivity.create({
      data: {
        contactId,
        activityType,
        description,
        userId,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return activity;
  },

  async addCommunication(contactId, data, userId) {
    const communication = await prisma.contactCommunication.create({
      data: {
        contactId,
        type: data.type,
        subject: data.subject,
        message: data.message,
        direction: data.direction,
      },
    });

    // Update lastContacted
    await prisma.contact.update({
      where: { id: contactId },
      data: { lastContacted: new Date() },
    });

    // Log activity
    await prisma.contactActivity.create({
      data: {
        contactId,
        activityType: 'communication',
        description: `${data.direction} ${data.type}: ${data.subject || 'No subject'}`,
        userId,
      },
    });

    return communication;
  },

  async getStats() {
    const [total, candidates, clientContacts, hiringManagers] = await Promise.all([
      prisma.contact.count(),
      prisma.contact.count({ where: { contactType: 'CANDIDATE' } }),
      prisma.contact.count({ where: { contactType: 'CLIENT' } }),
      prisma.contact.count({ where: { contactType: 'HIRING_MANAGER' } }),
    ]);

    return {
      total,
      candidates,
      clientContacts,
      hiringManagers,
    };
  },

  async detectDuplicates(email, name) {
    const duplicates = [];

    // Find by email
    if (email) {
      const byEmail = await prisma.contact.findUnique({
        where: { email: email.toLowerCase().trim() },
      });
      if (byEmail) {
        duplicates.push({ match: 'email', contact: byEmail });
      }
    }

    // Find by similar name + company
    if (name) {
      const nameParts = name.trim().split(/\s+/);
      if (nameParts.length >= 2) {
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');

        const byName = await prisma.contact.findMany({
          where: {
            AND: [
              { firstName: { contains: firstName } },
              { lastName: { contains: lastName } },
            ],
          },
        });

        byName.forEach(contact => {
          if (!duplicates.find(d => d.contact.id === contact.id)) {
            duplicates.push({ match: 'name', contact });
          }
        });
      }
    }

    return duplicates;
  },
};
