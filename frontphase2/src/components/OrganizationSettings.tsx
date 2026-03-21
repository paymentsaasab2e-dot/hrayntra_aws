import React from 'react';
import { Camera, Save } from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';
import { toast } from 'sonner';

interface OrganizationSettingsProps {
  logo: string;
}

export function OrganizationSettings({ logo }: OrganizationSettingsProps) {
  const handleSave = () => {
    toast.success('Organization settings updated successfully');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Company Information</h2>
          <p className="text-sm text-slate-500">Update your company profile and public details.</p>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <div className="w-24 h-24 rounded-lg bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden">
                <ImageWithFallback 
                  src={logo} 
                  alt="Company Logo" 
                  className="w-full h-full object-contain p-2"
                />
              </div>
              <button className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg text-white">
                <Camera className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-slate-900">Company Logo</h3>
              <p className="text-xs text-slate-500">Recommended size: 512x512px. Max 2MB.</p>
              <div className="flex gap-2 mt-2">
                <button className="text-xs font-medium text-[#2b7fff] hover:underline">Upload new</button>
                <span className="text-slate-300">•</span>
                <button className="text-xs font-medium text-rose-500 hover:underline">Remove</button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Company Name</label>
              <input 
                type="text" 
                defaultValue="Global Recruiters Inc."
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2b7fff]/20 focus:border-[#2b7fff] transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Website</label>
              <input 
                type="url" 
                defaultValue="https://globalrecruiters.com"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2b7fff]/20 focus:border-[#2b7fff] transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Time Zone</label>
              <select className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2b7fff]/20 focus:border-[#2b7fff] transition-all">
                <option>(GMT+00:00) UTC</option>
                <option>(GMT-05:00) Eastern Time</option>
                <option>(GMT+05:30) India Standard Time</option>
                <option>(GMT+01:00) Central European Time</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Currency</label>
              <select className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2b7fff]/20 focus:border-[#2b7fff] transition-all">
                <option>USD ($)</option>
                <option>EUR (€)</option>
                <option>GBP (£)</option>
                <option>INR (₹)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Address</label>
            <textarea 
              rows={3}
              defaultValue="123 Talent Lane, Suite 400&#10;Innovation City, CA 90210&#10;United States"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2b7fff]/20 focus:border-[#2b7fff] transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Tax Details (GST/VAT)</label>
              <input 
                type="text" 
                defaultValue="VAT-88223311-US"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2b7fff]/20 focus:border-[#2b7fff] transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Date Format</label>
              <select className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2b7fff]/20 focus:border-[#2b7fff] transition-all">
                <option>DD/MM/YYYY</option>
                <option>MM/DD/YYYY</option>
                <option>YYYY-MM-DD</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Global Email Signature</label>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex gap-2">
                <button className="p-1 hover:bg-slate-200 rounded font-bold text-sm">B</button>
                <button className="p-1 hover:bg-slate-200 rounded italic text-sm">I</button>
                <button className="p-1 hover:bg-slate-200 rounded underline text-sm">U</button>
                <div className="w-px h-4 bg-slate-300 my-auto mx-1" />
                <button className="p-1 hover:bg-slate-200 rounded text-sm">Link</button>
              </div>
              <textarea 
                rows={4}
                defaultValue="Best regards,&#10;{{sender_name}}&#10;Global Recruiters Inc.&#10;www.globalrecruiters.com"
                className="w-full px-3 py-2 bg-white focus:outline-none transition-all resize-none text-sm"
              />
            </div>
          </div>
        </div>
        <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button 
            onClick={handleSave}
            className="px-4 py-2 bg-[#2b7fff] text-white rounded-lg font-medium hover:bg-[#1e6ae6] transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
