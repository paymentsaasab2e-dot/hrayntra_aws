import type { BackendMatch } from './api';
import type { MatchCandidate } from '../components/matches/types';

/** Map API match row to UI candidate (same shape as Matches page). */
export function mapBackendMatch(match: BackendMatch): MatchCandidate {
  const rawMatchId = String(match.id || '');
  const pendingApplied = rawMatchId.startsWith('applied-pending-');
  const pendingAi = rawMatchId.startsWith('ai-pending-');
  return {
    id: match.candidateId,
    matchId: pendingApplied || pendingAi ? '' : rawMatchId,
    isAppliedCandidate: Boolean(match.isAppliedCandidate || pendingApplied),
    isPhase1Candidate: Boolean(match.isPhase1Candidate),
    name: match.name,
    photo: match.photo,
    initials: match.initials,
    score: match.score,
    skills: match.skills,
    experience: match.experience,
    location: match.location,
    salary: match.salary,
    noticePeriod: match.noticePeriod,
    status: match.status as MatchCandidate['status'],
    matchSource: match.matchSource,
    explanation: match.explanation,
    currentTitle: match.currentTitle,
    currentCompany: match.currentCompany,
    email: match.email,
    phone: match.phone,
    resumeName: match.resumeName,
    portfolioUrl: match.portfolioUrl,
    savedAt: match.savedAt,
    notes: match.notes,
    activity: match.activity,
    matchRating: match.matchRating || undefined,
    submittedHistory: match.submittedHistory || null,
  };
}
