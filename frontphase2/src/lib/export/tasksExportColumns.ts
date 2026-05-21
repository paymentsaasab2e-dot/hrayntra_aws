import { csvDate } from '../../utils/csv';
import { buildExportCsvColumns, type ExportColumnDef } from './buildExportCsvColumns';

export type TaskExportRow = {
  title: string;
  type: string;
  relatedTo?: { type?: string; name?: string };
  dueDate: string;
  time?: string;
  priority: string;
  status: string;
  owner?: { name?: string };
};

export const TASKS_EXPORT_COLUMNS: ExportColumnDef<TaskExportRow>[] = [
  { id: 'title', label: 'Title', accessor: (t) => t.title },
  { id: 'type', label: 'Type', accessor: (t) => t.type },
  {
    id: 'relatedTo',
    label: 'Related To',
    accessor: (t) => `${t.relatedTo?.type || ''}: ${t.relatedTo?.name || ''}`.replace(/^:\s*/, ''),
  },
  { id: 'dueDate', label: 'Due Date', accessor: (t) => csvDate(t.dueDate) },
  { id: 'time', label: 'Time', accessor: (t) => t.time || '' },
  { id: 'priority', label: 'Priority', accessor: (t) => t.priority },
  { id: 'status', label: 'Status', accessor: (t) => t.status },
  { id: 'owner', label: 'Owner', accessor: (t) => t.owner?.name || '' },
];

export function buildTasksCsvColumns(selectedIds: string[]) {
  return buildExportCsvColumns(TASKS_EXPORT_COLUMNS, selectedIds);
}
