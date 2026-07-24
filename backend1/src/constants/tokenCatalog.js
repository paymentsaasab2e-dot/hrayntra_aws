/** Welcome grant when a candidate first reaches the dashboard. */
const WELCOME_TOKEN_AMOUNT = 20;

/**
 * Base earn rewards (first completion).
 * Repeats after undo use getRepeatEarnAmount() — 2nd cycle ~40%, 3rd+ ~20% (min 1).
 */
const EARN_REWARDS = {
  welcome: WELCOME_TOKEN_AMOUNT,
  'earn.cv_upload': 20,
  'earn.profile.basicInformation': 10,
  'earn.profile.summary': 5,
  'earn.profile.education': 10,
  'earn.profile.skills': 10,
  'earn.profile.languages': 5,
  'earn.profile.projects': 5,
  'earn.profile.careerPreferences': 5,
};

/** Profile section earns that reopen when the user undoes the section. */
const REOPENABLE_EARN_KEYS = new Set([
  'earn.profile.basicInformation',
  'earn.profile.summary',
  'earn.profile.education',
  'earn.profile.skills',
  'earn.profile.languages',
  'earn.profile.projects',
  'earn.profile.careerPreferences',
]);

/**
 * Account earn lifecycle — ordered path users follow.
 * `auto`: credited by system when the trigger already happened (no manual CTA).
 * `href`: where UI should send the user to complete the task.
 * `reopenable`: if user undoes the work, task becomes pending again (repeat credit smaller).
 */
const EARN_TASK_CATALOG = [
  {
    id: 'welcome',
    name: 'First login bonus',
    description: 'Automatic when you open the dashboard after signup',
    tokens: EARN_REWARDS.welcome,
    category: 'Onboarding',
    order: 1,
    stage: 'onboarding',
    auto: true,
    reopenable: false,
    href: '/candidate-dashboard',
  },
  {
    id: 'earn.cv_upload',
    name: 'Upload your CV',
    description: 'Upload a resume once (also credited if CV was added during signup)',
    tokens: EARN_REWARDS['earn.cv_upload'],
    category: 'Onboarding',
    order: 2,
    stage: 'onboarding',
    auto: false,
    reopenable: false,
    href: '/uploadcv',
  },
  {
    id: 'earn.profile.basicInformation',
    name: 'Complete basic details',
    description: 'Fill personal profile basics',
    tokens: EARN_REWARDS['earn.profile.basicInformation'],
    category: 'Profile',
    order: 3,
    stage: 'profile',
    auto: false,
    reopenable: true,
    href: '/profile?open=basic-information&tab=personal-details',
  },
  {
    id: 'earn.profile.summary',
    name: 'Add professional summary',
    description: 'Write your profile summary',
    tokens: EARN_REWARDS['earn.profile.summary'],
    category: 'Profile',
    order: 4,
    stage: 'profile',
    auto: false,
    reopenable: true,
    href: '/profile?open=summary&tab=personal-details',
  },
  {
    id: 'earn.profile.education',
    name: 'Add education',
    description: 'Complete education section',
    tokens: EARN_REWARDS['earn.profile.education'],
    category: 'Profile',
    order: 5,
    stage: 'profile',
    auto: false,
    reopenable: true,
    href: '/profile?open=education&tab=education',
  },
  {
    id: 'earn.profile.skills',
    name: 'Add skills',
    description: 'Complete skills section',
    tokens: EARN_REWARDS['earn.profile.skills'],
    category: 'Profile',
    order: 6,
    stage: 'profile',
    auto: false,
    reopenable: true,
    href: '/profile?open=skills&tab=skills',
  },
  {
    id: 'earn.profile.languages',
    name: 'Add languages',
    description: 'Complete languages section',
    tokens: EARN_REWARDS['earn.profile.languages'],
    category: 'Profile',
    order: 7,
    stage: 'profile',
    auto: false,
    reopenable: true,
    href: '/profile?open=languages&tab=skills',
  },
  {
    id: 'earn.profile.projects',
    name: 'Add a project',
    description: 'Complete projects section',
    tokens: EARN_REWARDS['earn.profile.projects'],
    category: 'Profile',
    order: 8,
    stage: 'profile',
    auto: false,
    reopenable: true,
    href: '/profile?open=projects&tab=projects-certifications',
  },
  {
    id: 'earn.profile.careerPreferences',
    name: 'Set career preferences',
    description: 'Complete career preferences',
    tokens: EARN_REWARDS['earn.profile.careerPreferences'],
    category: 'Profile',
    order: 9,
    stage: 'profile',
    auto: false,
    reopenable: true,
    href: '/profile?open=career-preferences&tab=job-preferences',
  },
];

/** Map profile completeness section key → earn reward id */
const PROFILE_SECTION_EARN_MAP = {
  basicInformation: 'earn.profile.basicInformation',
  summary: 'earn.profile.summary',
  education: 'earn.profile.education',
  skills: 'earn.profile.skills',
  languages: 'earn.profile.languages',
  projects: 'earn.profile.projects',
  careerPreferences: 'earn.profile.careerPreferences',
};

function getBaseEarnKey(earnKey) {
  if (!earnKey || typeof earnKey !== 'string') return earnKey;
  return earnKey.replace(/\.r\d+$/, '').replace(/\.open$/, '');
}

function isOpenMarkerService(service) {
  return typeof service === 'string' && service.endsWith('.open');
}

function isPaidEarnService(service, baseKey) {
  if (!service || !baseKey) return false;
  if (service === baseKey) return true;
  return new RegExp(`^${baseKey.replace(/\./g, '\\.')}\\.r\\d+$`).test(service);
}

/**
 * Cycle 1 = full reward; cycle 2 = 40%; cycle 3+ = 20% (minimum 1 token).
 */
function getRepeatEarnAmount(earnKey, cycleIndex = 1) {
  const baseKey = getBaseEarnKey(earnKey);
  const base = EARN_REWARDS[baseKey];
  if (base == null || base <= 0) return null;
  const cycle = Math.max(1, Number(cycleIndex) || 1);
  if (cycle <= 1) return base;
  if (cycle === 2) return Math.max(1, Math.floor(base * 0.4));
  return Math.max(1, Math.floor(base * 0.2));
}

function ledgerServiceForCycle(earnKey, cycleIndex) {
  const baseKey = getBaseEarnKey(earnKey);
  const cycle = Math.max(1, Number(cycleIndex) || 1);
  return cycle <= 1 ? baseKey : `${baseKey}.r${cycle}`;
}

function openMarkerService(earnKey) {
  return `${getBaseEarnKey(earnKey)}.open`;
}

/** LMS / AI service costs (tokens). Higher impact = higher cost. */
const SERVICE_COSTS = {
  'lms.resume.ai-improve': 10,
  'lms.resume.ats-check': 5,
  'lms.resume.generate-summary': 8,
  'lms.resume.tailor-summary': 10,
  'lms.resume.analyze': 8,
  'cveditor.ai-improve': 10,
  'lms.quizzes.generate': 15,
  'lms.interview.generate-set': 20,
  'lms.interview.ai-feedback': 15,
  'lms.interview.mock-session-start': 25,
  'lms.interview.unlock-request': 15,
  'lms.interview.unlock-interviewer': 20,
  'lms.notes.ai-action': 5,
  'lms.career-path.recommend-goal': 10,
};

/** Human-readable catalog for the Subscriptions page. */
const SERVICE_CATALOG = [
  {
    id: 'lms.resume.ai-improve',
    name: 'AI CV Edit',
    description: 'Improve resume sections with AI',
    cost: SERVICE_COSTS['lms.resume.ai-improve'],
    category: 'Resume',
  },
  {
    id: 'cveditor.ai-improve',
    name: 'AI CV Editor Improve',
    description: 'Rewrite selected text in the CV editor',
    cost: SERVICE_COSTS['cveditor.ai-improve'],
    category: 'Resume',
  },
  {
    id: 'lms.resume.ats-check',
    name: 'ATS Check',
    description: 'Scan resume for ATS compatibility',
    cost: SERVICE_COSTS['lms.resume.ats-check'],
    category: 'Resume',
  },
  {
    id: 'lms.resume.generate-summary',
    name: 'Generate Summary',
    description: 'AI-generated professional summary',
    cost: SERVICE_COSTS['lms.resume.generate-summary'],
    category: 'Resume',
  },
  {
    id: 'lms.resume.tailor-summary',
    name: 'Tailor Summary for Job',
    description: 'Rewrite summary for a target role',
    cost: SERVICE_COSTS['lms.resume.tailor-summary'],
    category: 'Resume',
  },
  {
    id: 'lms.resume.analyze',
    name: 'Resume Analyze',
    description: 'Deep AI analysis of your resume draft',
    cost: SERVICE_COSTS['lms.resume.analyze'],
    category: 'Resume',
  },
  {
    id: 'lms.quizzes.generate',
    name: 'Generate Quizzes',
    description: 'Create topic-based practice quizzes',
    cost: SERVICE_COSTS['lms.quizzes.generate'],
    category: 'Quizzes',
  },
  {
    id: 'lms.interview.generate-set',
    name: 'Generate Interview Set',
    description: 'AI interview question set for a role',
    cost: SERVICE_COSTS['lms.interview.generate-set'],
    category: 'Interview',
  },
  {
    id: 'lms.interview.ai-feedback',
    name: 'Interview AI Feedback',
    description: 'Score and feedback on your answers',
    cost: SERVICE_COSTS['lms.interview.ai-feedback'],
    category: 'Interview',
  },
  {
    id: 'lms.interview.mock-session-start',
    name: 'Mock Interview Session',
    description: 'Start a full AI mock interview',
    cost: SERVICE_COSTS['lms.interview.mock-session-start'],
    category: 'Interview',
  },
  {
    id: 'lms.interview.unlock-request',
    name: 'Unlock Be Interviewed',
    description: 'One-time unlock for interview request flow',
    cost: SERVICE_COSTS['lms.interview.unlock-request'],
    category: 'Interview',
  },
  {
    id: 'lms.interview.unlock-interviewer',
    name: 'Unlock Become Interviewer',
    description: 'One-time unlock for interviewer application flow',
    cost: SERVICE_COSTS['lms.interview.unlock-interviewer'],
    category: 'Interview',
  },
  {
    id: 'lms.notes.ai-action',
    name: 'Notes AI Action',
    description: 'Summarize, expand, or rewrite notes',
    cost: SERVICE_COSTS['lms.notes.ai-action'],
    category: 'Notes',
  },
  {
    id: 'lms.career-path.recommend-goal',
    name: 'Career Goal Recommend',
    description: 'AI-recommended career goal',
    cost: SERVICE_COSTS['lms.career-path.recommend-goal'],
    category: 'Career Path',
  },
  {
    id: 'lms.courses.unlock-premium',
    name: 'Premium Course Unlock',
    description: 'Typical cost to unlock a premium LMS course (actual cost varies by course)',
    cost: 25,
    category: 'Courses',
  },
  {
    id: 'lms.courses.unlock-certified',
    name: 'Certified Course Unlock',
    description: 'Typical cost to unlock a certified LMS course (actual cost varies by course)',
    cost: 50,
    category: 'Courses',
  },
];

/** Mock purchase packs (no real payment gateway yet). */
const PURCHASE_PACKS = [
  {
    id: 'starter',
    name: 'Starter',
    priceLabel: '$5',
    priceAmount: 5,
    currency: 'USD',
    tokens: 50,
  },
  {
    id: 'plus',
    name: 'Plus',
    priceLabel: '$10',
    priceAmount: 10,
    currency: 'USD',
    tokens: 120,
    popular: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    priceLabel: '$20',
    priceAmount: 20,
    currency: 'USD',
    tokens: 300,
  },
];

function getServiceCost(serviceId) {
  return SERVICE_COSTS[serviceId] ?? null;
}

function getPurchasePack(packageId) {
  return PURCHASE_PACKS.find((p) => p.id === packageId) || null;
}

function getEarnReward(earnKey) {
  const base = getBaseEarnKey(earnKey);
  if (EARN_REWARDS[earnKey] != null) return EARN_REWARDS[earnKey];
  // Repeat ledger keys like earn.profile.projects.r2
  const repeat = typeof earnKey === 'string' ? earnKey.match(/\.r(\d+)$/) : null;
  if (repeat) return getRepeatEarnAmount(base, Number(repeat[1]));
  return EARN_REWARDS[base] ?? null;
}

module.exports = {
  WELCOME_TOKEN_AMOUNT,
  SERVICE_COSTS,
  SERVICE_CATALOG,
  PURCHASE_PACKS,
  EARN_REWARDS,
  EARN_TASK_CATALOG,
  PROFILE_SECTION_EARN_MAP,
  REOPENABLE_EARN_KEYS,
  getServiceCost,
  getPurchasePack,
  getEarnReward,
  getBaseEarnKey,
  getRepeatEarnAmount,
  ledgerServiceForCycle,
  openMarkerService,
  isOpenMarkerService,
  isPaidEarnService,
};
