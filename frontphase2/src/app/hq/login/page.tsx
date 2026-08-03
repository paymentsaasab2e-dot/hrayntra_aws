'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Lock, LogIn, Mail, Shield } from 'lucide-react';
import { apiLogin, formatAuthErrorMessage } from '../../../lib/api';
import { buildLoginDevicePayload } from '../../../lib/sessionAuth';
import { HQ_PLATFORM_EMAIL, isEmailAllowedForHq } from '../../../lib/hqAccess';
import { writeHqPermissionIds } from '../../../lib/hqNavPermissions';

export default function HqLoginPage() {
  const router = useRouter();
  const [email] = useState(HQ_PLATFORM_EMAIL);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail !== HQ_PLATFORM_EMAIL.toLowerCase()) {
      setError(`HQ access is restricted to ${HQ_PLATFORM_EMAIL}.`);
      return;
    }
    if (!password.trim()) {
      setError('Password is required.');
      return;
    }

    try {
      setLoading(true);
      const response = await apiLogin(normalizedEmail, password.trim(), await buildLoginDevicePayload());
      const loggedInEmail = String(response.data?.user?.email || normalizedEmail).trim().toLowerCase();

      if (!isEmailAllowedForHq(loggedInEmail)) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('currentUser');
          writeHqPermissionIds(null);
        }
        setError('This account is not authorized for Headquarters access.');
        return;
      }

      // Platform HQ login is unrestricted — clear any leftover team permission filter.
      writeHqPermissionIds(null);
      router.replace('/hq');
    } catch (err: unknown) {
      setError(formatAuthErrorMessage(err as { status?: number; message?: string }, 'Invalid email or password.'));
    } finally {
      setLoading(false);
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
            <p className="mt-1 text-sm font-medium text-slate-400">Platform operator access for tenant provisioning</p>
          </div>

          <div className="p-6">
            {error ? (
              <div className="mb-4 rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-2.5 text-sm text-red-300">
                {error}
              </div>
            ) : null}

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Platform email
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    readOnly
                    className="w-full cursor-not-allowed rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 pl-10 pr-4 text-sm text-slate-300"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter HQ password"
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/60 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
                  />
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
          Only {HQ_PLATFORM_EMAIL} may access the Headquarters console.
        </p>
      </div>
    </div>
  );
}
