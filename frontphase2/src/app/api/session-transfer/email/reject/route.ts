import { NextRequest, NextResponse } from 'next/server';

function backendApiRoot() {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:5001/api/v1';
  return raw.replace(/\/api\/v1\/?$/, '');
}

/** Proxy email "Reject" to Phase 2 API. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const tenantDbName = request.nextUrl.searchParams.get('tenantDbName');
  if (!token) {
    return NextResponse.redirect(new URL('/session-transfer?status=error&message=Missing+token', request.url));
  }

  const qs = new URLSearchParams({ token });
  if (tenantDbName) qs.set('tenantDbName', tenantDbName);

  const backendUrl = `${backendApiRoot()}/api/v1/auth/session/transfer/email/reject?${qs.toString()}`;

  try {
    const res = await fetch(backendUrl, { redirect: 'manual' });
    const location = res.headers.get('location');
    if (location) {
      const target = new URL(location, request.url);
      return NextResponse.redirect(target, 302);
    }
  } catch (error) {
    console.error('[session-transfer] reject proxy failed:', error);
  }

  return NextResponse.redirect(
    new URL('/session-transfer?status=error&message=Could+not+reach+the+server', request.url),
  );
}
