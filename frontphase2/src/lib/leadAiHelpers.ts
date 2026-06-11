import type { Priority } from '@/app/leads/types';

export type LeadAiGeneratedPayload = {
  companyName?: string;
  contactPerson?: string;
  directorSalutation?: string;
  designation?: string;
  email?: string;
  phone?: string;
  emails?: string[];
  phones?: string[];
  type?: string;
  source?: string;
  status?: string;
  priority?: Priority | string;
  interestedNeeds?: string;
  notes?: string;
  expectedBusinessValue?: string;
  industry?: string;
  companySize?: string;
  website?: string;
  linkedIn?: string;
  location?: string;
  country?: string;
  city?: string;
  state?: string;
  campaignName?: string;
  campaignLink?: string;
  referralName?: string;
  sourceWebsiteUrl?: string;
  sourceLinkedInUrl?: string;
  sourceEmail?: string;
  otherDetails?: Array<{ label: string; value: string }>;
  lastFollowUp?: string;
  nextFollowUp?: string;
  assignedToId?: string;
};

export type LeadAiInsights = {
  score: number;
  priority: Priority;
  nextAction: string;
  followUpHint: string;
  packageSuggestion: string;
};

export function buildLeadAiMissingMessage(form: {
  companyName?: string;
  email?: string;
  emails?: string[];
}): string | null {
  const missing: string[] = [];
  if (!String(form.companyName || '').trim()) missing.push('Company name');
  if (!String(form.email || '').trim()) missing.push('Valid email address');

  if (!missing.length) return null;

  return `I filled what I could. Still needed before you can create this lead: ${missing.join(', ')}. Optional but helpful: director name, phone, services needed, follow-up date.`;
}

export function computeLeadAiInsights(
  form: {
    companyName?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    interestedNeeds?: string;
    notes?: string;
    website?: string;
    linkedIn?: string;
    nextFollowUp?: string;
    priority?: string;
  },
  sourceText = '',
): LeadAiInsights {
  const text = `${sourceText} ${form.notes || ''} ${form.interestedNeeds || ''}`.toLowerCase();
  let score = 0;

  if (/\b(budget|lakh|crore|₹|\$|usd|inr|value|revenue|deal)\b/i.test(text) || String(form.notes || '').trim()) {
    score += 20;
  }
  if (String(form.contactPerson || '').trim()) score += 20;
  if (String(form.nextFollowUp || '').trim() || /\b(next week|tomorrow|follow up|within \d+ days?)\b/i.test(text)) {
    score += 15;
  }
  if (String(form.website || '').trim() || String(form.linkedIn || '').trim()) score += 10;
  if (String(form.email || '').trim()) score += 15;
  if (String(form.phone || '').trim()) score += 10;
  if (String(form.interestedNeeds || '').trim()) score += 10;

  score = Math.min(100, score);

  const priority: Priority = score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low';
  const service = String(form.interestedNeeds || '').trim() || 'recruitment services';

  return {
    score,
    priority,
    nextAction: service.toLowerCase().includes('ats')
      ? 'Schedule ATS demo'
      : 'Schedule discovery call',
    followUpHint: String(form.nextFollowUp || '').trim()
      ? `Follow up on ${form.nextFollowUp}`
      : 'Contact within 3 business days',
    packageSuggestion: service.toLowerCase().includes('ats')
      ? 'ATS + bulk CV module'
      : `${service} package`,
  };
}
