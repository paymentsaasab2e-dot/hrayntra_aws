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
import { SettingsPageHero, SettingsPanel } from './settings/SettingsPageHero';

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
      <SettingsPageHero
        eyebrow="Profile"
        title="Personal profile"
        description="Manage your name and profile picture. Role and email are managed by your organization admin."
        icon={<UserIcon className="h-3.5 w-3.5 text-indigo-200" />}
        stats={
          isDirty ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-700">
              Unsaved changes
            </span>
          ) : null
        }
      />

      <SettingsPanel
        title="Account details"
        description="Your personal information for this workspace."
        icon={<UserIcon className="h-4 w-4 text-indigo-600" />}
      >
        <form onSubmit={handleSave} className="space-y-8">
          <div className="flex items-center gap-6 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
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
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-400 to-indigo-600">
                    <UserIcon className="h-8 w-8 text-white" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera className="h-6 w-6" />
                </div>
              </div>
              {isUploading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
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
              <h3 className="text-sm font-semibold text-slate-900">Profile picture</h3>
              <p className="text-xs text-slate-500">Click the icon to upload a new photo. Max 2MB.</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleImageClick}
                  className="text-xs font-semibold text-indigo-700 hover:underline"
                >
                  Upload new
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <DrawerFieldLabel label="Full Name" icon={UserIcon} iconClassName="text-indigo-500" required />
              <DrawerIconInput
                icon={UserIcon}
                iconClassName="text-indigo-400"
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
              <DrawerFieldLabel label="Email Address" icon={Mail} iconClassName="text-slate-500" />
              <DrawerIconInput
                icon={Mail}
                iconClassName="text-slate-400"
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

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <button
              type="submit"
              disabled={isSaving || !isDirty}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </SettingsPanel>
    </div>
  );
}
