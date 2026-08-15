import { type PeoplePerfProduct, type TenantEngineUserRow } from '@/lib/tenant-behavior-engine';

export type DeskHealthLabel = 'On track' | 'Stable' | 'Needs attention' | 'Inactive';

export type PeopleDeskInsight = {
  id: string;
  kind: 'health' | 'capacity' | 'follow' | 'load' | 'next';
  title: string;
  body: string;
  /** Why this number matters for a manager. */
  why?: string;
  /** Concrete next step. */
  action?: string;
  facts?: Array<{ label: string; value: string }>;
};

export type ScoreDriver = {
  key: 'completion' | 'utilization' | 'throughput' | 'balance';
  label: string;
  /** One-line meaning for a manager. */
  meaning: string;
  /** The operational number, e.g. "0h of 35h". */
  readout: string;
  weight: number;
  score: number;
};

export type PeopleSop = {
  hoursPerDay: number;
  workdays: number;
  /** Modules that count as real work for this desk (SOP / role book). */
  books: string[];
};

export const CRM_SOP_BOOKS = ['leads', 'clients', 'pipeline'] as const;
export const REC_SOP_BOOKS = ['jobs', 'candidates', 'interviews', 'placements', 'pipeline'] as const;

export function defaultSop(product: PeoplePerfProduct): PeopleSop {
  return {
    hoursPerDay: 7,
    workdays: 5,
    books: [...(product === 'crm' ? CRM_SOP_BOOKS : REC_SOP_BOOKS)],
  };
}

export type PeopleDeskScores = {
  health: number;
  healthLabel: DeskHealthLabel;
  healthTone: 'lime' | 'indigo' | 'amber' | 'rose';
  /** Productive hours / SOP hours (7h × days). */
  capacity: number;
  hours: number;
  productiveHours: number;
  otherHours: number;
  expectedHours: number;
  hoursPerDay: number;
  workdays: number;
  followThrough: number;
  loadPressure: number;
  closeRate: number;
  mix: Array<{ name: string; assigned: number; admin: number }>;
  utilization: Array<{ name: string; hours: number }>;
  recipe: string;
  drivers: ScoreDriver[];
  weakest: ScoreDriver;
  /** Plain-language gap, e.g. "0 of 35 assigned hours this week". */
  gapLine: string;
  insights: PeopleDeskInsight[];
};

const MIX_LABELS: Record<string, string> = {
  leads: 'Leads',
  clients: 'Clients',
  jobs: 'Jobs',
  candidates: 'Candidates',
  interviews: 'Interviews',
  placements: 'Placements',
  pipeline: 'Tasks / pipeline',
  matches: 'Matches',
  reports: 'Reports',
  dashboard: 'Dashboard',
  calendar: 'Calendar',
  tasks: 'Tasks',
  ai: 'AI',
};

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function healthLabel(score: number): { label: DeskHealthLabel; tone: PeopleDeskScores['healthTone'] } {
  if (score >= 72) return { label: 'On track', tone: 'lime' };
  if (score >= 50) return { label: 'Stable', tone: 'indigo' };
  if (score >= 28) return { label: 'Needs attention', tone: 'amber' };
  return { label: 'Inactive', tone: 'rose' };
}

function hoursFromMs(ms: number) {
  return Math.max(0, ms) / 3600000;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function scorePeopleDesk(
  user: TenantEngineUserRow | undefined,
  product: PeoplePerfProduct,
  sop: PeopleSop = defaultSop(product),
): PeopleDeskScores | null {
  if (!user) return null;
  const a = user.activity;
  const w = user.workload;
  const hoursPerDay = Math.min(12, Math.max(1, Number(sop.hoursPerDay) || 7));
  const workdays = Math.min(7, Math.max(1, Number(sop.workdays) || 5));
  const expected = hoursPerDay * workdays;
  const books = new Set((sop.books || []).map((b) => b.toLowerCase()));

  const mixMap = a.activeMsByCategory || {};
  let productiveMs = 0;
  for (const book of books) {
    productiveMs += Number(mixMap[book] || 0);
  }
  const totalMs = Math.max(a.activeMs, productiveMs);
  const hours = hoursFromMs(totalMs);
  const productiveHours = hoursFromMs(productiveMs);
  const otherHours = Math.max(0, hours - productiveHours);
  const capacity = expected > 0 ? clamp((productiveHours / expected) * 100) : 0;

  const visits = Math.max(a.visits, 1);
  const followThrough = clamp((a.actions / visits) * 180);

  const ownedOpen =
    product === 'crm'
      ? (books.has('leads') ? w.leads.open : 0) +
        (books.has('clients') ? w.clients.open : 0) +
        (books.has('pipeline') ? w.tasks.open : 0)
      : (books.has('jobs') ? w.jobs.open : 0) +
        (books.has('candidates') ? w.candidates.open : 0) +
        (books.has('interviews') ? w.interviews.open : 0);
  const ownedDone =
    product === 'crm'
      ? (books.has('leads') ? w.leads.done : 0) + (books.has('pipeline') ? w.tasks.done : 0)
      : (books.has('jobs') ? w.jobs.done : 0) +
        (books.has('placements') ? w.placements.done : 0) +
        (books.has('interviews') ? w.interviews.done : 0);
  const closeRate = clamp((ownedDone / Math.max(ownedOpen + ownedDone, 1)) * 100);
  const loadPressure = clamp(
    ownedOpen <= 0
      ? hours > 1
        ? 25
        : 10
      : (ownedOpen / Math.max(ownedOpen + ownedDone, ownedOpen)) * 70 + (w.tasks.overdue > 0 ? 20 : 0),
  );

  const health = clamp(followThrough * 0.35 + capacity * 0.25 + closeRate * 0.25 + (100 - loadPressure) * 0.15);
  const { label, tone } = healthLabel(health);

  const chartKeys = [...books, 'reports', 'dashboard', 'ai'];
  const mix = [...new Set(chartKeys)].map((key) => {
    const h = hoursFromMs(Number(mixMap[key] || 0));
    const assigned = books.has(key) ? h : 0;
    const admin = books.has(key) ? 0 : h;
    return { name: MIX_LABELS[key] || key, assigned: round1(assigned), admin: round1(admin) };
  });
  const utilization = [
    { name: 'Assigned work', hours: round1(productiveHours) },
    { name: 'Admin / reports', hours: round1(otherHours) },
    { name: 'Unused standard hours', hours: round1(Math.max(0, expected - productiveHours)) },
  ];

  const assignedTotal = ownedOpen + ownedDone;
  const drivers: ScoreDriver[] = [
    {
      key: 'completion',
      label: 'Records updated',
      meaning: 'When they open a record, do they actually change it (note, stage, or status)?',
      readout: `${a.actions} updated / ${a.visits} opened`,
      weight: 35,
      score: followThrough,
    },
    {
      key: 'utilization',
      label: 'Assigned hours',
      meaning: 'Time spent on assigned work versus the standard week you set above.',
      readout: `${round1(productiveHours)}h of ${expected}h week`,
      weight: 25,
      score: capacity,
    },
    {
      key: 'throughput',
      label: 'Work finished',
      meaning: 'Of assigned items, how many are done versus still sitting open.',
      readout: assignedTotal ? `${ownedDone} done / ${assignedTotal} assigned` : '0 done / 0 assigned',
      weight: 25,
      score: closeRate,
    },
    {
      key: 'balance',
      label: 'Open workload',
      meaning: 'How piled-up the desk is. High open volume or overdue items means the queue is crowding the week.',
      readout:
        w.tasks.overdue > 0
          ? `${ownedOpen} still open · ${w.tasks.overdue} overdue`
          : `${ownedOpen} still open`,
      weight: 15,
      score: clamp(100 - loadPressure),
    },
  ];
  const weakest = drivers.reduce((a, b) => (b.score < a.score ? b : a));
  const gapLine =
    weakest.key === 'utilization'
      ? `${round1(productiveHours)} of ${expected} assigned hours this week`
      : weakest.key === 'completion'
        ? `${a.actions} updates out of ${a.visits} record views`
        : weakest.key === 'throughput'
          ? `${ownedDone} finished out of ${assignedTotal} assigned`
          : `${ownedOpen} still open${w.tasks.overdue > 0 ? ` · ${w.tasks.overdue} overdue` : ''}`;
  const recipe = `Score mixes records updated, assigned hours vs the week, work finished, and open workload. Standard week ${hoursPerDay}h × ${workdays}d = ${expected}h.`;

  const unusedH = round1(Math.max(0, expected - productiveHours));
  const bookList = [...books].map((b) => MIX_LABELS[b] || b).join(', ') || 'role modules';

  let healthWhy =
    'Use this to decide whether to coach, reassign work, or leave the seat as-is — not as a productivity ranking.';
  let healthAction = 'Keep the current mix of assigned work.';
  if (productiveHours < 1 && ownedOpen <= 0) {
    healthWhy = 'The score is low because almost no assigned work exists and almost no assigned-module time was recorded.';
    healthAction = product === 'crm'
      ? 'Assign 5–10 leads or clients to this seat, then re-check in 7 days. Do not judge performance until work is on the desk.'
      : 'Assign at least one open job and a candidate slate, then re-check in 7 days.';
  } else if (productiveHours < 1 && ownedOpen > 0) {
    healthWhy = `${ownedOpen} records sit on this desk, but only ${round1(productiveHours)}h was spent in ${bookList}. Time is either elsewhere or the seat is unused.`;
    healthAction =
      'Confirm they open assigned records (not only dashboard/reports). If they cannot access those modules, fix access before coaching.';
  } else if (weakest.key === 'completion') {
    healthWhy = `Records are opened more than they are updated: ${a.actions} updates vs ${a.visits} views. Hours can look busy while work does not move.`;
    healthAction = 'Ask for a stage change or note on every opened record today. Stop list-only browsing until the rate lifts.';
  } else if (weakest.key === 'utilization') {
    healthWhy = `Only ${round1(productiveHours)}h of ${expected}h went to assigned work. ${unusedH}h of the standard week is unused.`;
    healthAction =
      otherHours > productiveHours
        ? 'Cut admin/report time this week and put those hours on assigned records.'
        : 'Fill unused hours with the oldest open items — do not add new volume until utilization is above 50%.';
  } else if (weakest.key === 'throughput') {
    healthWhy = `Work finished is ${ownedDone} of ${assignedTotal} assigned. Items are touched but not closing.`;
    healthAction = 'Close or advance the oldest open items first. Freeze new assignments until done ≥ open.';
  } else {
    healthWhy = `Workload pressure is high (${loadPressure}%). Open volume is crowding out completion.`;
    healthAction =
      w.tasks.overdue > 0
        ? `Clear ${w.tasks.overdue} overdue task${w.tasks.overdue === 1 ? '' : 's'} before any new intake.`
        : 'Cap new assignments until open volume drops.';
  }

  const insights: PeopleDeskInsight[] = [];
  insights.push({
    id: 'health',
    kind: 'health',
    title: `${label} · ${gapLine}`,
    body: `Composite ${health}/100. ${healthWhy}`,
    why: healthWhy,
    action: healthAction,
    facts: [
      { label: 'Assigned hours', value: `${round1(productiveHours)}h / ${expected}h` },
      { label: 'Still open', value: `${ownedOpen}` },
      { label: 'Finished', value: `${ownedDone}` },
      { label: 'Updates / views', value: `${a.actions} / ${a.visits}` },
    ],
  });

  const capAction =
    capacity < 25
      ? ownedOpen > 0
        ? `They have ${ownedOpen} open assigned records but only ${round1(productiveHours)}h in those modules. Direct the next block of time onto those records.`
        : 'There is almost nothing assigned. Add work that matches this role, or this seat will stay unused.'
      : capacity > 100
        ? 'Hours already exceed the standard week. Watch quality and overdue items; do not add more volume.'
        : 'Keep assigned-module time at this level if completion also holds.';

  insights.push({
    id: 'capacity',
    kind: 'capacity',
    title: `${round1(productiveHours)}h assigned of ${expected}h week`,
    body: capAction,
    why: `Standard week = ${hoursPerDay}h/day × ${workdays} days. Assigned time is only ${bookList}. Dashboard, reports and AI count as admin.`,
    action: capAction,
    facts: [
      { label: 'Assigned work', value: `${round1(productiveHours)}h` },
      { label: 'Admin / reports', value: `${round1(otherHours)}h` },
      { label: 'Unused week', value: `${unusedH}h` },
    ],
  });

  const followAction =
    followThrough < 20
      ? `${a.visits} views produced ${a.actions} updates. Require an update (stage, note, or status) before leaving a record.`
      : followThrough >= 50
        ? 'When they open a record they usually update it. Protect this habit; use unused hours to open more assigned records.'
        : 'Some views still end with no update. Target a 1:1 view-to-update habit on assigned work.';

  insights.push({
    id: 'follow',
    kind: 'follow',
    title: followThrough < 20 ? 'Browsing more than finishing' : followThrough >= 50 ? 'Updates keep pace with views' : 'Completion is mixed',
    body: followAction,
    why: 'Completion is updates ÷ views. It tells you if time in the product moves records, not whether they sat at the desk.',
    action: followAction,
    facts: [
      { label: 'Updates', value: `${a.actions}` },
      { label: 'Views', value: `${a.visits}` },
      { label: 'Rate', value: `${followThrough}%` },
    ],
  });

  if (product === 'crm') {
    const loadAction =
      w.tasks.overdue > 0
        ? `Clear ${w.tasks.overdue} overdue task${w.tasks.overdue === 1 ? '' : 's'} before taking new leads.`
        : ownedOpen > 8 && a.actions < 5
          ? `Pipeline is ${ownedOpen} open vs ${a.actions} updates. Stop new leads; work the oldest ${Math.min(5, ownedOpen)} first.`
          : w.leads.open > 0
            ? `Spend the next hour on the two oldest of ${w.leads.open} open leads (call, note, or convert).`
            : 'Assign leads or clients that match this role, or utilization cannot improve.';
    insights.push({
      id: 'load',
      kind: 'load',
      title: `${w.leads.open} open leads · ${w.tasks.open} tasks`,
      body: loadAction,
      why: 'Open vs done shows whether assigned volume is converting. Overdue tasks are the first risk to SLA.',
      action: loadAction,
      facts: [
        { label: 'Open leads', value: `${w.leads.open}` },
        { label: 'Open clients', value: `${w.clients.open}` },
        { label: 'Open tasks', value: `${w.tasks.open}` },
        { label: 'Overdue', value: `${w.tasks.overdue}` },
        { label: 'Done this period', value: `${ownedDone}` },
      ],
    });
    insights.push({
      id: 'next',
      kind: 'next',
      title: 'Do this next',
      body: healthAction,
      action: healthAction,
    });
  } else {
    const loadAction =
      w.interviews.open > 0
        ? `Complete feedback on ${w.interviews.open} open interview${w.interviews.open === 1 ? '' : 's'}, then one offer.`
        : w.jobs.open > 0 && w.candidates.open === 0
          ? `${w.jobs.open} jobs are assigned with no candidates. Source two candidates against those jobs this week.`
          : w.jobs.open > 0
            ? `Submit two candidates against the ${w.jobs.open} open job${w.jobs.open === 1 ? '' : 's'}.`
            : 'Assign a job and candidates if this seat is meant to recruit. Otherwise the unused week is expected.';
    insights.push({
      id: 'load',
      kind: 'load',
      title: `${w.jobs.open} jobs · ${w.interviews.open} interviews`,
      body: loadAction,
      why: 'Jobs without candidates, or interviews without feedback, stall placements even if hours look used.',
      action: loadAction,
      facts: [
        { label: 'Open jobs', value: `${w.jobs.open}` },
        { label: 'Open candidates', value: `${w.candidates.open}` },
        { label: 'Open interviews', value: `${w.interviews.open}` },
        { label: 'Placements done', value: `${w.placements.done}` },
      ],
    });
    insights.push({
      id: 'next',
      kind: 'next',
      title: 'Do this next',
      body: healthAction,
      action: healthAction,
    });
  }

  return {
    health,
    healthLabel: label,
    healthTone: tone,
    capacity,
    hours,
    productiveHours: round1(productiveHours),
    otherHours: round1(otherHours),
    expectedHours: expected,
    hoursPerDay,
    workdays,
    followThrough,
    loadPressure,
    closeRate,
    mix,
    utilization,
    recipe,
    drivers,
    weakest,
    gapLine,
    insights,
  };
}

export function teamHealthRows(users: TenantEngineUserRow[], product: PeoplePerfProduct, sop?: PeopleSop) {
  const resolved = sop || defaultSop(product);
  return users.map((u, i) => {
    const s = scorePeopleDesk(u, product, resolved);
    return {
      name: `M${i + 1}`,
      member: `Member ${i + 1}`,
      userId: u.userId,
      health: s?.health || 0,
      capacity: s?.capacity || 0,
      follow: s?.followThrough || 0,
      hours: s?.productiveHours || 0,
    };
  });
}
