/**
 * Smart-search field map aligned with prisma/schema.prisma.
 * AI parses prompts → filters; DB queries use these Prisma model fields.
 */

export const SEARCH_STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'with', 'from', 'in', 'on', 'at', 'to', 'for', 'of',
  'me', 'my', 'all', 'any', 'show', 'find', 'search', 'filter', 'get', 'list',
  'having', 'that', 'who', 'are', 'is', 'was', 'be',
]);

/** Prisma enum values from schema.prisma */
export const SCHEMA_ENUMS = {
  LeadSource: ['Website', 'LinkedIn', 'Email', 'Referral', 'Campaign'],
  LeadType: ['Company', 'Individual', 'Referral'],
  Priority: ['High', 'Medium', 'Low'],
  ClientStatus: ['ACTIVE', 'PROSPECT', 'ON_HOLD', 'INACTIVE'],
  JobStatus: ['DRAFT', 'OPEN', 'ON_HOLD', 'CLOSED', 'FILLED'],
  JobType: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'FREELANCE', 'INTERNSHIP'],
  CandidateStatus: ['NEW', 'ACTIVE', 'PLACED', 'INACTIVE', 'BLACKLISTED'],
  InterviewStatus: [
    'SCHEDULED',
    'FEEDBACK_PENDING',
    'FEEDBACK_SUBMITTED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'NO_SHOW',
    'RESCHEDULED',
    'CONFIRMED',
  ],
  InterviewMode: ['ONLINE', 'OFFLINE'],
  PlacementStatus: [
    'PENDING',
    'ACTIVE',
    'COMPLETED',
    'CANCELLED',
    'OFFER_SENT',
    'OFFER_ACCEPTED',
    'OFFER_REJECTED',
    'JOINING_SCHEDULED',
    'JOINED',
    'NO_SHOW',
    'DROPPED',
    'WITHDRAWN',
    'FAILED',
    'REPLACEMENT_REQUIRED',
    'REPLACED',
  ],
  EmploymentType: ['PERMANENT', 'CONTRACT', 'FREELANCE'],
};

export const SMART_SEARCH_ENTITY_SCHEMA = {
  leads: {
    prismaModel: 'lead',
    map: 'leads',
    matchingIdsField: 'matchingLeadIds',
    /** String scalar fields on model Lead — used for searchText DB contains */
    textSearchFields: [
      'contactName',
      'companyName',
      'contactPerson',
      'directorName',
      'directorSalutation',
      'email',
      'phone',
      'interestedNeeds',
      'servicesNeeded',
      'notes',
      'expectedBusinessValue',
      'industry',
      'sector',
      'companySize',
      'teamName',
      'website',
      'linkedIn',
      'location',
      'city',
      'state',
      'country',
      'designation',
      'teamMemberDesignation',
      'teamMemberEmail',
      'teamMemberPhone',
      'campaignName',
      'campaignLink',
      'referralName',
      'sourceWebsiteUrl',
      'sourceLinkedInUrl',
      'sourceEmail',
      'lostReason',
      'status',
    ],
    arraySearchFields: ['emails', 'phones', 'companyLinks'],
    filterMap: {
      status: { field: 'status', type: 'string' },
      source: { field: 'source', type: 'enum', enumKey: 'LeadSource' },
      priority: { field: 'priority', type: 'enum', enumKey: 'Priority' },
      recruiterId: { field: 'assignedToId', multiField: 'assignedToIds' },
      searchText: { type: 'text' },
    },
    distinctHintFields: ['status', 'source', 'priority', 'companyName', 'industry', 'city', 'country'],
    aiGuide: `Prisma model Lead fields: companyName, contactPerson, directorName, email, phone, emails[], phones[],
status (string), source (Website|LinkedIn|Email|Referral|Campaign), priority (High|Medium|Low), type (Company|Individual|Referral),
industry, sector, teamName, location, city, state, country, interestedNeeds, servicesNeeded, notes, expectedBusinessValue,
website, linkedIn, campaignName, referralName, assignedToId/assignedToIds (recruiter).
Map recruiter to recruiterId filter. Put unmapped terms in searchText.`,
  },

  jobs: {
    prismaModel: 'job',
    map: 'jobs',
    matchingIdsField: 'matchingJobIds',
    textSearchFields: [
      'title',
      'description',
      'overview',
      'location',
      'experienceRequired',
      'education',
      'hiringManager',
      'department',
      'jobCategory',
      'jobLocationType',
      'workMode',
      'priority',
      'nationality',
      'country',
      'state',
      'city',
      'forecastRevenue',
      'visibility',
      'jdFileName',
      'videoMediaLink',
      'applicationFormNote',
    ],
    arraySearchFields: [
      'requirements',
      'skills',
      'keyResponsibilities',
      'preferredSkills',
      'candidateRequirements',
      'benefits',
    ],
    filterMap: {
      status: { field: 'status', type: 'enum', enumKey: 'JobStatus' },
      clientId: { field: 'clientId', type: 'objectId' },
      recruiterId: { field: 'assignedToId', type: 'objectId' },
      priority: { field: 'priority', type: 'string' },
      employmentType: { field: 'type', type: 'enum', enumKey: 'JobType' },
      searchText: { type: 'text' },
    },
    distinctHintFields: ['status', 'title', 'location', 'type', 'priority', 'city', 'country', 'nationality', 'workMode'],
    aiGuide: `Prisma model Job searchable fields:
title, description, overview, location, country, state, city, nationality, workMode, jobLocationType,
status (DRAFT|OPEN|ON_HOLD|CLOSED|FILLED), type/employmentType (FULL_TIME|PART_TIME|CONTRACT|FREELANCE|INTERNSHIP),
priority (Low|Medium|High|Urgent), openings, clientId, assignedToId (recruiter), managerId (assign manager),
hiringManager, department, jobCategory, experienceRequired, education, expectedClosureDate (target hire date),
skills[], requirements[], keyResponsibilities[], preferredSkills[], candidateRequirements[], benefits[],
languages (JSON: language + proficiency), salary (JSON: min/max/currency), jdFileName, publicFieldVisibility.
Map client name to clientId; recruiter/manager name to recruiterId or managerId.
Put job title, skills, location, industry, responsibilities, qualifications in searchText when not a structured filter.`,
  },

  clients: {
    prismaModel: 'client',
    map: 'clients',
    matchingIdsField: 'matchingClientIds',
    textSearchFields: [
      'companyName',
      'industry',
      'website',
      'linkedin',
      'location',
      'companySize',
      'hiringLocations',
      'servicesNeeded',
      'expectedBusinessValue',
      'leadStatus',
      'priority',
      'sla',
      'city',
      'state',
      'country',
      'timezone',
      'directorSalutation',
      'teamMemberDesignation',
      'teamMemberEmail',
      'teamMemberPhone',
      'healthStatus',
      'avgTimeToFill',
      'agreementsFileName',
      'agreementTotalPayment',
      'agreementLevel',
      'agreementServiceChargePercent',
      'agreementContractValidity',
      'agreementContractStartDate',
      'agreementContractEndDate',
      'agreementTimePeriod',
      'agreementAdvancePaymentPercent',
      'agreementFreeReplacementUnit',
      'revenueGenerated',
      'billingTotalRevenue',
      'billingOutstanding',
      'billingPaid',
    ],
    arraySearchFields: ['emails', 'phones'],
    filterMap: {
      activeTab: { type: 'clientTab' },
      priority: { field: 'priority', type: 'enum', enumKey: 'Priority' },
      ownerScope: { type: 'ownerScope' },
      searchText: { type: 'text' },
    },
    distinctHintFields: ['status', 'priority', 'companyName', 'industry', 'city', 'country', 'leadStatus'],
    aiGuide: `Prisma model Client searchable fields:
companyName, industry, website, linkedin, location, city, state, country, timezone,
status (ACTIVE|PROSPECT|ON_HOLD|INACTIVE), leadStatus (display label e.g. Active, On Hold),
priority (High|Medium|Low), assignedToId, createdById, servicesNeeded, expectedBusinessValue,
companySize, hiringLocations, directorSalutation, emails[], phones[],
teamMemberDesignation, teamMemberEmail, teamMemberPhone,
agreements: agreementsFileName, agreementLevel, agreementServiceChargePercent, agreementContractStartDate,
agreementContractEndDate, agreementTimePeriod, agreementAdvancePaymentPercent, agreementTotalPayment,
agreementFreeReplacementValue, agreementFreeReplacementUnit,
postServiceKycForm (JSON: company/trade name, tax id, bank, shareholders, KYC checklist, approval),
otherDetails (JSON label-value custom fields).
activeTab: active→ACTIVE/PROSPECT or leadStatus Active, on-hold→ON_HOLD or leadStatus On Hold,
inactive→INACTIVE, hot→priority High.
ownerScope "me" = assignedToId or createdById = current user.
Put company names, locations, industries, director/team/KYC/agreement terms in searchText when not a structured filter.`,
  },

  candidates: {
    prismaModel: 'candidate',
    map: 'candidates',
    matchingIdsField: 'matchingCandidateIds',
    textSearchFields: [
      'firstName',
      'lastName',
      'email',
      'phone',
      'linkedIn',
      'currentTitle',
      'currentCompany',
      'designation',
      'location',
      'address',
      'addressLine',
      'city',
      'country',
      'preferredLocation',
      'education',
      'recruiterEducation',
      'portfolio',
      'website',
      'notes',
      'recruiterNotes',
      'cvSummary',
      'stage',
      'source',
      'noticePeriod',
      'availability',
      'recruiterStatus',
    ],
    arraySearchFields: [
      'skills',
      'recruiterSkills',
      'certifications',
      'certificationsList',
      'languages',
      'recruiterLanguages',
    ],
    filterMap: {
      stage: { field: 'stage', type: 'stage' },
      status: { field: 'status', type: 'enum', enumKey: 'CandidateStatus' },
      source: { field: 'source', type: 'contains' },
      ownerId: { field: 'assignedToId', type: 'objectId' },
      company: { field: 'currentCompany', type: 'contains' },
      location: { field: 'location', type: 'contains' },
      jobId: { field: 'assignedJobs', type: 'jobRelation' },
      experienceRange: { field: 'experience', type: 'experienceRange' },
      searchText: { type: 'text' },
    },
    distinctHintFields: ['stage', 'status', 'currentCompany', 'location', 'city', 'country', 'source', 'availability'],
    aiGuide: `Prisma model Candidate searchable profile fields:
firstName, lastName, email, phone, linkedIn, currentTitle, currentCompany, designation,
location, address, city, country, preferredLocation, nationality (often in cvSummary/extraData),
status (NEW|ACTIVE|PLACED|INACTIVE|BLACKLISTED), recruiterStatus, stage, source (e.g. phase1),
assignedToId (recruiter), assignedJobs[], experience, experienceYears, availability, noticePeriod,
skills[], recruiterSkills[], education, recruiterEducation, certifications[], languages[],
cvSummary, notes, recruiterNotes, cvEducationEntries (JSON), cvWorkExperienceEntries (JSON),
cvPortfolioLinks (JSON), extraData (JSON: gender, projects, accomplishments, visa, assessments).
stage filter values: new, applied, shortlist, screening, interviewing, offered, hired, rejected.
experienceRange: 0-2, 2-5, 5-10, 10+. ownerId = assignedToId. jobId matches assignedJobs/applications/pipeline.
Put skills (React, Python), job titles (SDE, Frontend), employers, education, project names in searchText.`,
  },

  interviews: {
    prismaModel: 'interview',
    map: 'interviews',
    matchingIdsField: 'matchingInterviewIds',
    textSearchFields: ['location', 'meetingLink', 'notes', 'round', 'timezone', 'instructions'],
    filterMap: {
      status: { field: 'status', type: 'enum', enumKey: 'InterviewStatus' },
      round: { field: 'round', type: 'contains' },
      mode: { field: 'mode', type: 'enum', enumKey: 'InterviewMode' },
      interviewer: { field: 'interviewerId', type: 'interviewerName' },
      clientJob: { field: 'jobId', type: 'clientJobLabel' },
      searchText: { type: 'textRelation', relation: 'candidate' },
    },
    distinctHintFields: ['status', 'round', 'mode'],
    aiGuide: `Prisma model Interview: candidateId, jobId, clientId, interviewerId, panelIds[], scheduledAt, duration,
status (SCHEDULED|COMPLETED|CANCELLED|RESCHEDULED|NO_SHOW|...), mode (ONLINE|OFFLINE), round (string), notes, location.
Map UI "Scheduled"→SCHEDULED, "Completed"→COMPLETED. interviewer = user name. clientJob = "Company • Job title" label.`,
  },

  placements: {
    prismaModel: 'placement',
    map: 'placements',
    matchingIdsField: 'matchingPlacementIds',
    textSearchFields: [
      'failureReason',
      'billingStatus',
      'reportingToName',
      'reportingToTitle',
      'reportingToEmail',
      'notes',
    ],
    filterMap: {
      status: { field: 'status', type: 'enum', enumKey: 'PlacementStatus' },
      companyId: { field: 'clientId', type: 'objectId' },
      recruiterId: { field: 'recruiterId', type: 'objectId' },
      employmentType: { field: 'employmentType', type: 'enum', enumKey: 'EmploymentType' },
      searchText: { type: 'placementSearch' },
    },
    distinctHintFields: ['status', 'employmentType'],
    aiGuide: `Prisma model Placement: candidateId, jobId, clientId, recruiterId, offerDate, joiningDate, salaryOffered,
placementFee, status (JOINED|NO_SHOW|OFFER_SENT|OFFER_ACCEPTED|...), employmentType (PERMANENT|CONTRACT|FREELANCE), notes.
companyId = clientId. searchText matches candidate name/email, client companyName, or job title.`,
  },
};

export function getEntitySchema(entity) {
  return SMART_SEARCH_ENTITY_SCHEMA[String(entity || '').trim().toLowerCase()] || null;
}

/** Build Prisma contains OR across schema text + array string fields. */
export function buildSchemaTextSearchWhere(entityKey, search) {
  const schema = getEntitySchema(entityKey);
  const trimmed = String(search || '').trim();
  if (!schema || !trimmed) return null;

  const terms = trimmed
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && !SEARCH_STOP_WORDS.has(term.toLowerCase()));
  const effectiveTerms = terms.length > 0 ? terms : [trimmed];

  const termClauses = effectiveTerms.map((term) => {
    const orParts = [];
    for (const field of schema.textSearchFields || []) {
      orParts.push({ [field]: { contains: term, mode: 'insensitive' } });
    }
    for (const field of schema.arraySearchFields || []) {
      orParts.push({ [field]: { hasSome: [term] } });
    }
    return { OR: orParts };
  });

  return termClauses.length === 1 ? termClauses[0] : { AND: termClauses };
}

export function normalizeEnumToken(value, enumKey) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const allowed = SCHEMA_ENUMS[enumKey] || [];
  const upper = raw.toUpperCase().replace(/[\s-]+/g, '_');
  const exact = allowed.find((item) => item.toUpperCase() === upper);
  if (exact) return exact;
  const contains = allowed.find(
    (item) =>
      item.toUpperCase().includes(upper) || upper.includes(item.toUpperCase().replace(/_/g, '')),
  );
  return contains || raw;
}

/** UI interview status labels → Prisma InterviewStatus */
export function normalizeInterviewStatusFilter(value) {
  const token = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  const map = {
    SCHEDULED: 'SCHEDULED',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    CANCELED: 'CANCELLED',
    RESCHEDULED: 'RESCHEDULED',
    NO_SHOW: 'NO_SHOW',
    NOSHOW: 'NO_SHOW',
    CONFIRMED: 'CONFIRMED',
    IN_PROGRESS: 'IN_PROGRESS',
    FEEDBACK_PENDING: 'FEEDBACK_PENDING',
  };
  return map[token] || normalizeEnumToken(value, 'InterviewStatus');
}

export function buildEntityInstructionsFromSchema(entityKey) {
  const schema = getEntitySchema(entityKey);
  if (!schema) return '';
  return `Entity: ${entityKey}. Parse prompt into filters only — server queries Prisma ${schema.prismaModel} table.\n${schema.aiGuide}\nDo NOT return record ids.`;
}
