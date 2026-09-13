import { NextRequest } from 'next/server';
import {
  backendApiRoot,
  redirectFromBackendLocation,
  redirectSessionTransferPage,
} from '@/lib/sessionTransferEmailProxy';

/** Proxy email "Allow login" to Phase 2 API (keeps tenant + avoids direct :5001 links in dev). */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const tenantDbName = request.nextUrl.searchParams.get('tenantDbName');
  if (!token) {
    return redirectSessionTransferPage(request, 'error', 'Missing token');
  }

  const qs = new URLSearchParams({ token });
  if (tenantDbName) qs.set('tenantDbName', tenantDbName);

  const backendUrl = `${backendApiRoot(request)}/api/v1/auth/session/transfer/email/approve?${qs.toString()}`;

  try {
    const res = await fetch(backendUrl, { redirect: 'manual', cache: 'no-store' });
    const location = res.headers.get('location');
    if (location) {
      return redirectFromBackendLocation(request, location);
    }
    if (res.ok) {
      return redirectSessionTransferPage(request, 'approved', 'Approval Done');
    }
    console.error('[session-transfer] approve upstream status', res.status, backendUrl);
  } catch (error) {
    console.error('[session-transfer] approve proxy failed:', error, backendUrl);
  }

  return redirectSessionTransferPage(request, 'error', 'Could not reach the server');
}
