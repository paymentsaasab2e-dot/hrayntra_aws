export function getCandidateStageLabel(stage?: string | null) {
  const normalized = (stage || '').trim().toLowerCase();
  if (!normalized) return 'Unknown';
  if (normalized === 'offer' || normalized === 'offered') return 'Offer letter sent';
  if (normalized === 'hired') return 'Hired';
  return stage || 'Unknown';
}

export function getCandidateStageBadgeClasses(stage?: string | null) {
  const normalized = (stage || '').trim().toLowerCase();
  switch (normalized) {
    case 'screening':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'interviewing':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'shortlist':
    case 'shortlisted':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'offer':
    case 'offered':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'hired':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'rejected':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}
