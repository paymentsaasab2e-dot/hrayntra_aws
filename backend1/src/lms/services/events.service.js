const { prisma } = require('../../lib/prisma');
const { postPhase2Internal } = require('../../utils/phase2InternalApi.util');

function eventAccessFields(event) {
  const tokenCost = Math.max(0, Number(event?.tokenCost) || 0);
  const accessType =
    String(event?.accessType || '').toLowerCase() === 'purchase' || tokenCost > 0
      ? 'purchase'
      : 'free';
  return {
    accessType,
    tokenCost: accessType === 'free' ? 0 : tokenCost,
    isFree: accessType === 'free' || tokenCost <= 0,
    ctaLabel: String(event?.ctaLabel || '').trim() || 'Join',
  };
}

function withAccess(event) {
  return { ...event, ...eventAccessFields(event) };
}

async function creditEventCreator(event, amount) {
  if (!event || !(Number(amount) > 0)) return { credited: 0 };
  try {
    const result = await postPhase2Internal('event-token-payout', {
      eventId: event.id,
      amount,
      tokenCost: amount,
      source: event.source,
      tenantDbName: event.tenantDbName,
      createdByEmail: event.createdByEmail,
      createdById: event.createdById,
    });
    if (!result.ok) {
      console.warn('[events] creator payout failed', result.status, result.data?.message || result.data);
      return { credited: 0, pending: true, error: result.data?.message || 'payout_failed' };
    }
    return { credited: amount, ...(result.data?.data || {}) };
  } catch (err) {
    console.warn('[events] creator payout error', err?.message || err);
    return { credited: 0, pending: true, error: err?.message || String(err) };
  }
}

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
      registrations: { where: { userId } },
    },
  });

  if (tab === 'registered') {
    events = events.filter((e) => e.registrations.length > 0);
  }

  const careerPath = await prisma.lmsCareerPath.findUnique({ where: { userId } });
  const plannedIds = new Set(
    (careerPath?.roadmapItems || [])
      .filter((item) => item.targetType === 'event')
      .map((item) => item.targetId),
  );

  return events.map((event) => {
    const { registrations, ...rest } = event;
    const isRegistered = registrations.length > 0;
    return withAccess({
      ...rest,
      isRegistered,
      registeredAt: isRegistered ? registrations[0].registeredAt : null,
      plannedInCareerPath: plannedIds.has(event.id),
    });
  });
}

async function fetchEventDetail(userId, eventId) {
  const event = await prisma.lmsEvent.findUnique({
    where: { id: eventId },
    include: {
      registrations: { where: { userId } },
      _count: { select: { registrations: true } },
    },
  });

  if (!event) return null;

  const careerPath = await prisma.lmsCareerPath.findUnique({ where: { userId } });
  const plannedIds = new Set(
    (careerPath?.roadmapItems || [])
      .filter((item) => item.targetType === 'event')
      .map((item) => item.targetId),
  );

  const { registrations, _count, ...rest } = event;
  const isRegistered = registrations.length > 0;

  return withAccess({
    ...rest,
    isRegistered,
    registeredAt: isRegistered ? registrations[0].registeredAt : null,
    plannedInCareerPath: plannedIds.has(event.id),
    registrationCount: _count?.registrations ?? 0,
  });
}

async function registerForEvent(userId, eventId) {
  const existing = await prisma.lmsEventRegistration.findUnique({
    where: { userId_eventId: { userId, eventId } },
  });

  if (existing) {
    return {
      ...(await fetchEventDetail(userId, eventId)),
      alreadyRegistered: true,
      tokenSpend: null,
    };
  }

  const event = await prisma.lmsEvent.findUnique({ where: { id: eventId } });
  if (!event || !event.isPublished || String(event.status || 'active') === 'cancelled') {
    const err = new Error('Event not found');
    err.status = 404;
    throw err;
  }

  const access = eventAccessFields(event);
  let tokenSpend = null;

  if (access.tokenCost > 0) {
    const tokenService = require('../../services/token.service');
    tokenSpend = await tokenService.spendTokensAmount(
      userId,
      access.tokenCost,
      `lms.events.join.${eventId}`,
      `Joined event: ${event.title} (${access.tokenCost} tokens)`,
    );
  }

  try {
    await prisma.lmsEventRegistration.create({
      data: {
        userId,
        eventId,
        tokensSpent: tokenSpend?.spent || 0,
        paidAt: tokenSpend?.spent ? new Date() : null,
        payoutStatus: tokenSpend?.spent ? 'pending' : 'none',
      },
    });
  } catch (createErr) {
    if (tokenSpend?.spent) {
      try {
        const tokenService = require('../../services/token.service');
        await tokenService.grantTokensAmount(
          userId,
          tokenSpend.spent,
          `lms.events.refund.${eventId}`,
          `Refund for failed event join: ${event.title}`,
        );
      } catch (refundErr) {
        console.error('[events] refund after failed registration', refundErr?.message || refundErr);
      }
    }
    throw createErr;
  }

  if (tokenSpend?.spent) {
    const payout = await creditEventCreator(event, tokenSpend.spent);
    await prisma.lmsEventRegistration.updateMany({
      where: { userId, eventId },
      data: { payoutStatus: payout?.credited ? 'credited' : 'pending' },
    });
  }

  return {
    ...(await fetchEventDetail(userId, eventId)),
    alreadyRegistered: false,
    tokenSpend,
  };
}

async function unregisterFromEvent(userId, eventId) {
  const existing = await prisma.lmsEventRegistration.findUnique({
    where: { userId_eventId: { userId, eventId } },
  });

  if (existing) {
    if (Number(existing.tokensSpent) > 0) {
      const err = new Error('Paid event registrations cannot be cancelled');
      err.status = 400;
      err.code = 'PAID_EVENT_LOCKED';
      throw err;
    }
    await prisma.lmsEventRegistration.delete({
      where: { id: existing.id },
    });
  }

  return { isRegistered: false };
}

async function addEventToPlan(userId, eventId) {
  let careerPath = await prisma.lmsCareerPath.findUnique({ where: { userId } });

  if (!careerPath) {
    careerPath = await prisma.lmsCareerPath.create({
      data: { userId, roadmapItems: [] },
    });
  }

  const roadmapItems = careerPath.roadmapItems || [];
  const exists = roadmapItems.some((i) => i.targetType === 'event' && i.targetId === eventId);

  if (!exists) {
    const newItem = {
      id: `rt_${Date.now()}`,
      title: `Attend Event`,
      phase: careerPath.currentPhase,
      status: 'planned',
      targetType: 'event',
      targetId: eventId,
      targetRoute: `/lms/events/${eventId}`,
      reason: 'User manual addition.',
    };

    await prisma.lmsCareerPath.update({
      where: { userId },
      data: { roadmapItems: [...roadmapItems, newItem] },
    });
  }

  return { plannedInCareerPath: true };
}

module.exports = {
  fetchEvents,
  fetchEventDetail,
  registerForEvent,
  unregisterFromEvent,
  addEventToPlan,
};
