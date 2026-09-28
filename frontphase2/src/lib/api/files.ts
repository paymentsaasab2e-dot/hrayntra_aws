/* files API */
import { API_BASE, ApiResponse, apiFetch, apiFetchFormData, getAccessToken } from './core';
import type { Placement } from '../../types/placement';
import type { CommunicationSettingsShape, EntityFile, FileEntityType, TaskFile } from './types';


export async function apiUploadOrgWatermarkLogo(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetchFormData<{
    fileUrl: string;
    fileName?: string;
    watermark?: import('../exportWatermark').ExportWatermarkSettings;
  }>('/settings/org/watermark/logo', formData, {
    method: 'POST',
    auth: true,
  });
}

export async function apiUploadUserAvatar(userId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('entityType', 'user');
  formData.append('entityId', userId);
  formData.append('fileType', 'Avatar');
  
  return apiFetchFormData<{ fileUrl: string }>('/files', formData, {
    method: 'POST',
    auth: true,
  });
}

/** Upload an image for the email compose signature (public URL for email clients). */

export async function apiUploadEmailSignatureLogo(_userId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return apiFetchFormData<{ fileUrl: string; settings?: CommunicationSettingsShape }>(
    '/settings/communication/signature-logo',
    formData,
    {
      method: 'POST',
      auth: true,
    },
  );
}

export const apiUploadPlacementDocument = async (
  id: string,
  file: File,
  documentType: 'OFFER_LETTER' | 'JOINING_LETTER' | 'INVOICE' | 'AGREEMENT' | 'OTHER' = 'OTHER',
) => {
  const formData = new FormData();
  formData.append('document', file);
  formData.append('documentType', documentType);
  return apiFetchFormData<Placement>(`/placements/${id}/documents`, formData, {
    method: 'POST',
    auth: true,
  });
};

export const apiGetTaskFiles = async (taskId: string) => {
  return apiFetch<TaskFile[]>(`/tasks/${taskId}/files`, {
    method: 'GET',
    auth: true,
  });
};

export const apiUploadTaskFile = async (taskId: string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  const token = getAccessToken();
  if (!token) {
    throw new Error('No access token found');
  }

  const url = `${API_BASE}/tasks/${taskId}/files`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    const msg = json?.message || `Request failed with status ${response.status}`;
    throw new Error(msg);
  }

  return response.json() as Promise<ApiResponse<TaskFile>>;
};

export const apiUploadTaskFiles = async (taskId: string, files: File[]) => {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
  });

  const token = getAccessToken();
  if (!token) {
    throw new Error('No access token found');
  }

  const url = `${API_BASE}/tasks/${taskId}/files/multiple`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    const msg = json?.message || `Request failed with status ${response.status}`;
    throw new Error(msg);
  }

  return response.json() as Promise<ApiResponse<TaskFile[]>>;
};

// Job File Upload API

export const apiDeleteTaskFile = async (taskId: string, fileId: string) => {
  return apiFetch<{ message: string }>(`/tasks/${taskId}/files/${fileId}`, {
    method: 'DELETE',
    auth: true,
  });
};

// ────────────────────────────────────────────────────────────
// Generic Files Service (reusable for job, lead, client, etc.)
// ────────────────────────────────────────────────────────────

export const filesApiGet = async (entityType: FileEntityType, entityId: string) => {
  const params = new URLSearchParams({ entityType, entityId });
  return apiFetch<EntityFile[]>(`/files?${params}`, { auth: true });
};

/** Upload a file for an entity. Returns the created file record. */

export const filesApiUpload = async (
  entityType: FileEntityType,
  entityId: string,
  file: File,
  fileType: string = 'JD'
) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('entityType', entityType);
  formData.append('entityId', entityId);
  formData.append('fileType', fileType);

  // Must use apiFetchFormData so x-tenant-db-name is sent — raw fetch hits the
  // default DB and auth returns "User not found or inactive".
  return apiFetchFormData<EntityFile>('/files', formData, {
    method: 'POST',
    auth: true,
  });
};

/** Delete a file by ID. */

export const filesApiDelete = async (entityType: FileEntityType, entityId: string, fileId: string) => {
  const params = new URLSearchParams({ entityType, entityId });
  return apiFetch(`/files/${fileId}?${params}`, {
    method: 'DELETE',
    auth: true,
  });
};

// ────────────────────────────────────────────────────────────
// Internal Chat (Inbox) for entity drawers
// ────────────────────────────────────────────────────────────
