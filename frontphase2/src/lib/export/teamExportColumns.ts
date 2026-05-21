import type { TeamMember } from '../../types/team';
import { csvDateTime } from '../../utils/csv';
import { buildExportCsvColumns, type ExportColumnDef } from './buildExportCsvColumns';

export const TEAM_EXPORT_COLUMNS: ExportColumnDef<TeamMember>[] = [
  { id: 'firstName', label: 'First Name', accessor: (m) => m.firstName || '' },
  { id: 'lastName', label: 'Last Name', accessor: (m) => m.lastName || '' },
  { id: 'email', label: 'Email', accessor: (m) => m.email || '' },
  { id: 'phone', label: 'Phone', accessor: (m) => m.phone || '' },
  { id: 'designation', label: 'Designation', accessor: (m) => m.designation || '' },
  { id: 'location', label: 'Location', accessor: (m) => m.location || '' },
  { id: 'department', label: 'Department', accessor: (m) => m.department?.name || '' },
  { id: 'role', label: 'Role', accessor: (m) => m.role?.roleName || '' },
  { id: 'status', label: 'Status', accessor: (m) => m.status || '' },
  { id: 'loginId', label: 'Login ID', accessor: (m) => m.credential?.loginId || '' },
  { id: 'isLocked', label: 'Locked', accessor: (m) => (m.credential?.isLocked ? 'true' : 'false') },
  { id: 'lastLoginAt', label: 'Last Login', accessor: (m) => csvDateTime(m.credential?.lastLoginAt) },
  { id: 'createdAt', label: 'Created At', accessor: (m) => csvDateTime(m.createdAt) },
];

export function buildTeamCsvColumns(selectedIds: string[]) {
  return buildExportCsvColumns(TEAM_EXPORT_COLUMNS, selectedIds);
}
