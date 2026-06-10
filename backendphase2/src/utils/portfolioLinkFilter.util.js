/**
 * Drop placeholder / malformed portfolio URLs (e.g. https://B.com from CV noise).
 */

function parsePortfolioHost(url = '') {
  const raw = String(url || '').trim();
  if (!raw) return null;
  let href = raw;
  if (!/^https?:\/\//i.test(href)) {
    href = `https://${href.replace(/^\/+/, '')}`;
  }
  try {
    const u = new URL(href);
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

function isJunkPortfolioHost(host) {
  if (!host) return true;

  const blocked = new Set([
    'b.com',
    'b.net',
    'b.org',
    'b.io',
    'b.co',
    'example.com',
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
  ]);
  if (blocked.has(host)) return true;

  const parts = host.split('.').filter(Boolean);
  if (parts.length < 2) return true;

  const registrable = parts.length === 2 ? parts[0] : parts[parts.length - 2];
  if (!registrable || registrable.length < 2) return true;
  if (/^[a-z]$/i.test(registrable)) return true;

  return false;
}

export function isJunkPortfolioUrl(url = '') {
  const raw = String(url || '').trim();
  if (!raw) return true;
  if (/^(https?:\/\/)?(www\.)?b\.com\/?$/i.test(raw.replace(/\/+$/, ''))) return true;
  if (/\/verification\//i.test(raw) || /\/verify\//i.test(raw)) return true;
  const host = parsePortfolioHost(raw);
  if (isJunkPortfolioHost(host)) return true;
  if (host && /\.me$/i.test(host)) {
    const label = host.replace(/\.me$/i, '');
    if (label.length <= 8 && !label.includes('-')) return true;
  }
  return false;
}

export function filterPortfolioLinks(links) {
  if (!Array.isArray(links)) return [];
  return links.filter((link) => {
    const url =
      typeof link === 'string'
        ? link
        : link && typeof link === 'object'
          ? link.url || link.link
          : '';
    return url && !isJunkPortfolioUrl(url);
  });
}

export function normalizePortfolioLinksForCommon(links) {
  if (!Array.isArray(links)) return null;
  const cleaned = filterPortfolioLinks(links)
    .map((link) => ({
      linkType: link?.linkType || link?.type || 'Portfolio',
      type: link?.linkType || link?.type || 'Portfolio',
      url: String(link?.url || link?.link || '').trim(),
      title: link?.title || null,
      description: link?.description || null,
    }))
    .filter((link) => link.url);
  return cleaned.length ? cleaned : null;
}
