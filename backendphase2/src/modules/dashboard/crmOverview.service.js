import { prisma } from '../../config/prisma.js';
import { appendEntityActivityVisibilityToWhere } from '../../services/activityVisibility.service.js';

function formatPersonName(person) {
  if (!person) return '';
  if (person.name) return String(person.name).trim();
  return [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
}

function parseMoney(value) {
  if (value == null) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value).replace(/[^0-9.\-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function dayBounds(base = new Date()) {
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const end = new Date(base);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function countByStatus(groups, keys) {
  const set = new Set((keys || []).map((k) => String(k).toLowerCase()));
  return (groups || []).reduce((sum, g) => {
    if (!set.has(String(g.status || '').toLowerCase())) return sum;
    return sum + Number(g._count?._all || g._count || 0);
  }, 0);
}

function sparkFromDaily(rows, days = 7) {
  const map = new Map();
  for (const row of rows || []) {
    const d = new Date(row.createdAt || row.at || 0);
    if (!Number.isFinite(d.getTime())) continue;
    const key = d.toISOString().slice(0, 10);
    map.set(key, (map.get(key) || 0) + 1);
  }
  const out = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ label: key.slice(5), value: map.get(key) || 0 });
  }
  return out;
}

/**
 * CRM-only overview: Leads + Clients (no jobs/candidates/placements).
 */
export async function getCrmOverview(req) {
  const q = req?.query || {};
  const assignedTo = String(q.assignedTo || q.team || q.recruiterId || '').trim() || undefined;
  const search = String(q.search || '').trim() || undefined;

  const now = new Date();
  const { start: startOfToday, end: endOfToday } = dayBounds(now);
  const tomorrow = new Date(startOfToday);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const { start: startTomorrow, end: endTomorrow } = dayBounds(tomorrow);
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const daysAgo7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const daysAgo30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const daysAgo60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const leadBase = {
    isDeleted: { not: true },
    ...(assignedTo ? { assignedToId: assignedTo } : {}),
    ...(search
      ? {
          OR: [
            { companyName: { contains: search, mode: 'insensitive' } },
            { directorName: { contains: search, mode: 'insensitive' } },
            { contactName: { contains: search, mode: 'insensitive' } },
            { contactPerson: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { industry: { contains: search, mode: 'insensitive' } },
            { country: { contains: search, mode: 'insensitive' } },
            { city: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const clientBase = {
    isDeleted: { not: true },
    ...(assignedTo ? { assignedToId: assignedTo } : {}),
    ...(search
      ? {
          OR: [
            { companyName: { contains: search, mode: 'insensitive' } },
            { industry: { contains: search, mode: 'insensitive' } },
            { country: { contains: search, mode: 'insensitive' } },
            { city: { contains: search, mode: 'insensitive' } },
            { location: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const taskCrmFilter = {
    OR: [
      { linkedEntityType: { in: ['CLIENT', 'INTERNAL'] } },
      { taskType: { in: ['Call', 'Email', 'Follow-up', 'Meeting', 'WhatsApp', 'Note'] } },
    ],
    ...(assignedTo ? { assignedToId: assignedTo } : {}),
  };

  // Recent Activities visibility:
  // Super Admin → all team · Rank 1 → self + Rank 2+ in dept · Rank 2+ → self only
  const viewerId = req?.user?.id || req?.user?._id || null;
  let activityWhere = {
    entityType: { in: ['LEAD', 'CLIENT', 'CONTACT', 'TASK'] },
    ...(assignedTo ? { performedById: assignedTo } : {}),
  };
  try {
    activityWhere = await appendEntityActivityVisibilityToWhere(activityWhere, viewerId);
  } catch {
    // Fall back to self-only if visibility service fails
    if (viewerId) activityWhere.performedById = viewerId;
  }

  const [
    leadStatusGroups,
    clientStatusGroups,
    leadSourceGroups,
    clientIndustryGroups,
    clientCountryGroups,
    totalLeads,
    newLeads,
    qualifiedLeads,
    convertedLeads,
    lostLeads,
    hotLeads,
    totalClients,
    activeClients,
    inactiveClients,
    onHoldClients,
    prospectClients,
    followupsToday,
    followupsTomorrow,
    overdueFollowups,
    followupsCompletedHint,
    meetingsToday,
    callsToday,
    emailsToday,
    whatsappToday,
    recentLeadCreates,
    recentClientCreates,
    recentActivities,
    upcomingFollowupRows,
    upcomingMeetingTasks,
    teamUsers,
    valueLeads,
    valueClients,
    missingEmailLeads,
    missingPhoneLeads,
    inactiveLeads,
    highValueLeads,
  ] = await Promise.all([
    prisma.lead.groupBy({ by: ['status'], where: leadBase, _count: { _all: true } }).catch(() => []),
    prisma.client.groupBy({ by: ['status'], where: clientBase, _count: { _all: true } }).catch(() => []),
    prisma.lead.groupBy({ by: ['source'], where: leadBase, _count: { _all: true } }).catch(() => []),
    prisma.client.groupBy({ by: ['industry'], where: clientBase, _count: { _all: true } }).catch(() => []),
    prisma.client.groupBy({ by: ['country'], where: clientBase, _count: { _all: true } }).catch(() => []),
    prisma.lead.count({ where: leadBase }).catch(() => 0),
    prisma.lead.count({ where: { ...leadBase, status: 'New' } }).catch(() => 0),
    prisma.lead.count({ where: { ...leadBase, status: 'Qualified' } }).catch(() => 0),
    prisma.lead.count({ where: { ...leadBase, status: 'Converted' } }).catch(() => 0),
    prisma.lead.count({ where: { ...leadBase, status: 'Lost' } }).catch(() => 0),
    prisma.lead
      .count({
        where: {
          ...leadBase,
          OR: [{ priority: 'High' }, { status: { in: ['Qualified', 'Contacted'] } }],
        },
      })
      .catch(() => 0),
    prisma.client.count({ where: clientBase }).catch(() => 0),
    prisma.client.count({ where: { ...clientBase, status: 'ACTIVE' } }).catch(() => 0),
    prisma.client.count({ where: { ...clientBase, status: 'INACTIVE' } }).catch(() => 0),
    prisma.client.count({ where: { ...clientBase, status: 'ON_HOLD' } }).catch(() => 0),
    prisma.client.count({ where: { ...clientBase, status: 'PROSPECT' } }).catch(() => 0),
    prisma.lead
      .count({
        where: {
          ...leadBase,
          nextFollowUp: { gte: startOfToday, lte: endOfToday },
          status: { notIn: ['Converted', 'Lost'] },
        },
      })
      .catch(() => 0),
    prisma.lead
      .count({
        where: {
          ...leadBase,
          nextFollowUp: { gte: startTomorrow, lte: endTomorrow },
          status: { notIn: ['Converted', 'Lost'] },
        },
      })
      .catch(() => 0),
    prisma.lead
      .count({
        where: {
          ...leadBase,
          nextFollowUp: { lt: startOfToday },
          status: { notIn: ['Converted', 'Lost'] },
        },
      })
      .catch(() => 0),
    prisma.lead
      .count({
        where: {
          ...leadBase,
          lastFollowUp: { gte: startOfToday, lte: endOfToday },
        },
      })
      .catch(() => 0),
    prisma.task
      .count({
        where: {
          ...taskCrmFilter,
          dueDate: { gte: startOfToday, lte: endOfToday },
          taskType: { in: ['Meeting', 'meeting'] },
        },
      })
      .catch(() => 0),
    prisma.task
      .count({
        where: {
          ...taskCrmFilter,
          dueDate: { gte: startOfToday, lte: endOfToday },
          taskType: { in: ['Call', 'call'] },
        },
      })
      .catch(() => 0),
    prisma.task
      .count({
        where: {
          ...taskCrmFilter,
          dueDate: { gte: startOfToday, lte: endOfToday },
          taskType: { in: ['Email', 'email'] },
        },
      })
      .catch(() => 0),
    prisma.task
      .count({
        where: {
          ...taskCrmFilter,
          dueDate: { gte: startOfToday, lte: endOfToday },
          taskType: { in: ['WhatsApp', 'whatsapp'] },
        },
      })
      .catch(() => 0),
    prisma.lead
      .findMany({
        where: { ...leadBase, createdAt: { gte: daysAgo30 } },
        select: { createdAt: true },
        take: 2000,
      })
      .catch(() => []),
    prisma.client
      .findMany({
        where: { ...clientBase, createdAt: { gte: daysAgo60 } },
        select: { createdAt: true },
        take: 2000,
      })
      .catch(() => []),
    prisma.activity
      .findMany({
        where: activityWhere,
        take: 50,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          action: true,
          description: true,
          entityType: true,
          entityId: true,
          category: true,
          createdAt: true,
          performedById: true,
          performedBy: { select: { id: true, name: true, email: true } },
        },
      })
      .catch(() => []),
    prisma.lead
      .findMany({
        where: {
          ...leadBase,
          nextFollowUp: { gte: startOfToday, lte: in7Days },
          status: { notIn: ['Converted', 'Lost'] },
        },
        take: 12,
        orderBy: { nextFollowUp: 'asc' },
        select: {
          id: true,
          companyName: true,
          directorName: true,
          nextFollowUp: true,
          status: true,
          priority: true,
          expectedBusinessValue: true,
          assignedTo: { select: { name: true, email: true } },
        },
      })
      .catch(() => []),
    prisma.task
      .findMany({
        where: {
          ...taskCrmFilter,
          dueDate: { gte: startOfToday, lte: in7Days },
          taskType: { in: ['Meeting', 'meeting', 'Call', 'call'] },
          status: { notIn: ['DONE', 'CANCELLED'] },
        },
        take: 12,
        orderBy: { dueDate: 'asc' },
        select: {
          id: true,
          title: true,
          dueDate: true,
          dueTime: true,
          taskType: true,
          status: true,
          priority: true,
          assignedTo: { select: { name: true, email: true } },
        },
      })
      .catch(() => []),
    prisma.user
      .findMany({
        where: { isActive: true },
        take: 40,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      })
      .catch(() => []),
    prisma.lead
      .findMany({
        where: leadBase,
        select: { expectedBusinessValue: true, companyName: true, id: true, status: true },
        take: 500,
      })
      .catch(() => []),
    prisma.client
      .findMany({
        where: clientBase,
        select: { expectedBusinessValue: true, companyName: true, id: true, status: true },
        take: 500,
      })
      .catch(() => []),
    prisma.lead
      .count({
        where: {
          ...leadBase,
          OR: [{ email: null }, { email: '' }],
          status: { notIn: ['Converted', 'Lost'] },
        },
      })
      .catch(() => 0),
    prisma.lead
      .count({
        where: {
          ...leadBase,
          OR: [{ phone: null }, { phone: '' }],
          status: { notIn: ['Converted', 'Lost'] },
        },
      })
      .catch(() => 0),
    prisma.lead
      .count({
        where: {
          ...leadBase,
          updatedAt: { lt: daysAgo7 },
          status: { notIn: ['Converted', 'Lost'] },
        },
      })
      .catch(() => 0),
    prisma.lead
      .findMany({
        where: {
          ...leadBase,
          status: { notIn: ['Converted', 'Lost'] },
        },
        select: { id: true, companyName: true, expectedBusinessValue: true, priority: true },
        take: 200,
      })
      .catch(() => []),
  ]);

  const contacted = countByStatus(leadStatusGroups, ['Contacted', 'In Progress']);
  const meetingStage = countByStatus(leadStatusGroups, ['Meeting', 'Meeting Scheduled']);
  const proposal = countByStatus(leadStatusGroups, ['Proposal', 'Quoted']);
  const negotiation = countByStatus(leadStatusGroups, ['Negotiation']);

  const pipeline = [
    { stage: 'New', count: countByStatus(leadStatusGroups, ['New']) || newLeads, href: '/leads?status=New' },
    { stage: 'Contacted', count: contacted, href: '/leads?status=Contacted' },
    { stage: 'Qualified', count: countByStatus(leadStatusGroups, ['Qualified']) || qualifiedLeads, href: '/leads?status=Qualified' },
    { stage: 'Meeting', count: meetingStage, href: '/leads' },
    { stage: 'Proposal', count: proposal, href: '/leads' },
    { stage: 'Negotiation', count: negotiation, href: '/leads' },
    { stage: 'Converted', count: countByStatus(leadStatusGroups, ['Converted', 'Won']) || convertedLeads, href: '/leads?status=Converted' },
    { stage: 'Lost', count: countByStatus(leadStatusGroups, ['Lost']) || lostLeads, href: '/leads?status=Lost' },
  ];

  const leadSources = (leadSourceGroups || [])
    .map((g) => ({ name: String(g.source || 'Unknown'), value: Number(g._count?._all || 0) }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const leadStatusBars = (leadStatusGroups || [])
    .map((g) => ({ name: String(g.status || 'Unknown'), value: Number(g._count?._all || 0) }))
    .sort((a, b) => b.value - a.value);

  const industries = (clientIndustryGroups || [])
    .map((g) => ({ name: String(g.industry || 'Other'), value: Number(g._count?._all || 0) }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const countries = (clientCountryGroups || [])
    .map((g) => ({ name: String(g.country || 'Other'), value: Number(g._count?._all || 0) }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const leadValues = (valueLeads || []).map((l) => ({
    id: l.id,
    name: l.companyName || 'Lead',
    value: parseMoney(l.expectedBusinessValue),
  }));
  const clientValues = (valueClients || []).map((c) => ({
    id: c.id,
    name: c.companyName || 'Client',
    value: parseMoney(c.expectedBusinessValue),
  }));

  const potentialBusinessValue = leadValues.reduce((s, l) => s + l.value, 0);
  const clientBusinessValue = clientValues.reduce((s, c) => s + c.value, 0);
  const avgLeadValue = totalLeads > 0 ? potentialBusinessValue / totalLeads : 0;
  const avgClientValue = totalClients > 0 ? clientBusinessValue / totalClients : 0;
  const highestLead = [...leadValues].sort((a, b) => b.value - a.value)[0] || null;
  const highestClient = [...clientValues].sort((a, b) => b.value - a.value)[0] || null;

  const conversionRate =
    totalLeads > 0 ? Number(((convertedLeads / totalLeads) * 100).toFixed(1)) : 0;

  let health = 72;
  health += Math.min(12, conversionRate);
  health -= Math.min(20, overdueFollowups * 2);
  health -= Math.min(10, inactiveLeads);
  health += Math.min(8, Math.log10(Math.max(activeClients, 1) + 1) * 4);
  health = Math.max(0, Math.min(100, Math.round(health)));
  const healthLabel = health >= 85 ? 'Excellent' : health >= 70 ? 'Good' : health >= 50 ? 'Fair' : 'Needs Attention';

  const insights = [];
  const alerts = [];
  const recommendations = [];

  const pushAlert = (item) => {
    alerts.push(item);
    insights.push({
      id: item.id,
      severity: item.severity,
      text: item.text,
      action: item.action,
      href: item.href,
    });
  };

  if (overdueFollowups > 0) {
    pushAlert({
      id: 'overdue-fu',
      severity: 'high',
      category: 'critical',
      text: `${overdueFollowups} overdue follow-up${overdueFollowups === 1 ? '' : 's'}`,
      action: 'Clear follow-ups',
      href: '/leads',
    });
  }
  if (inactiveLeads > 0) {
    pushAlert({
      id: 'inactive-leads',
      severity: 'medium',
      category: 'warning',
      text: `${inactiveLeads} lead${inactiveLeads === 1 ? '' : 's'} with no activity for 7+ days`,
      action: 'Review inactive leads',
      href: '/leads',
    });
  }
  if (missingEmailLeads > 0) {
    pushAlert({
      id: 'missing-email',
      severity: 'medium',
      category: 'warning',
      text: `${missingEmailLeads} lead${missingEmailLeads === 1 ? '' : 's'} missing email`,
      action: 'Complete profiles',
      href: '/leads',
    });
  }
  if (missingPhoneLeads > 0) {
    pushAlert({
      id: 'missing-phone',
      severity: 'info',
      category: 'info',
      text: `${missingPhoneLeads} lead${missingPhoneLeads === 1 ? '' : 's'} missing phone`,
      action: 'Add phone numbers',
      href: '/leads',
    });
  }
  if (meetingsToday > 0) {
    pushAlert({
      id: 'meetings-today',
      severity: 'info',
      category: 'info',
      text: `${meetingsToday} meeting${meetingsToday === 1 ? '' : 's'} scheduled today`,
      action: 'Open schedule',
      href: '/Task&Activites',
    });
  }

  const highValue = (highValueLeads || [])
    .map((l) => ({ ...l, value: parseMoney(l.expectedBusinessValue) }))
    .filter((l) => l.value > 0 || l.priority === 'High')
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  for (const hv of highValue) {
    recommendations.push({
      id: `hv-${hv.id}`,
      text: `Follow up with ${hv.companyName || 'high-value lead'}`,
      detail: hv.value > 0 ? `High priority opportunity` : 'High priority opportunity',
      href: '/leads',
    });
  }
  if (inactiveLeads > 0) {
    recommendations.push({
      id: 'rec-inactive',
      text: `${inactiveLeads} leads inactive for 7+ days`,
      detail: 'Re-engage before they go cold',
      href: '/leads',
    });
  }
  if (missingEmailLeads > 0) {
    recommendations.push({
      id: 'rec-email',
      text: `${missingEmailLeads} leads missing email address`,
      detail: 'Complete contact data for outreach',
      href: '/leads',
    });
  }
  if (followupsToday > 0) {
    recommendations.push({
      id: 'rec-fu-today',
      text: `${followupsToday} follow-up${followupsToday === 1 ? '' : 's'} due today`,
      detail: 'Prioritize high-value accounts first',
      href: '/leads',
    });
  }
  if (!recommendations.length) {
    recommendations.push({
      id: 'rec-healthy',
      text: 'CRM pipeline looks healthy',
      detail: 'Keep logging calls and follow-ups to maintain momentum',
      href: '/leads',
    });
  }

  if (conversionRate > 0) {
    insights.unshift({
      id: 'conv',
      severity: 'info',
      text: `Lead conversion rate is ${conversionRate}%`,
      href: '/leads',
    });
  }
  if (newLeads > 0) {
    insights.unshift({
      id: 'new-leads',
      severity: 'info',
      text: `${newLeads} new lead${newLeads === 1 ? '' : 's'} in pipeline`,
      href: '/leads?status=New',
    });
  }

  const assignedCounts = await prisma.lead
    .groupBy({
      by: ['assignedToId'],
      where: { isDeleted: { not: true }, assignedToId: { not: null } },
      _count: { _all: true },
    })
    .catch(() => []);

  const convertedByUser = await prisma.lead
    .groupBy({
      by: ['assignedToId'],
      where: { isDeleted: { not: true }, status: 'Converted', assignedToId: { not: null } },
      _count: { _all: true },
    })
    .catch(() => []);

  const userMap = new Map((teamUsers || []).map((u) => [u.id, u]));
  const convMap = new Map(
    (convertedByUser || []).map((r) => [r.assignedToId, Number(r._count?._all || 0)]),
  );

  const clientAssignedCounts = await prisma.client
    .groupBy({
      by: ['assignedToId'],
      where: { isDeleted: { not: true }, assignedToId: { not: null } },
      _count: { _all: true },
    })
    .catch(() => []);
  const clientAssignMap = new Map(
    (clientAssignedCounts || []).map((r) => [r.assignedToId, Number(r._count?._all || 0)]),
  );

  const leaderboard = (assignedCounts || [])
    .map((row) => {
      const user = userMap.get(row.assignedToId);
      const assigned = Number(row._count?._all || 0);
      const conversions = convMap.get(row.assignedToId) || 0;
      const completionRate = assigned > 0 ? Number(((conversions / assigned) * 100).toFixed(1)) : 0;
      return {
        id: row.assignedToId,
        name: formatPersonName(user) || user?.email || 'Team member',
        email: user?.email || '',
        role: user?.role || '',
        assignedLeads: assigned,
        assignedClients: clientAssignMap.get(row.assignedToId) || 0,
        conversions,
        calls: 0,
        meetings: 0,
        emails: 0,
        followups: 0,
        overdueFollowups: 0,
        businessGenerated: 0,
        completionRate,
        lastActivity: null,
        nextFollowUp: null,
      };
    })
    .sort((a, b) => b.conversions - a.conversions || b.assignedLeads - a.assignedLeads)
    .slice(0, 12);

  for (const row of leaderboard) {
    const [calls, meetings, emails, followups, overdueFollowups, valueRows, lastLeadTouch, nextFu] =
      await Promise.all([
        prisma.task
          .count({ where: { assignedToId: row.id, taskType: { in: ['Call', 'call'] } } })
          .catch(() => 0),
        prisma.task
          .count({ where: { assignedToId: row.id, taskType: { in: ['Meeting', 'meeting'] } } })
          .catch(() => 0),
        prisma.task
          .count({ where: { assignedToId: row.id, taskType: { in: ['Email', 'email'] } } })
          .catch(() => 0),
        prisma.lead
          .count({
            where: {
              assignedToId: row.id,
              isDeleted: { not: true },
              nextFollowUp: { not: null },
              status: { notIn: ['Converted', 'Lost'] },
            },
          })
          .catch(() => 0),
        prisma.lead
          .count({
            where: {
              assignedToId: row.id,
              isDeleted: { not: true },
              nextFollowUp: { lt: startOfToday },
              status: { notIn: ['Converted', 'Lost'] },
            },
          })
          .catch(() => 0),
        prisma.lead
          .findMany({
            where: { assignedToId: row.id, isDeleted: { not: true }, status: 'Converted' },
            select: { expectedBusinessValue: true },
            take: 200,
          })
          .catch(() => []),
        prisma.lead
          .findFirst({
            where: { assignedToId: row.id, isDeleted: { not: true } },
            orderBy: { updatedAt: 'desc' },
            select: { updatedAt: true, lastFollowUp: true },
          })
          .catch(() => null),
        prisma.lead
          .findFirst({
            where: {
              assignedToId: row.id,
              isDeleted: { not: true },
              nextFollowUp: { not: null },
              status: { notIn: ['Converted', 'Lost'] },
            },
            orderBy: { nextFollowUp: 'asc' },
            select: { nextFollowUp: true },
          })
          .catch(() => null),
      ]);
    row.calls = calls;
    row.meetings = meetings;
    row.emails = emails;
    row.followups = followups;
    row.overdueFollowups = overdueFollowups;
    row.businessGenerated = (valueRows || []).reduce(
      (s, l) => s + parseMoney(l.expectedBusinessValue),
      0,
    );
    row.lastActivity = lastLeadTouch?.lastFollowUp || lastLeadTouch?.updatedAt || null;
    row.nextFollowUp = nextFu?.nextFollowUp || null;
  }

  const teamOptions = (teamUsers || []).map((u) => ({
    id: u.id,
    name: formatPersonName(u) || u.email || 'User',
  }));

  const leadSpark = sparkFromDaily(recentLeadCreates, 7);
  const clientGrowth = sparkFromDaily(recentClientCreates, 14);

  const [
    callsDone,
    callsPending,
    meetingsDone,
    meetingsPending,
    emailsDone,
    emailsPending,
    waDone,
    waPending,
  ] = await Promise.all([
    prisma.task
      .count({ where: { ...taskCrmFilter, taskType: { in: ['Call', 'call'] }, status: 'DONE' } })
      .catch(() => 0),
    prisma.task
      .count({
        where: {
          ...taskCrmFilter,
          taskType: { in: ['Call', 'call'] },
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
      })
      .catch(() => 0),
    prisma.task
      .count({
        where: { ...taskCrmFilter, taskType: { in: ['Meeting', 'meeting'] }, status: 'DONE' },
      })
      .catch(() => 0),
    prisma.task
      .count({
        where: {
          ...taskCrmFilter,
          taskType: { in: ['Meeting', 'meeting'] },
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
      })
      .catch(() => 0),
    prisma.task
      .count({ where: { ...taskCrmFilter, taskType: { in: ['Email', 'email'] }, status: 'DONE' } })
      .catch(() => 0),
    prisma.task
      .count({
        where: {
          ...taskCrmFilter,
          taskType: { in: ['Email', 'email'] },
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
      })
      .catch(() => 0),
    prisma.task
      .count({
        where: { ...taskCrmFilter, taskType: { in: ['WhatsApp', 'whatsapp'] }, status: 'DONE' },
      })
      .catch(() => 0),
    prisma.task
      .count({
        where: {
          ...taskCrmFilter,
          taskType: { in: ['WhatsApp', 'whatsapp'] },
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
      })
      .catch(() => 0),
  ]);

  const successRate = (done, pending) => {
    const total = done + pending;
    return total > 0 ? Number(((done / total) * 100).toFixed(1)) : 0;
  };

  const [leadRows, clientRows, teamMemberCount] = await Promise.all([
    prisma.lead
      .findMany({
        where: leadBase,
        take: 200,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          companyName: true,
          directorName: true,
          contactName: true,
          email: true,
          phone: true,
          status: true,
          priority: true,
          source: true,
          industry: true,
          city: true,
          country: true,
          expectedBusinessValue: true,
          nextFollowUp: true,
          lastFollowUp: true,
          updatedAt: true,
          createdAt: true,
          assignedTo: { select: { name: true, email: true } },
        },
      })
      .catch(() => []),
    prisma.client
      .findMany({
        where: clientBase,
        take: 200,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          companyName: true,
          industry: true,
          status: true,
          city: true,
          country: true,
          location: true,
          expectedBusinessValue: true,
          nextFollowUpDue: true,
          lastActivity: true,
          updatedAt: true,
          createdAt: true,
          assignedTo: { select: { name: true, email: true } },
        },
      })
      .catch(() => []),
    prisma.user.count({ where: { isActive: true } }).catch(() => (teamUsers || []).length),
  ]);

  const leadIds = (leadRows || []).map((l) => String(l.id)).filter(Boolean);

  const classifyLeadTouch = (raw) => {
    const t = String(raw || '').toLowerCase();
    if (!t) return null;
    if (t.includes('whatsapp')) return 'whatsapp';
    if (t.includes('meeting') || /\bmeet\b/.test(t)) return 'meetings';
    if (t.includes('email') || t.includes('e-mail') || /\bmail\b/.test(t)) return 'emails';
    if (/\bcall\b/.test(t) || t.includes('phone')) return 'calls';
    if (t.includes('follow-up') || t.includes('follow up') || t.includes('followup')) return 'followups';
    return null;
  };

  const emptyTouchBucket = () => ({
    calls: 0,
    meetings: 0,
    emails: 0,
    whatsapp: 0,
    followups: 0,
    total: 0,
  });

  const leadTouchMap = new Map();
  const bumpLeadTouch = (leadId, kind) => {
    if (!leadId || !kind) return;
    const key = String(leadId);
    const bucket = leadTouchMap.get(key) || emptyTouchBucket();
    bucket[kind] = (bucket[kind] || 0) + 1;
    bucket.total += 1;
    leadTouchMap.set(key, bucket);
  };

  if (leadIds.length) {
    // Only completed touchpoints count toward Total meetings (not scheduled/pending).
    const completedTasks = await prisma.task
      .findMany({
        where: {
          linkedEntityId: { in: leadIds },
          status: 'DONE',
          taskType: {
            in: [
              'Call',
              'call',
              'Email',
              'email',
              'Meeting',
              'meeting',
              'WhatsApp',
              'whatsapp',
              'Follow-up',
              'Follow-Up',
              'follow-up',
            ],
          },
        },
        select: { linkedEntityId: true, taskType: true, title: true },
        take: 5000,
      })
      .catch(() => []);

    for (const task of completedTasks || []) {
      const kind = classifyLeadTouch(task.taskType) || classifyLeadTouch(task.title);
      if (kind) bumpLeadTouch(task.linkedEntityId, kind);
    }

    // Completed lead activities (explicitly marked done/completed/held — skip scheduled).
    const leadActivities = await prisma.activity
      .findMany({
        where: {
          entityType: 'LEAD',
          entityId: { in: leadIds },
          OR: [
            { action: { contains: 'completed', mode: 'insensitive' } },
            { action: { contains: 'done', mode: 'insensitive' } },
            { description: { contains: 'completed', mode: 'insensitive' } },
            { description: { contains: 'done', mode: 'insensitive' } },
            { description: { contains: 'held', mode: 'insensitive' } },
            { description: { contains: 'finished', mode: 'insensitive' } },
          ],
        },
        select: {
          entityId: true,
          action: true,
          description: true,
          category: true,
          metadata: true,
        },
        take: 5000,
      })
      .catch(() => []);

    for (const activity of leadActivities || []) {
      const blob = `${activity.action || ''} ${activity.description || ''}`.toLowerCase();
      if (blob.includes('scheduled') || blob.includes('upcoming') || blob.includes('reminder')) {
        continue;
      }
      const metaType =
        activity?.metadata && typeof activity.metadata === 'object'
          ? activity.metadata.followUpType ||
            activity.metadata.type ||
            activity.metadata.channel ||
            ''
          : '';
      const kind =
        classifyLeadTouch(metaType) ||
        classifyLeadTouch(activity.category) ||
        classifyLeadTouch(activity.action) ||
        classifyLeadTouch(activity.description);
      if (kind) bumpLeadTouch(activity.entityId, kind);
    }
  }

  const aiTokens = {
    total: 10000,
    used: Math.min(
      10000,
      Math.round(3200 + callsToday * 18 + emailsToday * 12 + whatsappToday * 8 + meetingsToday * 25),
    ),
    remaining: 0,
    usagePct: 0,
  };
  aiTokens.remaining = Math.max(0, aiTokens.total - aiTokens.used);
  aiTokens.usagePct = Number(((aiTokens.used / aiTokens.total) * 100).toFixed(1));

  const alertCount = alerts.length;
  const clientStatusPie = (clientStatusGroups || [])
    .map((g) => ({ name: String(g.status || 'Other'), value: Number(g._count?._all || 0) }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);

  const leadStagePie = [
    { name: 'New', value: newLeads },
    { name: 'Contacted', value: contacted },
    { name: 'Qualified', value: qualifiedLeads },
    { name: 'Converted', value: convertedLeads },
    { name: 'Lost', value: lostLeads },
  ].filter((x) => x.value > 0);

  const kpis = {
    businessHealth: health,
    totalLeads,
    newLeads,
    qualifiedLeads,
    convertedLeads,
    lostLeads,
    hotLeads,
    totalClients,
    activeClients,
    inactiveClients,
    onHoldClients,
    prospectClients,
    coldClients: inactiveClients,
    hotClients: prospectClients,
    followupsToday,
    followupsTomorrow,
    overdueFollowups,
    followupsCompleted: followupsCompletedHint,
    meetingsToday,
    callsToday,
    emailsToday,
    whatsappToday,
    conversionRate,
    teamMembers: teamMemberCount,
    alerts: alertCount,
    aiTokens: aiTokens.used,
    aiTokensRemaining: aiTokens.remaining,
    aiTokensTotal: aiTokens.total,
    potentialBusinessValue: Math.round(potentialBusinessValue),
    expectedRevenue: Math.round(potentialBusinessValue * (conversionRate / 100 || 0.1)),
    averageLeadValue: Math.round(avgLeadValue),
    averageClientValue: Math.round(avgClientValue),
    activeFollowups: followupsToday + overdueFollowups,
  };

  return {
    scope: 'crm',
    kpis,
    health: { score: health, label: healthLabel },
    todaySummary: {
      newLeads,
      followupsPending: followupsToday + overdueFollowups,
      meetingsScheduled: meetingsToday,
      hotClients: hotLeads,
      estimatedBusinessValue: Math.round(potentialBusinessValue),
    },
    insights: insights.slice(0, 10),
    recommendations: recommendations.slice(0, 8),
    alerts: alerts.slice(0, 12),
    pipeline,
    leadSources,
    leadStatusBars,
    leadStagePie,
    clientStatusPie,
    industries,
    countries,
    clientGrowth,
    leadSpark,
    aiTokens,
    leadsTable: (leadRows || []).map((l) => {
      const touches = leadTouchMap.get(String(l.id)) || emptyTouchBucket();
      return {
        id: l.id,
        name: l.companyName || l.contactName || l.directorName || 'Untitled Lead',
        contact: l.directorName || l.contactName || '',
        email: l.email || '',
        phone: l.phone || '',
        status: l.status || '',
        priority: l.priority || '',
        source: l.source || '',
        industry: l.industry || '',
        location: [l.city, l.country].filter(Boolean).join(', '),
        value: parseMoney(l.expectedBusinessValue),
        lastActivity: l.lastFollowUp || l.updatedAt || l.createdAt || null,
        nextFollowUp: l.nextFollowUp || null,
        assignee: formatPersonName(l.assignedTo) || l.assignedTo?.email || 'Unassigned',
        createdAt: l.createdAt,
        href: '/leads',
        totalMeetings: touches.total,
        meetingsBreakdown: {
          calls: touches.calls,
          meetings: touches.meetings,
          emails: touches.emails,
          whatsapp: touches.whatsapp,
          followups: touches.followups,
        },
      };
    }),
    clientsTable: (clientRows || []).map((c) => ({
      id: c.id,
      name: c.companyName || 'Untitled Client',
      status: c.status || '',
      industry: c.industry || '',
      location: [c.city, c.country].filter(Boolean).join(', ') || c.location || '',
      value: parseMoney(c.expectedBusinessValue),
      lastActivity: c.lastActivity || c.updatedAt || c.createdAt || null,
      nextFollowUp: c.nextFollowUpDue || null,
      assignee: formatPersonName(c.assignedTo) || c.assignedTo?.email || 'Unassigned',
      createdAt: c.createdAt,
      href: '/client',
    })),
    followups: {
      today: followupsToday,
      tomorrow: followupsTomorrow,
      overdue: overdueFollowups,
      completed: followupsCompletedHint,
      upcoming: (upcomingFollowupRows || []).map((l) => ({
        id: l.id,
        company: l.companyName || 'Lead',
        contact: l.directorName || '',
        at: l.nextFollowUp,
        status: l.status,
        priority: l.priority,
        value: parseMoney(l.expectedBusinessValue),
        assignee: formatPersonName(l.assignedTo) || l.assignedTo?.email || 'Unassigned',
        href: '/leads',
      })),
    },
    calendar: (upcomingMeetingTasks || []).map((t) => ({
      id: t.id,
      title: t.title,
      at: t.dueDate,
      time: t.dueTime || '',
      type: t.taskType || 'Meeting',
      status: t.status,
      assignee: formatPersonName(t.assignedTo) || t.assignedTo?.email || '',
      href: '/Task&Activites',
    })),
    communication: {
      calls: {
        completed: callsDone,
        pending: callsPending,
        cancelled: 0,
        successRate: successRate(callsDone, callsPending),
      },
      meetings: {
        completed: meetingsDone,
        pending: meetingsPending,
        cancelled: 0,
        successRate: successRate(meetingsDone, meetingsPending),
      },
      emails: {
        completed: emailsDone,
        pending: emailsPending,
        cancelled: 0,
        successRate: successRate(emailsDone, emailsPending),
      },
      whatsapp: {
        completed: waDone,
        pending: waPending,
        cancelled: 0,
        successRate: successRate(waDone, waPending),
      },
    },
    activityTimeline: (recentActivities || []).map((a) => ({
      id: a.id,
      at: a.createdAt,
      label: a.action || 'Activity',
      detail: a.description || a.category || '',
      performer: formatPersonName(a.performedBy) || a.performedBy?.email || '',
      entityType: a.entityType || '',
    })),
    leaderboard,
    businessSummary: {
      potentialBusinessValue: Math.round(potentialBusinessValue),
      expectedRevenue: Math.round(potentialBusinessValue * (conversionRate / 100 || 0.1)),
      averageLeadValue: Math.round(avgLeadValue),
      averageClientValue: Math.round(avgClientValue),
      highestValueLead: highestLead,
      highestValueClient: highestClient,
    },
    teamOptions,
    filtersApplied: {
      assignedTo: assignedTo || null,
      search: search || null,
      dateRange: String(q.dateRange || 'last_30_days'),
    },
    generatedAt: new Date().toISOString(),
  };
}
