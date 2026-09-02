import { MongoClient } from 'mongodb';
import { env } from '../../config/env.js';
import {
  getCandidateCommonPrismaClient,
  getJobPortalPrismaClient,
  prisma,
  runWithTenantContext,
} from '../../config/prisma.js';
import { headquartersAuthService } from '../auth/headquarters-auth.service.js';
import { hqLeadsService } from './hq-leads.service.js';
import { hqCompaniesService } from './hq-companies.service.js';
import { hqDemosService } from './hq-demos.service.js';
import { getDefaultPackageTemplate, resolveBillingCycle } from './hq-packages.config.js';

const SAMPLE_LIMIT = Math.min(
  8000,
  Math.max(500, Number(process.env.HQ_ANALYTICS_SAMPLE_MAX || 4000) || 4000),
);

/** Sessions with no logout older than this are treated as stale, not "online now". */
const ONLINE_SESSION_WINDOW_MS = 30 * 60 * 1000;
/** Cap open-session duration used in averages so abandoned sessions don't inflate KPIs. */
const MAX_OPEN_SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
/** Heartbeat freshness for Phase 1 behaviour tracker payloads. */
const LIVE_BEHAVIOR_ONLINE_MS = 2 * 60 * 1000;

/** HQ operator workspace — never counted or searchable as a tenant estate. */
function isHqSetupAccount(row) {
  const name = String(row?.name || row?.organizationName || '').toLowerCase().trim();
  const email = String(row?.email || '').toLowerCase().trim();
  const login = String(row?.loginId || '').toLowerCase().trim();
  const db = String(row?.tenantDbName || '').toLowerCase().trim();
  if (email === 'admin@gmail.com') return true;
  if (login === 'hq_admin') return true;
  if (name === 'hq platform admin' || name.includes('hq setup') || name.includes('hq-setup')) return true;
  if (name.includes('hq platform') && name.includes('admin')) return true;
  if (db === 'hq_admin' || db.startsWith('hqadmin')) return true;
  return false;
}

function firstPositive(...values) {
  for (const value of values) {
    const n = Number(value) || 0;
    if (n > 0) return n;
  }
  return 0;
}

function mergeCountMaps(...maps) {
  const out = {};
  for (const map of maps) {
    if (!map || typeof map !== 'object') continue;
    for (const [key, value] of Object.entries(map)) {
      const k = String(key || 'Unknown').trim() || 'Unknown';
      out[k] = (out[k] || 0) + (Number(value) || 0);
    }
  }
  return out;
}

/** Prefer 7d tracker rollup; if empty, keep older month/year/today so HQ is not stuck at 0. */
function pickBestUserRollup(user) {
  const sources = [
    user?.rollup7d,
    user?.rollupMonth,
    user?.rollupYear,
    user?.rollupToday,
    user?.payload?.rollup7d,
    user?.payload?.rollupMonth,
  ].filter((row) => row && typeof row === 'object');
  const base = { ...(user?.rollup7d && typeof user.rollup7d === 'object' ? user.rollup7d : {}) };
  for (const key of ['visits', 'applies', 'jobCardClicks', 'logins', 'sessionCount', 'activeMs']) {
    const n = firstPositive(...sources.map((s) => s[key]));
    if (n > 0) base[key] = n;
  }
  base.pageVisitsByCategory = mergeCountMaps(...sources.map((s) => s.pageVisitsByCategory));
  base.firstOpenBreakdown = mergeCountMaps(...sources.map((s) => s.firstOpenBreakdown));
  const roleLists = sources.flatMap((s) => (Array.isArray(s.topRoles) ? s.topRoles : []));
  const companyLists = sources.flatMap((s) => (Array.isArray(s.topCompanies) ? s.topCompanies : []));
  if (roleLists.length) base.topRoles = roleLists;
  if (companyLists.length) base.topCompanies = companyLists;
  const triggerLists = sources.flatMap((s) => (Array.isArray(s.hqTriggers) ? s.hqTriggers : []));
  if (triggerLists.length && !Array.isArray(base.hqTriggers)) base.hqTriggers = triggerLists;
  return base;
}

let portalMongoClient = null;

function phase1FrontendBase() {
  return String(
    process.env.PHASE1_FRONTEND_URL ||
      process.env.JOB_PORTAL_FRONTEND_URL ||
      process.env.NEXT_PUBLIC_PHASE1_FRONTEND_URL ||
      'http://localhost:3000',
  )
    .trim()
    .replace(/\/+$/, '');
}

function phase1ApiBase() {
  return String(env.JOB_PORTAL_API_URL || process.env.JOB_PORTAL_API_URL || 'http://localhost:5000')
    .trim()
    .replace(/\/+$/, '');
}

function phase1InternalAdminKey() {
  return String(
    process.env.SYSTEM_AUDIT_ADMIN_KEY ||
      process.env.INTERVIEW_ADMIN_KEY ||
      process.env.INTERNAL_API_KEY ||
      '',
  ).trim();
}

/** Premium page spend services (Subscriptions → Premium) — ids match backend1 tokenCatalog. */
const PREMIUM_SERVICE_NAMES = {
  'lms.resume.ai-improve': 'AI CV Edit',
  'cveditor.ai-improve': 'AI CV Editor Improve',
  'lms.resume.ats-check': 'ATS Check',
  'lms.resume.generate-summary': 'Generate Summary',
  'lms.resume.tailor-summary': 'Tailor Summary for Job',
  'lms.resume.analyze': 'Resume Analyze',
  'lms.quizzes.generate': 'Generate Quizzes',
  'lms.interview.generate-set': 'Generate Interview Set',
  'lms.interview.ai-feedback': 'Interview AI Feedback',
  'lms.interview.mock-session-start': 'Mock Interview Session',
  'lms.interview.unlock-request': 'Unlock Be Interviewed',
  'lms.interview.unlock-interviewer': 'Unlock Become Interviewer',
  'lms.notes.ai-action': 'Notes AI Action',
  'lms.career-path.recommend-goal': 'Career Goal Recommend',
  'lms.courses.unlock-premium': 'Premium Course Unlock',
  'lms.courses.unlock-certified': 'Certified Course Unlock',
  'office.reference-check': 'Reference Check',
};

/** Earn tab tasks (Subscriptions → Earn). */
const EARN_TASK_NAMES = {
  welcome: 'First login bonus',
  'earn.cv_upload': 'Upload your CV',
  'earn.profile.basicInformation': 'Complete basic details',
  'earn.profile.summary': 'Add professional summary',
  'earn.profile.education': 'Add education',
  'earn.profile.skills': 'Add skills',
  'earn.profile.languages': 'Add languages',
  'earn.profile.projects': 'Add a project',
  'earn.profile.careerPreferences': 'Set career preferences',
};

const FREE_PORTAL_FEATURE_CATEGORIES = new Set([
  'jobs',
  'applications',
  'profile',
  'dashboard',
  'community',
  'other',
]);

function premiumServiceDisplayName(serviceId) {
  const id = String(serviceId || '').trim();
  if (!id) return 'Unknown service';
  if (PREMIUM_SERVICE_NAMES[id]) return PREMIUM_SERVICE_NAMES[id];
  if (id.startsWith('office.reference-check')) return 'Reference Check';
  if (id.startsWith('lms.courses.unlock')) return id.includes('certified') ? 'Certified Course Unlock' : 'Premium Course Unlock';
  return id.replace(/^lms\./, '').replace(/[._]/g, ' ');
}

function earnTaskDisplayName(serviceId) {
  const raw = String(serviceId || '').trim();
  if (!raw || raw.endsWith('.open')) return null;
  const base = raw.replace(/\.r\d+$/, '');
  if (EARN_TASK_NAMES[base]) return EARN_TASK_NAMES[base];
  if (base.startsWith('earn.') || base === 'welcome') {
    return base.replace(/^earn\./, '').replace(/[._]/g, ' ');
  }
  return null;
}

function isPremiumSpendService(serviceId) {
  const id = String(serviceId || '').trim();
  if (!id) return false;
  if (PREMIUM_SERVICE_NAMES[id]) return true;
  if (id.startsWith('lms.') || id.startsWith('cveditor.') || id.startsWith('office.reference-check')) {
    return true;
  }
  return false;
}

/** Token ledger rollup from jobportal Mongo — spends (premium) + earns (free triggers). */
async function fetchPhase1TokenUsageAggregate() {
  try {
    const db = await getPortalMongoDb();
    if (!db) return null;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const col = db.collection('token_transactions');

    const [spendRows, earnRows] = await Promise.all([
      col
        .aggregate([
          { $match: { type: 'SPEND', createdAt: { $gte: since } } },
          {
            $group: {
              _id: '$service',
              count: { $sum: 1 },
              tokens: { $sum: { $abs: '$amount' } },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 30 },
        ])
        .toArray(),
      col
        .aggregate([
          {
            $match: {
              type: 'GRANT',
              createdAt: { $gte: since },
              service: { $type: 'string', $ne: '' },
            },
          },
          {
            $group: {
              _id: '$service',
              count: { $sum: 1 },
              tokens: { $sum: { $abs: '$amount' } },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 40 },
        ])
        .toArray(),
    ]);

    const premiumSpendMap = {};
    const premiumTokenMap = {};
    let premiumSpendEvents = 0;
    let premiumTokensSpent = 0;
    for (const row of spendRows || []) {
      const serviceId = String(row?._id || '').trim();
      if (!serviceId || !isPremiumSpendService(serviceId)) continue;
      const name = premiumServiceDisplayName(serviceId);
      const count = Number(row.count) || 0;
      const tokens = Number(row.tokens) || 0;
      premiumSpendMap[name] = (premiumSpendMap[name] || 0) + count;
      premiumTokenMap[name] = (premiumTokenMap[name] || 0) + tokens;
      premiumSpendEvents += count;
      premiumTokensSpent += tokens;
    }

    const earnMap = {};
    let earnEvents = 0;
    for (const row of earnRows || []) {
      const serviceId = String(row?._id || '').trim();
      const name = earnTaskDisplayName(serviceId);
      if (!name) continue;
      const count = Number(row.count) || 0;
      earnMap[name] = (earnMap[name] || 0) + count;
      earnEvents += count;
    }

    const premiumServicesUsage = Object.entries(premiumSpendMap)
      .map(([name, value]) => ({
        name,
        value,
        tokens: premiumTokenMap[name] || 0,
        kind: 'premium',
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);

    const earnFeatures = Object.entries(earnMap)
      .map(([name, value]) => ({
        name,
        value,
        kind: 'earn',
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    return {
      available: true,
      premiumSpendEvents,
      premiumTokensSpent,
      premiumServicesUsage,
      earnFeatures,
      earnEvents,
      capturedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.warn('[hq-analytics] Token usage aggregate failed:', error?.message || error);
    return null;
  }
}

/** Office Gossip + reference-check product rollup from backend1 (not behaviour JSON). */
async function fetchOfficeGossipsHqSummary() {
  try {
    const url = `${phase1ApiBase()}/api/office-gossips/hq/summary`;
    const headers = { Accept: 'application/json' };
    const key = phase1InternalAdminKey();
    if (key) headers['x-internal-admin-key'] = key;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      headers,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    const data = json?.data;
    if (!data || typeof data !== 'object') return null;
    return {
      available: true,
      updatedAt: data.updatedAt || null,
      usersOnOfficeGossip: Number(data.usersOnOfficeGossip) || 0,
      identities: Number(data.identities) || 0,
      communities: Number(data.communities) || 0,
      companyPages: Number(data.companyPages) || 0,
      posts: Number(data.posts) || 0,
      comments: Number(data.comments) || 0,
      openForReference: Number(data.openForReference) || 0,
      referenceChecks: Number(data.referenceChecks) || 0,
      referenceByStatus:
        data.referenceByStatus && typeof data.referenceByStatus === 'object'
          ? data.referenceByStatus
          : {},
      referenceChecksSummary: {
        total: Number(data.referenceChecksSummary?.total ?? data.referenceChecks) || 0,
        initiated: Number(data.referenceChecksSummary?.initiated) || 0,
        responded: Number(data.referenceChecksSummary?.responded) || 0,
        completed: Number(data.referenceChecksSummary?.completed) || 0,
        rejected: Number(data.referenceChecksSummary?.rejected) || 0,
      },
    };
  } catch (error) {
    console.warn('[hq-analytics] Office Gossips HQ summary fetch failed:', error?.message || error);
    return null;
  }
}

/** Categories treated as premium / paid-prep product surfaces. */
const PREMIUM_FEATURE_CATEGORIES = new Set([
  'premium',
  'courses',
  'interview_prep',
  'ai_cv',
  'lms',
  'events',
]);

/** Community / behavioural surfaces (Office Gossip, chat, reference check). */
const COMMUNITY_FEATURE_CATEGORIES = new Set(['community']);

const CATEGORY_DISPLAY = {
  jobs: 'Explore jobs',
  lms: 'Learning Hub',
  courses: 'LMS courses',
  premium: 'Services / Premium page',
  community: 'Office Gossip',
  profile: 'Profile completion',
  applications: 'My applications',
  interview_prep: 'Interview prep',
  ai_cv: 'AI CV / Resume builder',
  events: 'LMS events',
  dashboard: 'Candidate home',
  other: 'Other portal pages',
};

/** First-open / landing labels — portal surfaces users arrive on (UTM sources later). */
const ENTRY_POINT_DISPLAY = {
  jobs: 'Explore jobs landing',
  lms: 'Learning Hub landing',
  courses: 'LMS courses landing',
  premium: 'Services / Premium landing',
  community: 'Office Gossip landing',
  profile: 'Profile landing',
  applications: 'Applications landing',
  interview_prep: 'Interview prep landing',
  ai_cv: 'AI CV landing',
  events: 'LMS events landing',
  dashboard: 'Candidate home landing',
  other: 'Other landing page',
};

/** Popular-features surface labels — paid vs free, match portal naming. */
const FEATURE_SURFACE_LABELS = {
  jobs: { name: 'Explore jobs', kind: 'free' },
  applications: { name: 'My applications', kind: 'free' },
  profile: { name: 'Profile completion', kind: 'free' },
  dashboard: { name: 'Candidate home', kind: 'free' },
  community: { name: 'Office Gossip', kind: 'free' },
  courses: { name: 'LMS courses', kind: 'mixed' },
  lms: { name: 'Learning Hub', kind: 'mixed' },
  interview_prep: { name: 'Interview prep', kind: 'paid' },
  ai_cv: { name: 'AI CV / Resume builder', kind: 'paid' },
  premium: { name: 'Services / Premium page', kind: 'paid' },
  events: { name: 'LMS events', kind: 'mixed' },
};

function categoryDisplayName(cat) {
  const key = String(cat || '').trim();
  return CATEGORY_DISPLAY[key] || key.replace(/_/g, ' ') || 'Unknown';
}

function entryPointDisplayName(cat) {
  const key = String(cat || '').trim();
  return ENTRY_POINT_DISPLAY[key] || categoryDisplayName(key);
}

function featureSurfaceLabel(catOrName) {
  const key = String(catOrName || '').trim();
  if (FEATURE_SURFACE_LABELS[key]) return FEATURE_SURFACE_LABELS[key];
  // Already a display name from CATEGORY_DISPLAY — reverse lookup
  for (const [cat, meta] of Object.entries(FEATURE_SURFACE_LABELS)) {
    if (meta.name === key || CATEGORY_DISPLAY[cat] === key) return meta;
  }
  return null;
}

/** HQ insight trigger titles — reserved for a separate alerts page, not Popular features. */
function isHqInsightFeatureLabel(name) {
  const t = String(name || '').toLowerCase();
  if (!t) return true;
  return (
    /visited services but did not purchase/.test(t) ||
    /did not purchase/.test(t) ||
    /without applying/.test(t) ||
    /hesitat/.test(t) ||
    /incomplete profile/.test(t) ||
    /short visits on premium/.test(t) ||
    /losing after interview/.test(t) ||
    /rejections? with/.test(t) ||
    /rejections? despite/.test(t) ||
    /premium curiosity/.test(t) ||
    /learning path can convert/.test(t) ||
    /low market fit/.test(t) ||
    /profile looks ready/.test(t) ||
    /job hunting with/.test(t) ||
    /polishing cv/.test(t) ||
    /strong interest in/.test(t) ||
    /repeated interest in/.test(t) ||
    /role focus on/.test(t) ||
    /researching .+ without/.test(t) ||
    /^hq[_\s]/.test(t)
  );
}

function isCommunityBehaviorSignal(text) {
  return /gossip|office|chat|reference|watercooler|community|circle|banter|refresh.?check/i.test(
    String(text || ''),
  );
}

async function fetchPhase1LiveBehaviorAggregate() {
  try {
    const url = `${phase1FrontendBase()}/api/hq-behavior`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    const payload = json?.data;
    if (!payload || !Array.isArray(payload.users)) return null;

    const now = Date.now();
    let onlineNow = 0;
    let trackedUsers = 0;
    let totalActiveMs7d = 0;
    let totalVisits7d = 0;
    let totalApplies7d = 0;
    let totalJobClicks7d = 0;
    let totalLogins7d = 0;
    let totalSessions7d = 0;
    let premiumVisits7d = 0;
    let communityVisits7d = 0;
    const pageVisitMap = {};
    const premiumVisitMap = {};
    const communityVisitMap = {};
    const entryPointMap = {};
    const triggerMap = {};
    const triggerTitleMap = {};
    const interestUserCount = {};
    const interestScoreSum = {};
    const interestLabel = {};
    const roleTopicMap = {};
    const companyTopicMap = {};
    const liveFeed = [];

    for (const user of payload.users) {
      if (!user?.userId) continue;
      trackedUsers += 1;
      const rollup = pickBestUserRollup(user);
      const updatedAt = user.activityStateUpdatedAt || user.capturedAt;
      const updatedMs = updatedAt ? new Date(updatedAt).getTime() : NaN;
      if (Number.isFinite(updatedMs) && now - updatedMs <= LIVE_BEHAVIOR_ONLINE_MS) {
        onlineNow += 1;
      }

      totalActiveMs7d += Number(rollup.activeMs) || 0;
      totalVisits7d += Number(rollup.visits) || 0;
      totalApplies7d += Number(rollup.applies) || 0;
      totalJobClicks7d += Number(rollup.jobCardClicks) || 0;
      totalLogins7d += Number(rollup.logins) || 0;
      totalSessions7d += Number(rollup.sessionCount) || 0;

      const pageCats = rollup.pageVisitsByCategory || {};
      const syntheticInterestAdds = new Set();
      for (const [cat, count] of Object.entries(pageCats)) {
        const n = Number(count) || 0;
        if (n <= 0) continue;
        bump(pageVisitMap, cat, n);
        if (PREMIUM_FEATURE_CATEGORIES.has(cat)) {
          bump(premiumVisitMap, cat, n);
          premiumVisits7d += n;
        }
        if (COMMUNITY_FEATURE_CATEGORIES.has(cat)) {
          bump(communityVisitMap, cat, n);
          communityVisits7d += n;
        }
        // Feed Top interests from attention mix (jobs / courses / posts)
        if (cat === 'jobs' || cat === 'applications') {
          syntheticInterestAdds.add('job_search');
          interestScoreSum.job_search = (interestScoreSum.job_search || 0) + Math.min(40, n * 2);
          interestLabel.job_search = interestLabel.job_search || 'Job search';
        }
        if (cat === 'courses' || cat === 'lms') {
          syntheticInterestAdds.add('learning');
          interestScoreSum.learning = (interestScoreSum.learning || 0) + Math.min(40, n * 2);
          interestLabel.learning = interestLabel.learning || 'Learning & courses';
        }
        if (cat === 'community') {
          syntheticInterestAdds.add('watercooler');
          interestScoreSum.watercooler = (interestScoreSum.watercooler || 0) + Math.min(30, n * 2);
          interestLabel.watercooler = interestLabel.watercooler || 'Workplace chat / posts';
        }
      }

      for (const [cat, count] of Object.entries(rollup.firstOpenBreakdown || {})) {
        bump(entryPointMap, cat, Number(count) || 0);
      }

      const triggers = Array.isArray(user.triggers)
        ? user.triggers
        : Array.isArray(rollup.hqTriggers)
          ? rollup.hqTriggers
          : [];
      for (const trigger of triggers) {
        const flag = trigger?.flag || trigger?.id || 'signal';
        const title = trigger?.title || flag;
        bump(triggerMap, flag, 1);
        bump(triggerTitleMap, title, 1);
        const blob = [flag, title, trigger?.reason, ...(trigger?.evidence || [])].join(' ');
        if (isCommunityBehaviorSignal(blob)) {
          bump(communityVisitMap, `signal:${flag}`, 1);
        }
      }

      const interestKeysFromUser = new Set();
      for (const topic of Array.isArray(user.interests) ? user.interests : []) {
        const key = String(topic?.key || '').trim();
        if (!key) continue;
        interestKeysFromUser.add(key);
        interestUserCount[key] = (interestUserCount[key] || 0) + 1;
        interestScoreSum[key] = (interestScoreSum[key] || 0) + (Number(topic?.score) || 0);
        interestLabel[key] = String(topic?.label || key).trim() || key;
      }
      for (const key of syntheticInterestAdds) {
        if (!interestKeysFromUser.has(key)) {
          interestUserCount[key] = (interestUserCount[key] || 0) + 1;
        }
      }

      for (const role of Array.isArray(rollup.topRoles) ? rollup.topRoles : []) {
        const name = String(role?.label || role?.name || role?.key || '').trim();
        if (name) bump(roleTopicMap, name, Number(role?.score || role?.count || 1) || 1);
      }
      for (const company of Array.isArray(rollup.topCompanies) ? rollup.topCompanies : []) {
        const name = String(company?.label || company?.name || company?.key || '').trim();
        if (name) bump(companyTopicMap, name, Number(company?.score || company?.count || 1) || 1);
      }

      liveFeed.push({
        userId: user.userId,
        capturedAt: user.capturedAt || null,
        activityStateUpdatedAt: user.activityStateUpdatedAt || null,
        activeMs7d: Number(rollup.activeMs) || 0,
        visits7d: Number(rollup.visits) || 0,
        applies7d: Number(rollup.applies) || 0,
        jobCardClicks7d: Number(rollup.jobCardClicks) || 0,
        topTrigger:
          (Array.isArray(user.triggers) && user.triggers[0]?.title) ||
          (Array.isArray(rollup.hqTriggers) && rollup.hqTriggers[0]?.title) ||
          null,
        topInterest:
          (Array.isArray(user.interests) && user.interests[0]?.label) ||
          null,
        topFirstOpen: rollup.topFirstOpen ? categoryDisplayName(rollup.topFirstOpen) : null,
      });
    }

    liveFeed.sort((a, b) =>
      String(b.activityStateUpdatedAt || b.capturedAt || '').localeCompare(
        String(a.activityStateUpdatedAt || a.capturedAt || ''),
      ),
    );

    const pageVisitsLabeled = toChartArray(pageVisitMap, { limit: 12 }).map((row) => ({
      ...row,
      name: categoryDisplayName(row.name),
      category: row.name,
    }));
    const premiumServicesUsage = toChartArray(premiumVisitMap, { limit: 8 }).map((row) => ({
      ...row,
      name: categoryDisplayName(row.name),
      category: row.name,
    }));
    const communityBehavior = toChartArray(communityVisitMap, { limit: 8 }).map((row) => ({
      ...row,
      name: String(row.name).startsWith('signal:')
        ? String(row.name).replace(/^signal:/, '').replace(/_/g, ' ')
        : categoryDisplayName(row.name),
    }));
    const entryPoints = toChartArray(entryPointMap, { limit: 8 }).map((row) => ({
      ...row,
      name: entryPointDisplayName(row.name),
      category: row.name,
    }));

    // Popular = portal surfaces only (paid / free / mixed) — never HQ insight trigger titles
    const popularFromPages = toChartArray(pageVisitMap, { limit: 14 })
      .filter((row) => String(row.name) !== 'other')
      .map((row) => {
        const meta = featureSurfaceLabel(row.name) || {
          name: categoryDisplayName(row.name),
          kind: PREMIUM_FEATURE_CATEGORIES.has(String(row.name)) ? 'paid' : 'free',
        };
        const tag =
          meta.kind === 'paid' ? 'Paid' : meta.kind === 'mixed' ? 'Free / paid' : 'Free';
        return {
          name: `${tag} · ${meta.name}`,
          value: row.value,
          kind: meta.kind,
          category: row.name,
        };
      });

    const popularFeatures = popularFromPages.slice(0, 10);

    const topInterests = Object.keys(interestUserCount)
      .map((key) => {
        const usersWithInterest = interestUserCount[key] || 0;
        const scoreSum = interestScoreSum[key] || 0;
        const avgScore =
          usersWithInterest > 0 ? Math.round((scoreSum / usersWithInterest) * 10) / 10 : 0;
        return {
          name: interestLabel[key] || key,
          key,
          /** Platform aggregate score (sum); HQ ranks by this. */
          value: Math.round(scoreSum * 10) / 10,
          avgScore,
          scoreSum: Math.round(scoreSum * 10) / 10,
          users: usersWithInterest,
        };
      })
      .sort((a, b) => b.scoreSum - a.scoreSum || b.users - a.users)
      .slice(0, 10);

    const interestNames = new Set(topInterests.map((t) => String(t.name || '').toLowerCase()));
    const trendingTopics = [
      ...toChartArray(roleTopicMap, { limit: 8 }).map((r) => ({
        name: r.name,
        value: r.value,
        kind: 'role',
      })),
      ...toChartArray(companyTopicMap, { limit: 8 }).map((r) => ({
        name: r.name,
        value: r.value,
        kind: 'company',
      })),
      ...toChartArray(entryPointMap, { limit: 6 }).map((r) => ({
        name: entryPointDisplayName(r.name),
        value: r.value,
        kind: 'landing',
      })),
    ]
      .filter((row) => row.value > 0 && !interestNames.has(String(row.name || '').toLowerCase()))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    return {
      available: true,
      source: 'phase1_behavior_tracker',
      trackedUsers,
      onlineNow,
      totalActiveMs7d,
      totalVisits7d,
      totalApplies7d,
      totalJobClicks7d,
      totalLogins7d,
      totalSessions7d,
      avgActiveMsPerUser7d: trackedUsers > 0 ? Math.round(totalActiveMs7d / trackedUsers) : 0,
      premiumVisits7d,
      communityVisits7d,
      pageVisitsByCategory: pageVisitsLabeled.slice(0, 10),
      premiumServicesUsage,
      popularFeatures,
      entryPoints,
      communityBehavior,
      topInterests,
      trendingTopics,
      topTriggers: toChartArray(triggerMap, { limit: 8 }),
      liveFeed: liveFeed.slice(0, 20),
      capturedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.warn('[hq-analytics] Phase 1 live behaviour fetch failed:', error?.message || error);
    return null;
  }
}

function notSoftDeletedWhere() {
  return {
    OR: [{ isDeleted: false }, { isDeleted: { isSet: false } }],
  };
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function monthKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function bump(map, key, by = 1) {
  const k = String(key || 'Unknown').trim() || 'Unknown';
  map[k] = (map[k] || 0) + by;
}

function toChartArray(map, { limit = 10, sort = 'desc' } = {}) {
  const rows = Object.entries(map).map(([name, value]) => ({
    name,
    value: Number(value) || 0,
  }));
  rows.sort((a, b) => (sort === 'asc' ? a.value - b.value : b.value - a.value));
  return rows.slice(0, limit);
}

function fullName(first, last) {
  return [first, last].filter(Boolean).join(' ').trim() || '—';
}

function iso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Parse tenant plan price into monthly USD for billing rollup. */
function parseMonthlyPlanPrice(plan) {
  if (!plan) return 0;
  const cycle = resolveBillingCycle(plan.billingCycle || plan.pricePeriod);
  const template = getDefaultPackageTemplate(plan.slug, plan.name);
  const parseMoney = (value) => Number(String(value || '').replace(/[^0-9.]/g, '')) || 0;

  if (cycle === 'annual') {
    const monthly =
      parseMoney(plan.yearlyPrice) ||
      parseMoney(plan.price || plan.amount) ||
      (template ? parseMoney(template.yearlyPrice) : 0);
    return monthly > 0 ? Math.round(monthly * 100) / 100 : 0;
  }

  const monthly =
    parseMoney(plan.price || plan.amount) ||
    (template ? parseMoney(template.price) : 0);
  return monthly > 0 ? Math.round(monthly * 100) / 100 : 0;
}

/** Spec §7.1 — per-tenant health 0–100 from activity (7d first, then all-time so older estates are not 0). */
function tenantHealthScore(row) {
  let score = 0;
  if ((row.openJobs || 0) > 0 || (row.jobs || 0) > 0) score += 25;
  if ((row.applications7d || 0) > 0 || (row.applications || 0) > 0) score += 25;
  if ((row.interviews || 0) > 0 || (row.interviewsToday || 0) > 0) score += 20;
  if ((row.placements || 0) > 0 || (row.placementsJoined || 0) > 0) score += 20;
  if (
    (row.applications7d || 0) > 0 ||
    (row.openJobs || 0) > 0 ||
    (row.candidates || 0) > 0 ||
    (row.applications || 0) > 0
  ) {
    score += 10;
  }
  return Math.min(100, score);
}

function pct(part, whole) {
  if (!whole) return 0;
  return Math.round((Number(part) / Number(whole)) * 1000) / 10;
}

function formatDurationShort(ms) {
  if (ms == null || !Number.isFinite(Number(ms)) || Number(ms) <= 0) return '—';
  const totalSec = Math.round(Number(ms) / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const mins = Math.floor(totalSec / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hours}h ${rem}m` : `${hours}h`;
}

function normalizeSkillList(skills) {
  if (!Array.isArray(skills)) {
    if (typeof skills === 'string' && skills.trim()) {
      return skills
        .split(/[,|]/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }
  const out = [];
  for (const item of skills) {
    if (!item) continue;
    if (typeof item === 'string') {
      const s = item.trim();
      if (s) out.push(s);
      continue;
    }
    const name = String(item.name || item.skill || item.label || item.title || '').trim();
    if (name) out.push(name);
  }
  return out;
}

function resolveSessionDurationMs(row, nowMs, { online = false } = {}) {
  const loginAt = row.loginAt || row.createdAt;
  const loginMs = loginAt ? new Date(loginAt).getTime() : NaN;
  if (typeof row.durationMs === 'number' && row.durationMs > 0 && row.logoutAt) {
    return Math.round(row.durationMs);
  }
  if (row.logoutAt && Number.isFinite(loginMs)) {
    const endMs = new Date(row.logoutAt).getTime();
    if (Number.isFinite(endMs) && endMs >= loginMs) return Math.round(endMs - loginMs);
  }
  if (online && Number.isFinite(loginMs)) {
    return Math.max(0, Math.round(nowMs - loginMs));
  }
  const lastSeenRaw = row.lastUsedAt;
  if (lastSeenRaw && Number.isFinite(loginMs)) {
    const lastMs = new Date(lastSeenRaw).getTime();
    if (Number.isFinite(lastMs) && lastMs >= loginMs) return Math.round(lastMs - loginMs);
  }
  if (typeof row.durationMs === 'number' && row.durationMs > 0) {
    return Math.min(MAX_OPEN_SESSION_DURATION_MS, Math.round(row.durationMs));
  }
  return null;
}

async function safe(label, fn, fallback) {
  try {
    return await fn();
  } catch (error) {
    console.warn(`[hq-analytics] ${label}:`, error?.message || error);
    return fallback;
  }
}

async function countModel(client, model, where = {}) {
  if (!client?.[model]?.count) return 0;
  return client[model].count({ where });
}

/** Phase-2 schema CandidateStatus — portal Mongo often has null/missing status. */
const CANDIDATE_STATUS_ENUM = ['NEW', 'ACTIVE', 'PLACED', 'INACTIVE', 'BLACKLISTED'];

async function groupByModel(client, model, args) {
  if (!client?.[model]?.groupBy) return [];
  return client[model].groupBy(args);
}

/**
 * groupBy on enum fields crashes Prisma Mongo when any row has null/missing value.
 * Restrict to known enum members so nulls are excluded from the aggregation.
 */
async function groupByEnumField(client, model, field, enumValues, where = {}) {
  if (!client?.[model]?.groupBy || !enumValues?.length) return [];
  const rows = await client[model].groupBy({
    by: [field],
    where: {
      AND: [where || {}, { [field]: { in: enumValues } }],
    },
    _count: { _all: true },
  });
  return (rows || []).filter((row) => row?.[field] != null);
}

function buildTimeSeries(dates, months = 6) {
  const keys = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  const counts = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const raw of dates) {
    const key = monthKey(raw);
    if (key && key in counts) counts[key] += 1;
  }
  return keys.map((name) => ({ name, value: counts[name] }));
}

function buildDailySeries(dates, days = 14) {
  const keys = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    keys.push(dayKey(daysAgo(i)));
  }
  const counts = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const raw of dates) {
    const key = dayKey(raw);
    if (key && key in counts) counts[key] += 1;
  }
  return keys.map((name) => ({
    name: name.slice(5),
    value: counts[name],
  }));
}

async function getPortalMongoDb() {
  const url = String(env.JOB_PORTAL_DATABASE_URL || env.DATABASE_URL || '').trim();
  if (!url) return null;
  if (!portalMongoClient) {
    portalMongoClient = new MongoClient(url);
    await portalMongoClient.connect();
  }
  return portalMongoClient.db();
}

async function countCollection(db, name, filter = {}) {
  if (!db) return 0;
  try {
    return await db.collection(name).countDocuments(filter);
  } catch {
    return 0;
  }
}

async function sampleCollection(db, name, { filter = {}, sort = { createdAt: -1 }, limit = 200, project } = {}) {
  if (!db) return [];
  try {
    let cursor = db.collection(name).find(filter).sort(sort).limit(limit);
    if (project) cursor = cursor.project(project);
    return await cursor.toArray();
  } catch {
    return [];
  }
}

async function aggregateGroup(db, name, field) {
  if (!db) return [];
  try {
    return await db
      .collection(name)
      .aggregate([{ $group: { _id: `$${field}`, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 12 }])
      .toArray();
  } catch {
    return [];
  }
}

async function buildEmployeeAnalytics() {
  const portal = getJobPortalPrismaClient();
  const common = getCandidateCommonPrismaClient();
  const mongo = await safe('portal.mongo', () => getPortalMongoDb(), null);
  const since1 = daysAgo(1);
  const since7 = daysAgo(7);
  const since30 = daysAgo(30);
  const softWhere = notSoftDeletedWhere();

  const [
    totalCandidates,
    new1d,
    new7d,
    new30d,
    portalJobs,
    openJobs,
    closedJobs,
    jobs1d,
    jobs7d,
    jobs30d,
    applicationTotal,
    applicationActive,
    apps1d,
    apps7d,
    apps30d,
    selectedApps,
    rejectedApps,
    commonCandidates,
    savedJobs,
    interviewRequests,
    interviewPending,
    interviewCompleted,
    cvAnalyses,
    lmsEnrollments,
    aiMatches,
    candidatesSample,
    applicationsSample,
    jobsSample,
    statusGroups,
    sourceGroups,
    appStatusGroups,
    jobStatusGroups,
    interviewRequestRows,
    cvAnalysisRows,
    savedJobRows,
  ] = await Promise.all([
    safe('portal.candidate.count', () => countModel(portal, 'candidate', softWhere), 0),
    safe(
      'portal.candidate.new1d',
      () => countModel(portal, 'candidate', { AND: [softWhere, { createdAt: { gte: since1 } }] }),
      0,
    ),
    safe(
      'portal.candidate.new7d',
      () => countModel(portal, 'candidate', { AND: [softWhere, { createdAt: { gte: since7 } }] }),
      0,
    ),
    safe(
      'portal.candidate.new30d',
      () => countModel(portal, 'candidate', { AND: [softWhere, { createdAt: { gte: since30 } }] }),
      0,
    ),
    safe('portal.job.count', () => countModel(portal, 'job', softWhere), 0),
    safe(
      'portal.job.open',
      () => countModel(portal, 'job', { AND: [softWhere, { status: 'OPEN' }] }),
      0,
    ),
    safe(
      'portal.job.closed',
      () =>
        countModel(portal, 'job', {
          AND: [softWhere, { status: { in: ['CLOSED', 'FILLED', 'ON_HOLD'] } }],
        }),
      0,
    ),
    safe(
      'portal.job.new1d',
      () =>
        countModel(portal, 'job', {
          AND: [softWhere, { OR: [{ postedDate: { gte: since1 } }, { createdAt: { gte: since1 } }] }],
        }),
      0,
    ),
    safe(
      'portal.job.new7d',
      () =>
        countModel(portal, 'job', {
          AND: [softWhere, { OR: [{ postedDate: { gte: since7 } }, { createdAt: { gte: since7 } }] }],
        }),
      0,
    ),
    safe(
      'portal.job.new30d',
      () =>
        countModel(portal, 'job', {
          AND: [softWhere, { OR: [{ postedDate: { gte: since30 } }, { createdAt: { gte: since30 } }] }],
        }),
      0,
    ),
    safe('portal.application.count', () => countModel(portal, 'application', {}), 0),
    safe(
      'portal.application.active',
      () => countModel(portal, 'application', { status: { notIn: ['REJECTED', 'SELECTED'] } }),
      0,
    ),
    safe(
      'portal.application.1d',
      () => countModel(portal, 'application', { appliedAt: { gte: since1 } }),
      0,
    ),
    safe(
      'portal.application.7d',
      () => countModel(portal, 'application', { appliedAt: { gte: since7 } }),
      0,
    ),
    safe(
      'portal.application.30d',
      () => countModel(portal, 'application', { appliedAt: { gte: since30 } }),
      0,
    ),
    safe(
      'portal.application.selected',
      () => countModel(portal, 'application', { status: 'SELECTED' }),
      0,
    ),
    safe(
      'portal.application.rejected',
      () => countModel(portal, 'application', { status: 'REJECTED' }),
      0,
    ),
    safe(
      'common.candidateCommon.count',
      async () => (common?.candidateCommon?.count ? common.candidateCommon.count({}) : 0),
      0,
    ),
    safe('mongo.saved_jobs', () => countCollection(mongo, 'saved_jobs'), 0),
    safe('mongo.interview_requests', () => countCollection(mongo, 'interview_requests'), 0),
    safe(
      'mongo.interview_requests.pending',
      () =>
        countCollection(mongo, 'interview_requests', {
          status: { $in: ['PENDING_MATCHING', 'MATCHED', 'PENDING', 'SCHEDULED'] },
        }),
      0,
    ),
    safe(
      'mongo.interview_requests.completed',
      () => countCollection(mongo, 'interview_requests', { status: 'COMPLETED' }),
      0,
    ),
    safe('mongo.cv_analyses', () => countCollection(mongo, 'cv_analyses'), 0),
    safe('mongo.lms_enrollments', () => countCollection(mongo, 'lms_enrollments'), 0),
    safe('mongo.ai_job_matches', () => countCollection(mongo, 'ai_job_matches'), 0),
    safe(
      'portal.candidate.sample',
      () =>
        portal.candidate.findMany({
          where: softWhere,
          orderBy: { updatedAt: 'desc' },
          take: SAMPLE_LIMIT,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            // Avoid selecting required enum `status` — portal rows often have null and Prisma can throw
            recruiterStatus: true,
            source: true,
            stage: true,
            location: true,
            city: true,
            country: true,
            skills: true,
            experience: true,
            experienceYears: true,
            resumeUrl: true,
            resume: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
      [],
    ),
    safe(
      'portal.application.sample',
      () =>
        portal.application.findMany({
          orderBy: { appliedAt: 'desc' },
          take: Math.min(1500, SAMPLE_LIMIT),
          select: {
            id: true,
            status: true,
            matchScore: true,
            appliedAt: true,
            candidateId: true,
            jobId: true,
            candidate: { select: { firstName: true, lastName: true, email: true } },
            job: { select: { title: true, status: true, location: true, city: true } },
          },
        }),
      [],
    ),
    safe(
      'portal.job.sample',
      () =>
        portal.job.findMany({
          where: softWhere,
          orderBy: { updatedAt: 'desc' },
          take: 400,
          select: {
            id: true,
            title: true,
            status: true,
            location: true,
            city: true,
            openings: true,
            workMode: true,
            updatedAt: true,
            createdAt: true,
            postedDate: true,
          },
        }),
      [],
    ),
    safe(
      'portal.candidate.groupBy.status',
      () => groupByEnumField(portal, 'candidate', 'status', CANDIDATE_STATUS_ENUM, softWhere),
      [],
    ),
    safe(
      'portal.candidate.groupBy.source',
      () =>
        groupByModel(portal, 'candidate', {
          by: ['source'],
          // Mongo optional fields: use isSet, not `{ not: null }`
          where: { AND: [softWhere, { source: { isSet: true } }] },
          _count: { _all: true },
        }),
      [],
    ),
    safe(
      'portal.application.groupBy.status',
      () => groupByModel(portal, 'application', { by: ['status'], _count: { _all: true } }),
      [],
    ),
    safe(
      'portal.job.groupBy.status',
      () => groupByModel(portal, 'job', { by: ['status'], where: softWhere, _count: { _all: true } }),
      [],
    ),
    safe(
      'mongo.interview_requests.sample',
      () =>
        sampleCollection(mongo, 'interview_requests', {
          sort: { createdAt: -1 },
          limit: 300,
          project: {
            status: 1,
            targetRole: 1,
            category: 1,
            difficulty: 1,
            createdAt: 1,
            matchingScore: 1,
            preferredDate: 1,
          },
        }),
      [],
    ),
    safe(
      'mongo.cv_analyses.sample',
      () =>
        sampleCollection(mongo, 'cv_analyses', {
          sort: { analyzedAt: -1 },
          limit: 400,
          project: { cvScore: 1, atsScore: 1, analyzedAt: 1, candidateId: 1 },
        }),
      [],
    ),
    safe(
      'mongo.saved_jobs.sample',
      () => sampleCollection(mongo, 'saved_jobs', { sort: { savedAt: -1 }, limit: 200 }),
      [],
    ),
  ]);

  const locationMap = {};
  const skillMap = {};
  const statusMap = {};
  const sourceMap = {};
  const experienceMap = {};
  let withSkills = 0;
  let resumesUploaded = 0;
  let profileCompletenessSum = 0;
  let profileCompletenessN = 0;

  for (const row of statusGroups || []) bump(statusMap, row.status || 'Unknown', row._count?._all || 0);
  for (const row of sourceGroups || []) bump(sourceMap, row.source || 'Unknown', row._count?._all || 0);

  for (const c of candidatesSample || []) {
    const sampleStatus = c.status || c.recruiterStatus || c.stage || 'Unknown';
    if (!statusGroups?.length) bump(statusMap, sampleStatus);
    if (!sourceGroups?.length) bump(sourceMap, c.source || 'Unknown');
    bump(locationMap, c.city || c.location || c.country || 'Unknown');
    const years = c.experienceYears ?? c.experience;
    if (typeof years === 'number' && Number.isFinite(years)) {
      if (years < 2) bump(experienceMap, '0-2 yrs');
      else if (years < 5) bump(experienceMap, '2-5 yrs');
      else if (years < 10) bump(experienceMap, '5-10 yrs');
      else bump(experienceMap, '10+ yrs');
    }
    const skills = normalizeSkillList(c.skills);
    if (skills.length) {
      withSkills += 1;
      for (const skill of skills) bump(skillMap, skill);
    }
    if (String(c.resumeUrl || c.resume || '').trim()) resumesUploaded += 1;
    if (typeof c.profileCompleteness === 'number' && Number.isFinite(c.profileCompleteness)) {
      profileCompletenessSum += Math.max(0, Math.min(100, c.profileCompleteness));
      profileCompletenessN += 1;
    }
  }

  const appStatusMap = {};
  const jobAppCounts = {};
  const matchBuckets = { '0-40': 0, '41-60': 0, '61-80': 0, '81-100': 0 };
  let matchScoreSum = 0;
  let matchScoreN = 0;
  let screeningStuck = 0;

  for (const row of appStatusGroups || []) bump(appStatusMap, row.status || 'Unknown', row._count?._all || 0);
  for (const app of applicationsSample || []) {
    if (!appStatusGroups?.length) bump(appStatusMap, app.status || 'Unknown');
    bump(jobAppCounts, app.job?.title || app.jobId || 'Unknown');
    if (typeof app.matchScore === 'number') {
      matchScoreSum += app.matchScore;
      matchScoreN += 1;
      if (app.matchScore <= 40) matchBuckets['0-40'] += 1;
      else if (app.matchScore <= 60) matchBuckets['41-60'] += 1;
      else if (app.matchScore <= 80) matchBuckets['61-80'] += 1;
      else matchBuckets['81-100'] += 1;
    }
    if (['SUBMITTED', 'UNDER_REVIEW', 'ASSESSMENT'].includes(String(app.status || ''))) {
      screeningStuck += 1;
    }
  }

  const jobStatusMap = {};
  for (const row of jobStatusGroups || []) bump(jobStatusMap, row.status || 'Unknown', row._count?._all || 0);
  if (!jobStatusGroups?.length) {
    for (const j of jobsSample || []) bump(jobStatusMap, j.status || 'Unknown');
  }

  const interviewStatusMap = {};
  for (const row of interviewRequestRows || []) bump(interviewStatusMap, row.status || 'Unknown');
  if (!Object.keys(interviewStatusMap).length) {
    const grouped = await safe('mongo.interview_requests.group', () => aggregateGroup(mongo, 'interview_requests', 'status'), []);
    for (const g of grouped) bump(interviewStatusMap, g._id || 'Unknown', g.count || 0);
  }

  let cvScoreSum = 0;
  let cvScoreN = 0;
  let atsScoreSum = 0;
  let atsScoreN = 0;
  for (const row of cvAnalysisRows || []) {
    if (typeof row.cvScore === 'number') {
      cvScoreSum += row.cvScore;
      cvScoreN += 1;
    }
    if (typeof row.atsScore === 'number') {
      atsScoreSum += row.atsScore;
      atsScoreN += 1;
    }
  }

  const avgMatchScore = matchScoreN > 0 ? Math.round((matchScoreSum / matchScoreN) * 10) / 10 : null;
  const avgCvScore = cvScoreN > 0 ? Math.round((cvScoreSum / cvScoreN) * 10) / 10 : null;
  const avgAtsScore = atsScoreN > 0 ? Math.round((atsScoreSum / atsScoreN) * 10) / 10 : null;
  const profileCompleteness =
    profileCompletenessN > 0
      ? Math.round(profileCompletenessSum / profileCompletenessN)
      : candidatesSample?.length
        ? Math.round(
            ((withSkills + resumesUploaded) / (2 * Math.max(candidatesSample.length, 1))) * 100,
          )
        : 0;

  const applicationsByStatus = [
    'SUBMITTED',
    'UNDER_REVIEW',
    'SHORTLISTED',
    'ASSESSMENT',
    'INTERVIEW',
    'FINAL_DECISION',
    'SELECTED',
    'REJECTED',
  ].map((name) => ({ name, value: appStatusMap[name] || 0 }));

  const recentCandidates = (candidatesSample || []).slice(0, 20).map((c) => ({
    id: c.id,
    name: fullName(c.firstName, c.lastName),
    email: c.email || '',
    status: String(c.status || c.recruiterStatus || c.stage || '—'),
    source: c.source || '—',
    location: c.city || c.location || c.country || '—',
    stage: c.stage || '',
    skills: (c.skills || []).slice(0, 4).join(', '),
    experience: c.experienceYears ?? c.experience ?? null,
    updatedAt: iso(c.updatedAt),
    createdAt: iso(c.createdAt),
  }));

  const recentApplications = (applicationsSample || []).slice(0, 20).map((a) => ({
    id: a.id,
    candidate: fullName(a.candidate?.firstName, a.candidate?.lastName),
    email: a.candidate?.email || '',
    job: a.job?.title || '—',
    status: String(a.status || '—'),
    matchScore: typeof a.matchScore === 'number' ? a.matchScore : null,
    appliedAt: iso(a.appliedAt),
  }));

  const jobSelectedCounts = {};
  const jobMatchSums = {};
  const jobMatchNs = {};
  for (const app of applicationsSample || []) {
    const title = app.job?.title || app.jobId || 'Unknown';
    if (String(app.status || '').toUpperCase() === 'SELECTED') bump(jobSelectedCounts, title);
    if (typeof app.matchScore === 'number') {
      jobMatchSums[title] = (jobMatchSums[title] || 0) + app.matchScore;
      jobMatchNs[title] = (jobMatchNs[title] || 0) + 1;
    }
  }

  const topJobsByApplications = toChartArray(jobAppCounts, { limit: 12 }).map((row) => {
    const job = (jobsSample || []).find((j) => j.title === row.name);
    const matchN = jobMatchNs[row.name] || 0;
    const selected = jobSelectedCounts[row.name] || 0;
    return {
      title: row.name,
      applications: row.value,
      status: job?.status || '—',
      location: job?.city || job?.location || '—',
      openings: job?.openings ?? null,
      avgMatchScore: matchN > 0 ? Math.round(jobMatchSums[row.name] / matchN) : null,
      selected,
      joined: selected,
    };
  });

  const recentOpenJobs = (jobsSample || [])
    .filter((j) => String(j.status || '').toUpperCase() === 'OPEN')
    .slice(0, 15)
    .map((j) => ({
      id: j.id,
      title: j.title || '—',
      status: String(j.status || '—'),
      location: j.city || j.location || '—',
      workMode: j.workMode || '—',
      openings: j.openings ?? 1,
      postedDate: iso(j.postedDate || j.createdAt),
      updatedAt: iso(j.updatedAt),
    }));

  const recentInterviewRequests = (interviewRequestRows || []).slice(0, 15).map((row) => ({
    role: row.targetRole || row.category || '—',
    status: row.status || '—',
    difficulty: row.difficulty || '—',
    matchingScore: typeof row.matchingScore === 'number' ? Math.round(row.matchingScore) : null,
    preferredDate: iso(row.preferredDate),
    createdAt: iso(row.createdAt),
  }));

  // Phase 1 login / session analytics (device + geo)
  const sessionRows = await safe(
    'mongo.sessions.sample',
    () =>
      sampleCollection(mongo, 'sessions', {
        sort: { loginAt: -1, createdAt: -1 },
        limit: Math.min(SAMPLE_LIMIT, 1200),
        project: {
          candidateId: 1,
          loginAt: 1,
          logoutAt: 1,
          createdAt: 1,
          lastUsedAt: 1,
          durationMs: 1,
          deviceType: 1,
          browser: 1,
          operatingSystem: 1,
          country: 1,
          state: 1,
          city: 1,
          timezone: 1,
          isActive: 1,
          ipAddress: 1,
          userAgent: 1,
        },
      }),
    [],
  );

  const countryLoginMap = {};
  const stateLoginMap = {};
  const cityLoginMap = {};
  const deviceLoginMap = {};
  const browserLoginMap = {};
  let logins1d = 0;
  let logins7d = 0;
  let logins30d = 0;
  let activeSessions = 0;
  let durationSum = 0;
  let durationN = 0;
  const nowMs = Date.now();
  const uniqueActiveCandidates = new Set();

  for (const row of sessionRows || []) {
    const loginAt = row.loginAt || row.createdAt;
    const loginMs = loginAt ? new Date(loginAt).getTime() : NaN;
    if (Number.isFinite(loginMs)) {
      if (loginMs >= since1.getTime()) logins1d += 1;
      if (loginMs >= since7.getTime()) logins7d += 1;
      if (loginMs >= since30.getTime()) logins30d += 1;
    }

    const lastSeenRaw = row.lastUsedAt || row.logoutAt || loginAt;
    const lastSeenMs = lastSeenRaw ? new Date(lastSeenRaw).getTime() : NaN;
    const looksOpen = row.isActive !== false && !row.logoutAt;
    const recentlySeen =
      Number.isFinite(lastSeenMs) && nowMs - lastSeenMs <= ONLINE_SESSION_WINDOW_MS;
    const isOnlineNow = looksOpen && recentlySeen;
    if (isOnlineNow) {
      activeSessions += 1;
      if (row.candidateId) uniqueActiveCandidates.add(String(row.candidateId));
    }

    const duration = resolveSessionDurationMs(row, nowMs, { online: isOnlineNow });
    if (typeof duration === 'number' && duration > 0 && (row.logoutAt || isOnlineNow)) {
      durationSum += duration;
      durationN += 1;
    }

    if (row.country) bump(countryLoginMap, row.country);
    if (row.state || row.timezone) bump(stateLoginMap, row.state || row.timezone);
    if (row.city) bump(cityLoginMap, row.city);
    if (row.deviceType) bump(deviceLoginMap, row.deviceType);
    if (row.browser) bump(browserLoginMap, row.browser);
  }

  const totalSessionsTracked = (sessionRows || []).length;
  const avgSessionDurationMs = durationN > 0 ? Math.round(durationSum / durationN) : null;

  const candidateNameById = {};
  for (const c of candidatesSample || []) {
    candidateNameById[c.id] = fullName(c.firstName, c.lastName);
  }

  const recentSessions = (sessionRows || []).slice(0, 20).map((row) => {
    const loginAt = row.loginAt || row.createdAt;
    const lastSeenRaw = row.lastUsedAt || row.logoutAt || loginAt;
    const lastSeenMs = lastSeenRaw ? new Date(lastSeenRaw).getTime() : NaN;
    const looksOpen = row.isActive !== false && !row.logoutAt;
    const isOnlineNow =
      looksOpen &&
      Number.isFinite(lastSeenMs) &&
      nowMs - lastSeenMs <= ONLINE_SESSION_WINDOW_MS;
    const isIdleOpen = looksOpen && !isOnlineNow;
    const durationMs = resolveSessionDurationMs(row, nowMs, { online: isOnlineNow });
    return {
      candidateId: row.candidateId || '',
      candidate: candidateNameById[row.candidateId] || '—',
      loginAt: iso(loginAt),
      logoutAt: iso(row.logoutAt),
      durationMs: durationMs ?? 0,
      deviceType: row.deviceType || '—',
      browser: row.browser || '—',
      operatingSystem: row.operatingSystem || '—',
      country: row.country || '—',
      state: row.state || '—',
      city: row.city || '—',
      isActive: isOnlineNow,
      status: isOnlineNow ? 'online' : isIdleOpen ? 'idle' : 'closed',
    };
  });

  const sessionOnline = uniqueActiveCandidates.size || activeSessions;
  const [liveTrackingRaw, officeGossip, tokenUsage] = await Promise.all([
    fetchPhase1LiveBehaviorAggregate(),
    fetchOfficeGossipsHqSummary(),
    fetchPhase1TokenUsageAggregate(),
  ]);

  function withOfficeGossip(base) {
    if (!base) return null;
    const next = { ...base, officeGossip: officeGossip || null };
    if (officeGossip) {
      next.communityBehavior = [
        {
          name: 'Users on Office Gossip',
          value: Number(officeGossip.usersOnOfficeGossip) || 0,
        },
        {
          name: 'Ref checks initiated',
          value: Number(officeGossip.referenceChecksSummary?.initiated) || 0,
        },
        {
          name: 'Ref checks responded',
          value: Number(officeGossip.referenceChecksSummary?.responded) || 0,
        },
        {
          name: 'Ref checks completed',
          value: Number(officeGossip.referenceChecksSummary?.completed) || 0,
        },
        {
          name: 'Open for reference',
          value: Number(officeGossip.openForReference) || 0,
        },
      ].filter((r) => r.value > 0);
    }
    return next;
  }

  function withTokenUsage(base) {
    if (!base) return null;
    const next = { ...base, tokenUsage: tokenUsage || null };

    const sanitizePopular = (rows) =>
      (rows || [])
        .filter((row) => row && !isHqInsightFeatureLabel(row.name))
        .map((row) => ({
          name: String(row.name),
          value: row.value,
          kind: row.kind,
          tokens: row.tokens,
        }));

    if (!tokenUsage?.available) {
      next.popularFeatures = sanitizePopular(base.popularFeatures);
      return next;
    }

    if (tokenUsage.premiumServicesUsage?.length) {
      next.premiumServicesUsage = tokenUsage.premiumServicesUsage.map((row) => ({
        name: row.name,
        value: row.value,
        tokens: row.tokens,
        kind: 'premium',
      }));
      next.premiumVisits7d = tokenUsage.premiumSpendEvents || next.premiumVisits7d;
      next.premiumTokensSpent7d = tokenUsage.premiumTokensSpent || 0;
    }

    const premiumRows = (tokenUsage.premiumServicesUsage || []).map((row) => ({
      name: `Paid · ${row.name}`,
      value: row.value,
      kind: 'premium',
    }));
    const earnRows = (tokenUsage.earnFeatures || []).map((row) => ({
      name: `Free · ${row.name}`,
      value: row.value,
      kind: 'earn',
    }));
    const freeRows = (base.pageVisitsByCategory || [])
      .filter((row) => {
        const cat = String(row.category || '').toLowerCase();
        if (!cat || cat === 'other') return false;
        return Boolean(FEATURE_SURFACE_LABELS[cat] || FREE_PORTAL_FEATURE_CATEGORIES.has(cat));
      })
      .map((row) => {
        const cat = String(row.category || '').toLowerCase();
        const meta = featureSurfaceLabel(cat) || {
          name: String(row.name),
          kind: 'free',
        };
        const tag =
          meta.kind === 'paid' ? 'Paid' : meta.kind === 'mixed' ? 'Free / paid' : 'Free';
        return {
          name: `${tag} · ${meta.name}`,
          value: row.value,
          kind: meta.kind,
        };
      });
    const surfaceRows = sanitizePopular(base.popularFeatures);

    const mergedPopular = [...premiumRows, ...earnRows, ...freeRows, ...surfaceRows];
    const byName = new Map();
    for (const row of mergedPopular) {
      if (isHqInsightFeatureLabel(row.name)) continue;
      const key = String(row.name);
      const prev = byName.get(key);
      if (!prev || row.value > prev.value) byName.set(key, row);
    }
    next.popularFeatures = [...byName.values()]
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);

    return next;
  }

  let liveTracking = withTokenUsage(withOfficeGossip(liveTrackingRaw));
  if (!liveTracking && officeGossip) {
    liveTracking = withTokenUsage(
      withOfficeGossip({
        available: true,
        source: 'office_gossips_bundle',
        trackedUsers: 0,
        onlineNow: sessionOnline,
        totalActiveMs7d: 0,
        totalVisits7d: 0,
        totalApplies7d: 0,
        totalJobClicks7d: 0,
        totalLogins7d: 0,
        totalSessions7d: 0,
        avgActiveMsPerUser7d: 0,
        premiumVisits7d: 0,
        communityVisits7d: 0,
        pageVisitsByCategory: [],
        premiumServicesUsage: [],
        popularFeatures: [],
        entryPoints: [],
        topInterests: [],
        trendingTopics: [],
        topTriggers: [],
        liveFeed: [],
        capturedAt: officeGossip.updatedAt || new Date().toISOString(),
        communityBehavior: [],
      }),
    );
  }
  if (liveTracking) {
    liveTracking.totalApplies7d = firstPositive(
      liveTracking.totalApplies7d,
      apps7d,
      apps30d,
      applicationTotal,
    );
    liveTracking.totalJobClicks7d = firstPositive(liveTracking.totalJobClicks7d, aiMatches, savedJobs);
    liveTracking.totalLogins7d = firstPositive(liveTracking.totalLogins7d, logins7d, logins30d);
    liveTracking.totalSessions7d = firstPositive(
      liveTracking.totalSessions7d,
      totalSessionsTracked,
    );
    liveTracking.totalVisits7d = firstPositive(
      liveTracking.totalVisits7d,
      liveTracking.totalLogins7d,
      liveTracking.totalApplies7d,
      logins7d,
    );
    liveTracking.totalActiveMs7d = firstPositive(
      liveTracking.totalActiveMs7d,
      avgSessionDurationMs && (logins7d || totalSessionsTracked)
        ? avgSessionDurationMs * (logins7d || totalSessionsTracked)
        : 0,
    );
    liveTracking.trackedUsers = firstPositive(liveTracking.trackedUsers, liveTracking.liveFeed?.length);
  }
  const onlineNow = liveTracking?.available
    ? Math.max(Number(liveTracking.onlineNow) || 0, sessionOnline)
    : sessionOnline;

  const insights = [];
  insights.push({
    tone: 'info',
    text: `Live Phase 1 snapshot: ${totalCandidates} candidates · ${applicationTotal} applications · ${apps1d} applied today.`,
  });
  if (liveTracking?.available) {
    insights.push({
      tone: 'good',
      text: `Live tracker: ${liveTracking.onlineNow} online now · ${liveTracking.trackedUsers} tracked · ${Math.round((liveTracking.totalActiveMs7d || 0) / 60000)}m active (7d) · ${liveTracking.totalApplies7d} applies · ${liveTracking.totalJobClicks7d} job clicks.`,
    });
  } else if (logins7d > 0 || onlineNow > 0) {
    insights.push({
      tone: 'good',
      text: `Sessions: ${logins7d} logins in 7d · ${onlineNow} active now · avg duration ${
        avgSessionDurationMs != null ? formatDurationShort(avgSessionDurationMs) : '—'
      }.`,
    });
  }
  if (new7d > 0) {
    insights.push({
      tone: 'good',
      text: `${new7d} new candidates in 7 days (${new1d} in last 24h).`,
    });
  } else if (totalCandidates === 0) {
    insights.push({
      tone: 'warn',
      text: 'No Phase 1 portal candidates found — check JOB_PORTAL_DATABASE_URL.',
    });
  }
  if (applicationTotal > 0) {
    insights.push({
      tone: screeningStuck / Math.max(applicationsSample.length, 1) > 0.45 ? 'warn' : 'info',
      text: `${pct(screeningStuck, applicationsSample.length || 1)}% of recent applications still in screening/review.`,
    });
  }
  if (avgMatchScore != null) {
    insights.push({
      tone: avgMatchScore >= 70 ? 'good' : 'warn',
      text: `Average application match score ${avgMatchScore}/100 · CV avg ${avgCvScore ?? '—'} · ATS avg ${avgAtsScore ?? '—'}.`,
    });
  }
  if (interviewRequests > 0) {
    insights.push({
      tone: 'info',
      text: `${interviewRequests} interview requests (${interviewPending} open · ${interviewCompleted} completed).`,
    });
  }
  if (savedJobs > 0 || lmsEnrollments > 0) {
    insights.push({
      tone: 'good',
      text: `Engagement: ${savedJobs} saved jobs · ${lmsEnrollments} LMS enrollments · ${aiMatches} AI job matches.`,
    });
  }
  if (openJobs === 0 && portalJobs > 0) {
    insights.push({
      tone: 'warn',
      text: `${portalJobs} portal jobs exist but none are OPEN.`,
    });
  }

  return {
    available: true,
    live: true,
    kpis: {
      totalCandidates,
      commonCandidates,
      new1d,
      new7d,
      new30d,
      portalJobs,
      openJobs,
      closedJobs,
      jobsPostedToday: jobs1d,
      jobsPosted7d: jobs7d,
      jobsPosted30d: jobs30d,
      applications: applicationTotal,
      activeApplications: applicationActive,
      applicationsToday: apps1d,
      applications7d: apps7d,
      applications30d: apps30d,
      selectedApplications: selectedApps,
      rejectedApplications: rejectedApps,
      avgMatchScore,
      avgCvScore,
      avgAtsScore,
      savedJobs,
      interviewRequests,
      interviewPending,
      interviewCompleted,
      cvAnalyses,
      lmsEnrollments,
      aiMatches,
      profileCompleteness,
      resumesUploaded,
      candidatesWithSkills: withSkills,
      loginsToday: logins1d,
      logins7d,
      logins30d,
      activeSessions: onlineNow,
      totalSessionsTracked,
      avgSessionDurationMs,
      liveTrackedUsers: liveTracking?.trackedUsers ?? 0,
      liveVisits7d: liveTracking?.totalVisits7d ?? 0,
      liveApplies7d: liveTracking?.totalApplies7d ?? 0,
      liveJobClicks7d: liveTracking?.totalJobClicks7d ?? 0,
      liveActiveMs7d: liveTracking?.totalActiveMs7d ?? 0,
    },
    liveTracking: liveTracking || {
      available: true,
      source: 'portal_db_sessions',
      trackedUsers: 0,
      onlineNow,
      totalActiveMs7d:
        avgSessionDurationMs && (logins7d || totalSessionsTracked)
          ? avgSessionDurationMs * (logins7d || totalSessionsTracked)
          : 0,
      totalVisits7d: firstPositive(logins7d, logins30d),
      totalApplies7d: firstPositive(apps7d, apps30d, applicationTotal),
      totalJobClicks7d: firstPositive(aiMatches, savedJobs),
      totalLogins7d: logins7d,
      totalSessions7d: totalSessionsTracked,
      avgActiveMsPerUser7d: avgSessionDurationMs || 0,
      pageVisitsByCategory: [],
      topTriggers: [],
      liveFeed: [],
      capturedAt: new Date().toISOString(),
    },
    charts: {
      applicationsByStatus,
      candidatesOverTime: buildTimeSeries((candidatesSample || []).map((c) => c.createdAt).filter(Boolean)),
      applicationsOverTime: buildTimeSeries((applicationsSample || []).map((a) => a.appliedAt).filter(Boolean)),
      candidatesDaily: buildDailySeries((candidatesSample || []).map((c) => c.createdAt).filter(Boolean)),
      applicationsDaily: buildDailySeries((applicationsSample || []).map((a) => a.appliedAt).filter(Boolean)),
      candidatesByStatus: toChartArray(statusMap),
      candidatesBySource: toChartArray(sourceMap),
      topLocations: toChartArray(locationMap),
      topSkills: toChartArray(skillMap, { limit: 40 }),
      experienceBands: toChartArray(experienceMap),
      jobsByStatus: toChartArray(jobStatusMap),
      matchScoreBuckets: Object.entries(matchBuckets).map(([name, value]) => ({ name, value })),
      interviewRequestsByStatus: toChartArray(interviewStatusMap),
      loginsByCountry: toChartArray(countryLoginMap, { limit: 12 }),
      loginsByState: toChartArray(stateLoginMap, { limit: 12 }),
      loginsByCity: toChartArray(cityLoginMap, { limit: 12 }),
      loginsByDevice: toChartArray(deviceLoginMap),
      loginsByBrowser: toChartArray(browserLoginMap),
      loginsOverTime: buildTimeSeries((sessionRows || []).map((s) => s.loginAt || s.createdAt).filter(Boolean)),
      loginsDaily: buildDailySeries((sessionRows || []).map((s) => s.loginAt || s.createdAt).filter(Boolean)),
    },
    tables: {
      recentCandidates,
      recentApplications,
      topJobsByApplications,
      recentOpenJobs,
      recentInterviewRequests,
      recentSessions,
    },
    insights,
  };
}

async function tenantActivitySnapshot(tenant) {
  const tenantDbName = String(tenant?.tenantDbName || '').trim();
  const base = {
    tenantDbName: tenantDbName || '',
    name: tenant?.name || tenantDbName || '—',
    email: tenant?.email || '',
    organizationType: tenant?.organizationType || 'agency',
    plan: tenant?.subscriptionPlan?.name || 'Unassigned',
    status: tenant?.status || 'ACTIVE',
    signupSource: tenant?.signupSource || '',
    jobs: 0,
    openJobs: 0,
    closedJobs: 0,
    candidates: 0,
    candidates7d: 0,
    applications: 0,
    applications7d: 0,
    interviews: 0,
    interviewsToday: 0,
    interviewsScheduled: 0,
    interviewsCompleted: 0,
    placements: 0,
    placementsJoined: 0,
    clients: 0,
    leads: 0,
    tasks: 0,
    tasksOpen: 0,
    jobStatus: {},
    interviewStatus: {},
    placementStatus: {},
    recentJobs: [],
    recentPlacements: [],
    error: null,
  };

  if (!tenantDbName) return base;

  try {
    return await runWithTenantContext(tenantDbName, async () => {
      const soft = notSoftDeletedWhere();
      const since1 = daysAgo(1);
      const since7 = daysAgo(7);

      const [
        jobs,
        openJobs,
        closedJobs,
        candidates,
        candidates7d,
        applications,
        applications7d,
        interviews,
        interviewsToday,
        interviewsScheduled,
        interviewsCompleted,
        placements,
        placementsJoined,
        clients,
        leads,
        tasks,
        tasksOpen,
        jobStatusGroups,
        interviewStatusGroups,
        placementStatusGroups,
        recentJobs,
        recentPlacements,
      ] = await Promise.all([
        safe('tenant.job', () => countModel(prisma, 'job', soft), 0),
        safe('tenant.job.open', () => countModel(prisma, 'job', { AND: [soft, { status: 'OPEN' }] }), 0),
        safe(
          'tenant.job.closed',
          () =>
            countModel(prisma, 'job', {
              AND: [soft, { status: { in: ['CLOSED', 'FILLED', 'ON_HOLD'] } }],
            }),
          0,
        ),
        safe('tenant.candidate', () => countModel(prisma, 'candidate', soft), 0),
        safe(
          'tenant.candidate.7d',
          () => countModel(prisma, 'candidate', { AND: [soft, { createdAt: { gte: since7 } }] }),
          0,
        ),
        safe('tenant.application', () => countModel(prisma, 'application', {}), 0),
        safe(
          'tenant.application.7d',
          () => countModel(prisma, 'application', { appliedAt: { gte: since7 } }),
          0,
        ),
        safe('tenant.interview', () => countModel(prisma, 'interview', {}), 0),
        safe(
          'tenant.interview.today',
          () =>
            countModel(prisma, 'interview', {
              OR: [{ scheduledAt: { gte: since1 } }, { createdAt: { gte: since1 } }],
            }),
          0,
        ),
        safe(
          'tenant.interview.scheduled',
          () =>
            countModel(prisma, 'interview', {
              status: { in: ['SCHEDULED', 'CONFIRMED', 'RESCHEDULED', 'IN_PROGRESS'] },
            }),
          0,
        ),
        safe(
          'tenant.interview.completed',
          () => countModel(prisma, 'interview', { status: 'COMPLETED' }),
          0,
        ),
        safe('tenant.placement', () => countModel(prisma, 'placement', {}), 0),
        safe(
          'tenant.placement.joined',
          () =>
            countModel(prisma, 'placement', {
              status: { in: ['JOINED', 'ACTIVE', 'COMPLETED', 'OFFER_ACCEPTED'] },
            }),
          0,
        ),
        safe('tenant.client', () => countModel(prisma, 'client', soft), 0),
        safe('tenant.lead', () => countModel(prisma, 'lead', soft), 0),
        safe('tenant.task', () => countModel(prisma, 'task', {}), 0),
        safe(
          'tenant.task.open',
          () =>
            countModel(prisma, 'task', {
              // TaskStatus enum: PENDING | IN_PROGRESS | AWAITING_APPROVAL | DONE | CANCELLED
              status: { in: ['PENDING', 'IN_PROGRESS', 'AWAITING_APPROVAL'] },
            }),
          0,
        ),
        safe(
          'tenant.job.groupBy.status',
          () => groupByModel(prisma, 'job', { by: ['status'], where: soft, _count: { _all: true } }),
          [],
        ),
        safe(
          'tenant.interview.groupBy.status',
          () => groupByModel(prisma, 'interview', { by: ['status'], _count: { _all: true } }),
          [],
        ),
        safe(
          'tenant.placement.groupBy.status',
          () => groupByModel(prisma, 'placement', { by: ['status'], _count: { _all: true } }),
          [],
        ),
        safe(
          'tenant.job.recent',
          () =>
            prisma.job.findMany({
              where: soft,
              orderBy: { updatedAt: 'desc' },
              take: 5,
              select: {
                id: true,
                title: true,
                status: true,
                location: true,
                city: true,
                openings: true,
                updatedAt: true,
                client: { select: { companyName: true } },
              },
            }),
          [],
        ),
        safe(
          'tenant.placement.recent',
          () =>
            prisma.placement.findMany({
              orderBy: { updatedAt: 'desc' },
              take: 5,
              select: {
                id: true,
                status: true,
                salary: true,
                joiningDate: true,
                updatedAt: true,
                candidate: { select: { firstName: true, lastName: true } },
                job: { select: { title: true } },
                client: { select: { companyName: true } },
              },
            }),
          [],
        ),
      ]);

      const jobStatus = {};
      const interviewStatus = {};
      const placementStatus = {};
      for (const row of jobStatusGroups || []) bump(jobStatus, row.status || 'Unknown', row._count?._all || 0);
      for (const row of interviewStatusGroups || []) {
        bump(interviewStatus, row.status || 'Unknown', row._count?._all || 0);
      }
      for (const row of placementStatusGroups || []) {
        bump(placementStatus, row.status || 'Unknown', row._count?._all || 0);
      }

      return {
        ...base,
        jobs,
        openJobs,
        closedJobs,
        candidates,
        candidates7d,
        applications,
        applications7d,
        interviews,
        interviewsToday,
        interviewsScheduled,
        interviewsCompleted,
        placements,
        placementsJoined,
        clients,
        leads,
        tasks,
        tasksOpen,
        jobStatus,
        interviewStatus,
        placementStatus,
        recentJobs: (recentJobs || []).map((j) => ({
          id: j.id,
          title: j.title || '—',
          status: j.status || '—',
          company: j.client?.companyName || '—',
          location: j.city || j.location || '—',
          openings: j.openings ?? 1,
          updatedAt: iso(j.updatedAt),
          tenant: tenant?.name || tenantDbName,
          tenantDbName,
        })),
        recentPlacements: (recentPlacements || []).map((p) => ({
          id: p.id,
          candidate: fullName(p.candidate?.firstName, p.candidate?.lastName),
          job: p.job?.title || '—',
          company: p.client?.companyName || '—',
          status: p.status || '—',
          salary: p.salary ?? null,
          joiningDate: iso(p.joiningDate),
          updatedAt: iso(p.updatedAt),
          tenant: tenant?.name || tenantDbName,
          tenantDbName,
        })),
        error: null,
      };
    });
  } catch (error) {
    return { ...base, error: error?.message || 'Failed to read tenant DB' };
  }
}

async function buildEmployerAnalytics() {
  const listed = await safe('listTenants', () => headquartersAuthService.listTenants(), []);
  const tenants = (listed || []).filter((t) => !isHqSetupAccount(t));

  const [leadResult, companyResult, demoResult, snapshots] = await Promise.all([
    safe('hq.leads', () => hqLeadsService.listLeads(), { leads: [], stats: null }),
    safe('hq.companies', () => hqCompaniesService.listCompanies(), { companies: [], stats: null }),
    safe('hq.demos', () => hqDemosService.listDemoRequests(), { demos: [], stats: null }),
    Promise.all((tenants || []).map((t) => tenantActivitySnapshot(t))),
  ]);

  const agency = (tenants || []).filter((t) => t.organizationType === 'agency').length;
  const standalone = (tenants || []).filter((t) => t.organizationType === 'standalone').length;
  const paused = (tenants || []).filter((t) => String(t.status || '').toUpperCase() === 'PAUSED').length;
  const onPlan = (tenants || []).filter((t) => t.subscriptionPlan?.name).length;
  const landingPurchases = (tenants || []).filter((t) => t.signupSource === 'landing_purchase').length;
  const landingTrials = (tenants || []).filter((t) => t.signupSource === 'landing_trial').length;

  const totals = snapshots.reduce(
    (acc, row) => {
      acc.openJobs += row.openJobs || 0;
      acc.closedJobs += row.closedJobs || 0;
      acc.jobs += row.jobs || 0;
      acc.candidates += row.candidates || 0;
      acc.candidates7d += row.candidates7d || 0;
      acc.applications += row.applications || 0;
      acc.applications7d += row.applications7d || 0;
      acc.interviews += row.interviews || 0;
      acc.interviewsToday += row.interviewsToday || 0;
      acc.interviewsScheduled += row.interviewsScheduled || 0;
      acc.interviewsCompleted += row.interviewsCompleted || 0;
      acc.placements += row.placements || 0;
      acc.placementsJoined += row.placementsJoined || 0;
      acc.clients += row.clients || 0;
      acc.leads += row.leads || 0;
      acc.tasks += row.tasks || 0;
      acc.tasksOpen += row.tasksOpen || 0;
      for (const [k, v] of Object.entries(row.jobStatus || {})) bump(acc.jobStatus, k, v);
      for (const [k, v] of Object.entries(row.interviewStatus || {})) bump(acc.interviewStatus, k, v);
      for (const [k, v] of Object.entries(row.placementStatus || {})) bump(acc.placementStatus, k, v);
      return acc;
    },
    {
      openJobs: 0,
      closedJobs: 0,
      jobs: 0,
      candidates: 0,
      candidates7d: 0,
      applications: 0,
      applications7d: 0,
      interviews: 0,
      interviewsToday: 0,
      interviewsScheduled: 0,
      interviewsCompleted: 0,
      placements: 0,
      placementsJoined: 0,
      clients: 0,
      leads: 0,
      tasks: 0,
      tasksOpen: 0,
      jobStatus: {},
      interviewStatus: {},
      placementStatus: {},
    },
  );

  const planMap = {};
  const typeMap = { agency, standalone };
  const signupMap = {};
  for (const t of tenants || []) {
    bump(planMap, t.subscriptionPlan?.name || 'Unassigned');
    bump(signupMap, t.signupSource || 'direct');
  }

  const leadStats = leadResult?.stats || {};
  const companyStats = companyResult?.stats || {};
  const demoStats = demoResult?.stats || {};

  const leadsByStage = {};
  const leadsByScore = {};
  let hotLeads = 0;
  let pipelineValue = 0;
  for (const lead of leadResult?.leads || []) {
    bump(leadsByStage, lead.stage || 'new');
    bump(leadsByScore, lead.score || 'Cold');
    if (String(lead.score || '').toLowerCase() === 'hot') hotLeads += 1;
    pipelineValue += Number(lead.estimatedDealValue || 0);
  }

  const companiesByStatus = {};
  for (const company of companyResult?.companies || []) {
    bump(companiesByStatus, company.status || 'active');
  }

  const demosByKind = {};
  const demosByStatus = {};
  for (const demo of demoResult?.demos || []) {
    bump(demosByKind, demo.requestKind || 'demo');
    bump(demosByStatus, demo.status || 'UNKNOWN');
  }

  // Throughput funnel — omit raw candidate DB size (skews conversion %). Spec §7.2.
  const hiringFunnel = [
    { name: 'Jobs', value: totals.jobs || totals.openJobs },
    { name: 'Applications', value: totals.applications },
    { name: 'Interviews', value: totals.interviews },
    { name: 'Placements', value: totals.placements },
    { name: 'Joined', value: totals.placementsJoined },
  ];

  const rankedTenants = [...snapshots]
    .map((row) => {
      const health = tenantHealthScore(row);
      return {
        ...row,
        health,
        activityScore:
          (row.openJobs || 0) * 3 +
          (row.applications || 0) * 2 +
          (row.interviews || 0) * 4 +
          (row.placements || 0) * 8 +
          (row.applications7d || 0) * 3 +
          (row.interviewsToday || 0) * 5 +
          health,
      };
    })
    .sort((a, b) => b.activityScore - a.activityScore);

  const idleTenants = rankedTenants.filter((t) => t.openJobs === 0 && t.candidates === 0 && !t.error).length;

  // Concentration risk — % of open jobs from top 1 / top 3 tenants
  const jobsSorted = [...rankedTenants].sort((a, b) => (b.openJobs || 0) - (a.openJobs || 0));
  const totalOpenJobs = totals.openJobs || 0;
  const top1Jobs = jobsSorted[0]?.openJobs || 0;
  const top3Jobs = jobsSorted.slice(0, 3).reduce((s, t) => s + (t.openJobs || 0), 0);
  const concentration = {
    top1JobsPct: totalOpenJobs ? pct(top1Jobs, totalOpenJobs) : 0,
    top3JobsPct: totalOpenJobs ? pct(top3Jobs, totalOpenJobs) : 0,
    top1TenantName: jobsSorted[0]?.name || jobsSorted[0]?.tenantDbName || null,
    metric: 'jobs',
  };

  const atRiskTenants = rankedTenants
    .filter((t) => !t.error)
    .map((t) => {
      const reasons = [];
      if ((t.openJobs || 0) === 0 && (t.candidates || 0) === 0) reasons.push('zero activity');
      if ((t.health || 0) < 40) reasons.push('low health');
      if ((t.applications7d || 0) === 0 && (t.openJobs || 0) > 0) reasons.push('jobs but no apps/7d');
      if (String(t.status || '').toUpperCase() === 'PAUSED') reasons.push('paused');
      return {
        tenantId: t.tenantDbName,
        name: t.name || t.tenantDbName,
        plan: t.plan || 'Unassigned',
        health: t.health || 0,
        openJobs: t.openJobs || 0,
        applications7d: t.applications7d || 0,
        reason: reasons.join(', ') || 'watch',
        reasons,
      };
    })
    .filter((t) => t.reasons.length > 0 && t.reason !== 'watch')
    .sort((a, b) => a.health - b.health)
    .slice(0, 12);

  // Tenant billing totals from subscription plan pricing (excludes paused + trial workspaces).
  const mrrByPlanMap = {};
  let mrr = 0;
  let billingTenants = 0;
  let trialTenants = 0;
  for (const t of tenants || []) {
    if (String(t.status || '').toUpperCase() === 'PAUSED') continue;
    if (t.subscriptionPlan?.isTrial) {
      trialTenants += 1;
      continue;
    }
    const monthly = parseMonthlyPlanPrice(t.subscriptionPlan);
    if (monthly <= 0) continue;
    billingTenants += 1;
    mrr += monthly;
    const planName = t.subscriptionPlan?.name || 'Custom';
    if (!mrrByPlanMap[planName]) mrrByPlanMap[planName] = { planName, mrr: 0, tenantCount: 0 };
    mrrByPlanMap[planName].mrr += monthly;
    mrrByPlanMap[planName].tenantCount += 1;
  }
  const mrrByPlan = Object.values(mrrByPlanMap).map((r) => ({
    planId: r.planName,
    planName: r.planName,
    mrr: Math.round(r.mrr * 100) / 100,
    tenantCount: r.tenantCount,
  }));
  mrr = Math.round(mrr * 100) / 100;
  const arr = Math.round(mrr * 12 * 100) / 100;

  const activeTenantsCount = Math.max(0, (tenants || []).length - paused);
  const platformHealthScore =
    rankedTenants.length > 0
      ? Math.round(
          rankedTenants.reduce((s, t) => s + (t.health || 0), 0) / rankedTenants.length,
        )
      : 0;
  const conversionRate =
    typeof leadStats.conversionRate === 'number'
      ? leadStats.conversionRate
      : pct(leadStats.converted || 0, leadStats.total || 0);

  const recentJobs = rankedTenants.flatMap((t) => t.recentJobs || []).slice(0, 20);
  const recentPlacements = rankedTenants.flatMap((t) => t.recentPlacements || []).slice(0, 20);

  const crmLeadRows = (leadResult?.leads || []).slice(0, 20).map((l) => ({
    id: l.id,
    name: l.name,
    company: l.company,
    stage: l.stage,
    score: l.score,
    owner: l.owner,
    nextFollowUp: l.nextFollowUp,
    estimatedDealValue: l.estimatedDealValue,
    industry: l.industry || '',
    country: l.country || '',
  }));

  const crmCompanyRows = (companyResult?.companies || []).slice(0, 15).map((c) => ({
    id: c.id,
    name: c.name || c.companyName || '—',
    status: c.status || '—',
    score: c.score || '—',
    industry: c.industry || '—',
    country: c.country || '—',
    owner: c.owner || c.accountOwner || '—',
    nextFollowUp: c.nextFollowUp || '—',
  }));

  const recentDemos = (demoResult?.demos || []).slice(0, 15).map((d) => ({
    id: d.id,
    name: d.fullName || '—',
    company: d.organizationName || '—',
    email: d.email || '',
    requestKind: d.requestKind || 'demo',
    status: d.status || '—',
    submittedAt: d.submittedAt || d.createdAt || null,
  }));

  const insights = [];
  insights.push({
    tone: 'info',
    text: `Live Phase 2 snapshot: ${tenants.length} tenants (${activeTenantsCount} active) · ${totals.openJobs} open jobs · ${totals.applications7d} apps in 7d · ${totals.placementsJoined} joined.`,
  });
  if (idleTenants > 0) {
    insights.push({
      tone: 'warn',
      text: `${idleTenants} tenant(s) have zero open jobs and zero candidates.`,
    });
  }
  if (concentration.top1JobsPct >= 40 && concentration.top1TenantName) {
    insights.push({
      tone: 'warn',
      text: `Concentration risk: ${concentration.top1JobsPct}% of open jobs sit on “${concentration.top1TenantName}” (top 3: ${concentration.top3JobsPct}%).`,
    });
  }
  if (totals.placementsJoined > 0) {
    insights.push({
      tone: 'good',
      text: `${totals.placementsJoined} joined/active placements across tenants (${pct(totals.placementsJoined, totals.placements || 1)}% of placements).`,
    });
  } else if (totals.applications > 0) {
    insights.push({
      tone: 'warn',
      text: `${totals.applications} applications across tenants but no joined placements yet.`,
    });
  }
  if (hotLeads > 0) {
    insights.push({
      tone: 'good',
      text: `${hotLeads} hot HQ CRM lead(s) in the pipeline.`,
    });
  }
  if (mrr > 0) {
    insights.push({
      tone: 'good',
      text: `Tenant billing: ${billingTenants} paid workspace(s) · MRR $${mrr.toLocaleString()} (ARR $${arr.toLocaleString()}).`,
    });
  }
  if (leadStats.followUpsToday > 0 || companyStats.followUpsToday > 0) {
    insights.push({
      tone: 'info',
      text: `${(leadStats.followUpsToday || 0) + (companyStats.followUpsToday || 0)} CRM follow-up(s) due today.`,
    });
  }
  if (conversionRate > 0) {
    insights.push({
      tone: conversionRate >= 15 ? 'good' : 'info',
      text: `HQ lead conversion rate ${conversionRate}%.`,
    });
  }
  if ((demoStats.verified || 0) > 0 || (demoStats.purchases || 0) > 0) {
    insights.push({
      tone: 'good',
      text: `Entrepreneur funnel: ${demoStats.verified || 0} verified · ${demoStats.trials || 0} trials · ${demoStats.purchases || 0} purchases.`,
    });
  }

  return {
    available: true,
    live: true,
    kpis: {
      tenants: tenants.length,
      agency,
      standalone,
      paused,
      onPlan,
      landingPurchases,
      landingTrials,
      openJobs: totals.openJobs,
      closedJobs: totals.closedJobs,
      jobs: totals.jobs,
      candidates: totals.candidates,
      candidates7d: totals.candidates7d,
      applications: totals.applications,
      applications7d: totals.applications7d,
      interviews: totals.interviews,
      interviewsToday: totals.interviewsToday,
      interviewsScheduled: totals.interviewsScheduled,
      interviewsCompleted: totals.interviewsCompleted,
      placements: totals.placements,
      placementsJoined: totals.placementsJoined,
      clients: totals.clients,
      tenantLeads: totals.leads,
      tasks: totals.tasks,
      tasksOpen: totals.tasksOpen,
      hqLeads: leadStats.total || 0,
      hqLeadConversionRate: conversionRate,
      hqCompanies: companyStats.total || 0,
      hotLeads,
      pipelineValue,
      monthlyBillingTotal: mrr,
      billingTenants,
      trialTenants,
      demosVerified: demoStats.verified || 0,
      demosPurchases: onPlan,
      demosPurchaseRequests: demoStats.purchases || 0,
      demosTrials: demoStats.trials || 0,
      demosPending: demoStats.pending || 0,
      demosExpired: demoStats.expired || 0,
      demosTotal: demoStats.total || 0,
      demosTrialsLive: demoStats.trialsLive || 0,
      followUpsToday: (leadStats.followUpsToday || 0) + (companyStats.followUpsToday || 0),
      mrr,
      arr,
      platformHealthScore,
      concentrationTop1JobsPct: concentration.top1JobsPct,
      concentrationTop3JobsPct: concentration.top3JobsPct,
    },
    charts: {
      hiringFunnel,
      // Landing-page style funnel: requested → pending → given → trial → active → paid
      landingFunnel: [
        { name: 'Demo requested', value: demoStats.total || 0 },
        { name: 'Pending / scheduled', value: demoStats.pending || 0 },
        { name: 'Demo given', value: demoStats.verified || 0 },
        { name: 'Free trials given', value: demoStats.trials || 0 },
        { name: 'Trials active', value: demoStats.trialsLive || 0 },
        { name: 'Paid / purchases', value: onPlan },
      ],
      tenantsByPlan: toChartArray(planMap),
      tenantsByType: toChartArray(typeMap),
      tenantsBySignup: toChartArray(signupMap),
      leadsByStage: toChartArray(leadsByStage),
      leadsByScore: toChartArray(leadsByScore),
      companiesByStatus: toChartArray(companiesByStatus),
      demosByKind: toChartArray(demosByKind),
      demosByStatus: toChartArray(demosByStatus),
      jobsByStatus: toChartArray(totals.jobStatus),
      interviewsByStatus: toChartArray(totals.interviewStatus),
      placementsByStatus: toChartArray(totals.placementStatus),
      tenantActivity: rankedTenants.slice(0, 12).map((t) => ({
        name: t.name || t.tenantDbName,
        value: t.activityScore,
        openJobs: t.openJobs,
        placements: t.placements,
      })),
      mrrByPlan: mrrByPlan.map((r) => ({ name: r.planName, value: r.mrr, tenantCount: r.tenantCount })),
      // Aggregate “features used” across tenants (jobs/apps/interviews…) for trial insight
      featureUsage: [
        { name: 'Jobs', value: totals.jobs || totals.openJobs || 0 },
        { name: 'Candidates', value: totals.candidates || 0 },
        { name: 'Applications', value: totals.applications || 0 },
        { name: 'Interviews', value: totals.interviews || 0 },
        { name: 'Placements', value: totals.placements || 0 },
        { name: 'Open tasks', value: totals.tasksOpen || 0 },
      ].filter((r) => r.value > 0),
    },
    tables: {
      rankedTenants: rankedTenants.slice(0, 20),
      atRiskTenants,
      recentTenantActivity: rankedTenants.slice(0, 12).map((t) => ({
        tenant: t.name,
        tenantDbName: t.tenantDbName,
        openJobs: t.openJobs,
        candidates: t.candidates,
        candidates7d: t.candidates7d,
        applications7d: t.applications7d,
        interviews: t.interviews,
        interviewsToday: t.interviewsToday,
        placements: t.placements,
        placementsJoined: t.placementsJoined,
        tasksOpen: t.tasksOpen,
        plan: t.plan,
        organizationType: t.organizationType,
        health: t.health,
      })),
      recentJobs,
      recentPlacements,
      crmLeads: crmLeadRows,
      crmCompanies: crmCompanyRows,
      recentDemos,
      crmLeadStats: leadStats,
      crmCompanyStats: companyStats,
      demoStats,
    },
    meta: {
      concentration,
      mrrByPlan,
      healthFormula: 'openJobs25+apps(7d|all)25+interviews20+placements20+engagement10',
    },
    insights,
  };
}

export const hqAnalyticsService = {
  async getAnalytics() {
    const startedAt = Date.now();
    const [employee, employer] = await Promise.all([
      buildEmployeeAnalytics(),
      buildEmployerAnalytics(),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      live: true,
      employee,
      employer,
    };
  },
};
