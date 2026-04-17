import axios from 'axios';
import { google } from 'googleapis';
import { ClientSecretCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { oauthTokenService } from '../modules/oauth/oauth-token.service.js';
import { encryption } from '../utils/encryption.js';
import logger from '../utils/logger.js';

const addMinutes = (value, minutes) => new Date(new Date(value).getTime() + minutes * 60 * 1000).toISOString();

const buildTopic = (interview) => `Interview: ${interview.candidateName} - ${interview.jobTitle}`;

const ensure = (value, message) => {
  if (!value) {
    throw new Error(message);
  }
};

const dec = (value) => {
  if (!value) return '';
  return encryption.decryptColonString(String(value));
};

async function getConnectedZoomAccessToken(userId) {
  if (!userId) return null;

  const row = await prisma.integrationConnection.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: 'zoom',
      },
    },
  });

  if (!row) return null;

  const accessToken = dec(row.accessToken);
  const refreshToken = dec(row.refreshToken);
  const expiryDate = row.expiryDate ? new Date(row.expiryDate) : null;
  const notExpired = expiryDate ? expiryDate.getTime() > Date.now() + 60 * 1000 : Boolean(accessToken);

  if (accessToken && notExpired) {
    return accessToken;
  }

  if (!refreshToken) {
    return accessToken || null;
  }

  ensure(env.ZOOM_CLIENT_ID, 'ZOOM_CLIENT_ID is not configured');
  ensure(env.ZOOM_CLIENT_SECRET, 'ZOOM_CLIENT_SECRET is not configured');

  const response = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.ZOOM_CLIENT_ID}:${env.ZOOM_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Zoom token refresh failed: ${message}`);
  }

  const data = await response.json();
  const nextAccessToken = data.access_token || null;
  const nextRefreshToken = data.refresh_token || refreshToken;
  const nextExpiryDate =
    data.expires_in != null ? new Date(Date.now() + Number(data.expires_in) * 1000) : expiryDate;

  await prisma.integrationConnection.update({
    where: { id: row.id },
    data: {
      accessToken: nextAccessToken ? encryption.encryptColonString(String(nextAccessToken)) : row.accessToken,
      refreshToken: nextRefreshToken ? encryption.encryptColonString(String(nextRefreshToken)) : row.refreshToken,
      expiryDate: nextExpiryDate || undefined,
    },
  });

  return nextAccessToken;
}

export async function generateGoogleMeetLink(interview, userId) {
  const auth = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
  const connectedAccessToken = userId ? await oauthTokenService.getValidGoogleAccessToken(userId) : null;

  if (connectedAccessToken) {
    auth.setCredentials({ access_token: connectedAccessToken });
  } else {
    if (!env.GOOGLE_REFRESH_TOKEN) {
      throw new Error('Google Meet is not connected. Please connect your Google account first.');
    }
    ensure(env.GOOGLE_CLIENT_ID, 'GOOGLE_CLIENT_ID is not configured');
    ensure(env.GOOGLE_CLIENT_SECRET, 'GOOGLE_CLIENT_SECRET is not configured');
    ensure(env.GOOGLE_REFRESH_TOKEN, 'GOOGLE_REFRESH_TOKEN is not configured');
    auth.setCredentials({ refresh_token: env.GOOGLE_REFRESH_TOKEN });
  }

  const calendar = google.calendar({ version: 'v3', auth });

  const event = await calendar.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: 1,
    requestBody: {
      summary: buildTopic(interview),
      description: interview.notes || undefined,
      start: { dateTime: new Date(interview.date).toISOString(), timeZone: interview.timezone },
      end: { dateTime: addMinutes(interview.date, interview.duration), timeZone: interview.timezone },
      attendees: (interview.panelEmails || []).map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: interview.id || `${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    },
  });

  return event?.data?.hangoutLink || null;
}

export async function generateZoomLink(interview, userId) {
  let accessToken = await getConnectedZoomAccessToken(userId);

  if (!accessToken) {
    if (!env.ZOOM_ACCOUNT_ID) {
      throw new Error('Zoom is not connected. Please connect your Zoom account first.');
    }
    ensure(env.ZOOM_ACCOUNT_ID, 'ZOOM_ACCOUNT_ID is not configured');
    ensure(env.ZOOM_CLIENT_ID, 'ZOOM_CLIENT_ID is not configured');
    ensure(env.ZOOM_CLIENT_SECRET, 'ZOOM_CLIENT_SECRET is not configured');

    const tokenRes = await axios.post(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${env.ZOOM_ACCOUNT_ID}`,
      {},
      {
        auth: {
          username: env.ZOOM_CLIENT_ID,
          password: env.ZOOM_CLIENT_SECRET,
        },
      }
    );

    accessToken = tokenRes.data.access_token;
  }

  const meeting = await axios.post(
    'https://api.zoom.us/v2/users/me/meetings',
    {
      topic: buildTopic(interview),
      type: 2,
      start_time: new Date(interview.date).toISOString(),
      duration: interview.duration,
      timezone: interview.timezone,
      agenda: interview.notes || undefined,
      settings: {
        host_video: true,
        participant_video: true,
        waiting_room: true,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  return meeting?.data?.join_url || null;
}

export async function generateTeamsLink(interview) {
  ensure(env.MS_TENANT_ID, 'MS_TENANT_ID is not configured');
  ensure(env.MS_CLIENT_ID, 'MS_CLIENT_ID is not configured');
  ensure(env.MS_CLIENT_SECRET, 'MS_CLIENT_SECRET is not configured');

  const credential = new ClientSecretCredential(env.MS_TENANT_ID, env.MS_CLIENT_ID, env.MS_CLIENT_SECRET);
  const token = await credential.getToken('https://graph.microsoft.com/.default');

  const client = Client.init({
    authProvider: {
      getAccessToken: async () => token.token,
    },
  });

  const meeting = await client.api('/me/onlineMeetings').post({
    startDateTime: new Date(interview.date).toISOString(),
    endDateTime: addMinutes(interview.date, interview.duration),
    subject: buildTopic(interview),
  });

  return meeting?.joinWebUrl || null;
}

export async function generateMeetingLink(platform, interview, userId = null) {
  if (!platform) {
    return { meetingLink: null, error: null };
  }

  try {
    switch (platform) {
      case 'GOOGLE_MEET':
        return { meetingLink: await generateGoogleMeetLink(interview, userId), error: null };
      case 'ZOOM':
        return { meetingLink: await generateZoomLink(interview, userId), error: null };
      case 'MS_TEAMS':
        return { meetingLink: await generateTeamsLink(interview), error: null };
      default:
        return { meetingLink: null, error: `Unsupported meeting platform: ${platform}` };
    }
  } catch (error) {
    logger.error('Meeting link generation failed', { platform, message: error.message });
    return {
      meetingLink: null,
      error: error.message,
    };
  }
}
