export type SmartSearchChipKind =
  | 'status'
  | 'source'
  | 'stage'
  | 'recruiter'
  | 'client'
  | 'mode'
  | 'round'
  | 'priority'
  | 'employment'
  | 'text';

export type SmartSearchKeywordChip = {
  id: string;
  value: string;
  label: string;
  kind: SmartSearchChipKind;
};

export type SmartSearchExample = {
  label: string;
  query: string;
};

export type SmartSearchParseBase = {
  keywords: SmartSearchKeywordChip[];
  summary: string;
};

export type AssigneeOption = { id: string; name: string };

export type NamedOption = { id: string; name: string };
