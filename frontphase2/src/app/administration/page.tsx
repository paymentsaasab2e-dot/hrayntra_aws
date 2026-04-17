'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  ShieldCheck, 
  CreditCard, 
  Database, 
  Settings, 
  DatabaseZap, 
  Lock, 
  MoreVertical, 
  Search, 
  Filter, 
  Download, 
  ChevronDown, 
  ChevronRight, 
  RefreshCw, 
  LogOut, 
  Key, 
  UserMinus, 
  Plus, 
  Edit2, 
  Trash2, 
  FileText,
  Clock,
  Layout,
  Mail,
  Percent,
  Timer,
  Bell,
  Globe,
  Webhook,
  ArrowRight
} from 'lucide-react';
import { ImageWithFallback } from '../../components/ImageWithFallback';
import { AddUserModal } from '../../components/AddUserModal';

// --- Mock Data ---

const USERS = [
  { id: 1, name: 'Sarah Wilson', role: 'Super Admin', status: 'Active', lastLogin: '2026-02-11 09:15', ip: '192.168.1.1', avatar: 'https://images.unsplash.com/photo-1689600944138-da3b150d9cb8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMHdvbWFuJTIwaGVhZHNob3QlMjBzbWlsaW5nfGVufDF8fHx8MTc3MDcyNTE3OHww&ixlib=rb-4.1.0&q=80&w=1080' },
  { id: 2, name: 'Michael Chen', role: 'Owner', status: 'Active', lastLogin: '2026-02-10 18:42', ip: '192.168.1.45', avatar: 'https://images.unsplash.com/photo-1641260774125-04d527b376a5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb3Jwb3JhdGUlMjBtYWxlJTIwaGVhZHNob3QlMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzA4MDA1MTZ8MA' },
  { id: 3, name: 'Emma Rodriguez', role: 'Manager', status: 'Suspended', lastLogin: '2026-02-05 14:20', ip: '10.0.0.8', avatar: 'https://images.unsplash.com/photo-1649433658557-54cf58577c68?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMHByb2ZpbGUlMjBwaG90b3xlbnwxfHx8fDE3NzA2OTUzODZ8MA' },
];

const AUDIT_LOGS = [
  { id: 101, user: 'Sarah Wilson', module: 'Users', action: 'Edited', oldVal: 'Manager', newVal: 'Super Admin', timestamp: '2026-02-11 10:30', ip: '192.168.1.1' },
  { id: 102, user: 'System', module: 'Security', action: 'Created', oldVal: '-', newVal: 'Daily Backup v102', timestamp: '2026-02-11 00:00', ip: 'internal' },
  { id: 103, user: 'Michael Chen', module: 'Settings', action: 'Deleted', oldVal: 'API Key "Legacy"', newVal: 'N/A', timestamp: '2026-02-10 16:15', ip: '192.168.1.45' },
  { id: 104, user: 'Emma Rodriguez', module: 'Candidates', action: 'Viewed', oldVal: 'Hidden', newVal: 'Profile #842', timestamp: '2026-02-10 11:20', ip: '10.0.0.8' },
];

const MASTER_LISTS = {
  'Industries': ['Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail'],
  'Job Categories': ['Engineering', 'Sales', 'Marketing', 'Human Resources', 'Legal'],
  'Locations': ['New York', 'London', 'San Francisco', 'Berlin', 'Remote'],
};

// --- Components ---

const SectionHeader = ({ title, icon: Icon, isOpen, onToggle }: { title: string, icon: any, isOpen: boolean, onToggle: () => void }) => (
  <button 
    onClick={onToggle}
    className="flex items-center justify-between w-full p-4 bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors"
  >
    <div className="flex items-center gap-3">
      <div className="p-2 bg-blue-50 rounded-lg">
        <Icon size={20} className="text-blue-600" />
      </div>
      <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">{title}</h3>
    </div>
    {isOpen ? <ChevronDown size={20} className="text-gray-400" /> : <ChevronRight size={20} className="text-gray-400" />}
  </button>
);

const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
);

export default function AdministrationPage() {
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({
    users: true,
    audit: true,
    subscription: true,
    governance: true,
    config: true,
    master: true,
    security: true,
  });
  const [isAddUserModalOpen, setIsAddUserModalOpen] = React.useState(false);

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8FAFC] p-8 no-scrollbar">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Administration</h1>
        <p className="text-gray-500 mt-1">System control, governance, and advanced configuration.</p>
      </header>

      <div className="space-y-6 max-w-7xl mx-auto">
        
        {/* Section 1: User Control */}
        <Card>
          <SectionHeader 
            title="User Control (Advanced Access Management)" 
            icon={Users} 
            isOpen={openSections.users} 
            onToggle={() => toggleSection('users')} 
          />
          <AnimatePresence>
            {openSections.users && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 items-center bg-gray-50/50">
                  <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input type="text" placeholder="Search users..." className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="flex gap-2">
                    <select className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                      <option>All Roles</option>
                      <option>Super Admin</option>
                      <option>Admin</option>
                      <option>Manager</option>
                    </select>
                    <select className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                      <option>All Status</option>
                      <option>Active</option>
                      <option>Suspended</option>
                      <option>Locked</option>
                    </select>
                  </div>
                  <button 
                    onClick={() => setIsAddUserModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm ml-auto"
                  >
                    <Plus size={16} />
                    Add New User
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">User Name</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Login</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">IP Address</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {USERS.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <ImageWithFallback src={user.avatar} className="w-8 h-8 rounded-full bg-gray-200 object-cover" />
                              <span className="text-sm font-medium text-gray-900">{user.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                              user.status === 'Active' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'
                            }`}>
                              {user.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">{user.lastLogin}</td>
                          <td className="px-6 py-4 text-sm text-gray-500 font-mono">{user.ip}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button title="Reset Password" className="p-1.5 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors"><Key size={16} /></button>
                              <button title="Force Logout" className="p-1.5 text-gray-400 hover:text-orange-600 rounded-md hover:bg-orange-50 transition-colors"><LogOut size={16} /></button>
                              <button title="Deactivate" className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"><UserMinus size={16} /></button>
                              <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"><MoreVertical size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* Section 2: Audit Logs */}
        <Card>
          <SectionHeader 
            title="System Audit Logs" 
            icon={ShieldCheck} 
            isOpen={openSections.audit} 
            onToggle={() => toggleSection('audit')} 
          />
          <AnimatePresence>
            {openSections.audit && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 items-center bg-gray-50/50">
                   <div className="flex gap-2">
                    <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-gray-300 transition-colors">
                      <Clock size={14} />
                      Last 24 Hours
                    </button>
                    <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-gray-300 transition-colors">
                      <Filter size={14} />
                      All Modules
                    </button>
                  </div>
                  <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors ml-auto shadow-sm">
                    <Download size={14} />
                    Export CSV / Excel
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Module</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action Type</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Old → New Value</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Timestamp</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">IP Address</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {AUDIT_LOGS.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50/50 transition-colors group">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{log.user}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{log.module}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-tight border ${
                              log.action === 'Edited' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                              log.action === 'Deleted' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                              log.action === 'Created' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                              'bg-gray-100 text-gray-700 border-gray-200'
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="px-2 py-1 bg-gray-100 rounded text-gray-500 line-through decoration-gray-300">{log.oldVal}</span>
                              <ArrowRight size={12} className="text-gray-300" />
                              <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded font-medium">{log.newVal}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">{log.timestamp}</td>
                          <td className="px-6 py-4 text-sm text-gray-500 font-mono">{log.ip}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        <div className="grid grid-cols-12 gap-6">
          {/* Section 3: Subscription & Usage */}
          <div className="col-span-12">
             <Card>
              <SectionHeader 
                title="Subscription & Plan Overview" 
                icon={CreditCard} 
                isOpen={openSections.subscription} 
                onToggle={() => toggleSection('subscription')} 
              />
              <AnimatePresence>
                {openSections.subscription && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="p-6 overflow-hidden"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                      <div className="p-5 bg-gradient-to-br from-[#1E293B] to-[#0F172A] rounded-xl text-white shadow-lg border border-white/5">
                        <p className="text-blue-400 text-[10px] font-bold uppercase tracking-widest">Active Plan</p>
                        <h4 className="text-2xl font-bold mt-1 tracking-tight">Agency Pro</h4>
                        <div className="mt-6 flex flex-col gap-1">
                          <p className="text-gray-400 text-xs">Expires Dec 31, 2026</p>
                          <div className="mt-2 flex items-center gap-2">
                             <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                             <span className="text-[11px] font-bold text-green-400 uppercase">System Active</span>
                          </div>
                        </div>
                      </div>
                      <div className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Auto-Renew</p>
                          <div className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out bg-blue-600 focus:outline-none">
                            <span className="pointer-events-none inline-block h-4 w-4 translate-x-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out" />
                          </div>
                        </div>
                        <p className="text-lg font-bold text-gray-900 mt-2">Enabled</p>
                        <p className="text-xs text-gray-500 mt-1">Next bill: $499.00 USD</p>
                        <button className="mt-4 text-[11px] font-bold text-blue-600 hover:text-blue-700">Manage Payments</button>
                      </div>
                      <div className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Active Users</p>
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="text-3xl font-black text-gray-900">12</span>
                          <span className="text-gray-400 text-sm font-medium">/ 20</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 mt-4 overflow-hidden">
                          <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: '60%' }} />
                        </div>
                        <p className="text-[11px] text-gray-500 mt-2 font-medium">8 slots remaining</p>
                      </div>
                      <div className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">AI Credits</p>
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="text-3xl font-black text-gray-900">850</span>
                          <span className="text-gray-400 text-sm font-medium">/ 1k</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 mt-4 overflow-hidden">
                          <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: '85%' }} />
                        </div>
                        <p className="text-[11px] text-amber-600 mt-2 font-bold">Refill soon</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                         <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-white rounded-xl shadow-sm border border-gray-100">
                               <RefreshCw size={20} className="text-blue-600" />
                            </div>
                            <div>
                               <p className="text-sm font-bold text-gray-800 tracking-tight">System Usage History</p>
                               <p className="text-xs text-gray-500">45 Active Jobs • 1.2k Resume Parsing calls</p>
                            </div>
                         </div>
                         <button className="px-4 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors shadow-sm">View History</button>
                      </div>
                      <div className="flex gap-4">
                        <button className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all active:scale-[0.98]">Payment History</button>
                        <button className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-[0.98]">Upgrade Plan</button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </div>

          {/* Section 4: Data Governance */}
          <div className="col-span-12 lg:col-span-6">
            <Card className="h-full">
              <SectionHeader 
                title="Data Governance & Compliance" 
                icon={Database} 
                isOpen={openSections.governance} 
                onToggle={() => toggleSection('governance')} 
              />
              <AnimatePresence>
                {openSections.governance && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="p-6 space-y-6 overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl">
                      <div>
                        <p className="text-sm font-bold text-gray-800">Data Retention Period</p>
                        <p className="text-xs text-gray-500 mt-0.5">Automated lifecycle management</p>
                      </div>
                      <select className="text-sm font-medium border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                        <option>24 Months</option>
                        <option>36 Months</option>
                        <option>60 Months</option>
                        <option>Indefinite</option>
                      </select>
                    </div>
                    <div className="space-y-4 px-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-700">Auto-Delete Inactive Candidates</p>
                          <p className="text-xs text-gray-500">Purge records with no activity for 2+ years</p>
                        </div>
                        <input type="checkbox" className="w-4 h-4 text-blue-600 rounded cursor-pointer" defaultChecked />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-700">GDPR Compliance Protocol</p>
                          <p className="text-xs text-gray-500">Enable strict "Right to be Forgotten" tools</p>
                        </div>
                        <input type="checkbox" className="w-4 h-4 text-blue-600 rounded cursor-pointer" defaultChecked />
                      </div>
                    </div>
                    <div className="pt-4 border-t border-gray-100 flex gap-3">
                      <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-white text-gray-700 rounded-xl text-xs font-bold border border-gray-200 hover:bg-gray-50 transition-colors">
                        <FileText size={14} className="text-gray-400" />
                        Export Logs
                      </button>
                      <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-white text-gray-700 rounded-xl text-xs font-bold border border-gray-200 hover:bg-gray-50 transition-colors">
                        <DatabaseZap size={14} className="text-gray-400" />
                        System Restore
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </div>

          {/* Section 7: Security & Risk */}
          <div className="col-span-12 lg:col-span-6">
            <Card className="h-full">
              <SectionHeader 
                title="Security & Risk Controls" 
                icon={Lock} 
                isOpen={openSections.security} 
                onToggle={() => toggleSection('security')} 
              />
              <AnimatePresence>
                {openSections.security && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="p-6 space-y-6 overflow-hidden"
                  >
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-blue-900">Enforce 2FA</p>
                        <p className="text-xs text-blue-700 mt-0.5">Required for all agency personnel</p>
                      </div>
                      <div className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out bg-blue-600 focus:outline-none">
                        <span className="pointer-events-none inline-block h-4 w-4 translate-x-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 px-2">
                       <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-700">Failed Login Threshold</p>
                          <p className="text-xs text-gray-500">Number of attempts before lockout</p>
                        </div>
                        <input type="number" defaultValue={5} className="w-16 text-sm font-bold border border-gray-200 rounded-lg px-2 py-1.5 text-center focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-700">Session Timeout Duration</p>
                          <p className="text-xs text-gray-500">Auto-logout after period of inactivity</p>
                        </div>
                        <select className="text-sm font-medium border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                          <option>30 Minutes</option>
                          <option>1 Hour</option>
                          <option>4 Hours</option>
                          <option>8 Hours</option>
                        </select>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-700">Suspicious Activity Alerts</p>
                          <p className="text-xs text-gray-500">Notify Super Admin on unusual login IPs</p>
                        </div>
                        <input type="checkbox" className="w-4 h-4 text-blue-600 rounded cursor-pointer" defaultChecked />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </div>
        </div>

        {/* Section 5: System Configuration */}
        <Card>
          <SectionHeader 
            title="System Configuration" 
            icon={Settings} 
            isOpen={openSections.config} 
            onToggle={() => toggleSection('config')} 
          />
          <AnimatePresence>
            {openSections.config && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="p-6 overflow-hidden"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {[
                    { label: 'Pipeline Stage Template', icon: Layout, desc: 'Manage default recruiting workflows' },
                    { label: 'Email Templates', icon: Mail, desc: 'Global communication branding' },
                    { label: 'Commission Rules', icon: Percent, desc: 'Set agent & agency fee structures' },
                    { label: 'SLA Time Settings', icon: Timer, desc: 'Define response time targets' },
                    { label: 'Notification Rules', icon: Bell, desc: 'Configure global alert logic' },
                    { label: 'API & Webhooks', icon: Globe, desc: 'Access keys and external events' },
                  ].map((item, idx) => (
                    <div key={idx} className="p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-md transition-all group cursor-pointer relative overflow-hidden">
                      <div className="flex items-start gap-4">
                        <div className="p-2.5 bg-gray-50 rounded-xl group-hover:bg-blue-50 transition-colors border border-gray-100">
                          <item.icon size={20} className="text-gray-500 group-hover:text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                             <h5 className="text-sm font-bold text-gray-800 tracking-tight">{item.label}</h5>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{item.desc}</p>
                          <button className="mt-3 text-[10px] font-black uppercase text-blue-600 tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Edit Config</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* Section 6: Master Data Management */}
        <Card>
          <SectionHeader 
            title="Master Data Management" 
            icon={DatabaseZap} 
            isOpen={openSections.master} 
            onToggle={() => toggleSection('master')} 
          />
          <AnimatePresence>
            {openSections.master && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="p-6 overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {Object.entries(MASTER_LISTS).map(([title, items]) => (
                    <div key={title} className="bg-gray-50 rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="text-[10px] font-black text-gray-500 uppercase tracking-[1px]">{title}</h5>
                        <button className="p-1 hover:bg-white rounded-lg transition-colors text-blue-600"><Plus size={16} /></button>
                      </div>
                      <div className="space-y-2 flex-1">
                        {items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-transparent hover:border-blue-100 hover:shadow-sm text-sm text-gray-700 group transition-all">
                            <span className="font-medium">{item}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="p-1 text-gray-400 hover:text-blue-600"><Edit2 size={12} /></button>
                              <button className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={12} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button className="w-full mt-6 py-2.5 border border-dashed border-gray-300 rounded-xl text-[11px] font-bold text-gray-500 hover:bg-white hover:text-blue-600 hover:border-blue-200 transition-all flex items-center justify-center gap-2">
                        <Download size={14} />
                        Bulk Import
                      </button>
                    </div>
                  ))}
                  <div className="bg-gradient-to-b from-blue-50 to-white rounded-2xl p-6 border border-dashed border-blue-200 flex flex-col items-center justify-center text-center shadow-sm">
                    <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-blue-100 flex items-center justify-center mb-4">
                       <Layout size={28} className="text-blue-600" />
                    </div>
                    <p className="text-sm font-bold text-blue-900 tracking-tight">Expand Master Lists</p>
                    <p className="text-[11px] text-blue-600/70 mt-1.5 leading-relaxed">Add interview types, rejection reasons, or offer templates.</p>
                    <button className="mt-5 px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">Add New List</button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

      </div>
      
      <footer className="mt-16 pb-8 text-center">
        <div className="h-px bg-gray-200 w-full max-w-7xl mx-auto mb-8" />
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[2px]">Agency Administration • Version 4.2.0 • Build #2026-02-11</p>
        <p className="text-xs text-gray-400 mt-2">Environment: Production • System Stability: Healthy • Global Latency: 24ms</p>
      </footer>

      <AddUserModal 
        isOpen={isAddUserModalOpen} 
        onClose={() => setIsAddUserModalOpen(false)} 
      />
    </div>
  );
};
