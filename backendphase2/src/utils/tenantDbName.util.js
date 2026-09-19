export function isValidTenantDbName(name) {
  const n = String(name || '').trim();
  if (!n) return false;
  if (n.length > 64) return false;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(n)) return false;
  const reserved = new Set(['admin', 'local', 'config', 'test']);
  if (reserved.has(n.toLowerCase())) return false;
  return true;
}
