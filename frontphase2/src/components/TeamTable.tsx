import React from 'react';
import { Search, Filter, MoreVertical, Eye, Edit, Key, UserX, ChevronLeft, ChevronRight, Mail, Phone, Users, Briefcase, Target, Trophy, DollarSign } from 'lucide-react';
import { MOCK_TEAM, Badge, IconButton, TeamMember } from './TeamComponents';
import { ImageWithFallback } from './ImageWithFallback';

interface TeamTableProps {
  onSelectMember: (member: TeamMember) => void;
}

export const TeamTable: React.FC<TeamTableProps> = ({ onSelectMember }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Table Toolbar */}
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/30">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search recruiters..." 
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <select className="flex-1 md:flex-none px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none hover:bg-slate-50 transition-all">
            <option>All Roles</option>
            <option>Recruiter</option>
            <option>Admin</option>
            <option>Finance</option>
          </select>
          <select className="flex-1 md:flex-none px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none hover:bg-slate-50 transition-all">
            <option>All Status</option>
            <option>Active</option>
            <option>Suspended</option>
          </select>
          <IconButton icon={Filter} className="bg-white border border-slate-200 p-2.5 shadow-sm" />
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50">
            <tr className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              <th className="px-6 py-4">Recruiter</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Contact</th>
              <th className="px-6 py-4 text-center">Load</th>
              <th className="px-6 py-4 text-center">Perf</th>
              <th className="px-6 py-4 text-center">Earnings</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {MOCK_TEAM.map((member) => (
              <tr 
                key={member.id} 
                className="hover:bg-slate-50/80 transition-all cursor-pointer group"
                onClick={() => onSelectMember(member)}
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full overflow-hidden border-2 border-slate-100 group-hover:border-blue-200 transition-colors">
                      <ImageWithFallback src={member.avatar} alt={member.name} className="size-full object-cover" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{member.name}</p>
                      <p className="text-xs text-slate-500">Last: {member.lastLogin}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <Badge variant="role">{member.role}</Badge>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <Mail className="size-3 text-slate-400" /> {member.email}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Phone className="size-3" /> {member.phone}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-bold text-slate-700">{member.assignedClients + member.assignedJobs}</span>
                    <span className="text-[10px] text-slate-400 uppercase">Total</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                   <div className="flex flex-col items-center">
                    <span className="text-xs font-bold text-emerald-600">{member.placements}</span>
                    <span className="text-[10px] text-slate-400 uppercase">Placements</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                   <div className="flex flex-col items-center">
                    <span className="text-xs font-bold text-slate-900">${member.commissionEarned.toLocaleString()}</span>
                    <span className="text-[10px] text-slate-400 uppercase">Comm.</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <Badge variant={member.status === 'Active' ? 'active' : 'suspended'}>
                    {member.status}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <IconButton icon={Eye} />
                    <IconButton icon={Edit} />
                    <IconButton icon={Key} />
                    <IconButton icon={UserX} className="hover:text-rose-600" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
        <span className="text-sm text-slate-500 font-medium">Showing 1 to 4 of 24 members</span>
        <div className="flex items-center gap-1">
          <button className="p-2 border border-slate-200 rounded-lg text-slate-400 hover:bg-white disabled:opacity-50" disabled>
            <ChevronLeft className="size-4" />
          </button>
          {[1, 2, 3].map(p => (
            <button 
              key={p} 
              className={`size-8 flex items-center justify-center rounded-lg text-sm font-bold transition-all ${
                p === 1 ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'text-slate-600 hover:bg-white hover:border border-slate-200'
              }`}
            >
              {p}
            </button>
          ))}
          <button className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-white">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
