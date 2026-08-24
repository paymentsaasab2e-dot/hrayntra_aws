import type { Client, ClientStage } from '@/app/client/types';
import { HQ_COMPANY_STATUS_LABELS, type HqCompanyStatus } from '@/app/hq/company/hqCompaniesData';
import { mergeDirectorIntoOtherDetails } from '@/lib/clientDirectorDetails';
import type { BackendClient, HqCompanyApiRow } from '@/lib/api';

export function hqStatusToClientStage(status: HqCompanyStatus): ClientStage {
  if (status === 'on_hold') return 'On Hold';
  if (status === 'inactive' || status === 'closed') return 'Inactive';
  return 'Active';
}

export function mapHqCompanyToClient(row: HqCompanyApiRow): Client {
  const stage = hqStatusToClientStage(row.status);
  const leadStatus = row.leadStatus || HQ_COMPANY_STATUS_LABELS[row.status] || stage;
  return {
    id: row.id,
    name: row.name,
    industry: row.industry || '',
    location: row.location || [row.city, row.state, row.country].filter(Boolean).join(', '),
    openJobs: 0,
    activeCandidates: 0,
    placements: 0,
    stage,
    leadStatus,
    leadStatusValue: leadStatus,
    owner: { name: row.owner || 'Unassigned', avatar: '' },
    assignedToId: row.assignedToId || undefined,
    lastActivity: row.nextFollowUp || '—',
    updatedAt: row.createdAt || undefined,
    logo: row.logo || '',
    companySize: row.companySize || (row.users ? String(row.users) : ''),
    hiringLocations: row.hiringLocations || '',
    servicesNeeded: row.servicesNeeded || '',
    expectedBusinessValue: row.expectedBusinessValue || String(row.estimatedDealValue || ''),
    website: row.website || '',
    linkedin: row.linkedin || '',
    timezone: row.timezone || '',
    priority: (row.priority as Client['priority']) || undefined,
    sla: row.sla || '',
    nextFollowUpDue: row.nextFollowUpAt || undefined,
    city: row.city || '',
    state: row.state || '',
    country: row.country || '',
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    directorSalutation: row.directorSalutation || null,
    emails: row.emails || (row.email ? [row.email] : []),
    phones: row.phones || (row.phone ? [row.phone] : []),
    teamMemberDesignation: row.teamMemberDesignation || undefined,
    teamMemberEmail: row.teamMemberEmail || undefined,
    teamMemberPhone: row.teamMemberPhone || undefined,
    otherDetails:
      mergeDirectorIntoOtherDetails(row.otherDetails || [], {
        directorSalutation: row.directorSalutation,
        directorName: row.directorName || row.contact || '',
      }) || [],
    contacts: [],
    jobs: [],
    pipelineCandidates: [],
    placementList: [],
    activityList: [],
    notesList: [],
    fileList: [],
  };
}

export function mapHqCompanyToBackendClient(row: HqCompanyApiRow): BackendClient {
  return {
    id: row.id,
    companyName: row.name,
    industry: row.industry || null,
    website: row.website || null,
    location: row.location || null,
    status: row.status === 'inactive' ? 'INACTIVE' : row.status === 'on_hold' ? 'ON_HOLD' : 'ACTIVE',
    leadStatus: row.leadStatus || HQ_COMPANY_STATUS_LABELS[row.status] || 'Active',
    assignedToId: row.assignedToId || null,
    companySize: row.companySize || null,
    hiringLocations: row.hiringLocations || null,
    servicesNeeded: row.servicesNeeded || null,
    expectedBusinessValue: row.expectedBusinessValue || null,
    linkedin: row.linkedin || null,
    timezone: row.timezone || null,
    priority: row.priority || null,
    sla: row.sla || null,
    nextFollowUpDue: row.nextFollowUpAt || null,
    city: row.city || null,
    state: row.state || null,
    country: row.country || null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    directorSalutation: row.directorSalutation || null,
    teamMemberDesignation: row.teamMemberDesignation || null,
    teamMemberEmail: row.teamMemberEmail || null,
    teamMemberPhone: row.teamMemberPhone || null,
    email: row.email || null,
    phone: row.phone || null,
    emails: row.emails || [],
    phones: row.phones || [],
    otherDetails: row.otherDetails || [],
    logo: row.logo || null,
  } as BackendClient;
}
