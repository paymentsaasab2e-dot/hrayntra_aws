import { NextRequest, NextResponse } from 'next/server';

// Routes that don't require authentication (/hq requires login + platform allowlist — see app/hq/layout.tsx)
const PUBLIC_ROUTES = ['/login', '/hq/login', '/reset-password', '/api', '/client-review', '/apply'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow all public routes and API proxy routes through without any auth check
  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );

  if (isPublic) {
    return NextResponse.next();
  }

  // Check for auth token in cookies (set by the login page)
  const token = request.cookies.get('accessToken')?.value;

  if (!token) {
    if (pathname === '/hq' || pathname.startsWith('/hq/')) {
      if (pathname === '/hq/login') {
        return NextResponse.next();
      }
      return NextResponse.redirect(new URL('/hq/login', request.url));
    }
    // Preserve the original destination so login can redirect back
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
