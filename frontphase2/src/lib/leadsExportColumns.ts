import type { Lead } from '../app/leads/types';
import { formatDirectorDisplay } from '../constants/salutations';
import type { CsvColumn } from '../utils/csv';
import { csvDate } from '../utils/csv';

export type LeadExportColumnDef = CsvColumn<Lead> & { label: string };

/** All CSV columns available for leads export (matches importer field ids where applicable). */
export const LEADS_EXPORT_COLUMNS: LeadExportColumnDef[] = [
  { id: 'companyName', label: 'Company Name', accessor: (l) => l.companyName },
  { id: 'directorSalutation', label: 'Salutation', accessor: (l) => l.directorSalutation || '' },
  {
    id: 'contactPerson',
    label: 'Contact Person',
    accessor: (l) => formatDirectorDisplay(l.directorSalutation, l.directorName || l.contactPerson),
  },
  { id: 'email', label: 'Email', accessor: (l) => l.email },
  { id: 'phone', label: 'Phone', accessor: (l) => l.phone },
  { id: 'type', label: 'Lead Type', accessor: (l) => l.type || '' },
  { id: 'source', label: 'Source', accessor: (l) => l.source || '' },
  { id: 'status', label: 'Status', accessor: (l) => l.status },
  { id: 'priority', label: 'Interest Level', accessor: (l) => l.priority || '' },
  { id: 'industry', label: 'Sector / Industry', accessor: (l) => l.industry || '' },
  { id: 'companySize', label: 'Team Name', accessor: (l) => l.companySize || '' },
  { id: 'website', label: 'Website', accessor: (l) => l.website || '' },
  { id: 'linkedIn', label: 'LinkedIn', accessor: (l) => l.linkedIn || '' },
  { id: 'location', label: 'Location', accessor: (l) => l.location || '' },
  { id: 'city', label: 'City', accessor: (l) => l.city || '' },
  { id: 'country', label: 'Country', accessor: (l) => l.country || '' },
  { id: 'state', label: 'State', accessor: (l) => l.state || '' },
  { id: 'designation', label: 'Designation', accessor: (l) => l.designation || '' },
  { id: 'interestedNeeds', label: 'Services Needed', accessor: (l) => l.interestedNeeds || l.servicesNeeded || '' },
  { id: 'campaignName', label: 'Campaign Name', accessor: (l) => l.campaignName || '' },
  { id: 'nextFollowUpDue', label: 'Next Follow-up Date', accessor: (l) => csvDate(l.nextFollowUp) },
  { id: 'notes', label: 'Notes', accessor: (l) => l.notes || '' },
  {
    id: 'assignedTo',
    label: 'Assigned To',
    accessor: (l) =>
      Array.isArray(l.assignedToUsers) && l.assignedToUsers.length > 0
        ? l.assignedToUsers.map((u) => u.name).join('; ')
        : l.assignedTo?.name || '',
  },
  { id: 'lastFollowUp', label: 'Last Follow-up', accessor: (l) => csvDate(l.lastFollowUp) },
  { id: 'expectedBusinessValue', label: 'Expected Business Value', accessor: (l) => l.expectedBusinessValue || '' },
];

export function buildLeadsCsvColumns(selectedIds: string[]): CsvColumn<Lead>[] {
  const idSet = new Set(selectedIds);
  return LEADS_EXPORT_COLUMNS.filter((col) => idSet.has(col.id)).map(({ id, accessor }) => ({
    id,
    accessor,
  }));
}
