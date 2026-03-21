import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Upload, 
  ChevronDown, 
  Shield, 
  Briefcase, 
  Target, 
  DollarSign, 
  Settings, 
  Mail, 
  Check,
  ChevronRight,
  UserPlus
} from 'lucide-react';

interface AddMemberDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddMemberDrawer: React.FC<AddMemberDrawerProps> = ({ isOpen, onClose }) => {
  const [showPermissions, setShowPermissions] = useState(false);
  const [commissionType, setCommissionType] = useState('Percentage');

  const permissionGroups = [
    {
      title: 'Recruitment Permissions',
      perms: ['Create Job', 'Edit Job', 'Delete Job', 'View All Jobs', 'View Assigned Jobs Only', 'View All Candidates', 'View Assigned Candidates Only']
    },
    {
      title: 'Financial Permissions',
      perms: ['Access Billing', 'View Commission', 'Approve Commission', 'Export Reports']
    },
    {
      title: 'Admin Permissions',
      perms: ['Manage Team', 'Manage Settings', 'Manage Roles']
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
          />
          
          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-[60] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Add Team Member</h2>
                <p className="text-sm text-slate-500">Invite and assign roles to new team members</p>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 transition-all"
              >
                <X className="size-6" />
              </button>
            </div>

            {/* Form Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-10 pb-32">
              
              {/* Section 1: Basic Information */}
              <section className="space-y-6">
                <div className="flex items-center gap-2 text-blue-600">
                  <div className="p-1.5 bg-blue-50 rounded-lg">
                    <UserPlus className="size-4" />
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-wider">Basic Information</h3>
                </div>
                
                <div className="flex items-start gap-8">
                  <div className="flex flex-col items-center gap-3">
                    <div className="size-24 rounded-full bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-all cursor-pointer group">
                      <Upload className="size-6 mb-1 group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-bold uppercase">Upload</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">JPG, PNG up to 2MB</span>
                  </div>
                  
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">First Name <span className="text-rose-500">*</span></label>
                      <input type="text" placeholder="e.g. John" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-500 outline-none transition-all" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Last Name <span className="text-rose-500">*</span></label>
                      <input type="text" placeholder="e.g. Doe" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-500 outline-none transition-all" />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Work Email <span className="text-rose-500">*</span></label>
                      <input type="email" placeholder="john.doe@agency.com" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-500 outline-none transition-all" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Phone Number</label>
                      <input type="tel" placeholder="+1 (555) 000-0000" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-500 outline-none transition-all" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Department</label>
                      <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none">
                        <option>Engineering</option>
                        <option>Sales</option>
                        <option>HR & Recruitment</option>
                        <option>Finance</option>
                      </select>
                    </div>
                  </div>
                </div>
              </section>

              <div className="h-px bg-slate-100" />

              {/* Section 2: Role & Permissions */}
              <section className="space-y-6">
                <div className="flex items-center gap-2 text-indigo-600">
                  <div className="p-1.5 bg-indigo-50 rounded-lg">
                    <Shield className="size-4" />
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-wider">Role & Permissions</h3>
                </div>

                <div className="grid grid-cols-2 gap-4 items-end">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">System Role <span className="text-rose-500">*</span></label>
                    <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none">
                      <option>Recruiter</option>
                      <option>Senior Recruiter</option>
                      <option>Admin</option>
                      <option>Super Admin</option>
                      <option>Finance</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between p-2.5 px-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-xs font-bold text-slate-700">Customize Permissions</span>
                    <button 
                      onClick={() => setShowPermissions(!showPermissions)}
                      className={`w-10 h-5 rounded-full relative transition-colors ${showPermissions ? 'bg-blue-600' : 'bg-slate-300'}`}
                    >
                      <motion.div 
                        animate={{ x: showPermissions ? 20 : 2 }}
                        className="absolute top-0.5 size-4 rounded-full bg-white shadow-sm"
                      />
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {showPermissions && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-slate-50/50 rounded-2xl border border-slate-100"
                    >
                      <div className="p-6 space-y-6">
                        {permissionGroups.map((group) => (
                          <div key={group.title} className="space-y-3">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{group.title}</h4>
                            <div className="grid grid-cols-2 gap-y-2 gap-x-6">
                              {group.perms.map((perm) => (
                                <label key={perm} className="flex items-center gap-2 cursor-pointer group">
                                  <div className="size-4 rounded border border-slate-300 flex items-center justify-center bg-white group-hover:border-blue-400 transition-colors">
                                    <Check className="size-2.5 text-blue-600 opacity-0 group-hover:opacity-40" />
                                  </div>
                                  <span className="text-xs text-slate-600 group-hover:text-slate-900 transition-colors">{perm}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              <div className="h-px bg-slate-100" />

              {/* Section 3: Assignments */}
              <section className="space-y-6">
                <div className="flex items-center gap-2 text-emerald-600">
                  <div className="p-1.5 bg-emerald-50 rounded-lg">
                    <Briefcase className="size-4" />
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-wider">Assignments & Targets</h3>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Assign Clients</label>
                    <div className="min-h-[40px] p-2 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap gap-1 items-center">
                      <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 flex items-center gap-1">
                        TechNova <X className="size-3 cursor-pointer" />
                      </span>
                      <input type="text" placeholder="Search clients..." className="flex-1 bg-transparent text-sm outline-none px-1" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Assign Jobs</label>
                    <div className="min-h-[40px] p-2 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap gap-1 items-center">
                      <input type="text" placeholder="Assign roles..." className="flex-1 bg-transparent text-sm outline-none px-1" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Reporting Manager</label>
                    <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none">
                      <option>Alex Thompson</option>
                      <option>Sarah Jenkins</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Placement Target</label>
                      <input type="number" placeholder="0" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Revenue Target ($)</label>
                      <input type="number" placeholder="0" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" />
                    </div>
                  </div>
                </div>
              </section>

              <div className="h-px bg-slate-100" />

              {/* Section 4: Commission Setup */}
              <section className="space-y-6">
                <div className="flex items-center gap-2 text-amber-600">
                  <div className="p-1.5 bg-amber-50 rounded-lg">
                    <DollarSign className="size-4" />
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-wider">Commission Setup</h3>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Commission Type</label>
                    <select 
                      value={commissionType}
                      onChange={(e) => setCommissionType(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                    >
                      <option>Percentage</option>
                      <option>Fixed Amount</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Value ({commissionType === 'Percentage' ? '%' : '$'})</label>
                    <input type="text" placeholder="0.00" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" />
                  </div>
                  <div className="flex items-center justify-between p-2 px-4 bg-slate-50 border border-slate-200 rounded-xl h-[42px] self-end">
                    <span className="text-[10px] font-bold text-slate-500 leading-none">Enable Tracking</span>
                    <button className="w-8 h-4 bg-blue-600 rounded-full relative">
                      <div className="absolute right-0.5 top-0.5 size-3 rounded-full bg-white" />
                    </button>
                  </div>
                </div>
              </section>

              <div className="h-px bg-slate-100" />

              {/* Section 5: Account Settings */}
              <section className="space-y-6">
                <div className="flex items-center gap-2 text-slate-600">
                  <div className="p-1.5 bg-slate-50 rounded-lg">
                    <Settings className="size-4" />
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-wider">Account Settings</h3>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-800">Send Invitation Email</span>
                        <span className="text-xs text-slate-500">Member will receive an onboarding link.</span>
                      </div>
                      <button className="w-10 h-5 bg-blue-600 rounded-full relative transition-colors">
                        <div className="absolute right-0.5 top-0.5 size-4 rounded-full bg-white shadow-sm" />
                      </button>
                    </div>
                    <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 flex items-center gap-3">
                      <Mail className="size-5 text-blue-600" />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Temporary Password</span>
                        <span className="text-sm font-mono font-bold text-blue-900 tracking-wider">RFlow-2026!xyz</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Initial Account Status</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button className="px-4 py-2 rounded-xl border-2 border-blue-600 bg-blue-50 text-blue-700 text-xs font-bold">Active</button>
                      <button className="px-4 py-2 rounded-xl border-2 border-slate-200 bg-white text-slate-500 text-xs font-bold">Pending</button>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Sticky Footer */}
            <div className="p-6 border-t border-slate-100 bg-white flex items-center justify-between sticky bottom-0 z-20 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
              <button 
                onClick={onClose}
                className="px-6 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
              >
                Cancel
              </button>
              <div className="flex items-center gap-3">
                <button className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all">
                  Save as Draft
                </button>
                <button className="px-8 py-3 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 transition-all flex items-center gap-2">
                  Invite & Create
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
