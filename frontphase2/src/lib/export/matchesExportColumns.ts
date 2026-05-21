import type { MatchCandidate } from '../../components/matches/types';
import { buildExportCsvColumns, type ExportColumnDef } from './buildExportCsvColumns';

export const MATCHES_EXPORT_COLUMNS: ExportColumnDef<MatchCandidate>[] = [
  { id: 'name', label: 'Name', accessor: (c) => c.name },
  { id: 'currentTitle', label: 'Current Title', accessor: (c) => c.currentTitle || '' },
  { id: 'currentCompany', label: 'Current Company', accessor: (c) => c.currentCompany || '' },
  { id: 'experience', label: 'Experience', accessor: (c) => c.experience ?? '' },
  { id: 'location', label: 'Location', accessor: (c) => c.location || '' },
  { id: 'email', label: 'Email', accessor: (c) => c.email || '' },
  { id: 'phone', label: 'Phone', accessor: (c) => c.phone || '' },
  { id: 'matchScore', label: 'Match Score', accessor: (c) => c.score ?? '' },
  { id: 'status', label: 'Status', accessor: (c) => c.status || '' },
  { id: 'saved', label: 'Saved', accessor: () => '' },
  { id: 'skills', label: 'Skills', accessor: (c) => (c.skills || []).join('; ') },
  { id: 'savedAt', label: 'Saved At', accessor: (c) => c.savedAt || '' },
];

export function buildMatchesCsvColumns(selectedIds: string[], savedMatchIds: string[] = []) {
  const savedSet = new Set(savedMatchIds);
  const columns = MATCHES_EXPORT_COLUMNS.map((col) =>
    col.id === 'saved'
      ? { ...col, accessor: (c: MatchCandidate) => (savedSet.has(c.id) ? 'true' : 'false') }
      : col,
  );
  return buildExportCsvColumns(columns, selectedIds);
}
