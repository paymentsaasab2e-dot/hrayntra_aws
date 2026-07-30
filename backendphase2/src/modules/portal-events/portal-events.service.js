import { getJobPortalPrismaClient } from '../../config/prisma.js';

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
  const where = {
    id: String(eventId),
    createdById: String(createdById),
    source: String(source),
  };
  if (tenantDbName) where.tenantDbName = String(tenantDbName);

  const event = await portalDb().lmsEvent.findFirst({ where });
  if (!event) {
    const err = new Error('Event not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

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
