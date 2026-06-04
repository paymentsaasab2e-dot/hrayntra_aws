/**
 * Candidate / resume upload email validation — permissive for Yahoo and other
 * common providers; normalizes parser quirks (spaces, trailing punctuation).
 */

const EMAIL_REGEX =
  /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]*[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/;

/** Yahoo Mail and regional / legacy domains */
const YAHOO_DOMAINS = new Set([
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.co.in',
  'yahoo.co.jp',
  'yahoo.co.id',
  'yahoo.co.nz',
  'yahoo.com.au',
  'yahoo.com.br',
  'yahoo.com.mx',
  'yahoo.com.sg',
  'yahoo.com.ph',
  'yahoo.com.hk',
  'yahoo.com.tw',
  'yahoo.com.ar',
  'yahoo.com.vn',
  'yahoo.in',
  'yahoo.fr',
  'yahoo.de',
  'yahoo.it',
  'yahoo.es',
  'yahoo.ca',
  'yahoo.ie',
  'yahoo.gr',
  'ymail.com',
  'rocketmail.com',
  'myyahoo.com',
]);

const KNOWN_DOMAINS = [
  ...YAHOO_DOMAINS,
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'rediffmail.com',
  'mail.com',
  'protonmail.com',
  'proton.me',
  'zoho.com',
  'aol.com',
];

const YAHOO_DOMAIN_PATTERN =
  /^(?:[a-z0-9-]+\.)*yahoo\.[a-z]{2,}(?:\.[a-z]{2,})?$/i;

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array(n + 1)
      .fill(0)
      .map((_, j) => (j === 0 ? i : 0))
  );
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

export function isYahooEmailDomain(domain: string): boolean {
  const d = String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
  if (!d) return false;
  if (YAHOO_DOMAINS.has(d)) return true;
  return YAHOO_DOMAIN_PATTERN.test(d);
}

function fixYahooDomainTypos(domain: string): string {
  const d = domain.toLowerCase();
  if (isYahooEmailDomain(d)) return d;
  if (/^yah[o0]{1,3}\.com$/i.test(d)) return 'yahoo.com';
  if (/^yahoo[o0]+\.com$/i.test(d)) return 'yahoo.com';
  if (/^yah+oo\.com$/i.test(d)) return 'yahoo.com';
  // Do not map regional Yahoo hosts (yahoo.fr, yahoo.co.in, …) to yahoo.com.
  if (!/^yahoo\.[a-z]{2,}/i.test(d) && levenshtein(d, 'yahoo.com') <= 2) {
    return 'yahoo.com';
  }
  return d;
}

function deriveEmailLocalPart(firstName?: string, lastName?: string): string {
  const first = String(firstName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const last = String(lastName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (first && last) return `${first}.${last}`;
  if (first) return first;
  if (last) return last;
  return 'contact';
}

function isEmailDomainOnly(value: string): boolean {
  const d = value.toLowerCase().replace(/\.$/, '');
  return isKnownEmailDomain(d) || isYahooEmailDomain(d);
}

export type NormalizeCandidateEmailOptions = {
  firstName?: string;
  lastName?: string;
};

function isKnownEmailDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  if (KNOWN_DOMAINS.includes(d)) return true;
  if (isYahooEmailDomain(d)) return true;
  return false;
}

/** Clean emails extracted from CVs before validation or API submit. */
export function normalizeCandidateEmailInput(
  email: string | null | undefined,
  options: NormalizeCandidateEmailOptions = {}
): string {
  let value = String(email ?? '').trim();
  if (!value) return '';

  value = value.replace(/^mailto:/i, '').trim();
  value = value.replace(/^email\s*[:=]\s*/i, '').trim();
  value = value.replace(/^<|>$/g, '').trim();
  value = value.replace(/\s+/g, '');
  value = value.replace(/[.,;:!?)]+$/g, '').trim();

  if (value.startsWith('@')) {
    const domain = fixYahooDomainTypos(value.slice(1).toLowerCase());
    const local = deriveEmailLocalPart(options.firstName, options.lastName);
    return `${local}@${domain}`;
  }

  const at = value.indexOf('@');
  if (at < 0) {
    const domainOnly = value.toLowerCase().replace(/\.$/, '');
    if (isEmailDomainOnly(domainOnly)) {
      const local = deriveEmailLocalPart(options.firstName, options.lastName);
      return `${local}@${fixYahooDomainTypos(domainOnly)}`;
    }
    return value;
  }

  if (at < 1) {
    const domain = fixYahooDomainTypos(value.slice(1).toLowerCase());
    const local = deriveEmailLocalPart(options.firstName, options.lastName);
    return `${local}@${domain}`;
  }

  const local = value.slice(0, at);
  let domain = value.slice(at + 1).toLowerCase();
  domain = fixYahooDomainTypos(domain);

  return `${local}@${domain}`;
}

export type CandidateEmailValidation = {
  valid: boolean;
  message: string;
  normalized?: string;
};

export function validateCandidateEmail(
  email: string | null | undefined,
  options: NormalizeCandidateEmailOptions = {}
): CandidateEmailValidation {
  const normalized = normalizeCandidateEmailInput(email, options);
  const value = normalized;

  if (!value) {
    return { valid: false, message: 'Email is required' };
  }

  if (!EMAIL_REGEX.test(value)) {
    return { valid: false, message: 'Invalid email format' };
  }

  const domain = value.split('@')[1]?.toLowerCase() || '';

  if (isKnownEmailDomain(domain)) {
    return { valid: true, message: 'Valid email', normalized: value };
  }

  let best: string | null = null;
  let bestDist = Infinity;
  for (const known of KNOWN_DOMAINS) {
    const dist = levenshtein(domain, known);
    if (dist < bestDist) {
      bestDist = dist;
      best = known;
    }
  }

  if (bestDist <= 3 && best && !isYahooEmailDomain(domain)) {
    return { valid: false, message: `Did you mean @${best}?` };
  }

  return { valid: true, message: 'Valid email', normalized: value };
}
