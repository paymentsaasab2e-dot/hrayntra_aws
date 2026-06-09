/** Drop placeholder / malformed portfolio URLs (e.g. https://B.com from CV noise). */

function parsePortfolioHost(url = ''): string | null {
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

function isJunkPortfolioHost(host: string | null): boolean {
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

export function isJunkPortfolioUrl(url = ''): boolean {
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

type PortfolioLinkLike = {
  url?: string | null;
  link?: string | null;
  linkType?: string | null;
  type?: string | null;
  title?: string | null;
};

export function filterPortfolioLinks<T extends PortfolioLinkLike | string>(links: T[] | null | undefined): T[] {
  if (!Array.isArray(links)) return [];
  return links.filter((link) => {
    const url =
      typeof link === 'string'
        ? link
        : String(link?.url || link?.link || '').trim();
    return url && !isJunkPortfolioUrl(url);
  });
}

export type PortfolioLinkRow = {
  type?: string;
  label?: string;
  url?: string;
};

export function normalizePortfolioLinkRow(link: PortfolioLinkLike): PortfolioLinkRow {
  const url = String(link?.url || link?.link || '').trim();
  const type = String(link?.linkType || link?.type || '').trim();
  const title = String(link?.title || '').trim();
  return {
    type: type || undefined,
    label: title || type || undefined,
    url: url || undefined,
  };
}

export function dedupePortfolioLinksByUrl(links: PortfolioLinkRow[]): PortfolioLinkRow[] {
  const seen = new Set<string>();
  const out: PortfolioLinkRow[] = [];
  for (const link of links) {
    const url = String(link.url || '').trim().toLowerCase();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(link);
  }
  return out;
}
