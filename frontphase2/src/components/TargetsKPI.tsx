import React from 'react';
import { Target, TrendingUp, Award, Zap, BarChart3, ChevronRight } from 'lucide-react';
import { MOCK_TEAM, Badge } from './TeamComponents';
import { motion } from 'motion/react';
import { ImageWithFallback } from './ImageWithFallback';

export const TargetsKPIView = () => {
  return (
    <div className="space-y-6">
      {/* KPI Overview Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Overall Target', value: '78%', icon: Target, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Revenue Achieved', value: '$1.2M', icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Team Efficiency', value: '92%', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Top Performer', value: 'Sarah J.', icon: Award, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-lg ${kpi.bg}`}>
              <kpi.icon className={`size-5 ${kpi.color}`} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
              <p className="text-lg font-bold text-slate-900">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recruiter Targets Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900">Performance Tracking</h3>
          <p className="text-sm text-slate-500">Monthly progress against defined targets per recruiter.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/50">
              <tr className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-4">Recruiter</th>
                <th className="px-6 py-4">Monthly Placements</th>
                <th className="px-6 py-4">Revenue Target</th>
                <th className="px-6 py-4">Activity Target</th>
                <th className="px-6 py-4">Overall Progress</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {MOCK_TEAM.filter(m => m.role.includes('Recruiter')).map((member) => {
                const progress = Math.floor(Math.random() * 40) + 60;
                return (
                  <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full overflow-hidden">
                          <ImageWithFallback src={member.avatar} alt={member.name} className="size-full object-cover" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{member.name}</p>
                          <p className="text-xs text-slate-500">{member.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm text-slate-700 font-medium">{member.placements} / {member.monthlyTarget * 4}</span>
                        <div className="w-24 h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full" style={{ width: `${(member.placements / (member.monthlyTarget * 4)) * 100}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                      ${(member.revenueGenerated / 1000).toFixed(1)}k / ${(member.revenueTarget * 4 / 1000).toFixed(1)}k
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                      {Math.floor(Math.random() * 200) + 800} / {member.activityTarget * 10}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            className={`h-full rounded-full ${progress > 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-700">{progress}%</span>
                        {progress > 85 && <Badge variant="active">On Track</Badge>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-blue-600 hover:text-blue-800 text-sm font-bold flex items-center gap-1 justify-end ml-auto">
                        Details <ChevronRight className="size-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
