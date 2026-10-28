'use client';

import { useEffect, useRef } from 'react';

/** Query keys for restoring drawers after refresh / OAuth. Do not rename — URLs persist. */
export const DRAWER_QUERY = {
  createJob: 'createJob',
  editJob: 'editJob',
  jobStep: 'jobStep',
  jobAi: 'jobAi',
  jobAiStep: 'jobAiStep',
  jobAiPublish: 'jobAiPublish',
  jobAiDest: 'jobAiDest',
  jobTab: 'jobTab',
  jobId: 'jobId',
  candidateId: 'candidateId',
  candidateTab: 'candidateTab',
  leadId: 'leadId',
  leadTab: 'leadTab',
  leadStep: 'leadStep',
  addLead: 'addLead',
  clientId: 'clientId',
  clientTab: 'clientTab',
  addClient: 'addClient',
  interviewId: 'interviewId',
  interviewTab: 'interviewTab',
  placementId: 'placementId',
  memberId: 'memberId',
  memberTab: 'memberTab',
  taskId: 'taskId',
  taskTab: 'taskTab',
  contactId: 'contactId',
  contactTab: 'contactTab',
} as const;

const RETURN_KEY = 'drawer_return_to';
const CREATE_JOB_STEP_KEY = 'reopen_create_job_step';

export type CreateJobUrlStep = 'client' | 'jd' | 'details' | 'application' | 'publish';

const CREATE_JOB_STEPS: CreateJobUrlStep[] = ['client', 'jd', 'details', 'application', 'publish'];

export function isCreateJobUrlStep(value: string | null | undefined): value is CreateJobUrlStep {
  return CREATE_JOB_STEPS.includes(String(value || '') as CreateJobUrlStep);
}

export function readAllowedDrawerQuery<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = readDrawerQuery(key);
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

let pageIsUnloading = false;
if (typeof window !== 'undefined') {
  const markUnloading = () => {
    pageIsUnloading = true;
  };
  window.addEventListener('pagehide', markUnloading);
  window.addEventListener('beforeunload', markUnloading);
}

export function readDrawerQuery(key: string): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get(key) || '';
}

/** Patch query params without a Next navigation (keeps drawers mounted). */
export function patchDrawerQuery(updates: Record<string, string | null | undefined>) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  let changed = false;
  for (const [key, value] of Object.entries(updates)) {
    const next = value == null || value === '' ? null : String(value);
    const prev = url.searchParams.get(key);
    if (next == null) {
      if (prev != null) {
        url.searchParams.delete(key);
        changed = true;
      }
    } else if (prev !== next) {
      url.searchParams.set(key, next);
      changed = true;
    }
  }
  if (!changed) return;
  const qs = url.searchParams.toString();
  window.history.replaceState(window.history.state, '', `${url.pathname}${qs ? `?${qs}` : ''}${url.hash}`);
}

export function rememberDrawerReturnUrl() {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(RETURN_KEY, `${window.location.pathname}${window.location.search}`);
}

export function takeDrawerReturnPath(): string {
  if (typeof window === 'undefined') return '';
  const raw = String(sessionStorage.getItem(RETURN_KEY) || '').trim();
  sessionStorage.removeItem(RETURN_KEY);
  return raw;
}

export function rememberCreateJobStep(step: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(CREATE_JOB_STEP_KEY, step);
}

export function takeCreateJobStep(): string {
  if (typeof window === 'undefined') return '';
  const raw = String(sessionStorage.getItem(CREATE_JOB_STEP_KEY) || '').trim();
  sessionStorage.removeItem(CREATE_JOB_STEP_KEY);
  return raw;
}

/** Restore a same-origin path saved before OAuth. Returns true if the URL changed. */
export function applyDrawerReturnPath(rawPath: string): boolean {
  if (typeof window === 'undefined') return false;
  const path = String(rawPath || '').trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || /[\r\n]/.test(path)) {
    return false;
  }
  try {
    const resolved = new URL(path, window.location.origin);
    if (resolved.origin !== window.location.origin) return false;
    const next = `${resolved.pathname}${resolved.search}${resolved.hash}`;
    window.history.replaceState(window.history.state, '', next);
    return true;
  } catch {
    return false;
  }
}

export function stripOauthCallbackQuery() {
  patchDrawerQuery({
    linkedin: null,
    linkedinAccounts: null,
    message: null,
    integration_connected: null,
    integration_error: null,
    email: null,
  });
}

/** Write query params while a drawer is open; clear those keys when it closes. */
export function useBindDrawerQuery(active: boolean, updates: Record<string, string | null | undefined>) {
  const payload = JSON.stringify(updates);
  const updatesRef = useRef(updates);
  updatesRef.current = updates;
  const wasActiveRef = useRef(false);

  useEffect(() => {
    if (active) {
      patchDrawerQuery(JSON.parse(payload) as Record<string, string | null | undefined>);
      wasActiveRef.current = true;
      return;
    }
    // Only strip on an in-place close. Unmount/refresh/Strict Mode must keep
    // jobId + tab in the URL so the drawer can restore.
    if (!wasActiveRef.current) return;
    wasActiveRef.current = false;
    if (pageIsUnloading) return;
    const parsed = updatesRef.current;
    const clear: Record<string, null> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value != null && value !== '') {
        clear[key] = null;
      }
    }
    patchDrawerQuery(clear);
  }, [active, payload]);
}
