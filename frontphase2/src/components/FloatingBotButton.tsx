'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Eraser, MessageSquareText, History, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AssistantChatPanel, type AssistantPromptSuggestion, type UiChatMessage } from './AssistantChatPanel';
import {
  apiDeleteAssistantHistory,
  apiGetAssistantHistory,
  apiSaveAssistantHistory,
  type AssistantActionLogItem,
  type AssistantConversationMemory,
  type AssistantHistoryRecord,
  type AssistantStructuredResponse,
  type AssistantTaskChain,
} from '../lib/api';

const STORAGE_KEY = 'floating-bot-position';
const HISTORY_STORAGE_PREFIX = 'floating-bot-history';
const SIZE = 72;
const MARGIN = 16;
const BUBBLE_WIDTH = 210;
const BUBBLE_HEIGHT = 52;
const BUBBLE_GAP = 10;
/** Pixels moved before we treat the gesture as a drag (not a tap to open). */
const TAP_MAX_MOVE_PX = 10;

/** Public file alias without spaces to avoid Next image parsing issues in dev/prod. */
const BOT_IMAGE_SRC = '/floating-bot.png';

type AssistantPageConfig = {
  key: string;
  match: (pathname: string) => boolean;
  bubbleMessage: string;
  drawerSubtitle: string;
  chatGreeting: string;
  recommendations: AssistantPromptSuggestion[];
};

function getCapabilitiesForPage(pageKey?: string) {
  const common = ['Remember page-wise conversations', 'Track multi-step task chains', 'Suggest next recruiting actions'];

  switch (pageKey) {
    case 'leads':
      return [
        'Create and optimize leads from raw details',
        'Qualify leads and organize missing business data',
        'Prepare lead conversion next steps',
        'Generate CSV, Excel, or PDF lead reports',
        ...common,
      ];
    case 'client':
      return [
        'Summarize active client data',
        'Guide client updates and follow-ups',
        'Support client-to-job workflow planning',
        'Generate client summary reports',
        ...common,
      ];
    case 'candidate':
      return [
        'Review candidate workflow actions',
        'Guide stage movement and recruiter assignment',
        'Help plan interview or follow-up steps',
        'Generate candidate export-style reports',
        ...common,
      ];
    case 'jobs':
      return [
        'Create or improve job descriptions',
        'Summarize open job activity',
        'Guide job update workflows',
        'Generate job reports in CSV, Excel, or PDF',
        ...common,
      ];
    case 'pipeline':
      return [
        'Explain stage flow and stuck candidates',
        'Suggest movement and follow-up actions',
        'Help plan pipeline progress',
        ...common,
      ];
    case 'reports':
      return [
        'Summarize report insights',
        'Prepare downloadable CSV, Excel, or PDF reports',
        'Recommend next report actions',
        ...common,
      ];
    case 'interviews':
      return [
        'Summarize upcoming interviews',
        'Guide scheduling and follow-up workflows',
        'Support interview planning and reporting',
        ...common,
      ];
    case 'placements':
      return [
        'Summarize placement outcomes',
        'Guide joined/failed placement workflows',
        'Generate placement reports',
        ...common,
      ];
    case 'tasks':
      return [
        'Prioritize pending tasks',
        'Guide task execution and completion',
        'Resume interrupted workflows',
        ...common,
      ];
    default:
      return [
        'Read live ATS data for this page',
        'Plan multi-step recruitment workflows',
        'Generate CSV, Excel, or PDF reports when supported',
        ...common,
      ];
  }
}

function getPromptSuggestionsForPage(pageKey?: string, fallback: AssistantPromptSuggestion[] = []) {
  switch (pageKey) {
    case 'dashboard':
      return [
        { label: 'Daily KPI Summary', prompt: 'Summarize today\'s dashboard KPIs and explain what matters most.' },
        { label: 'Trend Review', prompt: 'Show me the most important recruiting trends from the dashboard.' },
        { label: 'Next Focus', prompt: 'What should I focus on next from the dashboard?' },
        { label: 'Open Jobs', prompt: 'Show me the open jobs that need attention from the dashboard.' },
        { label: 'Placement Summary', prompt: 'Summarize recent placements and conversion progress from the dashboard.' },
        { label: 'Interview Summary', prompt: 'Summarize the latest interview activity from the dashboard.' },
        { label: 'Dashboard Risks', prompt: 'Show me the biggest recruitment risks from the dashboard.' },
        { label: 'Dashboard Actions', prompt: 'Suggest the next actions I should take from the dashboard.' },
      ];
    case 'leads':
      return [
        { label: 'All Leads Report', prompt: 'Generate report of all leads.' },
        { label: 'All Leads CSV', prompt: 'Generate CSV report of all leads.' },
        { label: 'All Leads Excel', prompt: 'Generate Excel report of all leads.' },
        { label: 'Create Lead', prompt: 'Create a lead from raw company details and ask me for any missing required fields before creating it.' },
        { label: 'Create Company Lead', prompt: 'Create a new company lead with complete business details.' },
        { label: 'Update Lead', prompt: 'Update the lead details and ask me for any missing fields before making changes.' },
        { label: 'Convert Lead', prompt: 'Convert this qualified lead into a client and suggest the next workflow steps.' },
        { label: 'Qualify Leads', prompt: 'Help me qualify and organize my leads.' },
        { label: 'Lead Conversion', prompt: 'Suggest the next steps for lead conversion.' },
        { label: 'Specific Lead Report', prompt: 'I want the report of the lead Rush lam.' },
        { label: 'Lead Details', prompt: 'Show full details of the lead Rush lam.' },
        { label: 'Lead Follow-ups', prompt: 'What lead follow-ups should I prioritize right now?' },
        { label: 'AI Capabilities', prompt: 'What can the AI do on the leads page?' },
      ];
    case 'client':
      return [
        { label: 'All Clients Report', prompt: 'Generate report of all clients.' },
        { label: 'All Clients CSV', prompt: 'Generate CSV report of all clients.' },
        { label: 'All Clients Excel', prompt: 'Generate Excel report of all clients.' },
        { label: 'Create Client', prompt: 'Create a new client and ask me for any missing required details before creating it.' },
        { label: 'Update Client', prompt: 'Update this client record and ask me for any missing fields before changing it.' },
        { label: 'Client Follow-up Task', prompt: 'Create a follow-up action plan for this client.' },
        { label: 'Active Clients', prompt: 'Summarize my active clients with the most important details.' },
        { label: 'Client Follow-ups', prompt: 'What client follow-ups should I prioritize right now?' },
        { label: 'Specific Client Report', prompt: 'I want the report of the client Rush lam.' },
        { label: 'Client Details', prompt: 'Show full details of the client Rush lam.' },
        { label: 'Client Jobs', prompt: 'Show clients with their active jobs.' },
        { label: 'Client Health', prompt: 'Summarize client health and outstanding items.' },
        { label: 'AI Capabilities', prompt: 'What can the AI do on the clients page?' },
      ];
    case 'candidate':
      return [
        { label: 'All Candidates Report', prompt: 'Generate report of all candidates.' },
        { label: 'All Candidates CSV', prompt: 'Generate CSV report of all candidates.' },
        { label: 'All Candidates Excel', prompt: 'Generate Excel report of all candidates.' },
        { label: 'Create Candidate', prompt: 'Create a new candidate profile and ask me for any missing required details first.' },
        { label: 'Update Candidate', prompt: 'Update this candidate profile and ask me for any missing fields before making changes.' },
        { label: 'Move Candidate Stage', prompt: 'Move this candidate to the correct stage and explain the next step.' },
        { label: 'Candidate Actions', prompt: 'Show me candidate actions I should take next.' },
        { label: 'Stage Review', prompt: 'Help me organize candidates by stage and identify blockers.' },
        { label: 'Specific Candidate Report', prompt: 'I want the report of the candidate Rush lam.' },
        { label: 'Candidate Details', prompt: 'Show full details of the candidate Rush lam.' },
        { label: 'Top Candidates', prompt: 'Show the top candidates that need recruiter action.' },
        { label: 'Interview Ready', prompt: 'Which candidates are ready for interview follow-up?' },
        { label: 'AI Capabilities', prompt: 'What can the AI do on the candidates page?' },
      ];
    case 'jobs':
      return [
        { label: 'All Jobs Report', prompt: 'Generate report of all jobs.' },
        { label: 'All Jobs CSV', prompt: 'Generate CSV report of all jobs.' },
        { label: 'All Jobs Excel', prompt: 'Generate Excel report of all jobs.' },
        { label: 'Create Job', prompt: 'Create a new job and ask me for any missing required details before creating it.' },
        { label: 'Update Job', prompt: 'Update this job and ask me for any missing fields before changing it.' },
        { label: 'Assign Recruiter', prompt: 'Assign the right recruiter and suggest the best ownership plan for this job.' },
        { label: 'Open Jobs', prompt: 'Summarize my open jobs and highlight the urgent ones.' },
        { label: 'Improve JD', prompt: 'Generate or improve a job description for this page context.' },
        { label: 'Specific Job Report', prompt: 'I want the report of the job Data Analyst.' },
        { label: 'Job Details', prompt: 'Show full details of the job Data Analyst.' },
        { label: 'Hiring Pipeline', prompt: 'Show jobs with low candidate volume or pipeline risk.' },
        { label: 'Job Priorities', prompt: 'Which jobs need immediate recruiter attention?' },
        { label: 'AI Capabilities', prompt: 'What can I manage from the jobs page with AI help?' },
      ];
    case 'pipeline':
      return [
        { label: 'Pipeline Report', prompt: 'Generate pipeline funnel report.' },
        { label: 'Pipeline CSV', prompt: 'Generate CSV report for pipeline funnel.' },
        { label: 'Pipeline Excel', prompt: 'Generate Excel report for pipeline funnel.' },
        { label: 'Move Candidate', prompt: 'Move the candidate to the right pipeline stage and ask me for any missing information first.' },
        { label: 'Pipeline Follow-up', prompt: 'Suggest the next pipeline action for this candidate.' },
        { label: 'Pipeline Flow', prompt: 'Explain this pipeline flow and the main stage bottlenecks.' },
        { label: 'Stuck Candidates', prompt: 'Suggest next actions for stuck candidates in the pipeline.' },
        { label: 'Specific Pipeline Candidate', prompt: 'Show pipeline details of the candidate Rush lam.' },
        { label: 'Stage Bottlenecks', prompt: 'Which pipeline stages are blocking movement right now?' },
        { label: 'Fast Movers', prompt: 'Show candidates moving fastest through the pipeline.' },
        { label: 'AI Capabilities', prompt: 'What can the AI do on the pipeline page?' },
      ];
    case 'matches':
      return [
        { label: 'All Matches', prompt: 'Summarize all candidate and job matches.' },
        { label: 'Top Matches', prompt: 'Show the best candidate and job matches.' },
        { label: 'Specific Match', prompt: 'Show the best matches for candidate Rush lam.' },
        { label: 'Best Matches', prompt: 'Summarize my best candidate-job matches.' },
        { label: 'Act On Matches', prompt: 'Show me how to act on saved matches.' },
        { label: 'Top Match Quality', prompt: 'Which matches have the strongest fit scores?' },
        { label: 'Shortlist Help', prompt: 'Help me shortlist the best matches for follow-up.' },
        { label: 'Match Review', prompt: 'Show the matches that need recruiter review first.' },
        { label: 'AI Capabilities', prompt: 'What can the AI do on the matches page?' },
      ];
    case 'interviews':
      return [
        { label: 'All Interviews Report', prompt: 'Generate report of all interviews.' },
        { label: 'All Interviews CSV', prompt: 'Generate CSV report of all interviews.' },
        { label: 'All Interviews Excel', prompt: 'Generate Excel report of all interviews.' },
        { label: 'Schedule Interview', prompt: 'Schedule an interview and ask me for any missing required details before creating it.' },
        { label: 'Reschedule Interview', prompt: 'Reschedule this interview and ask me for any missing details first.' },
        { label: 'Upcoming Interviews', prompt: 'Summarize upcoming interviews on this page.' },
        { label: 'Interview Follow-ups', prompt: 'Help me plan interview follow-ups.' },
        { label: 'Specific Interview Report', prompt: 'Show interview report of candidate Rush lam.' },
        { label: 'Feedback Pending', prompt: 'Show interview feedback pending by recruiter.' },
        { label: 'Schedule Risks', prompt: 'Which interviews need urgent coordination or rescheduling?' },
        { label: 'AI Capabilities', prompt: 'What can the AI do on the interviews page?' },
      ];
    case 'placements':
      return [
        { label: 'All Placements Report', prompt: 'Generate report of all placements.' },
        { label: 'All Placements CSV', prompt: 'Generate CSV report of all placements.' },
        { label: 'All Placements Excel', prompt: 'Generate Excel report of all placements.' },
        { label: 'Create Placement', prompt: 'Create a placement and ask me for any missing required details before creating it.' },
        { label: 'Update Placement', prompt: 'Update this placement and ask me for any missing fields before changing it.' },
        { label: 'Mark Joined', prompt: 'Mark this placement as joined and list the next follow-up actions.' },
        { label: 'Recent Placements', prompt: 'Summarize recent placements and important outcomes.' },
        { label: 'Placement Follow-ups', prompt: 'Show me placement follow-up actions I should take.' },
        { label: 'Specific Placement Report', prompt: 'Show placement report of candidate Rush lam.' },
        { label: 'Revenue View', prompt: 'Show placements and revenue summary.' },
        { label: 'Joining Risks', prompt: 'Which placements have joining or replacement risk?' },
        { label: 'AI Capabilities', prompt: 'What can the AI do on the placements page?' },
      ];
    case 'team':
      return [
        { label: 'Assign Work', prompt: 'Suggest how to assign work across the team more effectively.' },
        { label: 'Review Recruiter', prompt: 'Show the performance review of recruiter Rush lam.' },
        { label: 'Team Activity', prompt: 'Summarize team activity and performance from this page.' },
        { label: 'Team Workload', prompt: 'Help me review team workload and identify imbalances.' },
        { label: 'Team Report', prompt: 'Show team performance report.' },
        { label: 'Team CSV', prompt: 'Generate CSV report for team performance.' },
        { label: 'Team Excel', prompt: 'Generate Excel report for team performance.' },
        { label: 'Top Recruiters', prompt: 'Show the top recruiters by placements and submissions.' },
        { label: 'Workload Gaps', prompt: 'Which recruiters have the highest and lowest workloads?' },
        { label: 'AI Capabilities', prompt: 'What can the AI do on the team page?' },
      ];
    case 'reports':
      return [
        { label: 'Key Insights', prompt: 'Summarize the key report insights from this reports page.' },
        { label: 'Next Report', prompt: 'Suggest what report to generate next and why.' },
        { label: 'All Report Actions', prompt: 'What can the AI do on the reports page? Show me all available report prompts.' },
        { label: 'Recruitment Performance', prompt: 'Show recruitment performance report.' },
        { label: 'Pipeline Funnel', prompt: 'Show pipeline funnel report.' },
        { label: 'Jobs Clients', prompt: 'Show jobs and clients report.' },
        { label: 'Candidates Report', prompt: 'Show candidates report.' },
        { label: 'Interviews Report', prompt: 'Show interviews report.' },
        { label: 'Placements Revenue', prompt: 'Show placements and revenue report.' },
        { label: 'Team Performance', prompt: 'Show team performance report.' },
        { label: 'Activity Productivity', prompt: 'Show activity and productivity report.' },
        { label: 'All Reports', prompt: 'Show all reports data.' },
        { label: 'Reports CSV', prompt: 'Generate CSV report for the current reports page.' },
        { label: 'Reports Excel', prompt: 'Generate Excel report for the current reports page.' },
        { label: 'All Jobs From Reports', prompt: 'Generate the reports of all jobs from the reports page.' },
        { label: 'All Candidates From Reports', prompt: 'Generate the reports of all candidates from the reports page.' },
        { label: 'Specific Person Report', prompt: 'I want the report of Rush lam from this reports page.' },
        { label: 'Best Report Action', prompt: 'Based on these reports, tell me the best next action to take.' },
      ];
    case 'billing':
      return [
        { label: 'Billing Summary', prompt: 'Summarize billing details from this page.' },
        { label: 'Explain Billing', prompt: 'Help me understand this billing page and the key numbers.' },
        { label: 'Create Invoice', prompt: 'Create an invoice workflow and ask me for any missing required billing details first.' },
        { label: 'Outstanding Recovery', prompt: 'Show how to follow up on overdue and outstanding billing.' },
        { label: 'Invoices Report', prompt: 'Show invoices report.' },
        { label: 'Payments Report', prompt: 'Show payments report.' },
        { label: 'Placements Billing', prompt: 'Show placements billing report.' },
        { label: 'Billing CSV', prompt: 'Generate CSV report for billing.' },
        { label: 'Billing Excel', prompt: 'Generate Excel report for billing.' },
        { label: 'Outstanding Dues', prompt: 'Show outstanding invoices and overdue amounts.' },
        { label: 'AI Capabilities', prompt: 'What can the AI do on the billing page?' },
      ];
    case 'tasks':
      return [
        { label: 'All Tasks Report', prompt: 'Generate report of all tasks and activities.' },
        { label: 'All Tasks CSV', prompt: 'Generate CSV report of all tasks and activities.' },
        { label: 'All Tasks Excel', prompt: 'Generate Excel report of all tasks and activities.' },
        { label: 'Create Task', prompt: 'Create a task and ask me for any missing required details before creating it.' },
        { label: 'Complete Task', prompt: 'Mark this task as complete and summarize the next action.' },
        { label: 'Pending Tasks', prompt: 'Summarize my pending tasks from this page.' },
        { label: 'Prioritize Work', prompt: 'Help me prioritize today\'s work.' },
        { label: 'Specific Task Report', prompt: 'Show task report of Rush lam.' },
        { label: 'Overdue Tasks', prompt: 'Show the overdue tasks that need attention.' },
        { label: 'AI Capabilities', prompt: 'What can the AI do on the tasks page?' },
      ];
    case 'contacts':
      return [
        { label: 'All Contacts Report', prompt: 'Generate report of all contacts.' },
        { label: 'Contacts CSV', prompt: 'Generate CSV report of all contacts.' },
        { label: 'Contacts Excel', prompt: 'Generate Excel report of all contacts.' },
        { label: 'Create Contact', prompt: 'Create a contact and ask me for any missing required details before creating it.' },
        { label: 'Update Contact', prompt: 'Update this contact and ask me for any missing fields before changing it.' },
        { label: 'Contact Summary', prompt: 'Summarize my contacts from this page.' },
        { label: 'Specific Contact', prompt: 'Show full details of contact Rush lam.' },
        { label: 'Clean Contacts', prompt: 'Help me clean and organize contact details.' },
        { label: 'AI Capabilities', prompt: 'What can the AI do on the contacts page?' },
      ];
    case 'inbox':
      return [
        { label: 'Inbox Summary', prompt: 'Summarize important inbox items from this page.' },
        { label: 'Draft Reply', prompt: 'Help me draft a reply for an important message.' },
        { label: 'Follow-up Emails', prompt: 'Show emails that need urgent follow-up.' },
        { label: 'Specific Message', prompt: 'Help me reply to Rush lam professionally.' },
        { label: 'AI Capabilities', prompt: 'What can the AI do on the inbox page?' },
      ];
    case 'calendar':
      return [
        { label: 'Schedule Summary', prompt: 'Summarize upcoming schedule items from this page.' },
        { label: 'Plan Calendar', prompt: 'Help me plan my recruiting calendar.' },
        { label: 'Interview Calendar', prompt: 'Show the interview schedule for this week.' },
        { label: 'Urgent Meetings', prompt: 'Which meetings or interviews need urgent attention?' },
        { label: 'AI Capabilities', prompt: 'What can the AI do on the calendar page?' },
      ];
    case 'administration':
      return [
        { label: 'Admin Tasks', prompt: 'Summarize admin tasks I can do here.' },
        { label: 'System Setup', prompt: 'Help me with system setup on this page.' },
        { label: 'Create Role', prompt: 'Help me create a role and ask me for any missing permission details before creating it.' },
        { label: 'Review Access', prompt: 'Review team access and permission risks on this page.' },
        { label: 'Roles Permissions', prompt: 'Explain the roles and permissions setup on this page.' },
        { label: 'Team Access Review', prompt: 'Show what administration actions are possible for users and teams.' },
        { label: 'AI Capabilities', prompt: 'What can the AI do on the administration page?' },
      ];
    case 'setting':
      return [
        { label: 'Explain Settings', prompt: 'Explain these settings in simple terms.' },
        { label: 'Configure Page', prompt: 'Help me configure this settings page properly.' },
        { label: 'Best Settings', prompt: 'Suggest the best settings configuration for this system.' },
        { label: 'Integration Help', prompt: 'Explain the integrations and communication settings here.' },
        { label: 'AI Capabilities', prompt: 'What can the AI do on the settings page?' },
      ];
    default:
      return fallback;
  }
}

const PAGE_ASSISTANT_CONFIGS: AssistantPageConfig[] = [
  {
    key: 'dashboard',
    match: (pathname) => pathname === '/' || pathname === '/dashboard',
    bubbleMessage: 'Can I help with your dashboard?',
    drawerSubtitle: 'Chat with your dashboard copilot',
    chatGreeting:
      'You are on the Dashboard page. I can help summarize KPIs, explain trends, and guide you to the right recruiting workflows. What would you like help with?',
    recommendations: [
      { label: 'Daily KPI Summary', prompt: 'Summarize today\'s dashboard KPIs and explain what matters most.', description: 'Quick status of the dashboard.' },
      { label: 'Trend Review', prompt: 'Show me the most important recruiting trends from the dashboard.', description: 'Highlight the biggest movements.' },
      { label: 'Next Focus', prompt: 'What should I focus on next from the dashboard?', description: 'Get priority guidance.' },
    ],
  },
  {
    key: 'candidate',
    match: (pathname) => pathname === '/candidate' || pathname.startsWith('/candidate/'),
    bubbleMessage: 'Can I help with candidates?',
    drawerSubtitle: 'Chat with your candidate copilot',
    chatGreeting:
      'You are on the Candidates page. I can help review profiles, organize candidate actions, move stages, assign recruiters, and guide hiring workflows. What would you like help with?',
    recommendations: [
      { label: 'Candidate Actions', prompt: 'Show me candidate actions I should take next.', description: 'Find the next best candidate tasks.' },
      { label: 'Stage Review', prompt: 'Help me organize candidates by stage and identify blockers.', description: 'Review funnel movement.' },
      { label: 'AI Capabilities', prompt: 'What can the AI do on the candidates page?', description: 'See page-specific help.' },
    ],
  },
  {
    key: 'client',
    match: (pathname) => pathname === '/client' || pathname.startsWith('/client/'),
    bubbleMessage: 'Can I help with clients?',
    drawerSubtitle: 'Chat with your client copilot',
    chatGreeting:
      'You are on the Clients page. I can help organize client records, review account details, prepare outreach ideas, and support client workflows. What would you like help with?',
    recommendations: [
      { label: 'Active Clients', prompt: 'Summarize my active clients with the most important details.', description: 'Quick client overview.' },
      { label: 'Client Follow-ups', prompt: 'What client follow-ups should I prioritize right now?', description: 'Find urgent account actions.' },
      { label: 'AI Capabilities', prompt: 'What can the AI do on the clients page?', description: 'See available AI help.' },
    ],
  },
  {
    key: 'leads',
    match: (pathname) => pathname === '/leads' || pathname.startsWith('/leads/'),
    bubbleMessage: 'Can I help with leads?',
    drawerSubtitle: 'Chat with your lead generation copilot',
    chatGreeting:
      'You are on the Leads page. I can help create leads, clean up lead details, organize company data, and guide lead workflows. What would you like help with?',
    recommendations: [
      { label: 'Create Lead', prompt: 'Create a lead from raw company details and organize the missing fields.', description: 'Build a lead from unstructured text.' },
      { label: 'Qualify Leads', prompt: 'Help me qualify and organize my leads.', description: 'Review and improve lead quality.' },
      { label: 'Lead Conversion', prompt: 'Suggest the next steps for lead conversion.', description: 'Move leads toward clients.' },
      { label: 'AI Capabilities', prompt: 'What can the AI do on the leads page?', description: 'See available AI help.' },
    ],
  },
  {
    key: 'jobs',
    match: (pathname) => pathname === '/job' || pathname.startsWith('/job/'),
    bubbleMessage: 'Can I help with jobs?',
    drawerSubtitle: 'Chat with your jobs copilot',
    chatGreeting:
      'You are on the Jobs page. I can help organize job requirements, review openings, improve role descriptions, and support job workflows. What would you like help with?',
    recommendations: [
      { label: 'Open Jobs', prompt: 'Summarize my open jobs and highlight the urgent ones.', description: 'See job priorities fast.' },
      { label: 'Improve JD', prompt: 'Generate or improve a job description for this page context.', description: 'Get AI help for role copy.' },
      { label: 'AI Capabilities', prompt: 'What can I manage from the jobs page with AI help?', description: 'See available actions.' },
    ],
  },
  {
    key: 'pipeline',
    match: (pathname) => pathname === '/pipeline' || pathname.startsWith('/pipeline/'),
    bubbleMessage: 'Can I help with the pipeline?',
    drawerSubtitle: 'Chat with your pipeline copilot',
    chatGreeting:
      'You are on the Pipeline page. I can help explain stage flow, suggest next actions, and support movement through the hiring pipeline. What would you like help with?',
    recommendations: [
      { label: 'Pipeline Flow', prompt: 'Explain this pipeline flow and the main stage bottlenecks.', description: 'Understand movement through the funnel.' },
      { label: 'Stuck Candidates', prompt: 'Suggest next actions for stuck candidates in the pipeline.', description: 'Unblock slow stages.' },
      { label: 'AI Capabilities', prompt: 'What can the AI do on the pipeline page?', description: 'See page-specific help.' },
    ],
  },
  {
    key: 'matches',
    match: (pathname) => pathname === '/matches' || pathname.startsWith('/matches/'),
    bubbleMessage: 'Can I help with matches?',
    drawerSubtitle: 'Chat with your matching copilot',
    chatGreeting:
      'You are on the Matches page. I can help review candidate-job fit, explain match quality, and suggest next follow-up actions. What would you like help with?',
    recommendations: [
      { label: 'Best Matches', prompt: 'Summarize my best candidate-job matches.', description: 'Review strongest fits.' },
      { label: 'Act On Matches', prompt: 'Show me how to act on saved matches.', description: 'Turn matches into next steps.' },
      { label: 'AI Capabilities', prompt: 'What can the AI do on the matches page?', description: 'See page-specific help.' },
    ],
  },
  {
    key: 'interviews',
    match: (pathname) => pathname === '/interviews' || pathname.startsWith('/interviews/'),
    bubbleMessage: 'Can I help with interviews?',
    drawerSubtitle: 'Chat with your interview copilot',
    chatGreeting:
      'You are on the Interviews page. I can help plan interview workflows, review scheduling details, and organize interview follow-ups. What would you like help with?',
    recommendations: [
      { label: 'Upcoming Interviews', prompt: 'Summarize upcoming interviews on this page.', description: 'See the next scheduled interviews.' },
      { label: 'Interview Follow-ups', prompt: 'Help me plan interview follow-ups.', description: 'Coordinate next actions.' },
      { label: 'AI Capabilities', prompt: 'What can the AI do on the interviews page?', description: 'See page-specific help.' },
    ],
  },
  {
    key: 'placements',
    match: (pathname) =>
      pathname === '/placement' ||
      pathname.startsWith('/placement/') ||
      pathname === '/placements' ||
      pathname.startsWith('/placements/'),
    bubbleMessage: 'Can I help with placements?',
    drawerSubtitle: 'Chat with your placements copilot',
    chatGreeting:
      'You are on the Placements page. I can help track closed hires, review placement details, and support post-placement follow-up. What would you like help with?',
    recommendations: [
      { label: 'Recent Placements', prompt: 'Summarize recent placements and important outcomes.', description: 'Review joined and pending placements.' },
      { label: 'Placement Follow-ups', prompt: 'Show me placement follow-up actions I should take.', description: 'Track post-placement work.' },
      { label: 'AI Capabilities', prompt: 'What can the AI do on the placements page?', description: 'See page-specific help.' },
    ],
  },
  {
    key: 'contacts',
    match: (pathname) => pathname === '/contacts' || pathname.startsWith('/contacts/'),
    bubbleMessage: 'Can I help with contacts?',
    drawerSubtitle: 'Chat with your contacts copilot',
    chatGreeting:
      'You are on the Contacts page. I can help organize contact records, clean details, and support follow-up planning. What would you like help with?',
    recommendations: [
      { label: 'Contact Summary', prompt: 'Summarize my contacts from this page.', description: 'Quick contacts overview.' },
      { label: 'Clean Contacts', prompt: 'Help me clean and organize contact details.', description: 'Improve data quality.' },
      { label: 'AI Capabilities', prompt: 'What can the AI do on the contacts page?', description: 'See page-specific help.' },
    ],
  },
  {
    key: 'calendar',
    match: (pathname) => pathname === '/calendar' || pathname.startsWith('/calendar/'),
    bubbleMessage: 'Can I help with scheduling?',
    drawerSubtitle: 'Chat with your scheduling copilot',
    chatGreeting:
      'You are on the Calendar page. I can help plan schedules, organize hiring events, and guide calendar-based workflows. What would you like help with?',
    recommendations: [
      { label: 'Schedule Summary', prompt: 'Summarize upcoming schedule items from this page.', description: 'See what is coming up next.' },
      { label: 'Plan Calendar', prompt: 'Help me plan my recruiting calendar.', description: 'Organize time and events.' },
      { label: 'AI Capabilities', prompt: 'What can the AI do on the calendar page?', description: 'See page-specific help.' },
    ],
  },
  {
    key: 'inbox',
    match: (pathname) => pathname === '/inbox' || pathname.startsWith('/inbox/'),
    bubbleMessage: 'Can I help with your inbox?',
    drawerSubtitle: 'Chat with your inbox copilot',
    chatGreeting:
      'You are on the Inbox page. I can help draft replies, summarize messages, and organize follow-up priorities. What would you like help with?',
    recommendations: [
      { label: 'Inbox Summary', prompt: 'Summarize important inbox items from this page.', description: 'See the most important messages.' },
      { label: 'Draft Reply', prompt: 'Help me draft a reply for an important message.', description: 'Get response help quickly.' },
      { label: 'AI Capabilities', prompt: 'What can the AI do on the inbox page?', description: 'See page-specific help.' },
    ],
  },
  {
    key: 'team',
    match: (pathname) => pathname === '/team' || pathname.startsWith('/team/'),
    bubbleMessage: 'Can I help with your team?',
    drawerSubtitle: 'Chat with your team copilot',
    chatGreeting:
      'You are on the Team page. I can help review performance data, team workloads, and recruiting coordination workflows. What would you like help with?',
    recommendations: [
      { label: 'Team Activity', prompt: 'Summarize team activity and performance from this page.', description: 'Review recruiter output.' },
      { label: 'Team Workload', prompt: 'Help me review team workload and identify imbalances.', description: 'Spot overloaded teammates.' },
      { label: 'AI Capabilities', prompt: 'What can the AI do on the team page?', description: 'See page-specific help.' },
    ],
  },
  {
    key: 'reports',
    match: (pathname) => pathname === '/reports' || pathname.startsWith('/reports/'),
    bubbleMessage: 'Can I help with reports?',
    drawerSubtitle: 'Chat with your reporting copilot',
    chatGreeting:
      'You are on the Reports page. I can help interpret recruiting metrics, summarize patterns, and support reporting decisions. What would you like help with?',
    recommendations: [
      { label: 'Key Insights', prompt: 'Summarize the key report insights from this reports page.', description: 'Fast read of important report signals.' },
      { label: 'Next Report', prompt: 'Suggest what report to generate next and why.', description: 'Get report recommendations.' },
      { label: 'All Report Actions', prompt: 'What can the AI do on the reports page? Show me all available report prompts.', description: 'See reports-page AI actions.' },
      { label: 'Team Performance', prompt: 'Show team performance report.', description: 'Open the team performance summary.' },
    ],
  },
  {
    key: 'billing',
    match: (pathname) => pathname === '/billing' || pathname.startsWith('/billing/'),
    bubbleMessage: 'Can I help with billing?',
    drawerSubtitle: 'Chat with your billing copilot',
    chatGreeting:
      'You are on the Billing page. I can help explain billing information, review plan details, and support account questions. What would you like help with?',
    recommendations: [
      { label: 'Billing Summary', prompt: 'Summarize billing details from this page.', description: 'Quick billing overview.' },
      { label: 'Explain Billing', prompt: 'Help me understand this billing page and the key numbers.', description: 'Explain current billing data.' },
      { label: 'AI Capabilities', prompt: 'What can the AI do on the billing page?', description: 'See page-specific help.' },
    ],
  },
  {
    key: 'administration',
    match: (pathname) => pathname === '/administration' || pathname.startsWith('/administration/'),
    bubbleMessage: 'Can I help with admin tasks?',
    drawerSubtitle: 'Chat with your admin copilot',
    chatGreeting:
      'You are on the Administration page. I can help with system setup, process guidance, and admin workflows across the ATS. What would you like help with?',
    recommendations: [
      { label: 'Admin Tasks', prompt: 'Summarize admin tasks I can do here.', description: 'See available administration work.' },
      { label: 'System Setup', prompt: 'Help me with system setup on this page.', description: 'Get setup guidance.' },
      { label: 'AI Capabilities', prompt: 'What can the AI do on the administration page?', description: 'See page-specific help.' },
    ],
  },
  {
    key: 'setting',
    match: (pathname) => pathname === '/setting' || pathname.startsWith('/setting/'),
    bubbleMessage: 'Can I help with settings?',
    drawerSubtitle: 'Chat with your settings copilot',
    chatGreeting:
      'You are on the Settings page. I can help explain configuration options and guide account or workspace setup. What would you like help with?',
    recommendations: [
      { label: 'Explain Settings', prompt: 'Explain these settings in simple terms.', description: 'Understand current config.' },
      { label: 'Configure Page', prompt: 'Help me configure this settings page properly.', description: 'Get configuration guidance.' },
      { label: 'AI Capabilities', prompt: 'What can the AI do on the settings page?', description: 'See page-specific help.' },
    ],
  },
  {
    key: 'tasks',
    match: (pathname) => pathname === '/Task&Activites' || pathname.startsWith('/Task&Activites/'),
    bubbleMessage: 'Can I help with tasks?',
    drawerSubtitle: 'Chat with your tasks copilot',
    chatGreeting:
      'You are on the Tasks and Activities page. I can help organize work, prioritize actions, and support day-to-day recruiting execution. What would you like help with?',
    recommendations: [
      { label: 'Pending Tasks', prompt: 'Summarize my pending tasks from this page.', description: 'Quick task overview.' },
      { label: 'Prioritize Work', prompt: 'Help me prioritize today\'s work.', description: 'Sort what to do first.' },
      { label: 'AI Capabilities', prompt: 'What can the AI do on the tasks page?', description: 'See page-specific help.' },
    ],
  },
];

function getAssistantPageConfig(pathname: string | null): AssistantPageConfig | null {
  if (!pathname) return null;
  if (pathname.startsWith('/api') || pathname.startsWith('/auth') || pathname === '/login' || pathname === '/reset-password' || pathname === '/hq') {
    return null;
  }
  return PAGE_ASSISTANT_CONFIGS.find((config) => config.match(pathname)) ?? PAGE_ASSISTANT_CONFIGS[0];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function defaultPosition() {
  if (typeof window === 'undefined') return { x: MARGIN, y: MARGIN };
  return {
    x: clamp(window.innerWidth - SIZE - MARGIN, MARGIN, window.innerWidth - SIZE - MARGIN),
    y: clamp(window.innerHeight - SIZE - MARGIN, MARGIN, window.innerHeight - SIZE - MARGIN),
  };
}

function getHistoryStorageKey(pageKey: string) {
  return `${HISTORY_STORAGE_PREFIX}:${pageKey}`;
}

export function FloatingBotButton() {
  const pathname = usePathname();
  const pageConfig = getAssistantPageConfig(pathname);
  const pagePrompts = getPromptSuggestionsForPage(pageConfig?.key, pageConfig?.recommendations || []);
  const [mounted, setMounted] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'history'>('chat');
  const [chatMessages, setChatMessages] = useState<UiChatMessage[]>([]);
  const [showPageBubble, setShowPageBubble] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [selectedPromptToken, setSelectedPromptToken] = useState(0);
  const [historyReadyKey, setHistoryReadyKey] = useState<string | null>(null);
  const [conversationMemory, setConversationMemory] = useState<AssistantConversationMemory | null>(null);
  const [taskMemory, setTaskMemory] = useState<{ tasks: AssistantTaskChain[] } | null>(null);
  const [actionLog, setActionLog] = useState<AssistantActionLogItem[]>([]);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const hasDraggedRef = useRef(false);
  const seededGreetingKeyRef = useRef<string | null>(null);
  const previousPathRef = useRef<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { x?: number; y?: number };
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          setPos({
            x: clamp(parsed.x, MARGIN, window.innerWidth - SIZE - MARGIN),
            y: clamp(parsed.y, MARGIN, window.innerHeight - SIZE - MARGIN),
          });
          setMounted(true);
          return;
        }
      }
    } catch {
      /* ignore */
    }
    setPos(defaultPosition());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  useEffect(() => {
    // Prevent stale global assistant overlays from surviving auth/page redirects.
    setDrawerOpen(false);
    setDragging(false);
    setShowPageBubble(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) {
      setActiveTab('chat');
      setSelectedPrompt(null);
    }
  }, [drawerOpen]);

  useEffect(() => {
    if (!mounted) return;

    const pageChanged = previousPathRef.current !== pathname;
    previousPathRef.current = pathname ?? null;

    if (!pageChanged) {
      return;
    }

    seededGreetingKeyRef.current = null;

    if (!pageConfig) {
      setShowPageBubble(false);
      return;
    }

    setShowPageBubble(true);
    const timeoutId = window.setTimeout(() => setShowPageBubble(false), 8000);
    return () => window.clearTimeout(timeoutId);
  }, [mounted, pageConfig, pathname]);

  useEffect(() => {
    if (!mounted) return;

    if (!pageConfig) {
      setChatMessages([]);
      setConversationMemory(null);
      setTaskMemory(null);
      setActionLog([]);
      seededGreetingKeyRef.current = null;
      setHistoryReadyKey(null);
      return;
    }

    setHistoryReadyKey(null);

    let cancelled = false;
    const localFallback = (() => {
      try {
        const rawHistory = localStorage.getItem(getHistoryStorageKey(pageConfig.key));
        if (!rawHistory) return [];
        const parsedHistory = JSON.parse(rawHistory) as UiChatMessage[];
        if (!Array.isArray(parsedHistory)) return [];
        return parsedHistory.filter(
          (message): message is UiChatMessage =>
            !!message &&
            typeof message.id === 'string' &&
            (message.role === 'user' || message.role === 'assistant' || message.role === 'system') &&
            typeof message.content === 'string'
        );
      } catch {
        return [];
      }
    })();

    if (localFallback.length > 0) {
      setChatMessages(localFallback);
      seededGreetingKeyRef.current = pageConfig.key;
    } else {
      setChatMessages([]);
      seededGreetingKeyRef.current = null;
    }

    const loadHistory = async () => {
      try {
        const response = await apiGetAssistantHistory(pageConfig.key);
        if (cancelled) return;

        const remoteHistory = Array.isArray(response.data?.messages)
          ? response.data.messages.filter(
              (message): message is UiChatMessage =>
                !!message &&
                typeof message.id === 'string' &&
                (message.role === 'user' || message.role === 'assistant' || message.role === 'system') &&
                typeof message.content === 'string'
            )
          : [];

        const nextHistory = remoteHistory.length > 0 ? remoteHistory : localFallback;
        setChatMessages(nextHistory);
        setConversationMemory(response.data?.conversationMemory || null);
        setTaskMemory(response.data?.taskMemory || null);
        setActionLog(Array.isArray(response.data?.actionLog) ? response.data.actionLog : []);
        seededGreetingKeyRef.current = nextHistory.length > 0 ? pageConfig.key : null;
      } catch {
        if (cancelled) return;
        setChatMessages(localFallback);
        setConversationMemory(null);
        setTaskMemory(null);
        setActionLog([]);
        seededGreetingKeyRef.current = localFallback.length > 0 ? pageConfig.key : null;
      } finally {
        if (!cancelled) {
          setHistoryReadyKey(pageConfig.key);
        }
      }
    };

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [mounted, pageConfig]);

  useEffect(() => {
    if (!mounted || !pageConfig || historyReadyKey !== pageConfig.key) return;
    try {
      localStorage.setItem(getHistoryStorageKey(pageConfig.key), JSON.stringify(chatMessages.slice(-50)));
    } catch {
      /* ignore */
    }

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      void apiSaveAssistantHistory(pageConfig.key, {
        pathname: pathname ?? pageConfig.key,
        messages: chatMessages.slice(-50),
        conversationMemory: conversationMemory || undefined,
        taskMemory: taskMemory || undefined,
        actionLog: actionLog.length ? actionLog : undefined,
      }).catch(() => {
        /* ignore */
      });
    }, 400);

    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [actionLog, chatMessages, conversationMemory, historyReadyKey, mounted, pageConfig, pathname, taskMemory]);

  useEffect(() => {
    if (!drawerOpen || !pageConfig || historyReadyKey !== pageConfig.key || seededGreetingKeyRef.current === pageConfig.key) return;
    setChatMessages((current) => {
      seededGreetingKeyRef.current = pageConfig.key;
      return [
        ...current,
        { id: `${pageConfig.key}-greeting-${Date.now()}`, role: 'assistant', content: pageConfig.chatGreeting },
      ];
    });
    setShowPageBubble(false);
  }, [drawerOpen, pageConfig]);

  const persist = useCallback((x: number, y: number) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ x, y }));
    } catch {
      /* ignore */
    }
  }, []);

  const handleHistorySync = useCallback(
    (history: AssistantHistoryRecord | null, structured?: AssistantStructuredResponse | null) => {
      if (history) {
        setConversationMemory(history.conversationMemory || null);
        setTaskMemory(history.taskMemory || null);
        setActionLog(Array.isArray(history.actionLog) ? history.actionLog : []);
        return;
      }

      if (structured?.memory_update) {
        setConversationMemory({
          userIntent: structured.memory_update.userIntent,
          lastActions: structured.memory_update.lastActions,
          currentPageContext: structured.memory_update.currentPageContext,
          userPreferences: structured.memory_update.userPreferences,
          frequentlyUsedActions: structured.memory_update.frequentlyUsedActions,
          updatedAt: new Date().toISOString(),
        });
        setTaskMemory(structured.memory_update.taskMemory || null);
        setActionLog(Array.isArray(structured.memory_update.actionLog) ? structured.memory_update.actionLog : []);
      }
    },
    []
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      hasDraggedRef.current = false;
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        originX: pos.x,
        originY: pos.y,
      };
    },
    [pos.x, pos.y]
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current || e.pointerId !== dragRef.current.pointerId) return;
    const dx = e.clientX - dragRef.current.startClientX;
    const dy = e.clientY - dragRef.current.startClientY;
    if (Math.hypot(dx, dy) > TAP_MAX_MOVE_PX) {
      hasDraggedRef.current = true;
    }
    const maxX = window.innerWidth - SIZE - MARGIN;
    const maxY = window.innerHeight - SIZE - MARGIN;
    const nextX = clamp(dragRef.current.originX + dx, MARGIN, maxX);
    const nextY = clamp(dragRef.current.originY + dy, MARGIN, maxY);
    setPos({ x: nextX, y: nextY });
  }, []);

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const active = dragRef.current && e.pointerId === dragRef.current.pointerId;
      setDragging(false);
      if (!active) return;

      const wasTap = !hasDraggedRef.current;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      dragRef.current = null;
      setPos((p) => {
        persist(p.x, p.y);
        return p;
      });
      if (wasTap) {
        setDrawerOpen(true);
      }
    },
    [persist]
  );

  useEffect(() => {
    const onResize = () => {
      setPos((p) => ({
        x: clamp(p.x, MARGIN, window.innerWidth - SIZE - MARGIN),
        y: clamp(p.y, MARGIN, window.innerHeight - SIZE - MARGIN),
      }));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!mounted) return null;

  const bubbleLeft = clamp(pos.x - BUBBLE_WIDTH - BUBBLE_GAP, MARGIN, window.innerWidth - BUBBLE_WIDTH - MARGIN);
  const bubbleTop = clamp(
    pos.y + SIZE / 2 - BUBBLE_HEIGHT / 2,
    MARGIN,
    Math.max(MARGIN, window.innerHeight - BUBBLE_HEIGHT - MARGIN)
  );

  return (
    <>
      <AnimatePresence>
        {!drawerOpen && pageConfig && showPageBubble ? (
          <motion.div
            key={`${pageConfig.key}-helper-bubble`}
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.22 }}
            className="fixed z-[9998] rounded-full bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 px-4 py-2.5 shadow-[0_16px_34px_rgba(37,99,235,0.28)]"
            style={{
              left: bubbleLeft,
              top: bubbleTop,
              width: BUBBLE_WIDTH,
            }}
          >
            <button
              type="button"
              onClick={() => setShowPageBubble(false)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/75 transition hover:bg-white/10 hover:text-white"
              aria-label="Dismiss assistant message"
            >
              <X className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setShowPageBubble(false);
                setDrawerOpen(true);
              }}
              className="flex w-full items-center justify-start rounded-full pr-8 text-left text-sm font-semibold text-white"
            >
              {pageConfig.bubbleMessage}
            </button>
            <span
              aria-hidden="true"
              className="absolute -right-1.5 top-1/2 h-4 w-4 -translate-y-1/2 rotate-45 rounded-[4px] bg-blue-700"
            />
          </motion.div>
        ) : null}

        {drawerOpen ? (
          <>
            <motion.div
              key="bot-drawer-backdrop"
              role="presentation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[10000] bg-slate-900/50"
              onClick={() => setDrawerOpen(false)}
            />
            {pagePrompts.length ? (
              <motion.aside
                key="bot-drawer-prompt-rail"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ type: 'tween', duration: 0.22 }}
                className="fixed right-[calc(min(42rem,100vw)+2.5rem)] top-20 z-[10003] hidden w-[320px] xl:block"
              >
                <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.14)]">
                  <div className="border-b border-slate-200 px-5 py-5">
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.28em] text-slate-400">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
                      Prompt Suggestions
                    </div>
                  </div>
                  <div className="max-h-[70vh] overflow-y-auto px-5 py-5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-400">Recommended Prompts</p>
                    <div className="mt-5 space-y-2">
                      {pagePrompts.map((recommendation) => (
                        <button
                          key={`rail-${recommendation.label}`}
                          type="button"
                          onClick={() => {
                            setActiveTab('chat');
                            setSelectedPrompt(recommendation.prompt);
                            setSelectedPromptToken(Date.now());
                          }}
                          className="block w-full rounded-xl border border-transparent px-2 py-2.5 text-left text-[15px] leading-6 text-slate-700 transition hover:border-slate-200 hover:bg-slate-50"
                        >
                          {recommendation.prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.aside>
            ) : null}
            <motion.aside
              key="bot-drawer-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="floating-bot-drawer-title"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="fixed right-0 top-0 z-[10001] flex h-full min-h-0 w-full max-w-2xl flex-col bg-white shadow-2xl"
              onClick={(ev) => ev.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-orange-400 bg-orange-500 p-1">
                    <Image
                      src={BOT_IMAGE_SRC}
                      alt=""
                      width={40}
                      height={40}
                      className="h-full w-full rounded-full object-cover"
                      draggable={false}
                    />
                  </span>
                  <div>
                    <h2 id="floating-bot-drawer-title" className="text-lg font-semibold text-slate-900">
                      AI System Operator
                    </h2>
                    <p className="text-sm text-slate-500">{pageConfig?.drawerSubtitle ?? 'Operate your recruiting workflows with AI'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {chatMessages.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (pageConfig) {
                          try {
                            localStorage.removeItem(getHistoryStorageKey(pageConfig.key));
                          } catch {
                            /* ignore */
                          }
                          void apiDeleteAssistantHistory(pageConfig.key).catch(() => {
                            /* ignore */
                          });
                        }
                        seededGreetingKeyRef.current = null;
                        setChatMessages([]);
                        setConversationMemory(null);
                        setTaskMemory(null);
                        setActionLog([]);
                      }}
                      className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                      title="Clear conversation"
                      aria-label="Clear conversation"
                    >
                      <Eraser className="size-5" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                    aria-label="Close assistant"
                  >
                    <X className="size-5" />
                  </button>
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col p-5 pt-4">
                <div className="mb-4 inline-flex w-fit rounded-2xl border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('chat')}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                      activeTab === 'chat'
                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <MessageSquareText className="size-4" />
                    Chat
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                      activeTab === 'history'
                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <History className="size-4" />
                    History
                  </button>
                </div>

                {activeTab === 'chat' ? (
                  <AssistantChatPanel
                    pageKey={pageConfig?.key}
                    pathname={pathname || undefined}
                    recommendations={pagePrompts}
                    capabilities={getCapabilitiesForPage(pageConfig?.key)}
                    externalPrompt={selectedPrompt}
                    externalPromptToken={selectedPromptToken}
                    messages={chatMessages}
                    setMessages={setChatMessages}
                    onHistorySync={handleHistorySync}
                  />
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80">
                    <div className="border-b border-slate-200 px-4 py-3">
                      <h3 className="text-sm font-semibold text-slate-900">Conversation History</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Saved history for {pageConfig?.key ? `the ${pageConfig.key} page` : 'this page'}.
                      </p>
                    </div>
                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                      {chatMessages.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
                          No saved history yet for this page.
                        </div>
                      ) : (
                        chatMessages.map((message) => (
                          <div
                            key={`history-${message.id}`}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
                                message.role === 'user'
                                  ? 'rounded-br-md bg-blue-600 text-white'
                                  : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'
                              }`}
                            >
                              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">
                                {message.role === 'user' ? 'You' : 'AI Operator'}
                              </p>
                              <p className="whitespace-pre-wrap break-words">{message.content}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <button
        type="button"
        aria-label="Open assistant — drag to move"
        aria-expanded={drawerOpen}
        title="Tap to open assistant, drag to move"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setDrawerOpen(true);
          }
        }}
        className="fixed z-[9999] box-border touch-none select-none rounded-full border-2 border-orange-400 bg-orange-500 p-1.5 shadow-lg ring-2 ring-orange-200/80 transition-all duration-200 hover:border-blue-400 hover:bg-blue-600 hover:shadow-xl hover:ring-blue-200/80 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-300"
        style={{
          left: pos.x,
          top: pos.y,
          width: SIZE,
          height: SIZE,
          cursor: dragging ? 'grabbing' : 'grab',
        }}
      >
        <span className="relative block h-full w-full overflow-hidden rounded-full">
          <Image
            src={BOT_IMAGE_SRC}
            alt=""
            width={56}
            height={56}
            className="pointer-events-none h-full w-full rounded-full object-cover"
            draggable={false}
            priority={false}
          />
        </span>
      </button>
    </>
  );
}
