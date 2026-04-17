const { prisma } = require('../../lib/prisma');

async function fetchEvents(userId, filters) {
  const { tab, search, type, tag } = filters;
  const where = { isPublished: true };

  const now = new Date();

  if (tab === 'past') {
    where.scheduledAt = { lt: now };
  } else if (tab === 'upcoming' || !tab) {
    where.scheduledAt = { gte: now };
  }

  if (search) {
    where.title = { contains: search, mode: 'insensitive' };
  }
  if (type) where.type = type;
  if (tag) where.tags = { has: tag };

  let events = await prisma.lmsEvent.findMany({
    where,
    orderBy: { scheduledAt: 'asc' },
    include: {
      registrations: { where: { userId } }
    }
  });

  if (tab === 'registered') {
    events = events.filter(e => e.registrations.length > 0);
  }

  const careerPath = await prisma.lmsCareerPath.findUnique({ where: { userId } });
  const plannedIds = new Set(
    (careerPath?.roadmapItems || [])
      .filter(item => item.targetType === 'event')
      .map(item => item.targetId)
  );

  return events.map(event => {
    const { registrations, ...rest } = event;
    const isRegistered = registrations.length > 0;
    return {
      ...rest,
      isRegistered,
      registeredAt: isRegistered ? registrations[0].registeredAt : null,
      plannedInCareerPath: plannedIds.has(event.id)
    };
  });
}

async function fetchEventDetail(userId, eventId) {
  const event = await prisma.lmsEvent.findUnique({
    where: { id: eventId },
    include: {
      registrations: { where: { userId } }
    }
  });

  if (!event) return null;

  const careerPath = await prisma.lmsCareerPath.findUnique({ where: { userId } });
  const plannedIds = new Set(
    (careerPath?.roadmapItems || [])
      .filter(item => item.targetType === 'event')
      .map(item => item.targetId)
  );

  const relatedCourses = await prisma.lmsCourse.findMany({
    where: {
      isPublished: true,
      tags: { hasSome: event.tags }
    },
    take: 3
  });

  const relatedQuizzes = await prisma.lmsQuiz.findMany({
    where: {
      isPublished: true,
      skillTags: { hasSome: event.tags }
    },
    take: 3
  });

  const { registrations, ...rest } = event;
  const isRegistered = registrations.length > 0;

  return {
    ...rest,
    isRegistered,
    registeredAt: isRegistered ? registrations[0].registeredAt : null,
    plannedInCareerPath: plannedIds.has(event.id),
    relatedCourses,
    relatedQuizzes
  };
}

async function registerForEvent(userId, eventId) {
  const existing = await prisma.lmsEventRegistration.findUnique({
    where: { userId_eventId: { userId, eventId } }
  });

  if (!existing) {
    await prisma.lmsEventRegistration.create({
      data: { userId, eventId }
    });
  }

  return fetchEventDetail(userId, eventId);
}

async function unregisterFromEvent(userId, eventId) {
  const existing = await prisma.lmsEventRegistration.findUnique({
    where: { userId_eventId: { userId, eventId } }
  });

  if (existing) {
    await prisma.lmsEventRegistration.delete({
      where: { id: existing.id }
    });
  }

  return { isRegistered: false };
}

async function addEventToPlan(userId, eventId) {
  let careerPath = await prisma.lmsCareerPath.findUnique({ where: { userId } });
  
  if (!careerPath) {
    careerPath = await prisma.lmsCareerPath.create({
      data: { userId, roadmapItems: [] }
    });
  }

  const roadmapItems = careerPath.roadmapItems || [];
  const exists = roadmapItems.some(i => i.targetType === 'event' && i.targetId === eventId);
  
  if (!exists) {
    const newItem = {
      id: `rt_${Date.now()}`,
      title: `Attend Event`,
      phase: careerPath.currentPhase,
      status: 'planned',
      targetType: 'event',
      targetId: eventId,
      targetRoute: `/lms/events/${eventId}`,
      reason: 'User manual addition.'
    };
    
    await prisma.lmsCareerPath.update({
      where: { userId },
      data: { roadmapItems: [...roadmapItems, newItem] }
    });
  }

  return { plannedInCareerPath: true };
}

module.exports = {
  fetchEvents,
  fetchEventDetail,
  registerForEvent,
  unregisterFromEvent,
  addEventToPlan
};
