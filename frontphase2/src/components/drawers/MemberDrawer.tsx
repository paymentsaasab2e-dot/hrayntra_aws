import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Mail, 
  Phone, 
  Calendar, 
  User, 
  Briefcase, 
  BarChart3, 
  DollarSign,
  TrendingUp,
  Target,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { TeamMember, Badge, IconButton } from '../TeamComponents';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { ImageWithFallback } from '../ImageWithFallback';

interface MemberDrawerProps {
  member: TeamMember | null;
  isOpen: boolean;
  onClose: () => void;
}

export const MemberDrawer: React.FC<MemberDrawerProps> = ({ member, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'assignments' | 'commission'>('overview');

  if (!member) return null;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'performance', label: 'Performance', icon: BarChart3 },
    { id: 'assignments', label: 'Assignments', icon: Briefcase },
    { id: 'commission', label: 'Commission', icon: DollarSign },
  ] as const;

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
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
          />
          
          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl z-50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-full overflow-hidden border-2 border-slate-100">
                  <ImageWithFallback src={member.avatar} alt={member.name} className="size-full object-cover" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{member.name}</h3>
                  <p className="text-sm text-slate-500">
                    {typeof member.role === 'object' ? member.role?.roleName : member.role} • {typeof member.department === 'object' ? member.department?.name : member.department}
                  </p>
                </div>
              </div>
              <IconButton icon={X} onClick={onClose} className="size-10" />
            </div>

            {/* Tabs Navigation */}
            <div className="px-6 border-b border-slate-100">
              <div className="flex gap-6">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                      activeTab === tab.id 
                        ? 'border-blue-600 text-blue-600' 
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <tab.icon className="size-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeTab === 'overview' && (
                    <div className="space-y-6">
                      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Personal Information</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center gap-3">
                            <Mail className="size-4 text-slate-400" />
                            <span className="text-sm text-slate-600 truncate">{member.email}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Phone className="size-4 text-slate-400" />
                            <span className="text-sm text-slate-600">{member.phone}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Calendar className="size-4 text-slate-400" />
                            <span className="text-sm text-slate-600">Joined {new Date(member.joiningDate).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Clock className="size-4 text-slate-400" />
                            <span className="text-sm text-slate-600">Last login: {member.lastLogin}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Employment Details</h4>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-500">Reporting Manager</span>
                            <span className="text-sm font-medium text-slate-900">
                              {typeof member.manager === 'object' ? member.manager?.name : member.manager || '-'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-500">Status</span>
                            <Badge variant={member.status === 'Active' ? 'active' : 'suspended'}>
                              {member.status}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between pt-2">
                            <span className="text-sm text-slate-500">Active Status Toggle</span>
                            <button className={`w-10 h-5 rounded-full relative transition-colors ${member.status === 'Active' ? 'bg-blue-600' : 'bg-slate-300'}`}>
                              <div className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${member.status === 'Active' ? 'left-5.5' : 'left-0.5'}`} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'performance' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                          <p className="text-xs text-slate-500 mb-1">Total Candidates</p>
                          <p className="text-xl font-bold text-slate-900">{member.activeCandidates}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                          <p className="text-xs text-slate-500 mb-1">Conversion Rate</p>
                          <p className="text-xl font-bold text-slate-900">24.5%</p>
                        </div>
                      </div>

                      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                          Monthly Targets
                          <span className="text-blue-600 font-medium normal-case">85% Complete</span>
                        </h4>
                        <div className="space-y-4">
                          {[
                            { label: 'Placements', current: member.placements, target: member.monthlyTarget * 4 },
                            { label: 'Revenue', current: member.revenueGenerated, target: member.revenueTarget * 4 },
                            { label: 'Activities', current: 850, target: member.activityTarget * 10 }
                          ].map((metric) => (
                            <div key={metric.label} className="space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className="text-slate-600 font-medium">{metric.label}</span>
                                <span className="text-slate-400">{metric.current} / {metric.target}</span>
                              </div>
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.min(100, (metric.current / metric.target) * 100)}%` }}
                                  className="h-full bg-blue-600"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm h-64">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Placement Trends</h4>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={member.performanceData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                            <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {activeTab === 'assignments' && (
                    <div className="space-y-6">
                      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Client Portfolio ({member.assignedClients})</h4>
                        <div className="space-y-3">
                          {['TechNova Solutions', 'Global Finance Corp', 'HealthLine Systems', 'Creative Arts Inc'].map((client) => (
                            <div key={client} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg group hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100 transition-all">
                              <div className="flex items-center gap-3">
                                <div className="size-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-bold text-xs">
                                  {client.charAt(0)}
                                </div>
                                <span className="text-sm font-medium text-slate-900">{client}</span>
                              </div>
                              <IconButton icon={Briefcase} className="opacity-0 group-hover:opacity-100" />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Pipeline Load</h4>
                        <div className="flex gap-2">
                          {[
                            { label: 'Sourced', count: 15, color: 'bg-slate-400' },
                            { label: 'Screened', count: 8, color: 'bg-blue-400' },
                            { label: 'Interview', count: 5, color: 'bg-indigo-500' },
                            { label: 'Offer', count: 2, color: 'bg-emerald-500' }
                          ].map((stage) => (
                            <div key={stage.label} className="flex-1 flex flex-col items-center gap-1">
                              <div className={`w-full h-2 rounded-full ${stage.color}`} />
                              <span className="text-[10px] font-bold text-slate-900">{stage.count}</span>
                              <span className="text-[9px] text-slate-500 uppercase">{stage.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'commission' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                          <p className="text-xs text-slate-500 mb-1">Commission Rate</p>
                          <p className="text-xl font-bold text-slate-900">12%</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                          <p className="text-xs text-slate-500 mb-1">Lifetime Earned</p>
                          <p className="text-xl font-bold text-slate-900">${(member.commissionEarned * 5.2).toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recent Payouts</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-slate-400 border-b border-slate-100">
                                <th className="text-left font-medium py-3">ID</th>
                                <th className="text-left font-medium py-3">Amount</th>
                                <th className="text-right font-medium py-3">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[
                                { id: 'PL-5021', amount: 1200, status: 'Paid' },
                                { id: 'PL-4982', amount: 850, status: 'Paid' },
                                { id: 'PL-4890', amount: 1500, status: 'Pending' },
                              ].map((payout) => (
                                <tr key={payout.id} className="border-b border-slate-50 last:border-0">
                                  <td className="py-3 font-medium text-slate-900">{payout.id}</td>
                                  <td className="py-3 text-slate-600">${payout.amount}</td>
                                  <td className="py-3 text-right">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                      payout.status === 'Paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                    }`}>
                                      {payout.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 bg-white flex gap-3">
              <button className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-colors">
                Edit Member
              </button>
              <button className="flex-1 border border-slate-200 text-slate-700 py-2.5 rounded-xl font-bold hover:bg-slate-50 transition-colors">
                View Profile
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
