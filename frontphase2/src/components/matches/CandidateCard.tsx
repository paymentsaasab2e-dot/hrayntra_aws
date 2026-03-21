import React, { useState } from 'react';
import {
  Bookmark,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  DollarSign,
  ExternalLink,
  MapPin,
  MoreVertical,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { ImageWithFallback } from '../ImageWithFallback';
import AIAnalysisPanel from './AIAnalysisPanel';
import type { ActiveView, MatchCandidate, MatchStatus } from './types';

interface CandidateCardProps {
  candidate: MatchCandidate;
  activeView: ActiveView;
  isSelected: boolean;
  isSaved: boolean;
  isExpanded: boolean;
  copied: boolean;
  onToggleSelect: () => void;
  onToggleSave: () => void;
  onCopyLink: () => void;
  onToggleAnalysis: () => void;
  onViewProfile: () => void;
  onOpenPipeline: () => void;
  onOpenSubmit: () => void;
  onOpenReject: () => void;
  onOpenHistory: () => void;
  onOpenNotes: () => void;
  onExport: () => void;
  onRateMatch: (rating: number) => void;
}

const statusColors: Record<MatchStatus, string> = {
  New: 'bg-blue-50 text-blue-700 border-blue-200',
  Reviewed: 'bg-slate-50 text-slate-700 border-slate-200',
  'Sent to Pipeline': 'bg-[#CCFBF1] text-[#0F766E] border-teal-200',
  Submitted: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Selected: 'bg-[#D1FAE5] text-[#065F46] border-emerald-200',
  Rejected: 'bg-[#FEE2E2] text-[#991B1B] border-rose-200',
};

export default function CandidateCard({
  candidate,
  activeView,
  isSelected,
  isSaved,
  isExpanded,
  copied,
  onToggleSelect,
  onToggleSave,
  onCopyLink,
  onToggleAnalysis,
  onViewProfile,
  onOpenPipeline,
  onOpenSubmit,
  onOpenReject,
  onOpenHistory,
  onOpenNotes,
  onExport,
  onRateMatch,
}: CandidateCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuItems: Array<{ label: string; action: () => void }> = [
    { label: 'View History', action: onOpenHistory },
    { label: 'Reject Match', action: onOpenReject },
    { label: 'Add Note', action: onOpenNotes },
    { label: 'Export Profile', action: onExport },
  ];

  return (
    <div
      className={`rounded-[12px] border bg-white p-5 shadow-sm transition ${
        isSelected ? 'border-[#2563EB] ring-1 ring-[#2563EB]' : 'border-[#E5E7EB] hover:shadow-md'
      }`}
    >
      <div className="flex items-start gap-4">
        {activeView === 'internal' ? (
          <div className="pt-6">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
              className="h-4 w-4 rounded border-slate-300 text-[#2563EB]"
            />
          </div>
        ) : null}

        <div className="relative">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-sm font-bold text-slate-700">
            <ImageWithFallback src={candidate.photo} alt={candidate.name} className="h-full w-full object-cover" />
          </div>
          <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#2563EB] text-[10px] font-bold text-white">
            {candidate.score}%
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[15px] font-semibold text-slate-900">{candidate.name}</h3>
                <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${statusColors[candidate.status]}`}>
                  {candidate.status}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#6B7280]">
                <span className="flex items-center gap-1.5">
                  <Clock3 size={14} className="text-slate-400" />
                  {candidate.experience} years exp.
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} className="text-slate-400" />
                  {candidate.location}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-slate-400" />
                  {candidate.noticePeriod} notice
                </span>
                <span className="flex items-center gap-1.5">
                  <DollarSign size={14} className="text-slate-400" />
                  {candidate.salary.expected}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {candidate.skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full border border-[#E5E7EB] bg-white px-2.5 py-1 text-xs font-medium text-slate-600"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleSave}
                className={`rounded-lg p-2 transition ${
                  isSaved ? 'bg-amber-50 text-amber-500' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                }`}
                title="Save match"
              >
                <Bookmark size={18} className={isSaved ? 'fill-current' : ''} />
              </button>
              <button
                type="button"
                onClick={onCopyLink}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                title="Copy profile link"
              >
                <Copy size={18} />
              </button>
              {copied ? (
                <div className="absolute right-12 top-full mt-1 rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-medium text-white">
                  Link copied
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                title="More actions"
              >
                <MoreVertical size={18} />
              </button>

              {menuOpen ? (
                <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-xl border border-[#E5E7EB] bg-white p-2 shadow-xl">
                  {menuItems.map(({ label, action }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        action();
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <AnimatePresence>
            {activeView === 'internal' && isExpanded ? (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                <AIAnalysisPanel candidate={candidate} rating={candidate.matchRating} onRate={onRateMatch} />
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              {activeView === 'internal' ? (
                <button
                  type="button"
                  onClick={onToggleAnalysis}
                  className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 transition hover:text-[#2563EB]"
                >
                  {isExpanded ? 'Hide AI Analysis' : 'Show AI Analysis'}
                  <ChevronDown size={14} className={isExpanded ? 'rotate-180' : ''} />
                </button>
              ) : (
                <p className="text-xs italic text-slate-400">Candidate ready for your review</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onViewProfile}
                className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                View Profile
              </button>
              {activeView === 'internal' ? (
                <>
                  <button
                    type="button"
                    onClick={onOpenPipeline}
                    className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-[#2563EB] transition hover:bg-blue-100"
                  >
                    Send to Pipeline
                  </button>
                  <button
                    type="button"
                    onClick={onOpenSubmit}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    Submit to Client
                    <ChevronRight size={16} />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onViewProfile}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  Review Profile
                  <ExternalLink size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
