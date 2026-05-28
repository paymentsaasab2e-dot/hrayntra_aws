import type { AssigneeOption, NamedOption, SmartSearchKeywordChip } from './types';

export function slugId(prefix: string, value: string): string {
  return `${prefix}-${value.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

export function extractQuotedPhrases(query: string): string[] {
  const phrases: string[] = [];
  const pattern = /["']([^"']{2,80})["']/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(query)) !== null) {
    if (match[1]?.trim()) phrases.push(match[1].trim());
  }
  return phrases;
}

export function extractLabeledPhrase(query: string, labels: string[]): string | null {
  for (const label of labels) {
    const pattern = new RegExp(`\\b${label}\\s*[:=]\\s*([^\\n,;]+)`, 'i');
    const match = query.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return null;
}

export function removePhrasesFromQuery(query: string, phrases: string[]): string {
  let remaining = query;
  for (const phrase of phrases) {
    if (!phrase) continue;
    remaining = remaining.replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
  }
  return remaining.replace(/\s+/g, ' ').trim();
}

export function matchEnumToken<T extends string>(
  query: string,
  mappings: Array<{ patterns: RegExp[]; value: T }>,
): T | null {
  for (const entry of mappings) {
    if (entry.patterns.some((pattern) => pattern.test(query))) {
      return entry.value;
    }
  }
  return null;
}

export function matchStatusFromList(query: string, statuses: string[]): string | null {
  const explicit = query.match(/\bstatus\s*[:=]\s*([a-z][a-z\s_-]{0,40})/i);
  if (explicit?.[1]) {
    const token = explicit[1].trim().toLowerCase();
    const found = statuses.find((status) => status.toLowerCase() === token);
    if (found) return found;
  }
  for (const status of statuses) {
    if (new RegExp(`\\b${status.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(query)) {
      return status;
    }
  }
  return null;
}

export function matchAssignee(query: string, assignees: AssigneeOption[]): AssigneeOption | null {
  const patterns = [
    /\bassigned\s+to\s+([a-z][a-z0-9\s.'-]{1,60})/i,
    /\brecruiter\s+([a-z][a-z0-9\s.'-]{1,60})/i,
    /\binterviewer\s+([a-z][a-z0-9\s.'-]{1,60})/i,
    /\bowner\s+([a-z][a-z0-9\s.'-]{1,60})/i,
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (!match?.[1]) continue;
    const token = match[1].trim().toLowerCase();
    const found = assignees.find((item) => {
      const name = item.name.toLowerCase();
      return name.includes(token) || token.includes(name);
    });
    if (found) return found;
  }
  return null;
}

export function matchNamedOption(
  query: string,
  options: NamedOption[],
  labels: string[],
): NamedOption | null {
  for (const label of labels) {
    const pattern = new RegExp(`\\b${label}\\s+([a-z0-9][a-z0-9\\s.'&-]{1,80})`, 'i');
    const match = query.match(pattern);
    if (!match?.[1]) continue;
    const token = match[1].trim().toLowerCase();
    const found = options.find((option) => {
      const name = option.name.toLowerCase();
      return name.includes(token) || token.includes(name);
    });
    if (found) return found;
  }

  for (const option of options) {
    if (new RegExp(`\\b${option.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(query)) {
      return option;
    }
  }

  return null;
}

export function extractFreeTextKeywords(
  query: string,
  consumed: string[],
  stopWords: Set<string>,
  reservedTokens: string[] = [],
): string[] {
  const consumedLower = new Set(consumed.map((item) => item.toLowerCase()));
  const reservedLower = new Set(reservedTokens.map((item) => item.toLowerCase()));
  const emailMatch = query.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || [];

  const keywords: string[] = [...emailMatch];

  for (const token of query.split(/[\s,;]+/).map((part) => part.trim()).filter(Boolean)) {
    const lower = token.toLowerCase();
    if (token.length < 2) continue;
    if (stopWords.has(lower)) continue;
    if (consumedLower.has(lower)) continue;
    if (reservedLower.has(lower)) continue;
    if (!keywords.some((item) => item.toLowerCase() === lower)) {
      keywords.push(token);
    }
  }

  return keywords;
}

export function finalizeKeywords(
  prompt: string,
  keywords: SmartSearchKeywordChip[],
  consumed: string[],
  stopWords: Set<string>,
  reservedTokens: string[] = [],
): SmartSearchKeywordChip[] {
  const remainder = removePhrasesFromQuery(prompt, consumed);
  const freeText = extractFreeTextKeywords(remainder, consumed, stopWords, reservedTokens);

  for (const text of freeText) {
    if (keywords.some((item) => item.value.toLowerCase() === text.toLowerCase())) continue;
    keywords.push({
      id: slugId('text', text),
      value: text,
      label: text,
      kind: 'text',
    });
  }

  if (keywords.length === 0 && prompt.trim()) {
    keywords.push({
      id: slugId('text', prompt),
      value: prompt.trim(),
      label: prompt.trim(),
      kind: 'text',
    });
  }

  return keywords;
}

export function buildSummary(keywords: SmartSearchKeywordChip[], entityLabel: string): string {
  return keywords.length > 0
    ? `Found ${keywords.length} keyword${keywords.length === 1 ? '' : 's'} — showing matching ${entityLabel}`
    : `Enter a prompt to search ${entityLabel}`;
}

export function keywordChipClass(kind: SmartSearchKeywordChip['kind']): string {
  switch (kind) {
    case 'status':
      return 'bg-blue-100 text-blue-900 border-blue-200/80';
    case 'source':
    case 'stage':
      return 'bg-emerald-100 text-emerald-900 border-emerald-200/80';
    case 'recruiter':
    case 'client':
      return 'bg-amber-100 text-amber-900 border-amber-200/80';
    case 'mode':
    case 'round':
      return 'bg-cyan-100 text-cyan-900 border-cyan-200/80';
    case 'priority':
    case 'employment':
      return 'bg-orange-100 text-orange-900 border-orange-200/80';
    default:
      return 'bg-violet-100 text-violet-900 border-violet-200/80';
  }
}
