/**
 * Example previews for Alerts Management — what users see in bell, email, AI brief, and tables.
 * Keys match alert id in alert-catalog.js.
 */
export const ALERT_EXAMPLE_PREVIEWS = {
  // ── AI Analysis ──
  'ai.workspace_brief': {
    portalTitle: '3 follow-ups overdue — review your workspace',
    portalBody:
      'You have 2 overdue client follow-ups, 1 overdue lead, and an interview today. Open the dashboard AI brief for next steps.',
    emailSubject: 'AI Workspace Brief — 3 items need attention',
    shownIn: 'Dashboard → Analyze now • Bell notification • Brief email intro',
  },
  'ai.scheduled_brief': {
    portalTitle: 'Your daily AI workspace brief is ready',
    portalBody: 'Scheduled analysis found 4 priority alerts across clients, jobs, and tasks.',
    emailSubject: 'Daily AI Workspace Brief — Jun 23, 2026',
    shownIn: 'Daily bell + email at your scheduled Analyze time',
  },
  'ai.client.followup_overdue': {
    portalTitle: 'Overdue Client Follow-Up',
    portalBody: 'Follow-up for Globex Industries was due 18 Jun 2026.',
    emailSubject: 'AI Alert: Overdue client follow-up — Globex Industries',
    shownIn: 'AI brief table • Clients list AI Alert column • Client drawer',
  },
  'ai.lead.followup_overdue': {
    portalTitle: 'Overdue Lead Follow-Up',
    portalBody: 'Follow-up for Acme Corp was due 20 Jun 2026.',
    emailSubject: 'AI Alert: Overdue lead follow-up — Acme Corp',
    shownIn: 'AI brief • Leads table • Lead drawer',
  },
  'ai.task.overdue': {
    portalTitle: 'Overdue Task',
    portalBody: '"Send revised contract to Globex" was due 19 Jun 2026.',
    emailSubject: 'AI Alert: Overdue task — Send revised contract to Globex',
    shownIn: 'AI brief • Tasks table • Task drawer',
  },
  'ai.job.low_applicants': {
    portalTitle: 'Job Needs Applicants',
    portalBody: '"Senior React Developer" has only 1 applicant.',
    emailSubject: 'AI Alert: Job needs applicants — Senior React Developer',
    shownIn: 'AI brief • Jobs table • Job drawer',
  },
  'ai.candidate.pipeline_followup_overdue': {
    portalTitle: 'Overdue Pipeline Follow-Up',
    portalBody: 'John Smith (Interview stage) follow-up was due 17 Jun 2026.',
    emailSubject: 'AI Alert: Pipeline follow-up overdue — John Smith',
    shownIn: 'AI brief • Candidates / Pipeline / Matches tables • Candidate drawer',
  },
  'ai.interview.today': {
    portalTitle: 'Interview Today',
    portalBody: 'Priya Sharma — Senior Developer at 2:30 PM today.',
    emailSubject: 'AI Alert: Interview today — Priya Sharma',
    shownIn: 'AI brief • Interviews table • Interview drawer',
  },
  'ai.placement.joining_overdue': {
    portalTitle: 'Overdue Joining Date',
    portalBody: 'Joining for Rahul Mehta was scheduled for 15 Jun 2026.',
    emailSubject: 'AI Alert: Overdue joining — Rahul Mehta',
    shownIn: 'AI brief • Placements table • Placement drawer',
  },
  'ai.team.request_pending': {
    portalTitle: 'Pending Team Request',
    portalBody: 'Sarah Kumar requested: Approve client handoff for TechNova.',
    emailSubject: 'AI Alert: Pending team request — client handoff',
    shownIn: 'AI brief • Team members table • Member profile drawer',
  },
  'ai.general': {
    portalTitle: 'Pipeline bottleneck on Backend roles',
    portalBody: 'AI suggests reviewing 3 stalled candidates in the Backend pipeline.',
    emailSubject: 'AI Insight: Pipeline bottleneck detected',
    shownIn: 'AI brief when AI surfaces custom insights',
  },

  // ── Leads ──
  'lead.assigned': {
    portalTitle: 'Lead assigned to you',
    portalBody: 'Acme Corp — Jane Doe (New, High priority). Assigned by Admin.',
    emailSubject: 'New lead assigned: Acme Corp',
    shownIn: 'Bell • Email to assignee when lead ownership changes',
  },
  'lead.followup_due_today': {
    portalTitle: 'Lead follow-up due today',
    portalBody: 'Acme Corp — call scheduled for today, 23 Jun 2026.',
    emailSubject: 'Reminder: Follow-up due today — Acme Corp',
    shownIn: 'Bell • Email on due date (scheduler)',
  },
  'lead.followup_overdue': {
    portalTitle: 'Lead follow-up overdue',
    portalBody: 'Acme Corp follow-up was due 20 Jun 2026. Act today to protect conversion.',
    emailSubject: 'Overdue: Lead follow-up — Acme Corp',
    shownIn: 'Bell • Email when follow-up date passes',
  },
  'lead.status_changed': {
    portalTitle: 'Lead status changed',
    portalBody: 'Acme Corp: New → Qualified (changed by Sarah).',
    emailSubject: 'Lead status update — Acme Corp',
    shownIn: 'Bell • Email to assignee on status change',
  },
  'lead.marked_lost': {
    portalTitle: 'Lead marked as lost',
    portalBody: 'Acme Corp was marked Lost. Reason: Budget freeze.',
    emailSubject: 'Lead lost — Acme Corp',
    shownIn: 'Bell • Email when lead is marked lost',
  },
  'lead.converted_to_client': {
    portalTitle: 'Lead converted to client',
    portalBody: 'Acme Corp converted to client "Acme Corp Pvt Ltd".',
    emailSubject: 'Lead converted — Acme Corp',
    shownIn: 'Bell • Email on conversion',
  },

  // ── Clients ──
  'client.assigned': {
    portalTitle: 'Client assigned to you',
    portalBody: 'Globex — Technology, Active. Assigned by Admin.',
    emailSubject: 'New client assigned: Globex',
    shownIn: 'Bell • Email when client ownership changes',
  },
  'client.followup_due': {
    portalTitle: 'Client follow-up due',
    portalBody: 'Globex — retention check-in due 23 Jun 2026.',
    emailSubject: 'Client follow-up reminder — Globex',
    shownIn: 'Bell • Email on follow-up due date',
  },
  'client.followup_overdue': {
    portalTitle: 'Client follow-up overdue',
    portalBody: 'Globex follow-up was due yesterday — please reconnect.',
    emailSubject: 'Overdue client follow-up — Globex',
    shownIn: 'Bell • Email when client follow-up is overdue',
  },
  'client.kyc_incomplete': {
    portalTitle: 'Client KYC incomplete',
    portalBody: 'Globex has KYC details but trade license and bank proof are missing.',
    emailSubject: 'KYC incomplete — Globex',
    shownIn: 'Bell • Email when compliance docs are missing',
  },
  'client.invoice_overdue': {
    portalTitle: 'Overdue invoices on client',
    portalBody: 'Globex has 2 overdue invoices totalling $18,400.',
    emailSubject: 'Collections alert — Globex overdue invoices',
    shownIn: 'Bell only (email off by default)',
  },
  'client.status_changed': {
    portalTitle: 'Client status changed',
    portalBody: 'Globex: PROSPECT → ACTIVE.',
    emailSubject: 'Client status update — Globex',
    shownIn: 'Bell • Email on client status change',
  },

  // ── Jobs ──
  'job.assigned': {
    portalTitle: 'Job assigned to you',
    portalBody: 'Senior Developer — Globex, Remote, Open.',
    emailSubject: 'Job assigned: Senior Developer',
    shownIn: 'Bell • Email when job recruiter is set',
  },
  'job.near_sla': {
    portalTitle: 'Job near SLA / deadline',
    portalBody: 'Senior Developer is at risk — target closure 30 Jun 2026.',
    emailSubject: 'SLA warning — Senior Developer',
    shownIn: 'Bell • Email when closure date is approaching',
  },
  'job.closed': {
    portalTitle: 'Job closed',
    portalBody: 'Senior Developer (Globex) is now CLOSED. Reason: Position filled.',
    emailSubject: 'Job closed — Senior Developer',
    shownIn: 'Bell • Email when job status becomes closed',
  },
  'job.zero_applicants': {
    portalTitle: 'Zero applicants on open job',
    portalBody: 'Senior Developer has no applicants yet — sourcing needed.',
    emailSubject: 'Sourcing gap — Senior Developer has 0 applicants',
    shownIn: 'Bell • Email for open jobs with no applicants',
  },
  'job.portal_application': {
    portalTitle: 'New portal application',
    portalBody: 'John Smith applied to Senior Developer (Globex).',
    emailSubject: 'New application — Senior Developer',
    shownIn: 'Bell • Email when candidate applies via job portal',
  },
  'job.candidate_reapplied': {
    portalTitle: 'Candidate re-applied',
    portalBody: 'John Smith applied again to Senior Developer (previously rejected).',
    emailSubject: 'Re-application — John Smith for Senior Developer',
    shownIn: 'Bell • Email when rejected candidate applies again',
  },

  // ── Candidates ──
  'candidate.assigned': {
    portalTitle: 'Candidate assigned to you',
    portalBody: 'John Smith — john@example.com assigned by Admin.',
    emailSubject: 'Candidate assigned: John Smith',
    shownIn: 'Bell • Email when candidate owner changes',
  },
  'candidate.stage_changed': {
    portalTitle: 'Pipeline stage changed',
    portalBody: 'John Smith moved to Interview (Senior Developer).',
    emailSubject: 'Stage update — John Smith',
    shownIn: 'Bell • Email on pipeline stage change',
  },
  'candidate.rejected': {
    portalTitle: 'Candidate rejected',
    portalBody: 'John Smith was rejected for Senior Developer. Reason: Skills mismatch.',
    emailSubject: 'Candidate rejected — John Smith',
    shownIn: 'Bell • Internal email (+ optional candidate rejection email)',
  },
  'candidate.hired': {
    portalTitle: 'Candidate hired / placed',
    portalBody: 'John Smith placed at Globex for Senior Developer.',
    emailSubject: 'Placement confirmed — John Smith',
    shownIn: 'Bell • Email on hire/placement milestone',
  },

  // ── Interviews ──
  'interview.scheduled': {
    portalTitle: 'Interview scheduled',
    portalBody: 'John Smith — Senior Developer on 25 Jun 2026, 2:00 PM (Video call).',
    emailSubject: 'Interview scheduled — John Smith',
    shownIn: 'Bell • Email to panel / recruiter',
  },
  'interview.rescheduled': {
    portalTitle: 'Interview rescheduled',
    portalBody: 'John Smith — Senior Developer moved to 28 Jun 2026, 3:00 PM.',
    emailSubject: 'Interview rescheduled — John Smith',
    shownIn: 'Bell • Email on schedule change',
  },
  'interview.cancelled': {
    portalTitle: 'Interview cancelled',
    portalBody: 'John Smith — Senior Developer on 25 Jun was cancelled. Panel conflict.',
    emailSubject: 'Interview cancelled — John Smith',
    shownIn: 'Bell • Email when interview is cancelled',
  },
  'interview.feedback_overdue': {
    portalTitle: 'Interview feedback overdue',
    portalBody: 'Feedback pending for John Smith — Senior Developer (completed 3 days ago).',
    emailSubject: 'Feedback overdue — John Smith interview',
    shownIn: 'Bell only (email off by default)',
  },
  'interview.today_reminder': {
    portalTitle: 'Interview today',
    portalBody: 'John Smith for Senior Developer — today 2:00 PM.',
    emailSubject: 'Reminder: Interview today — John Smith',
    shownIn: 'Bell • Email morning-of reminder',
  },

  // ── Placements ──
  'placement.created': {
    portalTitle: 'Placement / offer created',
    portalBody: 'John Smith placed at Globex for Senior Developer.',
    emailSubject: 'New placement — John Smith',
    shownIn: 'Bell • Email when placement record is created',
  },
  'placement.joining_scheduled': {
    portalTitle: 'Joining date scheduled',
    portalBody: 'John Smith joining Globex on 1 Jul 2026 — Senior Developer.',
    emailSubject: 'Joining scheduled — John Smith',
    shownIn: 'Bell • Email to recruiter + candidate joining notice',
  },
  'placement.offer_response': {
    portalTitle: 'Offer accepted / declined',
    portalBody: 'John Smith accepted the offer for Senior Developer.',
    emailSubject: 'Offer response — John Smith accepted',
    shownIn: 'Bell • Email when candidate responds on portal',
  },
  'placement.failed': {
    portalTitle: 'Placement failed / no-show',
    portalBody: 'John Smith did not join Globex — replacement may be required.',
    emailSubject: 'Placement failed — John Smith',
    shownIn: 'Bell only (email off by default)',
  },
  'placement.replacement_required': {
    portalTitle: 'Replacement required',
    portalBody: 'Globex — Senior Developer guarantee period: replacement needed.',
    emailSubject: 'Replacement required — Senior Developer',
    shownIn: 'Bell only (email off by default)',
  },

  // ── Billing ──
  'billing.invoice_sent': {
    portalTitle: 'Invoice sent to client',
    portalBody: 'INV-2026-0042 sent to Globex for $12,500.',
    emailSubject: 'Invoice sent — INV-2026-0042',
    shownIn: 'Bell • Email when invoice is emailed to client',
  },
  'billing.invoice_overdue': {
    portalTitle: 'Invoice overdue',
    portalBody: 'INV-2026-0038 for Globex is overdue ($8,200).',
    emailSubject: 'Overdue invoice — INV-2026-0038',
    shownIn: 'Bell • Email for collections follow-up',
  },
  'billing.draft_ready': {
    portalTitle: 'Draft invoice ready',
    portalBody: 'Draft INV-2026-0043 ready for Globex ($12,500) — review and send.',
    emailSubject: 'Draft invoice ready — Globex',
    shownIn: 'Bell • Email when draft is ready for finance',
  },

  // ── Matches ──
  'match.submitted_to_client': {
    portalTitle: 'Submitted to client',
    portalBody: 'John Smith submitted for Senior Developer (Globex) — awaiting review.',
    emailSubject: 'Candidates submitted — Senior Developer',
    shownIn: 'Bell • Email when recruiter submits shortlist',
  },
  'match.client_review_completed': {
    portalTitle: 'Client review completed',
    portalBody: 'Globex reviewed John Smith for Senior Developer: Approved for next round.',
    emailSubject: 'Client review done — John Smith',
    shownIn: 'Bell • Email when client finishes review on portal',
  },

  // ── Pipeline ──
  'pipeline.followup_overdue': {
    portalTitle: 'Pipeline follow-up overdue',
    portalBody: 'John Smith (Interview) — follow-up was due yesterday.',
    emailSubject: 'Pipeline follow-up overdue — John Smith',
    shownIn: 'Bell when candidate pipeline follow-up is due/overdue',
  },

  // ── Tasks ──
  'task.assigned': {
    portalTitle: 'Task assigned to you',
    portalBody: '"Call Globex about renewal" — High priority, due 25 Jun 2026.',
    emailSubject: 'Task assigned: Call Globex about renewal',
    shownIn: 'Bell when a task is assigned (email off by default)',
  },
  'task.completed': {
    portalTitle: 'Task completed',
    portalBody: '"Send contract to Globex" was marked completed by Sarah.',
    emailSubject: 'Task completed: Send contract to Globex',
    shownIn: 'Bell to task creator (email off by default)',
  },
  'task.overdue': {
    portalTitle: 'Task overdue',
    portalBody: '"Send contract to Globex" was due 20 Jun 2026.',
    emailSubject: 'Overdue task: Send contract to Globex',
    shownIn: 'Bell • Tasks table SLA badge (email off by default)',
  },
  'task.due_today': {
    portalTitle: 'Task due today',
    portalBody: '"Prepare interview panel notes" is due today.',
    emailSubject: 'Due today: Prepare interview panel notes',
    shownIn: 'Bell on due date (email off by default)',
  },

  // ── Team & System ──
  'system.welcome': {
    portalTitle: '—',
    portalBody: 'Welcome emails are email-only (no bell).',
    emailSubject: 'Welcome to HRYANTRA — get started',
    shownIn: 'Email only after registration',
  },
  'system.otp': {
    portalTitle: '—',
    portalBody: 'OTP codes are email-only (no bell).',
    emailSubject: 'Your verification code: 123456',
    shownIn: 'Email only for password reset / verification',
  },
  'system.team_invite': {
    portalTitle: '—',
    portalBody: 'Team invites are email-only (no bell).',
    emailSubject: 'You have been invited to join the workspace',
    shownIn: 'Email with login credentials for new team member',
  },
};

export function getAlertExamplePreview(alertId) {
  return ALERT_EXAMPLE_PREVIEWS[String(alertId || '').trim()] || null;
}

export function enrichCatalogWithExamples(catalogGroups) {
  return catalogGroups.map((group) => ({
    ...group,
    alerts: group.alerts.map((alert) => ({
      ...alert,
      examplePreview: getAlertExamplePreview(alert.id),
    })),
  }));
}
