import { getJobPortalPrismaClient } from '../../config/prisma.js';
import { notifyPortalEventApplicants } from './portal-event-notifications.js';
import {
  normalizePortalEventMedia,
  storePortalEventMediaFile,
} from './portal-events-media.service.js';

function portalDb() {
  return getJobPortalPrismaClient();
}

function creatorDisplayName(user) {
  if (!user) return 'Organizer';
  return (
    user.name ||
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    user.email ||
    'Organizer'
  );
}

function buildOwnershipWhere({ eventId, createdById, source, tenantDbName }) {
  const where = {
    id: String(eventId),
    createdById: String(createdById),
    source: String(source),
  };
  if (tenantDbName) where.tenantDbName = String(tenantDbName);
  return where;
}

async function findOwnedEvent({ eventId, createdById, source, tenantDbName }) {
  const event = await portalDb().lmsEvent.findFirst({
    where: buildOwnershipWhere({ eventId, createdById, source, tenantDbName }),
    include: { _count: { select: { registrations: true } } },
  });
  if (!event) {
    const err = new Error('Event not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  return event;
}

async function loadEventRegistrations(eventId) {
  return portalDb().lmsEventRegistration.findMany({
    where: { eventId: String(eventId) },
    select: { id: true, userId: true },
  });
}

function normalizeSections(sections) {
  if (!Array.isArray(sections)) return [];
  return sections
    .map((section, index) => ({
      id: String(section?.id || `sec_${index + 1}`),
      title: String(section?.title || '').trim(),
      content: String(section?.content || '').trim(),
    }))
    .filter((section) => section.title || section.content);
}

function buildEventCreateData(payload, creator, source, tenantDbName) {
  const title = String(payload?.title || '').trim();
  const description = String(payload?.description || '').trim();
  const location = String(payload?.location || '').trim();
  const scheduledAt = payload?.scheduledAt ? new Date(payload.scheduledAt) : null;

  if (!title) {
    const err = new Error('Event title is required');
    err.code = 'VALIDATION';
    throw err;
  }
  if (!description) {
    const err = new Error('Event description is required');
    err.code = 'VALIDATION';
    throw err;
  }
  if (!location) {
    const err = new Error('Event location is required');
    err.code = 'VALIDATION';
    throw err;
  }
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
    const err = new Error('Valid event date/time is required');
    err.code = 'VALIDATION';
    throw err;
  }

  const mode = String(payload?.mode || 'Offline').trim() || 'Offline';

  return {
    title,
    description,
    location,
    sections: normalizeSections(payload?.sections),
    type: String(payload?.type || 'workshop').trim() || 'workshop',
    mode,
    meetingUrl: payload?.meetingUrl ? String(payload.meetingUrl).trim() : null,
    scheduledAt,
    durationMinutes: Math.max(15, Number(payload?.durationMinutes) || 60),
    capacity: payload?.capacity != null ? Math.max(1, Number(payload.capacity) || 0) : null,
    tags: Array.isArray(payload?.tags) ? payload.tags.map(String).filter(Boolean) : [],
    isPublished: payload?.isPublished !== false,
    media: normalizePortalEventMedia(payload?.media),
    hostName: creatorDisplayName(creator),
    createdById: String(creator.id),
    createdByEmail: creator.email ? String(creator.email).trim() : null,
    createdByName: creatorDisplayName(creator),
    source,
    tenantDbName: tenantDbName ? String(tenantDbName).trim() : null,
  };
}

export async function createPortalEvent({ payload, creator, source, tenantDbName }) {
  const data = buildEventCreateData(payload, creator, source, tenantDbName);
  const event = await portalDb().lmsEvent.create({ data });
  return serializeEventRow(event, 0);
}

export async function listPortalEventsForCreator({ createdById, source, tenantDbName }) {
  const where = {
    createdById: String(createdById),
    source: String(source),
  };
  if (tenantDbName) where.tenantDbName = String(tenantDbName);

  const rows = await portalDb().lmsEvent.findMany({
    where,
    orderBy: { scheduledAt: 'desc' },
    include: { _count: { select: { registrations: true } } },
  });

  return rows.map((row) => serializeEventRow(row, row._count?.registrations ?? 0));
}

export async function getPortalEventRegistrations({ eventId, createdById, source, tenantDbName }) {
  const event = await findOwnedEvent({ eventId, createdById, source, tenantDbName });

  const registrations = await portalDb().lmsEventRegistration.findMany({
    where: { eventId: event.id },
    orderBy: { registeredAt: 'desc' },
  });

  const userIds = [...new Set(registrations.map((row) => row.userId).filter(Boolean))];
  let candidates = [];
  if (userIds.length > 0) {
    try {
      candidates = await portalDb().candidate.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          city: true,
          currentTitle: true,
        },
      });
    } catch {
      candidates = [];
    }
  }

  const candidateById = new Map(candidates.map((c) => [c.id, c]));

  return {
    event: serializeEventRow(event, registrations.length),
    registrations: registrations.map((registration) => {
      const candidate = candidateById.get(registration.userId);
      return {
        id: registration.id,
        registeredAt: registration.registeredAt,
        attended: registration.attended,
        userId: registration.userId,
        name: candidate
          ? [candidate.firstName, candidate.lastName].filter(Boolean).join(' ').trim() || '—'
          : '—',
        email: candidate?.email || '—',
        phone: candidate?.phone || '—',
        city: candidate?.city || '—',
        currentTitle: candidate?.currentTitle || '—',
      };
    }),
  };
}

export async function updatePortalEvent({ eventId, payload, createdById, source, tenantDbName }) {
  const existing = await findOwnedEvent({ eventId, createdById, source, tenantDbName });
  if (String(existing.status || 'active') === 'cancelled') {
    const err = new Error('Cancelled events cannot be edited');
    err.code = 'VALIDATION';
    throw err;
  }

  const data = {};
  if (payload?.title != null) {
    const title = String(payload.title).trim();
    if (!title) {
      const err = new Error('Event title is required');
      err.code = 'VALIDATION';
      throw err;
    }
    data.title = title;
  }
  if (payload?.description != null) {
    const description = String(payload.description).trim();
    if (!description) {
      const err = new Error('Event description is required');
      err.code = 'VALIDATION';
      throw err;
    }
    data.description = description;
  }
  if (payload?.location != null) {
    const location = String(payload.location).trim();
    if (!location) {
      const err = new Error('Event location is required');
      err.code = 'VALIDATION';
      throw err;
    }
    data.location = location;
  }
  if (payload?.scheduledAt != null) {
    const scheduledAt = new Date(payload.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      const err = new Error('Valid event date/time is required');
      err.code = 'VALIDATION';
      throw err;
    }
    data.scheduledAt = scheduledAt;
  }
  if (payload?.sections != null) {
    data.sections = normalizeSections(payload.sections);
  }
  if (payload?.type != null) {
    data.type = String(payload.type).trim() || 'workshop';
  }
  if (payload?.mode != null) {
    data.mode = String(payload.mode).trim() || 'Offline';
  }
  if (payload?.durationMinutes != null) {
    data.durationMinutes = Math.max(15, Number(payload.durationMinutes) || 60);
  }
  if (payload?.isPublished != null) {
    data.isPublished = Boolean(payload.isPublished);
  }
  if (payload?.media != null) {
    data.media = normalizePortalEventMedia(payload.media);
  }

  if (Object.keys(data).length === 0) {
    const err = new Error('No valid fields to update');
    err.code = 'VALIDATION';
    throw err;
  }

  const updated = await portalDb().lmsEvent.update({
    where: { id: existing.id },
    data,
    include: { _count: { select: { registrations: true } } },
  });

  return serializeEventRow(updated, updated._count?.registrations ?? 0);
}

export async function cancelPortalEvent({ eventId, createdById, source, tenantDbName, organizerName }) {
  const existing = await findOwnedEvent({ eventId, createdById, source, tenantDbName });
  if (String(existing.status || 'active') === 'cancelled') {
    const err = new Error('Event is already cancelled');
    err.code = 'VALIDATION';
    throw err;
  }

  const registrations = await loadEventRegistrations(existing.id);

  const updated = await portalDb().lmsEvent.update({
    where: { id: existing.id },
    data: {
      status: 'cancelled',
      isPublished: false,
    },
    include: { _count: { select: { registrations: true } } },
  });

  void notifyPortalEventApplicants({
    event: updated,
    registrations,
    action: 'cancelled',
    organizerName,
  });

  return serializeEventRow(updated, updated._count?.registrations ?? 0);
}

export async function deletePortalEvent({ eventId, createdById, source, tenantDbName, organizerName }) {
  const existing = await findOwnedEvent({ eventId, createdById, source, tenantDbName });
  const registrations = await loadEventRegistrations(existing.id);

  void notifyPortalEventApplicants({
    event: existing,
    registrations,
    action: 'deleted',
    organizerName,
  });

  await portalDb().lmsEvent.delete({ where: { id: existing.id } });

  return { id: existing.id, deleted: true };
}

export async function uploadPortalEventMediaFiles({ files, tenantDbName }) {
  const uploaded = [];
  for (const file of files) {
    uploaded.push(await storePortalEventMediaFile(file, { tenantDbName }));
  }
  return uploaded;
}

function serializeEventRow(event, registrationCount = 0) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    location: event.location || '',
    sections: Array.isArray(event.sections) ? event.sections : [],
    type: event.type,
    mode: event.mode,
    scheduledAt: event.scheduledAt,
    durationMinutes: event.durationMinutes,
    isPublished: event.isPublished,
    status: event.status || 'active',
    media: normalizePortalEventMedia(event.media),
    source: event.source,
    tenantDbName: event.tenantDbName,
    createdById: event.createdById,
    createdByName: event.createdByName,
    createdByEmail: event.createdByEmail,
    registrationCount,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}
