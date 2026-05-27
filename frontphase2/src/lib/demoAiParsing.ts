import type { BulkCvTokenRecord } from './bulkCvTokensStore';
import { estimateCvParseCostUsd } from './cvParseCost';

export type DemoAiParseRow = {
  id: string;
  resumeName: string;
  totalTokens: number;
  totalCostUsd: number;
  gptModel: string;
  parsedOn: string;
  inputTokens: number;
  outputTokens: number;
};

export function displayGptModel(model: string | null, provider?: string): string {
  const trimmed = String(model || '').trim();
  if (trimmed) return trimmed;
  const p = String(provider || '').toLowerCase();
  if (p === 'openai') return 'gpt-4o-mini';
  if (p === 'mistral') return 'mistral-small-latest';
  if (p === 'system') return 'regex (no GPT)';
  return '—';
}

export function recordToDemoAiRow(record: BulkCvTokenRecord): DemoAiParseRow {
  const gptModel = displayGptModel(record.model, record.provider);
  const totalCostUsd = estimateCvParseCostUsd(record.inputTokens, record.outputTokens, record.model);
  return {
    id: record.id,
    resumeName: record.fileName,
    totalTokens: record.totalTokens,
    totalCostUsd,
    gptModel,
    parsedOn: record.recordedAt,
    inputTokens: record.inputTokens,
    outputTokens: record.outputTokens,
  };
}

/** Sample rows when no bulk CV session exists (matches CV Parser overview layout). */
export const DEMO_AI_SAMPLE_ROWS: DemoAiParseRow[] = [
  {
    id: 'demo-1',
    resumeName: 'John_Doe_Resume.pdf',
    totalTokens: 1245,
    totalCostUsd: 0.32,
    gptModel: 'gpt-3.5-turbo',
    parsedOn: '2025-05-25T10:30:00.000Z',
    inputTokens: 900,
    outputTokens: 345,
  },
  {
    id: 'demo-2',
    resumeName: 'Jane_Smith_CV.docx',
    totalTokens: 980,
    totalCostUsd: 0.28,
    gptModel: 'gpt-3.5-turbo',
    parsedOn: '2025-05-24T14:15:00.000Z',
    inputTokens: 720,
    outputTokens: 260,
  },
  {
    id: 'demo-3',
    resumeName: 'Alex_Johnson_Profile.pdf',
    totalTokens: 1560,
    totalCostUsd: 0.41,
    gptModel: 'gpt-4o-mini',
    parsedOn: '2025-05-23T09:45:00.000Z',
    inputTokens: 1100,
    outputTokens: 460,
  },
  {
    id: 'demo-4',
    resumeName: 'Maria_Garcia_Resume.pdf',
    totalTokens: 1120,
    totalCostUsd: 0.29,
    gptModel: 'gpt-3.5-turbo',
    parsedOn: '2025-05-22T16:20:00.000Z',
    inputTokens: 800,
    outputTokens: 320,
  },
  {
    id: 'demo-5',
    resumeName: 'David_Lee_CV.pdf',
    totalTokens: 890,
    totalCostUsd: 0.24,
    gptModel: 'gpt-3.5-turbo',
    parsedOn: '2025-05-21T11:10:00.000Z',
    inputTokens: 640,
    outputTokens: 250,
  },
];

export function computeDemoAiSummary(rows: DemoAiParseRow[]) {
  const totalResumes = rows.length;
  const totalTokens = rows.reduce((sum, row) => sum + row.totalTokens, 0);
  const totalCostUsd = rows.reduce((sum, row) => sum + row.totalCostUsd, 0);
  const avgCostPerResume = totalResumes > 0 ? totalCostUsd / totalResumes : 0;
  return { totalResumes, totalTokens, totalCostUsd, avgCostPerResume };
}

export function uniqueGptModels(rows: DemoAiParseRow[]): string[] {
  const set = new Set<string>();
  rows.forEach((row) => {
    if (row.gptModel && row.gptModel !== '—') set.add(row.gptModel);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
