/**
 * Compact company-name key used to treat punctuation / legal-suffix variants
 * as the same client, e.g. "Keda Ceramic - Zambia" === "Keda Ceramic Zambia".
 * Country / distinct words stay in the key so Kenya vs Zambia do not collapse.
 */
const LEGAL_WORD =
  /\b(private|limited|ltd|inc|llc|corp|corporation|solutions|technologies|technology|services|group|company|co)\b/gi;

export function normalizeCompanyNameKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(LEGAL_WORD, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function preferredCompanyDisplayName(names = []) {
  const unique = [
    ...new Set(
      names
        .map((name) => String(name || '').replace(/\u00a0/g, ' ').trim())
        .filter(Boolean),
    ),
  ];
  if (!unique.length) return '';
  unique.sort((left, right) => {
    const punct = (value) => (value.match(/[^a-zA-Z0-9\s]/g) || []).length;
    const leftPunct = punct(left);
    const rightPunct = punct(right);
    if (leftPunct !== rightPunct) return leftPunct - rightPunct;
    if (left.length !== right.length) return left.length - right.length;
    return left.localeCompare(right);
  });
  return unique[0];
}

export function uniqueDocsByCompanyName(docs = []) {
  const seen = new Set();
  const out = [];
  for (const doc of docs) {
    const key = normalizeCompanyNameKey(doc?.companyName || doc?.name || doc?.company);
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(doc);
  }
  return out;
}

export function findDocByCompanyName(docs = [], companyName) {
  const compact = normalizeCompanyNameKey(companyName);
  if (!compact) return null;
  return (
    docs.find((doc) => normalizeCompanyNameKey(doc?.companyName || doc?.name || doc?.company) === compact) ||
    null
  );
}
