import axios from 'axios';
import { google } from 'googleapis';
import { ClientSecretCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';
import { env } from '../config/env.js';
import logger from '../utils/logger.js';

const addMinutes = (value, minutes) => new Date(new Date(value).getTime() + minutes * 60 * 1000).toISOString();

const buildTopic = (interview) => `Interview: ${interview.candidateName} - ${interview.jobTitle}`;

const ensure = (value, message) => {
  if (!value) {
    throw new Error(message);
  }
};

export async function generateGoogleMeetLink(interview) {
  ensure(env.GOOGLE_CLIENT_ID, 'GOOGLE_CLIENT_ID is not configured');
  ensure(env.GOOGLE_CLIENT_SECRET, 'GOOGLE_CLIENT_SECRET is not configured');
  ensure(env.GOOGLE_REFRESH_TOKEN, 'GOOGLE_REFRESH_TOKEN is not configured');

  const auth = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: env.GOOGLE_REFRESH_TOKEN });
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

export async function generateZoomLink(interview) {
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

  const accessToken = tokenRes.data.access_token;

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

export async function generateMeetingLink(platform, interview) {
  if (!platform) {
    return { meetingLink: null, error: null };
  }

  try {
    switch (platform) {
      case 'GOOGLE_MEET':
        return { meetingLink: await generateGoogleMeetLink(interview), error: null };
      case 'ZOOM':
        return { meetingLink: await generateZoomLink(interview), error: null };
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
