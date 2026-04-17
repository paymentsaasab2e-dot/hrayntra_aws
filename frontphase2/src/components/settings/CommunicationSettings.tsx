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
  type IntegrationProvider,
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
        scopes: ['Send email', 'Read inbox', 'Profile'],
        icon: <Mail className="h-5 w-5 text-red-500" />,
        iconBgClass: 'bg-red-50',
      },
      {
        provider: 'outlook',
        serviceName: 'Connect Outlook',
        description: 'Connect Microsoft 365 / Outlook for personal recruiter email.',
        scopes: ['Mail.Send', 'Mail.Read', 'User.Read'],
        icon: <Mail className="h-5 w-5 text-sky-600" />,
        iconBgClass: 'bg-sky-50',
      },
      {
        provider: 'google-calendar',
        serviceName: 'Connect Google Calendar',
        description: 'Sync interviews, follow-ups, and scheduling from your Google Calendar.',
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
        scopes: ['Meeting write', 'Meeting read', 'User read'],
        icon: <Video className="h-5 w-5 text-blue-600" />,
        iconBgClass: 'bg-blue-50',
      },
      {
        provider: 'google-meet',
        serviceName: 'Connect Google Meet',
        description: 'Use Google OAuth to prepare Google Meet scheduling from your calendar account.',
        scopes: ['Calendar access', 'Meet scheduling prep'],
        icon: <Video className="h-5 w-5 text-emerald-600" />,
        iconBgClass: 'bg-emerald-50',
      },
      {
        provider: 'microsoft-teams',
        serviceName: 'Connect Microsoft Teams',
        description: 'Create Teams meetings and calendar events from your Microsoft account.',
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
        scopes: ['Profile', 'Email', 'Post content'],
        icon: <Briefcase className="h-5 w-5 text-blue-700" />,
        iconBgClass: 'bg-blue-50',
      },
      {
        provider: 'twitter',
        serviceName: 'Connect Twitter / X',
        description: 'Publish hiring announcements and short updates from your X account.',
        scopes: ['Read profile', 'Write posts', 'Offline access'],
        icon: <MessageSquareShare className="h-5 w-5 text-slate-700" />,
        iconBgClass: 'bg-slate-100',
      },
      {
        provider: 'facebook',
        serviceName: 'Connect Facebook',
        description: 'Connect a Facebook identity to prepare posting to business pages.',
        scopes: ['Public profile', 'Email', 'Page post permissions'],
        icon: <Facebook className="h-5 w-5 text-blue-700" />,
        iconBgClass: 'bg-blue-50',
      },
    ],
  },
];

const EMPTY_STATUS: IntegrationStatusResponse = {};

export function CommunicationSettings() {
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<IntegrationStatusResponse>(EMPTY_STATUS);
  const [busyProvider, setBusyProvider] = useState<IntegrationProvider | null>(null);

  const reload = useCallback(async () => {
    const response = await apiGetIntegrationStatuses();
    setStatuses(response.data || {});
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
    const connected = params.get('integration_connected');
    const error = params.get('integration_error');
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
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
