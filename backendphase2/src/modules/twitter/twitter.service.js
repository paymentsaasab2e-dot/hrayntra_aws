import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { encryption } from '../../utils/encryption.js';

const TWEET_MAX_LENGTH = 280;
const TOKEN_REFRESH_BUFFER_MS = 60_000;

function enc(value) {
  if (!value) return null;
  return encryption.encryptColonString(String(value));
}

function dec(value) {
  if (!value) return '';
  try {
    return encryption.decryptColonString(String(value));
  } catch {
    return '';
  }
}

function truncateTweet(text) {
  const normalized = String(text || '')
    .replace(/\r\n/g, '\n')
    .trim();
  if (normalized.length <= TWEET_MAX_LENGTH) return normalized;
  return `${normalized.slice(0, TWEET_MAX_LENGTH - 1).trim()}…`;
}

function buildDefaultTweetText(jobData = {}) {
  const title = String(jobData.title || 'Open role').trim();
  const company = String(jobData.companyName || 'our team').trim();
  const applyUrl = String(jobData.applyUrl || '').trim();
  const location = String(jobData.location || '').trim();

  const parts = [`We're hiring a ${title} at ${company}!`];
  if (location) parts.push(`📍 ${location}`);
  if (applyUrl) parts.push(`Apply: ${applyUrl}`);
  parts.push('#hiring #jobs');

  let tweet = parts.join(' | ');
  if (tweet.length <= TWEET_MAX_LENGTH) return tweet;

  tweet = `We're hiring: ${title} at ${company}!${location ? ` ${location}.` : ''}${applyUrl ? ` Apply: ${applyUrl}` : ''} #hiring`;
  return truncateTweet(tweet);
}

function resolveTweetText(jobData = {}) {
  const custom = String(jobData.twitterPostText || jobData.postText || '').trim();
  return truncateTweet(custom || buildDefaultTweetText(jobData));
}

function connectionUsername(row) {
  const metadata = row?.metadata;
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return String(metadata.username || metadata.name || '').trim();
  }
  return String(row?.accountName || '').replace(/^@/, '').trim();
}

function hasTweetWriteScope(scopes = []) {
  return Array.isArray(scopes) && scopes.includes('tweet.write');
}

function isExpired(row) {
  if (!row?.expiryDate) return false;
  return new Date(row.expiryDate).getTime() - TOKEN_REFRESH_BUFFER_MS <= Date.now();
}

function parseTwitterApiError(status, bodyText) {
  let detail = bodyText;
  try {
    const parsed = JSON.parse(bodyText);
    detail =
      parsed?.detail ||
      parsed?.title ||
      parsed?.errors?.[0]?.message ||
      parsed?.error_description ||
      parsed?.error ||
      bodyText;
  } catch {
    /* keep raw text */
  }

  const normalized = String(detail || '').toLowerCase();
  if (status === 403 && normalized.includes('suspend')) {
    return 'Your X account is suspended or read-only. Posting is blocked by X — use another account or submit an appeal on x.com.';
  }
  if (status === 403 && (normalized.includes('not permitted') || normalized.includes('forbidden'))) {
    return 'X rejected this post. Confirm the connected account can tweet and that your X app has write access.';
  }
  if (status === 401) {
    return 'X access token expired. Disconnect and reconnect your X account.';
  }
  if (status === 429) {
    return 'X rate limit reached. Try again in a few minutes.';
  }
  return `X API error (${status}): ${detail || 'Unknown error'}`;
}

async function refreshTwitterAccessToken(connectionRow) {
  const refreshToken = dec(connectionRow.refreshToken);
  if (!refreshToken) {
    throw new Error('X refresh token missing. Disconnect and reconnect your X account.');
  }

  if (!env.TWITTER_CLIENT_ID?.trim() || !env.TWITTER_CLIENT_SECRET?.trim()) {
    throw new Error('X OAuth is not configured on the server.');
  }

  const response = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.TWITTER_CLIENT_ID}:${env.TWITTER_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: env.TWITTER_CLIENT_ID.trim(),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    console.error('[twitter] token refresh failed:', response.status, errorBody);
    throw new Error(parseTwitterApiError(response.status, errorBody));
  }

  const tokens = await response.json();
  const expiryDate =
    tokens?.expires_in != null
      ? new Date(Date.now() + Number(tokens.expires_in) * 1000)
      : connectionRow.expiryDate;
  const scope = String(tokens.scope || connectionRow.scope?.join(' ') || '')
    .split(/\s+/)
    .filter(Boolean);

  const updated = await prisma.integrationConnection.update({
    where: { id: connectionRow.id },
    data: {
      accessToken: tokens.access_token ? enc(tokens.access_token) : undefined,
      refreshToken: tokens.refresh_token ? enc(tokens.refresh_token) : undefined,
      expiryDate,
      scope: scope.length ? scope : connectionRow.scope,
    },
  });

  return {
    ...updated,
    accessToken: dec(updated.accessToken),
    refreshToken: dec(updated.refreshToken),
  };
}

async function getConnectionRecord(userId, connectionId) {
  const row = await prisma.integrationConnection.findFirst({
    where: { id: connectionId, userId, provider: 'twitter' },
  });
  if (!row) {
    throw new Error('X account not found. Reconnect your X account.');
  }
  return row;
}

async function getValidAccessToken(userId, connectionId) {
  const row = await getConnectionRecord(userId, connectionId);

  if (!hasTweetWriteScope(row.scope)) {
    throw new Error(
      'Connected X account is missing tweet.write permission. Update TWITTER_OAUTH_SCOPES to include tweet.write, then disconnect and reconnect X.',
    );
  }

  let accessToken = dec(row.accessToken);
  if (!accessToken) {
    throw new Error('X access token missing. Disconnect and reconnect your X account.');
  }

  if (isExpired(row)) {
    const refreshed = await refreshTwitterAccessToken(row);
    accessToken = refreshed.accessToken;
    if (!accessToken) {
      throw new Error('X access token refresh failed. Disconnect and reconnect your X account.');
    }
    return { accessToken, connection: refreshed };
  }

  return { accessToken, connection: { ...row, accessToken, refreshToken: dec(row.refreshToken) } };
}

async function createTweet(accessToken, text) {
  const response = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    console.error('[twitter] create tweet failed:', response.status, errorBody);
    throw new Error(parseTwitterApiError(response.status, errorBody));
  }

  return response.json();
}

function buildTweetUrl(username, tweetId) {
  if (username && tweetId) {
    return `https://x.com/${encodeURIComponent(username)}/status/${encodeURIComponent(tweetId)}`;
  }
  if (tweetId) {
    return `https://x.com/i/web/status/${encodeURIComponent(tweetId)}`;
  }
  return 'https://x.com/';
}

export const twitterService = {
  async postToConnection(userId, connectionId, jobData) {
    const tweetText = resolveTweetText(jobData);
    if (!tweetText) {
      throw new Error('Tweet text is empty.');
    }

    const { accessToken, connection } = await getValidAccessToken(userId, connectionId);
    const result = await createTweet(accessToken, tweetText);
    const tweetId = result?.data?.id || '';
    const username = connectionUsername(connection);
    const url = buildTweetUrl(username, tweetId);
    const accountLabel = connection.accountName || (username ? `@${username}` : connectionId);

    console.log('[twitter] Job posted to X successfully', {
      connectionId,
      account: accountLabel,
      tweetId,
      url,
      jobTitle: String(jobData.title || '').trim() || undefined,
      companyName: String(jobData.companyName || '').trim() || undefined,
      textLength: tweetText.length,
    });

    return {
      success: true,
      connectionId,
      tweetId,
      url,
      text: result?.data?.text || tweetText,
      accountName: connection.accountName || username || null,
    };
  },

  async postJob(userId, jobData, targets = null) {
    const selectedTargets =
      Array.isArray(targets) && targets.length
        ? targets
        : (await prisma.integrationConnection.findMany({
            where: { userId, provider: 'twitter' },
            orderBy: { connectedAt: 'desc' },
            select: { id: true },
          })).map((row) => row.id);

    if (!selectedTargets.length) {
      throw new Error('X is not connected. Connect an X account first.');
    }

    const results = [];
    for (const connectionId of selectedTargets) {
      try {
        results.push(await this.postToConnection(userId, connectionId, jobData));
      } catch (error) {
        const message = error.message || 'Failed to post to X';
        console.error('[twitter] Job post to X failed', { connectionId, error: message });
        results.push({
          success: false,
          connectionId,
          error: message,
        });
      }
    }

    const successes = results.filter((entry) => entry.success);
    if (!successes.length) {
      throw new Error(results[0]?.error || 'Failed to post to X');
    }

    console.log('[twitter] X job publish completed', {
      jobTitle: String(jobData.title || '').trim() || undefined,
      companyName: String(jobData.companyName || '').trim() || undefined,
      posted: successes.length,
      failed: results.length - successes.length,
      tweetUrl: successes[0].url,
      tweetId: successes[0].tweetId,
    });

    return {
      success: true,
      url: successes[0].url,
      tweetId: successes[0].tweetId,
      results,
    };
  },
};
