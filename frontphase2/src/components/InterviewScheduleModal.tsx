import React from 'react';
import { X, Calendar, Clock, Video, Users, Link as LinkIcon, FileText, ChevronDown, PlayCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InterviewScheduleModal({ isOpen, onClose }: ScheduleModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Schedule Interview</h2>
              <p className="text-sm text-slate-500">Create a new interview event for a candidate</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-200 rounded-full transition-colors"
            >
              <X className="size-5 text-slate-500" />
            </button>
          </div>

          {/* Form Content */}
          <div className="p-6 overflow-y-auto max-h-[75vh]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Candidate Selection */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Users className="size-4 text-slate-400" />
                  Candidate
                </label>
                <div className="relative">
                  <select className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm appearance-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none">
                    <option>Select Candidate</option>
                    <option>Sarah Jenkins</option>
                    <option>David Chen</option>
                    <option>Emma Watson</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Job Selection */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <FileText className="size-4 text-slate-400" />
                  Job / Client
                </label>
                <div className="relative">
                  <select className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm appearance-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none">
                    <option>Select Job</option>
                    <option>Senior UX Designer - Fintech</option>
                    <option>Fullstack Engineer - EcoStream</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Date */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Calendar className="size-4 text-slate-400" />
                  Date
                </label>
                <input 
                  type="date" 
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>

              {/* Time */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Clock className="size-4 text-slate-400" />
                  Time
                </label>
                <input 
                  type="time" 
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>

              {/* Interview Round */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <PlayCircle className="size-4 text-slate-400" />
                  Interview Round
                </label>
                <select className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none">
                  <option>HR Round</option>
                  <option>Technical Round</option>
                  <option>Client Round</option>
                  <option>Final Round</option>
                </select>
              </div>

              {/* Interview Mode */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Video className="size-4 text-slate-400" />
                  Mode
                </label>
                <div className="flex gap-2">
                  {['Video', 'Phone', 'In-Person'].map((mode) => (
                    <button 
                      key={mode}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${
                        mode === 'Video' 
                          ? 'bg-blue-50 border-blue-200 text-blue-600' 
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Meeting Link */}
              <div className="col-span-1 md:col-span-2 space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <LinkIcon className="size-4 text-slate-400" />
                  Meeting Link / Location
                </label>
                <input 
                  type="text" 
                  placeholder="Paste Zoom/Google Meet link or office address"
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>

              {/* Interviewers */}
              <div className="col-span-1 md:col-span-2 space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Users className="size-4 text-slate-400" />
                  Interviewer(s)
                </label>
                <div className="flex flex-wrap gap-2 p-2 min-h-[42px] bg-slate-50 border border-slate-200 rounded-xl">
                  {['Mike Ross', 'Harvey Specter'].map((name) => (
                    <span key={name} className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700">
                      {name}
                      <X className="size-3 text-slate-400 cursor-pointer hover:text-rose-500" />
                    </span>
                  ))}
                  <button className="text-xs font-semibold text-blue-600 hover:text-blue-700 pl-2">+ Add Interviewer</button>
                </div>
              </div>

              {/* Notes */}
              <div className="col-span-1 md:col-span-2 space-y-2">
                <label className="text-sm font-bold text-slate-700">Internal Notes (Optional)</label>
                <textarea 
                  rows={3}
                  placeholder="Add any specific instructions for the interviewer..."
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                ></textarea>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20" defaultChecked />
              <span className="text-xs font-medium text-slate-600">Send invite to candidate & interviewers</span>
            </label>
            <div className="flex items-center gap-3">
              <button 
                onClick={onClose}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-sm shadow-blue-100 transition-all active:scale-95">
                Schedule & Send Invite
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
