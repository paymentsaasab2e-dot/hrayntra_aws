import { apiFetch, apiFetchFormData } from './api';

export type PortalEventSection = {
  id: string;
  title: string;
  content: string;
};

export type PortalEventMediaItem = {
  id: string;
  type: 'image' | 'video';
  url: string;
  name?: string;
  size?: number;
};

export type PortalEventRow = {
  id: string;
  title: string;
  description: string;
  location: string;
  sections: PortalEventSection[];
  media?: PortalEventMediaItem[];
  type: string;
  mode: string;
  scheduledAt: string;
  durationMinutes: number;
  isPublished: boolean;
  status?: 'active' | 'cancelled' | string;
  registrationCount: number;
  createdByName?: string;
  createdByEmail?: string;
  accessType?: 'free' | 'purchase' | string;
  tokenCost?: number;
  isFree?: boolean;
  ctaLabel?: string;
};

export type CreatePortalEventPayload = {
  title: string;
  description: string;
  location: string;
  scheduledAt: string;
  sections?: PortalEventSection[];
  media?: PortalEventMediaItem[];
  type?: string;
  mode?: string;
  durationMinutes?: number;
  isPublished?: boolean;
  accessType?: 'free' | 'purchase';
  tokenCost?: number;
  ctaLabel?: string;
};

export type UpdatePortalEventPayload = Partial<CreatePortalEventPayload>;

export const PORTAL_EVENT_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
export const PORTAL_EVENT_MEDIA_MAX_COUNT = 20;
export const EVENT_CTA_PRESETS = ['Learn', 'Apply', 'Join', 'Register', 'Attend'] as const;

export async function apiUploadTenantPortalEventMedia(files: File[]): Promise<PortalEventMediaItem[]> {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  const res = await apiFetchFormData<{ media: PortalEventMediaItem[] }>('/portal-events/media', formData, {
    method: 'POST',
    auth: true,
  });
  return Array.isArray(res.data?.media) ? res.data.media : [];
}

export async function apiUploadHqPortalEventMedia(files: File[]): Promise<PortalEventMediaItem[]> {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  const res = await apiFetchFormData<{ media: PortalEventMediaItem[] }>('/hq/events/media', formData, {
    method: 'POST',
    auth: true,
  });
  return Array.isArray(res.data?.media) ? res.data.media : [];
}

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

export async function apiUpdateTenantPortalEvent(
  eventId: string,
  payload: UpdatePortalEventPayload,
): Promise<PortalEventRow> {
  const res = await apiFetch<{ event: PortalEventRow }>(`/portal-events/${encodeURIComponent(eventId)}`, {
    method: 'PUT',
    auth: true,
    body: payload,
  });
  return res.data.event;
}

export async function apiCancelTenantPortalEvent(eventId: string): Promise<PortalEventRow> {
  const res = await apiFetch<{ event: PortalEventRow }>(
    `/portal-events/${encodeURIComponent(eventId)}/cancel`,
    { method: 'POST', auth: true },
  );
  return res.data.event;
}

export async function apiDeleteTenantPortalEvent(eventId: string): Promise<void> {
  await apiFetch(`/portal-events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    auth: true,
  });
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

export async function apiUpdateHqPortalEvent(
  eventId: string,
  payload: UpdatePortalEventPayload,
): Promise<PortalEventRow> {
  const res = await apiFetch<{ event: PortalEventRow }>(`/hq/events/${encodeURIComponent(eventId)}`, {
    method: 'PUT',
    auth: true,
    body: payload,
  });
  return res.data.event;
}

export async function apiCancelHqPortalEvent(eventId: string): Promise<PortalEventRow> {
  const res = await apiFetch<{ event: PortalEventRow }>(
    `/hq/events/${encodeURIComponent(eventId)}/cancel`,
    { method: 'POST', auth: true },
  );
  return res.data.event;
}

export async function apiDeleteHqPortalEvent(eventId: string): Promise<void> {
  await apiFetch(`/hq/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    auth: true,
  });
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
