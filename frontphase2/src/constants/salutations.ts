/** Salutation options for director / primary contact name fields (CRM). */
export const NAME_SALUTATION_OPTIONS = [
  { value: '', label: '—' },
  { value: 'Mr', label: 'Mr' },
  { value: 'Mrs', label: 'Mrs' },
  { value: 'Ms', label: 'Ms' },
  { value: 'Dr', label: 'Dr' },
  { value: 'Prof', label: 'Prof' },
] as const;

export type NameSalutation = (typeof NAME_SALUTATION_OPTIONS)[number]['value'];

const VALID_SALUTATION_VALUES = new Set(
  NAME_SALUTATION_OPTIONS.map((opt) => opt.value).filter(Boolean),
);

const SALUTATION_PREFIX_RE = /^(Mr\.?|Mrs\.?|Ms\.?|Miss\.?|Dr\.?|Prof\.?)\s+/i;

const FEMALE_FIRST_NAMES = new Set([
  'aarti', 'aditi', 'amita', 'ananya', 'anjali', 'anita', 'archana', 'deepa', 'divya', 'geeta',
  'kavita', 'kiran', 'lata', 'meera', 'neha', 'nisha', 'pooja', 'priya', 'radha', 'rashmi',
  'rekha', 'riya', 'sakshi', 'sangeeta', 'shreya', 'sneha', 'sonia', 'tanvi', 'usha', 'vidya',
  'alice', 'anna', 'carol', 'catherine', 'diana', 'elizabeth', 'emily', 'emma', 'hannah', 'helen',
  'jane', 'jennifer', 'jessica', 'julia', 'karen', 'laura', 'linda', 'lisa', 'maria', 'mary',
  'michelle', 'nancy', 'patricia', 'rachel', 'rebecca', 'sarah', 'susan', 'victoria',
]);

const MALE_FIRST_NAMES = new Set([
  'amit', 'anil', 'arjun', 'ashok', 'deepak', 'gopal', 'manoj', 'mohit', 'nitin', 'pankaj',
  'prakash', 'rahul', 'raj', 'rajesh', 'rakesh', 'rohan', 'rohit', 'sanjay', 'suresh', 'vijay',
  'vikram', 'vinod', 'vishal', 'yogesh',
  'andrew', 'anthony', 'charles', 'christopher', 'daniel', 'david', 'donald', 'edward', 'george',
  'james', 'john', 'joseph', 'kenneth', 'mark', 'matthew', 'michael', 'paul', 'peter', 'richard',
  'robert', 'steven', 'thomas', 'william',
]);

const MALE_A_ENDING_NAMES = new Set(['buddha', 'krishna', 'rama', 'shiva', 'siva', 'yoga']);

export function normalizeSalutationValue(value: string | null | undefined): NameSalutation {
  const raw = String(value || '').trim().replace(/\./g, '');
  if (!raw) return '';
  if (raw.toLowerCase() === 'miss') return 'Ms';
  const match = NAME_SALUTATION_OPTIONS.find(
    (opt) => opt.value && opt.value.toLowerCase() === raw.toLowerCase(),
  );
  return (match?.value || '') as NameSalutation;
}

export function parseNameSalutation(fullName: string): { salutation: NameSalutation; name: string } {
  const trimmed = String(fullName || '').trim();
  const match = trimmed.match(SALUTATION_PREFIX_RE);
  if (!match) {
    return { salutation: '', name: trimmed };
  }

  return {
    salutation: normalizeSalutationValue(match[1]),
    name: trimmed.slice(match[0].length).trim(),
  };
}

export function inferSalutationFromName(name: string): NameSalutation {
  const firstName = String(name || '')
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase()
    .replace(/[^a-z]/g, '') || '';

  if (!firstName) return '';

  if (FEMALE_FIRST_NAMES.has(firstName)) return 'Ms';
  if (MALE_FIRST_NAMES.has(firstName)) return 'Mr';

  if (
    firstName.endsWith('a') &&
    firstName.length > 2 &&
    !MALE_A_ENDING_NAMES.has(firstName)
  ) {
    return 'Ms';
  }

  return '';
}

export function resolveSalutationForName(
  providedSalutation: string | null | undefined,
  fullName: string,
): { salutation: NameSalutation; name: string } {
  const parsed = parseNameSalutation(fullName);
  const normalizedProvided = normalizeSalutationValue(providedSalutation);
  const salutation =
    normalizedProvided ||
    parsed.salutation ||
    inferSalutationFromName(parsed.name || fullName);

  return {
    salutation: VALID_SALUTATION_VALUES.has(salutation) ? salutation : '',
    name: parsed.name || String(fullName || '').trim(),
  };
}

/** Keep salutation dropdown in sync when the user types or pastes a name. */
export function applySalutationFromNameInput(
  currentSalutation: string,
  rawName: string,
): { salutation: NameSalutation; name: string; salutationChanged: boolean } {
  const parsed = parseNameSalutation(rawName);
  const inferred = parsed.salutation || inferSalutationFromName(parsed.name);
  const shouldSetSalutation = Boolean(parsed.salutation) || !String(currentSalutation || '').trim();

  return {
    salutation: shouldSetSalutation ? inferred : normalizeSalutationValue(currentSalutation),
    name: parsed.name,
    salutationChanged: shouldSetSalutation && Boolean(inferred),
  };
}

export function formatDirectorDisplay(salutation: string | null | undefined, name: string | null | undefined): string {
  const n = String(name || '').trim();
  const s = String(salutation || '').trim();
  if (!n && !s) return '';
  if (!s) return n;
  if (!n) return s;
  return `${s} ${n}`;
}
