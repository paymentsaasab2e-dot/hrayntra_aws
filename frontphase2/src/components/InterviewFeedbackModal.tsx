import React, { useState } from 'react';
import { X, Star, ThumbsUp, ThumbsDown, AlertCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  interview: any;
}

export function InterviewFeedbackModal({ isOpen, onClose, interview }: FeedbackModalProps) {
  const [rating, setRating] = useState(0);
  const [recommendation, setRecommendation] = useState<'pass' | 'hold' | 'reject' | null>(null);

  if (!isOpen || !interview) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Post-Interview Evaluation</h2>
                <p className="text-sm text-slate-500">Provide feedback for {interview.candidate.name}</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="size-5 text-slate-500" />
              </button>
            </div>
            
            <div className="mt-4 flex items-center gap-4 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
              <div className="size-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Info className="size-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Interview Info</p>
                <p className="text-sm font-semibold text-slate-700">{interview.job} • {interview.round}</p>
              </div>
            </div>
          </div>

          {/* Feedback Form */}
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Rating */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-700">Overall Rating</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    onClick={() => setRating(num)}
                    className={`p-2 rounded-lg transition-all ${
                      rating >= num ? 'text-amber-500 bg-amber-50' : 'text-slate-300 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <Star className={`size-6 ${rating >= num ? 'fill-current' : ''}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Recommendation */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-700">Final Recommendation</label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setRecommendation('pass')}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    recommendation === 'pass' 
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                      : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  <ThumbsUp className="size-5" />
                  <span className="text-xs font-bold uppercase">Pass</span>
                </button>
                <button
                  onClick={() => setRecommendation('hold')}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    recommendation === 'hold' 
                      ? 'border-amber-500 bg-amber-50 text-amber-700' 
                      : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  <AlertCircle className="size-5" />
                  <span className="text-xs font-bold uppercase">Hold</span>
                </button>
                <button
                  onClick={() => setRecommendation('reject')}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    recommendation === 'reject' 
                      ? 'border-rose-500 bg-rose-50 text-rose-700' 
                      : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  <ThumbsDown className="size-5" />
                  <span className="text-xs font-bold uppercase">Reject</span>
                </button>
              </div>
            </div>

            {/* Qualitative Feedback */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Strengths</label>
                <textarea 
                  rows={2}
                  placeholder="What did the candidate do well?"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                ></textarea>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Concerns / Areas for Improvement</label>
                <textarea 
                  rows={2}
                  placeholder="Any red flags or technical gaps?"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                ></textarea>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Internal Notes</label>
                <p className="text-[10px] text-slate-400 mb-1 flex items-center gap-1">
                  <Info className="size-3" /> This will not be shared with the client or candidate.
                </p>
                <textarea 
                  rows={2}
                  placeholder="Private notes for the recruitment team..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                ></textarea>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-sm shadow-blue-100 transition-all active:scale-95">
              Submit Feedback
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
