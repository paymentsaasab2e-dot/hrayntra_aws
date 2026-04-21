'use client';

import React, { useRef, useState } from 'react';
import { Camera, Save, User as UserIcon, Mail, Shield, Briefcase } from 'lucide-react';
import { useUser } from '../hooks/useUser';
import { apiUploadUserAvatar, apiUpdateMe } from '../lib/api';
import { toast } from 'sonner';

export function ProfileSettings() {
  const { user, refreshUser } = useUser();
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
    };

    try {
      setIsSaving(true);
      const res = await apiUpdateMe(data);
      if (res.success) {
        toast.success('Profile updated successfully');
        refreshUser();
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
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Personal Profile</h2>
          <p className="text-sm text-slate-500">Manage your personal information and profile picture.</p>
        </div>
        
        <form onSubmit={handleSave}>
          <div className="p-6 space-y-8">
            {/* Avatar Upload */}
            <div className="flex items-center gap-6">
              <div className="relative group">
                <div 
                  className={`w-24 h-24 rounded-full bg-slate-100 border-2 border-white shadow-md flex items-center justify-center overflow-hidden cursor-pointer ${isUploading ? 'opacity-50' : ''}`}
                  onClick={handleImageClick}
                >
                  {user.avatar ? (
                    <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-teal-400 to-blue-600 flex items-center justify-center">
                      <UserIcon className="w-8 h-8 text-white" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <Camera className="w-6 h-6" />
                  </div>
                </div>
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-slate-900">Profile Picture</h3>
                <p className="text-xs text-slate-500">Click the icon to upload a new photo. Max 2MB.</p>
                <div className="flex gap-2 mt-2">
                  <button 
                    type="button"
                    onClick={handleImageClick}
                    className="text-xs font-medium text-[#2b7fff] hover:underline"
                  >
                    Upload new
                  </button>
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <UserIcon className="w-4 h-4" /> Full Name
                </label>
                <input 
                  name="name"
                  type="text" 
                  defaultValue={user.name}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2b7fff]/20 focus:border-[#2b7fff] transition-all"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Mail className="w-4 h-4" /> Email Address
                </label>
                <input 
                  type="email" 
                  value={user.email}
                  disabled
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed"
                />
                <p className="text-[10px] text-slate-400">Email cannot be changed here.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Shield className="w-4 h-4" /> System Role
                </label>
                <input 
                  type="text" 
                  value={user.role}
                  disabled
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Briefcase className="w-4 h-4" /> Department
                </label>
                <input 
                  type="text" 
                  value={user.department || 'Not specified'}
                  disabled
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
            <button 
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-[#2b7fff] text-white rounded-lg font-medium hover:bg-[#1e6ae6] transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
