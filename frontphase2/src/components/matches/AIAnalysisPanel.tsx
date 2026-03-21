import React from 'react';
import { AlertCircle, CheckCircle2, Sparkles, Star, XCircle } from 'lucide-react';
import type { MatchCandidate } from './types';

interface AIAnalysisPanelProps {
  candidate: MatchCandidate;
  rating?: number;
  onRate: (rating: number) => void;
}

function MatchIndicator({ state }: { state: boolean | 'partial' }) {
  if (state === true) return <CheckCircle2 size={14} className="text-emerald-500" />;
  if (state === 'partial') return <AlertCircle size={14} className="text-amber-500" />;
  return <XCircle size={14} className="text-rose-500" />;
}

export default function AIAnalysisPanel({ candidate, rating = 0, onRate }: AIAnalysisPanelProps) {
  const { explanation } = candidate;

  return (
    <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
      <div className="flex items-start gap-3">
        <Sparkles size={16} className="mt-0.5 text-[#2563EB]" />
        <div>
          <p className="text-sm font-semibold text-slate-900">AI Analysis</p>
          <p className="mt-1 text-sm leading-6 text-blue-900">{explanation.text}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-white/80 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <MatchIndicator state={explanation.skills} />
            Skills Match
          </div>
          <div className="flex flex-wrap gap-2">
            {explanation.matchedSkills.map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-white/80 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <MatchIndicator state={explanation.experience} />
            Experience Match
          </div>
          <p className="text-sm text-slate-600">
            Role asks for {explanation.roleRequirement}. Candidate has {candidate.experience} years.
          </p>
        </div>

        <div className="rounded-xl bg-white/80 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <MatchIndicator state={explanation.location} />
            Missing Skills
          </div>
          <div className="flex flex-wrap gap-2">
            {explanation.missingSkills.length ? (
              explanation.missingSkills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700"
                >
                  {skill}
                </span>
              ))
            ) : (
              <span className="text-sm text-slate-500">No significant skill gaps detected.</span>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-white/80 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <MatchIndicator state={explanation.salary} />
            Rate this match accuracy
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => onRate(star)}
                className="rounded p-1 transition hover:bg-slate-100"
              >
                <Star
                  size={18}
                  className={star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
