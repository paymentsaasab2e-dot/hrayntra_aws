'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, LogIn, User } from 'lucide-react';
import { apiLogin, formatAuthErrorMessage, getAccessToken, syncTenantDbName } from '../../lib/api';
import { buildLoginDevicePayload } from '../../lib/sessionAuth';
import { LoginSessionFlow } from '../../components/session/LoginSessionFlow';
import { TrialExpiredLoginPrompt } from '../../components/trial/TrialExpiredLoginPrompt';
import type { ActiveSessionView } from '../../lib/sessionAuth';

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
      const target = redirectParam && redirectParam !== '/leads' ? redirectParam : '/dashboard';
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
      const redirectTo = redirectParam && redirectParam !== '/leads' ? redirectParam : '/dashboard';
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

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xl">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            <h2 className="text-base font-semibold text-slate-900">Please wait</h2>
            <p className="mt-2 text-sm text-slate-600">
              {loadingMessage || 'Processing your request...'}
            </p>
          </div>
        </div>
      )}
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h1 className="text-xl font-bold text-slate-900 text-center">Log in</h1>
            <p className="text-sm text-slate-500 text-center mt-1">Enter your credentials</p>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
                {error}
              </div>
            )}
            {message && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-sm text-emerald-700">
                {message}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  User ID
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="Enter your user ID"
                    autoComplete="username"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Password
                  </label>
                  <Link
                    href={forgotPasswordHref}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                  >
                    {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                <LogIn size={16} /> {loading ? 'Logging in...' : 'Log in'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
