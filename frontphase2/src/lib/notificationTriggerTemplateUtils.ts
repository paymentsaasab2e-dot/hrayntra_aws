/** Client-side preview helpers for notification email templates ({{variable}} syntax). */

const SAMPLE_VALUES: Record<string, string> = {
  recipientName: 'Alex Recruiter',
  recipientEmail: 'alex.recruiter@example.com',
  loginUrl: 'https://app.hryantra.com/login',
  otp: '847291',
  loginId: 'alex.recruiter',
  tempPassword: 'TempPass-42',
  roleName: 'Recruiter',
  loginLink: 'https://app.hryantra.com/login?token=sample',
  resetPasswordLink: 'https://app.hryantra.com/reset-password',
  assigneeName: 'Alex Recruiter',
  leadCompanyName: 'Acme Corp',
  contactPerson: 'Jane Smith',
  leadEmail: 'jane@acme.example',
  leadPhone: '+1 555 0100',
  leadStatus: 'Qualified',
  leadPriority: 'High',
  assignedByName: ' by Sam Manager',
  followUpDate: 'June 15, 2026',
  followUpType: 'Call',
  notes: 'Discuss contract terms and next steps.',
  clientCompanyName: 'Acme Corp',
  clientIndustry: 'Technology',
  clientWebsite: 'https://acme.example',
  clientLocation: 'San Francisco, CA',
  clientStatus: 'Active',
  clientPriority: 'High',
  jobTitle: 'Senior Software Engineer',
  companyName: 'Acme Corp',
  jobLocation: 'Remote',
  jobStatus: 'Open',
  candidateCount: '3',
  candidateListHtml:
    '<ul><li>Jordan Lee — Senior Engineer</li><li>Morgan Kim — Staff Engineer</li></ul>',
  candidateName: 'Jordan Lee',
  scheduledAt: 'Tuesday, June 10, 2026 at 2:00 PM',
  location: 'Video call',
  meetingLink: 'https://meet.example/interview',
  panelMemberName: 'Alex Recruiter',
  clientName: 'Acme Corp',
  recruiterName: 'Alex Recruiter',
  message: 'Please review the shortlisted candidates below.',
  candidatesHtml: '<p><strong>Jordan Lee</strong> — 8 years experience</p>',
  portalUrl: 'https://app.hryantra.com/client-review',
  startDate: 'July 1, 2026',
  invoiceNumber: 'INV-2026-0042',
  amount: '$12,500.00',
  dueDate: 'July 15, 2026',
  invoiceNote: 'Payment terms: Net 30.',
  offerDetails: 'Compensation and start date are outlined in your offer letter.',
  feedbackMessage: 'After careful review, we will not be moving forward at this time.',
  closedReason: 'Position filled internally.',
};

export function interpolateNotificationTemplate(
  template: string,
  variables: Record<string, string>,
): string {
  return String(template || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const value = variables[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

export function buildPreviewVariables(variableKeys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of variableKeys) {
    out[key] = SAMPLE_VALUES[key] ?? `[${key}]`;
  }
  return out;
}
