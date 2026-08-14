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

  return events.map((event) => serializePublishedEvent(event));
}

function normalizeEventMedia(media) {
  if (Array.isArray(media)) return media.filter((item) => item && item.url);
  if (typeof media === 'string') {
    try {
      const parsed = JSON.parse(media);
      return Array.isArray(parsed) ? parsed.filter((item) => item && item.url) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function serializePublishedEvent(event) {
  const tokenCost = Math.max(0, Number(event.tokenCost) || 0);
  const accessType =
    String(event.accessType || '').toLowerCase() === 'purchase' || tokenCost > 0
      ? 'purchase'
      : 'free';
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
    media: normalizeEventMedia(event.media),
    registrationCount: event._count?.registrations ?? 0,
    accessType,
    tokenCost: accessType === 'free' ? 0 : tokenCost,
    isFree: accessType === 'free' || tokenCost <= 0,
    ctaLabel: String(event.ctaLabel || '').trim() || 'Join',
  };
}

async function getPublishedEventById(eventId) {
  const event = await prisma.lmsEvent.findFirst({
    where: { id: String(eventId), isPublished: true, NOT: { status: 'cancelled' } },
    include: { _count: { select: { registrations: true } } },
  });

  if (!event) return null;

  return serializePublishedEvent(event);
}

module.exports = {
  listPublishedEvents,
  getPublishedEventById,
};
