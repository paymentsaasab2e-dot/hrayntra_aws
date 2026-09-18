import type { TableColumnDef } from '../../hooks/usePersistedColumnVisibility';
import { TABLE_AUDIT_COLUMN_LABEL } from './columnLabels';

/** Extra optional columns (off by default) from drawer / list row data. */
const extra = (id: string, label: string, children?: TableColumnDef[]): TableColumnDef => ({
  id,
  label,
  defaultVisible: false,
  ...(children?.length ? { children } : {}),
});

/** Nested Pipeline stage chips (Jobs table Columns menu). */
export const JOB_PIPELINE_STAGE_COLUMN_PREFIX = 'pipelineStage:';

export const JOB_PIPELINE_STAGE_COLUMNS: TableColumnDef[] = [
  { id: 'pipelineStage:applied', label: 'Applied', defaultVisible: true, excludeFromBadgeCount: true },
  { id: 'pipelineStage:screening', label: 'Screening', defaultVisible: true, excludeFromBadgeCount: true },
  {
    id: 'pipelineStage:submit-to-client',
    label: 'Submit to Client',
    defaultVisible: true,
    excludeFromBadgeCount: true,
  },
  {
    id: 'pipelineStage:interviewing',
    label: 'Interviewing',
    defaultVisible: true,
    excludeFromBadgeCount: true,
  },
  { id: 'pipelineStage:offer', label: 'Offer', defaultVisible: true, excludeFromBadgeCount: true },
  { id: 'pipelineStage:hired', label: 'Hired', defaultVisible: true, excludeFromBadgeCount: true },
  { id: 'pipelineStage:rejected', label: 'Rejected', defaultVisible: true, excludeFromBadgeCount: true },
];

/** Nested Location display modes (Columns → Location ▾) — same UX as Pipeline stages. */
export const LOCATION_DISPLAY_COLUMN_PREFIX = 'locationDisplay:';

export const LOCATION_DISPLAY_COLUMNS: TableColumnDef[] = [
  {
    id: 'locationDisplay:country',
    label: 'Country only',
    defaultVisible: true,
    excludeFromBadgeCount: true,
  },
  {
    id: 'locationDisplay:state',
    label: 'State only',
    defaultVisible: false,
    excludeFromBadgeCount: true,
  },
  {
    id: 'locationDisplay:city',
    label: 'City only',
    defaultVisible: false,
    excludeFromBadgeCount: true,
  },
  {
    id: 'locationDisplay:all',
    label: 'Full address',
    defaultVisible: false,
    excludeFromBadgeCount: true,
  },
];

const locationCol = (): TableColumnDef => ({
  id: 'location',
  label: 'Location',
  children: LOCATION_DISPLAY_COLUMNS,
});

export const CANDIDATE_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'select', label: 'Select', locked: true },
  { id: 'candidate', label: 'Candidate', locked: true },
  { id: 'roleCompany', label: 'Role / company' },
  { id: 'experience', label: 'Experience' },
  locationCol(),
  { id: 'assignedJob', label: 'Assigned job' },
  { id: 'stage', label: 'Stage' },
  extra('email', 'Email'),
  extra('phone', 'Phone'),
  extra('source', 'Source'),
  extra('hotlist', 'Hotlist'),
  extra('rating', 'Rating'),
  extra('lastActivity', 'Last activity'),
  extra('skills', 'Skills'),
  extra('noticePeriod', 'Notice period'),
  extra('currentSalary', 'Current salary'),
  extra('expectedSalary', 'Expected salary'),
  extra('preferredLocation', 'Preferred location'),
  extra('education', 'Education'),
  extra('availability', 'Availability'),
  { id: 'audit', label: TABLE_AUDIT_COLUMN_LABEL },
  { id: 'actions', label: 'Actions', locked: true },
];

export const JOB_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'select', label: 'Select', locked: true },
  { id: 'title', label: 'Job title', locked: true },
  { id: 'client', label: 'Client' },
  { id: 'status', label: 'Status' },
  { id: 'pipeline', label: 'Pipeline', children: JOB_PIPELINE_STAGE_COLUMNS },
  { id: 'details', label: 'Details' },
  extra('location', 'Location', LOCATION_DISPLAY_COLUMNS),
  extra('openings', 'Openings'),
  extra('owner', 'Recruiter'),
  extra('manager', 'Manager'),
  extra('createdDate', 'Created'),
  extra('priority', 'Priority'),
  extra('employmentType', 'Employment type'),
  extra('workMode', 'Work mode'),
  extra('jobLocationType', 'Location type'),
  extra('hot', 'Hot'),
  extra('aiMatch', 'AI match'),
  extra('experienceRequired', 'Experience required'),
  extra('industry', 'Category'),
  { id: 'audit', label: TABLE_AUDIT_COLUMN_LABEL },
  { id: 'actions', label: 'Actions', locked: true },
];

export const LEAD_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'select', label: 'Select', locked: true },
  { id: 'lead', label: 'Lead', locked: true },
  { id: 'source', label: 'Source' },
  { id: 'contact', label: 'Contact' },
  { id: 'status', label: 'Status' },
  { id: 'assignedTo', label: 'Assigned To' },
  { id: 'followUp', label: 'Last Follow-up' },
  extra('type', 'Lead type'),
  extra('priority', 'Priority'),
  extra('phone', 'Phone'),
  extra('industry', 'Industry'),
  extra('companySize', 'Company size'),
  extra('location', 'Location', LOCATION_DISPLAY_COLUMNS),
  extra('website', 'Website'),
  extra('designation', 'Designation'),
  extra('needs', 'Services needed'),
  extra('expectedValue', 'Expected value'),
  extra('createdDate', 'Created'),
  extra('convertedClient', 'Converted client'),
  { id: 'audit', label: TABLE_AUDIT_COLUMN_LABEL },
  { id: 'actions', label: 'Actions', locked: true },
];

export const CLIENT_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'select', label: 'Select', locked: true },
  { id: 'client', label: 'Client Name', locked: true },
  { id: 'industry', label: 'Industry' },
  locationCol(),
  { id: 'status', label: 'Status' },
  { id: 'owner', label: 'Team Member' },
  extra('openJobs', 'Open jobs'),
  extra('placements', 'Placements'),
  extra('lastActivity', 'Last activity'),
  extra('priority', 'Priority'),
  extra('companySize', 'Company size'),
  extra('revenue', 'Revenue'),
  extra('nextFollowUp', 'Next follow-up'),
  extra('clientSince', 'Client since'),
  extra('website', 'Website'),
  extra('timezone', 'Timezone'),
  extra('sla', 'SLA'),
  { id: 'audit', label: TABLE_AUDIT_COLUMN_LABEL },
  { id: 'actions', label: 'Actions', locked: true },
];

export const CONTACT_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'select', label: 'Select', locked: true },
  { id: 'contact', label: 'Contact Name', locked: true },
  { id: 'company', label: 'Company' },
  { id: 'designation', label: 'Designation' },
  { id: 'contactType', label: 'Contact Type' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'owner', label: 'Owner' },
  { id: 'lastContact', label: 'Last Contact' },
  { id: 'status', label: 'Status' },
  extra('email', 'Email'),
  extra('phone', 'Phone'),
  extra('department', 'Department'),
  extra('location', 'Location', LOCATION_DISPLAY_COLUMNS),
  extra('linkedin', 'LinkedIn'),
  extra('preferredChannel', 'Preferred channel'),
  extra('tags', 'Tags'),
  extra('isPrimary', 'Primary'),
  extra('createdAt', 'Created'),
  { id: 'audit', label: TABLE_AUDIT_COLUMN_LABEL },
  { id: 'actions', label: 'Actions', locked: true },
];

export const INTERVIEW_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'select', label: 'Select', locked: true },
  { id: 'candidate', label: 'Candidate', locked: true },
  { id: 'job', label: 'Job / client' },
  { id: 'round', label: 'Round' },
  { id: 'panel', label: 'Interviewers' },
  { id: 'status', label: 'Status' },
  { id: 'meeting', label: 'Meeting' },
  { id: 'scheduled', label: 'Date / time' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'candidateStage', label: 'Pipeline stage' },
  extra('duration', 'Duration'),
  extra('type', 'Interview type'),
  extra('mode', 'Mode'),
  extra('platform', 'Meeting platform'),
  extra('location', 'Location', LOCATION_DISPLAY_COLUMNS),
  extra('createdBy', 'Created by'),
  { id: 'audit', label: TABLE_AUDIT_COLUMN_LABEL },
  { id: 'actions', label: 'Actions', locked: true },
];

export const PLACEMENT_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'candidate', label: 'Candidate', locked: true },
  { id: 'clientJob', label: 'Client / Job' },
  { id: 'recruiter', label: 'Team Member' },
  { id: 'offerDate', label: 'Offer Date' },
  { id: 'joiningDate', label: 'Joining Date' },
  { id: 'type', label: 'Type' },
  { id: 'status', label: 'Status' },
  extra('salary', 'Salary offered'),
  extra('fee', 'Placement fee'),
  extra('commission', 'Commission %'),
  extra('revenue', 'Revenue'),
  extra('paymentStatus', 'Payment'),
  extra('invoiceNumber', 'Invoice #'),
  extra('actualJoiningDate', 'Actual join'),
  extra('candidateEmail', 'Candidate email'),
  extra('reportingTo', 'Reporting to'),
  { id: 'audit', label: TABLE_AUDIT_COLUMN_LABEL },
  { id: 'actions', label: 'Actions', locked: true },
];

export const MATCH_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'select', label: 'Select', locked: true },
  { id: 'candidate', label: 'Candidate', locked: true },
  { id: 'score', label: 'Match' },
  { id: 'roleCompany', label: 'Role / company' },
  { id: 'experience', label: 'Experience' },
  locationCol(),
  { id: 'status', label: 'Status' },
  extra('noticePeriod', 'Notice period'),
  extra('salary', 'Expected salary'),
  extra('email', 'Email'),
  extra('phone', 'Phone'),
  extra('matchSource', 'Match source'),
  extra('matchRating', 'Rating'),
  extra('savedAt', 'Saved'),
  { id: 'actions', label: 'Actions', locked: true },
];

export const TASK_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'task', label: 'Task Title', locked: true },
  { id: 'type', label: 'Type' },
  { id: 'related', label: 'Related To' },
  { id: 'due', label: 'Due Date' },
  { id: 'priority', label: 'Priority' },
  { id: 'status', label: 'Status' },
  { id: 'createdBy', label: 'Created by' },
  { id: 'assignee', label: 'Assigned to' },
  { id: 'delegated', label: 'Delegated to' },
  extra('time', 'Due time'),
  extra('relatedType', 'Related type'),
  { id: 'audit', label: TABLE_AUDIT_COLUMN_LABEL },
  { id: 'actions', label: 'Actions', locked: true },
];

export const PIPELINE_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'candidate', label: 'Candidate', locked: true },
  { id: 'stage', label: 'Stage' },
  { id: 'clientJob', label: 'Client & Job' },
  { id: 'status', label: 'Status' },
  { id: 'lastActivity', label: 'Last Activity' },
  extra('owner', 'Team member'),
  extra('experience', 'Experience'),
  extra('location', 'Location', LOCATION_DISPLAY_COLUMNS),
  extra('followUp', 'Follow-up'),
  extra('job', 'Job'),
  extra('client', 'Client'),
];

export const TEAM_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'member', label: 'Member', locked: true },
  { id: 'role', label: 'Role' },
  { id: 'department', label: 'Department' },
  { id: 'rank', label: 'Rank' },
  { id: 'email', label: 'Email' },
  { id: 'assignedLeads', label: 'Assigned leads' },
  { id: 'credential', label: 'Credential' },
  { id: 'status', label: 'Status' },
  extra('phone', 'Phone'),
  extra('location', 'Location', LOCATION_DISPLAY_COLUMNS),
  extra('designation', 'Designation'),
  extra('manager', 'Manager'),
  extra('tasks', 'Tasks'),
  extra('lastLogin', 'Last login'),
  extra('createdAt', 'Created'),
  { id: 'actions', label: 'Actions', locked: true },
];
