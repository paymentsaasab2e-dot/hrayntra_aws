import React, { useState } from 'react';
import { X, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface AddContactDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddContactDrawer: React.FC<AddContactDrawerProps> = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    whatsapp: false,
    company: '',
    designation: '',
    contactType: 'Hiring Manager',
    department: '',
    associatedJobs: [] as string[],
    owner: 'Alex Rivera',
    tags: [] as string[],
    notes: '',
    status: 'Active'
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Contact added successfully');
    onClose();
  };

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
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[60]"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-[600px] bg-white shadow-2xl z-[70] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Add New Contact</h2>
                <p className="text-xs text-slate-500 mt-0.5">Fill in the details to create a new recruitment stakeholder.</p>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
              
              {/* Basic Details */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-4 bg-blue-600 rounded-full" />
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Basic Details</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">First Name *</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      placeholder="e.g. John"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Last Name *</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      placeholder="e.g. Doe"
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Email Address *</label>
                    <input 
                      required
                      type="email" 
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      placeholder="john.doe@company.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Phone Number</label>
                    <div className="flex gap-2">
                      <select className="w-20 px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none">
                        <option>+1</option>
                        <option>+44</option>
                        <option>+91</option>
                      </select>
                      <input 
                        type="tel" 
                        className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        placeholder="000-000-0000"
                      />
                    </div>
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div className="relative inline-flex items-center">
                        <input type="checkbox" className="sr-only peer" />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                      </div>
                      <span className="text-xs font-medium text-slate-600 group-hover:text-slate-900 transition-colors">WhatsApp Available</span>
                    </label>
                  </div>
                </div>
              </section>

              {/* Professional Details */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-4 bg-blue-600 rounded-full" />
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Professional Details</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Company / Client</label>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <select className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none">
                        <option>Search and select company...</option>
                        <option>TechCorp Solutions</option>
                        <option>Innovate Inc.</option>
                        <option>Global Systems</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Designation / Role</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      placeholder="e.g. Senior HR Manager"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Contact Type</label>
                    <select className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                      <option>Hiring Manager</option>
                      <option>HR</option>
                      <option>Interviewer</option>
                      <option>Vendor</option>
                      <option>Partner</option>
                    </select>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Department</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      placeholder="e.g. Engineering, Sales, etc."
                    />
                  </div>
                </div>
              </section>

              {/* Recruitment Context */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-4 bg-blue-600 rounded-full" />
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Recruitment Context</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Associated Jobs</label>
                    <div className="min-h-[42px] p-2 bg-white border border-slate-200 rounded-lg flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-bold rounded border border-blue-100 uppercase tracking-tighter">
                        Frontend Lead
                        <X size={12} className="cursor-pointer" />
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-bold rounded border border-blue-100 uppercase tracking-tighter">
                        Product Designer
                        <X size={12} className="cursor-pointer" />
                      </span>
                      <button type="button" className="text-[11px] font-semibold text-blue-600 px-2 py-0.5 hover:bg-blue-50 rounded transition-colors">+ Add Job</button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Owner / Recruiter</label>
                    <select className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none">
                      <option>Alex Rivera</option>
                      <option>Sarah Johnson</option>
                      <option>Mike Chen</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Status</label>
                    <div className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" name="status" defaultChecked className="text-blue-600 focus:ring-blue-500" />
                        <span className="text-xs font-medium text-slate-700">Active</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" name="status" className="text-blue-600 focus:ring-blue-500" />
                        <span className="text-xs font-medium text-slate-700">Inactive</span>
                      </label>
                    </div>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Tags</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        placeholder="Enter tags and press enter..."
                      />
                      <div className="flex gap-1 mt-2">
                        {['VIP', 'Key Client'].map(tag => (
                          <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded border border-slate-200 uppercase tracking-wider">{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Additional Information */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-4 bg-blue-600 rounded-full" />
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Additional Information</h3>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Notes / Internal Remarks</label>
                  <textarea 
                    rows={4}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
                    placeholder="Add any additional context or remarks about this contact..."
                  />
                </div>
              </section>
            </form>

            {/* Footer Actions */}
            <div className="p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
              <button 
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-all shadow-md shadow-blue-500/20"
              >
                Save Contact
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
