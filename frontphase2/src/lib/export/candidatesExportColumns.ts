import type { Candidate } from '../../app/candidate/components/CandidateTable';
import { buildExportCsvColumns, type ExportColumnDef } from './buildExportCsvColumns';

export const CANDIDATES_EXPORT_COLUMNS: ExportColumnDef<Candidate>[] = [
  { id: 'name', label: 'Name', accessor: (c) => c.name },
  { id: 'email', label: 'Email', accessor: (c) => c.email || '' },
  { id: 'phone', label: 'Phone', accessor: (c) => c.phone || '' },
  { id: 'designation', label: 'Designation', accessor: (c) => c.designation || '' },
  { id: 'company', label: 'Company', accessor: (c) => c.company || '' },
  { id: 'experience', label: 'Experience', accessor: (c) => c.experience ?? '' },
  { id: 'location', label: 'Location', accessor: (c) => c.location || '' },
  { id: 'stage', label: 'Stage', accessor: (c) => c.stage || '' },
  { id: 'owner', label: 'Owner', accessor: (c) => c.owner || '' },
  { id: 'lastActivity', label: 'Last Activity', accessor: (c) => c.lastActivity || '' },
  { id: 'hotlist', label: 'Hotlist', accessor: (c) => (c.hotlist ? 'true' : 'false') },
  { id: 'noticePeriod', label: 'Notice Period', accessor: (c) => c.noticePeriod || '' },
  { id: 'currentSalary', label: 'Current Salary', accessor: (c) => c.salary?.current || '' },
  { id: 'expectedSalary', label: 'Expected Salary', accessor: (c) => c.salary?.expected || '' },
  { id: 'source', label: 'Source', accessor: (c) => c.source || '' },
  { id: 'rating', label: 'Rating', accessor: (c) => c.rating ?? '' },
  { id: 'skills', label: 'Skills', accessor: (c) => (c.skills || []).join('; ') },
  { id: 'assignedJobs', label: 'Assigned Jobs', accessor: (c) => (c.assignedJobs || []).join('; ') },
];

export function buildCandidatesCsvColumns(selectedIds: string[]) {
  return buildExportCsvColumns(CANDIDATES_EXPORT_COLUMNS, selectedIds);
}
