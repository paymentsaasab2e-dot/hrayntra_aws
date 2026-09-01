export type OrgProductSide = 'crm' | 'recruitment' | 'all';

export function orgSideFromPathname(pathname?: string): OrgProductSide {
  const raw = String(pathname || (typeof window !== 'undefined' ? window.location.pathname : '') || '');
  const p = `/${raw.toLowerCase().replace(/^\/+/, '')}`;
  if (p.startsWith('/hq')) return 'all';
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
