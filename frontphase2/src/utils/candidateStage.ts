export function getCandidateStageLabel(stage?: string | null) {
  const normalized = (stage || '').trim().toLowerCase();
  if (!normalized) return 'Unknown';
  if (normalized === 'new') return 'New';
  if (normalized === 'suggested') return 'Applied';
  if (normalized === 'shortlisted' || normalized === 'selected') return 'Shortlisted';
  if (normalized === 'reviewed') return 'Reviewed';
  if (normalized === 'offer sent' || normalized === 'offer_sent') return 'Offer Sent';
  if (normalized === 'offer accepted' || normalized === 'offer_accepted') return 'Offer Accepted';
  if (normalized === 'offer rejected' || normalized === 'offer_rejected') return 'Offer Rejected';
  if (normalized === 'joining scheduled' || normalized === 'joining_scheduled') return 'Joining Scheduled';
  if (normalized === 'replacement required' || normalized === 'replacement_required') return 'Replacement Required';
  if (normalized === 'no show' || normalized === 'no_show') return 'No Show';
  if (normalized === 'interview completed' || normalized === 'interview_completed') {
    return 'Interview completed';
  }
  if (normalized === 'interviewing' || normalized === 'interview') return 'Interviewing';
  if (normalized === 'offer' || normalized === 'offered') return 'Offer letter sent';
  if (normalized === 'withdrawn') return 'Withdrawn';
  if (normalized === 'replaced') return 'Replaced';
  if (normalized === 'joined') return 'Joined';
  if (normalized === 'hired') return 'Hired';
  if (normalized === 'rejected') return 'Rejected';
  if (normalized === 'failed') return 'Failed';
  return stage || 'Unknown';
}

/** Background-forward stage chips: saturated bg + white label text */
const STAGE_BADGE_CLASSES: Record<string, string> = {
  new: 'bg-green-500 text-white border-green-500',
  suggested: 'bg-blue-500 text-white border-blue-500',
  applied: 'bg-blue-500 text-white border-blue-500',
  screening: 'bg-violet-500 text-white border-violet-500',
  shortlist: 'bg-purple-500 text-white border-purple-500',
  shortlisted: 'bg-purple-500 text-white border-purple-500',
  interview: 'bg-amber-500 text-white border-amber-500',
  interviewing: 'bg-orange-500 text-white border-orange-500',
  interview_completed: 'bg-emerald-600 text-white border-emerald-600',
  assessment: 'bg-cyan-500 text-white border-cyan-500',
  technical: 'bg-indigo-500 text-white border-indigo-500',
  hr: 'bg-fuchsia-500 text-white border-fuchsia-500',
  offer: 'bg-emerald-500 text-white border-emerald-500',
  offered: 'bg-teal-500 text-white border-teal-500',
  offer_sent: 'bg-indigo-500 text-white border-indigo-500',
  offer_accepted: 'bg-blue-500 text-white border-blue-500',
  offer_rejected: 'bg-red-500 text-white border-red-500',
  joining_scheduled: 'bg-amber-500 text-white border-amber-500',
  replacement_required: 'bg-violet-500 text-white border-violet-500',
  no_show: 'bg-red-500 text-white border-red-500',
  hired: 'bg-emerald-600 text-white border-emerald-600',
  joined: 'bg-lime-600 text-white border-lime-600',
  rejected: 'bg-red-500 text-white border-red-500',
  withdrawn: 'bg-rose-500 text-white border-rose-500',
  on_hold: 'bg-slate-500 text-white border-slate-500',
  hold: 'bg-slate-500 text-white border-slate-500',
};

/** Distinct background colors for custom / job-specific pipeline stage names */
const CUSTOM_STAGE_PALETTE = [
  'bg-fuchsia-500 text-white border-fuchsia-500',
  'bg-cyan-500 text-white border-cyan-500',
  'bg-amber-500 text-white border-amber-500',
  'bg-teal-500 text-white border-teal-500',
  'bg-pink-500 text-white border-pink-500',
  'bg-indigo-500 text-white border-indigo-500',
  'bg-lime-600 text-white border-lime-600',
  'bg-orange-500 text-white border-orange-500',
  'bg-violet-500 text-white border-violet-500',
  'bg-blue-500 text-white border-blue-500',
] as const;

function normalizeStageKey(stage: string): string {
  return stage.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function hashStageKey(stage: string): number {
  let hash = 0;
  for (let i = 0; i < stage.length; i += 1) {
    hash = (hash << 5) - hash + stage.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function matchPartialStageKey(key: string): string | null {
  if (key.includes('applied')) return STAGE_BADGE_CLASSES.applied;
  if (key.includes('screen')) return STAGE_BADGE_CLASSES.screening;
  if (key.includes('shortlist')) return STAGE_BADGE_CLASSES.shortlist;
  if (key.includes('interview') && key.includes('complet')) {
    return STAGE_BADGE_CLASSES.interview_completed;
  }
  if (key.includes('interview')) return STAGE_BADGE_CLASSES.interviewing;
  if (key.includes('assess')) return STAGE_BADGE_CLASSES.assessment;
  if (key.includes('technical') || key === 'tech') return STAGE_BADGE_CLASSES.technical;
  if (key.includes('offer') && key.includes('reject')) return STAGE_BADGE_CLASSES.offer_rejected;
  if (key.includes('offer') && key.includes('accept')) return STAGE_BADGE_CLASSES.offer_accepted;
  if (key.includes('offer') && key.includes('sent')) return STAGE_BADGE_CLASSES.offer_sent;
  if (key.includes('joining') && key.includes('schedul')) return STAGE_BADGE_CLASSES.joining_scheduled;
  if (key.includes('replacement') && key.includes('required')) return STAGE_BADGE_CLASSES.replacement_required;
  if (key.includes('no') && key.includes('show')) return STAGE_BADGE_CLASSES.no_show;
  if (key.includes('offer')) return STAGE_BADGE_CLASSES.offer;
  if (key.includes('hire') || key.includes('joined')) return STAGE_BADGE_CLASSES.hired;
  if (key.includes('reject')) return STAGE_BADGE_CLASSES.rejected;
  if (key.includes('withdraw')) return STAGE_BADGE_CLASSES.withdrawn;
  if (key.includes('hold')) return STAGE_BADGE_CLASSES.on_hold;
  return null;
}

export function getCandidateStageBadgeClasses(stage?: string | null) {
  const raw = (stage || '').trim();
  if (!raw) return 'bg-slate-400 text-white border-slate-400';

  const key = normalizeStageKey(raw);
  if (STAGE_BADGE_CLASSES[key]) return STAGE_BADGE_CLASSES[key];

  const partial = matchPartialStageKey(key);
  if (partial) return partial;

  const paletteIndex = hashStageKey(key) % CUSTOM_STAGE_PALETTE.length;
  return CUSTOM_STAGE_PALETTE[paletteIndex];
}

/** Avatar status dot — same hue as the stage tag background */
export function getCandidateStageDotClasses(stage?: string | null): string {
  const badgeClasses = getCandidateStageBadgeClasses(stage);
  const bgClass = badgeClasses.split(/\s+/).find((token) => token.startsWith('bg-'));
  return bgClass || 'bg-slate-400';
}
