import type { CsvColumn } from '../../utils/csv';

export type ExportColumnDef<T> = CsvColumn<T> & { label: string };

export function buildExportCsvColumns<T>(
  allColumns: ExportColumnDef<T>[],
  selectedIds: string[],
): CsvColumn<T>[] {
  const idSet = new Set(selectedIds);
  return allColumns.filter((col) => idSet.has(col.id)).map(({ id, accessor }) => ({ id, accessor }));
}
