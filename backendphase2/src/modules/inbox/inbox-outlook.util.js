import { prisma } from '../../config/prisma.js';
import { oauthTokenService } from '../oauth/oauth-token.service.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripHtmlToText(html = '') {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeHtmlDocument(html = '') {
  let clean = String(html || '');
  clean = clean.replace(/<script[\s\S]*?<\/script>/gi, '');
  clean = clean.replace(/\son\w+="[^"]*"/gi, '');
  clean = clean.replace(/\son\w+='[^']*'/gi, '');
  clean = clean.replace(/javascript:/gi, '');

  if (!/<html[\s>]/i.test(clean)) {
    clean = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <base target="_blank" />
    <style>
      body {
        margin: 0;
        padding: 24px;
        background: #ffffff;
        color: #202124;
        font-family: Arial, Helvetica, sans-serif;
        line-height: 1.6;
        word-break: break-word;
      }
      img { max-width: 100%; height: auto; }
      table { max-width: 100%; }
      a { color: #1a73e8; }
    </style>
  </head>
  <body>${clean}</body>
</html>`;
  }

  return clean;
}

function mailboxFromGraph(entry) {
  const address = entry?.emailAddress || entry || {};
  return {
    name: String(address.name || address.address || '').trim() || 'Unknown Sender',
    email: String(address.address || '').trim(),
  };
}

function formatRecipients(list = []) {
  return (Array.isArray(list) ? list : [])
    .map((item) => {
      const parsed = mailboxFromGraph(item);
      return parsed.email ? `${parsed.name} <${parsed.email}>` : parsed.name;
    })
    .filter(Boolean)
    .join(', ');
}

function canReadOutlook(scopes = []) {
  const haystack = Array.isArray(scopes) ? scopes.join(' ').toLowerCase() : String(scopes || '').toLowerCase();
  return haystack.includes('mail.read') || haystack.includes('mail.readwrite');
}

function canModifyOutlook(scopes = []) {
  const haystack = Array.isArray(scopes) ? scopes.join(' ').toLowerCase() : String(scopes || '').toLowerCase();
  return haystack.includes('mail.readwrite');
}

function canCreateOutlookCalendar(scopes = []) {
  const haystack = Array.isArray(scopes) ? scopes.join(' ').toLowerCase() : String(scopes || '').toLowerCase();
  return haystack.includes('calendars.readwrite') || haystack.includes('calendars.read');
}

function isGraphRateLimited(status, bodyText = '') {
  if (status === 429 || status === 503) return true;
  return /TooManyRequests|activityLimitReached/i.test(String(bodyText));
}

function isOutlookMailboxUnavailable(status, bodyText = '') {
  return /MailboxNotEnabledForRESTAPI|MailboxNotEnabled|The mailbox is either inactive|does not have an Outlook mailbox/i.test(
    String(bodyText)
  );
}

function normalizeMicrosoftEmail(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const ext = raw.match(/^([^#]+)#EXT#/i);
  const source = ext ? ext[1] : raw;
  if (source.includes('@')) return source;
  const underscored = source.match(/^(.+)_([^_]+\.[a-z]{2,})$/i);
  if (underscored) return `${underscored[1]}@${underscored[2]}`;
  return source;
}

async function resolveOutlookEmail(accessToken, fallback = '') {
  try {
    const me = await fetchGraphJson(
      'https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,otherMails',
      accessToken
    );
    const mail = normalizeMicrosoftEmail(me?.mail);
    if (mail) return mail;
    const other = Array.isArray(me?.otherMails)
      ? normalizeMicrosoftEmail(me.otherMails.find(Boolean))
      : '';
    if (other) return other;
    return normalizeMicrosoftEmail(me?.userPrincipalName) || fallback;
  } catch {
    return fallback;
  }
}

async function fetchGraphJson(url, accessToken, init = {}, attempt = 0) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const message = await response.text();
    if (isGraphRateLimited(response.status, message) && attempt < 4) {
      const retryAfter = Number(response.headers.get('retry-after'));
      const waitMs =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : Math.min(8000, 400 * 2 ** attempt);
      await sleep(waitMs);
      return fetchGraphJson(url, accessToken, init, attempt + 1);
    }
    const error = new Error(
      isGraphRateLimited(response.status, message)
        ? 'Outlook is busy right now. Please wait a moment and try again.'
        : isOutlookMailboxUnavailable(response.status, message)
          ? 'This Microsoft account does not have an Outlook mailbox.'
          : `Microsoft Graph failed: ${message}`
    );
    error.status = response.status;
    error.code = isOutlookMailboxUnavailable(response.status, message)
      ? 'OUTLOOK_MAILBOX_UNAVAILABLE'
      : error.code;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

function toOutlookListItem(message, fallbackEmail = '') {
  const from = mailboxFromGraph(message?.from);
  const bodyContent = String(message?.body?.content || '');
  const isHtml = String(message?.body?.contentType || '').toLowerCase() === 'html';
  const text = isHtml ? stripHtmlToText(bodyContent) : bodyContent;
  return {
    id: message.id,
    threadId: message.conversationId || message.id,
    sender: from.name,
    email: from.email || fallbackEmail,
    subject: message.subject || '(No subject)',
    preview: message.bodyPreview || text.slice(0, 180),
    timestamp: message.receivedDateTime || null,
    unread: message.isRead === false,
    starred: String(message?.flag?.flagStatus || '').toLowerCase() === 'flagged',
    hasAttachment: Boolean(message.hasAttachments),
    candidate: '',
    job: '',
    client: '',
    type: 'General',
    to: formatRecipients(message.toRecipients),
    cc: formatRecipients(message.ccRecipients),
    body: text || message.bodyPreview || '',
    htmlBody: isHtml && bodyContent ? sanitizeHtmlDocument(bodyContent) : '',
    attachments: [],
  };
}

const LIST_SELECT =
  'id,conversationId,from,subject,bodyPreview,receivedDateTime,isRead,flag,hasAttachments,toRecipients,ccRecipients';

function wellKnownFolder(labelId = 'INBOX') {
  const folder = String(labelId || 'INBOX').toUpperCase();
  if (folder === 'SENT') return 'sentitems';
  if (folder === 'DRAFT') return 'drafts';
  if (folder === 'STARRED' || folder === 'SNOOZED') return '';
  return 'inbox';
}

function sortOutlookMessages(messages = []) {
  return [...messages].sort((a, b) => {
    const left = new Date(b?.receivedDateTime || 0).getTime();
    const right = new Date(a?.receivedDateTime || 0).getTime();
    return left - right;
  });
}

async function fetchGraphList(accessToken, path, query, extraHeaders = {}) {
  const suffix = query?.toString() ? `?${query.toString()}` : '';
  return fetchGraphJson(`https://graph.microsoft.com/v1.0/${path}${suffix}`, accessToken, {
    headers: extraHeaders,
  });
}

async function listOutlookGraphMessages(accessToken, params = {}) {
  const folder = String(params.labelId || 'INBOX').toUpperCase();
  const maxResults = Math.min(Math.max(Number(params.maxResults) || 25, 1), 50);
  if (folder === 'SNOOZED') {
    return { value: [], '@odata.nextLink': null };
  }

  if (params.pageToken && String(params.pageToken).startsWith('https://graph.microsoft.com')) {
    return fetchGraphJson(String(params.pageToken), accessToken);
  }

  const simpleQuery = (extra = {}) => {
    const query = new URLSearchParams({ $top: String(maxResults) });
    if (params.q) query.set('$search', `"${String(params.q).replace(/"/g, '')}"`);
    Object.entries(extra).forEach(([key, value]) => {
      if (value) query.set(key, String(value));
    });
    return query;
  };
  const searchHeaders = params.q ? { ConsistencyLevel: 'eventual' } : {};

  const attempts = [];
  if (folder === 'STARRED') {
    attempts.push({
      path: 'me/messages',
      query: simpleQuery(params.q ? {} : { $filter: "flag/flagStatus eq 'flagged'" }),
    });
  } else {
    const known = wellKnownFolder(folder);
    if (known) {
      try {
        const folderMeta = await fetchGraphJson(
          `https://graph.microsoft.com/v1.0/me/mailFolders/${known}?$select=id,displayName,totalItemCount`,
          accessToken
        );
        if (folderMeta?.id) {
          attempts.push({ path: `me/mailFolders/${folderMeta.id}/messages`, query: simpleQuery() });
        }
      } catch (error) {
        if (error?.code === 'OUTLOOK_MAILBOX_UNAVAILABLE') throw error;
      }
      attempts.push({ path: `me/mailFolders/${known}/messages`, query: simpleQuery() });
      attempts.push({ path: `me/mailFolders('${known}')/messages`, query: simpleQuery() });
    }
    if (folder === 'INBOX') {
      attempts.push({ path: 'me/messages', query: simpleQuery() });
    }
  }

  let lastError = null;
  for (const attempt of attempts) {
    try {
      const list = await fetchGraphList(accessToken, attempt.path, attempt.query, searchHeaders);
      const rows = Array.isArray(list?.value) ? list.value : [];
      if (rows.length > 0 || attempt.path === 'me/messages' || attempts.indexOf(attempt) === attempts.length - 1) {
        return {
          ...list,
          value: sortOutlookMessages(rows),
        };
      }
    } catch (error) {
      lastError = error;
      console.warn('[outlook] Graph list failed', attempt.path, error?.message || error);
      if (error?.code === 'OUTLOOK_MAILBOX_UNAVAILABLE') throw error;
    }
  }

  if (lastError) throw lastError;
  return { value: [] };
}

async function getOutlookOauth(userId) {
  return prisma.userOAuthTokens.findUnique({ where: { userId } });
}

async function getOutlookAccessContext(userId, { requireModify = false } = {}) {
  const oauth = await getOutlookOauth(userId);
  if (!oauth?.outlookConnected) {
    throw new Error('Outlook is not connected');
  }
  const accessToken = await oauthTokenService.getValidMicrosoftAccessToken(userId);
  if (!accessToken) {
    throw new Error('Outlook access token is unavailable');
  }
  if (!canReadOutlook(oauth.microsoftScope || [])) {
    const error = new Error('Reconnect Outlook to grant inbox access');
    error.code = 'OUTLOOK_RECONNECT_REQUIRED';
    throw error;
  }
  if (requireModify && !canModifyOutlook(oauth.microsoftScope || [])) {
    const error = new Error('Reconnect Outlook to grant inbox action permissions');
    error.code = 'OUTLOOK_MODIFY_SCOPE_REQUIRED';
    throw error;
  }
  return { oauth, accessToken };
}

function emptyOutlook(oauth = null, extra = {}) {
  return {
    connected: false,
    email: normalizeMicrosoftEmail(oauth?.microsoftEmail || ''),
    messages: [],
    nextPageToken: null,
    requiresReconnect: false,
    mailboxUnavailable: false,
    ...extra,
  };
}

function nextPageTokenFromGraph(payload) {
  const next = String(payload?.['@odata.nextLink'] || '').trim();
  return next || null;
}

export async function getOutlookMailboxStatus(userId) {
  const oauth = await getOutlookOauth(userId);
  return {
    connected: !!(oauth?.outlookConnected && oauth?.microsoftAccessToken),
    email: normalizeMicrosoftEmail(oauth?.microsoftEmail || ''),
  };
}

export async function getOutlookMessages(userId, params = {}) {
  const oauth = await getOutlookOauth(userId);
  if (!oauth?.outlookConnected) {
    return emptyOutlook(oauth);
  }

  let accessToken;
  try {
    accessToken = await oauthTokenService.getValidMicrosoftAccessToken(userId);
  } catch (error) {
    console.warn('[outlook] token refresh failed', error?.message || error);
    return emptyOutlook(oauth, { connected: true, requiresReconnect: true });
  }
  if (!accessToken) {
    return emptyOutlook(oauth);
  }

  if (!canReadOutlook(oauth.microsoftScope || [])) {
    return emptyOutlook(oauth, { connected: true, requiresReconnect: true });
  }

  const mailboxEmail =
    (await resolveOutlookEmail(accessToken, normalizeMicrosoftEmail(oauth.microsoftEmail || ''))) ||
    normalizeMicrosoftEmail(oauth.microsoftEmail || '');

  let list;
  try {
    list = await listOutlookGraphMessages(accessToken, params);
  } catch (error) {
    const folder = String(params.labelId || 'INBOX').toUpperCase();
    if (folder === 'SNOOZED') {
      return {
        connected: true,
        email: mailboxEmail,
        messages: [],
        nextPageToken: null,
        requiresReconnect: false,
        mailboxUnavailable: false,
      };
    }
    if (error?.code === 'OUTLOOK_MAILBOX_UNAVAILABLE') {
      return emptyOutlook(oauth, {
        connected: true,
        email: mailboxEmail,
        mailboxUnavailable: true,
      });
    }
    if (
      error?.status === 401 ||
      /insufficient|scope|permission|forbidden|Authorization_RequestDenied|unauthoriz|invalid.?token/i.test(
        String(error?.message || '')
      )
    ) {
      return emptyOutlook(oauth, { connected: true, email: mailboxEmail, requiresReconnect: true });
    }
    throw error;
  }

  const messages = Array.isArray(list?.value) ? list.value : [];
  return {
    connected: true,
    email: mailboxEmail,
    messages: messages.map((item) => toOutlookListItem(item, mailboxEmail)),
    nextPageToken: nextPageTokenFromGraph(list),
    requiresReconnect: false,
    mailboxUnavailable: false,
  };
}

export async function getOutlookMessage(userId, messageId) {
  const { oauth, accessToken } = await getOutlookAccessContext(userId);
  const encoded = encodeURIComponent(String(messageId || '').trim());
  const message = await fetchGraphJson(
    `https://graph.microsoft.com/v1.0/me/messages/${encoded}?$select=${LIST_SELECT},body`,
    accessToken
  );
  return toOutlookListItem(message, oauth.microsoftEmail || '');
}

export async function archiveOutlookMessage(userId, messageId) {
  const { accessToken } = await getOutlookAccessContext(userId, { requireModify: true });
  const encoded = encodeURIComponent(String(messageId || '').trim());
  await fetchGraphJson(`https://graph.microsoft.com/v1.0/me/messages/${encoded}/move`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ destinationId: 'archive' }),
  });
  return { success: true, messageId };
}

export async function trashOutlookMessage(userId, messageId) {
  const { accessToken } = await getOutlookAccessContext(userId, { requireModify: true });
  const encoded = encodeURIComponent(String(messageId || '').trim());
  await fetchGraphJson(`https://graph.microsoft.com/v1.0/me/messages/${encoded}/move`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ destinationId: 'deleteditems' }),
  });
  return { success: true, messageId };
}

export async function updateOutlookMessageFlags(userId, messageId, flags = {}) {
  const { accessToken } = await getOutlookAccessContext(userId, { requireModify: true });
  const encoded = encodeURIComponent(String(messageId || '').trim());
  const body = {};
  if (typeof flags.unread === 'boolean') body.isRead = !flags.unread;
  if (typeof flags.starred === 'boolean') {
    body.flag = { flagStatus: flags.starred ? 'flagged' : 'notFlagged' };
  }
  const updated = await fetchGraphJson(
    `https://graph.microsoft.com/v1.0/me/messages/${encoded}`,
    accessToken,
    { method: 'PATCH', body: JSON.stringify(body) }
  );
  return {
    success: true,
    messageId,
    unread: updated?.isRead === false,
    starred: String(updated?.flag?.flagStatus || '').toLowerCase() === 'flagged',
  };
}

export async function createCalendarEventFromOutlookMessage(userId, messageId) {
  const { oauth, accessToken } = await getOutlookAccessContext(userId);
  if (!canCreateOutlookCalendar(oauth.microsoftScope || [])) {
    const error = new Error('Reconnect Microsoft Calendar to grant calendar event access');
    error.code = 'OUTLOOK_CALENDAR_SCOPE_REQUIRED';
    throw error;
  }

  const email = await getOutlookMessage(userId, messageId);
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);

  const event = await fetchGraphJson('https://graph.microsoft.com/v1.0/me/events', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      subject: email.subject || 'Follow up from Outlook',
      body: {
        contentType: 'text',
        content: String(email.body || email.preview || '').slice(0, 4000),
      },
      start: { dateTime: start.toISOString(), timeZone: 'UTC' },
      end: { dateTime: end.toISOString(), timeZone: 'UTC' },
      attendees: email.email
        ? [{ emailAddress: { address: email.email, name: email.sender }, type: 'required' }]
        : [],
    }),
  });

  return {
    success: true,
    messageId,
    eventId: event?.id || '',
    eventLink: event?.webLink || '',
  };
}
