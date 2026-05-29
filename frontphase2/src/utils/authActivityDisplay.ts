import type { MemberAuditTimelineItem } from '../lib/api/memberAuditApi';

function formatDisplayIp(ipAddress?: string | null): string | null {
  if (!ipAddress) return null;
  let ip = String(ipAddress).trim();
  if (!ip) return null;
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') return '127.0.0.1';
  return ip;
}

function parseBrowserFromUserAgent(ua: string): string {
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/Chrome\//i.test(ua) && !/Edg/i.test(ua)) return 'Chrome';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
  return 'Unknown browser';
}

function formatDisplayBrowser(deviceOrUserAgent?: string | null): string | null {
  if (!deviceOrUserAgent) return null;
  const raw = String(deviceOrUserAgent).trim();
  if (!raw) return null;
  if (!/Mozilla|AppleWebKit|Chrome|Safari|Firefox|Edg/i.test(raw) && raw.length <= 32) {
    return raw;
  }
  return parseBrowserFromUserAgent(raw);
}

export function formatAuthConnectionDetails(
  ipAddress?: string | null,
  deviceOrUserAgent?: string | null
): string | undefined {
  const ip = formatDisplayIp(ipAddress);
  const browser = formatDisplayBrowser(deviceOrUserAgent);
  const parts: string[] = [];
  if (ip) parts.push(`IP: ${ip}`);
  if (browser) parts.push(`Browser: ${browser}`);
  return parts.length ? parts.join(' · ') : undefined;
}

/** Device IP for the activity log IP column. */
export function formatActivityLogIp(item: MemberAuditTimelineItem): string {
  if (item.kind !== 'login' && item.source !== 'auth' && item.module !== 'Auth') {
    return '—';
  }

  const fromField = formatDisplayIp(item.ipAddress);
  if (fromField) return fromField;

  const desc = item.description?.trim();
  if (desc) {
    const ipMatch = desc.match(/IP:\s*([^\s·]+)/i);
    if (ipMatch?.[1]) return formatDisplayIp(ipMatch[1]) || ipMatch[1];

    const [first] = desc.split('·').map((s) => s.trim());
    if (first && !/Mozilla|Browser:/i.test(first)) {
      const parsed = formatDisplayIp(first.replace(/^IP:\s*/i, ''));
      if (parsed) return parsed;
    }
  }

  return '—';
}

export function formatActivityLogBrowser(item: MemberAuditTimelineItem): string {
  if (item.kind !== 'login' && item.source !== 'auth' && item.module !== 'Auth') {
    return '—';
  }

  const browser = formatDisplayBrowser(item.device);
  if (browser) return browser;

  const desc = item.description?.trim();
  if (desc) {
    const browserMatch = desc.match(/Browser:\s*([^·]+)/i);
    if (browserMatch?.[1]) return browserMatch[1].trim();

    if (/Mozilla|AppleWebKit/i.test(desc)) {
      const uaPart = desc.includes('·') ? desc.split('·').slice(1).join('·').trim() : desc;
      return formatDisplayBrowser(uaPart) || '—';
    }
  }

  return '—';
}

/** Details cell for activity log — IP + browser for auth/login rows. */
export function formatActivityLogDetails(item: MemberAuditTimelineItem): string {
  if (item.kind === 'login' || item.source === 'auth' || item.module === 'Auth') {
    const fromFields = formatAuthConnectionDetails(item.ipAddress, item.device);
    if (fromFields) return fromFields;

    const desc = item.description?.trim();
    if (desc && /Mozilla|AppleWebKit/i.test(desc)) {
      const [maybeIp, ...rest] = desc.split('·').map((s) => s.trim());
      const uaPart = rest.join(' · ') || maybeIp;
      const ip = formatDisplayIp(maybeIp.includes('Mozilla') ? null : maybeIp);
      const browser = formatDisplayBrowser(uaPart);
      const parts: string[] = [];
      if (ip) parts.push(`IP: ${ip}`);
      if (browser) parts.push(`Browser: ${browser}`);
      if (parts.length) return parts.join(' · ');
    }

    if (desc && !/Mozilla|AppleWebKit/i.test(desc)) return desc;

    const ip = formatActivityLogIp(item);
    const browser = formatActivityLogBrowser(item);
    if (ip !== '—' || browser !== '—') {
      const parts: string[] = [];
      if (ip !== '—') parts.push(`IP: ${ip}`);
      if (browser !== '—') parts.push(`Browser: ${browser}`);
      return parts.join(' · ');
    }
    return '—';
  }

  return item.description || item.relatedLabel || '—';
}
