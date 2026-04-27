'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Calendar,
  Facebook,
  Mail,
  MessageSquareShare,
  MessagesSquare,
  Video,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  apiConnectIntegration,
  apiDisconnectIntegration,
  apiGetIntegrationStatuses,
  apiGetUserCommunication,
  type IntegrationProvider,
  type CommunicationFullResponse,
  type IntegrationStatusResponse,
} from '@/lib/api';
import { ServiceConnectionCard } from './ServiceConnectionCard';

type IntegrationSection = {
  id: string;
  title: string;
  description: string;
  items: Array<{
    provider: IntegrationProvider;
    serviceName: string;
    description: string;
    consentSummary: string;
    scopes: string[];
    icon: React.ReactNode;
    iconBgClass: string;
  }>;
};

const INTEGRATION_SECTIONS: IntegrationSection[] = [
  {
    id: 'email-calendar',
    title: 'Email & Calendar',
    description: 'Connect personal mailboxes and calendars for messaging, scheduling, and follow-ups.',
    items: [
      {
        provider: 'gmail',
        serviceName: 'Connect Gmail',
        description: 'Use your own Gmail account for recruiter email communication.',
        consentSummary:
          'Approve access only if you want this app to send emails and read your inbox on your behalf.',
        scopes: ['Send email', 'Read inbox', 'Profile'],
        icon: <Mail className="h-5 w-5 text-red-500" />,
        iconBgClass: 'bg-red-50',
      },
      {
        provider: 'outlook',
        serviceName: 'Connect Outlook',
        description: 'Connect Microsoft 365 / Outlook for personal recruiter email.',
        consentSummary:
          'Approve access only if you want this app to send and read mail from your Microsoft account.',
        scopes: ['Mail.Send', 'Mail.Read', 'User.Read'],
        icon: <Mail className="h-5 w-5 text-sky-600" />,
        iconBgClass: 'bg-sky-50',
      },
      {
        provider: 'google-calendar',
        serviceName: 'Connect Google Calendar',
        description: 'Sync interviews, follow-ups, and scheduling from your Google Calendar.',
        consentSummary:
          'Approve access only if you want this app to manage calendar scheduling from your Google account.',
        scopes: ['Calendar access', 'Profile', 'Email'],
        icon: <Calendar className="h-5 w-5 text-emerald-600" />,
        iconBgClass: 'bg-emerald-50',
      },
    ],
  },
  {
    id: 'meetings',
    title: 'Meetings',
    description:
      'Authorize meeting providers so interviews and follow-ups can be scheduled from your own account.',
    items: [
      {
        provider: 'zoom',
        serviceName: 'Connect Zoom',
        description: 'Create recruiter-owned Zoom meetings for interviews and client calls.',
        consentSummary:
          'Approve access only if you want this app to create and manage Zoom meetings for you.',
        scopes: ['Meeting write', 'Meeting read', 'User read'],
        icon: <Video className="h-5 w-5 text-blue-600" />,
        iconBgClass: 'bg-blue-50',
      },
      {
        provider: 'google-meet',
        serviceName: 'Connect Google Meet',
        description: 'Use Google OAuth to prepare Google Meet scheduling from your calendar account.',
        consentSummary:
          'Approve access only if you want this app to prepare Google Meet scheduling through your Google account.',
        scopes: ['Calendar access', 'Meet scheduling prep'],
        icon: <Video className="h-5 w-5 text-emerald-600" />,
        iconBgClass: 'bg-emerald-50',
      },
      {
        provider: 'microsoft-teams',
        serviceName: 'Connect Microsoft Teams',
        description: 'Create Teams meetings and calendar events from your Microsoft account.',
        consentSummary:
          'Approve access only if you want this app to create Teams meetings and calendar events on your behalf.',
        scopes: ['Calendars.ReadWrite', 'OnlineMeetings.ReadWrite'],
        icon: <MessagesSquare className="h-5 w-5 text-indigo-600" />,
        iconBgClass: 'bg-indigo-50',
      },
    ],
  },
  {
    id: 'social-media',
    title: 'Social Media Job Posting',
    description: 'Connect your own social channels for outbound job posting and employer-brand updates.',
    items: [
      {
        provider: 'linkedin',
        serviceName: 'Connect LinkedIn',
        description: 'Post jobs and social announcements through your LinkedIn identity.',
        consentSummary:
          'Approve access only if you want this app to post content using your LinkedIn identity.',
        scopes: ['Profile', 'Email', 'Post content'],
        icon: <Briefcase className="h-5 w-5 text-blue-700" />,
        iconBgClass: 'bg-blue-50',
      },
      {
        provider: 'twitter',
        serviceName: 'Connect Twitter / X',
        description: 'Publish hiring announcements and short updates from your X account.',
        consentSummary:
          'Approve access only if you want this app to publish posts from your X account.',
        scopes: ['Read profile', 'Write posts', 'Offline access'],
        icon: <MessageSquareShare className="h-5 w-5 text-slate-700" />,
        iconBgClass: 'bg-slate-100',
      },
      {
        provider: 'facebook',
        serviceName: 'Connect Facebook',
        description: 'Connect a Facebook identity to prepare posting to business pages.',
        consentSummary:
          'Approve access only if you want this app to manage Facebook posting permissions for pages.',
        scopes: ['Public profile', 'Email', 'Page post permissions'],
        icon: <Facebook className="h-5 w-5 text-blue-700" />,
        iconBgClass: 'bg-blue-50',
      },
    ],
  },
];

const EMPTY_STATUS: IntegrationStatusResponse = {};

function mergeStatuses(
  integrationStatuses: IntegrationStatusResponse,
  communication: CommunicationFullResponse | null
): IntegrationStatusResponse {
  const merged: IntegrationStatusResponse = { ...integrationStatuses };
  const connections = communication?.connections;

  if (connections) {
    const gmailConnected = !!(integrationStatuses.gmail?.connected || connections.gmail?.connected);
    const googleCalendarConnected = !!(
      integrationStatuses['google-calendar']?.connected || connections.googleCalendar?.connected
    );
    const googleMeetConnected = !!(
      integrationStatuses['google-meet']?.connected ||
      connections.googleCalendar?.connected ||
      connections.gmail?.connected
    );
    const outlookConnected = !!(integrationStatuses.outlook?.connected || connections.outlook?.connected);
    const teamsConnected = !!(
      integrationStatuses['microsoft-teams']?.connected || connections.teams?.connected
    );
    const linkedinConnected = !!(
      integrationStatuses.linkedin?.connected || connections.linkedin?.connected
    );

    merged.gmail = {
      provider: 'gmail',
      label: 'Gmail',
      connected: gmailConnected,
      accountEmail: connections.gmail?.email,
    };
    merged['google-calendar'] = {
      provider: 'google-calendar',
      label: 'Google Calendar',
      connected: googleCalendarConnected,
      accountEmail: connections.googleCalendar?.email,
    };
    merged['google-meet'] = {
      provider: 'google-meet',
      label: 'Google Meet',
      connected: googleMeetConnected,
      accountEmail: connections.googleCalendar?.email || connections.gmail?.email,
    };
    merged.outlook = {
      provider: 'outlook',
      label: 'Outlook',
      connected: outlookConnected,
      accountEmail: connections.outlook?.email,
    };
    merged['microsoft-teams'] = {
      provider: 'microsoft-teams',
      label: 'Microsoft Teams',
      connected: teamsConnected,
      accountEmail: connections.teams?.email,
    };
    merged.linkedin = {
      provider: 'linkedin',
      label: 'LinkedIn',
      connected: linkedinConnected,
      accountEmail: connections.linkedin?.email,
      accountName: connections.linkedin?.pageName,
    };
  }

  return merged;
}

export function CommunicationSettings() {
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<IntegrationStatusResponse>(EMPTY_STATUS);
  const [busyProvider, setBusyProvider] = useState<IntegrationProvider | null>(null);

  const reload = useCallback(async () => {
    const [integrationResponse, communicationResponse] = await Promise.all([
      apiGetIntegrationStatuses(),
      apiGetUserCommunication(),
    ]);
    setStatuses(
      mergeStatuses(integrationResponse.data || {}, communicationResponse.data || null)
    );
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await reload();
      } catch {
        if (mounted) {
          toast.error('Failed to load integration statuses');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [reload]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('integration_connected') || params.get('connected');
    const error = params.get('integration_error') || params.get('error');
    const email = params.get('email');

    if (connected) {
      toast.success(`${connected} connected${email ? ` as ${email}` : ''}`);
      window.history.replaceState({}, '', '/setting?section=communication');
      void reload();
    }

    if (error) {
      toast.error(`Failed to connect ${error}`);
      window.history.replaceState({}, '', '/setting?section=communication');
    }
  }, [reload]);

  const connectedCount = useMemo(
    () => Object.values(statuses).filter((item) => item?.connected).length,
    [statuses]
  );

  const handleConnect = async (provider: IntegrationProvider) => {
    try {
      setBusyProvider(provider);
      await apiConnectIntegration(provider);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Connect failed');
      setBusyProvider(null);
    }
  };

  const handleDisconnect = async (provider: IntegrationProvider) => {
    try {
      setBusyProvider(provider);
      await apiDisconnectIntegration(provider);
      await reload();
      toast.success('Integration disconnected');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Disconnect failed');
    } finally {
      setBusyProvider(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 animate-pulse rounded-2xl bg-slate-200" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
              Communication & Integrations
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Connect your own work accounts</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              OAuth runs against each user&apos;s own account. Tokens stay encrypted in the database
              and are never exposed to the frontend. These connections are used later for email
              sending, calendars, meetings, job posting, and social announcements.
            </p>
            <p className="mt-3 max-w-3xl rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
              Before connecting any service, you must review the requested permissions and confirm
              consent. The next step will redirect you to the provider&apos;s own OAuth screen.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <span className="font-semibold">{connectedCount}</span> integrations connected
          </div>
        </div>
      </section>

      {INTEGRATION_SECTIONS.map((section) => (
        <section key={section.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-slate-900">{section.title}</h3>
            <p className="mt-1 text-sm text-slate-500">{section.description}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {section.items.map((item) => {
              const status = statuses[item.provider];
              return (
                <ServiceConnectionCard
                  key={item.provider}
                  serviceName={item.serviceName}
                  icon={item.icon}
                  iconBgClass={item.iconBgClass}
                  description={item.description}
                  connected={!!status?.connected}
                  connectedEmail={status?.accountEmail || status?.accountName || undefined}
                  onConnect={() => handleConnect(item.provider)}
                  onDisconnect={() => handleDisconnect(item.provider)}
                  connecting={busyProvider === item.provider}
                  scopes={status?.scope?.length ? status.scope : item.scopes}
                  consentSummary={item.consentSummary}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
