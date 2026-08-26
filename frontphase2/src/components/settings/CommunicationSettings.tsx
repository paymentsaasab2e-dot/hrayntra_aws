'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Calendar,
  Facebook,
  Inbox,
  Mail,
  MessageSquareShare,
  MessagesSquare,
  PlugZap,
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
    accentClass: string;
  }>;
};

const INTEGRATION_SECTIONS: IntegrationSection[] = [
  {
    id: 'email-calendar',
    title: 'Email & Calendar',
    description: 'Mailboxes and calendars for messaging, scheduling, and follow-ups.',
    items: [
      {
        provider: 'gmail',
        serviceName: 'Gmail',
        description: 'Send and read recruiter email from your own Gmail account.',
        consentSummary:
          'Approve access only if you want this app to send emails and read your inbox on your behalf.',
        scopes: ['Send email', 'Read inbox', 'Profile'],
        icon: <Mail className="h-5 w-5 text-red-600" />,
        iconBgClass: 'bg-red-50',
        accentClass: 'from-red-500/12 via-transparent to-transparent',
      },
      {
        provider: 'outlook',
        serviceName: 'Outlook',
        description: 'Connect Microsoft 365 / Outlook for personal recruiter email.',
        consentSummary:
          'Approve access only if you want this app to send and read mail from your Microsoft account.',
        scopes: ['Mail.Send', 'Mail.Read', 'User.Read'],
        icon: <Mail className="h-5 w-5 text-sky-600" />,
        iconBgClass: 'bg-sky-50',
        accentClass: 'from-sky-500/12 via-transparent to-transparent',
      },
      {
        provider: 'google-calendar',
        serviceName: 'Google Calendar',
        description: 'Sync interviews, follow-ups, and scheduling from Google Calendar.',
        consentSummary:
          'Approve access only if you want this app to manage calendar scheduling from your Google account.',
        scopes: ['Calendar events', 'Profile', 'Email'],
        icon: <Calendar className="h-5 w-5 text-emerald-600" />,
        iconBgClass: 'bg-emerald-50',
        accentClass: 'from-emerald-500/12 via-transparent to-transparent',
      },
    ],
  },
  {
    id: 'meetings',
    title: 'Meetings',
    description: 'Create interview and client meetings from your own accounts.',
    items: [
      {
        provider: 'zoom',
        serviceName: 'Zoom',
        description: 'Create recruiter-owned Zoom meetings for interviews and calls.',
        consentSummary:
          'Approve access only if you want this app to create and manage Zoom meetings for you.',
        scopes: ['Meeting write', 'Meeting read', 'User read'],
        icon: <Video className="h-5 w-5 text-blue-600" />,
        iconBgClass: 'bg-blue-50',
        accentClass: 'from-blue-500/12 via-transparent to-transparent',
      },
      {
        provider: 'google-meet',
        serviceName: 'Google Meet',
        description: 'Attach Google Meet links when booking interviews on your calendar.',
        consentSummary:
          'Approve access only if you want this app to prepare Google Meet scheduling through your Google account.',
        scopes: ['Calendar events', 'Meet links'],
        icon: <Video className="h-5 w-5 text-teal-600" />,
        iconBgClass: 'bg-teal-50',
        accentClass: 'from-teal-500/12 via-transparent to-transparent',
      },
      {
        provider: 'microsoft-teams',
        serviceName: 'Microsoft Teams',
        description: 'Create Teams meetings and calendar events from Microsoft.',
        consentSummary:
          'Approve access only if you want this app to create Teams meetings and calendar events on your behalf.',
        scopes: ['Calendars.ReadWrite', 'OnlineMeetings.ReadWrite'],
        icon: <MessagesSquare className="h-5 w-5 text-indigo-600" />,
        iconBgClass: 'bg-indigo-50',
        accentClass: 'from-indigo-500/12 via-transparent to-transparent',
      },
    ],
  },
  {
    id: 'social-media',
    title: 'Social job posting',
    description: 'Publish hiring updates from your own social channels.',
    items: [
      {
        provider: 'linkedin',
        serviceName: 'LinkedIn',
        description: 'Post jobs and announcements with your LinkedIn identity.',
        consentSummary:
          'Approve access only if you want this app to post content using your LinkedIn identity.',
        scopes: ['Profile', 'Email', 'Post content'],
        icon: <Briefcase className="h-5 w-5 text-blue-700" />,
        iconBgClass: 'bg-blue-50',
        accentClass: 'from-blue-600/12 via-transparent to-transparent',
      },
      {
        provider: 'twitter',
        serviceName: 'X (Twitter)',
        description: 'Publish short hiring announcements from your X account.',
        consentSummary:
          'Approve access only if you want this app to publish posts from your X account.',
        scopes: ['Read profile', 'Write posts', 'Offline access'],
        icon: <MessageSquareShare className="h-5 w-5 text-slate-700" />,
        iconBgClass: 'bg-slate-100',
        accentClass: 'from-slate-500/12 via-transparent to-transparent',
      },
      {
        provider: 'facebook',
        serviceName: 'Facebook',
        description: 'Prepare posting to business pages with your Facebook identity.',
        consentSummary:
          'Approve access only if you want this app to manage Facebook posting permissions for pages.',
        scopes: ['Public profile', 'Email', 'Page post permissions'],
        icon: <Facebook className="h-5 w-5 text-blue-700" />,
        iconBgClass: 'bg-blue-50',
        accentClass: 'from-blue-500/12 via-transparent to-transparent',
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
      accountEmail: connections.gmail?.email || integrationStatuses.gmail?.accountEmail,
    };
    merged['google-calendar'] = {
      provider: 'google-calendar',
      label: 'Google Calendar',
      connected: googleCalendarConnected,
      accountEmail:
        connections.googleCalendar?.email || integrationStatuses['google-calendar']?.accountEmail,
    };
    merged['google-meet'] = {
      provider: 'google-meet',
      label: 'Google Meet',
      connected: googleMeetConnected,
      accountEmail:
        connections.googleCalendar?.email ||
        connections.gmail?.email ||
        integrationStatuses['google-meet']?.accountEmail,
    };
    merged.outlook = {
      provider: 'outlook',
      label: 'Outlook',
      connected: outlookConnected,
      accountEmail: connections.outlook?.email || integrationStatuses.outlook?.accountEmail,
    };
    merged['microsoft-teams'] = {
      provider: 'microsoft-teams',
      label: 'Microsoft Teams',
      connected: teamsConnected,
      accountEmail: connections.teams?.email || integrationStatuses['microsoft-teams']?.accountEmail,
    };
    merged.linkedin = {
      provider: 'linkedin',
      label: 'LinkedIn',
      connected: linkedinConnected,
      accountEmail: connections.linkedin?.email || integrationStatuses.linkedin?.accountEmail,
      accountName: connections.linkedin?.pageName || integrationStatuses.linkedin?.accountName,
    };
  }

  return merged;
}

function humanizeScope(scope: string) {
  const value = String(scope || '').trim();
  if (!value) return value;
  if (!value.includes('/') && !value.includes('.')) return value;
  const short = value.split('/').pop() || value;
  return short.replace(/^auth\./, '').replace(/\./g, ' ');
}

export function CommunicationSettings() {
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<IntegrationStatusResponse>(EMPTY_STATUS);
  const [busyProvider, setBusyProvider] = useState<IntegrationProvider | null>(null);

  const reload = useCallback(async () => {
    const [integrationResult, communicationResult] = await Promise.allSettled([
      apiGetIntegrationStatuses(),
      apiGetUserCommunication(),
    ]);
    const integrationData =
      integrationResult.status === 'fulfilled' ? integrationResult.value.data || {} : {};
    const communicationData =
      communicationResult.status === 'fulfilled' ? communicationResult.value.data || null : null;
    setStatuses(mergeStatuses(integrationData, communicationData));
    if (integrationResult.status === 'rejected' && communicationResult.status === 'rejected') {
      throw integrationResult.reason;
    }
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
      const provider = String(connected).toLowerCase();
      toast.success(`${connected} connected${email ? ` as ${email}` : ''}`);
      if (provider === 'gmail' || provider === 'google') {
        window.location.replace(
          `/inbox?gmail_connected=1${email ? `&email=${encodeURIComponent(email)}` : ''}`,
        );
        return;
      }
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

  const totalCount = useMemo(
    () => INTEGRATION_SECTIONS.reduce((sum, section) => sum + section.items.length, 0),
    []
  );

  const gmailConnected = !!statuses.gmail?.connected;

  const handleConnect = async (provider: IntegrationProvider) => {
    try {
      setBusyProvider(provider);
      const returnUrl =
        provider === 'gmail' && typeof window !== 'undefined'
          ? `${window.location.origin}/inbox`
          : undefined;
      await apiConnectIntegration(provider, returnUrl);
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
        <div className="h-40 animate-pulse rounded-3xl bg-slate-200/80" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="h-72 animate-pulse rounded-2xl bg-slate-200/70" />
          <div className="h-72 animate-pulse rounded-2xl bg-slate-200/70" />
          <div className="h-72 animate-pulse rounded-2xl bg-slate-200/70" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-xl border border-indigo-100/60 bg-white/80 shadow-[0_12px_40px_-18px_rgba(59,130,246,0.18)] backdrop-blur-sm">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white via-indigo-50/40 to-violet-50/30"
          aria-hidden
        />
        <div className="relative flex flex-col gap-6 p-6 lg:flex-row lg:items-end lg:justify-between lg:p-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white shadow-md shadow-indigo-500/25">
              <PlugZap className="h-3.5 w-3.5 text-indigo-200" />
              Communication &amp; Integrations
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
              Connect your work accounts
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Link Gmail, calendar, meetings, and social channels you already use. Each connection
              uses your own OAuth consent, and tokens stay encrypted on the server.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-indigo-100/70 bg-white/90 px-4 py-3 backdrop-blur">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-400">
                Connected
              </p>
              <p className="mt-0.5 text-lg font-semibold text-slate-900">
                {connectedCount}
                <span className="text-sm font-medium text-slate-400"> / {totalCount}</span>
              </p>
            </div>
            {gmailConnected ? (
              <a
                href="/inbox"
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:brightness-110"
              >
                <Inbox className="h-4 w-4" />
                Open Inbox
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {INTEGRATION_SECTIONS.map((section) => {
        const sectionConnected = section.items.filter((item) => statuses[item.provider]?.connected)
          .length;

        return (
          <section key={section.id} className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3 px-1">
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-slate-900">
                  {section.title}
                </h3>
                <p className="mt-1 text-sm text-slate-500">{section.description}</p>
              </div>
              <p className="text-xs font-medium text-slate-400">
                {sectionConnected} of {section.items.length} connected
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {section.items.map((item) => {
                const status = statuses[item.provider];
                const rawScopes = status?.scope?.length ? status.scope : item.scopes;
                const scopes = rawScopes.map(humanizeScope);
                return (
                  <ServiceConnectionCard
                    key={item.provider}
                    serviceName={item.serviceName}
                    icon={item.icon}
                    iconBgClass={item.iconBgClass}
                    accentClass={item.accentClass}
                    description={item.description}
                    connected={!!status?.connected}
                    connectedEmail={status?.accountEmail || status?.accountName || undefined}
                    onConnect={() => handleConnect(item.provider)}
                    onDisconnect={() => handleDisconnect(item.provider)}
                    connecting={busyProvider === item.provider}
                    scopes={scopes}
                    consentSummary={item.consentSummary}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
