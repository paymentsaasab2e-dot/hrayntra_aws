import React from 'react';
import { AlertCircle, CheckCircle2, Sparkles, Star, XCircle } from 'lucide-react';
import type { MatchCandidate } from './types';
import { displayMatchBand } from './types';

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

function bandBadgeClass(band: string): string {
  if (band === 'Excellent Fit') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (band === 'Strong Fit') return 'bg-sky-100 text-sky-900 border-sky-200';
  if (band === 'Good Fit') return 'bg-amber-50 text-amber-900 border-amber-200';
  if (band === 'Fair Fit') return 'bg-orange-50 text-orange-900 border-orange-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

export default function AIAnalysisPanel({ candidate, rating = 0, onRate }: AIAnalysisPanelProps) {
  const { explanation } = candidate;
  const band = displayMatchBand(candidate.score, explanation.scoreBand);
  const ai = explanation.aiEngine;
  const bd = ai?.breakdown;
  const weights = ai?.pipelineWeights;
  const breakdownEntries =
    ai?.breakdown && typeof ai.breakdown === 'object'
      ? Object.entries(ai.breakdown).filter(([, v]) => typeof v === 'number' && !Number.isNaN(v))
      : [];
  const missingSkillsState: boolean | 'partial' =
    explanation.missingSkills.length > 0 ? (explanation.skills === true ? 'partial' : false) : true;

  const weightPct = (w?: number) => (w == null || Number.isNaN(w) ? '—' : `${Math.round(w * 100)}%`);
  const showPassWeightTable =
    candidate.matchSource === 'ai' &&
    weights &&
    bd &&
    typeof bd.skills === 'number' &&
    typeof bd.experience === 'number' &&
    typeof bd.semantic === 'number';

  return (
    <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Sparkles size={16} className="mt-0.5 shrink-0 text-[#2563EB]" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">AI Analysis</p>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${bandBadgeClass(band)}`}
              >
                {band}
              </span>
              {candidate.matchSource === 'ai' && ai?.verdict ? (
                <span className="rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
                  {ai.verdict}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm leading-6 text-blue-900">{explanation.text}</p>
            {ai?.confidenceLevel ? (
              <p className="mt-1 text-xs text-slate-600">
                Confidence: <span className="font-semibold text-slate-800">{ai.confidenceLevel}</span>
                {typeof ai.confidenceScore === 'number' ? (
                  <span className="text-slate-500"> ({Math.round(ai.confidenceScore)}%)</span>
                ) : null}
                {typeof ai.deterministicScore === 'number' || typeof ai.aiScore === 'number' ? (
                  <span className="text-slate-500">
                    {' '}
                    · deterministic {Math.round(Number(ai.deterministicScore ?? 0))}
                    {typeof ai.aiScore === 'number' ? ` · AI ${Math.round(ai.aiScore)}` : ''}
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {showPassWeightTable ? (
        <div className="mt-4 overflow-x-auto rounded-xl border border-blue-100 bg-white/90 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Pass breakdown</p>
          <table className="w-full min-w-[280px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Pass</th>
                <th className="py-2 pr-3">Score</th>
                <th className="py-2">Weight</th>
              </tr>
            </thead>
            <tbody className="text-slate-800">
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-3 font-medium">Skills</td>
                <td className="py-2 pr-3 tabular-nums">{Math.round(bd.skills)}</td>
                <td className="py-2 tabular-nums text-slate-600">{weightPct(weights.p1)}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-3 font-medium">Experience</td>
                <td className="py-2 pr-3 tabular-nums">{Math.round(bd.experience)}</td>
                <td className="py-2 tabular-nums text-slate-600">{weightPct(weights.p2)}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-3 font-medium">Semantic</td>
                <td className="py-2 pr-3 tabular-nums">{Math.round(bd.semantic)}</td>
                <td className="py-2 tabular-nums text-slate-600">{weightPct(weights.p3)}</td>
              </tr>
              <tr>
                <td className="py-2 pr-3 font-medium">Cultural fit</td>
                <td className="py-2 pr-3 tabular-nums">
                  {typeof bd.cultural === 'number' ? Math.round(bd.cultural) : '—'}
                </td>
                <td className="py-2 tabular-nums text-slate-600">{weightPct(weights.p4)}</td>
              </tr>
            </tbody>
          </table>
          {ai?.formula ? <p className="mt-2 font-mono text-[11px] leading-relaxed text-slate-500">{ai.formula}</p> : null}
        </div>
      ) : breakdownEntries.length > 0 ? (
        <div className="mt-4 rounded-xl border border-blue-100 bg-white/90 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Engine score breakdown</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {breakdownEntries.map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="capitalize text-slate-600">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                <span className="font-semibold tabular-nums text-slate-900">{Math.round(value)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

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
            <MatchIndicator state={missingSkillsState} />
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
