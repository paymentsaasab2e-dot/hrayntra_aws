import type { BackendContact } from '../../lib/api';
import { buildExportCsvColumns, type ExportColumnDef } from './buildExportCsvColumns';

export const CONTACTS_EXPORT_COLUMNS: ExportColumnDef<BackendContact>[] = [
  { id: 'firstName', label: 'First Name', accessor: (c) => c.firstName || '' },
  { id: 'lastName', label: 'Last Name', accessor: (c) => c.lastName || '' },
  { id: 'email', label: 'Email', accessor: (c) => c.email || '' },
  { id: 'phone', label: 'Phone', accessor: (c) => c.phone || '' },
  { id: 'company', label: 'Company', accessor: (c) => c.company?.companyName || '' },
  { id: 'designation', label: 'Designation', accessor: (c) => c.designation || '' },
  { id: 'contactType', label: 'Contact Type', accessor: (c) => c.contactType || '' },
  { id: 'status', label: 'Status', accessor: (c) => c.status || '' },
  { id: 'location', label: 'Location', accessor: (c) => c.location || '' },
];

export function buildContactsCsvColumns(selectedIds: string[]) {
  return buildExportCsvColumns(CONTACTS_EXPORT_COLUMNS, selectedIds);
}
