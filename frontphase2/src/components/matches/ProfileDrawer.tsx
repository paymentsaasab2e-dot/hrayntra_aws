import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Calendar, FileText, Sparkles, StickyNote, X } from 'lucide-react';
import { ImageWithFallback } from '../ImageWithFallback';
import type { MatchCandidate } from './types';

interface ProfileDrawerProps {
  isOpen: boolean;
  candidate: MatchCandidate | null;
  initialTab?: 'overview' | 'resume' | 'ai' | 'notes' | 'activity';
  onClose: () => void;
}

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'resume', label: 'Resume' },
  { id: 'ai', label: 'AI Score' },
  { id: 'notes', label: 'Notes' },
  { id: 'activity', label: 'Activity' },
] as const;

export default function ProfileDrawer({
  isOpen,
  candidate,
  initialTab = 'overview',
  onClose,
}: ProfileDrawerProps) {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  return (
    <AnimatePresence>
      {isOpen && candidate ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-slate-900/30"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="fixed right-0 top-0 z-[100] flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 overflow-hidden rounded-2xl bg-slate-100">
                  <ImageWithFallback src={candidate.photo} alt={candidate.name} className="h-full w-full object-cover" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{candidate.name}</h3>
                  <p className="mt-1 text-sm text-[#6B7280]">
                    {candidate.currentTitle} • {candidate.currentCompany}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="border-b border-[#E5E7EB] px-6">
              <div className="flex flex-wrap gap-2 py-3">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                      activeTab === tab.id
                        ? 'bg-[#2563EB] text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {activeTab === 'overview' ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    ['Email', candidate.email],
                    ['Phone', candidate.phone],
                    ['Location', candidate.location],
                    ['Experience', `${candidate.experience} years`],
                    ['Notice Period', candidate.noticePeriod],
                    ['Salary', candidate.salary.expected],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-[#E5E7EB] bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {activeTab === 'resume' ? (
                <div className="rounded-2xl border border-[#E5E7EB] p-5">
                  <div className="flex items-center gap-3">
                    <FileText size={18} className="text-[#2563EB]" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{candidate.resumeName}</p>
                      <p className="text-xs text-[#6B7280]">Resume and profile summary attached for recruiter review.</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === 'ai' ? (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-blue-50 p-5">
                    <div className="flex items-center gap-3">
                      <Sparkles size={18} className="text-[#2563EB]" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">AI Match Score</p>
                        <p className="text-3xl font-bold text-[#2563EB]">{candidate.score}%</p>
                      </div>
                    </div>
                    <p className="mt-4 text-sm text-slate-700">{candidate.explanation.text}</p>
                  </div>
                  <div className="rounded-2xl border border-[#E5E7EB] p-5">
                    <p className="text-sm font-semibold text-slate-900">Matched Skills</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {candidate.explanation.matchedSkills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === 'notes' ? (
                <div className="space-y-3">
                  {candidate.notes.map((note) => (
                    <div key={note.id} className="rounded-2xl border border-[#E5E7EB] p-4">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <StickyNote size={14} />
                        <span>{note.author}</span>
                        <span>•</span>
                        <span>{note.createdAt}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">{note.text}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {activeTab === 'activity' ? (
                <div className="space-y-3">
                  {candidate.activity.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-[#E5E7EB] p-4">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Calendar size={14} />
                        <span>{item.timestamp}</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
