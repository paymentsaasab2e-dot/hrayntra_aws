import { prisma } from '../../config/prisma.js';
import { encryption } from '../../utils/encryption.js';

const GRAPH_VERSION = 'v19.0';
const MESSAGE_MAX_LENGTH = 6000;

function dec(value) {
  if (!value) return '';
  try {
    return encryption.decryptColonString(String(value));
  } catch {
    return '';
  }
}

function isPageRow(row) {
  const metadata = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  return metadata.type === 'page' || metadata.accountType === 'page';
}

function truncateMessage(text) {
  const normalized = String(text || '')
    .replace(/\r\n/g, '\n')
    .trim();
  if (normalized.length <= MESSAGE_MAX_LENGTH) return normalized;
  return `${normalized.slice(0, MESSAGE_MAX_LENGTH - 1).trim()}…`;
}

function buildDefaultPostText(jobData = {}) {
  const title = String(jobData.jobTitle || jobData.title || 'Open role').trim();
  const company = String(jobData.company || jobData.companyName || 'our team').trim();
  const applyUrl = String(jobData.applyUrl || '').trim();
  const location = String(jobData.location || '').trim();
  const description = String(jobData.description || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);

  const lines = [`We're hiring: ${title} at ${company}`];
  if (location) lines.push(`Location: ${location}`);
  if (description) lines.push('', description);
  if (applyUrl) lines.push('', `Apply: ${applyUrl}`);
  lines.push('', '#hiring #jobs');
  return truncateMessage(lines.join('\n'));
}

function resolvePostText(jobData = {}) {
  const custom = String(jobData.facebookPostText || jobData.postText || '').trim();
  let text = truncateMessage(custom || buildDefaultPostText(jobData));
  const applyUrl = String(jobData.applyUrl || '').trim();
  if (applyUrl && text.includes('[link-on-save]')) {
    text = text.replace(/https?:\/\/[^\s]*\/apply\/\[link-on-save\](?:\?[^\s]*)?/gi, applyUrl);
    text = text.replaceAll('[link-on-save]', applyUrl);
  }
  return text;
}

function parseFacebookApiError(status, bodyText) {
  let detail = bodyText;
  try {
    const parsed = JSON.parse(bodyText);
    detail =
      parsed?.error?.message ||
      parsed?.error?.error_user_msg ||
      parsed?.message ||
      parsed?.error_description ||
      bodyText;
  } catch {
    /* keep raw */
  }

  const normalized = String(detail || '').toLowerCase();
  if (status === 190 || normalized.includes('session has expired') || normalized.includes('invalid oauth')) {
    return 'Facebook access expired. Disconnect and reconnect Facebook, then try again.';
  }
  if (normalized.includes('pages_manage_posts') || normalized.includes('permission')) {
    return 'Facebook Page posting permission missing. Reconnect Facebook and grant Page posting access.';
  }
  if (status === 429) {
    return 'Facebook rate limit reached. Try again in a few minutes.';
  }
  return `Facebook API error (${status}): ${detail || 'Unknown error'}`;
}

function pagePermalink(pageId, postId) {
  const raw = String(postId || '').trim();
  if (!raw) return pageId ? `https://www.facebook.com/${encodeURIComponent(pageId)}` : 'https://www.facebook.com/';
  // Graph returns "{pageId}_{postId}" for feed posts.
  const parts = raw.includes('_') ? raw.split('_') : [pageId, raw];
  const pid = parts[0] || pageId;
  const storyId = parts[1] || raw;
  if (pid && storyId) {
    return `https://www.facebook.com/${encodeURIComponent(pid)}/posts/${encodeURIComponent(storyId)}`;
  }
  return `https://www.facebook.com/${encodeURIComponent(raw)}`;
}

async function listPageConnections(userId) {
  const rows = await prisma.integrationConnection.findMany({
    where: { provider: 'facebook' },
    orderBy: { connectedAt: 'desc' },
  });
  // Prefer pages owned by this user, then any tenant page (same pattern as status listing).
  const pages = rows.filter(isPageRow);
  const own = pages.filter((row) => String(row.userId) === String(userId));
  return own.length ? own : pages;
}

function matchConnection(rows, target) {
  const raw = String(target || '').trim();
  if (!raw) return null;
  const pageId = raw.startsWith('page:') ? raw.slice(5) : raw;
  return (
    rows.find((row) => String(row.id) === raw) ||
    rows.find((row) => String(row.accountId) === pageId) ||
    rows.find((row) => `page:${row.accountId}` === raw) ||
    null
  );
}

async function createPageFeedPost(pageId, pageAccessToken, message, link) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(pageId)}/feed`);
  const body = {
    message,
    access_token: pageAccessToken,
  };
  if (link) body.link = link;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await response.text().catch(() => '');
  if (!response.ok) {
    console.error('[facebook] page feed post failed:', response.status, text);
    throw new Error(parseFacebookApiError(response.status, text));
  }

  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return data;
}

export const facebookService = {
  async postToConnection(connectionRow, jobData) {
    if (!isPageRow(connectionRow)) {
      throw new Error(
        'Facebook personal profiles cannot receive job posts via API. Connect a Facebook Page you manage.',
      );
    }

    const pageId = String(connectionRow.accountId || '').trim();
    const accessToken = dec(connectionRow.accessToken);
    if (!pageId || !accessToken) {
      throw new Error('Facebook Page token missing. Disconnect and reconnect Facebook.');
    }

    const message = resolvePostText(jobData);
    if (!message) {
      throw new Error('Facebook post text is empty.');
    }

    const applyUrl = String(jobData.applyUrl || '').trim();
    const result = await createPageFeedPost(pageId, accessToken, message, applyUrl || undefined);
    const postId = String(result?.id || '').trim();
    const url = pagePermalink(pageId, postId);

    console.log('[facebook] Job posted to Facebook Page', {
      connectionId: connectionRow.id,
      pageId,
      pageName: connectionRow.accountName || null,
      postId,
      url,
      jobTitle: String(jobData.jobTitle || jobData.title || '').trim() || undefined,
    });

    return {
      success: true,
      connectionId: connectionRow.id,
      pageId,
      postId,
      url,
      accountName: connectionRow.accountName || null,
    };
  },

  async postJob(userId, jobData, targets = null) {
    const pageRows = await listPageConnections(userId);
    if (!pageRows.length) {
      throw new Error(
        'No Facebook Page connected. Log in with Facebook and grant access to a Page you manage.',
      );
    }

    let selectedRows;
    if (Array.isArray(targets) && targets.length) {
      selectedRows = [];
      for (const target of targets) {
        const match = matchConnection(pageRows, target);
        if (match) selectedRows.push(match);
      }
      // Also allow matching against all facebook rows (in case target is connection id of personal that has pages)
      if (!selectedRows.length) {
        const allFacebook = await prisma.integrationConnection.findMany({
          where: { provider: 'facebook' },
          orderBy: { connectedAt: 'desc' },
        });
        for (const target of targets) {
          const match = matchConnection(allFacebook.filter(isPageRow), target);
          if (match) selectedRows.push(match);
        }
      }
    } else {
      selectedRows = pageRows.filter((row) => String(row.userId) === String(userId));
      if (!selectedRows.length) selectedRows = pageRows;
    }

    // De-dupe by page id
    const seen = new Set();
    selectedRows = selectedRows.filter((row) => {
      const key = String(row.accountId || row.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (!selectedRows.length) {
      throw new Error('No matching Facebook Page selected. Reconnect Facebook and try again.');
    }

    const results = [];
    for (const row of selectedRows) {
      try {
        results.push(await this.postToConnection(row, jobData));
      } catch (error) {
        const message = error.message || 'Failed to post to Facebook';
        console.error('[facebook] Job post failed', {
          connectionId: row.id,
          pageId: row.accountId,
          error: message,
        });
        results.push({
          success: false,
          connectionId: row.id,
          pageId: row.accountId || null,
          error: message,
        });
      }
    }

    const successes = results.filter((entry) => entry.success);
    if (!successes.length) {
      throw new Error(results[0]?.error || 'Failed to post to Facebook');
    }

    return {
      success: true,
      url: successes[0].url,
      postId: successes[0].postId,
      results,
    };
  },
};
