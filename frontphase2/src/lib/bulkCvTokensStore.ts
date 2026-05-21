/**
 * Last bulk CV upload session — billable LLM token usage per resume (OpenAI or Mistral only).
 * System regex fallback records show API path but zero tokens.
 */

export const BULK_CV_TOKENS_CHANGED = 'hrayntra:bulk-cv-tokens-changed';

const KEY_SESSION = 'hrayntra:bulk-cv-tokens-session';

export type CvParseProvider = 'openai' | 'mistral' | 'system' | 'none' | 'error';

/** Which engine actually structured this CV (billable LLM vs regex). */
export type CvParseRoute = 'openai' | 'mistral' | 'regex';

export type CvTokenUsageMeta = {
  provider: CvParseProvider;
  parseRoute?: CvParseRoute;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  durationMs?: number;
  skipped?: boolean;
  billable?: boolean;
  apiUsedLabel?: string;
  parseChain?: string;
  aiFailed?: boolean;
  errorMessage?: string;
};

export type BulkCvTokenRecord = {
  id: string;
  fileName: string;
  provider: CvParseProvider;
  parseRoute?: CvParseRoute;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  durationMs: number;
  status: 'created' | 'skipped' | 'failed';
  recordedAt: string;
  billable: boolean;
  apiUsedLabel: string;
  parseChain: string;
  aiFailed?: boolean;
  errorMessage?: string;
};

export type BulkCvTokenSession = {
  sessionId: string;
  startedAt: string;
  records: BulkCvTokenRecord[];
};

export type BulkCvTokenTotals = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  resumeCount: number;
  billableResumeCount: number;
};

export type BulkCvRouteCounts = {
  totalRecords: number;
  openaiCvCount: number;
  mistralCvCount: number;
  regexCvCount: number;
  unparsedCount: number;
  openaiInputTokens: number;
  openaiOutputTokens: number;
  openaiTotalTokens: number;
  mistralInputTokens: number;
  mistralOutputTokens: number;
  mistralTotalTokens: number;
};

function emitChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(BULK_CV_TOKENS_CHANGED));
}

function readSession(): BulkCvTokenSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY_SESSION);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BulkCvTokenSession;
    if (!parsed?.sessionId || !Array.isArray(parsed.records)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(session: BulkCvTokenSession | null) {
  if (typeof window === 'undefined') return;
  try {
    if (!session) {
      window.localStorage.removeItem(KEY_SESSION);
    } else {
      window.localStorage.setItem(KEY_SESSION, JSON.stringify(session));
    }
    emitChanged();
  } catch {
    /* quota */
  }
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isBillableCvTokenRecord(row: BulkCvTokenRecord): boolean {
  if (row.billable === false) return false;
  if (row.billable === true) return row.provider === 'openai' || row.provider === 'mistral';
  return (
    (row.provider === 'openai' || row.provider === 'mistral') &&
    (row.inputTokens > 0 || row.outputTokens > 0)
  );
}

function defaultApiLabel(provider: CvParseProvider): string {
  if (provider === 'openai') return 'OpenAI API key';
  if (provider === 'mistral') return 'Mistral API key';
  if (provider === 'system') return 'System (regex fallback)';
  if (provider === 'error') return 'AI failed';
  return 'System (regex only)';
}

/** Accurate route for drawer + reports (trust API parseRoute when present). */
export function resolveCvParseRoute(
  row: Pick<BulkCvTokenRecord, 'provider' | 'billable' | 'parseRoute'>
): CvParseRoute {
  const explicit = String(row.parseRoute || '').toLowerCase();
  if (explicit === 'openai' || explicit === 'mistral' || explicit === 'regex') {
    return explicit;
  }
  if (row.provider === 'openai' && row.billable) return 'openai';
  if (row.provider === 'mistral' && row.billable) return 'mistral';
  return 'regex';
}

function normalizeUsageForRecord(
  tokenUsage: CvTokenUsageMeta | null | undefined,
  status: BulkCvTokenRecord['status']
): Pick<
  BulkCvTokenRecord,
  | 'provider'
  | 'model'
  | 'inputTokens'
  | 'outputTokens'
  | 'totalTokens'
  | 'durationMs'
  | 'billable'
  | 'apiUsedLabel'
  | 'parseChain'
  | 'aiFailed'
  | 'errorMessage'
> {
  const usage = tokenUsage || {
    provider: 'none' as const,
    model: null,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    durationMs: 0,
    skipped: status !== 'created',
  };

  const providerRaw = String(usage.provider || 'none').toLowerCase();
  let provider: CvParseProvider =
    providerRaw === 'openai' ||
    providerRaw === 'mistral' ||
    providerRaw === 'system' ||
    providerRaw === 'error'
      ? providerRaw
      : 'none';

  const explicitBillable = usage.billable === true;
  const inferredBillable =
    (provider === 'openai' || provider === 'mistral') &&
    !usage.skipped &&
    !usage.aiFailed &&
    (Number(usage.inputTokens) > 0 || Number(usage.outputTokens) > 0);
  const billable = explicitBillable || inferredBillable;

  if (!billable && provider !== 'openai' && provider !== 'mistral') {
    if (usage.aiFailed || usage.skipped) provider = 'system';
  }

  const inputTokens = billable ? Number(usage.inputTokens) || 0 : 0;
  const outputTokens = billable ? Number(usage.outputTokens) || 0 : 0;
  const totalTokens = billable ? Number(usage.totalTokens) || inputTokens + outputTokens : 0;

  const finalProvider: CvParseProvider = billable
    ? provider === 'openai' || provider === 'mistral'
      ? provider
      : 'mistral'
    : provider === 'none'
      ? 'none'
      : 'system';

  const routeFromApi = String(usage.parseRoute || '').toLowerCase();
  let parseRoute: CvParseRoute =
    routeFromApi === 'openai' || routeFromApi === 'mistral' || routeFromApi === 'regex'
      ? routeFromApi
      : finalProvider === 'openai' && billable
        ? 'openai'
        : finalProvider === 'mistral' && billable
          ? 'mistral'
          : 'regex';

  return {
    provider: finalProvider,
    parseRoute,
    model: usage.model ?? null,
    inputTokens,
    outputTokens,
    totalTokens,
    durationMs: Number(usage.durationMs) || 0,
    billable,
    apiUsedLabel: String(usage.apiUsedLabel || '').trim() || defaultApiLabel(finalProvider),
    parseChain: String(usage.parseChain || '').trim() || defaultApiLabel(finalProvider),
    aiFailed: usage.aiFailed,
    errorMessage: usage.errorMessage,
  };
}

export function beginBulkCvTokenSession(sessionId: string) {
  const session: BulkCvTokenSession = {
    sessionId,
    startedAt: new Date().toISOString(),
    records: [],
  };
  writeSession(session);
  return session;
}

export function appendBulkCvTokenRecord(
  fileName: string,
  status: BulkCvTokenRecord['status'],
  tokenUsage: CvTokenUsageMeta | null | undefined
) {
  const prev = readSession();
  if (!prev) return null;

  const normalized = normalizeUsageForRecord(tokenUsage, status);

  const record: BulkCvTokenRecord = {
    id: newId(),
    fileName: String(fileName || 'resume').trim() || 'resume',
    status,
    recordedAt: new Date().toISOString(),
    ...normalized,
  };

  writeSession({
    ...prev,
    records: [record, ...prev.records],
  });
  return record;
}

/** Remove one or more token records from the current session. */
export function removeBulkCvTokenRecords(ids: string[]) {
  const prev = readSession();
  if (!prev || !ids.length) return prev;
  const idSet = new Set(ids);
  const nextRecords = prev.records.filter((row) => !idSet.has(row.id));
  if (nextRecords.length === prev.records.length) return prev;
  const next = { ...prev, records: nextRecords };
  writeSession(nextRecords.length ? next : null);
  return nextRecords.length ? next : null;
}

export function removeBulkCvTokenRecord(id: string) {
  return removeBulkCvTokenRecords([id]);
}

export function getBulkCvTokenSession(): BulkCvTokenSession | null {
  return readSession();
}

export function computeBulkCvRouteCounts(records: BulkCvTokenRecord[]): BulkCvRouteCounts {
  const base: BulkCvRouteCounts = {
    totalRecords: records.length,
    openaiCvCount: 0,
    mistralCvCount: 0,
    regexCvCount: 0,
    unparsedCount: 0,
    openaiInputTokens: 0,
    openaiOutputTokens: 0,
    openaiTotalTokens: 0,
    mistralInputTokens: 0,
    mistralOutputTokens: 0,
    mistralTotalTokens: 0,
  };

  for (const row of records) {
    const route = resolveCvParseRoute(row);
    if (route === 'openai') {
      base.openaiCvCount += 1;
      if (row.billable) {
        base.openaiInputTokens += row.inputTokens;
        base.openaiOutputTokens += row.outputTokens;
        base.openaiTotalTokens += row.totalTokens;
      }
    } else if (route === 'mistral') {
      base.mistralCvCount += 1;
      if (row.billable) {
        base.mistralInputTokens += row.inputTokens;
        base.mistralOutputTokens += row.outputTokens;
        base.mistralTotalTokens += row.totalTokens;
      }
    } else if (row.provider === 'none' && row.status === 'failed') {
      base.unparsedCount += 1;
    } else {
      base.regexCvCount += 1;
    }
  }

  return base;
}

/** Terminal report after a bulk CV session (browser console + optional copy in UI). */
export function logBulkCvSessionReport(session: BulkCvTokenSession | null) {
  if (!session?.records?.length) {
    console.log('[bulk-cv] parse route report: (no CV parse records in this session)');
    return;
  }

  const routes = computeBulkCvRouteCounts(session.records);
  const totals = computeBulkCvTokenTotals(session.records);
  const line = '='.repeat(72);

  console.log('');
  console.log(line);
  console.log('BULK CV — Parse route report (this session)');
  console.log(line);
  console.log(`Session:     ${session.sessionId}`);
  console.log(`Started:     ${session.startedAt}`);
  console.log(`CV records:  ${routes.totalRecords} (imported + skipped + failed with parse log)`);
  console.log('');
  console.log('CVs parsed by engine:');
  console.log(`  OpenAI:         ${routes.openaiCvCount} CV(s)`);
  console.log(`  Mistral:        ${routes.mistralCvCount} CV(s)`);
  console.log(`  Regex fallback: ${routes.regexCvCount} CV(s)`);
  if (routes.unparsedCount > 0) {
    console.log(`  Not parsed:     ${routes.unparsedCount} (failed before parse metadata)`);
  }
  console.log('');
  console.log('Billable tokens (OpenAI + Mistral only):');
  console.log(`  OpenAI:  in=${routes.openaiInputTokens.toLocaleString()} out=${routes.openaiOutputTokens.toLocaleString()} total=${routes.openaiTotalTokens.toLocaleString()}`);
  console.log(`  Mistral: in=${routes.mistralInputTokens.toLocaleString()} out=${routes.mistralOutputTokens.toLocaleString()} total=${routes.mistralTotalTokens.toLocaleString()}`);
  console.log(
    `  Combined billable: in=${totals.inputTokens.toLocaleString()} out=${totals.outputTokens.toLocaleString()} total=${totals.totalTokens.toLocaleString()} (${totals.billableResumeCount} CVs)`
  );
  console.log(line);
  console.log('');
}

export function computeBulkCvTokenTotals(records: BulkCvTokenRecord[]): BulkCvTokenTotals {
  return records.reduce(
    (acc, row) => {
      if (isBillableCvTokenRecord(row)) {
        return {
          inputTokens: acc.inputTokens + row.inputTokens,
          outputTokens: acc.outputTokens + row.outputTokens,
          totalTokens: acc.totalTokens + row.totalTokens,
          resumeCount: acc.resumeCount + 1,
          billableResumeCount: acc.billableResumeCount + 1,
        };
      }
      return {
        ...acc,
        resumeCount: acc.resumeCount + 1,
      };
    },
    { inputTokens: 0, outputTokens: 0, totalTokens: 0, resumeCount: 0, billableResumeCount: 0 }
  );
}

export function clearBulkCvTokenSession() {
  writeSession(null);
}

export function normalizeTokenUsageFromApi(raw: unknown): CvTokenUsageMeta | null {
  if (!raw || typeof raw !== 'object') return null;
  const u = raw as Record<string, unknown>;
  const provider = String(u.provider || 'none').toLowerCase();
  const safeProvider: CvParseProvider =
    provider === 'openai' ||
    provider === 'mistral' ||
    provider === 'system' ||
    provider === 'error'
      ? provider
      : 'none';
  const billableFromApi = u.billable === true;
  const inferredBillable =
    (safeProvider === 'openai' || safeProvider === 'mistral') &&
    !u.skipped &&
    !u.aiFailed &&
    (Number(u.inputTokens) > 0 || Number(u.outputTokens) > 0);

  const parseRouteRaw = String(u.parseRoute || '').toLowerCase();
  const parseRoute: CvParseRoute | undefined =
    parseRouteRaw === 'openai' || parseRouteRaw === 'mistral' || parseRouteRaw === 'regex'
      ? parseRouteRaw
      : billableFromApi || inferredBillable
        ? safeProvider === 'openai'
          ? 'openai'
          : safeProvider === 'mistral'
            ? 'mistral'
            : undefined
        : safeProvider === 'system' || safeProvider === 'none'
          ? 'regex'
          : undefined;

  return {
    provider: safeProvider,
    parseRoute,
    model: u.model != null ? String(u.model) : null,
    inputTokens: Number(u.inputTokens) || 0,
    outputTokens: Number(u.outputTokens) || 0,
    totalTokens: Number(u.totalTokens) || 0,
    durationMs: Number(u.durationMs) || 0,
    skipped: Boolean(u.skipped),
    billable: billableFromApi || inferredBillable,
    apiUsedLabel: u.apiUsedLabel != null ? String(u.apiUsedLabel) : undefined,
    parseChain: u.parseChain != null ? String(u.parseChain) : undefined,
    aiFailed: Boolean(u.aiFailed),
    errorMessage: u.errorMessage != null ? String(u.errorMessage) : undefined,
  };
}

/** Strip cvParseMeta before sending candidate to create API. */
export function stripCvParseMetaFromCandidate<T extends Record<string, unknown>>(payload: T) {
  if (!payload?.cvParseMeta) return payload;
  const { cvParseMeta: _meta, ...rest } = payload;
  return rest as T;
}
