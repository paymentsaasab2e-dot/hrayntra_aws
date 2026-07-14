import type { Client } from '../../app/client/types';
import { formatContactListDisplay } from '../../lib/contact-channels';
import { csvDate } from '../../utils/csv';
import { buildExportCsvColumns, type ExportColumnDef } from './buildExportCsvColumns';

export const CLIENTS_EXPORT_COLUMNS: ExportColumnDef<Client>[] = [
  { id: 'name', label: 'Name', accessor: (c) => c.name },
  { id: 'industry', label: 'Industry', accessor: (c) => (c.industry === 'Not specified' ? '' : c.industry) },
  { id: 'location', label: 'Location', accessor: (c) => (c.location === 'Not specified' ? '' : c.location) },
  { id: 'city', label: 'City', accessor: (c) => c.city || '' },
  { id: 'country', label: 'Country', accessor: (c) => c.country || '' },
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
  { id: 'owner', label: 'Team Member', accessor: (c) => c.owner?.name || '' },
  { id: 'openJobs', label: 'Open Jobs', accessor: (c) => c.openJobs ?? 0 },
  { id: 'placements', label: 'Placements', accessor: (c) => c.placements ?? 0 },
  { id: 'lastActivity', label: 'Last Activity', accessor: (c) => c.lastActivity || '' },
  // Agreements & Terms
  { id: 'agreementLevel', label: 'Agreement Level', accessor: (c) => c.agreementLevel || '' },
  {
    id: 'agreementServiceChargePercent',
    label: 'Service Charge (%)',
    accessor: (c) => c.agreementServiceChargePercent || '',
  },
  {
    id: 'agreementContractValidity',
    label: 'Validity of Contract',
    accessor: (c) => c.agreementContractValidity || '',
  },
  {
    id: 'agreementContractStartDate',
    label: 'Agreement Start Date',
    accessor: (c) => csvDate(c.agreementContractStartDate),
  },
  {
    id: 'agreementContractEndDate',
    label: 'Agreement End Date',
    accessor: (c) => csvDate(c.agreementContractEndDate),
  },
  {
    id: 'agreementTimePeriod',
    label: 'Payment Terms',
    accessor: (c) => c.agreementTimePeriod || '',
  },
  {
    id: 'agreementAdvancePaymentPercent',
    label: 'Advance Payment (%)',
    accessor: (c) => c.agreementAdvancePaymentPercent || '',
  },
  {
    id: 'agreementFreeReplacement',
    label: 'Free Replacement',
    accessor: (c) =>
      c.agreementFreeReplacementValue != null
        ? `${c.agreementFreeReplacementValue} ${c.agreementFreeReplacementUnit || ''}`.trim()
        : '',
  },
  // KYC form summary
  {
    id: 'kycForm',
    label: 'KYC Form',
    accessor: (c) => (c.postServiceKycForm ? 'Filled' : ''),
  },
];

export function buildClientsCsvColumns(selectedIds: string[]) {
  return buildExportCsvColumns(CLIENTS_EXPORT_COLUMNS, selectedIds);
}
