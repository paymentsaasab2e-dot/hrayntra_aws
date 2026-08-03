const { prisma } = require('../lib/prisma');

async function listPublishedEvents(filters = {}) {
  const { search, scope = 'upcoming' } = filters;
  const where = {
    isPublished: true,
    NOT: { status: 'cancelled' },
  };
  const now = new Date();

  if (scope === 'upcoming') {
    where.scheduledAt = { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) };
  } else if (scope === 'past') {
    where.scheduledAt = { lt: now };
  }

  if (search) {
    where.OR = [
      { title: { contains: String(search), mode: 'insensitive' } },
      { description: { contains: String(search), mode: 'insensitive' } },
      { location: { contains: String(search), mode: 'insensitive' } },
    ];
  }

  const events = await prisma.lmsEvent.findMany({
    where,
    orderBy: { scheduledAt: 'asc' },
    include: { _count: { select: { registrations: true } } },
  });

  return events.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    location: event.location || '',
    sections: Array.isArray(event.sections) ? event.sections : [],
    type: event.type,
    mode: event.mode,
    scheduledAt: event.scheduledAt,
    durationMinutes: event.durationMinutes,
    hostName: event.hostName,
    source: event.source,
    createdByName: event.createdByName,
    media: Array.isArray(event.media) ? event.media : [],
    registrationCount: event._count?.registrations ?? 0,
  }));
}

async function getPublishedEventById(eventId) {
  const event = await prisma.lmsEvent.findFirst({
    where: { id: String(eventId), isPublished: true, NOT: { status: 'cancelled' } },
    include: { _count: { select: { registrations: true } } },
  });

  if (!event) return null;

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    location: event.location || '',
    sections: Array.isArray(event.sections) ? event.sections : [],
    type: event.type,
    mode: event.mode,
    meetingUrl: event.meetingUrl,
    scheduledAt: event.scheduledAt,
    durationMinutes: event.durationMinutes,
    capacity: event.capacity,
    hostName: event.hostName,
    source: event.source,
    createdByName: event.createdByName,
    media: Array.isArray(event.media) ? event.media : [],
    registrationCount: event._count?.registrations ?? 0,
  };
}

module.exports = {
  listPublishedEvents,
  getPublishedEventById,
};
