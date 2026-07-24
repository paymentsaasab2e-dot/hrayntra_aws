'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, Save, User as UserIcon, Mail, Shield, Briefcase } from 'lucide-react';
import { useUser } from '../hooks/useUser';
import { apiUploadUserAvatar, apiUpdateMe } from '../lib/api';
import { toast } from 'sonner';
import {
  DrawerFieldLabel,
  DrawerIconInput,
  DRAWER_FORM_INPUT_WITH_ICON,
} from './drawers/drawerFormUi';

const READONLY_INPUT_CLASS =
  `${DRAWER_FORM_INPUT_WITH_ICON} cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500`;

type ProfileSettingsProps = {
  /** Notifies parent when the form has unsaved typed changes. */
  onDirtyChange?: (dirty: boolean) => void;
};

export function ProfileSettings({ onDirtyChange }: ProfileSettingsProps) {
  const { user, refreshUser } = useUser();
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;

  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
  }, [user?.id, user?.name]);

  const isDirty = Boolean(user) && name.trim() !== String(user?.name || '').trim();

  useEffect(() => {
    onDirtyChangeRef.current?.(isDirty);
    return () => onDirtyChangeRef.current?.(false);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setIsUploading(true);
      const res = await apiUploadUserAvatar(user.id, file);
      if (res.success) {
        toast.success('Profile picture updated');
        refreshUser();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    const nextName = name.trim();
    if (!nextName) {
      toast.error('Full name is required');
      return;
    }

    try {
      setIsSaving(true);
      const res = await apiUpdateMe({ name: nextName });
      if (res.success) {
        toast.success('Profile updated successfully');
        setName(nextName);
        refreshUser();
        onDirtyChangeRef.current?.(false);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
        <div className="border-b border-blue-100/70 bg-gradient-to-r from-blue-50/95 via-indigo-50/40 to-white px-6 py-5">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Personal Profile</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage your personal information and profile picture.
          </p>
        </div>

        <form onSubmit={handleSave}>
          <div className="space-y-8 bg-gradient-to-b from-slate-50/80 via-white to-white p-6">
            {/* Avatar Upload */}
            <div className="flex items-center gap-6 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/30">
              <div className="relative group">
                <div
                  className={`flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-white bg-slate-100 shadow-md ${
                    isUploading ? 'opacity-50' : ''
                  }`}
                  onClick={handleImageClick}
                >
                  {user.avatar ? (
                    <img src={user.avatar} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-400 to-blue-600">
                      <UserIcon className="h-8 w-8 text-white" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
                    <Camera className="h-6 w-6" />
                  </div>
                </div>
                {isUploading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
                  </div>
                ) : null}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-900">Profile Picture</h3>
                <p className="text-xs text-slate-500">Click the icon to upload a new photo. Max 2MB.</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={handleImageClick}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    Upload new
                  </button>
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <DrawerFieldLabel label="Full Name" icon={UserIcon} iconClassName="text-blue-500" required />
                <DrawerIconInput
                  icon={UserIcon}
                  iconClassName="text-blue-400"
                  name="name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  placeholder="Your full name"
                />
                {isDirty ? (
                  <p className="mt-1.5 text-[11px] font-medium text-amber-600">
                    You have unsaved changes.
                  </p>
                ) : null}
              </div>

              <div>
                <DrawerFieldLabel label="Email Address" icon={Mail} iconClassName="text-violet-500" />
                <DrawerIconInput
                  icon={Mail}
                  iconClassName="text-violet-400"
                  type="email"
                  value={user.email}
                  disabled
                  readOnly
                  className={READONLY_INPUT_CLASS}
                />
                <p className="mt-1.5 text-[11px] text-slate-400">Email cannot be changed here.</p>
              </div>

              <div>
                <DrawerFieldLabel label="System Role" icon={Shield} iconClassName="text-amber-500" />
                <DrawerIconInput
                  icon={Shield}
                  iconClassName="text-amber-400"
                  type="text"
                  value={user.role}
                  disabled
                  readOnly
                  className={READONLY_INPUT_CLASS}
                />
              </div>

              <div>
                <DrawerFieldLabel label="Department" icon={Briefcase} iconClassName="text-emerald-500" />
                <DrawerIconInput
                  icon={Briefcase}
                  iconClassName="text-emerald-400"
                  type="text"
                  value={user.department || 'Not specified'}
                  disabled
                  readOnly
                  className={READONLY_INPUT_CLASS}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-200 bg-white px-6 py-4">
            <button
              type="submit"
              disabled={isSaving || !isDirty}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
