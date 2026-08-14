/**
 * Phase 2 employer AI features that require coins.
 * Default costs — HQ can override these via AI Plans (`hq_ai_feature_costs`).
 * Runtime spend resolves cost through `hqAiFeaturesService.getCost`.
 */
export const PHASE2_AI_FEATURE_CATALOG = [
  {
    id: 'ai.job_from_prompt',
    name: 'AI job from prompt',
    description: 'Generate a full job posting from a short prompt',
    coins: 5,
    category: 'Jobs',
  },
  {
    id: 'ai.job_title_suggestions',
    name: 'Job title suggestions',
    description: 'AI-suggested job titles while creating a job',
    coins: 1,
    category: 'Jobs',
  },
  {
    id: 'ai.job_description',
    name: 'AI job description',
    description: 'Generate job description and screening questions',
    coins: 3,
    category: 'Jobs',
  },
  {
    id: 'ai.lead_details',
    name: 'Create lead with AI (paste)',
    description: 'Leads → Create with AI: paste notes to autofill the lead form',
    coins: 3,
    category: 'CRM',
  },
  {
    id: 'ai.lead_chat',
    name: 'Create lead with AI (chat)',
    description: 'Leads → Create with AI: each chat message while building a lead',
    coins: 2,
    category: 'CRM',
  },
  {
    id: 'ai.client_details',
    name: 'Create client with AI (paste)',
    description: 'Clients → Create with AI: paste notes to autofill the client form',
    coins: 3,
    category: 'CRM',
  },
  {
    id: 'ai.client_chat',
    name: 'Create client with AI (chat)',
    description: 'Clients → Create with AI: each chat message while building a client',
    coins: 2,
    category: 'CRM',
  },
  {
    id: 'ai.candidate_details',
    name: 'Create candidate with AI (paste)',
    description: 'Candidates → Create with AI: paste notes or CV text to autofill the form',
    coins: 3,
    category: 'Candidates',
  },
  {
    id: 'ai.candidate_chat',
    name: 'Create candidate with AI (chat)',
    description: 'Candidates → Create with AI: each chat message while building a candidate',
    coins: 2,
    category: 'Candidates',
  },
  {
    id: 'ai.smart_search',
    name: 'Smart search parse',
    description: 'Natural-language filters on list pages',
    coins: 1,
    category: 'Search',
  },
  {
    id: 'ai.assistant_chat',
    name: 'ARIA assistant chat',
    description: 'Floating ARIA workspace assistant message',
    coins: 2,
    category: 'Assistant',
  },
  {
    id: 'ai.aria_leads',
    name: 'ARIA leads agent',
    description: 'ARIA agent actions on leads (import / update)',
    coins: 5,
    category: 'Assistant',
  },
  {
    id: 'ai.entry_recommendations',
    name: 'Entry recommendations',
    description: 'Regenerate AI recommendations for an entry',
    coins: 2,
    category: 'Insights',
  },
  {
    id: 'ai.workspace_brief',
    name: 'Workspace brief',
    description: 'Generate AI workspace brief / alerts',
    coins: 3,
    category: 'Insights',
  },
  {
    id: 'ai.location_resolve',
    name: 'AI location resolve',
    description: 'Resolve ambiguous locations with AI',
    coins: 1,
    category: 'Utilities',
  },
  {
    id: 'ai.kyc_parse',
    name: 'KYC document parse',
    description: 'Extract fields from uploaded KYC documents',
    coins: 4,
    category: 'Utilities',
  },
];

const BY_ID = Object.fromEntries(PHASE2_AI_FEATURE_CATALOG.map((f) => [f.id, f]));

export function getAiFeature(featureId) {
  return BY_ID[String(featureId || '').trim()] || null;
}

/** Sync default cost only — prefer hqAiFeaturesService.getCost at runtime. */
export function getAiFeatureCost(featureId) {
  const feature = getAiFeature(featureId);
  return feature ? Number(feature.coins) || 0 : 0;
}

export function listAiFeatures() {
  return PHASE2_AI_FEATURE_CATALOG.map((f) => ({ ...f }));
}

export function listAiFeaturesWithLockState(balance, features = PHASE2_AI_FEATURE_CATALOG) {
  const coins = Math.max(0, Number(balance) || 0);
  return features.map((f) => ({
    ...f,
    locked: coins < (Number(f.coins) || 0),
    affordable: coins >= (Number(f.coins) || 0),
  }));
}
