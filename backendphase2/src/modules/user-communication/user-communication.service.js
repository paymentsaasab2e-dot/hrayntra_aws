import { prisma } from '../../config/prisma.js';
import { encryption } from '../../utils/encryption.js';
import { z } from 'zod';

const PLATFORMS = ['LinkedIn', 'Indeed', 'Naukri'];

const defaultEmailsFallback = () => [
  'recruiting@globalrecruiters.com',
  'hr@globalrecruiters.com',
];

function dec(v) {
  if (v == null || v === '') return '';
  return encryption.decryptColonString(String(v));
}

function enc(v) {
  if (v == null || v === '') return null;
  return encryption.encryptColonString(String(v));
}

/** @param {string} userId @param {{ email?: string }} [user] */
export async function ensurePreferences(userId, user = {}) {
  let p = await prisma.userCommunicationPreferences.findUnique({
    where: { userId },
  });
  if (p) return p;
  const emails = user.email
    ? [String(user.email).toLowerCase(), ...defaultEmailsFallback()].filter(
        (e, i, a) => a.indexOf(e) === i
      )
    : defaultEmailsFallback();
  return prisma.userCommunicationPreferences.create({
    data: {
      userId,
      defaultEmails: emails,
      defaultSendingEmail: emails[0],
      smsAutoNotifications: false,
      googleCalendarSync: true,
      teamsCalendarSync: false,
      interviewAutoScheduling: true,
    },
  });
}

async function ensureOAuthRow(userId) {
  const row = await prisma.userOAuthTokens.findUnique({ where: { userId } });
  if (row) return row;
  return prisma.userOAuthTokens.create({ data: { userId } });
}

export async function getJobBoardRows(userId) {
  return prisma.jobBoardIntegration.findMany({ where: { userId } });
}

export async function getCompositeResponse(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  const prefs = await ensurePreferences(userId, user || {});
  const oauth = await prisma.userOAuthTokens.findUnique({ where: { userId } });
  const li = await prisma.linkedInToken.findUnique({ where: { userId } });
  const boards = await getJobBoardRows(userId);
  const boardMap = Object.fromEntries(boards.map((b) => [b.platform, b]));

  const twilioTok = dec(prefs.twilioAuthToken);
  const teamsSec = dec(prefs.teamsClientSecret);

  const settings = {
    defaultEmails: prefs.defaultEmails,
    defaultSendingEmail: prefs.defaultSendingEmail,
    twilioAccountSid: prefs.twilioAccountSid || '',
    twilioAuthToken: twilioTok,
    smsAutoNotifications: prefs.smsAutoNotifications,
    googleCalendarSync: prefs.googleCalendarSync,
    teamsCalendarSync: prefs.teamsCalendarSync,
    teamsTenantId: prefs.teamsTenantId || '',
    teamsClientId: prefs.teamsClientId || '',
    teamsClientSecret: teamsSec,
    interviewAutoScheduling: prefs.interviewAutoScheduling,
  };

  const googleEmail = oauth?.googleEmail || '';
  const msEmail = oauth?.microsoftEmail || '';

  const connections = {
    gmail: {
      connected: !!(oauth?.gmailConnected && oauth?.googleAccessToken),
      email: googleEmail || undefined,
    },
    googleCalendar: {
      connected: !!(oauth?.googleCalConnected && oauth?.googleAccessToken),
      email: googleEmail || undefined,
    },
    outlook: {
      connected: !!(oauth?.outlookConnected && oauth?.microsoftAccessToken),
      email: msEmail || undefined,
    },
    teams: {
      connected: !!(oauth?.teamsConnected && oauth?.microsoftAccessToken),
      email: msEmail || undefined,
    },
    linkedin: {
      connected: !!(li && li.expiresAt > new Date()),
      email: li?.email || undefined,
      pageName: li?.name || undefined,
    },
  };

  const linkedInRow = boardMap.LinkedIn;
  const indeedRow = boardMap.Indeed;
  const naukriRow = boardMap.Naukri;

  const jobBoardKeys = {
    LinkedIn: {
      apiKey: linkedInRow?.apiKey ? dec(linkedInRow.apiKey) : '',
      clientId: linkedInRow?.clientId || oauth?.linkedinAppClientId || '',
      connected: !!(linkedInRow?.connected || linkedInRow?.apiKey),
    },
    Indeed: {
      apiKey: indeedRow?.apiKey ? dec(indeedRow.apiKey) : '',
      publisherId: indeedRow?.publisherId || '',
      connected: !!(indeedRow?.connected || (indeedRow?.apiKey && indeedRow?.publisherId)),
    },
    Naukri: {
      apiKey: naukriRow?.apiKey ? dec(naukriRow.apiKey) : '',
      clientId: naukriRow?.clientId || '',
      connected: !!(naukriRow?.connected || naukriRow?.apiKey),
    },
  };

  const linkedinAppClientSecret = oauth?.linkedinAppClientSecret
    ? dec(oauth.linkedinAppClientSecret)
    : '';

  return {
    settings,
    connections,
    jobBoardKeys,
    linkedinApp: {
      clientId: oauth?.linkedinAppClientId || '',
      clientSecret: linkedinAppClientSecret,
    },
  };
}

const putSchema = z.object({
  settings: z
    .object({
      defaultEmails: z.array(z.string()).optional(),
      defaultSendingEmail: z.string().optional(),
      twilioAccountSid: z.string().optional(),
      twilioAuthToken: z.string().optional(),
      smsAutoNotifications: z.boolean().optional(),
      googleCalendarSync: z.boolean().optional(),
      teamsCalendarSync: z.boolean().optional(),
      teamsTenantId: z.string().optional(),
      teamsClientId: z.string().optional(),
      teamsClientSecret: z.string().optional(),
      interviewAutoScheduling: z.boolean().optional(),
    })
    .optional(),
  jobBoardKeys: z
    .object({
      LinkedIn: z
        .object({
          apiKey: z.string().optional(),
          clientId: z.string().optional(),
          connected: z.boolean().optional(),
        })
        .optional(),
      Indeed: z
        .object({
          apiKey: z.string().optional(),
          publisherId: z.string().optional(),
          connected: z.boolean().optional(),
        })
        .optional(),
      Naukri: z
        .object({
          apiKey: z.string().optional(),
          clientId: z.string().optional(),
          connected: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
  linkedinApp: z
    .object({
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
    })
    .optional(),
});

/**
 * If new secret is empty, keep existing encrypted value when updating.
 */
export async function putComposite(userId, body, userEmail) {
  const parsed = putSchema.parse(body);
  const existing = await ensurePreferences(userId, { email: userEmail });
  const existingOauth = await ensureOAuthRow(userId);

  const s = parsed.settings || {};
  let twilioEnc = existing.twilioAuthToken;
  if (s.twilioAuthToken !== undefined) {
    if (s.twilioAuthToken === '') twilioEnc = null;
    else {
      const prev = dec(existing.twilioAuthToken);
      twilioEnc = s.twilioAuthToken !== prev ? enc(s.twilioAuthToken) : existing.twilioAuthToken;
    }
  }
  let teamsEnc = existing.teamsClientSecret;
  if (s.teamsClientSecret !== undefined) {
    if (s.teamsClientSecret === '') teamsEnc = null;
    else {
      const prev = dec(existing.teamsClientSecret);
      teamsEnc =
        s.teamsClientSecret !== prev ? enc(s.teamsClientSecret) : existing.teamsClientSecret;
    }
  }

  const emails =
    s.defaultEmails != null && s.defaultEmails.length
      ? s.defaultEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean)
      : existing.defaultEmails;

  const defaultSending =
    s.defaultSendingEmail != null
      ? s.defaultSendingEmail
      : emails.includes(existing.defaultSendingEmail)
        ? existing.defaultSendingEmail
        : emails[0];

  await prisma.userCommunicationPreferences.update({
    where: { userId },
    data: {
      defaultEmails: emails,
      defaultSendingEmail: defaultSending,
      twilioAccountSid:
        s.twilioAccountSid !== undefined ? s.twilioAccountSid || null : undefined,
      twilioAuthToken: twilioEnc,
      smsAutoNotifications: s.smsAutoNotifications ?? undefined,
      googleCalendarSync: s.googleCalendarSync ?? undefined,
      teamsCalendarSync: s.teamsCalendarSync ?? undefined,
      teamsTenantId: s.teamsTenantId !== undefined ? s.teamsTenantId || null : undefined,
      teamsClientId: s.teamsClientId !== undefined ? s.teamsClientId || null : undefined,
      teamsClientSecret: teamsEnc,
      interviewAutoScheduling: s.interviewAutoScheduling ?? undefined,
    },
  });

  if (parsed.linkedinApp) {
    const { clientId, clientSecret } = parsed.linkedinApp;
    let secretEnc = existingOauth.linkedinAppClientSecret;
    if (clientSecret !== undefined) {
      if (clientSecret === '') secretEnc = null;
      else {
        const prev = dec(existingOauth.linkedinAppClientSecret || '');
        secretEnc =
          clientSecret !== prev ? enc(clientSecret) : existingOauth.linkedinAppClientSecret;
      }
    }
    await prisma.userOAuthTokens.update({
      where: { userId },
      data: {
        linkedinAppClientId:
          clientId !== undefined ? clientId || null : undefined,
        linkedinAppClientSecret: secretEnc,
      },
    });
  }

  const jb = parsed.jobBoardKeys || {};
  for (const platform of PLATFORMS) {
    const payload = jb[platform];
    if (!payload) continue;
    const row = await prisma.jobBoardIntegration.findUnique({
      where: { userId_platform: { userId, platform } },
    });
    let apiEnc = row?.apiKey ?? null;
    if (payload.apiKey !== undefined) {
      if (payload.apiKey === '') apiEnc = null;
      else {
        const prev = row?.apiKey ? dec(row.apiKey) : '';
        apiEnc = payload.apiKey !== prev ? enc(payload.apiKey) : row?.apiKey;
      }
    }
    const nextClientId =
      payload.clientId !== undefined ? payload.clientId || null : row?.clientId ?? null;
    const nextPublisherId =
      platform === 'Indeed' && payload.publisherId !== undefined
        ? payload.publisherId || null
        : row?.publisherId ?? null;
    const nextConnected =
      payload.connected !== undefined
        ? payload.connected
        : !!(apiEnc || nextClientId || nextPublisherId);

    await prisma.jobBoardIntegration.upsert({
      where: { userId_platform: { userId, platform } },
      create: {
        userId,
        platform,
        apiKey:
          payload.apiKey !== undefined
            ? payload.apiKey
              ? enc(payload.apiKey)
              : null
            : null,
        clientId: payload.clientId !== undefined ? payload.clientId || null : null,
        publisherId:
          platform === 'Indeed' && payload.publisherId !== undefined
            ? payload.publisherId || null
            : null,
        connected: nextConnected,
      },
      update: {
        ...(payload.apiKey !== undefined ? { apiKey: apiEnc } : {}),
        ...(payload.clientId !== undefined ? { clientId: nextClientId } : {}),
        ...(platform === 'Indeed' && payload.publisherId !== undefined
          ? { publisherId: nextPublisherId }
          : {}),
        connected: nextConnected,
      },
    });
  }

  return getCompositeResponse(userId);
}

const patchSchema = z.object({
  googleCalendarSync: z.boolean().optional(),
  teamsCalendarSync: z.boolean().optional(),
  smsAutoNotifications: z.boolean().optional(),
  interviewAutoScheduling: z.boolean().optional(),
  linkedinApp: z
    .object({
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
    })
    .optional(),
});

export async function patchPreferences(userId, body, userEmail) {
  const p = patchSchema.parse(body);
  await ensurePreferences(userId, { email: userEmail });
  const { linkedinApp, ...prefs } = p;
  if (Object.keys(prefs).length) {
    await prisma.userCommunicationPreferences.update({
      where: { userId },
      data: prefs,
    });
  }
  if (linkedinApp) {
    const existingOauth = await ensureOAuthRow(userId);
    let secretEnc = existingOauth.linkedinAppClientSecret;
    if (linkedinApp.clientSecret !== undefined) {
      if (linkedinApp.clientSecret === '') secretEnc = null;
      else {
        const prev = dec(existingOauth.linkedinAppClientSecret || '');
        secretEnc =
          linkedinApp.clientSecret !== prev
            ? enc(linkedinApp.clientSecret)
            : existingOauth.linkedinAppClientSecret;
      }
    }
    await prisma.userOAuthTokens.update({
      where: { userId },
      data: {
        linkedinAppClientId:
          linkedinApp.clientId !== undefined ? linkedinApp.clientId || null : undefined,
        linkedinAppClientSecret: secretEnc,
      },
    });
  }
  return getCompositeResponse(userId);
}

export async function resetPreferences(userId, userEmail) {
  await ensurePreferences(userId, { email: userEmail });
  await prisma.userCommunicationPreferences.update({
    where: { userId },
    data: {
      defaultEmails: defaultEmailsFallback(),
      defaultSendingEmail: defaultEmailsFallback()[0],
      twilioAccountSid: null,
      twilioAuthToken: null,
      smsAutoNotifications: false,
      googleCalendarSync: true,
      teamsCalendarSync: false,
      teamsTenantId: null,
      teamsClientId: null,
      teamsClientSecret: null,
      interviewAutoScheduling: true,
    },
  });
  await prisma.jobBoardIntegration.deleteMany({ where: { userId } });
  return getCompositeResponse(userId);
}

export async function upsertJobBoard(userId, body) {
  const schema = z.object({
    platform: z.enum(['LinkedIn', 'Indeed', 'Naukri']),
    apiKey: z.string().optional(),
    clientId: z.string().optional(),
    publisherId: z.string().optional(),
  });
  const { platform, apiKey, clientId, publisherId } = schema.parse(body);
  const row = await prisma.jobBoardIntegration.findUnique({
    where: { userId_platform: { userId, platform } },
  });
  let apiEnc = row?.apiKey;
  if (apiKey !== undefined) {
    apiEnc = apiKey ? enc(apiKey) : null;
  }
  await prisma.jobBoardIntegration.upsert({
    where: { userId_platform: { userId, platform } },
    create: {
      userId,
      platform,
      apiKey: apiKey !== undefined ? (apiKey ? enc(apiKey) : null) : null,
      clientId: clientId !== undefined ? clientId || null : null,
      publisherId: publisherId !== undefined ? publisherId || null : null,
      connected: true,
    },
    update: {
      ...(apiKey !== undefined ? { apiKey: apiEnc } : {}),
      ...(clientId !== undefined ? { clientId: clientId || null } : {}),
      ...(publisherId !== undefined ? { publisherId: publisherId || null } : {}),
      connected: true,
    },
  });
  return { platform, connected: true };
}

export async function deleteJobBoard(userId, platform) {
  const p = z.enum(['LinkedIn', 'Indeed', 'Naukri']).parse(platform);
  await prisma.jobBoardIntegration.updateMany({
    where: { userId, platform: p },
    data: { apiKey: null, clientId: null, publisherId: null, connected: false },
  });
  return { platform: p, connected: false };
}

export function connectionsOnlyPayload(full) {
  return full.connections;
}
