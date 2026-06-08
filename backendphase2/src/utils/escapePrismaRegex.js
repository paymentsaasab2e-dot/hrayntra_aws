/**
 * Escape user-provided text before passing to Prisma MongoDB string filters
 * (`contains`, `startsWith`, `endsWith`, `equals` with `mode: 'insensitive'`).
 * Those compile to $regexMatch and break on characters like +, ?, *, (, ).
 */
export function escapePrismaRegex(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
