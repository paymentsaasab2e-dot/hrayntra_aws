import { NextRequest, NextResponse } from 'next/server';

function backendApiRoot() {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:5001/api/v1';
  return raw.replace(/\/api\/v1\/?$/, '');
}

/** Proxy email "Allow login" to Phase 2 API (keeps tenant + avoids direct :5001 links in dev). */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const tenantDbName = request.nextUrl.searchParams.get('tenantDbName');
  if (!token) {
    return NextResponse.redirect(new URL('/session-transfer?status=error&message=Missing+token', request.url));
  }

  const qs = new URLSearchParams({ token });
  if (tenantDbName) qs.set('tenantDbName', tenantDbName);

  const backendUrl = `${backendApiRoot()}/api/v1/auth/session/transfer/email/approve?${qs.toString()}`;

  try {
    const res = await fetch(backendUrl, { redirect: 'manual' });
    const location = res.headers.get('location');
    if (location) {
      const target = new URL(location, request.url);
      return NextResponse.redirect(target, 302);
    }
    if (res.ok) {
      return NextResponse.redirect(
        new URL('/session-transfer?status=approved&message=Approval+Done', request.url),
        302,
      );
    }
  } catch (error) {
    console.error('[session-transfer] approve proxy failed:', error);
  }

  return NextResponse.redirect(
    new URL('/session-transfer?status=error&message=Could+not+reach+the+server', request.url),
  );
}
