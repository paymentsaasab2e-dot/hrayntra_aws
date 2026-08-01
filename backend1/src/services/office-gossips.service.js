/**
 * Office Gossips durable store (companies, communities, posts, identities, reference checks).
 * Primary: JSON under data/ (same pattern as hq-chat / audit fallback).
 * HQ can later read this file or migrate to Prisma for analytics.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const FILE_PATH = path.join(DATA_DIR, 'office-gossips-bundle.json');

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
    social: null,
  };
}

function loadBundle() {
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
      social: parsed.social && typeof parsed.social === 'object' ? parsed.social : null,
    };
  } catch {
    return emptyBundle();
  }
}

function saveBundle(bundle) {
  ensureDataDir();
  const next = {
    ...emptyBundle(),
    ...bundle,
    updatedAt: new Date().toISOString(),
  };
  // Cap posts/comments to keep file manageable
  next.posts = (next.posts || []).slice(0, 5000);
  next.comments = (next.comments || []).slice(0, 15000);
  next.referenceChecks = (next.referenceChecks || []).slice(0, 5000);
  fs.writeFileSync(FILE_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function ts(value) {
  const n = Date.parse(String(value || ''));
  return Number.isFinite(n) ? n : 0;
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

/** Company pages: upsert by id, then collapse duplicate domainKey (keep newest). */
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
  return [...byDomain.values()].sort(
    (a, b) => ts(b.createdAt) - ts(a.createdAt),
  );
}

function slimCompanyPage(page) {
  if (!page || typeof page !== 'object') return page;
  return {
    ...page,
    logoUrl:
      typeof page.logoUrl === 'string' && page.logoUrl.startsWith('data:')
        ? undefined
        : page.logoUrl,
    // Verification docs stay local — too large for shared sync
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

/**
 * Merge a client push into the durable bundle.
 */
function mergeClientPush(payload = {}) {
  const current = loadBundle();

  const companyPages = mergeCompanyPages(
    current.companyPages,
    (payload.companyPages || []).map(slimCompanyPage),
  );
  const communities = upsertById(current.communities, payload.communities || []);
  const posts = upsertById(
    current.posts,
    (payload.posts || []).map(slimPost),
  ).sort((a, b) => ts(b.createdAt) - ts(a.createdAt));
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

  let social = current.social;
  if (payload.social && typeof payload.social === 'object') {
    social = payload.social;
  }

  const next = saveBundle({
    ...current,
    communities,
    companyPages,
    posts,
    comments,
    identities,
    referenceChecks,
    social,
  });

  return next;
}

function getSnapshot() {
  return loadBundle();
}

/** HQ / analytics rollup — extend later without changing client sync. */
function getHqSummary() {
  const bundle = loadBundle();
  const openForRef = Object.values(bundle.identities || {}).filter(
    (i) => i && i.availableForReferenceCheck,
  ).length;
  const byStatus = {};
  for (const row of bundle.referenceChecks || []) {
    const s = String(row.status || 'unknown');
    byStatus[s] = (byStatus[s] || 0) + 1;
  }
  return {
    updatedAt: bundle.updatedAt,
    companyPages: (bundle.companyPages || []).length,
    communities: (bundle.communities || []).length,
    posts: (bundle.posts || []).length,
    comments: (bundle.comments || []).length,
    identities: Object.keys(bundle.identities || {}).length,
    openForReference: openForRef,
    referenceChecks: (bundle.referenceChecks || []).length,
    referenceByStatus: byStatus,
  };
}

module.exports = {
  getSnapshot,
  mergeClientPush,
  getHqSummary,
  loadBundle,
};
