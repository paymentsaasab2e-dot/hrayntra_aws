/**
 * Per-user email compose signature (Settings → Communication & Integrations).
 * Stored in Mongo via UserCommunicationPreferences; cached in memory for compose.
 */

import {
  apiGetGmailSignature,
  apiGetOutlookSignature,
  apiGetUserCommunication,
  apiPatchUserCommunicationPrefs,
} from './api';
import { plainTextToEmailHtml } from './emailLinkify';
import type { MailboxComposeProvider } from './mailboxCompose';

const LEGACY_STORAGE_PREFIX = 'emailComposeSignature';
export const EMAIL_COMPOSE_SIGNATURE_CHANGED_EVENT = 'hrayntra:email-compose-signature-changed';

export type EmailComposeSignatureState = {
  signature: string;
  logoUrl: string;
};

/** null = not loaded from API yet */
let memoryCache: EmailComposeSignatureState | null = null;
let loadPromise: Promise<EmailComposeSignatureState> | null = null;

function currentUserId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const parsed = JSON.parse(localStorage.getItem('currentUser') || '{}') as { id?: string };
    return String(parsed?.id || '').trim();
  } catch {
    return '';
  }
}

function tenantKey(): string {
  if (typeof window === 'undefined') return 'default';
  return String(localStorage.getItem('tenantDbName') || 'default').trim() || 'default';
}

function legacyStorageKey(): string {
  const user = currentUserId() || 'anon';
  return `${LEGACY_STORAGE_PREFIX}:${tenantKey()}:${user}`;
}

function normalizeSignature(raw: string): string {
  return String(raw || '').replace(/\r\n/g, '\n').trimEnd();
}

/** Make uploaded file URLs absolute so <img> works in settings + email clients. */
export function toPublicSignatureAssetUrl(raw: string | null | undefined): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const apiBase = String(
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) ||
      (typeof window !== 'undefined' ? 'http://localhost:5001/api/v1' : ''),
  )
    .trim()
    .replace(/\/$/, '');
  // Prefer origin without /api/v1 for bare /uploads paths; keep /api/v1 for API-relative paths.
  const origin = apiBase.replace(/\/api\/v1\/?$/, '');
  if (value.startsWith('/')) {
    if (value.startsWith('/api/') || value.startsWith('/uploads/')) {
      return `${origin}${value}`;
    }
    return `${apiBase}${value}`;
  }
  return `${origin}/${value}`;
}

function normalizeLogoUrl(raw: string | null | undefined): string {
  return toPublicSignatureAssetUrl(raw);
}

function readLegacyLocalStorage(): string {
  if (typeof window === 'undefined') return '';
  try {
    return normalizeSignature(localStorage.getItem(legacyStorageKey()) || '');
  } catch {
    return '';
  }
}

function clearLegacyLocalStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(legacyStorageKey());
  } catch {
    /* ignore */
  }
}

function notifySignatureChanged(state: EmailComposeSignatureState): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(EMAIL_COMPOSE_SIGNATURE_CHANGED_EVENT, { detail: state }),
  );
}

function applyCache(signature: string, logoUrl: string): EmailComposeSignatureState {
  memoryCache = {
    signature: normalizeSignature(signature),
    logoUrl: normalizeLogoUrl(logoUrl),
  };
  notifySignatureChanged(memoryCache);
  return memoryCache;
}

/** Apply signature already loaded from GET /settings/communication (avoids a second fetch). */
export function hydrateEmailComposeSignature(
  signature: string,
  logoUrl: string = memoryCache?.logoUrl || '',
): EmailComposeSignatureState {
  return applyCache(signature, logoUrl);
}

export function hydrateEmailComposeSignatureState(state: {
  signature?: string | null;
  logoUrl?: string | null;
}): EmailComposeSignatureState {
  return applyCache(state.signature || '', state.logoUrl || '');
}

/** Sync read of in-memory cache (empty until ensureEmailComposeSignatureLoaded). */
export function getEmailComposeSignature(): string {
  return memoryCache?.signature ?? '';
}

export function getEmailComposeSignatureLogoUrl(): string {
  return memoryCache?.logoUrl ?? '';
}

export function getEmailComposeSignatureState(): EmailComposeSignatureState {
  return memoryCache ?? { signature: '', logoUrl: '' };
}

/**
 * Load signature from the database (once per session). Migrates any old
 * browser-only value into the DB on first load after upgrade.
 */
export async function ensureEmailComposeSignatureLoaded(): Promise<string> {
  const state = await ensureEmailComposeSignatureStateLoaded();
  return state.signature;
}

export async function ensureEmailComposeSignatureStateLoaded(): Promise<EmailComposeSignatureState> {
  if (memoryCache !== null) return memoryCache;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const res = await apiGetUserCommunication();
      let sig = normalizeSignature(res?.data?.settings?.emailComposeSignature || '');
      const logoUrl = normalizeLogoUrl(res?.data?.settings?.emailComposeSignatureLogoUrl || '');
      const legacy = readLegacyLocalStorage();
      if (!sig && legacy) {
        try {
          await apiPatchUserCommunicationPrefs({ emailComposeSignature: legacy });
          sig = legacy;
        } catch {
          sig = legacy;
        }
      }
      clearLegacyLocalStorage();
      return applyCache(sig, logoUrl);
    } catch {
      const legacy = readLegacyLocalStorage();
      return applyCache(legacy, memoryCache?.logoUrl || '');
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

/** Persist signature text to the database and refresh the in-memory cache. */
export async function saveEmailComposeSignature(raw: string): Promise<string> {
  const next = normalizeSignature(raw);
  const res = await apiPatchUserCommunicationPrefs({ emailComposeSignature: next });
  const fromApi = normalizeSignature(res?.data?.settings?.emailComposeSignature || next);
  const logoUrl = normalizeLogoUrl(
    res?.data?.settings?.emailComposeSignatureLogoUrl ?? memoryCache?.logoUrl ?? '',
  );
  clearLegacyLocalStorage();
  applyCache(fromApi, logoUrl);
  clearProviderSignatureCache();
  return fromApi;
}

/** Persist signature logo URL (empty string clears). */
export async function saveEmailComposeSignatureLogoUrl(raw: string): Promise<string> {
  const next = normalizeLogoUrl(raw);
  const res = await apiPatchUserCommunicationPrefs({ emailComposeSignatureLogoUrl: next || null });
  const fromApi = normalizeLogoUrl(
    res?.data?.settings?.emailComposeSignatureLogoUrl ?? next,
  );
  const signature = normalizeSignature(
    res?.data?.settings?.emailComposeSignature ?? memoryCache?.signature ?? '',
  );
  applyCache(signature, fromApi);
  clearProviderSignatureCache();
  return fromApi;
}

/** @deprecated Use saveEmailComposeSignature — kept for call-site compatibility. */
export function setEmailComposeSignature(raw: string): string {
  const next = normalizeSignature(raw);
  void saveEmailComposeSignature(next);
  applyCache(next, memoryCache?.logoUrl || '');
  return next;
}

export function subscribeEmailComposeSignatureChanged(
  listener: (signature: string) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<EmailComposeSignatureState | string>).detail;
    if (typeof detail === 'string') {
      listener(detail);
      return;
    }
    listener(detail?.signature ?? getEmailComposeSignature());
  };
  window.addEventListener(EMAIL_COMPOSE_SIGNATURE_CHANGED_EVENT, handler);
  return () => window.removeEventListener(EMAIL_COMPOSE_SIGNATURE_CHANGED_EVENT, handler);
}

export function subscribeEmailComposeSignatureStateChanged(
  listener: (state: EmailComposeSignatureState) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<EmailComposeSignatureState | string>).detail;
    if (typeof detail === 'string') {
      listener({ signature: detail, logoUrl: getEmailComposeSignatureLogoUrl() });
      return;
    }
    listener(detail ?? getEmailComposeSignatureState());
  };
  window.addEventListener(EMAIL_COMPOSE_SIGNATURE_CHANGED_EVENT, handler);
  return () => window.removeEventListener(EMAIL_COMPOSE_SIGNATURE_CHANGED_EVENT, handler);
}

/**
 * Append the saved signature once. Skips if empty or already present at the end.
 */
export function appendEmailComposeSignature(
  body: string,
  signature = getEmailComposeSignature(),
): string {
  const base = String(body || '').replace(/\r\n/g, '\n').trimEnd();
  const sig = normalizeSignature(signature);
  if (!sig) return base;
  if (!base) return sig;
  if (base.endsWith(sig)) return base;
  const marked = `--\n${sig}`;
  if (base.includes(marked)) return base;
  return `${base}\n\n--\n${sig}`;
}

function escapeHtmlAttr(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function signatureLogoHtml(logoUrl: string): string {
  const src = toPublicSignatureAssetUrl(logoUrl);
  if (!src || /^(blob:)/i.test(src)) return '';
  if (!/^(https?:|data:)/i.test(src)) return '';
  return (
    `<div style="margin:16px 0 8px 0;">` +
    `<img src="${escapeHtmlAttr(src)}" alt="" width="180" ` +
    `style="max-height:72px;max-width:220px;height:auto;width:auto;display:block;border:0;outline:none;" />` +
    `</div>`
  );
}

function appendInsideEmailWrapper(bodyHtml: string, trailingHtml: string): string {
  const trail = String(trailingHtml || '');
  if (!trail) return bodyHtml;
  if (/<\/div>\s*$/i.test(bodyHtml)) {
    return bodyHtml.replace(/<\/div>\s*$/i, `${trail}</div>`);
  }
  return `${bodyHtml}${trail}`;
}

function stripTrailingSignatureBlock(body: string, signatureText = ''): string {
  const base = String(body || '').replace(/\r\n/g, '\n').trimEnd();
  const dividerIdx = base.lastIndexOf('\n\n--\n');
  if (dividerIdx >= 0) return base.slice(0, dividerIdx).trimEnd();
  if (base.startsWith('--\n')) return '';
  const sig = normalizeSignature(signatureText);
  if (sig && base.endsWith(sig)) {
    return base.slice(0, -sig.length).replace(/\n*--\s*$/, '').trimEnd();
  }
  return base;
}

/**
 * Build HTML email body with text signature + optional logo image.
 * Logo is always injected when a public logo URL is available.
 */
export function bodyWithEmailSignatureToHtml(
  body: string,
  options?: { signature?: string; logoUrl?: string; providerHtml?: string },
): string {
  const providerHtml = String(options?.providerHtml || '').trim();
  const signature = normalizeSignature(options?.signature ?? getEmailComposeSignature());
  const logoUrl = toPublicSignatureAssetUrl(options?.logoUrl ?? getEmailComposeSignatureLogoUrl());
  const logoBlock = signatureLogoHtml(logoUrl);

  if (providerHtml) {
    const stripped = stripTrailingSignatureBlock(body, signature);
    const bodyHtml = plainTextToEmailHtml(stripped);
    const sigBlock = `${logoBlock}<div style="margin-top:12px;">${providerHtml}</div>`;
    return appendInsideEmailWrapper(bodyHtml, sigBlock);
  }

  const stripped = stripTrailingSignatureBlock(body, signature);
  const bodyHtml = plainTextToEmailHtml(stripped);
  let sigInner = '';
  if (logoBlock) sigInner += logoBlock;
  if (signature) {
    const textHtml = String(signature)
      .split('\n')
      .map((line) => {
        const escaped = line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        return escaped || '&nbsp;';
      })
      .join('<br/>');
    sigInner +=
      `<div style="margin-top:${logoBlock ? '4px' : '16px'};color:#202124;">` +
      `<div style="border-top:1px solid #dadce0;padding-top:12px;margin-top:4px;">--</div>` +
      `<div style="margin-top:8px;">${textHtml}</div>` +
      `</div>`;
  } else if (logoBlock) {
    // logo-only already in sigInner
  }

  return appendInsideEmailWrapper(bodyHtml, sigInner);
}

export type ResolvedComposeSignature = {
  /** Prefer provider HTML when present (Gmail). */
  providerHtml: string;
  /** Plain text for textarea preview / URL compose fallback. */
  text: string;
  /** App logo URL (always kept when configured). */
  logoUrl: string;
  source: 'provider' | 'app' | 'none';
  requiresReconnect?: boolean;
};

const providerSigCache = new Map<string, { at: number; value: ResolvedComposeSignature }>();
const PROVIDER_SIG_TTL_MS = 5 * 60 * 1000;

function clearProviderSignatureCache(): void {
  providerSigCache.clear();
}

/**
 * Prefer the connected mailbox signature when available; otherwise use the
 * in-app signature (text + optional logo). App logo is kept in either case.
 */
export async function resolveComposeSignature(
  provider: MailboxComposeProvider,
): Promise<ResolvedComposeSignature> {
  await ensureEmailComposeSignatureStateLoaded();
  const app = getEmailComposeSignatureState();
  const cacheKey = provider;
  const cached = providerSigCache.get(cacheKey);
  if (cached && Date.now() - cached.at < PROVIDER_SIG_TTL_MS) {
    // Refresh logo from latest app cache (logo may change without provider change).
    return { ...cached.value, logoUrl: app.logoUrl || cached.value.logoUrl };
  }

  let providerHtml = '';
  let providerText = '';
  let requiresReconnect = false;

  try {
    const remote =
      provider === 'gmail' ? await apiGetGmailSignature() : await apiGetOutlookSignature();
    providerHtml = String(remote?.html || '').trim();
    providerText = normalizeSignature(remote?.text || '');
    requiresReconnect = Boolean(remote?.requiresReconnect);
  } catch {
    /* fall through to app signature */
  }

  let resolved: ResolvedComposeSignature;
  if (providerHtml || providerText) {
    resolved = {
      providerHtml,
      text: providerText || htmlToRoughPlain(providerHtml),
      logoUrl: app.logoUrl,
      source: 'provider',
      requiresReconnect,
    };
  } else if (app.signature || app.logoUrl) {
    resolved = {
      providerHtml: '',
      text: app.signature,
      logoUrl: app.logoUrl,
      source: 'app',
      requiresReconnect,
    };
  } else {
    resolved = {
      providerHtml: '',
      text: '',
      logoUrl: '',
      source: 'none',
      requiresReconnect,
    };
  }

  providerSigCache.set(cacheKey, { at: Date.now(), value: resolved });
  return resolved;
}

function htmlToRoughPlain(html: string): string {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
