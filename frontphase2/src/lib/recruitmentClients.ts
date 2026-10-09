/** Same definition as Recruitment Clients page (`/client?scope=recruitment`). */
export function isRecruitmentClient(client: {
  recruitmentEnabled?: boolean | null;
  createdInRecruitment?: boolean | null;
}): boolean {
  return client.recruitmentEnabled === true || client.createdInRecruitment === true;
}

/**
 * Add Job / AI wizard / recruitment filters: same pool as Recruitment Clients.
 * Callers may still inject workspace/own-company or `includeIds` for the current selection.
 *
 * When the API was already called with `recruitmentEnabled=true` but row flags are
 * missing/legacy, keep the returned list instead of emptying the picker.
 */
export function filterClientsForAddJob<
  T extends {
    id: string;
    recruitmentEnabled?: boolean | null;
    createdInRecruitment?: boolean | null;
  },
>(clients: T[], options?: { includeIds?: Array<string | null | undefined> }): T[] {
  const includeIds = new Set(
    (options?.includeIds || []).filter((id): id is string => Boolean(id && String(id).trim())),
  );
  const flagged = clients.filter(isRecruitmentClient);
  // Prefer flagged rows; if none are flagged but the list is non-empty (API already
  // scoped to recruitment), use the full list so Add Job matches the clients page.
  const pool = flagged.length > 0 || clients.length === 0 ? flagged : clients;

  if (includeIds.size === 0) return pool;

  const byId = new Map(clients.map((client) => [client.id, client]));
  const out = [...pool];
  includeIds.forEach((id) => {
    const extra = byId.get(id);
    if (extra && !out.some((row) => row.id === extra.id)) {
      out.push(extra);
    }
  });
  return out;
}
