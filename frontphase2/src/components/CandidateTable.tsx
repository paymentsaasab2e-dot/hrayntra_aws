import React, { useState } from 'react';
import { 
  MoreHorizontal, 
  Eye, 
  FileText, 
  Phone, 
  Mail, 
  MessageSquare, 
  Star, 
  UserPlus, 
  ArrowRight,
  ChevronDown,
  ExternalLink,
  MapPin,
  Calendar,
  Briefcase
} from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';

export interface Candidate {
  id: string;
  name: string;
  avatar: string;
  designation: string;
  company: string;
  experience: number;
  location: string;
  assignedJobs: string[];
  stage: string;
  owner: string;
  lastActivity: string;
  hotlist: boolean;
  phone: string;
  email: string;
  skills: string[];
  noticePeriod: string;
  salary: { current: string; expected: string };
  source: string;
  rating: number;
}

interface CandidateTableProps {
  candidates: Candidate[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
}

const getStageColor = (stage: string) => {
  switch (stage.toLowerCase()) {
    case 'applied': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'shortlist': return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'screening': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'interviewing': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    case 'offered': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'hired': return 'bg-green-100 text-green-700 border-green-200';
    case 'rejected': return 'bg-rose-100 text-rose-700 border-rose-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

export const CandidateTable: React.FC<CandidateTableProps> = ({ 
  candidates, 
  selectedIds, 
  onToggleSelect, 
  onToggleSelectAll 
}) => {
  const allSelected = candidates.length > 0 && selectedIds.length === candidates.length;

  return (
    <div className="bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 w-10">
                <input 
                  type="checkbox" 
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </th>
              <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Candidate Name</th>
              <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Designation / Company</th>
              <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Exp</th>
              <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Location</th>
              <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned Job</th>
              <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Stage</th>
              <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Owner</th>
              <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Activity</th>
              <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">
                <Star size={14} className="mx-auto" />
              </th>
              <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Quick Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {candidates.map((candidate) => (
              <tr 
                key={candidate.id} 
                className={`hover:bg-slate-50/80 transition-colors ${selectedIds.includes(candidate.id) ? 'bg-blue-50/50' : ''}`}
              >
                <td className="px-6 py-4">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.includes(candidate.id)}
                    onChange={() => onToggleSelect(candidate.id)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <ImageWithFallback 
                        src={candidate.avatar} 
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-white"
                        alt={candidate.name}
                      />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-sm">
                        <div className="w-2.5 h-2.5 bg-green-500 rounded-full"></div>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 flex items-center gap-1">
                        {candidate.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">L{candidate.rating}</span>
                        <div className="flex gap-1">
                          {candidate.skills.slice(0, 1).map(skill => (
                            <span key={skill} className="text-[10px] text-slate-400">#{skill}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div>
                    <p className="text-sm text-slate-700 font-medium truncate max-w-[130px]">{candidate.designation}</p>
                    <p className="text-xs text-slate-500 truncate max-w-[130px]">{candidate.company}</p>
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  <span className="text-sm font-medium text-slate-600">{candidate.experience}y</span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <MapPin size={14} className="shrink-0" />
                    <span className="text-sm truncate max-w-[100px]">{candidate.location}</span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <Briefcase size={14} className="text-slate-400 shrink-0" />
                    <p className="text-sm text-slate-600 truncate max-w-[120px] font-medium">
                      {candidate.assignedJobs[0] || '--'}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getStageColor(candidate.stage)}`}>
                    {candidate.stage}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">
                      {candidate.owner.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="text-sm text-slate-600 truncate max-w-[80px]">{candidate.owner}</span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-1.5 text-slate-500 whitespace-nowrap">
                    <Calendar size={14} />
                    <span className="text-sm">{candidate.lastActivity}</span>
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  <button className={`${candidate.hotlist ? 'text-amber-400' : 'text-slate-300 hover:text-amber-300'} transition-colors`}>
                    <Star size={18} fill={candidate.hotlist ? 'currentColor' : 'none'} />
                  </button>
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <div className="flex items-center gap-1 mr-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                      <button className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded transition-all" title="View Profile">
                        <Eye size={15} />
                      </button>
                      <button className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded transition-all" title="View Resume">
                        <FileText size={15} />
                      </button>
                      <button className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-white rounded transition-all" title="WhatsApp">
                        <MessageSquare size={15} />
                      </button>
                      <button className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded transition-all" title="Email">
                        <Mail size={15} />
                      </button>
                    </div>
                    <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                      <MoreHorizontal size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
