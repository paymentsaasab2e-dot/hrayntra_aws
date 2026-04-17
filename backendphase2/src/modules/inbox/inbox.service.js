import { prisma } from '../../config/prisma.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';
import { oauthTokenService } from '../oauth/oauth-token.service.js';

function decodeBase64Url(value = '') {
  try {
    return Buffer.from(String(value).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  } catch {
    return '';
  }
}

function getHeader(headers = [], name) {
  return headers.find((header) => header?.name?.toLowerCase() === String(name).toLowerCase())?.value || '';
}

function parseMailbox(value = '') {
  const trimmed = String(value).trim();
  const match = trimmed.match(/^(.*?)(?:<([^>]+)>)?$/);
  const name = match?.[1]?.replace(/"/g, '').trim() || '';
  const email = match?.[2]?.trim() || (trimmed.includes('@') ? trimmed : '');
  return {
    name: name || email || 'Unknown Sender',
    email: email || trimmed || '',
  };
}

function stripHtmlToText(html = '') {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#8202;/gi, ' ')
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
      img {
        max-width: 100%;
        height: auto;
      }
      table {
        max-width: 100%;
      }
      a {
        color: #1a73e8;
      }
    </style>
  </head>
  <body>${clean}</body>
</html>`;
  }

  return clean;
}

function extractBodiesFromPayload(payload) {
  const result = { text: '', html: '' };
  if (!payload) return result;

  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    result.text = decodeBase64Url(payload.body.data);
    return result;
  }

  if (payload.mimeType === 'text/html' && payload.body?.data) {
    result.html = decodeBase64Url(payload.body.data);
    result.text = stripHtmlToText(result.html);
    return result;
  }

  if (payload.body?.data) {
    result.text = decodeBase64Url(payload.body.data);
  }

  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      const extracted = extractBodiesFromPayload(part);
      if (!result.text && extracted.text) result.text = extracted.text;
      if (!result.html && extracted.html) result.html = extracted.html;
      if (result.text && result.html) break;
    }
  }

  return result;
}

function hasAttachment(payload) {
  if (!payload) return false;
  if (payload.filename) return true;
  if (Array.isArray(payload.parts)) return payload.parts.some((part) => hasAttachment(part));
  return false;
}

async function fetchGoogleJson(url, accessToken, init = {}) {
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
    throw new Error(`Google API failed: ${message}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function fetchGmailJson(accessToken, path, init = {}) {
  return fetchGoogleJson(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, accessToken, init);
}

function canReadGmailInbox(scopes = []) {
  const normalized = Array.isArray(scopes) ? scopes.map((scope) => String(scope)) : [];
  return normalized.some((scope) =>
    scope === 'https://www.googleapis.com/auth/gmail.readonly' ||
    scope === 'https://www.googleapis.com/auth/gmail.modify' ||
    scope === 'https://mail.google.com/'
  );
}

function canModifyGmail(scopes = []) {
  const normalized = Array.isArray(scopes) ? scopes.map((scope) => String(scope)) : [];
  return normalized.some((scope) =>
    scope === 'https://www.googleapis.com/auth/gmail.modify' ||
    scope === 'https://mail.google.com/'
  );
}

function canCreateCalendarEvents(scopes = []) {
  const normalized = Array.isArray(scopes) ? scopes.map((scope) => String(scope)) : [];
  return normalized.includes('https://www.googleapis.com/auth/calendar.events');
}

async function getGoogleOauthForUser(userId) {
  return prisma.userOAuthTokens.findUnique({ where: { userId } });
}

async function getGmailAccessContext(userId, { requireModify = false } = {}) {
  const oauth = await getGoogleOauthForUser(userId);
  if (!oauth?.gmailConnected) {
    throw new Error('Gmail is not connected');
  }

  const accessToken = await oauthTokenService.getValidGoogleAccessToken(userId);
  if (!accessToken) {
    throw new Error('Gmail access token is unavailable');
  }

  if (!canReadGmailInbox(oauth.googleScope || [])) {
    const error = new Error('Reconnect Gmail to grant inbox access');
    error.code = 'GMAIL_RECONNECT_REQUIRED';
    throw error;
  }

  if (requireModify && !canModifyGmail(oauth.googleScope || [])) {
    const error = new Error('Reconnect Gmail to grant inbox action permissions');
    error.code = 'GMAIL_MODIFY_SCOPE_REQUIRED';
    throw error;
  }

  return { oauth, accessToken };
}

function toMessageListItem(message, fallbackEmail = '') {
  const headers = message.payload?.headers || [];
  const from = parseMailbox(getHeader(headers, 'From'));
  const to = getHeader(headers, 'To');
  const subject = getHeader(headers, 'Subject') || '(No subject)';
  const internalDate = message.internalDate ? new Date(Number(message.internalDate)) : null;
  const bodies = extractBodiesFromPayload(message.payload);

  return {
    id: message.id,
    threadId: message.threadId,
    sender: from.name,
    email: from.email || fallbackEmail,
    subject,
    preview: message.snippet || '',
    timestamp: internalDate ? internalDate.toISOString() : null,
    unread: Array.isArray(message.labelIds) ? message.labelIds.includes('UNREAD') : false,
    starred: Array.isArray(message.labelIds) ? message.labelIds.includes('STARRED') : false,
    hasAttachment: hasAttachment(message.payload),
    candidate: '',
    job: '',
    client: '',
    type: 'General',
    to,
    cc: getHeader(headers, 'Cc'),
    body: bodies.text || message.snippet || '',
    htmlBody: bodies.html ? sanitizeHtmlDocument(bodies.html) : '',
    attachments: [],
  };
}

function normalizeEmailBodyForCalendar(email) {
  return String(email?.body || email?.preview || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);
}

export const inboxService = {
  async getThreads(req) {
    const { page, limit, skip } = getPaginationParams(req);
    const { relatedEntityType, relatedEntityId, userId } = req.query;

    const where = {};
    if (relatedEntityType) where.relatedEntityType = relatedEntityType;
    if (relatedEntityId) where.relatedEntityId = relatedEntityId;
    if (userId) {
      where.participants = {
        some: { userId },
      };
    }

    const [threads, total] = await Promise.all([
      prisma.thread.findMany({
        where,
        skip,
        take: limit,
        include: {
          participants: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatar: true },
              },
            },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: {
              sender: {
                select: { id: true, name: true, email: true },
              },
            },
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.thread.count({ where }),
    ]);

    return formatPaginationResponse(threads, page, limit, total);
  },

  async getThreadById(id) {
    return prisma.thread.findUnique({
      where: { id },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
        },
        messages: {
          include: {
            sender: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  },

  async createThread(data) {
    const thread = await prisma.thread.create({
      data: {
        subject: data.subject,
        relatedEntityType: data.relatedEntityType,
        relatedEntityId: data.relatedEntityId,
        participants: {
          create: data.participantIds.map((userId) => ({ userId })),
        },
      },
    });

    if (data.initialMessage) {
      await prisma.message.create({
        data: {
          threadId: thread.id,
          senderId: data.senderId,
          body: data.initialMessage,
          attachments: data.attachments || [],
        },
      });
    }

    return prisma.thread.findUnique({
      where: { id: thread.id },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
        },
        messages: {
          include: {
            sender: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  },

  async addMessage(threadId, data) {
    return prisma.message.create({
      data: {
        threadId,
        senderId: data.senderId,
        body: data.body,
        attachments: data.attachments || [],
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });
  },

  async markAsRead(threadId, userId) {
    await prisma.message.updateMany({
      where: {
        threadId,
        senderId: { not: userId },
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { message: 'Messages marked as read' };
  },

  async getGmailMessages(userId, params = {}) {
    const oauth = await getGoogleOauthForUser(userId);
    if (!oauth?.gmailConnected) {
      return { connected: false, email: '', messages: [], nextPageToken: null, requiresReconnect: false };
    }

    const accessToken = await oauthTokenService.getValidGoogleAccessToken(userId);
    if (!accessToken) {
      return {
        connected: false,
        email: oauth.googleEmail || '',
        messages: [],
        nextPageToken: null,
        requiresReconnect: false,
      };
    }

    if (!canReadGmailInbox(oauth.googleScope || [])) {
      return {
        connected: true,
        email: oauth.googleEmail || '',
        messages: [],
        nextPageToken: null,
        requiresReconnect: true,
      };
    }

    const maxResults = Math.min(Math.max(Number(params.maxResults) || 25, 1), 100);
    const labelId = String(params.labelId || 'INBOX').trim() || 'INBOX';
    const query = new URLSearchParams({
      maxResults: String(maxResults),
      labelIds: labelId,
    });
    if (params.q) {
      query.set('q', String(params.q));
    }
    if (params.pageToken) {
      query.set('pageToken', String(params.pageToken));
    }

    let list;
    try {
      list = await fetchGmailJson(accessToken, `messages?${query.toString()}`);
    } catch (error) {
      if (/insufficient|scope|permission|forbidden|gmail api failed/i.test(String(error?.message || ''))) {
        return {
          connected: true,
          email: oauth.googleEmail || '',
          messages: [],
          nextPageToken: null,
          requiresReconnect: true,
        };
      }
      throw error;
    }
    const messages = Array.isArray(list.messages) ? list.messages : [];

    const detailedMessages = await Promise.all(
      messages.map(async (item) => {
        const message = await fetchGmailJson(accessToken, `messages/${item.id}?format=full`);
        return toMessageListItem(message, oauth.googleEmail || '');
      })
    );

    return {
      connected: true,
      email: oauth.googleEmail || '',
      messages: detailedMessages,
      nextPageToken: list.nextPageToken || null,
      requiresReconnect: false,
    };
  },

  async getGmailMessage(userId, messageId) {
    const { oauth, accessToken } = await getGmailAccessContext(userId);
    const message = await fetchGmailJson(accessToken, `messages/${messageId}?format=full`);
    return toMessageListItem(message, oauth.googleEmail || '');
  },

  async archiveGmailMessage(userId, messageId) {
    const { accessToken } = await getGmailAccessContext(userId, { requireModify: true });
    await fetchGmailJson(accessToken, `messages/${messageId}/modify`, {
      method: 'POST',
      body: JSON.stringify({ removeLabelIds: ['INBOX'] }),
    });
    return { success: true, messageId };
  },

  async trashGmailMessage(userId, messageId) {
    const { accessToken } = await getGmailAccessContext(userId, { requireModify: true });
    await fetchGmailJson(accessToken, `messages/${messageId}/trash`, {
      method: 'POST',
    });
    return { success: true, messageId };
  },

  async updateGmailMessageFlags(userId, messageId, flags = {}) {
    const { accessToken } = await getGmailAccessContext(userId, { requireModify: true });
    const addLabelIds = [];
    const removeLabelIds = [];

    if (typeof flags.unread === 'boolean') {
      if (flags.unread) addLabelIds.push('UNREAD');
      else removeLabelIds.push('UNREAD');
    }

    if (typeof flags.starred === 'boolean') {
      if (flags.starred) addLabelIds.push('STARRED');
      else removeLabelIds.push('STARRED');
    }

    const updated = await fetchGmailJson(accessToken, `messages/${messageId}/modify`, {
      method: 'POST',
      body: JSON.stringify({ addLabelIds, removeLabelIds }),
    });

    return {
      success: true,
      messageId,
      unread: Array.isArray(updated?.labelIds) ? updated.labelIds.includes('UNREAD') : !!flags.unread,
      starred: Array.isArray(updated?.labelIds) ? updated.labelIds.includes('STARRED') : !!flags.starred,
    };
  },

  async createCalendarEventFromMessage(userId, messageId) {
    const { oauth, accessToken } = await getGmailAccessContext(userId);
    if (!canCreateCalendarEvents(oauth.googleScope || [])) {
      const error = new Error('Reconnect Google Calendar to grant calendar event access');
      error.code = 'GOOGLE_CALENDAR_SCOPE_REQUIRED';
      throw error;
    }

    const email = await this.getGmailMessage(userId, messageId);
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start);
    end.setHours(end.getHours() + 1);

    const event = await fetchGoogleJson(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          summary: email.subject || 'Follow up from Gmail',
          description: normalizeEmailBodyForCalendar(email),
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
          attendees: email.email ? [{ email: email.email }] : [],
          source: {
            title: email.subject || 'Gmail message',
            url: `https://mail.google.com/mail/u/0/#inbox/${email.id}`,
          },
        }),
      }
    );

    return {
      success: true,
      messageId,
      eventId: event?.id || '',
      eventLink: event?.htmlLink || '',
    };
  },
};
