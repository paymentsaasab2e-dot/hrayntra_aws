export type ActiveView = 'internal' | 'client';
export type MatchMode = 'ai' | 'manual';
export type OpenModal = 'submit' | 'pipeline' | 'reject' | 'duplicate' | null;
export type MatchStatus =
  | 'New'
  | 'Reviewed'
  | 'Sent to Pipeline'
  | 'Submitted'
  | 'Selected'
  | 'Rejected';

export interface MatchFilters {
  skillMatch: number;
  expMin: number;
  expMax: number;
  location: string;
  salaryMin: number | null;
  salaryMax: number | null;
  noticePeriod: 'Immediate' | '15d' | '30d' | null;
  savedOnly: boolean;
}

export interface MatchJob {
  id: string;
  title: string;
  client: string;
  clientId?: string;
  clientContactId?: string;
  clientEmail?: string;
  location?: string;
  clientLocation?: string;
  status: 'Open' | 'Urgent' | 'On Hold';
  /** Required skills from the job, used to score manual/applied candidates client-side. */
  skills?: string[];
  /** Preferred (nice-to-have) skills — half weight when scoring. */
  preferredSkills?: string[];
  /** Free-form experience requirement string from the job (e.g. "3-5 years"). */
  experienceRequired?: string | null;
}

export interface MatchNote {
  id: string;
  text: string;
  createdAt: string;
  author: string;
}

export interface MatchActivity {
  id: string;
  title: string;
  description: string;
  timestamp: string;
}

export interface MatchSubmissionHistory {
  date: string;
  status: string;
}

export type AiScoreTierId = 'tier100_80' | 'tier80_60' | 'tier50_59' | 'tierBelow50';

export const AI_SCORE_TIERS: Array<{ id: AiScoreTierId; label: string; min: number; max: number }> = [
  { id: 'tier100_80', label: '100 – 80', min: 80, max: 100 },
  { id: 'tier80_60', label: '80 – 60', min: 60, max: 79.99 },
  { id: 'tier50_59', label: '50 – 59 (review)', min: 50, max: 59.99 },
  { id: 'tierBelow50', label: 'Below 50', min: 0, max: 49.99 },
];

export function tierForScore(score: number): AiScoreTierId {
  if (score >= 80) return 'tier100_80';
  if (score >= 60) return 'tier80_60';
  if (score >= 50) return 'tier50_59';
  return 'tierBelow50';
}

export type AiTierStats = Record<AiScoreTierId, number>;

/** Count AI matches per score tier (pipeline bands). */
export function computeAiTierStats(candidates: MatchCandidate[]): AiTierStats {
  const stats: AiTierStats = {
    tier100_80: 0,
    tier80_60: 0,
    tier50_59: 0,
    tierBelow50: 0,
  };
  for (const c of candidates) {
    stats[tierForScore(c.score)] += 1;
  }
  return stats;
}

export function tierSectionStyles(tierId: AiScoreTierId): {
  header: string;
  badge: string;
  title: string;
} {
  switch (tierId) {
    case 'tier100_80':
      return {
        header: 'border-violet-200/90 bg-violet-50/70',
        badge: 'text-violet-800 ring-violet-200/70',
        title: 'text-violet-900',
      };
    case 'tier80_60':
      return {
        header: 'border-emerald-200/90 bg-emerald-50/70',
        badge: 'text-emerald-800 ring-emerald-200/70',
        title: 'text-emerald-900',
      };
    case 'tier50_59':
      return {
        header: 'border-amber-200/90 bg-amber-50/60',
        badge: 'text-amber-800 ring-amber-200/70',
        title: 'text-amber-900',
      };
    default:
      return {
        header: 'border-slate-200/90 bg-slate-50/80',
        badge: 'text-slate-700 ring-slate-200/70',
        title: 'text-slate-800',
      };
  }
}

/**
 * Fit band aligned with product spec (see docs/MATCHING_PIPELINE_PHASE2_ADAPTED.md).
 * Scores below 60 are typically filtered or flagged as weak for recruiters.
 */
export function matchScoreBandLabel(score: number): string {
  if (score >= 90) return 'Excellent Fit';
  if (score >= 80) return 'Strong Fit';
  if (score >= 70) return 'Good Fit';
  if (score >= 60) return 'Fair Fit';
  if (score >= 50) return 'Review';
  return 'Low match';
}

/** Prefer recruiter-friendly band labels over generic backend "Below Threshold". */
export function displayMatchBand(score: number, apiBand?: string | null): string {
  const normalized = String(apiBand || '').trim();
  const lower = normalized.toLowerCase();
  if (
    normalized &&
    lower !== 'below threshold' &&
    lower !== 'below fit' &&
    lower !== 'below threshold.'
  ) {
    return normalized;
  }
  return matchScoreBandLabel(score);
}

export function scoreBadgeClass(score: number): string {
  if (score >= 90) return 'bg-violet-600 text-white';
  if (score >= 80) return 'bg-emerald-600 text-white';
  if (score >= 70) return 'bg-sky-600 text-white';
  if (score >= 60) return 'bg-teal-600 text-white';
  if (score >= 50) return 'bg-amber-500 text-white';
  return 'bg-slate-500 text-white';
}

export interface MatchCandidate {
  id: string;
  matchId: string;
  isAppliedCandidate?: boolean;
  /** Candidate scored from Phase 1 / candidatecommon pool (may have been materialized into tenant). */
  isPhase1Candidate?: boolean;
  name: string;
  photo: string;
  initials: string;
  score: number;
  skills: string[];
  experience: number;
  location: string;
  salary: {
    expected: string;
    currency: string;
    amount: number;
    fit: 'excellent' | 'good' | 'average' | 'poor';
  };
  noticePeriod: string;
  status: MatchStatus;
  matchSource: MatchMode;
  explanation: {
    skills: boolean | 'partial';
    experience: boolean | 'partial';
    location: boolean | 'partial';
    salary: boolean | 'partial';
    text: string;
    matchedSkills: string[];
    missingSkills: string[];
    roleRequirement: string;
    /** When API persists a band; otherwise UI derives via `matchScoreBandLabel(score)`. */
    scoreBand?: string;
    aiEngine?: {
      deterministicScore: number;
      aiScore: number | null;
      verdict: string;
      confidenceLevel: string;
      confidenceScore: number;
      breakdown?: {
        skills?: number;
        experience?: number;
        semantic?: number;
        cultural?: number;
      } & Record<string, number>;
      pipelineWeights?: { p1?: number; p2?: number; p3?: number; p4?: number };
      suggestion?: string;
      runId?: string;
      formula?: string;
    };
  };
  currentTitle: string;
  currentCompany: string;
  email: string;
  phone: string;
  resumeName: string;
  portfolioUrl?: string;
  savedAt?: string | null;
  notes: MatchNote[];
  activity: MatchActivity[];
  matchRating?: number;
  submittedHistory?: MatchSubmissionHistory | null;
}
