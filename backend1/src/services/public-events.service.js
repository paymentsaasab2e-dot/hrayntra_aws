const { prisma } = require('../lib/prisma');

async function listPublishedEvents(filters = {}) {
  const { search } = filters;
  const where = {
    isPublished: true,
    scheduledAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24) },
  };

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
    registrationCount: event._count?.registrations ?? 0,
  }));
}

async function getPublishedEventById(eventId) {
  const event = await prisma.lmsEvent.findFirst({
    where: { id: String(eventId), isPublished: true },
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
    registrationCount: event._count?.registrations ?? 0,
  };
}

module.exports = {
  listPublishedEvents,
  getPublishedEventById,
};
