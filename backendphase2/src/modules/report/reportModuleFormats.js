/**
 * CSV row shapes aligned with list-page Export buttons (Jobs, Clients, Candidates,
 * Interviews, Placements). Used by Reports tab previews and exports.
 */

function formatDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

function formatDateTime(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

function joinList(value) {
  if (!Array.isArray(value)) return '';
  return value.filter(Boolean).join('; ');
}

function primaryContact(contacts, field) {
  const list = Array.isArray(contacts) ? contacts : [];
  const primary = list.find((c) => c?.isPrimary) || list[0];
  if (!primary) return '';
  return String(primary[field] || '').trim();
}

function contactList(contacts, field) {
  const list = Array.isArray(contacts) ? contacts : [];
  const values = list.map((c) => String(c?.[field] || '').trim()).filter(Boolean);
  return values.join('; ');
}

/** Jobs page export (`job/page.tsx` handleExportJobsCsv). */
export function buildJobsModuleExport(jobs, pipelineCountsByJob = new Map()) {
  const columns = [
    'title',
    'client',
    'location',
    'jobLocationType',
    'status',
    'openings',
    'applied',
    'interviewed',
    'offered',
    'joined',
    'owner',
    'createdDate',
    'hot',
    'aiMatch',
    'noCandidates',
    'slaRisk',
  ];

  const rows = (jobs || []).map((job) => {
    const metrics = pipelineCountsByJob.get(job.id) || {};
    return {
      title: job.title || '',
      client: job.client?.companyName || '',
      location: job.location || '',
      jobLocationType: job.jobLocationType || '',
      status: job.status || '',
      openings: job.openings ?? '',
      applied: metrics.applied ?? 0,
      interviewed: metrics.interviewed ?? 0,
      offered: metrics.offered ?? 0,
      joined: metrics.joined ?? 0,
      owner: job.assignedTo?.name || '',
      createdDate: formatDate(job.postedDate || job.createdAt),
      hot: job.hot ? 'true' : 'false',
      aiMatch: job.aiMatch ? 'true' : 'false',
      noCandidates: job.noCandidates ? 'true' : 'false',
      slaRisk: job.slaRisk ? 'true' : 'false',
    };
  });

  return { title: 'Jobs Report', columns, rows };
}

/** Clients page export (`client/page.tsx` handleExportClientsCsv). */
export function buildClientsModuleExport(clients) {
  const columns = [
    'name',
    'industry',
    'location',
    'city',
    'country',
    'contactPerson',
    'email',
    'phone',
    'companySize',
    'servicesNeeded',
    'leadStatus',
    'priority',
    'expectedBusinessValue',
    'nextFollowUpDue',
    'notes',
    'owner',
    'openJobs',
    'placements',
    'lastActivity',
  ];

  const rows = (clients || []).map((client) => ({
    name: client.companyName || '',
    industry: client.industry && client.industry !== 'Not specified' ? client.industry : '',
    location: client.location && client.location !== 'Not specified' ? client.location : '',
    city: '',
    country: '',
    contactPerson: primaryContact(client.contacts, 'firstName')
      ? `${primaryContact(client.contacts, 'firstName')} ${primaryContact(client.contacts, 'lastName')}`.trim()
      : contactList(client.contacts, 'firstName'),
    email: contactList(client.contacts, 'email') || primaryContact(client.contacts, 'email'),
    phone: contactList(client.contacts, 'phone') || primaryContact(client.contacts, 'phone'),
    companySize: client.companySize || '',
    servicesNeeded: client.servicesNeeded || '',
    leadStatus: client.leadStatus || client.status || '',
    priority: client.priority || '',
    expectedBusinessValue: client.expectedBusinessValue || '',
    nextFollowUpDue: formatDate(client.nextFollowUpDue),
    notes: '',
    owner: client.assignedTo?.name || '',
    openJobs: client.openJobs ?? client.staleJobsCount ?? '',
    placements: client.placementsThisMonth ?? '',
    lastActivity: client.lastActivity ? formatDate(client.lastActivity) : '',
  }));

  return { title: 'Clients Report', columns, rows };
}

/** Candidates page export (`candidate/page.tsx`). */
export function buildCandidatesModuleExport(candidates) {
  const columns = [
    'name',
    'email',
    'phone',
    'designation',
    'company',
    'experience',
    'location',
    'stage',
    'owner',
    'lastActivity',
    'hotlist',
    'noticePeriod',
    'currentSalary',
    'expectedSalary',
    'source',
    'rating',
    'skills',
    'assignedJobs',
  ];

  const rows = (candidates || []).map((candidate) => ({
    name: `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim(),
    email: candidate.email || '',
    phone: candidate.phone || '',
    designation: candidate.currentTitle || candidate.designation || '',
    company: candidate.currentCompany || '',
    experience: candidate.experience ?? '',
    location: candidate.location || '',
    stage: candidate.stage || '',
    owner: candidate.assignedTo?.name || 'Unassigned',
    lastActivity: formatDate(candidate.updatedAt || candidate.createdAt),
    hotlist: candidate.hotlist ? 'true' : 'false',
    noticePeriod: candidate.noticePeriod || '',
    currentSalary: candidate.currentSalary || '',
    expectedSalary: candidate.expectedSalary || '',
    source: candidate.source || '',
    rating: candidate.rating ?? '',
    skills: joinList(candidate.skills),
    assignedJobs: joinList(candidate.assignedJobs),
  }));

  return { title: 'Candidates Report', columns, rows };
}

/** Interviews page export (`interviews/page.tsx`). */
export function buildInterviewsModuleExport(interviews) {
  const columns = [
    'candidateName',
    'candidateEmail',
    'jobTitle',
    'client',
    'round',
    'type',
    'mode',
    'date',
    'time',
    'duration',
    'timezone',
    'status',
    'feedbackStatus',
    'meetingPlatform',
    'meetingLink',
    'location',
    'panel',
    'createdBy',
    'notes',
  ];

  const rows = (interviews || []).map((interview) => {
    const scheduled = interview.scheduledAt ? new Date(interview.scheduledAt) : null;
    const panelNames = Array.isArray(interview.panelMembers)
      ? interview.panelMembers.map((p) => p?.name).filter(Boolean)
      : interview.interviewer?.name
        ? [interview.interviewer.name]
        : [];

    return {
      candidateName: `${interview.candidate?.firstName || ''} ${interview.candidate?.lastName || ''}`.trim(),
      candidateEmail: interview.candidate?.email || '',
      jobTitle: interview.job?.title || '',
      client: interview.job?.client?.companyName || interview.client?.companyName || '',
      round: interview.round || '',
      type: interview.type || '',
      mode: interview.mode || '',
      date: scheduled ? formatDate(scheduled) : formatDate(interview.date),
      time: interview.time || (scheduled ? scheduled.toISOString().slice(11, 16) : ''),
      duration: interview.duration ?? '',
      timezone: interview.timezone || '',
      status: interview.status || '',
      feedbackStatus: interview.feedbackStatus || '',
      meetingPlatform: interview.platform || interview.meetingPlatform || '',
      meetingLink: interview.meetingLink || '',
      location: interview.location || '',
      panel: panelNames.join('; '),
      createdBy: interview.createdBy?.name || interview.createdByUser?.name || '',
      notes: interview.notes || '',
    };
  });

  return { title: 'Interviews Report', columns, rows };
}

/** Placements page export (`placement.service.js` exportCsv). */
export function buildPlacementsModuleExport(placements) {
  const columns = [
    'Placement ID',
    'Candidate',
    'Company',
    'Job',
    'Recruiter',
    'Salary',
    'Placement Fee',
    'Commission %',
    'Revenue',
    'Offer Date',
    'Joining Date',
    'Status',
    'Payment Status',
  ];

  const rows = (placements || []).map((placement) => ({
    'Placement ID': placement.id,
    Candidate: `${placement.candidate?.firstName || ''} ${placement.candidate?.lastName || ''}`.trim(),
    Company: placement.client?.companyName || '',
    Job: placement.job?.title || '',
    Recruiter: placement.recruiter?.name || '',
    Salary: placement.salaryOffered ?? placement.salary ?? '',
    'Placement Fee': placement.placementFee ?? placement.fee ?? '',
    'Commission %': placement.commissionPercentage ?? '',
    Revenue: placement.revenue ?? placement.placementFee ?? placement.fee ?? '',
    'Offer Date': formatDateTime(placement.offerDate),
    'Joining Date': formatDateTime(placement.joiningDate),
    Status: placement.status || '',
    'Payment Status': placement.billing?.[0]?.paymentStatus || 'PENDING',
  }));

  return { title: 'Placements Report', columns, rows };
}

export function limitDataset(dataset, max = 100) {
  if (!dataset) return dataset;
  const rows = Array.isArray(dataset.rows) ? dataset.rows.slice(0, max) : [];
  return {
    ...dataset,
    rows,
    rowCount: rows.length,
    totalRows: Array.isArray(dataset.rows) ? dataset.rows.length : rows.length,
  };
}
