'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Mail,
  MessageSquare,
  Calendar,
  Globe,
  Plus,
  Pencil,
  Save,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  apiGetUserCommunication,
  apiPutUserCommunication,
  apiPatchUserCommunicationPrefs,
  apiResetUserCommunication,
  apiPatchJobBoard,
  apiTestTwilioConnection,
  apiStartOAuthConnect,
  apiOAuthDisconnectGoogle,
  apiOAuthDisconnectMicrosoft,
  apiOAuthDisconnectLinkedInSettings,
  getOAuthCallbackDisplayBase,
  type CommunicationFullResponse,
  type CommunicationSettingsShape,
  type CommunicationConnections,
} from '@/lib/api';
import { ServiceConnectionCard } from './ServiceConnectionCard';

function Toggle({
  checked,
  onChange,
  activeClass,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  activeClass: string;
}) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div
        className={`w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all ${activeClass}`}
      />
    </label>
  );
}

const emptyShape: CommunicationSettingsShape = {
  defaultEmails: [],
  defaultSendingEmail: '',
  twilioAccountSid: '',
  twilioAuthToken: '',
  smsAutoNotifications: false,
  googleCalendarSync: true,
  teamsCalendarSync: false,
  teamsTenantId: '',
  teamsClientId: '',
  teamsClientSecret: '',
  interviewAutoScheduling: true,
};

const emptyConnections: CommunicationConnections = {
  gmail: { connected: false },
  googleCalendar: { connected: false },
  outlook: { connected: false },
  teams: { connected: false },
  linkedin: { connected: false },
};

export function CommunicationSettings() {
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connectKey, setConnectKey] = useState<string | null>(null);
  const [settings, setSettings] = useState<CommunicationSettingsShape>(emptyShape);
  const [connections, setConnections] = useState<CommunicationConnections>(emptyConnections);
  const [jobBoardKeys, setJobBoardKeys] = useState<CommunicationFullResponse['jobBoardKeys']>({
    LinkedIn: { apiKey: '', clientId: '', connected: false },
    Indeed: { apiKey: '', publisherId: '', connected: false },
    Naukri: { apiKey: '', clientId: '', connected: false },
  });
  const [linkedinApp, setLinkedinApp] = useState({ clientId: '', clientSecret: '' });
  const [newEmail, setNewEmail] = useState('');
  const [linkedInTab, setLinkedInTab] = useState<'oauth' | 'apikey'>('oauth');

  const backendBase = getOAuthCallbackDisplayBase();
  const msCallback = backendBase ? `${backendBase}/api/v1/oauth/microsoft/callback` : '';
  const liCallback = backendBase ? `${backendBase}/api/v1/oauth/linkedin/callback` : '';

  const reload = useCallback(async () => {
    const res = await apiGetUserCommunication();
    if (res.data) {
      setSettings(res.data.settings);
      setConnections(res.data.connections);
      setJobBoardKeys(res.data.jobBoardKeys);
      setLinkedinApp(res.data.linkedinApp);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await reload();
      } catch {
        if (!cancelled) toast.error('Failed to load communication settings');
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const connected = sp.get('connected');
    const err = sp.get('error');
    const email = sp.get('email');
    if (err === 'google_failed') toast.error('Google connection failed');
    if (err === 'microsoft_failed') toast.error('Microsoft connection failed');
    if (err === 'linkedin_failed') toast.error('LinkedIn connection failed');
    if (connected === 'google') toast.success(`Google connected${email ? ` as ${email}` : ''}`);
    if (connected === 'microsoft')
      toast.success(`Microsoft connected${email ? ` as ${email}` : ''}`);
    if (connected === 'linkedin')
      toast.success(`LinkedIn connected${email ? ` as ${email}` : ''}`);
  }, []);

  const patchToggle = async (
    patch: Partial<
      Pick<
        CommunicationSettingsShape,
        | 'googleCalendarSync'
        | 'teamsCalendarSync'
        | 'smsAutoNotifications'
        | 'interviewAutoScheduling'
      >
    >
  ) => {
    try {
      const res = await apiPatchUserCommunicationPrefs(patch);
      if (res.data) {
        setSettings(res.data.settings);
        setConnections(res.data.connections);
        setJobBoardKeys(res.data.jobBoardKeys);
        setLinkedinApp(res.data.linkedinApp);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await apiPutUserCommunication({
        settings,
        jobBoardKeys,
        linkedinApp,
      });
      if (res.data) {
        setSettings(res.data.settings);
        setConnections(res.data.connections);
        setJobBoardKeys(res.data.jobBoardKeys);
        setLinkedinApp(res.data.linkedinApp);
      }
      toast.success('Settings saved successfully');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Save failed';
      if (msg.toLowerCase().includes('permission') || msg.includes('403')) {
        toast.error('Only admins can save these settings.');
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset communication preferences and job board keys? OAuth stays connected.'))
      return;
    try {
      const res = await apiResetUserCommunication();
      if (res.data) {
        setSettings(res.data.settings);
        setJobBoardKeys(res.data.jobBoardKeys);
        setLinkedinApp(res.data.linkedinApp);
      }
      await reload();
      toast.success('Reset to defaults');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Reset failed';
      if (msg.toLowerCase().includes('permission') || msg.includes('403')) {
        toast.error('Only admins can reset.');
      } else {
        toast.error(msg);
      }
    }
  };

  const runConnect = async (key: string, fn: () => Promise<void>) => {
    try {
      setConnectKey(key);
      await fn();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Connect failed');
    } finally {
      setConnectKey(null);
    }
  };

  const addDefaultEmail = () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error('Enter a valid email address');
      return;
    }
    if (settings.defaultEmails.includes(trimmed)) {
      toast.message('That address is already in the list');
      return;
    }
    setSettings({
      ...settings,
      defaultEmails: [...settings.defaultEmails, trimmed],
      defaultSendingEmail: settings.defaultSendingEmail || trimmed,
    });
    setNewEmail('');
    toast.success('Email added (click Save to persist)');
  };

  const removeDefaultEmail = (email: string) => {
    const next = settings.defaultEmails.filter((e) => e !== email);
    setSettings({
      ...settings,
      defaultEmails: next.length ? next : ['recruiting@globalrecruiters.com'],
      defaultSendingEmail:
        settings.defaultSendingEmail === email
          ? next[0] || 'recruiting@globalrecruiters.com'
          : settings.defaultSendingEmail,
    });
  };

  const twilioOk = !!(settings.twilioAccountSid && settings.twilioAuthToken);

  if (!hydrated) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-36 bg-slate-200 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-48 bg-slate-200 rounded-xl" />
          <div className="h-48 bg-slate-200 rounded-xl" />
        </div>
        <div className="h-56 bg-slate-200 rounded-xl" />
        <div className="h-40 bg-slate-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Mail className="w-6 h-6 text-[#2b7fff]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Email integration</h2>
            <p className="text-sm text-slate-500">
              OAuth runs on the server; secrets stay in backend <code className="text-xs">.env</code>.
            </p>
          </div>
        </div>
        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ServiceConnectionCard
            serviceName="Gmail"
            icon={
              <img
                src="https://www.gstatic.com/images/branding/product/1x/gmail_32dp.png"
                alt=""
                className="w-6 h-6"
              />
            }
            iconBgClass="bg-red-50"
            description="Send email and read threads from your Gmail account."
            connected={connections.gmail.connected}
            connectedEmail={connections.gmail.email}
            scopes={['Send email', 'Read threads', 'OpenID / profile']}
            connecting={connectKey === 'gmail'}
            onConnect={() =>
              runConnect('gmail', () => apiStartOAuthConnect('google', 'gmail'))
            }
            onDisconnect={async () => {
              await apiOAuthDisconnectGoogle({ service: 'gmail' });
              await reload();
              toast.success('Gmail disconnected');
            }}
          />
          <ServiceConnectionCard
            serviceName="Outlook"
            icon={
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/d/df/Microsoft_Office_Outlook_%282018%E2%80%93present%29.svg"
                alt=""
                className="w-6 h-6"
              />
            }
            iconBgClass="bg-sky-50"
            description="Send mail via Microsoft 365 / Outlook."
            connected={connections.outlook.connected}
            connectedEmail={connections.outlook.email}
            scopes={['Mail.Send', 'Mail.Read', 'User.Read']}
            connecting={connectKey === 'outlook'}
            onConnect={() =>
              runConnect('outlook', () => apiStartOAuthConnect('microsoft', 'outlook'))
            }
            onDisconnect={async () => {
              await apiOAuthDisconnectMicrosoft({ service: 'outlook' });
              await reload();
              toast.success('Outlook disconnected');
            }}
          />
        </div>

        <div className="px-6 pb-6 space-y-4 border-t border-slate-100 pt-6">
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 space-y-1.5 w-full">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Plus className="w-4 h-4 text-slate-400" />
                Add default sending address
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2b7fff]/20 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={addDefaultEmail}
              className="px-4 py-2 bg-[#2b7fff] text-white rounded-lg text-sm font-medium hover:bg-blue-600 shrink-0"
            >
              Add email
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Pencil className="w-4 h-4 text-slate-400" />
                Default sending email
              </label>
              <select
                value={settings.defaultSendingEmail}
                onChange={(e) => setSettings({ ...settings, defaultSendingEmail: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
              >
                {settings.defaultEmails.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Saved addresses</span>
              <ul className="rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-36 overflow-y-auto">
                {settings.defaultEmails.map((email) => (
                  <li
                    key={email}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-slate-800"
                  >
                    <span className="truncate">{email}</span>
                    <button
                      type="button"
                      onClick={() => removeDefaultEmail(email)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded shrink-0"
                      disabled={settings.defaultEmails.length <= 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-wrap justify-between gap-3">
            <div>
              <div className="flex gap-2 items-center">
                <MessageSquare className="w-5 h-5 text-emerald-500" />
                <h3 className="font-semibold text-slate-900">SMS & WhatsApp</h3>
              </div>
              <p className="text-sm text-slate-500 mt-1">Twilio credentials (stored encrypted).</p>
            </div>
            <span
              className={`text-xs font-medium px-2 py-1 rounded-full border ${
                twilioOk
                  ? 'bg-green-50 text-green-700 border-green-100'
                  : 'bg-slate-50 text-slate-500 border-slate-200'
              }`}
            >
              {twilioOk ? 'Twilio configured' : 'Not configured'}
            </span>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Twilio Account SID</label>
              <input
                type="text"
                value={settings.twilioAccountSid}
                onChange={(e) => setSettings({ ...settings, twilioAccountSid: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Twilio Auth Token</label>
              <input
                type="password"
                value={settings.twilioAuthToken}
                onChange={(e) => setSettings({ ...settings, twilioAuthToken: e.target.value })}
                autoComplete="off"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await apiTestTwilioConnection();
                  if (res.data?.success) toast.success(res.data.message || 'Twilio OK');
                  else toast.error(res.data?.error || 'Twilio test failed');
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : 'Twilio test failed');
                }
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-100"
            >
              Test connection
            </button>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-600">Auto notifications</span>
              <Toggle
                checked={settings.smsAutoNotifications}
                onChange={(v) => {
                  setSettings({ ...settings, smsAutoNotifications: v });
                  void patchToggle({ smsAutoNotifications: v });
                }}
                activeClass="peer-checked:bg-emerald-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <div className="flex gap-2 items-center">
              <Calendar className="w-5 h-5 text-rose-500" />
              <h3 className="font-semibold text-slate-900">Calendar sync</h3>
            </div>
            <p className="text-sm text-slate-500 mt-1">Google Calendar and Microsoft Teams calendars.</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Google Calendar sync</span>
              <Toggle
                checked={settings.googleCalendarSync}
                onChange={(v) => {
                  setSettings({ ...settings, googleCalendarSync: v });
                  void patchToggle({ googleCalendarSync: v });
                }}
                activeClass="peer-checked:bg-[#2b7fff]"
              />
            </div>
            {settings.googleCalendarSync ? (
              <ServiceConnectionCard
                serviceName="Google Calendar"
                icon={<Calendar className="w-6 h-6 text-[#2b7fff]" />}
                iconBgClass="bg-blue-50"
                description="Sync interviews and availability."
                connected={connections.googleCalendar.connected}
                connectedEmail={connections.googleCalendar.email}
                scopes={['calendar', 'openid', 'profile']}
                connecting={connectKey === 'gcal'}
                onConnect={() =>
                  runConnect('gcal', () => apiStartOAuthConnect('google', 'calendar'))
                }
                onDisconnect={async () => {
                  await apiOAuthDisconnectGoogle({ service: 'calendar' });
                  await reload();
                  toast.success('Google Calendar disconnected');
                }}
              />
            ) : null}

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-sm text-slate-600">Teams calendar sync</span>
              <Toggle
                checked={settings.teamsCalendarSync}
                onChange={(v) => {
                  setSettings({ ...settings, teamsCalendarSync: v });
                  void patchToggle({ teamsCalendarSync: v });
                }}
                activeClass="peer-checked:bg-[#6264A7]"
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-sm font-semibold text-slate-900">Microsoft Teams</h4>
                {connections.teams.connected ? (
                  <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                    Authorized
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">Not authorized</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => runConnect('teams', () => apiStartOAuthConnect('microsoft', 'teams'))}
                disabled={connectKey === 'teams'}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#6264A7] hover:bg-[#5558a0]"
              >
                {connectKey === 'teams' ? 'Opening Microsoft…' : 'Authorize with Microsoft'}
              </button>
              <p className="text-xs text-slate-500">
                Redirect URI (register in Azure){' '}
                <a
                  className="text-[#2b7fff] underline"
                  href="https://aka.ms/appregistrations"
                  target="_blank"
                  rel="noreferrer"
                >
                  App registrations
                </a>
              </p>
              <input
                readOnly
                value={msCallback}
                className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded bg-white font-mono"
              />
              <div className="flex flex-wrap gap-1.5">
                {['Calendars.ReadWrite', 'OnlineMeetings.ReadWrite', 'User.Read'].map((s) => (
                  <span
                    key={s}
                    className="text-[10px] px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600"
                  >
                    {s}
                  </span>
                ))}
              </div>
              <div className="grid gap-2 pt-2">
                <input
                  placeholder="Directory (tenant) ID"
                  value={settings.teamsTenantId}
                  onChange={(e) => setSettings({ ...settings, teamsTenantId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
                <input
                  placeholder="Application (client) ID"
                  value={settings.teamsClientId}
                  onChange={(e) => setSettings({ ...settings, teamsClientId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
                <input
                  type="password"
                  placeholder="Client secret"
                  value={settings.teamsClientSecret}
                  onChange={(e) => setSettings({ ...settings, teamsClientSecret: e.target.value })}
                  autoComplete="off"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="flex items-center justify-between py-2 border-t border-slate-100">
              <span className="text-sm text-slate-600">Interview auto-scheduling</span>
              <Toggle
                checked={settings.interviewAutoScheduling}
                onChange={(v) => {
                  setSettings({ ...settings, interviewAutoScheduling: v });
                  void patchToggle({ interviewAutoScheduling: v });
                }}
                activeClass="peer-checked:bg-[#2b7fff]"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex gap-3">
          <Globe className="w-5 h-5 text-sky-500" />
          <div>
            <h3 className="font-semibold text-slate-900">Job board integrations</h3>
            <p className="text-sm text-slate-500">Keys encrypted at rest on the server.</p>
          </div>
        </div>
        <div className="p-6 space-y-8">
          <div className="border border-slate-200 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">LinkedIn</span>
              <div
                className={`w-2 h-2 rounded-full ${
                  jobBoardKeys.LinkedIn.connected || connections.linkedin.connected
                    ? 'bg-green-500'
                    : 'bg-slate-300'
                }`}
              />
            </div>
            <div className="flex gap-2 text-sm">
              <button
                type="button"
                className={`px-3 py-1 rounded-lg border ${linkedInTab === 'oauth' ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200'}`}
                onClick={() => setLinkedInTab('oauth')}
              >
                OAuth app
              </button>
              <button
                type="button"
                className={`px-3 py-1 rounded-lg border ${linkedInTab === 'apikey' ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200'}`}
                onClick={() => setLinkedInTab('apikey')}
              >
                API key
              </button>
            </div>
            {linkedInTab === 'oauth' ? (
              <div className="space-y-3">
                <input
                  placeholder="Client ID"
                  value={linkedinApp.clientId}
                  onChange={(e) => setLinkedinApp({ ...linkedinApp, clientId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                />
                <input
                  type="password"
                  placeholder="Client secret"
                  value={linkedinApp.clientSecret}
                  onChange={(e) => setLinkedinApp({ ...linkedinApp, clientSecret: e.target.value })}
                  autoComplete="off"
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                />
                <input readOnly value={liCallback} className="w-full text-xs font-mono border rounded px-2 py-1" />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await apiPatchUserCommunicationPrefs({
                        linkedinApp: {
                          clientId: linkedinApp.clientId,
                          clientSecret: linkedinApp.clientSecret,
                        },
                      });
                      if (res.data) {
                        setSettings(res.data.settings);
                        setLinkedinApp(res.data.linkedinApp);
                      }
                      toast.success('LinkedIn app credentials saved');
                    } catch (e: unknown) {
                      toast.error(e instanceof Error ? e.message : 'Save failed');
                    }
                  }}
                  className="px-4 py-2 text-sm bg-slate-800 text-white rounded-lg"
                >
                  Save LinkedIn app credentials
                </button>
                <ServiceConnectionCard
                  serviceName="LinkedIn member"
                  icon={<Globe className="w-6 h-6 text-[#0077b5]" />}
                  iconBgClass="bg-sky-50"
                  description="Connect your LinkedIn account for posting (uses backend callback)."
                  connected={connections.linkedin.connected}
                  connectedEmail={
                    connections.linkedin.email || connections.linkedin.pageName
                  }
                  scopes={['openid', 'profile', 'email', 'w_member_social']}
                  connecting={connectKey === 'li'}
                  onConnect={() => runConnect('li', () => apiStartOAuthConnect('linkedin'))}
                  onDisconnect={async () => {
                    await apiOAuthDisconnectLinkedInSettings();
                    await reload();
                    toast.success('LinkedIn disconnected');
                  }}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="password"
                  placeholder="API key"
                  value={jobBoardKeys.LinkedIn.apiKey}
                  onChange={(e) =>
                    setJobBoardKeys({
                      ...jobBoardKeys,
                      LinkedIn: { ...jobBoardKeys.LinkedIn, apiKey: e.target.value },
                    })
                  }
                  autoComplete="off"
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await apiPatchJobBoard({
                        platform: 'LinkedIn',
                        apiKey: jobBoardKeys.LinkedIn.apiKey,
                      });
                      toast.success('LinkedIn API key saved');
                      await reload();
                    } catch (e: unknown) {
                      toast.error(e instanceof Error ? e.message : 'Save failed');
                    }
                  }}
                  className="px-4 py-2 text-sm bg-slate-900 text-white rounded-lg"
                >
                  Save API key
                </button>
              </div>
            )}
          </div>

          <div className="border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Indeed</span>
              <div
                className={`w-2 h-2 rounded-full ${jobBoardKeys.Indeed.connected ? 'bg-green-500' : 'bg-slate-300'}`}
              />
            </div>
            <p className="text-xs text-slate-500">
              Publisher credentials —{' '}
              <a href="https://www.indeed.com/publisher" target="_blank" rel="noreferrer" className="text-[#2b7fff]">
                indeed.com/publisher
              </a>
            </p>
            <input
              placeholder="Publisher ID"
              value={jobBoardKeys.Indeed.publisherId}
              onChange={(e) =>
                setJobBoardKeys({
                  ...jobBoardKeys,
                  Indeed: { ...jobBoardKeys.Indeed, publisherId: e.target.value },
                })
              }
              className="w-full px-3 py-2 text-sm border rounded-lg"
            />
            <input
              type="password"
              placeholder="API key"
              value={jobBoardKeys.Indeed.apiKey}
              onChange={(e) =>
                setJobBoardKeys({
                  ...jobBoardKeys,
                  Indeed: { ...jobBoardKeys.Indeed, apiKey: e.target.value },
                })
              }
              autoComplete="off"
              className="w-full px-3 py-2 text-sm border rounded-lg"
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  await apiPatchJobBoard({
                    platform: 'Indeed',
                    apiKey: jobBoardKeys.Indeed.apiKey,
                    publisherId: jobBoardKeys.Indeed.publisherId,
                  });
                  toast.success('Indeed credentials saved');
                  await reload();
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : 'Save failed');
                }
              }}
              className="px-4 py-2 text-sm bg-[#003A9B] text-white rounded-lg"
            >
              Save Indeed credentials
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Naukri</span>
              <div
                className={`w-2 h-2 rounded-full ${jobBoardKeys.Naukri.connected ? 'bg-green-500' : 'bg-slate-300'}`}
              />
            </div>
            <p className="text-xs text-slate-500">Enterprise RMS integrations only.</p>
            <input
              placeholder="Client ID"
              value={jobBoardKeys.Naukri.clientId}
              onChange={(e) =>
                setJobBoardKeys({
                  ...jobBoardKeys,
                  Naukri: { ...jobBoardKeys.Naukri, clientId: e.target.value },
                })
              }
              className="w-full px-3 py-2 text-sm border rounded-lg"
            />
            <input
              type="password"
              placeholder="API key"
              value={jobBoardKeys.Naukri.apiKey}
              onChange={(e) =>
                setJobBoardKeys({
                  ...jobBoardKeys,
                  Naukri: { ...jobBoardKeys.Naukri, apiKey: e.target.value },
                })
              }
              autoComplete="off"
              className="w-full px-3 py-2 text-sm border rounded-lg"
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  await apiPatchJobBoard({
                    platform: 'Naukri',
                    apiKey: jobBoardKeys.Naukri.apiKey,
                    clientId: jobBoardKeys.Naukri.clientId,
                  });
                  toast.success('Naukri credentials saved');
                  await reload();
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : 'Save failed');
                }
              }}
              className="px-4 py-2 text-sm bg-[#ff7555] text-white rounded-lg"
            >
              Save Naukri credentials
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => void handleReset()}
          className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
        >
          Reset to defaults
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="px-5 py-2.5 text-sm font-medium text-white bg-[#2b7fff] rounded-xl hover:bg-blue-600 flex items-center gap-2 disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : 'Save communication settings'}
        </button>
      </div>
    </div>
  );
}
