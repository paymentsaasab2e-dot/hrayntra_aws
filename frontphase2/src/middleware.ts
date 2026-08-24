import { NextRequest, NextResponse } from 'next/server';

// Routes that don't require authentication (/hq requires login + platform allowlist — see app/hq/layout.tsx)
const PUBLIC_ROUTES = [
  '/login',
  '/hq/login',
  '/forgot-password',
  '/reset-password',
  '/api',
  '/client-review',
  '/apply',
  '/lead-form',
  '/session-transfer',
];

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
    // Broken try-free URLs used to create /leads/login — send to real login → dashboard.
    if (pathname === '/leads/login' || pathname.startsWith('/leads/login/')) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', '/dashboard');
      return NextResponse.redirect(loginUrl);
    }
    // Preserve the original destination so login can redirect back
    const loginUrl = new URL('/login', request.url);
    const returnPath = `${pathname}${request.nextUrl.search}`;
    loginUrl.searchParams.set('redirect', returnPath);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === '/leads/login' || pathname.startsWith('/leads/login/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico and other public/ root assets (png, svg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|eot|mp4|webm|pdf)).*)',
  ],
};
