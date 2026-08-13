/**
 * Office Gossips durable store.
 * Primary: Mongo (Prisma) — platform entities + per-user profiles.
 * Fallback / one-time import: data/office-gossips-bundle.json
 */

const fs = require('fs');
const path = require('path');
const { prisma } = require('../lib/prisma');

const DATA_DIR = path.join(__dirname, '../../data');
const FILE_PATH = path.join(DATA_DIR, 'office-gossips-bundle.json');

const KIND = {
  community: 'community',
  companyPage: 'company_page',
  post: 'post',
  comment: 'comment',
  referenceCheck: 'reference_check',
  dm: 'dm',
  companyFollow: 'company_follow',
  peopleFollow: 'people_follow',
};

let migratePromise = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function emptyBundle() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    communities: [],
    companyPages: [],
    posts: [],
    comments: [],
    identities: {},
    referenceChecks: [],
    social: { companyFollows: [], peopleFollows: [], dms: [] },
  };
}

function ts(value) {
  const n = Date.parse(String(value || ''));
  return Number.isFinite(n) ? n : 0;
}

function toDate(value) {
  const n = ts(value);
  return n ? new Date(n) : new Date();
}

function readJsonBundle() {
  try {
    ensureDataDir();
    if (!fs.existsSync(FILE_PATH)) return emptyBundle();
    const parsed = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return emptyBundle();
    return {
      ...emptyBundle(),
      ...parsed,
      communities: Array.isArray(parsed.communities) ? parsed.communities : [],
      companyPages: Array.isArray(parsed.companyPages) ? parsed.companyPages : [],
      posts: Array.isArray(parsed.posts) ? parsed.posts : [],
      comments: Array.isArray(parsed.comments) ? parsed.comments : [],
      identities:
        parsed.identities && typeof parsed.identities === 'object' ? parsed.identities : {},
      referenceChecks: Array.isArray(parsed.referenceChecks) ? parsed.referenceChecks : [],
      social:
        parsed.social && typeof parsed.social === 'object'
          ? {
              companyFollows: Array.isArray(parsed.social.companyFollows)
                ? parsed.social.companyFollows
                : [],
              peopleFollows: Array.isArray(parsed.social.peopleFollows)
                ? parsed.social.peopleFollows
                : [],
              dms: Array.isArray(parsed.social.dms) ? parsed.social.dms : [],
            }
          : { companyFollows: [], peopleFollows: [], dms: [] },
    };
  } catch {
    return emptyBundle();
  }
}

function writeJsonBundle(bundle) {
  try {
    ensureDataDir();
    const next = {
      ...emptyBundle(),
      ...bundle,
      updatedAt: new Date().toISOString(),
    };
    next.posts = (next.posts || []).slice(0, 5000);
    next.comments = (next.comments || []).slice(0, 15000);
    next.referenceChecks = (next.referenceChecks || []).slice(0, 5000);
    fs.writeFileSync(FILE_PATH, JSON.stringify(next, null, 2), 'utf8');
    return next;
  } catch (err) {
    console.warn('[office-gossips] JSON fallback write failed:', err.message);
    return bundle;
  }
}

function dbReady() {
  return Boolean(
    prisma?.officeGossipEntity?.findMany &&
      prisma?.userOfficeGossipProfile?.findMany,
  );
}

function ownerFromPayload(kind, payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (kind === KIND.post || kind === KIND.comment) {
    return payload.authorId != null ? String(payload.authorId) : null;
  }
  if (kind === KIND.referenceCheck) {
    return payload.requesterId != null ? String(payload.requesterId) : null;
  }
  if (kind === KIND.community || kind === KIND.companyPage) {
    return payload.ownerId != null
      ? String(payload.ownerId)
      : payload.createdBy != null
        ? String(payload.createdBy)
        : null;
  }
  if (kind === KIND.dm || kind === KIND.peopleFollow || kind === KIND.companyFollow) {
    return payload.fromUserId != null ? String(payload.fromUserId) : null;
  }
  return null;
}

function statusFromPayload(kind, payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.status != null) return String(payload.status).slice(0, 40);
  return null;
}

async function upsertEntity(kind, payload) {
  if (!payload || payload.id == null) return;
  const entityId = String(payload.id);
  const ownerUserId = ownerFromPayload(kind, payload);
  const status = statusFromPayload(kind, payload);
  const createdAt = toDate(payload.createdAt);
  const updatedAt = toDate(payload.updatedAt || payload.createdAt);

  await prisma.officeGossipEntity.upsert({
    where: { kind_entityId: { kind, entityId } },
    create: {
      kind,
      entityId,
      payload,
      ownerUserId,
      status,
      createdAt,
      updatedAt,
    },
    update: {
      payload,
      ownerUserId,
      status,
      updatedAt,
    },
  });
}

async function upsertEntities(kind, rows) {
  for (const row of rows || []) {
    try {
      await upsertEntity(kind, row);
    } catch (err) {
      console.warn(`[office-gossips] upsert ${kind} failed:`, err.message);
    }
  }
}

async function upsertUserProfile(userId, patch) {
  if (!userId) return;
  const id = String(userId);
  const existing = await prisma.userOfficeGossipProfile.findUnique({ where: { userId: id } });
  const nextIdentity =
    patch.identity != null
      ? { ...(existing?.identity && typeof existing.identity === 'object' ? existing.identity : {}), ...patch.identity, userId: id }
      : existing?.identity ?? undefined;
  const nextFeed =
    patch.feedEvents != null
      ? Array.isArray(patch.feedEvents)
        ? patch.feedEvents
        : existing?.feedEvents
      : existing?.feedEvents ?? undefined;
  const nextMeta =
    patch.personalMeta != null
      ? {
          ...(existing?.personalMeta && typeof existing.personalMeta === 'object'
            ? existing.personalMeta
            : {}),
          ...patch.personalMeta,
        }
      : existing?.personalMeta ?? undefined;

  await prisma.userOfficeGossipProfile.upsert({
    where: { userId: id },
    create: {
      userId: id,
      identity: nextIdentity ?? undefined,
      feedEvents: nextFeed ?? undefined,
      personalMeta: nextMeta ?? undefined,
    },
    update: {
      identity: nextIdentity ?? undefined,
      feedEvents: nextFeed ?? undefined,
      personalMeta: nextMeta ?? undefined,
    },
  });
}

async function touchMeta() {
  try {
    await prisma.officeGossipMeta.upsert({
      where: { key: 'bundle' },
      create: { key: 'bundle', value: { updatedAt: new Date().toISOString(), version: 1 } },
      update: { value: { updatedAt: new Date().toISOString(), version: 1 } },
    });
  } catch (err) {
    console.warn('[office-gossips] meta touch failed:', err.message);
  }
}

async function importJsonIntoDbIfNeeded() {
  if (!dbReady()) return;
  try {
    const count = await prisma.officeGossipEntity.count();
    const profileCount = await prisma.userOfficeGossipProfile.count();
    if (count > 0 || profileCount > 0) return;

    const bundle = readJsonBundle();
    const hasData =
      bundle.communities.length ||
      bundle.companyPages.length ||
      bundle.posts.length ||
      bundle.referenceChecks.length ||
      Object.keys(bundle.identities || {}).length;
    if (!hasData) return;

    console.log('[office-gossips] Importing JSON bundle into Mongo…');
    await persistBundleToDb(bundle);
    console.log('[office-gossips] JSON → Mongo import complete');
  } catch (err) {
    console.warn('[office-gossips] JSON import skipped:', err.message);
  }
}

function ensureMigrated() {
  if (!migratePromise) {
    migratePromise = importJsonIntoDbIfNeeded().catch((err) => {
      console.warn('[office-gossips] migrate failed:', err.message);
    });
  }
  return migratePromise;
}

async function persistBundleToDb(bundle) {
  await upsertEntities(KIND.community, bundle.communities);
  await upsertEntities(KIND.companyPage, (bundle.companyPages || []).map(slimCompanyPage));
  await upsertEntities(KIND.post, (bundle.posts || []).map(slimPost));
  await upsertEntities(KIND.comment, bundle.comments);
  await upsertEntities(KIND.referenceCheck, bundle.referenceChecks);

  const social = bundle.social || {};
  await upsertEntities(KIND.companyFollow, social.companyFollows || []);
  await upsertEntities(KIND.peopleFollow, social.peopleFollows || []);
  await upsertEntities(KIND.dm, social.dms || []);

  for (const [userId, identity] of Object.entries(bundle.identities || {})) {
    if (!identity || typeof identity !== 'object') continue;
    await upsertUserProfile(userId, { identity: { ...identity, userId } });
  }

  await touchMeta();
}

async function loadBundleFromDb() {
  const [entities, profiles, meta] = await Promise.all([
    prisma.officeGossipEntity.findMany({ orderBy: { updatedAt: 'desc' } }),
    prisma.userOfficeGossipProfile.findMany(),
    prisma.officeGossipMeta.findUnique({ where: { key: 'bundle' } }).catch(() => null),
  ]);

  const communities = [];
  const companyPages = [];
  const posts = [];
  const comments = [];
  const referenceChecks = [];
  const companyFollows = [];
  const peopleFollows = [];
  const dms = [];

  for (const row of entities) {
    const payload =
      row.payload && typeof row.payload === 'object' ? { ...row.payload, id: row.entityId } : null;
    if (!payload) continue;
    switch (row.kind) {
      case KIND.community:
        communities.push(payload);
        break;
      case KIND.companyPage:
        companyPages.push(payload);
        break;
      case KIND.post:
        posts.push(payload);
        break;
      case KIND.comment:
        comments.push(payload);
        break;
      case KIND.referenceCheck:
        referenceChecks.push(payload);
        break;
      case KIND.companyFollow:
        companyFollows.push(payload);
        break;
      case KIND.peopleFollow:
        peopleFollows.push(payload);
        break;
      case KIND.dm:
        dms.push(payload);
        break;
      default:
        break;
    }
  }

  const identities = {};
  for (const profile of profiles) {
    if (profile.identity && typeof profile.identity === 'object') {
      identities[profile.userId] = { ...profile.identity, userId: profile.userId };
    }
  }

  posts.sort((a, b) => ts(b.createdAt) - ts(a.createdAt));
  referenceChecks.sort(
    (a, b) => ts(b.updatedAt || b.createdAt) - ts(a.updatedAt || a.createdAt),
  );

  const updatedAt =
    (meta?.value && typeof meta.value === 'object' && meta.value.updatedAt) ||
    new Date().toISOString();

  return {
    version: 1,
    updatedAt,
    communities,
    companyPages,
    posts: posts.slice(0, 5000),
    comments: comments.slice(0, 15000),
    identities,
    referenceChecks: referenceChecks.slice(0, 5000),
    social: { companyFollows, peopleFollows, dms },
  };
}

async function loadBundle() {
  await ensureMigrated();
  if (dbReady()) {
    try {
      return await loadBundleFromDb();
    } catch (err) {
      console.warn('[office-gossips] DB load failed, using JSON:', err.message);
    }
  }
  return readJsonBundle();
}

function upsertById(existing, incoming, idKey = 'id') {
  const map = new Map();
  for (const row of existing || []) {
    if (row && row[idKey] != null) map.set(String(row[idKey]), row);
  }
  for (const row of incoming || []) {
    if (!row || row[idKey] == null) continue;
    const id = String(row[idKey]);
    const prev = map.get(id);
    if (!prev) {
      map.set(id, row);
      continue;
    }
    const prevT = ts(prev.updatedAt || prev.createdAt);
    const nextT = ts(row.updatedAt || row.createdAt);
    map.set(id, nextT >= prevT ? { ...prev, ...row } : { ...row, ...prev });
  }
  return [...map.values()];
}

function mergeCompanyPages(existing, incoming) {
  const byId = upsertById(existing, incoming, 'id');
  const byDomain = new Map();
  for (const page of byId) {
    const key = String(page.domainKey || page.id).toLowerCase();
    const prev = byDomain.get(key);
    if (!prev) {
      byDomain.set(key, page);
      continue;
    }
    const prevT = ts(prev.updatedAt || prev.createdAt);
    const nextT = ts(page.updatedAt || page.createdAt);
    byDomain.set(key, nextT >= prevT ? page : prev);
  }
  return [...byDomain.values()].sort((a, b) => ts(b.createdAt) - ts(a.createdAt));
}

function slimCompanyPage(page) {
  if (!page || typeof page !== 'object') return page;
  return {
    ...page,
    logoUrl:
      typeof page.logoUrl === 'string' && page.logoUrl.startsWith('data:')
        ? undefined
        : page.logoUrl,
    documents: undefined,
  };
}

function slimPost(post) {
  if (!post || typeof post !== 'object') return post;
  return {
    ...post,
    mediaUrl:
      typeof post.mediaUrl === 'string' && post.mediaUrl.startsWith('data:')
        ? undefined
        : post.mediaUrl,
    mediaUrls: Array.isArray(post.mediaUrls)
      ? post.mediaUrls.filter((u) => typeof u === 'string' && !u.startsWith('data:'))
      : post.mediaUrls,
  };
}

function mergeDmThreads(existing, incoming) {
  const map = new Map();
  for (const row of existing || []) {
    if (row && row.id != null) map.set(String(row.id), row);
  }
  for (const row of incoming || []) {
    if (!row || row.id == null) continue;
    const id = String(row.id);
    const prev = map.get(id);
    if (!prev) {
      map.set(id, row);
      continue;
    }
    const msgMap = new Map();
    for (const m of prev.messages || []) {
      if (m && m.id != null) msgMap.set(String(m.id), m);
    }
    for (const m of row.messages || []) {
      if (m && m.id != null) msgMap.set(String(m.id), m);
    }
    const messages = [...msgMap.values()].sort((a, b) => ts(a.createdAt) - ts(b.createdAt));
    const prevT = ts(prev.updatedAt || prev.createdAt);
    const nextT = ts(row.updatedAt || row.createdAt);
    const base = nextT >= prevT ? { ...prev, ...row } : { ...row, ...prev };
    map.set(id, { ...base, messages });
  }
  return [...map.values()];
}

function mergeSocial(current, incoming) {
  if (!incoming || typeof incoming !== 'object') return current || { companyFollows: [], peopleFollows: [], dms: [] };
  const cur =
    current && typeof current === 'object'
      ? current
      : { companyFollows: [], peopleFollows: [], dms: [] };
  return {
    companyFollows: upsertById(cur.companyFollows || [], incoming.companyFollows || []),
    peopleFollows: upsertById(cur.peopleFollows || [], incoming.peopleFollows || []),
    dms: mergeDmThreads(cur.dms || [], incoming.dms || []),
  };
}

/**
 * Merge a client push into Mongo (JSON fallback if DB unavailable).
 */
async function mergeClientPush(payload = {}) {
  await ensureMigrated();
  const current = await loadBundle();

  const companyPages = mergeCompanyPages(
    current.companyPages,
    (payload.companyPages || []).map(slimCompanyPage),
  );
  const communities = upsertById(current.communities, payload.communities || []);
  const posts = upsertById(current.posts, (payload.posts || []).map(slimPost)).sort(
    (a, b) => ts(b.createdAt) - ts(a.createdAt),
  );
  const comments = upsertById(current.comments, payload.comments || []);
  const referenceChecks = upsertById(
    current.referenceChecks,
    payload.referenceChecks || [],
  ).sort((a, b) => ts(b.updatedAt || b.createdAt) - ts(a.updatedAt || a.createdAt));

  const identities = { ...current.identities };
  if (payload.identities && typeof payload.identities === 'object') {
    for (const [userId, row] of Object.entries(payload.identities)) {
      if (!row || typeof row !== 'object') continue;
      identities[userId] = { ...(identities[userId] || {}), ...row, userId };
    }
  }
  if (payload.identity && payload.identity.userId) {
    const userId = String(payload.identity.userId);
    identities[userId] = {
      ...(identities[userId] || {}),
      ...payload.identity,
      userId,
    };
  }

  /** Personalised feed/chat events keyed by userId → UserOfficeGossipProfile */
  const feedByUser =
    payload.feedEventsByUser && typeof payload.feedEventsByUser === 'object'
      ? payload.feedEventsByUser
      : null;
  if (payload.userId && Array.isArray(payload.feedEvents)) {
    // single-user push shape
  }

  const social = mergeSocial(current.social, payload.social);

  const next = {
    ...current,
    communities,
    companyPages,
    posts,
    comments,
    identities,
    referenceChecks,
    social,
    updatedAt: new Date().toISOString(),
  };

  if (dbReady()) {
    try {
      await upsertEntities(KIND.community, communities);
      await upsertEntities(KIND.companyPage, companyPages);
      await upsertEntities(KIND.post, posts.slice(0, 5000));
      await upsertEntities(KIND.comment, comments.slice(0, 15000));
      await upsertEntities(KIND.referenceCheck, referenceChecks.slice(0, 5000));
      await upsertEntities(KIND.companyFollow, social.companyFollows || []);
      await upsertEntities(KIND.peopleFollow, social.peopleFollows || []);
      await upsertEntities(KIND.dm, social.dms || []);

      for (const [userId, identity] of Object.entries(identities)) {
        const patch = { identity };
        if (feedByUser && Array.isArray(feedByUser[userId])) {
          patch.feedEvents = feedByUser[userId];
        }
        if (payload.userId && String(payload.userId) === String(userId) && Array.isArray(payload.feedEvents)) {
          patch.feedEvents = payload.feedEvents;
        }
        if (payload.personalMetaByUser?.[userId]) {
          patch.personalMeta = payload.personalMetaByUser[userId];
        }
        await upsertUserProfile(userId, patch);
      }

      await touchMeta();
      // Keep JSON as cold backup (optional); do not rely on it for HQ
      writeJsonBundle(next);
      return next;
    } catch (err) {
      console.warn('[office-gossips] DB persist failed, JSON fallback:', err.message);
    }
  }

  return writeJsonBundle(next);
}

async function getSnapshot() {
  return loadBundle();
}

/** HQ / analytics rollup — product counts for Employees → Engagement. */
async function getHqSummary() {
  await ensureMigrated();

  if (dbReady()) {
    try {
      const [communities, companyPages, posts, comments, refChecks, profiles] = await Promise.all([
        prisma.officeGossipEntity.count({ where: { kind: KIND.community } }),
        prisma.officeGossipEntity.count({ where: { kind: KIND.companyPage } }),
        prisma.officeGossipEntity.count({ where: { kind: KIND.post } }),
        prisma.officeGossipEntity.count({ where: { kind: KIND.comment } }),
        prisma.officeGossipEntity.findMany({
          where: { kind: KIND.referenceCheck },
          select: { status: true, ownerUserId: true, payload: true },
        }),
        prisma.userOfficeGossipProfile.findMany({
          select: { userId: true, identity: true },
        }),
      ]);

      const byStatus = {};
      const memberIds = new Set(profiles.map((p) => String(p.userId)));
      for (const row of refChecks) {
        const s = String(row.status || row.payload?.status || 'unknown');
        byStatus[s] = (byStatus[s] || 0) + 1;
      }

      for (const profile of profiles) {
        const identity = profile.identity;
        if (identity && typeof identity === 'object' && identity.userId) {
          memberIds.add(String(identity.userId));
        }
      }

      // Also count members from communities / pages
      const memberEntities = await prisma.officeGossipEntity.findMany({
        where: { kind: { in: [KIND.community, KIND.companyPage] } },
        select: { payload: true },
      });
      for (const row of memberEntities) {
        const ids = row.payload?.memberIds;
        if (Array.isArray(ids)) {
          for (const id of ids) if (id) memberIds.add(String(id));
        }
      }

      const openForRef = profiles.filter(
        (p) => p.identity && typeof p.identity === 'object' && p.identity.availableForReferenceCheck,
      ).length;

      const n = (key) => Number(byStatus[key]) || 0;
      const initiated = n('pending') + n('active') + n('awaiting_answers') + n('unknown');
      const responded = n('answered');
      const completed = n('completed');
      const rejected = n('rejected') + n('cancelled');

      const meta = await prisma.officeGossipMeta.findUnique({ where: { key: 'bundle' } }).catch(() => null);

      return {
        updatedAt:
          (meta?.value && typeof meta.value === 'object' && meta.value.updatedAt) ||
          new Date().toISOString(),
        available: true,
        source: 'mongodb',
        companyPages,
        communities,
        posts,
        comments,
        identities: profiles.length,
        usersOnOfficeGossip: memberIds.size,
        openForReference: openForRef,
        referenceChecks: refChecks.length,
        referenceByStatus: byStatus,
        referenceChecksSummary: {
          total: refChecks.length,
          initiated,
          responded,
          completed,
          rejected,
        },
      };
    } catch (err) {
      console.warn('[office-gossips] HQ summary from DB failed:', err.message);
    }
  }

  const bundle = readJsonBundle();
  const identities = bundle.identities || {};
  const identityList = Object.values(identities).filter(Boolean);
  const openForRef = identityList.filter((i) => i && i.availableForReferenceCheck).length;
  const memberIds = new Set();
  for (const c of bundle.communities || []) {
    for (const id of c.memberIds || []) if (id) memberIds.add(String(id));
  }
  for (const p of bundle.companyPages || []) {
    for (const id of p.memberIds || []) if (id) memberIds.add(String(id));
  }
  for (const id of Object.keys(identities)) if (id) memberIds.add(String(id));

  const byStatus = {};
  for (const row of bundle.referenceChecks || []) {
    const s = String(row.status || 'unknown');
    byStatus[s] = (byStatus[s] || 0) + 1;
  }
  const n = (key) => Number(byStatus[key]) || 0;

  return {
    updatedAt: bundle.updatedAt,
    available: true,
    source: 'json_fallback',
    companyPages: (bundle.companyPages || []).length,
    communities: (bundle.communities || []).length,
    posts: (bundle.posts || []).length,
    comments: (bundle.comments || []).length,
    identities: identityList.length,
    usersOnOfficeGossip: memberIds.size,
    openForReference: openForRef,
    referenceChecks: (bundle.referenceChecks || []).length,
    referenceByStatus: byStatus,
    referenceChecksSummary: {
      total: (bundle.referenceChecks || []).length,
      initiated: n('pending') + n('active') + n('awaiting_answers') + n('unknown'),
      responded: n('answered'),
      completed: n('completed'),
      rejected: n('rejected') + n('cancelled'),
    },
  };
}

module.exports = {
  getSnapshot,
  mergeClientPush,
  getHqSummary,
  loadBundle,
  KIND,
};
