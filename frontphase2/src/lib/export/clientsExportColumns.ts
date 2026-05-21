import type { Client } from '../../app/client/types';
import { formatContactListDisplay } from '../../lib/contact-channels';
import { csvDate } from '../../utils/csv';
import { buildExportCsvColumns, type ExportColumnDef } from './buildExportCsvColumns';

export const CLIENTS_EXPORT_COLUMNS: ExportColumnDef<Client>[] = [
  { id: 'name', label: 'Name', accessor: (c) => c.name },
  { id: 'industry', label: 'Industry', accessor: (c) => (c.industry === 'Not specified' ? '' : c.industry) },
  { id: 'location', label: 'Location', accessor: (c) => (c.location === 'Not specified' ? '' : c.location) },
  { id: 'city', label: 'City', accessor: () => '' },
  { id: 'country', label: 'Country', accessor: () => '' },
  {
    id: 'contactPerson',
    label: 'Contact Person',
    accessor: (c) => c.contacts?.find((ct) => ct.isPrimary)?.name || c.contacts?.[0]?.name || '',
  },
  {
    id: 'email',
    label: 'Email',
    accessor: (c) =>
      formatContactListDisplay(
        c.emails,
        c.contacts?.find((ct) => ct.isPrimary)?.email || c.contacts?.[0]?.email || '',
      ),
  },
  {
    id: 'phone',
    label: 'Phone',
    accessor: (c) =>
      formatContactListDisplay(
        c.phones,
        c.contacts?.find((ct) => ct.isPrimary)?.phone || c.contacts?.[0]?.phone || '',
      ),
  },
  { id: 'companySize', label: 'Company Size', accessor: (c) => c.companySize || '' },
  { id: 'servicesNeeded', label: 'Services Needed', accessor: (c) => c.servicesNeeded || '' },
  { id: 'leadStatus', label: 'Lead Status', accessor: (c) => c.leadStatus || c.stage },
  { id: 'priority', label: 'Priority', accessor: (c) => c.priority || '' },
  { id: 'expectedBusinessValue', label: 'Expected Business Value', accessor: (c) => c.expectedBusinessValue || '' },
  { id: 'nextFollowUpDue', label: 'Next Follow-up', accessor: (c) => csvDate(c.nextFollowUpDue) },
  { id: 'notes', label: 'Notes', accessor: () => '' },
  { id: 'owner', label: 'Owner', accessor: (c) => c.owner?.name || '' },
  { id: 'openJobs', label: 'Open Jobs', accessor: (c) => c.openJobs ?? 0 },
  { id: 'placements', label: 'Placements', accessor: (c) => c.placements ?? 0 },
  { id: 'lastActivity', label: 'Last Activity', accessor: (c) => c.lastActivity || '' },
];

export function buildClientsCsvColumns(selectedIds: string[]) {
  return buildExportCsvColumns(CLIENTS_EXPORT_COLUMNS, selectedIds);
}
