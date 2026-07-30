import { apiFetch } from './api';

export type PortalEventSection = {
  id: string;
  title: string;
  content: string;
};

export type PortalEventRow = {
  id: string;
  title: string;
  description: string;
  location: string;
  sections: PortalEventSection[];
  type: string;
  mode: string;
  scheduledAt: string;
  durationMinutes: number;
  isPublished: boolean;
  registrationCount: number;
  createdByName?: string;
  createdByEmail?: string;
};

export type CreatePortalEventPayload = {
  title: string;
  description: string;
  location: string;
  scheduledAt: string;
  sections?: PortalEventSection[];
  type?: string;
  mode?: string;
  durationMinutes?: number;
  isPublished?: boolean;
};

export type PortalEventRegistrationRow = {
  id: string;
  registeredAt: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  currentTitle: string;
};

export async function apiListTenantPortalEvents(): Promise<PortalEventRow[]> {
  const res = await apiFetch<{ events: PortalEventRow[] }>('/portal-events', { auth: true });
  return Array.isArray(res.data?.events) ? res.data.events : [];
}

export async function apiCreateTenantPortalEvent(payload: CreatePortalEventPayload): Promise<PortalEventRow> {
  const res = await apiFetch<{ event: PortalEventRow }>('/portal-events', {
    method: 'POST',
    auth: true,
    body: payload,
  });
  return res.data.event;
}

export async function apiListTenantPortalEventRegistrations(eventId: string): Promise<{
  event: PortalEventRow;
  registrations: PortalEventRegistrationRow[];
}> {
  const res = await apiFetch<{ event: PortalEventRow; registrations: PortalEventRegistrationRow[] }>(
    `/portal-events/${encodeURIComponent(eventId)}/registrations`,
    { auth: true },
  );
  return res.data;
}

export async function apiListHqPortalEvents(): Promise<PortalEventRow[]> {
  const res = await apiFetch<{ events: PortalEventRow[] }>('/hq/events', { auth: true });
  return Array.isArray(res.data?.events) ? res.data.events : [];
}

export async function apiCreateHqPortalEvent(payload: CreatePortalEventPayload): Promise<PortalEventRow> {
  const res = await apiFetch<{ event: PortalEventRow }>('/hq/events', {
    method: 'POST',
    auth: true,
    body: payload,
  });
  return res.data.event;
}

export async function apiListHqPortalEventRegistrations(eventId: string): Promise<{
  event: PortalEventRow;
  registrations: PortalEventRegistrationRow[];
}> {
  const res = await apiFetch<{ event: PortalEventRow; registrations: PortalEventRegistrationRow[] }>(
    `/hq/events/${encodeURIComponent(eventId)}/registrations`,
    { auth: true },
  );
  return res.data;
}
