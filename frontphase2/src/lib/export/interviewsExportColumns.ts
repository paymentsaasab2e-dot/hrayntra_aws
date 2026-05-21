import type { Interview } from '../../types/interview.types';
import { csvDate } from '../../utils/csv';
import { buildExportCsvColumns, type ExportColumnDef } from './buildExportCsvColumns';

export const INTERVIEWS_EXPORT_COLUMNS: ExportColumnDef<Interview>[] = [
  { id: 'candidateName', label: 'Candidate Name', accessor: (i) => i.candidate?.name || '' },
  { id: 'candidateEmail', label: 'Candidate Email', accessor: (i) => i.candidate?.email || '' },
  { id: 'jobTitle', label: 'Job Title', accessor: (i) => i.job?.title || '' },
  { id: 'client', label: 'Client', accessor: (i) => i.job?.client || '' },
  { id: 'round', label: 'Round', accessor: (i) => i.round },
  { id: 'type', label: 'Type', accessor: (i) => i.type },
  { id: 'mode', label: 'Mode', accessor: (i) => i.mode },
  { id: 'date', label: 'Date', accessor: (i) => csvDate(i.scheduledAt || `${i.date} ${i.time}`) },
  { id: 'time', label: 'Time', accessor: (i) => i.time || '' },
  { id: 'duration', label: 'Duration', accessor: (i) => i.duration ?? '' },
  { id: 'timezone', label: 'Timezone', accessor: (i) => i.timezone || '' },
  { id: 'status', label: 'Status', accessor: (i) => i.status },
  { id: 'feedbackStatus', label: 'Feedback Status', accessor: (i) => i.feedbackStatus },
  { id: 'meetingPlatform', label: 'Meeting Platform', accessor: (i) => i.meetingPlatform || '' },
  { id: 'meetingLink', label: 'Meeting Link', accessor: (i) => i.meetingLink || '' },
  { id: 'location', label: 'Location', accessor: (i) => i.location || '' },
  { id: 'panel', label: 'Panel', accessor: (i) => (i.panel || []).map((p) => p.name).join('; ') },
  { id: 'createdBy', label: 'Created By', accessor: (i) => i.createdBy || '' },
  { id: 'notes', label: 'Notes', accessor: (i) => i.notes || '' },
];

export function buildInterviewsCsvColumns(selectedIds: string[]) {
  return buildExportCsvColumns(INTERVIEWS_EXPORT_COLUMNS, selectedIds);
}
