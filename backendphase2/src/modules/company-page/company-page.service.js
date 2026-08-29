import { randomUUID } from 'crypto';
import { env } from '../../config/env.js';
import * as store from './company-page.store.js';
import { resolveTenantOrganizationName } from '../setting/recruitmentMode.service.js';

function phase1ApiBase() {
  return String(env.JOB_PORTAL_API_URL || process.env.JOB_PORTAL_API_URL || 'http://localhost:5000')
    .trim()
    .replace(/\/+$/, '');
}

function ownerAuthorId(tenantDbName) {
  return `employer_${String(tenantDbName || 'tenant').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function pageIdForTenant(tenantDbName) {
  return `co_p2_${String(tenantDbName || 'tenant').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48)}`;
}

function normalizeDomain(raw) {
  let value = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .replace(/^@/, '');
  if (!value) return '';
  if (!value.includes('.')) return '';
  return value;
}

function logoLetter(name) {
  return String(name || 'C')
    .trim()
    .slice(0, 1)
    .toUpperCase() || 'C';
}

function validationError(message) {
  const err = new Error(message);
  err.code = 'VALIDATION';
  throw err;
}

async function pushToOfficeGossips({ companyPages = [], posts = [], userId }) {
  const url = `${phase1ApiBase()}/api/office-gossips/bundle`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyPages,
        posts,
        userId,
      }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn('[company-page] Phase 1 sync failed:', res.status, text.slice(0, 200));
      return { ok: false, status: res.status };
    }
    const json = await res.json().catch(() => null);
    return { ok: true, data: json?.data || json };
  } catch (error) {
    console.warn('[company-page] Phase 1 sync error:', error?.message || error);
    return { ok: false, error: error?.message || String(error) };
  }
}

function normalizeStringList(raw) {
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((v) => String(v || '').trim()).filter(Boolean))];
  }
  if (typeof raw === 'string' && raw.trim()) {
    return [
      ...new Set(
        raw
          .split(/[;,]/)
          .map((v) => v.trim())
          .filter(Boolean),
      ),
    ];
  }
  return [];
}

function toPortalCompanyPage(record) {
  const industries = normalizeStringList(record.industries ?? record.industry);
  const locations = normalizeStringList(record.locations ?? record.location);
  return {
    id: record.id,
    domainKey: record.domainKey,
    name: record.name,
    description: record.description || '',
    logoLetter: record.logoLetter || logoLetter(record.name),
    logoUrl: record.logoUrl || undefined,
    memberIds: Array.isArray(record.memberIds) ? record.memberIds : [record.createdBy],
    createdBy: record.createdBy,
    createdAt: record.createdAt,
    createdByEmail: record.createdByEmail || undefined,
    source: 'phase2',
    tenantDbName: record.tenantDbName,
    website: record.website || undefined,
    industries,
    locations,
    industry: industries.join('; ') || undefined,
    location: locations.join('; ') || undefined,
    updatedAt: record.updatedAt,
  };
}

function toPortalPost(record) {
  return {
    id: record.id,
    companyPageId: record.companyPageId,
    companyName: record.companyName,
    authorId: record.authorId,
    authorName: record.authorName,
    type: record.type || 'text',
    text: record.text,
    mediaUrl: record.mediaUrl || undefined,
    mediaUrls: record.mediaUrls || undefined,
    likeIds: Array.isArray(record.likeIds) ? record.likeIds : [],
    createdAt: record.createdAt,
    source: 'phase2',
    tenantDbName: record.tenantDbName,
  };
}

export async function getTenantCompanyPage({ tenantDbName, user }) {
  if (!tenantDbName) validationError('Tenant is required');
  let page = await store.getCompanyPageByTenant(tenantDbName);
  if (!page) {
    const organizationName = await resolveTenantOrganizationName({
      email: user?.email,
      tenantDbName,
    });
    if (organizationName.length >= 2) {
      const seeded = await upsertTenantCompanyPage({
        tenantDbName,
        user,
        payload: { name: organizationName },
      });
      page = seeded?.page || null;
    }
  }
  if (!page) return { page: null, posts: [] };
  const posts = await store.listCompanyPosts(tenantDbName);
  return { page, posts };
}

/** Used when HQ provisions a tenant so Company Page already shows the company name. */
export async function seedTenantCompanyPageFromOrganization({
  tenantDbName,
  organizationName,
  user,
} = {}) {
  const name = String(organizationName || '').trim();
  if (!tenantDbName || name.length < 2) return null;
  const existing = await store.getCompanyPageByTenant(tenantDbName);
  if (existing) return existing;
  const result = await upsertTenantCompanyPage({
    tenantDbName,
    user,
    payload: { name },
  });
  return result?.page || null;
}

export async function upsertTenantCompanyPage({
  tenantDbName,
  user,
  payload = {},
}) {
  if (!tenantDbName) validationError('Tenant is required');
  const name = String(payload.name || '').trim();
  if (name.length < 2) validationError('Company name must be at least 2 characters');

  const website = String(payload.website || '').trim();
  let domainKey = normalizeDomain(payload.domainKey || website);
  if (!domainKey) {
    domainKey = `${String(tenantDbName).replace(/[^a-z0-9]/gi, '')}.employer.hryantra.local`;
  }

  const existing = await store.getCompanyPageByTenant(tenantDbName);
  const authorId = ownerAuthorId(tenantDbName);
  const now = new Date().toISOString();

  const industries = normalizeStringList(
    payload.industries ?? payload.industry ?? existing?.industries ?? existing?.industry,
  );
  const locations = normalizeStringList(
    payload.locations ?? payload.location ?? existing?.locations ?? existing?.location,
  );

  const logoUrlRaw =
    payload.logoUrl === null
      ? undefined
      : payload.logoUrl !== undefined
        ? String(payload.logoUrl || '').trim() || undefined
        : existing?.logoUrl || undefined;

  const record = {
    id: existing?.id || pageIdForTenant(tenantDbName),
    tenantDbName: String(tenantDbName),
    domainKey,
    name,
    description:
      String(payload.description || '').trim() ||
      `Official ${name} page on Office Gossips — published from HRYantra Employer.`,
    logoLetter: logoLetter(name),
    logoUrl: logoUrlRaw,
    website: website || undefined,
    industries,
    locations,
    industry: industries.join('; ') || undefined,
    location: locations.join('; ') || undefined,
    memberIds: [authorId],
    createdBy: authorId,
    createdByEmail: user?.email || existing?.createdByEmail,
    phase2UserId: user?.id || existing?.phase2UserId,
    source: 'phase2',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const saved = await store.upsertCompanyPageRecord(record);
  const sync = await pushToOfficeGossips({
    companyPages: [toPortalCompanyPage(saved)],
    userId: authorId,
  });

  return { page: saved, synced: Boolean(sync.ok), sync };
}

/** HQ rename path: update the local company page immediately; Phase 1 sync is background. */
export async function applyOrganizationNameToCompanyPage({
  tenantDbName,
  organizationName,
  user,
} = {}) {
  const name = String(organizationName || '').trim();
  if (!tenantDbName || name.length < 2) return null;
  const existing = await store.getCompanyPageByTenant(tenantDbName);
  if (existing) {
    const saved = await store.updateCompanyPageName(tenantDbName, name);
    void pushToOfficeGossips({
      companyPages: saved ? [toPortalCompanyPage(saved)] : [],
      userId: ownerAuthorId(tenantDbName),
    }).catch(() => undefined);
    return saved;
  }
  return null;
}

export async function createTenantCompanyPost({
  tenantDbName,
  user,
  payload = {},
}) {
  if (!tenantDbName) validationError('Tenant is required');
  const page = await store.getCompanyPageByTenant(tenantDbName);
  if (!page) validationError('Create your company page before posting');

  const text = String(payload.text || '').trim();
  const mediaUrlRaw = String(payload.mediaUrl || '').trim();
  const mediaUrl =
    mediaUrlRaw && !mediaUrlRaw.startsWith('blob:') && !mediaUrlRaw.startsWith('data:')
      ? mediaUrlRaw
      : '';
  if (text.length < 2 && !mediaUrl) {
    validationError('Add post text or a photo');
  }

  const authorId = ownerAuthorId(tenantDbName);
  const now = new Date().toISOString();
  const post = {
    id: `p_p2_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    tenantDbName: String(tenantDbName),
    companyPageId: page.id,
    companyName: page.name,
    authorId,
    authorName: page.name,
    type: mediaUrl ? 'image' : 'text',
    text: text || (mediaUrl ? 'Photo' : ''),
    mediaUrl: mediaUrl || undefined,
    mediaUrls: mediaUrl ? [mediaUrl] : undefined,
    likeIds: [],
    createdAt: now,
    createdByPhase2UserId: user?.id,
    source: 'phase2',
  };

  const saved = await store.insertCompanyPost(post);
  const sync = await pushToOfficeGossips({
    companyPages: [toPortalCompanyPage(page)],
    posts: [toPortalPost(saved)],
    userId: authorId,
  });

  return { post: saved, page, synced: Boolean(sync.ok), sync };
}

export async function deleteTenantCompanyPost({ tenantDbName, postId }) {
  if (!tenantDbName) validationError('Tenant is required');
  if (!postId) validationError('Post id is required');
  const ok = await store.deleteCompanyPost(tenantDbName, postId);
  if (!ok) {
    const err = new Error('Post not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  // Soft-delete on portal is not supported by bundle merge; leave historical post.
  return { ok: true };
}

export async function resyncTenantCompanyPage({ tenantDbName }) {
  if (!tenantDbName) validationError('Tenant is required');
  const page = await store.getCompanyPageByTenant(tenantDbName);
  if (!page) validationError('Company page not found');
  const posts = await store.listCompanyPosts(tenantDbName, { limit: 100 });
  const authorId = ownerAuthorId(tenantDbName);
  const sync = await pushToOfficeGossips({
    companyPages: [toPortalCompanyPage(page)],
    posts: posts.map(toPortalPost),
    userId: authorId,
  });
  return { page, posts, synced: Boolean(sync.ok), sync };
}
