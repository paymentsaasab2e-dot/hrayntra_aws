export const DEFAULT_LANGUAGES = [
  'English',
  'Hindi',
  'Spanish',
  'French',
  'German',
  'Mandarin Chinese',
  'Japanese',
  'Arabic',
  'Portuguese',
  'Russian',
  'Italian',
  'Korean',
  'Bengali',
  'Tamil',
  'Telugu',
  'Marathi',
  'Gujarati',
  'Kannada',
  'Malayalam',
  'Punjabi',
  'Dutch',
  'Turkish',
  'Vietnamese',
  'Thai',
  'Polish',
  'Swedish',
  'Urdu',
  'Filipino',
] as const;

export const RECOMMENDED_LANGUAGES = ['English', 'Hindi', 'Spanish', 'French'] as const;

export const DEFAULT_PROFICIENCIES = [
  'Basic',
  'Conversational',
  'Professional',
  'Native',
  'Fluent',
  'Intermediate',
  'Advanced',
  'Beginner',
] as const;

export const RECOMMENDED_PROFICIENCIES = ['Conversational', 'Professional', 'Fluent', 'Native'] as const;

export type LocalSuggestionSource = 'history' | 'catalog' | 'ai';

export function buildLocalLanguageSuggestions(
  query: string,
  exclude: string[] = [],
  limit = 8,
): Array<{ label: string; source: LocalSuggestionSource }> {
  const q = query.trim().toLowerCase();
  const excludeSet = new Set(exclude.map((entry) => entry.trim().toLowerCase()).filter(Boolean));
  const cap = Math.min(Math.max(limit, 1), 12);

  const pushUnique = (
    labels: string[],
    source: LocalSuggestionSource,
    out: Array<{ label: string; source: LocalSuggestionSource }>,
    seen: Set<string>,
  ) => {
    for (const label of labels) {
      const norm = label.trim();
      if (!norm) continue;
      const key = norm.toLowerCase();
      if (excludeSet.has(key) || seen.has(key)) continue;
      seen.add(key);
      out.push({ label: norm, source });
      if (out.length >= cap) break;
    }
  };

  const out: Array<{ label: string; source: LocalSuggestionSource }> = [];
  const seen = new Set<string>();

  if (!q) {
    pushUnique([...RECOMMENDED_LANGUAGES], 'catalog', out, seen);
    if (out.length < cap) {
      pushUnique([...DEFAULT_LANGUAGES], 'catalog', out, seen);
    }
    return out;
  }

  const ranked = [...DEFAULT_LANGUAGES]
    .map((label) => {
      const hay = label.toLowerCase();
      let rank = 0;
      if (hay === q) rank = 100;
      else if (hay.startsWith(q)) rank = 80;
      else if (hay.includes(q)) rank = 60;
      return { label, rank };
    })
    .filter((row) => row.rank > 0)
    .sort((a, b) => b.rank - a.rank || a.label.localeCompare(b.label));

  pushUnique(
    ranked.map((row) => row.label),
    'catalog',
    out,
    seen,
  );
  return out;
}

export function buildLocalProficiencySuggestions(
  query: string,
  exclude: string[] = [],
  limit = 8,
): Array<{ label: string; source: LocalSuggestionSource }> {
  const q = query.trim().toLowerCase();
  const excludeSet = new Set(exclude.map((entry) => entry.trim().toLowerCase()).filter(Boolean));
  const cap = Math.min(Math.max(limit, 1), 12);

  const out: Array<{ label: string; source: LocalSuggestionSource }> = [];
  const seen = new Set<string>();

  const pushUnique = (labels: readonly string[]) => {
    for (const label of labels) {
      const norm = label.trim();
      if (!norm) continue;
      const key = norm.toLowerCase();
      if (excludeSet.has(key) || seen.has(key)) continue;
      seen.add(key);
      out.push({ label: norm, source: 'catalog' });
      if (out.length >= cap) break;
    }
  };

  if (!q) {
    pushUnique(RECOMMENDED_PROFICIENCIES);
    if (out.length < cap) pushUnique(DEFAULT_PROFICIENCIES);
    return out;
  }

  const ranked = [...DEFAULT_PROFICIENCIES]
    .map((label) => {
      const hay = label.toLowerCase();
      let rank = 0;
      if (hay === q) rank = 100;
      else if (hay.startsWith(q)) rank = 80;
      else if (hay.includes(q)) rank = 60;
      return { label, rank };
    })
    .filter((row) => row.rank > 0)
    .sort((a, b) => b.rank - a.rank || a.label.localeCompare(b.label));

  pushUnique(ranked.map((row) => row.label));
  return out;
}
