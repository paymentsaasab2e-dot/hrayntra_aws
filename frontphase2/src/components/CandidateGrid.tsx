import React from 'react';
import { 
  Eye, 
  FileText, 
  Mail, 
  MessageSquare, 
  Star, 
  MapPin, 
  Briefcase, 
  Clock,
  MoreVertical
} from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';
import { Candidate } from './CandidateTable';

interface CandidateGridProps {
  candidates: Candidate[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
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

export const CandidateGrid: React.FC<CandidateGridProps> = ({ 
  candidates, 
  selectedIds, 
  onToggleSelect 
}) => {
  return (
    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 bg-slate-50">
      {candidates.map((candidate) => (
        <div 
          key={candidate.id}
          className={`relative bg-white rounded-2xl border transition-all hover:shadow-xl hover:-translate-y-1 ${
            selectedIds.includes(candidate.id) 
              ? 'border-blue-500 ring-1 ring-blue-500 shadow-lg shadow-blue-50' 
              : 'border-slate-200 shadow-sm'
          }`}
        >
          {/* Top Selection & Hotlist */}
          <div className="absolute top-4 left-4 z-10">
            <input 
              type="checkbox" 
              checked={selectedIds.includes(candidate.id)}
              onChange={() => onToggleSelect(candidate.id)}
              className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shadow-sm"
            />
          </div>
          <div className="absolute top-4 right-4 z-10">
            <button className={`${candidate.hotlist ? 'text-amber-400' : 'text-slate-300 hover:text-amber-300'} transition-colors`}>
              <Star size={20} fill={candidate.hotlist ? 'currentColor' : 'none'} />
            </button>
          </div>

          {/* Profile Content */}
          <div className="p-6 flex flex-col items-center text-center">
            <div className="relative mb-4">
              <ImageWithFallback 
                src={candidate.avatar} 
                className="w-20 h-20 rounded-2xl object-cover ring-4 ring-white shadow-md"
                alt={candidate.name}
              />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm">
                <div className="w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
              </div>
            </div>

            <h3 className="text-base font-bold text-slate-900 mb-1">{candidate.name}</h3>
            <p className="text-sm font-medium text-slate-600 mb-0.5">{candidate.designation}</p>
            <p className="text-xs text-slate-400 mb-4">{candidate.company}</p>

            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border mb-4 ${getStageColor(candidate.stage)}`}>
              {candidate.stage}
            </span>

            <div className="w-full grid grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-50 rounded-lg p-2 flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 mb-1">Exp</span>
                <span className="text-sm font-bold text-slate-700">{candidate.experience}y</span>
              </div>
              <div className="bg-slate-50 rounded-lg p-2 flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 mb-1">Rating</span>
                <span className="text-sm font-bold text-slate-700">L{candidate.rating}</span>
              </div>
            </div>

            <div className="w-full space-y-2 mb-6">
              <div className="flex items-center gap-2 text-slate-500 justify-center">
                <MapPin size={14} className="shrink-0" />
                <span className="text-xs truncate">{candidate.location}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500 justify-center">
                <Briefcase size={14} className="shrink-0" />
                <span className="text-xs truncate">{candidate.assignedJobs[0] || 'Unassigned'}</span>
              </div>
            </div>
          </div>

          {/* Footer Actions - Static as requested */}
          <div className="border-t border-slate-100 p-3 bg-slate-50/50 rounded-b-2xl flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button className="p-2 text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg transition-all shadow-sm border border-transparent hover:border-slate-200" title="View Profile">
                <Eye size={16} />
              </button>
              <button className="p-2 text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg transition-all shadow-sm border border-transparent hover:border-slate-200" title="View Resume">
                <FileText size={16} />
              </button>
            </div>
            
            <div className="flex items-center gap-1">
              <button className="p-2 text-slate-500 hover:text-green-600 hover:bg-white rounded-lg transition-all shadow-sm border border-transparent hover:border-slate-200" title="WhatsApp">
                <MessageSquare size={16} />
              </button>
              <button className="p-2 text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg transition-all shadow-sm border border-transparent hover:border-slate-200" title="Email">
                <Mail size={16} />
              </button>
              <button className="p-2 text-slate-400 hover:bg-white rounded-lg transition-all shadow-sm border border-transparent hover:border-slate-200">
                <MoreVertical size={16} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
