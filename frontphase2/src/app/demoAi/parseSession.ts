import { normalizeTokenUsageFromApi, type CvTokenUsageMeta } from '../../lib/bulkCvTokensStore';

export type DemoAiParseRecord = {
  id: string;
  resumeName: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  /** Model reported by the parse API (actual run). */
  actualGptModel: string;
  parsedOn: string;
  status: 'parsed' | 'failed';
  errorMessage?: string;
};

const STORAGE_KEY = 'hrayntra:demo-ai-parse-session';

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function displayActualModel(usage: CvTokenUsageMeta | null): string {
  const model = String(usage?.model || '').trim();
  if (model) return model;
  const provider = String(usage?.provider || '').toLowerCase();
  if (provider === 'openai') return 'gpt-4o-mini';
  if (provider === 'mistral') return 'mistral-small';
  if (provider === 'system') return 'regex (no GPT)';
  return '—';
}

export function tokenUsageFromParseResponse(response: {
  data?: unknown;
  tokenUsage?: unknown;
}): CvTokenUsageMeta | null {
  const raw = (response as { tokenUsage?: unknown }).tokenUsage;
  return normalizeTokenUsageFromApi(raw);
}

export function recordFromFileAndUsage(fileName: string, usage: CvTokenUsageMeta | null): DemoAiParseRecord {
  const inputTokens = Math.max(0, Number(usage?.inputTokens) || 0);
  const outputTokens = Math.max(0, Number(usage?.outputTokens) || 0);
  const totalTokens = Math.max(0, Number(usage?.totalTokens) || inputTokens + outputTokens);
  return {
    id: newId(),
    resumeName: fileName,
    inputTokens,
    outputTokens,
    totalTokens,
    actualGptModel: displayActualModel(usage),
    parsedOn: new Date().toISOString(),
    status: 'parsed',
  };
}

export function failedRecord(fileName: string, message: string): DemoAiParseRecord {
  return {
    id: newId(),
    resumeName: fileName,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    actualGptModel: '—',
    parsedOn: new Date().toISOString(),
    status: 'failed',
    errorMessage: message,
  };
}

export function readDemoAiParseSession(): DemoAiParseRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DemoAiParseRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeDemoAiParseSession(records: DemoAiParseRecord[]) {
  if (typeof window === 'undefined') return;
  try {
    if (!records.length) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    }
  } catch {
    /* quota */
  }
}

export function appendDemoAiParseRecords(rows: DemoAiParseRecord[]) {
  const prev = readDemoAiParseSession();
  writeDemoAiParseSession([...rows, ...prev]);
}

export function clearDemoAiParseSession() {
  writeDemoAiParseSession([]);
}
