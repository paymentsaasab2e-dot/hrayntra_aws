/**
 * Compact company-name key used to treat punctuation / legal-suffix variants
 * as the same client, e.g. "Keda Ceramic - Zambia" === "Keda Ceramic Zambia".
 */
const LEGAL_WORD =
  /\b(private|limited|ltd|inc|llc|corp|corporation|solutions|technologies|technology|services|group|company|co)\b/gi;

export function normalizeCompanyNameKey(name?: string | null): string {
  return String(name || '')
    .toLowerCase()
    .replace(LEGAL_WORD, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function preferredCompanyDisplayName(names: Array<string | null | undefined> = []): string {
  const unique = [
    ...new Set(
      names
        .map((name) => String(name || '').replace(/\u00a0/g, ' ').trim())
        .filter(Boolean),
    ),
  ];
  if (!unique.length) return '';
  unique.sort((left, right) => {
    const punct = (value: string) => (value.match(/[^a-zA-Z0-9\s]/g) || []).length;
    const leftPunct = punct(left);
    const rightPunct = punct(right);
    if (leftPunct !== rightPunct) return leftPunct - rightPunct;
    if (left.length !== right.length) return left.length - right.length;
    return left.localeCompare(right);
  });
  return unique[0];
}

/** Keep one record per normalized company name. Empty names are kept as-is. */
export function dedupeByCompanyName<T>(
  items: T[],
  getName: (item: T) => string | null | undefined,
): T[] {
  const kept: T[] = [];
  const indexByKey = new Map<string, number>();

  for (const item of items) {
    const name = String(getName(item) || '').trim();
    const key = normalizeCompanyNameKey(name);
    if (!key) {
      kept.push(item);
      continue;
    }

    const existingIndex = indexByKey.get(key);
    if (existingIndex == null) {
      indexByKey.set(key, kept.length);
      kept.push(item);
      continue;
    }

    const existing = kept[existingIndex];
    const existingName = String(getName(existing) || '').trim();
    if (preferredCompanyDisplayName([existingName, name]) === name) {
      kept[existingIndex] = item;
    }
  }

  return kept;
}

export function dedupeCompanyNameLabels(names: Array<string | null | undefined>): string[] {
  return dedupeByCompanyName(
    names.map((name) => String(name || '').trim()).filter(Boolean),
    (name) => name,
  ).sort((left, right) => left.localeCompare(right));
}

export function mapUniqueClientOptions(
  clients: Array<{ id?: string | null; companyName?: string | null; name?: string | null }>,
): Array<{ id: string; companyName: string }> {
  return dedupeByCompanyName(
    clients
      .map((client) => ({
        id: String(client.id || ''),
        companyName: String(client.companyName || client.name || '').trim(),
      }))
      .filter((client) => client.id),
    (client) => client.companyName,
  );
}

function recordCompanyName(record: Record<string, unknown>): string {
  return String(
    record.companyName || record.name || record.company || record.organizationName || '',
  ).trim();
}

function dedupeNamedObjectArray(items: unknown[]): unknown[] {
  return dedupeByCompanyName(
    items.filter((item) => item && typeof item === 'object') as Array<Record<string, unknown>>,
    recordCompanyName,
  );
}

/** Collapse punctuation-variant company rows in any Phase 2 list API payload. */
export function dedupeCompanyNamedPayload<T>(payload: T): T {
  if (Array.isArray(payload)) {
    return dedupeNamedObjectArray(payload) as T;
  }
  if (!payload || typeof payload !== 'object') return payload;

  const source = payload as Record<string, unknown>;
  const next: Record<string, unknown> = { ...source };

  if (Array.isArray(next.data)) next.data = dedupeNamedObjectArray(next.data);
  else if (next.data && typeof next.data === 'object') {
    next.data = dedupeCompanyNamedPayload(next.data);
  }
  if (Array.isArray(next.items)) next.items = dedupeNamedObjectArray(next.items);
  if (Array.isArray(next.companies)) next.companies = dedupeNamedObjectArray(next.companies);
  if (Array.isArray(next.leads)) next.leads = dedupeNamedObjectArray(next.leads);
  if (Array.isArray(next.clients)) next.clients = dedupeNamedObjectArray(next.clients);

  return next as T;
}
