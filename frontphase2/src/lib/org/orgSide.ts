export type OrgProductSide = 'crm' | 'recruitment' | 'all';

export function orgSideFromPathname(pathname?: string, search?: string): OrgProductSide {
  const raw = String(pathname || (typeof window !== 'undefined' ? window.location.pathname : '') || '');
  const qs = String(
    search ?? (typeof window !== 'undefined' ? window.location.search : '') ?? '',
  );
  const p = `/${raw.toLowerCase().replace(/^\/+/, '')}`;
  if (p.startsWith('/hq')) return 'all';

  // Recruitment Clients lives under /client?scope=recruitment — not CRM.
  if (p.startsWith('/client') && /(?:^|[?&])scope=recruitment(?:&|$)/i.test(qs)) {
    return 'recruitment';
  }

  if (
    p.startsWith('/leads') ||
    p.startsWith('/client') ||
    p.startsWith('/contacts') ||
    p.startsWith('/dashboard')
  ) {
    return 'crm';
  }
  if (
    p.startsWith('/job') ||
    p.startsWith('/candidate') ||
    p.startsWith('/interview') ||
    p.startsWith('/placement') ||
    p.startsWith('/pipeline') ||
    p.startsWith('/match') ||
    p.startsWith('/recruitment')
  ) {
    return 'recruitment';
  }
  return 'all';
}
