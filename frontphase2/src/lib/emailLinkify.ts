/**
 * Turn plain-text email bodies into HTML with real clickable links
 * (Gmail/Outlook style), escaping everything else safely.
 */

const URL_RE =
  /((?:https?:\/\/|www\.)[^\s<>"'{}|\\^`\[\]]+[^\s<>"'{}|\\^`\[\].,;:!?)]+)/gi;

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeHref(raw: string): string {
  const url = String(raw || '').trim();
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (/^www\./i.test(url)) return `https://${url}`;
  return url;
}

function linkLabelForUrl(href: string): string {
  const lower = href.toLowerCase();
  if (lower.includes('/client-review/')) return 'Open candidate preview';
  if (lower.includes('/login') || lower.includes('reset')) return 'Open link';
  try {
    const u = new URL(href);
    const path = `${u.host}${u.pathname}`.replace(/\/$/, '');
    return path.length > 64 ? `${path.slice(0, 61)}…` : path || href;
  } catch {
    return href.length > 64 ? `${href.slice(0, 61)}…` : href;
  }
}

const ANCHOR_STYLE =
  'color:#1a73e8;text-decoration:underline;word-break:break-all';

/** Escape plain text and wrap http(s)/www URLs in <a href> anchors. */
export function linkifyPlainTextToHtml(text: string): string {
  const raw = String(text || '');
  if (!raw.trim()) return '';

  const parts: string[] = [];
  let last = 0;
  URL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = URL_RE.exec(raw)) !== null) {
    const start = match.index;
    const matched = match[1] || match[0];
    if (start > last) {
      parts.push(escapeHtml(raw.slice(last, start)).replace(/\r\n|\n|\r/g, '<br/>'));
    }
    const href = normalizeHref(matched);
    const label = escapeHtml(linkLabelForUrl(href));
    parts.push(
      `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="${ANCHOR_STYLE}">${label}</a>`,
    );
    last = start + matched.length;
  }
  if (last < raw.length) {
    parts.push(escapeHtml(raw.slice(last)).replace(/\r\n|\n|\r/g, '<br/>'));
  }
  return parts.join('');
}

/** Full HTML email body wrapper for Graph / rich mail clients. */
export function plainTextToEmailHtml(text: string): string {
  const linked = linkifyPlainTextToHtml(text);
  if (!linked) return '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#202124;"></div>';
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#202124;">${linked}</div>`;
}

/** React-safe nodes for inbox plain-text reader (clickable links). */
export function linkifyPlainTextToReactNodes(text: string): Array<string | { href: string; label: string }> {
  const raw = String(text || '');
  const nodes: Array<string | { href: string; label: string }> = [];
  let last = 0;
  URL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = URL_RE.exec(raw)) !== null) {
    const start = match.index;
    const matched = match[1] || match[0];
    if (start > last) nodes.push(raw.slice(last, start));
    const href = normalizeHref(matched);
    nodes.push({ href, label: linkLabelForUrl(href) });
    last = start + matched.length;
  }
  if (last < raw.length) nodes.push(raw.slice(last));
  return nodes;
}
