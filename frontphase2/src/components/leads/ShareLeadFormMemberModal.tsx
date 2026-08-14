'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff, Loader2, Mail, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiInviteLeadPublicFormMember } from '@/lib/api';

type ShareLeadFormMemberModalProps = {
  isOpen: boolean;
  onClose: () => void;
  formUrl?: string;
};

export function ShareLeadFormMemberModal({ isOpen, onClose, formUrl }: ShareLeadFormMemberModalProps) {
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setDesignation('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setSubmitting(false);
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedDesignation = designation.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedDesignation || !trimmedEmail || password.length < 8) {
      toast.error('Enter name, designation, email, and a password of at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiInviteLeadPublicFormMember({
        name: trimmedName,
        designation: trimmedDesignation,
        email: trimmedEmail,
        password,
      });
      const payload =
        (res as {
          data?: { alreadyExisted?: boolean; email?: string; formUrl?: string; emailSent?: boolean; emailError?: string };
        })?.data ?? res;
      const data = payload as {
        alreadyExisted?: boolean;
        email?: string;
        formUrl?: string;
        emailSent?: boolean;
        emailError?: string;
      };
      if (data.emailSent === false) {
        toast.error(
          data.emailError ||
            'Member was saved but the email could not be sent. Check email settings.'
        );
      } else {
        toast.success(
          data.alreadyExisted
            ? `This member already exists. The lead form link was sent to ${data.email || trimmedEmail}.`
            : `Member created. The lead form link was sent to ${data.email || trimmedEmail}.`
        );
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send the lead form invitation');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[12000] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={() => {
          if (!submitting) onClose();
        }}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Share lead form</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Create one member first. After confirmation the form link is emailed to them.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3 px-5 py-4">
          {formUrl ? (
            <p className="truncate rounded-md border border-blue-100 bg-blue-50 px-2.5 py-1.5 font-mono text-[10px] text-blue-800">
              {formUrl}
            </p>
          ) : null}
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-700">
              Name <span className="text-rose-500">*</span>
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              autoComplete="name"
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-700">
              Designation <span className="text-rose-500">*</span>
            </span>
            <input
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="e.g. Sales Manager"
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-700">
              Gmail <span className="text-rose-500">*</span>
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@gmail.com"
              autoComplete="email"
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-700">
              Password <span className="text-rose-500">*</span>
            </span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                data-writing-assist="off"
                className="h-10 w-full rounded-lg border border-slate-200 px-3 pr-10 text-sm outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-700"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-9 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
              Confirm & email link
            </button>
          </div>
        </form>
        <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-3 text-[11px] text-slate-500">
          <UserPlus className="h-3.5 w-3.5 shrink-0 text-blue-600" />
          They open the emailed link and fill the lead form.
        </div>
      </div>
    </div>,
    document.body
  );
}
