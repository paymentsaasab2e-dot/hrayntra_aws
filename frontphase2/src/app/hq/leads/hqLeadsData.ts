export type HqLeadStage =
  | 'new'
  | 'contacted'
  | 'demo_scheduled'
  | 'proposal_sent'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost';

export type HqLeadScore = 'Hot' | 'Warm' | 'Cold';

export type HqLeadRow = {
  id: string;
  name: string;
  company: string;
  industry: string;
  score: HqLeadScore;
  users: number;
  owner: string;
  stage: HqLeadStage;
  nextFollowUp: string;
  email?: string;
  phone?: string;
  country?: string;
  estimatedDealValue?: number;
  leadSource?: string;
  interestedModules?: string[];
  initialNotes?: string;
  createdAt?: string | null;
};

export const HQ_LEAD_MODULE_OPTIONS = [
  'Recruitment',
  'Payroll',
  'Time & Attendance',
  'Employee Management',
  'Performance',
] as const;

export const HQ_LEAD_STAGE_LABELS: Record<HqLeadStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  demo_scheduled: 'Demo Scheduled',
  proposal_sent: 'Proposal Sent',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

export const HQ_LEAD_TABS: { id: 'all' | HqLeadStage; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'demo_scheduled', label: 'Demo Scheduled' },
  { id: 'proposal_sent', label: 'Proposal Sent' },
  { id: 'negotiation', label: 'Negotiation' },
  { id: 'closed_won', label: 'Closed Won' },
  { id: 'closed_lost', label: 'Closed Lost' },
];

export function countLeadsByStage(leads: HqLeadRow[] = []) {
  const counts: Record<string, number> = { all: leads.length };
  for (const tab of HQ_LEAD_TABS) {
    if (tab.id === 'all') continue;
    counts[tab.id] = leads.filter((l) => l.stage === tab.id).length;
  }
  return counts;
}

export function computeHqLeadStats(leads: HqLeadRow[]) {
  const newLeads = leads.filter((l) => l.stage === 'new').length;
  const won = leads.filter((l) => l.stage === 'closed_won').length;
  const lost = leads.filter((l) => l.stage === 'closed_lost').length;
  const followUpsToday = 0;
  const winRate = leads.length ? Math.round((won / leads.length) * 100) : 0;
  return { total: leads.length, newLeads, followUpsToday, won, lost, winRate };
}
