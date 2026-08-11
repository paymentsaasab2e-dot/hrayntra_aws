'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { AuthMarketingShell } from '@/components/auth/AuthMarketingShell';
import {
  authInputClassName,
  authInputWithIconClassName,
  authPrimaryButtonStyle,
} from '@/components/auth/authMarketingTheme';
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
  const [loadingMessage, setLoadingMessage] = useState('');
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
      setLoadingMessage('Sending verification code...');
      const res = await apiForgotPassword(resetIdentifier);
      const emailHint = res.data?.email;
      if (emailHint) {
        setResolvedEmail(emailHint);
      }
      setMessage(
        res.message ||
          'If the account exists, a verification code has been sent to the registered email.',
      );
      setStep('reset');
    } catch (err: unknown) {
      setError(formatAuthErrorMessage(err as { message?: string }, 'Failed to send verification code.'));
    } finally {
      setLoading(false);
      setLoadingMessage('');
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
      setLoadingMessage('Resetting password...');
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
      setLoadingMessage('');
    }
  };

  return (
    <AuthMarketingShell
      tall={step === 'reset'}
      title={step === 'request' ? 'Reset password' : 'Set new password'}
      subtitle={
        step === 'request'
          ? 'Enter your user ID to receive a verification code'
          : resolvedEmail
            ? `Enter the code sent to ${resolvedEmail}`
            : 'Enter the verification code from your email'
      }
      loading={loading}
      loadingMessage={loadingMessage}
      footer={
        <Link
          href={loginHref}
          className="inline-flex items-center gap-1.5 font-semibold text-slate-900 underline-offset-2 hover:underline"
        >
          <ArrowLeft size={14} />
          Back to log in
        </Link>
      }
    >
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

      {step === 'request' ? (
        <form onSubmit={handleRequestOtp} className="space-y-3.5">
          <div>
            <label htmlFor="forgot-user-id" className="mb-1.5 block text-[13px] font-medium text-slate-600">
              User ID
            </label>
            <input
              id="forgot-user-id"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Enter your user ID or email"
              autoComplete="username"
              className={authInputClassName}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-0.5 w-full rounded-full px-4 py-2.5 text-[14px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(232,119,14,0.85)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            style={authPrimaryButtonStyle}
          >
            {loading ? 'Sending code…' : 'Send verification code'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="space-y-3.5">
          <div>
            <label htmlFor="forgot-otp" className="mb-1.5 block text-[13px] font-medium text-slate-600">
              Verification code
            </label>
            <input
              id="forgot-otp"
              type="text"
              inputMode="numeric"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              maxLength={6}
              className={`${authInputClassName} text-center font-mono tracking-widest`}
            />
          </div>
          <div>
            <label htmlFor="forgot-new-password" className="mb-1.5 block text-[13px] font-medium text-slate-600">
              New password
            </label>
            <div className="relative">
              <input
                id="forgot-new-password"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                autoComplete="new-password"
                className={authInputWithIconClassName}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:text-slate-700"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="forgot-confirm-password" className="mb-1.5 block text-[13px] font-medium text-slate-600">
              Confirm password
            </label>
            <div className="relative">
              <input
                id="forgot-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                autoComplete="new-password"
                className={authInputWithIconClassName}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:text-slate-700"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-0.5 w-full rounded-full px-4 py-2.5 text-[14px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(232,119,14,0.85)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            style={authPrimaryButtonStyle}
          >
            {loading ? 'Resetting…' : 'Reset password'}
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
            className="w-full text-[13px] font-medium text-slate-500 transition hover:text-slate-800"
          >
            Resend code
          </button>
        </form>
      )}
    </AuthMarketingShell>
  );
}
