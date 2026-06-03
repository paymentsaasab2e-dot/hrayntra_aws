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

  const blocked = new Set(['b.com', 'b.net', 'b.org', 'b.io', 'b.co']);
  if (blocked.has(host)) return true;

  const parts = host.split('.').filter(Boolean);
  if (parts.length < 2) return true;

  const registrable =
    parts.length === 2 ? parts[0] : parts[parts.length - 2];
  if (!registrable || registrable.length < 2) return true;
  if (/^[a-z]$/i.test(registrable)) return true;

  return false;
}

function isJunkPortfolioUrl(url = '') {
  const raw = String(url || '').trim();
  if (!raw) return true;
  if (/^(https?:\/\/)?(www\.)?b\.com\/?$/i.test(raw.replace(/\/+$/, ''))) return true;
  const host = parsePortfolioHost(raw);
  return isJunkPortfolioHost(host);
}

function filterPortfolioLinks(links) {
  if (!Array.isArray(links)) return [];
  return links.filter((link) => {
    const url =
      typeof link === 'string'
        ? link
        : link && typeof link === 'object'
          ? link.url || link.link
          : '';
    return !isJunkPortfolioUrl(url);
  });
}

module.exports = {
  isJunkPortfolioUrl,
  filterPortfolioLinks,
};
