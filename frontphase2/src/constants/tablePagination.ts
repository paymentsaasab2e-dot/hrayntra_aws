/** Standard rows-per-page choices for list tables using `PaginationAll`. */
export const TABLE_PAGE_SIZE_OPTIONS = [10, 50, 100] as const;

export type TablePageSize = (typeof TABLE_PAGE_SIZE_OPTIONS)[number];

export function coerceTablePageSize(value: unknown, fallback: TablePageSize = 10): TablePageSize {
  const n = Number(value);
  if (Number.isFinite(n) && (TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) {
    return n as TablePageSize;
  }
  return fallback;
}
