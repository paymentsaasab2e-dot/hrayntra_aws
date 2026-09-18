/**
 * Frontend search gate aligned with backend classifyCandidateSearch.
 * Blocks 1-char name spam while allowing exact id / email / phone.
 */

export type CandidateSearchKind = 'empty' | 'id' | 'email' | 'phone' | 'name' | 'general';

export function classifyCandidateSearchInput(search: string): {
  kind: CandidateSearchKind;
  term: string;
} {
  const term = String(search || '').trim();
  if (!term) return { kind: 'empty', term: '' };
  if (/^[a-fA-F0-9]{24}$/.test(term)) return { kind: 'id', term };
  if (term.includes('@') || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(term)) {
    return { kind: 'email', term };
  }
  const digitsOnly = term.replace(/\D/g, '');
  const nonDigitStripped = term.replace(/[\s()+.-]/g, '');
  if (
    digitsOnly.length >= 7 &&
    digitsOnly.length === nonDigitStripped.replace(/\D/g, '').length
  ) {
    return { kind: 'phone', term };
  }
  if (/^[\p{L}\p{M}\s.'.-]+$/u.test(term)) return { kind: 'name', term };
  return { kind: 'general', term };
}

/**
 * Whether the typed value should be sent as `search` after debounce.
 * Name/general require ≥2 characters; id/email/phone are allowed immediately.
 */
export function shouldSendCandidateSearch(search: string): boolean {
  const { kind, term } = classifyCandidateSearchInput(search);
  if (kind === 'empty') return true;
  if (kind === 'id' || kind === 'email' || kind === 'phone') return true;
  return term.length >= 2;
}

/** Value to put in the API/cache search key (empty when gated). */
export function effectiveCandidateSearchQuery(search: string): string {
  const term = String(search || '').trim();
  if (!term) return '';
  return shouldSendCandidateSearch(term) ? term : '';
}
