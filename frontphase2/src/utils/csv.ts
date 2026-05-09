/**
 * Lightweight CSV helpers shared across list pages and import drawers.
 *
 * Why a tiny custom implementation instead of a library:
 *  - We only need a one-shot export and a sample template; nothing parses
 *    user-uploaded CSV in the browser (the backend does that).
 *  - Avoids pulling new npm dependencies into the bundle.
 */

export interface CsvColumn<T> {
  /** Stable column key. Used as the CSV header so it round-trips with import. */
  id: string;
  /** Optional user-friendly label (currently used for human readable docs only). */
  label?: string;
  /** Resolves the cell value. Returns any value; `undefined`/`null` become empty strings. */
  accessor: (row: T) => unknown;
}

/**
 * Field definition shape used by import drawers. We accept it as-is so the
 * sample CSV download lines up with the exact mapping ids the parser expects.
 */
export interface ImportField {
  id: string;
  label?: string;
  required?: boolean;
}

/** RFC 4180-compatible quoting for a single cell. */
function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str: string;
  if (value instanceof Date) {
    str = Number.isNaN(value.getTime()) ? '' : value.toISOString();
  } else if (Array.isArray(value)) {
    str = value
      .map((entry) => (entry === null || entry === undefined ? '' : String(entry)))
      .filter(Boolean)
      .join('; ');
  } else if (typeof value === 'object') {
    try {
      str = JSON.stringify(value);
    } catch {
      str = String(value);
    }
  } else {
    str = String(value);
  }
  // Always wrap in quotes when the cell contains a comma, quote, newline, or
  // could be confused with formula injection; quoting unconditionally keeps
  // round-tripping simple.
  return `"${str.replace(/"/g, '""')}"`;
}

function buildCsvText(headerIds: string[], rowMatrix: unknown[][]): string {
  const lines: string[] = [];
  lines.push(headerIds.map((id) => escapeCsvCell(id)).join(','));
  for (const row of rowMatrix) {
    lines.push(row.map((cell) => escapeCsvCell(cell)).join(','));
  }
  // Prepend BOM so Excel opens UTF-8 cleanly without the user reconfiguring import.
  return `\ufeff${lines.join('\r\n')}`;
}

function triggerCsvDownload(filename: string, text: string) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    // Defer revoke so iOS/Safari has a chance to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 250);
  }
}

/**
 * Export an arbitrary list of objects to a downloadable CSV.
 * Columns are emitted in the order provided so the sheet is stable.
 */
export function downloadCsv<T>(filename: string, columns: CsvColumn<T>[], rows: T[]) {
  const headerIds = columns.map((column) => column.id);
  const rowMatrix = rows.map((row) => columns.map((column) => column.accessor(row)));
  triggerCsvDownload(filename, buildCsvText(headerIds, rowMatrix));
}

/**
 * Build a sample CSV using the same `id` keys an import drawer uses for its
 * mapping. The headers are the field ids so a user can fill in rows and import
 * back without manual column mapping. The label/required are included as
 * extra rows (commented column) so the user has guidance.
 */
export function downloadSampleCsv(
  filename: string,
  fields: ImportField[],
  options?: {
    /** Optional sample data row. Keys match field ids. */
    sample?: Record<string, unknown>;
    /** Number of empty starter rows to leave for the user (default 1). */
    blankRows?: number;
  },
): void {
  const ids = fields.map((field) => field.id);

  // First non-header row: example values so the user can see the shape.
  const sampleRow = ids.map((id) => {
    const provided = options?.sample?.[id];
    if (provided !== undefined && provided !== null && provided !== '') return provided;
    return '';
  });

  // Followed by a few blank rows for the user to fill in.
  const blanks = Math.max(0, options?.blankRows ?? 1);
  const blankRow = ids.map(() => '');
  const matrix: unknown[][] = [sampleRow];
  for (let i = 0; i < blanks; i += 1) matrix.push(blankRow);

  triggerCsvDownload(filename, buildCsvText(ids, matrix));
}

/**
 * Convenience: format a JavaScript value (Date, ISO string) as a short
 * human-readable date for CSV cells. Returns empty when value is missing.
 */
export function csvDate(value: unknown): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
}

/** Like csvDate but keeps the time component. */
export function csvDateTime(value: unknown): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString();
}
