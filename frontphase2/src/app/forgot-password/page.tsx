'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff, KeyRound, Lock, User } from 'lucide-react';
import {
  apiForgotPassword,
  apiResetPasswordWithOtp,
  formatAuthErrorMessage,
  syncTenantDbName,
} from '../../lib/api';

type Step = 'request' | 'reset';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('request');
  const [identifier, setIdentifier] = useState('');
  const [resolvedEmail, setResolvedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginHref, setLoginHref] = useState('/login');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tenant = params.get('tenantDbName');
    if (tenant) {
      syncTenantDbName(tenant);
    }
    const redirect = params.get('redirect');
    const qs = new URLSearchParams();
    if (redirect) qs.set('redirect', redirect);
    if (tenant) qs.set('tenantDbName', tenant);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    setLoginHref(`/login${suffix}`);
  }, []);

  const resetIdentifier = identifier.trim();

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!resetIdentifier) {
      setError('User ID is required.');
      return;
    }

    try {
      setLoading(true);
      const res = await apiForgotPassword(resetIdentifier);
      const emailHint = res.data?.email;
      if (emailHint) {
        setResolvedEmail(emailHint);
      }
      setMessage(
        res.message ||
          'If the account exists, a verification code has been sent to the registered email.'
      );
      setStep('reset');
    } catch (err: unknown) {
      setError(formatAuthErrorMessage(err as { message?: string }, 'Failed to send verification code.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!otp.trim()) {
      setError('Verification code is required.');
      return;
    }
    const nextPassword = newPassword.trim();
    const confirm = confirmPassword.trim();
    if (nextPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (nextPassword !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      const resetKey = resolvedEmail || resetIdentifier;
      await apiResetPasswordWithOtp(resetKey, otp.trim(), nextPassword);
      setMessage('Password reset successfully. Redirecting to login...');
      setTimeout(() => {
        router.push(loginHref);
      }, 1200);
    } catch (err: unknown) {
      setError(formatAuthErrorMessage(err as { message?: string }, 'Failed to reset password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h1 className="text-xl font-bold text-slate-900 text-center">
              {step === 'request' ? 'Reset password' : 'Set new password'}
            </h1>
            <p className="text-sm text-slate-500 text-center mt-1">
              {step === 'request'
                ? 'Enter your user ID to receive a verification code'
                : resolvedEmail
                  ? `Enter the code sent to ${resolvedEmail}`
                  : 'Enter the verification code from your email'}
            </p>
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

            {step === 'request' ? (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    User ID
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Enter your user ID"
                      autoComplete="username"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  <KeyRound size={16} /> {loading ? 'Sending code...' : 'Send verification code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Verification code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit code"
                    maxLength={6}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 tracking-widest text-center font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    New password
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      autoComplete="new-password"
                      className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 hover:text-slate-600"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Confirm password
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      autoComplete="new-password"
                      className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 hover:text-slate-600"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  <KeyRound size={16} /> {loading ? 'Resetting...' : 'Reset password'}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setStep('request');
                    setOtp('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setError('');
                    setMessage('');
                  }}
                  className="w-full text-sm text-slate-600 hover:text-slate-800"
                >
                  Resend code
                </button>
              </form>
            )}

            <div className="mt-5 pt-4 border-t border-slate-100 text-center">
              <Link
                href={loginHref}
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <ArrowLeft size={14} />
                Back to log in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
