export type PaginatedPageResult<T> = {
  items: T[];
  totalPages: number;
};

export async function fetchAllPaginated<T>(options: {
  batchSize?: number;
  fetchPage: (page: number, limit: number) => Promise<PaginatedPageResult<T>>;
}): Promise<T[]> {
  const batchSize = options.batchSize ?? 500;
  let page = 1;
  let totalPages = 1;
  let collected: T[] = [];

  while (page <= totalPages) {
    const { items, totalPages: nextTotalPages } = await options.fetchPage(page, batchSize);
    collected = [...collected, ...items];
    totalPages = Math.max(1, nextTotalPages);
    if (items.length < batchSize) break;
    page += 1;
  }

  return collected;
}

export function totalPagesFromPagination(
  pagination: { totalPages?: number; total?: number } | undefined,
  collectedLength: number,
  batchSize: number,
): number {
  return (
    pagination?.totalPages ||
    Math.max(1, Math.ceil((pagination?.total ?? collectedLength) / batchSize))
  );
}
