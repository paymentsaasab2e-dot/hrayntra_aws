import { NextRequest, NextResponse } from 'next/server';

const PRODUCTION_API_ROOT = 'https://api2.hryantra.com';

function isLoopbackHost(hostname: string): boolean {
  const host = String(hostname || '')
    .toLowerCase()
    .replace(/^\[|\]$/g, '');
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

/** Prefer the public host the user actually hit (email link), not a misconfigured FRONTEND_URL. */
export function publicRequestOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || request.headers.get('host') || request.nextUrl.host;
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const proto =
    forwardedProto ||
    (request.nextUrl.protocol ? request.nextUrl.protocol.replace(':', '') : '') ||
    (isLoopbackHost(host) ? 'http' : 'https');
  return `${proto}://${host}`.replace(/\/$/, '');
}

function isLoopbackApiUrl(value: string): boolean {
  return /localhost|127\.0\.0\.1|\[::1\]|::1/i.test(String(value || ''));
}

/**
 * Resolve Phase 2 API origin for server-side proxies (email approve/reject, client-review assets).
 * Never call localhost from a production host — even if BACKEND_INTERNAL_URL is mis-set to loopback.
 */
export function backendApiRoot(request: NextRequest): string {
  const requestHost =
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    request.headers.get('host') ||
    request.nextUrl.host ||
    '';
  const requestIsLocal = isLoopbackHost(requestHost.split(':')[0] || requestHost);

  const internal = process.env.BACKEND_INTERNAL_URL?.trim();
  if (internal && !(isLoopbackApiUrl(internal) && !requestIsLocal)) {
    return internal.replace(/\/api\/v1\/?$/i, '').replace(/\/$/, '');
  }

  const publicApi = process.env.NEXT_PUBLIC_API_URL?.trim() || '';
  const publicIsLocal = !publicApi || isLoopbackApiUrl(publicApi);

  if (!requestIsLocal && publicIsLocal) {
    return PRODUCTION_API_ROOT;
  }

  const raw = publicApi || (requestIsLocal ? 'http://localhost:5001/api/v1' : `${PRODUCTION_API_ROOT}/api/v1`);
  return raw.replace(/\/api\/v1\/?$/i, '').replace(/\/$/, '');
}

/** Full `/api/v1` base for server-side fetch to the Phase 2 backend. */
export function backendApiBase(request: NextRequest): string {
  return `${backendApiRoot(request)}/api/v1`;
}

export function redirectSessionTransferPage(
  request: NextRequest,
  status: string,
  message: string,
): NextResponse {
  const url = new URL('/session-transfer', publicRequestOrigin(request));
  if (status) url.searchParams.set('status', status);
  if (message) url.searchParams.set('message', message);
  return NextResponse.redirect(url, 302);
}

/** Keep path/query from backend Location but always land on this request's public origin. */
export function redirectFromBackendLocation(request: NextRequest, location: string): NextResponse {
  try {
    const parsed = new URL(location, request.url);
    const target = new URL(parsed.pathname + parsed.search, publicRequestOrigin(request));
    return NextResponse.redirect(target, 302);
  } catch {
    return redirectSessionTransferPage(request, 'error', 'Invalid redirect from server');
  }
}
