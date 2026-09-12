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

function anchorHtml(href: string): string {
  const safeHref = escapeHtml(href);
  const label = escapeHtml(linkLabelForUrl(href));
  return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="${ANCHOR_STYLE}">${label}</a>`;
}

/** Linkify bare URLs inside a plain-text segment (no HTML tags). */
function linkifyPlainSegment(segment: string): string {
  const raw = String(segment || '');
  if (!raw) return '';
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
    parts.push(anchorHtml(normalizeHref(matched)));
    last = start + matched.length;
  }
  if (last < raw.length) {
    parts.push(escapeHtml(raw.slice(last)).replace(/\r\n|\n|\r/g, '<br/>'));
  }
  return parts.join('');
}

/**
 * Linkify bare http(s)/www URLs that are not already inside an href="…" or <a>…</a>.
 * Safe to run on mixed HTML (e.g. body + signature).
 */
export function linkifyBareUrlsInHtml(html: string): string {
  const raw = String(html || '');
  if (!raw.trim()) return '';

  // Split into tags vs text so we never rewrite existing markup/attributes.
  const chunks = raw.split(/(<[^>]+>)/g);
  let insideAnchor = 0;
  return chunks
    .map((chunk) => {
      if (!chunk) return '';
      if (chunk.startsWith('<')) {
        if (/^<\s*a\b/i.test(chunk)) insideAnchor += 1;
        if (/^<\s*\/\s*a\s*>/i.test(chunk)) insideAnchor = Math.max(0, insideAnchor - 1);
        return chunk;
      }
      if (insideAnchor > 0) return chunk;
      // Text node: linkify without double-escaping existing entities already in HTML.
      // Re-escape only when the segment has no entities that look pre-escaped — use a lighter pass.
      URL_RE.lastIndex = 0;
      if (!URL_RE.test(chunk)) return chunk.replace(/\r\n|\n|\r/g, '<br/>');
      URL_RE.lastIndex = 0;
      const parts: string[] = [];
      let last = 0;
      let match: RegExpExecArray | null;
      while ((match = URL_RE.exec(chunk)) !== null) {
        const start = match.index;
        const matched = match[1] || match[0];
        if (start > last) {
          parts.push(chunk.slice(last, start).replace(/\r\n|\n|\r/g, '<br/>'));
        }
        parts.push(anchorHtml(normalizeHref(matched)));
        last = start + matched.length;
      }
      if (last < chunk.length) {
        parts.push(chunk.slice(last).replace(/\r\n|\n|\r/g, '<br/>'));
      }
      return parts.join('');
    })
    .join('');
}

/** Escape plain text and wrap http(s)/www URLs in <a href> anchors. */
export function linkifyPlainTextToHtml(text: string): string {
  const raw = String(text || '');
  if (!raw.trim()) return '';
  if (/<[a-z][\s\S]*>/i.test(raw)) {
    return linkifyBareUrlsInHtml(raw);
  }
  return linkifyPlainSegment(raw);
}

/** Full HTML email body wrapper for Graph / Gmail / rich mail clients. */
export function plainTextToEmailHtml(text: string): string {
  const raw = String(text || '');
  if (!raw.trim()) {
    return '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#202124;"></div>';
  }

  // Already a wrapped HTML email — still ensure bare URLs become anchors.
  if (/font-family:\s*Arial/i.test(raw) && /<div[\s>]/i.test(raw)) {
    return linkifyBareUrlsInHtml(raw);
  }

  const linked = linkifyPlainTextToHtml(raw);
  if (/^<div[\s>]/i.test(linked.trim())) return linked;
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
