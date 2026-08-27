'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { DM_Sans } from 'next/font/google';
import { apiLogin, apiConsumeImpersonationToken, formatAuthErrorMessage, getAccessToken, syncTenantDbName } from '../../lib/api';
import { buildLoginDevicePayload, clearIntentionalLogout, finalizeAuthAfterTokens } from '../../lib/sessionAuth';
import { LoginSessionFlow } from '../../components/session/LoginSessionFlow';
import { TrialExpiredLoginPrompt } from '../../components/trial/TrialExpiredLoginPrompt';
import { AuthBrandLogo } from '../../components/auth/AuthBrandLogo';
import type { ActiveSessionView } from '../../lib/sessionAuth';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

function resolveMarketingBase() {
  const fromEnv = process.env.NEXT_PUBLIC_MARKETING_SITE_URL?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  // Use NODE_ENV (same on SSR + client) — never `window`, which causes hydration mismatches.
  if (process.env.NODE_ENV === 'development') return 'http://localhost:3000';
  return 'https://hryantra.com';
}

const MARKETING_BASE = resolveMarketingBase();
const MARKETING_DEMO_URL = `${MARKETING_BASE}/en/employers/request-demo`;

/** Form panel + floating cards */
const LOGIN_CREAM_BG = '#FFFFFF';
/** Brand accents behind the login card */
const BRAND_ORANGE = '#FC9620';
const BRAND_ORANGE_DEEP = '#E8770E';
const BRAND_BLUE = '#28A8E1';
const BRAND_BLUE_DEEP = '#08428C';

/**
 * Safe post-login destination. Broken try-free handoffs used to produce
 * `/leads/login` (404). Always prefer the module-aware Phase 2 dashboard.
 */
function resolvePostLoginPath(raw: string | null | undefined): string {
  const path = String(raw || '').trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) {
    return '/dashboard';
  }
  const lower = path.toLowerCase();
  if (
    lower === '/leads' ||
    lower === '/login' ||
    lower.startsWith('/leads/login') ||
    lower.includes('/login') ||
    lower.startsWith('/hq')
  ) {
    return '/dashboard';
  }
  return path;
}

export default function LoginPage() {
  const router = useRouter();

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [forgotPasswordHref, setForgotPasswordHref] = useState('/forgot-password');
  const [duplicateSession, setDuplicateSession] = useState<{
    identifier: string;
    password: string;
    activeSession: ActiveSessionView | null;
  } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    clearIntentionalLogout();
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');
    if (redirect === '/hq' || redirect?.startsWith('/hq/')) {
      router.replace('/hq/login');
      return;
    }
    const tenant = params.get('tenantDbName');
    if (tenant) {
      syncTenantDbName(tenant);
    }
    const sessionMsg = params.get('session');
    if (sessionMsg) {
      setMessage(sessionMsg);
    }

    // HQ support access link (one-time token in hash).
    const hash = window.location.hash.replace(/^#/, '');
    if (hash.startsWith('hqImpersonation=')) {
      const consumeHqAccess = async () => {
        try {
          setLoading(true);
          setLoadingMessage('Opening tenant account...');
          const token = decodeURIComponent(hash.slice('hqImpersonation='.length));
          const device = await buildLoginDevicePayload();
          const response = await apiConsumeImpersonationToken({ token, ...device });
          const data = response.data;
          if (!data?.accessToken) {
            throw new Error('Unable to open tenant account');
          }
          await finalizeAuthAfterTokens({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            tenantDbName: data.tenantDbName,
            requirePasswordReset: data.requirePasswordReset,
          });
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
          window.location.href = '/dashboard';
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Invalid or expired access link';
          setError(message);
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        } finally {
          setLoading(false);
          setLoadingMessage('');
        }
      };
      void consumeHqAccess();
      return;
    }

    // Handoff from marketing try-free login (tokens in hash, never query string).
    if (hash.startsWith('tryFreeHandoff=')) {
      try {
        const encoded = decodeURIComponent(hash.slice('tryFreeHandoff='.length));
        const handoff = new URLSearchParams(encoded);
        const accessToken = handoff.get('accessToken');
        const refreshToken = handoff.get('refreshToken');
        const tenantDbName = handoff.get('tenantDbName');
        if (accessToken) {
          localStorage.setItem('accessToken', accessToken);
          if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
          if (tenantDbName) syncTenantDbName(tenantDbName);
          localStorage.removeItem('requirePasswordReset');
          // Set auth cookies so middleware recognizes the session on next navigation
          document.cookie = `accessToken=${encodeURIComponent(accessToken)}; Path=/; SameSite=Lax`;
          if (refreshToken) {
            document.cookie = `refreshToken=${encodeURIComponent(refreshToken)}; Path=/; SameSite=Lax`;
          }
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
          window.location.href = '/dashboard';
          return;
        }
      } catch {
        /* fall through to normal login */
      }
    }

    const forgotQs = new URLSearchParams();
    if (redirect) forgotQs.set('redirect', redirect);
    if (tenant) forgotQs.set('tenantDbName', tenant);
    const forgotSuffix = forgotQs.toString() ? `?${forgotQs.toString()}` : '';
    setForgotPasswordHref(`/forgot-password${forgotSuffix}`);
  }, [router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const goToAppIfAuthenticated = () => {
      if (!getAccessToken()) return;
      const redirectParam = new URLSearchParams(window.location.search).get('redirect');
      const target = resolvePostLoginPath(redirectParam);
      router.replace(target);
    };

    goToAppIfAuthenticated();

    const onStorage = (event: StorageEvent) => {
      if (event.key === 'accessToken' && event.newValue) {
        goToAppIfAuthenticated();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [router]);

  const redirectAfterLogin = (requirePasswordReset: boolean, isSuperAdmin: boolean) => {
    setTimeout(() => {
      if (requirePasswordReset && !isSuperAdmin) {
        router.push('/reset-password');
        return;
      }
      if (isSuperAdmin && requirePasswordReset) {
        localStorage.removeItem('requirePasswordReset');
        const currentUser = localStorage.getItem('currentUser');
        if (currentUser) {
          const user = JSON.parse(currentUser);
          user.requirePasswordReset = false;
          localStorage.setItem('currentUser', JSON.stringify(user));
        }
      }
      const redirectParam = new URLSearchParams(window.location.search).get('redirect');
      const redirectTo = resolvePostLoginPath(redirectParam);
      window.location.href = redirectTo;
    }, 800);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!loginEmail.trim() || !loginPassword.trim()) {
      setError('User ID and password are required.');
      return;
    }

    try {
      setLoading(true);
      setLoadingMessage('Validating credentials...');
      const response = await apiLogin(
        loginEmail.trim(),
        loginPassword.trim(),
        await buildLoginDevicePayload(),
      );

      if (response.data?.duplicateSession) {
        if (response.data.tenantDbName) {
          syncTenantDbName(response.data.tenantDbName);
        }
        setDuplicateSession({
          identifier: loginEmail.trim(),
          password: loginPassword.trim(),
          activeSession: response.data.activeSession || null,
        });
        setLoading(false);
        setLoadingMessage('');
        return;
      }

      const tenantProvisioningStatus = response.data?.tenantProvisioningStatus;
      if (tenantProvisioningStatus === 'CREATED') {
        setLoadingMessage('Creating your workspace database...');
      } else {
        setLoadingMessage('Preparing your workspace...');
      }

      if (typeof window !== 'undefined') {
        const storedToken = localStorage.getItem('accessToken');
        if (!storedToken) {
          throw new Error('Failed to store authentication token. Please try again.');
        }
      }

      setMessage('Logged in successfully! Redirecting...');

      const requirePasswordReset = response.data?.requirePasswordReset || false;
      const roleName = String(response.data?.user?.roleName || '')
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, ' ');
      const roleCode = String(response.data?.user?.role || '')
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, ' ');

      const isSuperAdmin = roleName === 'super admin' || roleCode === 'super admin';

      redirectAfterLogin(requirePasswordReset, isSuperAdmin);
    } catch (err: unknown) {
      setError(formatAuthErrorMessage(err as { message?: string }, 'Failed to login. Please try again.'));
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const marketingDemoUrl = MARKETING_DEMO_URL;

  return (
    <div
      className={`${dmSans.className} relative flex h-[100dvh] max-h-[100dvh] items-center justify-center overflow-hidden px-3 py-3 sm:px-5 sm:py-4`}
      style={{
        backgroundColor: '#FFFFFF',
        backgroundImage: `
          radial-gradient(ellipse 70% 55% at 12% 18%, ${BRAND_ORANGE}33 0%, transparent 58%),
          radial-gradient(ellipse 65% 50% at 88% 82%, ${BRAND_BLUE}2e 0%, transparent 55%),
          radial-gradient(ellipse 45% 40% at 78% 12%, ${BRAND_BLUE_DEEP}18 0%, transparent 50%),
          radial-gradient(ellipse 40% 35% at 20% 88%, ${BRAND_ORANGE_DEEP}22 0%, transparent 50%),
          linear-gradient(135deg, #FFFFFF 0%, #F7FBFE 48%, #FFF8F0 100%)
        `,
      }}
    >
      <Suspense fallback={null}>
        <TrialExpiredLoginPrompt />
      </Suspense>

      {duplicateSession ? (
        <LoginSessionFlow
          identifier={duplicateSession.identifier}
          password={duplicateSession.password}
          activeSession={duplicateSession.activeSession}
          onCancel={() => {
            setDuplicateSession(null);
            setLoginPassword('');
          }}
          onSuccess={({ requirePasswordReset }) => {
            setDuplicateSession(null);
            setMessage('Logged in successfully! Redirecting...');
            const raw = localStorage.getItem('currentUser');
            let isSuperAdmin = false;
            if (raw) {
              try {
                const user = JSON.parse(raw);
                const roleName = String(user?.roleName || '')
                  .trim()
                  .toLowerCase()
                  .replace(/[\s_-]+/g, ' ');
                const roleCode = String(user?.role || '')
                  .trim()
                  .toLowerCase()
                  .replace(/[\s_-]+/g, ' ');
                isSuperAdmin = roleName === 'super admin' || roleCode === 'super admin';
              } catch {
                /* ignore */
              }
            }
            redirectAfterLogin(requirePasswordReset, isSuperAdmin);
          }}
        />
      ) : null}

      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-white/20 bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-amber-100 border-t-amber-400" />
            <h2 className="text-base font-semibold text-slate-900">Please wait</h2>
            <p className="mt-2 text-sm text-slate-600">{loadingMessage || 'Processing your request...'}</p>
          </div>
        </div>
      )}

      <div
        className="relative z-10 grid h-auto max-h-[min(560px,calc(100dvh-1.5rem))] w-full max-w-[880px] overflow-hidden rounded-[1.5rem] border border-slate-200/80 shadow-[0_28px_70px_-28px_rgba(8,66,140,0.28)] lg:h-[min(520px,calc(100dvh-2rem))] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]"
        style={{ backgroundColor: LOGIN_CREAM_BG }}
      >
        {/* Left — form */}
        <div
          className="relative flex flex-col justify-between px-6 py-5 sm:px-8 sm:py-6 lg:px-9 lg:py-7"
          style={{ backgroundColor: LOGIN_CREAM_BG }}
        >
          <div className="inline-flex w-fit items-center rounded-full border border-black/5 bg-white/90 px-3 py-1.5 shadow-sm backdrop-blur">
            <AuthBrandLogo />
          </div>

          <div className="mt-5">
            <h1 className="text-[1.65rem] font-bold leading-tight tracking-tight text-[#1c1c1c] sm:text-[1.85rem]">
              Log in
            </h1>
            <p className="mt-1 text-[13px] text-slate-500">Sign in to your employer workspace</p>
          </div>

          <div className="mt-5">
            {error && (
              <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}
            {message && (
              <div className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                {message}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-3.5" data-writing-assist="off">
              <div>
                <label htmlFor="login-user-id" className="mb-1.5 block text-[13px] font-medium text-slate-600">
                  User ID
                </label>
                <input
                  id="login-user-id"
                  type="text"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="Enter your user ID or email"
                  autoComplete="username"
                  className="w-full rounded-full border border-transparent bg-white px-4 py-2.5 text-[14px] text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none ring-1 ring-slate-200/80 placeholder:text-slate-400 focus:ring-2 focus:ring-[#28A8E1]/35"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <label htmlFor="login-password" className="block text-[13px] font-medium text-slate-600">
                    Password
                  </label>
                  <Link
                    href={forgotPasswordHref}
                    className="text-[11px] font-semibold text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    className="w-full rounded-full border border-transparent bg-white px-4 py-2.5 pr-11 text-[14px] text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none ring-1 ring-slate-200/80 placeholder:text-slate-400 focus:ring-2 focus:ring-[#28A8E1]/35"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:text-slate-700"
                    aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                  >
                    {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-0.5 w-full rounded-full px-4 py-2.5 text-[14px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(232,119,14,0.85)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  backgroundImage: `linear-gradient(90deg, ${BRAND_ORANGE_DEEP} 0%, ${BRAND_ORANGE} 100%)`,
                }}
              >
                {loading ? 'Signing in…' : 'Submit'}
              </button>
            </form>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-[12px] text-slate-500">
            <p>
              Need access?{' '}
              <a href={marketingDemoUrl} className="font-semibold text-slate-900 underline-offset-2 hover:underline">
                Request a demo
              </a>
            </p>
            <a
              href="https://www.hryantra.com/en/privacypolicy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-slate-500 underline underline-offset-2 hover:text-slate-800"
            >
              Terms &amp; Conditions
            </a>
          </div>
        </div>

        {/* Right — visual panel */}
        <div className="relative hidden overflow-hidden lg:block">
          <img
            src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80"
            alt="Team collaborating in the workplace"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />

          <div
            className="absolute left-4 top-5 max-w-[190px] rounded-xl px-3 py-2.5 shadow-lg ring-1 ring-orange-200/60"
            style={{
              backgroundColor: '#FFFFFF',
              borderLeft: `3px solid ${BRAND_ORANGE}`,
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[12px] font-semibold leading-snug text-[#1c1c1c]">Pipeline review with hiring team</p>
              <span
                className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] text-white"
                style={{ backgroundColor: BRAND_BLUE }}
              >
                ↗
              </span>
            </div>
            <p className="mt-1.5 text-[10px] font-medium text-[#1c1c1c]/70">04:00pm — 05:00pm</p>
          </div>

          <div
            className="absolute left-1/2 top-[42%] w-[82%] -translate-x-1/2 rounded-xl border border-white/70 px-2 py-2 shadow-xl backdrop-blur-md"
            style={{ backgroundColor: 'rgba(255,255,255,0.82)' }}
          >
            <div className="grid grid-cols-7 gap-0.5 text-center text-[#1c1c1c]">
              {[
                ['Sun', '22'],
                ['Mon', '23'],
                ['Tue', '24'],
                ['Wed', '25'],
                ['Thu', '26'],
                ['Fri', '27'],
                ['Sat', '28'],
              ].map(([day, date], idx) => (
                <div
                  key={day}
                  className={`rounded-lg px-0.5 py-1.5 ${idx === 3 ? 'text-white shadow-sm' : ''}`}
                  style={idx === 3 ? { backgroundColor: BRAND_BLUE_DEEP } : undefined}
                >
                  <div className="text-[9px] font-medium opacity-70">{day}</div>
                  <div className="mt-0.5 text-[12px] font-semibold">{date}</div>
                </div>
              ))}
            </div>
          </div>

          <div
            className="absolute bottom-6 left-4 max-w-[210px] rounded-xl bg-white px-3 py-2.5 shadow-xl ring-1 ring-blue-100/80"
            style={{ borderLeft: `3px solid ${BRAND_BLUE}` }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[12px] font-semibold text-slate-900">Daily standup</p>
                <div className="mt-1.5 flex -space-x-1.5">
                  {['A', 'B', 'C', 'D'].map((letter, i) => (
                    <span
                      key={letter}
                      className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[9px] font-bold text-white"
                      style={{
                        backgroundColor: ['#f59e0b', '#0ea5e9', '#10b981', '#8b5cf6'][i],
                        zIndex: 4 - i,
                      }}
                    >
                      {letter}
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-[10px] font-medium text-slate-500">12:00–01:00</p>
            </div>
          </div>

          <div className="absolute right-7 top-[26%] flex flex-col gap-2.5">
            <span className="h-9 w-9 overflow-hidden rounded-full border-2 border-white shadow-lg">
              <img
                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80"
                alt=""
                className="h-full w-full object-cover"
              />
            </span>
            <span className="ml-5 h-9 w-9 overflow-hidden rounded-full border-2 border-white shadow-lg">
              <img
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80"
                alt=""
                className="h-full w-full object-cover"
              />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
