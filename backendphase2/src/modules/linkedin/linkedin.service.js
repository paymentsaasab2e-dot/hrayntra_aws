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

async function fetchOrganizationPages(accessToken) {
  try {
    const url =
      'https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&projection=(elements*(organizationalTarget~(id,localizedName,vanityName)))';
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });
    if (!response.ok) return [];
    const data = await response.json();
    const elements = Array.isArray(data?.elements) ? data.elements : [];
    return elements
      .map((entry) => {
        const org = entry?.['organizationalTarget~'] || entry?.organizationalTarget;
        const orgId = String(org?.id || '').replace('urn:li:organization:', '');
        if (!orgId) return null;
        return {
          id: orgId,
          name: org?.localizedName || org?.vanityName || `Company Page ${orgId}`,
          vanityName: org?.vanityName || null,
        };
      })
      .filter(Boolean);
  } catch (error) {
    console.warn('Failed to fetch LinkedIn organization pages:', error?.message || error);
    return [];
  }
}

function flattenAccountsFromTokens(tokens) {
  const accounts = [];
  for (const token of tokens) {
    const expired = isExpired(token);
    accounts.push({
      id: token.id,
      key: `personal:${token.id}`,
      type: 'personal',
      name: token.name || 'LinkedIn Profile',
      email: token.email || null,
      picture: token.picture || null,
      linkedinSub: token.linkedinSub,
      connected: !expired,
      expired,
    });

    const pages = Array.isArray(token.organizations) ? token.organizations : [];
    for (const page of pages) {
      if (!page?.id) continue;
      accounts.push({
        id: `org:${page.id}`,
        key: `org:${page.id}`,
        type: 'page',
        name: page.name || 'Company Page',
        parentAccountId: token.id,
        organizationId: String(page.id),
        picture: null,
        connected: !expired,
        expired,
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

  async getTokensByUserId(userId) {
    ensureLinkedInModel();
    return prisma.linkedInToken.findMany({
      where: { userId },
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
    if (tokenId) {
      await prisma.linkedInToken.deleteMany({
        where: { id: tokenId, userId },
      });
      return { message: 'LinkedIn account disconnected' };
    }
    await prisma.linkedInToken.deleteMany({ where: { userId } });
    return { message: 'LinkedIn connections disconnected' };
  },

  async getStatus(userId) {
    const accounts = await this.listAccounts(userId);
    const connectedAccounts = accounts.filter((a) => a.connected);
    if (!connectedAccounts.length) {
      const anyExpired = accounts.some((a) => a.expired);
      return { connected: false, expired: anyExpired, accounts };
    }
    const primary = connectedAccounts.find((a) => a.type === 'personal') || connectedAccounts[0];
    return {
      connected: true,
      name: primary.name,
      picture: primary.picture,
      accounts,
    };
  },

  async listAccounts(userId) {
    const tokens = await this.getTokensByUserId(userId);
    return flattenAccountsFromTokens(tokens);
  },

  async postToTarget(userId, targetKey, jobData) {
    if (!targetKey) {
      throw new Error('LinkedIn account target is required');
    }

    let tokenRecord = null;
    let authorUrn = null;

    if (String(targetKey).startsWith('org:')) {
      const orgId = String(targetKey).replace(/^org:/, '');
      const tokens = await this.getTokensByUserId(userId);
      const ownerToken = tokens.find((token) => {
        const pages = Array.isArray(token.organizations) ? token.organizations : [];
        return pages.some((page) => String(page.id) === orgId);
      });
      if (!ownerToken) throw new Error('LinkedIn company page not found');
      tokenRecord = isExpired(ownerToken) ? { ...ownerToken, expired: true } : decryptAccessToken(ownerToken);
      authorUrn = `urn:li:organization:${orgId}`;
    } else {
      const tokenId = String(targetKey).replace(/^personal:/, '');
      tokenRecord = await this.getTokenRecordById(userId, tokenId);
      if (!tokenRecord) throw new Error('LinkedIn account not found');
      authorUrn = `urn:li:person:${tokenRecord.linkedinSub}`;
    }

    if (tokenRecord.expired) {
      throw new Error('LinkedIn token expired. Please reconnect.');
    }

    let shareText =
      jobData.postText ||
      `We're hiring a ${jobData.jobTitle} at ${jobData.company}!\n\n${jobData.description?.substring(0, 200) || ''}${jobData.description?.length > 200 ? '...' : ''}\n\n${jobData.location ? `Location: ${jobData.location}\n\n` : ''}Apply here: ${jobData.applyUrl}\n\n#hiring #jobs #careers`;

    const applyUrl = String(jobData.applyUrl || '').trim();
    if (applyUrl && shareText.includes('[link-on-save]')) {
      shareText = shareText.replace(
        /https?:\/\/[^\s]*\/apply\/\[link-on-save\](?:\?[^\s]*)?/gi,
        applyUrl,
      );
      shareText = shareText.replaceAll('[link-on-save]', applyUrl);
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
          description: { text: String(jobData.jobTitle || 'Job opening').slice(0, 200) },
          media: assetUrn,
          title: { text: String(jobData.jobTitle || 'We\'re hiring').slice(0, 200) },
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
