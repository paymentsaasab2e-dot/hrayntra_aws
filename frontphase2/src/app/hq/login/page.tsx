'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Eye, EyeOff, Lock, LogIn, Shield, UserRound } from 'lucide-react';
import { apiHqLogin, formatAuthErrorMessage } from '../../../lib/api';
import { buildLoginDevicePayload, clearIntentionalLogout } from '../../../lib/sessionAuth';
import { isEmailAllowedForHq } from '../../../lib/hqAccess';
import { applyHqSessionAccess } from '../../../lib/hqNavPermissions';

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function readHqTeamMemberFromResponse(response: Awaited<ReturnType<typeof apiHqLogin>>) {
  const data = response.data as {
    hqPermissionIds?: string[];
    permissions?: string[];
    user?: {
      isHqTeamMember?: boolean;
      hqTeamMemberId?: string;
      email?: string;
    };
  };

  const isHqTeamMember = Boolean(data?.user?.isHqTeamMember || data?.user?.hqTeamMemberId);
  const hqPermissionIds = isHqTeamMember
    ? Array.isArray(data?.hqPermissionIds)
      ? data.hqPermissionIds.filter((id) => String(id).startsWith('hq_'))
      : Array.isArray(data?.permissions)
        ? data.permissions.filter((id) => String(id).startsWith('hq_'))
        : []
    : null;

  return { isHqTeamMember, hqPermissionIds };
}

export default function HqLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusHint, setStatusHint] = useState('');

  useEffect(() => {
    clearIntentionalLogout();
  }, []);

  const enterHq = (
    isHqTeamMember: boolean,
    hqPermissionIds?: string[] | null,
    session?: { hqTeamMemberId?: string; email?: string; loginId?: string },
  ) => {
    if (isHqTeamMember) {
      applyHqSessionAccess({
        isHqTeamMember: true,
        hqTeamMemberId: session?.hqTeamMemberId,
        hqPermissionIds: hqPermissionIds || [],
        email: session?.email,
        loginId: session?.loginId,
      });
    } else {
      applyHqSessionAccess({ isHqTeamMember: false, hqPermissionIds: null });
    }
    router.replace('/hq');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStatusHint('');

    const loginInput = identifier.trim();
    if (!loginInput) {
      setError('Enter your email or login ID.');
      return;
    }
    if (!password.trim()) {
      setError('Password is required.');
      return;
    }

    try {
      setLoading(true);
      const device = await buildLoginDevicePayload();

      let response = await apiHqLogin(loginInput, password.trim(), device);

      if (response.data?.duplicateSession) {
        setStatusHint('Ending leftover session on this machine…');
        response = await apiHqLogin(loginInput, password.trim(), {
          ...device,
          forceSessionTakeover: true,
        });
      }

      if (response.data?.duplicateSession) {
        setError(
          'Another session is still blocking login. Close other HQ tabs, wait a few seconds, then try again.',
        );
        return;
      }

      const loggedInEmail = String(response.data?.user?.email || '').trim().toLowerCase();
      const { isHqTeamMember, hqPermissionIds } = readHqTeamMemberFromResponse(response);

      const allowed =
        isHqTeamMember ||
        (loggedInEmail && isEmailAllowedForHq(loggedInEmail)) ||
        (looksLikeEmail(loginInput) && isEmailAllowedForHq(loginInput.toLowerCase()));

      if (!allowed) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('currentUser');
          applyHqSessionAccess({ isHqTeamMember: false, hqPermissionIds: null });
        }
        setError('This account is not authorized for Headquarters access.');
        return;
      }

      if (typeof window !== 'undefined' && !localStorage.getItem('accessToken')) {
        setError('Login succeeded but no token was stored. Please try again.');
        return;
      }

      enterHq(isHqTeamMember, hqPermissionIds, {
        hqTeamMemberId: response.data?.user?.hqTeamMemberId,
        email: loggedInEmail || response.data?.user?.email,
        loginId: response.data?.user?.loginId,
      });
    } catch (err: unknown) {
      setError(formatAuthErrorMessage(err as { status?: number; message?: string }, 'Invalid email/login ID or password.'));
    } finally {
      setLoading(false);
      setStatusHint('');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_rgba(15,118,110,0.18),_transparent_50%),linear-gradient(160deg,#020617_0%,#0f172a_45%,#134e4a_100%)] p-4">
      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 shadow-2xl shadow-black/50 backdrop-blur-md">
          <div className="border-b border-white/10 bg-white/[0.03] px-6 py-5 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/15 text-teal-300 ring-1 ring-teal-400/30">
              <Shield size={24} strokeWidth={2} />
            </div>
            <h1 className="hq-display text-xl font-semibold text-white">Headquarters login</h1>
            <p className="mt-1 text-sm font-medium text-slate-400">Platform operator and HQ team access</p>
          </div>

          <div className="p-6">
            {error ? (
              <div className="mb-4 rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-2.5 text-sm text-red-300">
                {error}
              </div>
            ) : null}
            {statusHint ? (
              <div className="mb-4 rounded-xl border border-teal-500/30 bg-teal-950/40 px-3 py-2.5 text-sm text-teal-200">
                {statusHint}
              </div>
            ) : null}

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" data-writing-assist="off">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Email or Login ID
                </label>
                <div className="relative">
                  <UserRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="you@company.com or login.id"
                    autoComplete="username"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/60 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/60 py-2.5 pl-10 pr-11 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-500 transition hover:text-slate-300"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-900/30 transition-colors hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogIn size={16} />
                {loading ? 'Signing in…' : 'Sign in to HQ'}
              </button>
            </form>

            <div className="mt-5 flex flex-col items-center gap-2 border-t border-slate-800 pt-4 text-center text-xs text-slate-500">
              <Link href="/login" className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300">
                <Building2 size={14} />
                Tenant / recruiter login
              </Link>
            </div>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-slate-600">
          HQ team members: sign in with your invite email or login ID and password.
        </p>
      </div>
    </div>
  );
}
