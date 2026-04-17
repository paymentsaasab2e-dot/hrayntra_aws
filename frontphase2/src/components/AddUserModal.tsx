import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Mail, Phone, Shield, Lock, Globe, Key, Check, ChevronDown, Upload, Info } from 'lucide-react';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PERMISSIONS = [
  { id: 'manage_clients', label: 'Manage Clients' },
  { id: 'manage_jobs', label: 'Manage Jobs' },
  { id: 'view_candidates', label: 'View Candidates' },
  { id: 'move_pipeline', label: 'Move Pipeline Stages' },
  { id: 'schedule_interviews', label: 'Schedule Interviews' },
  { id: 'manage_placements', label: 'Manage Placements' },
  { id: 'access_reports', label: 'Access Reports' },
  { id: 'access_billing', label: 'Access Billing' },
  { id: 'manage_team', label: 'Manage Team' },
  { id: 'access_admin', label: 'Access Administration' },
];

const ROLES = [
  'Super Admin',
  'Admin',
  'Recruiter',
  'Hiring Manager',
  'Finance',
  'Viewer'
];

const Toggle = ({ enabled, onChange, label, sublabel }: { enabled: boolean, onChange: (val: boolean) => void, label: string, sublabel?: string }) => (
  <div className="flex items-center justify-between gap-4 py-2">
    <div>
      <p className="text-sm font-semibold text-gray-800">{label}</p>
      {sublabel && <p className="text-[11px] text-gray-500">{sublabel}</p>}
    </div>
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${enabled ? 'bg-blue-600' : 'bg-gray-200'}`}
    >
      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabled ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  </div>
);

export const AddUserModal = ({ isOpen, onClose }: AddUserModalProps) => {
  const [customPermissions, setCustomPermissions] = React.useState(false);
  const [selectedPermissions, setSelectedPermissions] = React.useState<string[]>([]);

  const togglePermission = (id: string) => {
    setSelectedPermissions(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-[700px] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Add New User</h2>
              <p className="text-sm text-gray-500 mt-0.5">Create a new team member account with role-based access.</p>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
            <form className="space-y-8">
              
              {/* Section 1: Basic Information */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <User size={18} className="text-blue-600" />
                  <h3 className="text-xs font-black uppercase tracking-[1px] text-gray-400">Basic Information</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700">Full Name *</label>
                    <input type="text" placeholder="e.g. John Doe" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700">Work Email *</label>
                    <input type="email" placeholder="john@agency.com" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700">Phone Number</label>
                    <input type="tel" placeholder="+1 (555) 000-0000" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700">Username</label>
                    <input type="text" placeholder="jdoe_admin" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-bold text-gray-700 block mb-2">Profile Photo</label>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-200">
                        <Upload size={20} />
                      </div>
                      <button type="button" className="text-xs font-bold text-blue-600 hover:text-blue-700 py-1 px-3 border border-blue-100 rounded-lg hover:bg-blue-50 transition-colors">Upload Image</button>
                      <p className="text-[10px] text-gray-400">PNG or JPG, max 2MB</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 2: Role & Permissions */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Shield size={18} className="text-blue-600" />
                  <h3 className="text-xs font-black uppercase tracking-[1px] text-gray-400">Role & Permissions</h3>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700">Assign Role</label>
                    <div className="relative">
                      <select className="w-full appearance-none px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all">
                        {ROLES.map(role => <option key={role}>{role}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <Toggle 
                      label="Custom Permissions" 
                      sublabel="Override default role settings"
                      enabled={customPermissions} 
                      onChange={setCustomPermissions} 
                    />
                    
                    <AnimatePresence>
                      {customPermissions && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-4 pt-4 border-t border-gray-200">
                            {PERMISSIONS.map(p => (
                              <label key={p.id} className="flex items-center gap-3 cursor-pointer group">
                                <div 
                                  onClick={() => togglePermission(p.id)}
                                  className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${
                                    selectedPermissions.includes(p.id) ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300 group-hover:border-blue-400'
                                  }`}
                                >
                                  {selectedPermissions.includes(p.id) && <Check size={10} className="text-white" />}
                                </div>
                                <span className="text-xs font-medium text-gray-600 select-none">{p.label}</span>
                              </label>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </section>

              {/* Section 3: Account Settings */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Lock size={18} className="text-blue-600" />
                  <h3 className="text-xs font-black uppercase tracking-[1px] text-gray-400">Account Settings</h3>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                  <div className="space-y-1.5 col-span-2 mb-2">
                    <label className="text-sm font-bold text-gray-700">Account Status</label>
                    <div className="flex gap-4">
                      {['Active', 'Inactive'].map(status => (
                        <label key={status} className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="status" defaultChecked={status === 'Active'} className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
                          <span className="text-sm text-gray-600">{status}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <Toggle 
                    label="Force Password Reset" 
                    sublabel="Required on first login"
                    enabled={true} 
                    onChange={() => {}} 
                  />
                  <Toggle 
                    label="Require 2FA" 
                    sublabel="Two-factor authentication"
                    enabled={false} 
                    onChange={() => {}} 
                  />
                  <div className="col-span-2 p-3 bg-blue-50 rounded-lg flex gap-3 mt-2 border border-blue-100">
                    <Key size={16} className="text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-blue-900">Temporary Password</p>
                      <p className="text-[11px] text-blue-700 mt-0.5">A secure random password will be generated and sent via email.</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 4: Access Restrictions */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Globe size={18} className="text-blue-600" />
                  <h3 className="text-xs font-black uppercase tracking-[1px] text-gray-400">Access Restrictions (Optional)</h3>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                      Restrict by Client
                      <Info size={14} className="text-gray-400" />
                    </label>
                    <div className="relative">
                      <select multiple className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all h-20">
                        <option>Global Tech Solutions</option>
                        <option>Innovate Corp</option>
                        <option>Skyline Partners</option>
                        <option>Nexus Foundry</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-gray-700">Restrict by Job</label>
                      <select className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none">
                        <option>All Jobs</option>
                        <option>Software Engineer (NY)</option>
                        <option>Product Designer (Remote)</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-gray-700">Region / Location</label>
                      <select className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none">
                        <option>All Regions</option>
                        <option>North America</option>
                        <option>Europe</option>
                        <option>APAC</option>
                      </select>
                    </div>
                  </div>
                </div>
              </section>

            </form>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
            <button onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
            <div className="flex gap-3">
              <button className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-100 transition-all shadow-sm active:scale-[0.98]">Save User</button>
              <button className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-[0.98]">Save & Invite</button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
