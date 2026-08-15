import { apiFetch, apiFetchFormData } from './api';

export type TenantCompanyPage = {
  id: string;
  tenantDbName: string;
  domainKey: string;
  name: string;
  description?: string;
  logoLetter?: string;
  logoUrl?: string;
  website?: string;
  industry?: string;
  location?: string;
  industries?: string[];
  locations?: string[];
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  source?: string;
};

export type TenantCompanyPost = {
  id: string;
  tenantDbName: string;
  companyPageId: string;
  companyName?: string;
  authorId: string;
  authorName: string;
  type: string;
  text: string;
  mediaUrl?: string;
  createdAt: string;
  source?: string;
};

export type UpsertCompanyPagePayload = {
  name: string;
  description?: string;
  website?: string;
  domainKey?: string;
  industries?: string[];
  locations?: string[];
  industry?: string;
  location?: string;
  logoUrl?: string | null;
};

export async function apiGetTenantCompanyPage() {
  return apiFetch<{ page: TenantCompanyPage | null; posts: TenantCompanyPost[] }>('/company-page', {
    auth: true,
  });
}

export async function apiUpsertTenantCompanyPage(payload: UpsertCompanyPagePayload) {
  return apiFetch<{ page: TenantCompanyPage; synced: boolean }>('/company-page', {
    method: 'PUT',
    auth: true,
    body: payload,
  });
}

export async function apiCreateTenantCompanyPost(payload: { text: string; mediaUrl?: string }) {
  return apiFetch<{ post: TenantCompanyPost; synced: boolean }>('/company-page/posts', {
    method: 'POST',
    auth: true,
    body: payload,
  });
}

export async function apiDeleteTenantCompanyPost(postId: string) {
  return apiFetch<{ ok: boolean }>(`/company-page/posts/${encodeURIComponent(postId)}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function apiResyncTenantCompanyPage() {
  return apiFetch<{ synced: boolean }>('/company-page/resync', {
    method: 'POST',
    auth: true,
  });
}

export async function apiUploadCompanyPageLogo(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetchFormData<{
    logoUrl: string;
    name?: string;
    size?: number;
    page?: TenantCompanyPage | null;
  }>('/company-page/logo', formData, {
    method: 'POST',
    auth: true,
  });
}

export async function apiUploadCompanyPostMedia(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetchFormData<{
    mediaUrl: string;
    name?: string;
    size?: number;
  }>('/company-page/posts/media', formData, {
    method: 'POST',
    auth: true,
  });
}
