import { prisma } from '../../config/prisma.js';
import { encryption } from '../../utils/encryption.js';
import { env } from '../../config/env.js';

function ensureLinkedInModel() {
  if (!prisma.linkedInToken) {
    throw new Error('LinkedInToken model not found. Please restart the server after running prisma generate.');
  }
}

function decryptAccessToken(tokenRecord) {
  try {
    const decryptedToken = encryption.decryptToken(tokenRecord.accessToken);
    return { ...tokenRecord, accessToken: decryptedToken, expired: false };
  } catch (error) {
    console.error('Failed to decrypt LinkedIn token:', error);
    return { ...tokenRecord, expired: true };
  }
}

function isExpired(tokenRecord) {
  return new Date(tokenRecord.expiresAt) < new Date();
}

function currentLinkedInVersionYm() {
  const now = new Date();
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function linkedInRestVersionCandidates() {
  const preferred = String(process.env.LINKEDIN_API_VERSION || '').trim();
  const latest = currentLinkedInVersionYm();
  const year = Number(latest.slice(0, 4));
  const month = Number(latest.slice(4, 6));
  const rolling = [];
  for (let i = 0; i < 6; i += 1) {
    const date = new Date(Date.UTC(year, month - 1 - i, 1));
    rolling.push(`${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return [...new Set([preferred, latest, ...rolling].filter(Boolean))];
}

function linkedInApiHeaders(accessToken, { restVersion = null } = {}) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'X-Restli-Protocol-Version': '2.0.0',
    Accept: 'application/json',
  };
  if (restVersion) headers['Linkedin-Version'] = restVersion;
  return headers;
}

function parseLinkedInOrganizationId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = raw.match(/organization(?:Brand)?:(\d+)/i) || raw.match(/^(\d+)$/);
  return match ? match[1] : '';
}

function mapAclElementToPage(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const org = entry['organizationalTarget~'] || entry.organizationalTarget || {};
  const orgId =
    parseLinkedInOrganizationId(org.id) ||
    parseLinkedInOrganizationId(org.organizationalTarget) ||
    parseLinkedInOrganizationId(entry.organizationalTarget) ||
    parseLinkedInOrganizationId(entry.organization);
  if (!orgId) return null;
  return {
    id: orgId,
    name: org.localizedName || org.vanityName || entry.localizedName || `Company Page ${orgId}`,
    vanityName: org.vanityName || null,
  };
}

async function fetchLinkedInJson(url, accessToken, restVersion = null) {
  const response = await fetch(url, { headers: linkedInApiHeaders(accessToken, { restVersion }) });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  const message = data?.message || data?.error || data?.status || '';
  return { ok: response.ok, status: response.status, data, message: String(message) };
}

let cachedLinkedInRestVersion = '';

async function fetchLinkedInRestJson(url, accessToken) {
  const versions = cachedLinkedInRestVersion
    ? [cachedLinkedInRestVersion, ...linkedInRestVersionCandidates().filter((v) => v !== cachedLinkedInRestVersion)]
    : linkedInRestVersionCandidates();

  let last = { ok: false, status: 0, data: {}, message: '' };
  for (const version of versions) {
    last = await fetchLinkedInJson(url, accessToken, version);
    if (last.status === 426) {
      console.warn('[linkedin] REST version inactive', version, url, last.message);
      if (cachedLinkedInRestVersion === version) cachedLinkedInRestVersion = '';
      continue;
    }
    if (last.ok || last.status !== 426) {
      if (last.ok) cachedLinkedInRestVersion = version;
      return last;
    }
  }
  return last;
}

async function fetchOrganizationName(accessToken, orgId) {
  const rest = await fetchLinkedInRestJson(`https://api.linkedin.com/rest/organizations/${orgId}`, accessToken);
  if (rest.ok) {
    const name =
      rest.data?.localizedName ||
      rest.data?.vanityName ||
      rest.data?.name?.localized?.en_US ||
      (typeof rest.data?.name === 'string' ? rest.data.name : '');
    if (name) return { name: String(name), vanityName: rest.data?.vanityName || null };
  }
  const v2 = await fetchLinkedInJson(`https://api.linkedin.com/v2/organizations/${orgId}`, accessToken);
  if (v2.ok) {
    const name =
      v2.data?.localizedName ||
      v2.data?.vanityName ||
      v2.data?.name?.localized?.en_US ||
      (typeof v2.data?.name === 'string' ? v2.data.name : '');
    if (name) return { name: String(name), vanityName: v2.data?.vanityName || null };
  }
  return { name: `Company Page ${orgId}`, vanityName: null };
}

async function fetchOrganizationPages(accessToken) {
  const restUrls = [
    'https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED',
    'https://api.linkedin.com/rest/organizationAcls?q=roleAssignee',
  ];
  const v2Urls = [
    'https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&projection=(elements*(organizationalTarget~(id,localizedName,vanityName)))',
    'https://api.linkedin.com/v2/organizationAcls?q=roleAssignee',
  ];

  let elements = [];
  for (const url of restUrls) {
    try {
      const { ok, status, data, message } = await fetchLinkedInRestJson(url, accessToken);
      if (!ok) {
        console.warn('[linkedin] organizationAcls failed', status, url, message);
        continue;
      }
      const next = Array.isArray(data?.elements) ? data.elements : [];
      if (next.length) {
        elements = next;
        break;
      }
    } catch (error) {
      console.warn('[linkedin] organizationAcls error', url, error?.message || error);
    }
  }

  if (!elements.length) {
    for (const url of v2Urls) {
      try {
        const { ok, status, data, message } = await fetchLinkedInJson(url, accessToken);
        if (!ok) {
          console.warn('[linkedin] organizationAcls v2 failed', status, url, message);
          continue;
        }
        const next = Array.isArray(data?.elements) ? data.elements : [];
        if (next.length) {
          elements = next;
          break;
        }
      } catch (error) {
        console.warn('[linkedin] organizationAcls v2 error', url, error?.message || error);
      }
    }
  }

  const pages = [];
  const seen = new Set();
  for (const entry of elements) {
    const mapped = mapAclElementToPage(entry);
    if (!mapped || seen.has(mapped.id)) continue;
    seen.add(mapped.id);
    if (!mapped.name || mapped.name === `Company Page ${mapped.id}`) {
      const details = await fetchOrganizationName(accessToken, mapped.id);
      mapped.name = details.name;
      mapped.vanityName = details.vanityName || mapped.vanityName;
    }
    pages.push(mapped);
  }

  if (!pages.length) {
    console.warn('[linkedin] No Company Pages returned. User must be a Page admin and CMA scopes must be approved.');
  }
  return pages;
}

export function isCmaLinkedInSub(linkedinSub) {
  return String(linkedinSub || '').startsWith('cma:');
}

export function toCmaLinkedInSub(linkedinSub) {
  const raw = String(linkedinSub || '').replace(/^cma:/, '').trim();
  return raw ? `cma:${raw}` : 'cma:unknown';
}

function isMongoObjectId(value) {
  return /^[a-fA-F0-9]{24}$/.test(String(value || '').trim());
}

function pageMatchesOrg(page, orgId) {
  const pageId = String(page?.id || '').replace(/^org:/, '').trim();
  return pageId && pageId === String(orgId || '').replace(/^org:/, '').trim();
}

function normalizeOrganizations(raw) {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      return normalizeOrganizations(JSON.parse(trimmed));
    } catch {
      return [];
    }
  }
  if (raw && typeof raw === 'object') {
    if (Array.isArray(raw.elements)) return raw.elements.filter(Boolean);
    if (Array.isArray(raw.pages)) return raw.pages.filter(Boolean);
    if (Array.isArray(raw.organizations)) return raw.organizations.filter(Boolean);
  }
  return [];
}

function flattenAccountsFromTokens(tokens, viewerUserId = null) {
  const accounts = [];
  for (const token of tokens) {
    const expired = isExpired(token);
    const ownerUser = token.user || null;
    const ownerUserId = String(token.userId || ownerUser?.id || '').trim();
    const ownerName =
      String(ownerUser?.name || '').trim() ||
      [ownerUser?.firstName, ownerUser?.lastName].filter(Boolean).join(' ').trim() ||
      String(ownerUser?.email || '').trim() ||
      null;
    const isOwn = viewerUserId ? ownerUserId === String(viewerUserId) : true;
    const isCma = isCmaLinkedInSub(token.linkedinSub);

    // CMA tokens are Company Page access only — do not list them as a personal profile.
    if (!isCma) {
      accounts.push({
        id: token.id,
        key: `personal:${token.id}`,
        type: 'personal',
        name: token.name || 'LinkedIn Profile',
        email: token.email || null,
        accountEmail: token.email || null,
        picture: token.picture || null,
        linkedinSub: token.linkedinSub,
        connected: !expired,
        expired,
        ownerUserId: ownerUserId || null,
        ownerName,
        isOwn,
      });
    }

    const pages = normalizeOrganizations(token.organizations);
    for (const page of pages) {
      if (!page?.id) continue;
      const organizationId = String(page.id).replace(/^org:/, '');
      const key = `org:${organizationId}`;
      const existing = accounts.find((account) => account.key === key);
      if (existing) {
        if (!existing.isOwn && isOwn) {
          existing.parentAccountId = token.id;
          existing.ownerUserId = ownerUserId || existing.ownerUserId;
          existing.ownerName = ownerName || existing.ownerName;
          existing.isOwn = true;
          existing.connected = existing.connected || !expired;
          existing.expired = existing.expired && expired;
        }
        continue;
      }
      accounts.push({
        id: key,
        key,
        type: 'page',
        name: page.name || 'Company Page',
        parentAccountId: token.id,
        organizationId,
        picture: null,
        connected: !expired,
        expired,
        ownerUserId: ownerUserId || null,
        ownerName,
        isOwn,
      });
    }
  }
  return accounts;
}

async function fetchImageBuffer(imageUrl) {
  let url = String(imageUrl || '').trim();
  if (!url) return null;

  // Resolve relative /uploads or /api paths against the API host when needed.
  if (url.startsWith('/')) {
    const base = String(env.BACKEND_PUBLIC_URL || env.FRONTEND_URL || '').replace(/\/$/, '');
    if (base) url = `${base}${url}`;
  }

  const response = await fetch(url, {
    headers: { Accept: 'image/*,*/*' },
  });
  if (!response.ok) {
    throw new Error(`Could not download LinkedIn image (${response.status})`);
  }

  const contentType = String(response.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
  if (!contentType.startsWith('image/')) {
    throw new Error('LinkedIn image URL must point to an image file');
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (!buffer.length) throw new Error('LinkedIn image file is empty');
  if (buffer.length > 8 * 1024 * 1024) throw new Error('LinkedIn image must be 8MB or smaller');

  return { buffer, contentType };
}

/**
 * Register + upload an image to LinkedIn Assets API, return digitalmediaAsset URN.
 */
async function uploadLinkedInImageAsset(accessToken, ownerUrn, imageUrl) {
  const image = await fetchImageBuffer(imageUrl);
  if (!image) return null;

  const registerResponse = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: ownerUrn,
        serviceRelationships: [
          {
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent',
          },
        ],
      },
    }),
  });

  if (!registerResponse.ok) {
    const errorText = await registerResponse.text();
    console.error('LinkedIn registerUpload failed:', errorText);
    throw new Error(`LinkedIn image register failed: ${registerResponse.status}`);
  }

  const registerData = await registerResponse.json();
  const assetUrn = registerData?.value?.asset;
  const uploadUrl =
    registerData?.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']
      ?.uploadUrl;

  if (!assetUrn || !uploadUrl) {
    throw new Error('LinkedIn did not return an image upload URL');
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': image.contentType || 'application/octet-stream',
    },
    body: image.buffer,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    console.error('LinkedIn image binary upload failed:', errorText);
    throw new Error(`LinkedIn image upload failed: ${uploadResponse.status}`);
  }

  return assetUrn;
}

export const linkedinService = {
  async getTokenByUserId(userId) {
    ensureLinkedInModel();
    const tokenRecord = await prisma.linkedInToken.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    if (!tokenRecord) return null;
    if (isExpired(tokenRecord)) return { ...tokenRecord, expired: true };
    return decryptAccessToken(tokenRecord);
  },

  async getTokenRecordById(userId, tokenId) {
    ensureLinkedInModel();
    const tokenRecord = await prisma.linkedInToken.findFirst({
      where: { id: tokenId, userId },
    });
    if (!tokenRecord) return null;
    if (isExpired(tokenRecord)) return { ...tokenRecord, expired: true };
    return decryptAccessToken(tokenRecord);
  },

  /** Resolve a LinkedIn token by id anywhere in the current tenant DB. */
  async getTokenRecordByIdInTenant(tokenId) {
    ensureLinkedInModel();
    const tokenRecord = await prisma.linkedInToken.findFirst({
      where: { id: tokenId },
      include: {
        user: {
          select: { id: true, name: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    if (!tokenRecord) return null;
    if (isExpired(tokenRecord)) return { ...tokenRecord, expired: true };
    return decryptAccessToken(tokenRecord);
  },

  async getTokensByUserId(userId) {
    ensureLinkedInModel();
    return prisma.linkedInToken.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  },

  /** All LinkedIn tokens in this tenant (shared with every team member). */
  async getTokensForTenant() {
    ensureLinkedInModel();
    return prisma.linkedInToken.findMany({
      include: {
        user: {
          select: { id: true, name: true, firstName: true, lastName: true, email: true, isActive: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  },

  async saveToken(userId, linkedinSub, accessToken, expiresIn, name, picture, email = null) {
    ensureLinkedInModel();
    const encryptedToken = encryption.encryptToken(accessToken);
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    const organizations = await fetchOrganizationPages(accessToken);

    return prisma.linkedInToken.upsert({
      where: {
        userId_linkedinSub: { userId, linkedinSub },
      },
      update: {
        accessToken: encryptedToken,
        expiresAt,
        name,
        picture,
        organizations,
        ...(email !== undefined ? { email } : {}),
        updatedAt: new Date(),
      },
      create: {
        userId,
        linkedinSub,
        accessToken: encryptedToken,
        expiresAt,
        name,
        picture,
        email: email ?? null,
        organizations,
      },
    });
  },

  async refreshOrganizationPages(userId, tokenId) {
    const tokenRecord = await this.getTokenRecordById(userId, tokenId);
    if (!tokenRecord || tokenRecord.expired) {
      throw new Error('LinkedIn token not found or expired');
    }
    const organizations = await fetchOrganizationPages(tokenRecord.accessToken);
    await prisma.linkedInToken.update({
      where: { id: tokenId },
      data: { organizations, updatedAt: new Date() },
    });
    return organizations;
  },

  async deleteToken(userId, tokenId = null) {
    ensureLinkedInModel();
    const raw = String(tokenId || '').trim();
    if (!raw) {
      await prisma.linkedInToken.deleteMany({ where: { userId } });
      return { message: 'LinkedIn connections disconnected' };
    }

    const personalId = raw.replace(/^personal:/, '');
    if (isMongoObjectId(personalId)) {
      await prisma.linkedInToken.deleteMany({
        where: { id: personalId, userId },
      });
      return { message: 'LinkedIn account disconnected' };
    }

    if (raw.startsWith('org:') || /^\d+$/.test(raw)) {
      const orgId = raw.replace(/^org:/, '');
      const tokens = await this.getTokensForTenant();
      const owned = tokens.filter((token) => String(token.userId) === String(userId));
      const matching = owned.filter((token) => {
        const pages = normalizeOrganizations(token.organizations);
        return pages.some((page) => pageMatchesOrg(page, orgId));
      });
      if (!matching.length) {
        throw new Error('LinkedIn company page not found');
      }

      for (const token of matching) {
        const remaining = normalizeOrganizations(token.organizations).filter(
          (page) => !pageMatchesOrg(page, orgId),
        );
        if (isCmaLinkedInSub(token.linkedinSub) && remaining.length === 0) {
          await prisma.linkedInToken.deleteMany({
            where: { id: token.id, userId },
          });
        } else {
          await prisma.linkedInToken.update({
            where: { id: token.id },
            data: { organizations: remaining, updatedAt: new Date() },
          });
        }
      }
      return { message: 'LinkedIn company page disconnected' };
    }

    throw new Error('LinkedIn account not found');
  },

  async getStatus(userId) {
    const accounts = await this.listAccounts(userId);
    const connectedAccounts = accounts.filter((a) => a.connected);
    if (!connectedAccounts.length) {
      const anyExpired = accounts.some((a) => a.expired);
      return { connected: false, expired: anyExpired, accounts };
    }
    const primary =
      connectedAccounts.find((a) => a.isOwn && a.type === 'personal') ||
      connectedAccounts.find((a) => a.type === 'personal') ||
      connectedAccounts[0];
    return {
      connected: true,
      name: primary.name,
      picture: primary.picture,
      accounts,
    };
  },

  /**
   * List LinkedIn accounts for the whole tenant so any teammate
   * (including superadmin) can publish to shared connections.
   */
  async listAccounts(userId) {
    const tokens = await this.getTokensForTenant();
    const activeTokens = tokens.filter((token) => token.user?.isActive !== false);

    const hasCmaApp = Boolean(
      String(env.LINKEDIN_CMA_CLIENT_ID || '').trim() && String(env.LINKEDIN_CMA_CLIENT_SECRET || '').trim(),
    );
    for (const token of activeTokens) {
      const cached = normalizeOrganizations(token.organizations);
      token.organizations = cached;
      // Refresh until company pages arrive. CMA tokens can list Pages; personal-app
      // tokens are tried only when a CMA app is not configured.
      const canListPages = isCmaLinkedInSub(token.linkedinSub) || !hasCmaApp;
      if (!canListPages || cached.length > 0 || isExpired(token)) continue;
      try {
        const decrypted = decryptAccessToken(token);
        if (!decrypted?.accessToken || decrypted.expired) continue;
        const organizations = await fetchOrganizationPages(decrypted.accessToken);
        token.organizations = organizations;
        await prisma.linkedInToken.update({
          where: { id: token.id },
          data: { organizations, updatedAt: new Date() },
        });
      } catch (error) {
        console.warn('[linkedin] refresh organization pages failed', token.id, error?.message || error);
      }
    }

    return flattenAccountsFromTokens(activeTokens, userId);
  },

  async postToTarget(userId, targetKey, jobData) {
    if (!targetKey) {
      throw new Error('LinkedIn account target is required');
    }

    let tokenRecord = null;
    let authorUrn = null;

    if (String(targetKey).startsWith('org:')) {
      const orgId = String(targetKey).replace(/^org:/, '');
      const tokens = await this.getTokensForTenant();
      const ownerToken = tokens.find((token) => {
        if (token.user?.isActive === false) return false;
        const pages = normalizeOrganizations(token.organizations);
        return pages.some((page) => pageMatchesOrg(page, orgId));
      });
      if (!ownerToken) throw new Error('LinkedIn company page not found');
      tokenRecord = isExpired(ownerToken) ? { ...ownerToken, expired: true } : decryptAccessToken(ownerToken);
      authorUrn = `urn:li:organization:${orgId}`;
    } else {
      const tokenId = String(targetKey).replace(/^personal:/, '');
      // Allow posting with any teammate's connected LinkedIn in this tenant.
      tokenRecord = await this.getTokenRecordByIdInTenant(tokenId);
      if (!tokenRecord) throw new Error('LinkedIn account not found');
      if (tokenRecord.user?.isActive === false) {
        throw new Error('LinkedIn account owner is inactive');
      }
      authorUrn = `urn:li:person:${String(tokenRecord.linkedinSub || '').replace(/^cma:/, '')}`;
    }

    if (tokenRecord.expired) {
      throw new Error('LinkedIn token expired. Please reconnect.');
    }

    let shareText =
      jobData.postText ||
      `We're hiring a ${jobData.jobTitle} at ${jobData.company}!\n\n${jobData.description?.substring(0, 200) || ''}${jobData.description?.length > 200 ? '...' : ''}\n\n${jobData.location ? `Location: ${jobData.location}\n\n` : ''}Apply here: ${jobData.applyUrl}\n\n#hiring #jobs #careers`;

    const resolvedJobTitle = String(jobData.jobTitle || '').trim();
    const resolvedCompany = String(jobData.company || '').trim();
    // If a custom post text was supplied but somehow lost the role/company, prepend them.
    if (resolvedJobTitle && jobData.postText) {
      const lower = String(shareText).toLowerCase();
      const missingTitle = !lower.includes(resolvedJobTitle.toLowerCase());
      const missingCompany =
        Boolean(resolvedCompany) && !lower.includes(resolvedCompany.toLowerCase());
      if (missingTitle || missingCompany) {
        const hiringLine =
          resolvedCompany
            ? `We're hiring: ${resolvedJobTitle} at ${resolvedCompany}!`
            : `We're hiring: ${resolvedJobTitle}!`;
        if (missingTitle) {
          shareText = `${hiringLine}\n\n${shareText}`;
        } else if (missingCompany && !/we're hiring:/i.test(shareText)) {
          shareText = `${hiringLine}\n\n${shareText}`;
        }
      }
    }

    const applyUrl = String(jobData.applyUrl || '').trim();
    const LINKEDIN_POST_MAX = 3000;
    if (applyUrl) {
      if (shareText.includes('[link-on-save]')) {
        shareText = shareText.replace(
          /https?:\/\/[^\s]*\/apply\/\[link-on-save\](?:\?[^\s]*)?/gi,
          applyUrl,
        );
        shareText = shareText.replaceAll('[link-on-save]', applyUrl);
      }
      // Never publish without the apply link (long JD text used to truncate it away).
      if (!shareText.includes(applyUrl)) {
        const applyBlock = `\n\nApply now:\n${applyUrl}`;
        if (shareText.length + applyBlock.length <= LINKEDIN_POST_MAX) {
          shareText = `${String(shareText || '').replace(/\s+$/, '')}${applyBlock}`;
        } else {
          const available = Math.max(0, LINKEDIN_POST_MAX - applyBlock.length);
          const head =
            available <= 1
              ? ''
              : `${String(shareText).slice(0, available - 1).trimEnd()}…`;
          shareText = `${head}${applyBlock}`.slice(0, LINKEDIN_POST_MAX);
        }
      }
    }

    const imageUrl = String(jobData.imageUrl || jobData.linkedinImageUrl || '').trim();
    let assetUrn = null;
    if (imageUrl) {
      try {
        assetUrn = await uploadLinkedInImageAsset(tokenRecord.accessToken, authorUrn, imageUrl);
      } catch (imageError) {
        console.error('LinkedIn image attach failed, posting text-only:', imageError?.message || imageError);
        // Fall back to text-only so the job still publishes.
        assetUrn = null;
      }
    }

    const shareContent = {
      shareCommentary: { text: shareText },
      shareMediaCategory: assetUrn ? 'IMAGE' : 'NONE',
    };

    if (assetUrn) {
      shareContent.media = [
        {
          status: 'READY',
          description: { text: String(resolvedJobTitle || 'Job opening').slice(0, 200) },
          media: assetUrn,
          title: { text: String(resolvedJobTitle || "We're hiring").slice(0, 200) },
        },
      ];
    }

    const ugcPostPayload = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': shareContent,
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenRecord.accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(ugcPostPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LinkedIn API error:', errorText);
      if (response.status === 401) throw new Error('LinkedIn token expired. Please reconnect.');
      if (response.status === 429) throw new Error('LinkedIn rate limit reached. Try again in 15 minutes.');
      throw new Error(`LinkedIn API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const postId = result.id?.replace('urn:li:ugcPost:', '') || '';
    const linkedinPostUrl = postId
      ? `https://www.linkedin.com/feed/update/${postId}`
      : 'https://www.linkedin.com/feed/';

    return { success: true, linkedinPostUrl, postId, targetKey };
  },

  async postJob(userId, jobData, targets = null) {
    const selectedTargets = Array.isArray(targets) && targets.length ? targets : null;
    if (!selectedTargets) {
      const tokenRecord = await this.getTokenByUserId(userId);
      if (!tokenRecord) throw new Error('LinkedIn not connected');
      return this.postToTarget(userId, `personal:${tokenRecord.id}`, jobData);
    }

    const results = [];
    for (const targetKey of selectedTargets) {
      try {
        const result = await this.postToTarget(userId, targetKey, jobData);
        results.push(result);
      } catch (error) {
        results.push({ success: false, targetKey, error: error.message });
      }
    }

    const successes = results.filter((r) => r.success);
    if (!successes.length) {
      throw new Error(results[0]?.error || 'Failed to post to LinkedIn');
    }

    return {
      success: true,
      linkedinPostUrl: successes[0].linkedinPostUrl,
      postId: successes[0].postId,
      results,
    };
  },
};
