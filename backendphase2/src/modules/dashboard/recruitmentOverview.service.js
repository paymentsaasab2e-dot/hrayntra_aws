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

/** Timeline filter → createdAt window. `all` = no createdAt clamp. */
function resolveRangeBounds(q = {}) {
  const raw = String(q.dateRange || 'last_30_days').trim().toLowerCase();
  const now = new Date();
  let start;
  let end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (q.startDate && q.endDate) {
    start = new Date(q.startDate);
    end = new Date(q.endDate);
    if (Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())) {
      return { start, end, key: 'custom' };
    }
  }

  if (raw === 'all') return { start: null, end: null, key: 'all' };

  if (raw === 'today') {
    start = new Date(now);
    start.setHours(0, 0, 0, 0);
  } else if (raw === 'yesterday') {
    start = new Date(now);
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setHours(23, 59, 59, 999);
  } else if (raw === 'last_7_days' || raw === 'week' || raw === 'this_week') {
    start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else if (raw === 'month' || raw === 'this_month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (raw === 'quarter' || raw === 'this_quarter') {
    start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  } else if (raw === 'year' || raw === 'this_year') {
    start = new Date(now.getFullYear(), 0, 1);
  } else {
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
  }

  return { start, end, key: raw };
}

function countByStatus(groups, keys) {
  const set = new Set((keys || []).map((k) => String(k).toLowerCase().replace(/[\s_]+/g, '')));
  return (groups || []).reduce((sum, g) => {
    const st = String(g.status || '').toLowerCase().replace(/[\s_]+/g, '');
    if (!set.has(st)) return sum;
    const n = Number(g._count?._all ?? g._count ?? 0);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

function prettyLabel(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function bucketSource(raw) {
  const t = String(raw || '').trim().toLowerCase();
  if (!t || t === 'unknown' || t === 'null') return 'Manual upload';
  if (/hryantra|hrayntra|hrynat|internal|ats|system/.test(t)) return 'Hryantra';
  if (/naukri|linkedin|indeed|monster|shine|portal|job.?board|foundit|iimjobs/.test(t)) return 'Job portal';
  if (/refer/.test(t)) return 'Referral';
  if (/upload|import|csv|excel|manual/.test(t)) return 'Manual upload';
  return prettyLabel(raw) || 'Other';
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

function sparkBySource(rows, days = 14) {
  const keys = ['Job portal', 'Hryantra', 'Referral', 'Manual upload', 'Other'];
  const byDay = new Map();
  for (const row of rows || []) {
    const d = new Date(row.createdAt || 0);
    if (!Number.isFinite(d.getTime())) continue;
    const day = d.toISOString().slice(0, 10);
    const bucket = bucketSource(row.source);
    const slot = keys.includes(bucket) ? bucket : 'Other';
    const rec = byDay.get(day) || Object.fromEntries(keys.map((k) => [k, 0]));
    rec[slot] = (rec[slot] || 0) + 1;
    byDay.set(day, rec);
  }
  const out = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const rec = byDay.get(key) || Object.fromEntries(keys.map((k) => [k, 0]));
    out.push({ label: key.slice(5), ...rec });
  }
  return out;
}

/**
 * Recruitment Command Center overview: Jobs + Candidates + Interviews + Placements.
 */
export async function getRecruitmentOverview(req) {
  const q = req?.query || {};
  const assignedTo = String(q.assignedTo || q.team || q.recruiterId || '').trim() || undefined;
  const search = String(q.search || '').trim() || undefined;

  const now = new Date();
  const { start: startOfToday, end: endOfToday } = dayBounds(now);
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const daysAgo7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const range = resolveRangeBounds(q);
  const sparkStart = range.start || daysAgo7;
  const sparkDays =
    range.key === 'today' || range.key === 'yesterday'
      ? 2
      : range.key === 'last_7_days' || range.key === 'week' || range.key === 'this_week'
        ? 7
        : 14;

  const jobBase = {
    isDeleted: { not: true },
    ...(assignedTo
      ? {
          OR: [
            { assignedToId: assignedTo },
            { createdById: assignedTo },
            { supportingRecruiters: { has: assignedTo } },
          ],
        }
      : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { department: { contains: search, mode: 'insensitive' } },
            { location: { contains: search, mode: 'insensitive' } },
            { city: { contains: search, mode: 'insensitive' } },
            { country: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const candidateBase = {
    isDeleted: { not: true },
    ...(assignedTo ? { assignedToId: assignedTo } : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { currentTitle: { contains: search, mode: 'insensitive' } },
            { currentCompany: { contains: search, mode: 'insensitive' } },
            { location: { contains: search, mode: 'insensitive' } },
            { source: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const interviewBase = {
    ...(assignedTo
      ? {
          OR: [{ createdById: assignedTo }, { job: { assignedToId: assignedTo } }],
        }
      : {}),
  };

  const placementBase = {
    deletedAt: null,
    ...(assignedTo
      ? {
          OR: [{ recruiterId: assignedTo }, { job: { assignedToId: assignedTo } }],
        }
      : {}),
  };

  const viewerId = req?.user?.id || req?.user?._id || null;
  let activityWhere = {
    entityType: { in: ['JOB', 'CANDIDATE', 'INTERVIEW', 'PLACEMENT'] },
    ...(assignedTo ? { performedById: assignedTo } : {}),
  };
  try {
    activityWhere = await appendEntityActivityVisibilityToWhere(activityWhere, viewerId);
  } catch {
    if (viewerId) activityWhere.performedById = viewerId;
  }

  const [
    jobStatusGroups,
    candidateStatusGroups,
    interviewStatusGroups,
    placementStatusGroups,
    candidateSourceGroups,
    jobsByDepartment,
    totalJobs,
    openJobs,
    draftJobs,
    onHoldJobs,
    closedJobs,
    filledJobs,
    hotJobs,
    jobsNoCandidates,
    jobsSlaRisk,
    totalCandidates,
    newCandidates,
    activeCandidates,
    placedCandidates,
    inactiveCandidates,
    interviewsToday,
    interviewsUpcoming,
    interviewsOverdueFeedback,
    totalInterviews,
    completedInterviews,
    cancelledInterviews,
    totalPlacements,
    offersSent,
    offersAccepted,
    joinedPlacements,
    pendingPlacements,
    placementRevenueAgg,
    recentJobsCreated,
    teamUsers,
    jobRows,
    candidateRows,
    interviewRows,
    placementRows,
    upcomingInterviewRows,
    recentActivities,
  ] = await Promise.all([
    prisma.job.groupBy({ by: ['status'], where: jobBase, _count: { _all: true } }).catch(() => []),
    prisma.candidate.groupBy({ by: ['status'], where: candidateBase, _count: { _all: true } }).catch(() => []),
    prisma.interview.groupBy({ by: ['status'], where: interviewBase, _count: { _all: true } }).catch(() => []),
    prisma.placement.groupBy({ by: ['status'], where: placementBase, _count: { _all: true } }).catch(() => []),
    prisma.candidate.groupBy({ by: ['source'], where: candidateBase, _count: { _all: true } }).catch(() => []),
    prisma.job
      .groupBy({ by: ['department'], where: { ...jobBase, status: 'OPEN' }, _count: { _all: true } })
      .catch(() => []),
    prisma.job.count({ where: jobBase }).catch(() => 0),
    prisma.job.count({ where: { ...jobBase, status: 'OPEN' } }).catch(() => 0),
    prisma.job.count({ where: { ...jobBase, status: 'DRAFT' } }).catch(() => 0),
    prisma.job.count({ where: { ...jobBase, status: 'ON_HOLD' } }).catch(() => 0),
    prisma.job.count({ where: { ...jobBase, status: { in: ['CLOSED', 'FILLED'] } } }).catch(() => 0),
    prisma.job.count({ where: { ...jobBase, status: 'FILLED' } }).catch(() => 0),
    prisma.job.count({ where: { ...jobBase, hot: true, status: 'OPEN' } }).catch(() => 0),
    prisma.job.count({ where: { ...jobBase, status: 'OPEN', noCandidates: true } }).catch(() => 0),
    prisma.job.count({ where: { ...jobBase, status: 'OPEN', slaRisk: true } }).catch(() => 0),
    prisma.candidate.count({ where: candidateBase }).catch(() => 0),
    prisma.candidate.count({ where: { ...candidateBase, status: 'NEW' } }).catch(() => 0),
    prisma.candidate.count({ where: { ...candidateBase, status: 'ACTIVE' } }).catch(() => 0),
    prisma.candidate.count({ where: { ...candidateBase, status: 'PLACED' } }).catch(() => 0),
    prisma.candidate.count({ where: { ...candidateBase, status: 'INACTIVE' } }).catch(() => 0),
    prisma.interview
      .count({
        where: {
          ...interviewBase,
          scheduledAt: { gte: startOfToday, lte: endOfToday },
          status: { notIn: ['CANCELLED'] },
        },
      })
      .catch(() => 0),
    prisma.interview
      .count({
        where: {
          ...interviewBase,
          scheduledAt: { gt: endOfToday, lte: in7Days },
          status: { in: ['SCHEDULED', 'CONFIRMED', 'RESCHEDULED', 'IN_PROGRESS'] },
        },
      })
      .catch(() => 0),
    prisma.interview
      .count({
        where: {
          ...interviewBase,
          status: 'FEEDBACK_PENDING',
          scheduledAt: { lt: startOfToday },
        },
      })
      .catch(() => 0),
    prisma.interview.count({ where: interviewBase }).catch(() => 0),
    prisma.interview
      .count({ where: { ...interviewBase, status: { in: ['COMPLETED', 'FEEDBACK_SUBMITTED'] } } })
      .catch(() => 0),
    prisma.interview.count({ where: { ...interviewBase, status: 'CANCELLED' } }).catch(() => 0),
    prisma.placement.count({ where: placementBase }).catch(() => 0),
    prisma.placement.count({ where: { ...placementBase, status: 'OFFER_SENT' } }).catch(() => 0),
    prisma.placement
      .count({ where: { ...placementBase, status: { in: ['OFFER_ACCEPTED', 'JOINING_SCHEDULED', 'JOINED', 'ACTIVE', 'COMPLETED'] } } })
      .catch(() => 0),
    prisma.placement
      .count({ where: { ...placementBase, status: { in: ['JOINED', 'ACTIVE', 'COMPLETED'] } } })
      .catch(() => 0),
    prisma.placement
      .count({ where: { ...placementBase, status: { in: ['PENDING', 'OFFER_SENT', 'OFFER_ACCEPTED', 'JOINING_SCHEDULED'] } } })
      .catch(() => 0),
    prisma.placement
      .aggregate({
        where: placementBase,
        _sum: { revenue: true, placementFee: true },
      })
      .catch(() => ({ _sum: {} })),
    prisma.job
      .findMany({
        where: {
          ...jobBase,
          createdAt: {
            gte: sparkStart,
            ...(range.end ? { lte: range.end } : {}),
          },
        },
        select: { createdAt: true },
        take: 800,
      })
      .catch(() => []),
    prisma.user
      .findMany({
        where: { isActive: true },
        select: { id: true, firstName: true, lastName: true, name: true, email: true, role: true },
        take: 80,
        orderBy: { firstName: 'asc' },
      })
      .catch(() => []),
    prisma.job
      .findMany({
        where: jobBase,
        take: 25,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          openings: true,
          department: true,
          location: true,
          priority: true,
          hot: true,
          noCandidates: true,
          slaRisk: true,
          postedDate: true,
          createdAt: true,
          updatedAt: true,
          client: { select: { companyName: true } },
          assignedTo: { select: { firstName: true, lastName: true, email: true } },
          _count: { select: { matches: true, interviews: true, placements: true } },
        },
      })
      .catch(() => []),
    prisma.candidate
      .findMany({
        where: candidateBase,
        take: 25,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          source: true,
          location: true,
          currentTitle: true,
          currentCompany: true,
          experience: true,
          experienceYears: true,
          createdAt: true,
          updatedAt: true,
          assignedTo: { select: { firstName: true, lastName: true, email: true } },
        },
      })
      .catch(() => []),
    prisma.interview
      .findMany({
        where: interviewBase,
        take: 20,
        orderBy: { scheduledAt: 'desc' },
        select: {
          id: true,
          status: true,
          round: true,
          scheduledAt: true,
          createdAt: true,
          candidate: { select: { firstName: true, lastName: true } },
          job: { select: { title: true } },
        },
      })
      .catch(() => []),
    prisma.placement
      .findMany({
        where: placementBase,
        take: 20,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          status: true,
          revenue: true,
          placementFee: true,
          offerDate: true,
          joiningDate: true,
          createdAt: true,
          updatedAt: true,
          candidate: { select: { firstName: true, lastName: true } },
          client: { select: { companyName: true } },
          job: { select: { title: true } },
        },
      })
      .catch(() => []),
    prisma.interview
      .findMany({
        where: {
          ...interviewBase,
          scheduledAt: { gte: startOfToday, lte: in7Days },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
        take: 12,
        orderBy: { scheduledAt: 'asc' },
        select: {
          id: true,
          status: true,
          round: true,
          scheduledAt: true,
          candidate: { select: { firstName: true, lastName: true } },
          job: { select: { title: true, assignedTo: { select: { firstName: true, lastName: true, email: true } } } },
        },
      })
      .catch(() => []),
    prisma.activity
      .findMany({
        where: activityWhere,
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          action: true,
          description: true,
          category: true,
          entityType: true,
          createdAt: true,
          performedBy: { select: { firstName: true, lastName: true, email: true } },
        },
      })
      .catch(() => []),
  ]);

  const [clientIdGroups, recentCandidatesCreated] = await Promise.all([
    prisma.job.groupBy({ by: ['clientId'], where: jobBase, _count: { _all: true } }).catch(() => []),
    prisma.candidate
      .findMany({
        where: {
          ...candidateBase,
          createdAt: { gte: sparkStart, ...(range.end ? { lte: range.end } : {}) },
        },
        select: { createdAt: true, source: true },
        take: 800,
      })
      .catch(() => []),
  ]);

  const jobStatusPie = (jobStatusGroups || [])
    .map((g) => ({ name: prettyLabel(g.status) || 'Other', value: Number(g._count?._all || 0) }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);

  const candidateStatusPie = (candidateStatusGroups || [])
    .map((g) => ({ name: prettyLabel(g.status) || 'Other', value: Number(g._count?._all || 0) }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);

  const interviewStatusPie = (interviewStatusGroups || [])
    .map((g) => ({ name: prettyLabel(g.status) || 'Other', value: Number(g._count?._all || 0) }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);

  const placementStatusPie = (placementStatusGroups || [])
    .map((g) => ({ name: prettyLabel(g.status) || 'Other', value: Number(g._count?._all || 0) }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);

  const sourceBuckets = new Map();
  for (const g of candidateSourceGroups || []) {
    const name = bucketSource(g.source);
    sourceBuckets.set(name, (sourceBuckets.get(name) || 0) + Number(g._count?._all || 0));
  }
  const candidateSources = Array.from(sourceBuckets.entries())
    .map(([name, value]) => ({ name, value }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);

  const departments = (jobsByDepartment || [])
    .map((g) => ({
      name: String(g.department || 'Other').trim() || 'Other',
      value: Number(g._count?._all || 0),
    }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const clientIds = [...new Set((clientIdGroups || []).map((g) => g.clientId).filter(Boolean))];
  const clientDocs = clientIds.length
    ? await prisma.client
        .findMany({
          where: { id: { in: clientIds } },
          select: { id: true, companyName: true },
          take: 60,
        })
        .catch(() => [])
    : [];
  const clientName = new Map((clientDocs || []).map((c) => [String(c.id), c.companyName]));
  const jobsByClient = (clientIdGroups || [])
    .map((g) => ({
      name: g.clientId ? clientName.get(String(g.clientId)) || 'Client' : 'No client',
      value: Number(g._count?._all || 0),
    }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const pipeline = [
    { stage: 'Applied', count: Math.max(countByStatus(candidateStatusGroups, ['NEW']), Number(newCandidates || 0)), href: '/candidate' },
    { stage: 'Active', count: Math.max(countByStatus(candidateStatusGroups, ['ACTIVE']), Number(activeCandidates || 0)), href: '/candidate' },
    { stage: 'Interview', count: Math.max(interviewsUpcoming + interviewsToday, (interviewRows || []).length), href: '/interviews' },
    { stage: 'Offer', count: Math.max(offersSent, Number(pendingPlacements || 0)), href: '/placement' },
    { stage: 'Joined', count: Math.max(joinedPlacements, Number(placedCandidates || 0)), href: '/placement' },
    { stage: 'Inactive', count: inactiveCandidates, href: '/candidate' },
  ];

  const fillRate =
    openJobs + filledJobs > 0 ? Number(((filledJobs / (openJobs + filledJobs)) * 100).toFixed(1)) : 0;
  const offerAcceptRate =
    offersSent + offersAccepted > 0
      ? Number(((offersAccepted / Math.max(1, offersSent + offersAccepted)) * 100).toFixed(1))
      : 0;
  const interviewCompletionRate =
    totalInterviews > 0 ? Number(((completedInterviews / totalInterviews) * 100).toFixed(1)) : 0;

  const revenue =
    Number(placementRevenueAgg?._sum?.revenue || 0) ||
    Number(placementRevenueAgg?._sum?.placementFee || 0) ||
    (placementRows || []).reduce((s, p) => s + parseMoney(p.revenue ?? p.placementFee), 0);

  const alerts = [];
  const insights = [];
  const recommendations = [];
  const pushAlert = (alert) => {
    alerts.push(alert);
    insights.push({
      id: alert.id,
      severity: alert.severity,
      text: alert.text,
      action: alert.action,
      href: alert.href,
    });
  };

  if (jobsNoCandidates > 0) {
    pushAlert({
      id: 'jobs-no-candidates',
      severity: 'high',
      text: `${jobsNoCandidates} open job(s) have no candidates`,
      action: 'Source talent',
      href: '/job',
      category: 'jobs',
    });
  }
  if (jobsSlaRisk > 0) {
    pushAlert({
      id: 'jobs-sla-risk',
      severity: 'high',
      text: `${jobsSlaRisk} open job(s) are at SLA risk`,
      action: 'Review SLA',
      href: '/job',
      category: 'jobs',
    });
  }
  if (interviewsOverdueFeedback > 0) {
    pushAlert({
      id: 'interview-feedback',
      severity: 'medium',
      text: `${interviewsOverdueFeedback} interview(s) waiting on feedback`,
      action: 'Submit feedback',
      href: '/interviews',
      category: 'interviews',
    });
  }
  if (hotJobs > 0) {
    pushAlert({
      id: 'hot-jobs',
      severity: 'info',
      text: `${hotJobs} hot open role(s) need priority attention`,
      action: 'View hot jobs',
      href: '/job',
      category: 'jobs',
    });
  }
  if (pendingPlacements > 0) {
    pushAlert({
      id: 'pending-placements',
      severity: 'medium',
      text: `${pendingPlacements} placement(s) still in offer / joining pipeline`,
      action: 'Track offers',
      href: '/placement',
      category: 'placements',
    });
  }

  if (openJobs > 0) {
    recommendations.push({
      id: 'fill-open-roles',
      text: `Focus pipeline on ${openJobs} open role(s)`,
      detail: `${jobsNoCandidates} still need candidates sourced`,
      href: '/job',
    });
  }
  if (interviewsToday > 0) {
    recommendations.push({
      id: 'prep-interviews',
      text: `${interviewsToday} interview(s) scheduled today`,
      detail: 'Confirm panels and share briefs',
      href: '/interviews',
    });
  }
  if (offersSent > 0) {
    recommendations.push({
      id: 'chase-offers',
      text: `Follow up on ${offersSent} open offer(s)`,
      detail: 'Reduce offer drop-off before joining',
      href: '/placement',
    });
  }
  recommendations.push({
    id: 'command-center',
    text: 'Jump into Jobs, Candidates, Interviews, or Placements',
    detail: 'Use the module shortcuts below',
    href: '/recruitment',
  });

  const healthBase = 72;
  const healthPenalty =
    Math.min(18, jobsNoCandidates * 3) +
    Math.min(12, jobsSlaRisk * 4) +
    Math.min(10, interviewsOverdueFeedback * 2);
  const healthBoost = Math.min(16, filledJobs + joinedPlacements);
  const health = Math.max(35, Math.min(98, healthBase - healthPenalty + healthBoost));
  const healthLabel = health >= 80 ? 'Strong' : health >= 65 ? 'Stable' : health >= 50 ? 'Watch' : 'At Risk';

  // Lightweight recruiter leaderboard from open jobs + placements in table samples
  const leaderMap = new Map();
  for (const j of jobRows || []) {
    const id = j.assignedTo ? formatPersonName(j.assignedTo) || j.assignedTo.email : null;
    if (!id) continue;
    const key = j.assignedTo?.email || id;
    const row = leaderMap.get(key) || {
      id: key,
      name: id,
      email: j.assignedTo?.email || '',
      openJobs: 0,
      interviews: 0,
      placements: 0,
      candidates: 0,
    };
    if (j.status === 'OPEN') row.openJobs += 1;
    row.interviews += Number(j._count?.interviews || 0);
    row.placements += Number(j._count?.placements || 0);
    leaderMap.set(key, row);
  }
  for (const c of candidateRows || []) {
    const name = formatPersonName(c.assignedTo) || c.assignedTo?.email;
    if (!name) continue;
    const key = c.assignedTo?.email || name;
    const row = leaderMap.get(key) || {
      id: key,
      name,
      email: c.assignedTo?.email || '',
      openJobs: 0,
      interviews: 0,
      placements: 0,
      candidates: 0,
    };
    row.candidates += 1;
    leaderMap.set(key, row);
  }
  const leaderboard = Array.from(leaderMap.values())
    .map((r) => ({
      ...r,
      score: r.openJobs * 2 + r.interviews + r.placements * 4 + r.candidates,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const teamOptions = [
    { id: '', name: 'All Team' },
    ...(teamUsers || []).map((u) => ({
      id: u.id,
      name: formatPersonName(u) || u.email || 'User',
    })),
  ];

  const jobSpark = sparkFromDaily(recentJobsCreated, sparkDays);
  const sourceSpark = sparkBySource(recentCandidatesCreated, sparkDays);

  const kpis = {
    hiringHealth: health,
    totalJobs,
    openJobs,
    draftJobs,
    onHoldJobs,
    closedJobs,
    filledJobs,
    hotJobs,
    jobsNoCandidates,
    jobsSlaRisk,
    totalCandidates,
    newCandidates,
    activeCandidates,
    placedCandidates,
    inactiveCandidates,
    interviewsToday,
    interviewsUpcoming,
    interviewsOverdueFeedback,
    totalInterviews,
    completedInterviews,
    cancelledInterviews,
    totalPlacements,
    offersSent,
    offersAccepted,
    joinedPlacements,
    pendingPlacements,
    fillRate,
    offerAcceptRate,
    interviewCompletionRate,
    placementRevenue: Math.round(revenue),
    alerts: alerts.length,
    teamMembers: (teamUsers || []).length,
  };

  return {
    scope: 'recruitment',
    kpis,
    health: { score: health, label: healthLabel },
    todaySummary: {
      interviewsToday,
      openJobs,
      newCandidates,
      pendingOffers: offersSent,
      placementRevenue: Math.round(revenue),
    },
    insights: insights.slice(0, 10),
    recommendations: recommendations.slice(0, 8),
    alerts: alerts.slice(0, 12),
    pipeline,
    jobStatusPie,
    candidateStatusPie,
    interviewStatusPie,
    placementStatusPie,
    candidateSources,
    jobsByDepartment: departments,
    jobsByClient,
    jobSpark,
    sourceSpark,
    jobsTable: (jobRows || []).map((j) => ({
      id: j.id,
      title: j.title || 'Untitled Job',
      status: j.status || '',
      openings: j.openings ?? 1,
      department: j.department || '',
      location: j.location || '',
      priority: j.priority || '',
      hot: Boolean(j.hot),
      noCandidates: Boolean(j.noCandidates),
      slaRisk: Boolean(j.slaRisk),
      client: j.client?.companyName || 'No client',
      applicants: Number(j._count?.matches || 0),
      interviews: Number(j._count?.interviews || 0),
      placements: Number(j._count?.placements || 0),
      assignee: formatPersonName(j.assignedTo) || j.assignedTo?.email || 'Unassigned',
      postedDate: j.postedDate || j.createdAt,
      updatedAt: j.updatedAt,
      href: '/job',
    })),
    candidatesTable: (candidateRows || []).map((c) => ({
      id: c.id,
      name: formatPersonName(c) || 'Unnamed',
      email: c.email || '',
      phone: c.phone || '',
      status: c.status || '',
      source: c.source || '',
      location: c.location || '',
      title: c.currentTitle || '',
      company: c.currentCompany || '',
      experience: c.experienceYears ?? c.experience ?? null,
      assignee: formatPersonName(c.assignedTo) || c.assignedTo?.email || 'Unassigned',
      createdAt: c.createdAt,
      updatedAt: c.updatedAt || c.createdAt,
      href: '/candidate',
    })),
    interviewsTable: (interviewRows || []).map((i) => ({
      id: i.id,
      candidate: formatPersonName(i.candidate) || 'Candidate',
      job: i.job?.title || 'Interview',
      status: i.status || '',
      round: i.round || '',
      scheduledAt: i.scheduledAt,
      href: '/interviews',
    })),
    placementsTable: (placementRows || []).map((p) => ({
      id: p.id,
      candidate: formatPersonName(p.candidate) || 'Candidate',
      client: p.client?.companyName || '',
      job: p.job?.title || '',
      status: p.status || '',
      revenue: parseMoney(p.revenue ?? p.placementFee),
      offerDate: p.offerDate,
      joiningDate: p.joiningDate,
      updatedAt: p.updatedAt,
      href: '/placement',
    })),
    schedule: (upcomingInterviewRows || []).map((i) => ({
      id: i.id,
      title: `${formatPersonName(i.candidate) || 'Candidate'} · ${i.job?.title || 'Interview'}`,
      at: i.scheduledAt,
      status: i.status || '',
      round: i.round || '',
      type: 'interview',
      assignee: formatPersonName(i.job?.assignedTo) || i.job?.assignedTo?.email || '',
      href: '/interviews',
    })),
    activityTimeline: (recentActivities || []).map((a) => ({
      id: a.id,
      at: a.createdAt,
      label: a.action || 'Activity',
      detail: a.description || a.category || '',
      performer: formatPersonName(a.performedBy) || a.performedBy?.email || '',
      entityType: a.entityType || '',
    })),
    leaderboard,
    teamOptions,
    filtersApplied: {
      assignedTo: assignedTo || null,
      search: search || null,
      dateRange: range.key || String(q.dateRange || 'last_30_days'),
      start: range.start ? range.start.toISOString() : null,
      end: range.end ? range.end.toISOString() : null,
    },
    generatedAt: new Date().toISOString(),
  };
}
