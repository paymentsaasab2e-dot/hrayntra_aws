import React from 'react';
import { 
  Eye, 
  FileText, 
  Mail, 
  Star, 
  MapPin, 
  Briefcase, 
  Clock,
  MoreVertical
} from 'lucide-react';
import { ImageWithFallback, initialsFromDisplayName } from '../../../components/ImageWithFallback';
import { Candidate } from './CandidateTable';
import {
  getCandidateStageBadgeClasses,
  getCandidateStageDotClasses,
  getCandidateStageLabel,
} from '../../../utils/candidateStage';
import { WhatsAppIcon } from '../../../components/icons/WhatsAppIcon';

interface CandidateGridProps {
  candidates: Candidate[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onViewProfile?: (candidate: Candidate) => void;
}

export const CandidateGrid: React.FC<CandidateGridProps> = ({ 
  candidates, 
  selectedIds, 
  onToggleSelect,
  onViewProfile,
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
                src={candidate.avatar || ''} 
                fallbackInitials={initialsFromDisplayName(candidate.name)}
                className="w-20 h-20 rounded-2xl object-cover ring-4 ring-white shadow-md"
                alt={candidate.name}
              />
              <div
                className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-white"
                title={getCandidateStageLabel(candidate.stage)}
              >
                <span
                  className={`h-3 w-3 rounded-full border-2 border-white ${getCandidateStageDotClasses(candidate.stage)}`}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => onViewProfile?.(candidate)}
              className="mb-1 text-base font-bold text-slate-900 hover:text-blue-600"
            >
              {candidate.name}
            </button>
            <p className="text-sm font-medium text-slate-600 mb-0.5">{candidate.designation}</p>
            <p className="text-xs text-slate-400 mb-4">{candidate.company}</p>

            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border mb-4 ${getCandidateStageBadgeClasses(candidate.stage)}`}>
              {getCandidateStageLabel(candidate.stage)}
            </span>

            <div className="w-full grid grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-50 rounded-lg p-2 flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 mb-1">Exp</span>
                <span className="text-sm font-bold text-slate-700">
                  {candidate.experienceLabel ??
                    (candidate.experience > 0
                      ? `${Number.isInteger(candidate.experience) ? candidate.experience : candidate.experience.toFixed(1)}y`
                      : '—')}
                </span>
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

          {/* Footer Actions — colored per-action like the Leads / Clients table. */}
          <div className="border-t border-slate-100 p-3 bg-slate-50/50 rounded-b-2xl flex items-center justify-between">
            <div className="inline-flex items-center gap-0.5 rounded-2xl bg-white/80 p-1 ring-1 ring-slate-200/60">
              <button
                className="flex h-8 w-8 items-center justify-center rounded-xl text-blue-600 hover:bg-white hover:text-blue-700 hover:shadow-sm transition-all"
                title="View Profile"
                onClick={() => onViewProfile?.(candidate)}
              >
                <Eye size={16} strokeWidth={2.25} />
              </button>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-xl text-indigo-600 hover:bg-white hover:text-indigo-700 hover:shadow-sm transition-all"
                title="View Resume"
              >
                <FileText size={16} strokeWidth={2.25} />
              </button>
            </div>

            <div className="inline-flex items-center gap-0.5 rounded-2xl bg-white/80 p-1 ring-1 ring-slate-200/60">
              <button
                className="flex h-8 w-8 items-center justify-center rounded-xl text-emerald-600 hover:bg-white hover:text-emerald-800 hover:shadow-sm transition-all"
                title="WhatsApp"
              >
                <WhatsAppIcon size={16} />
              </button>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-xl text-cyan-600 hover:bg-white hover:text-cyan-700 hover:shadow-sm transition-all"
                title="Email"
              >
                <Mail size={16} strokeWidth={2.25} />
              </button>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 hover:bg-white hover:text-slate-800 hover:shadow-sm transition-all"
                title="More"
              >
                <MoreVertical size={16} strokeWidth={2.25} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
