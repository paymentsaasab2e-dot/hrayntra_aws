/** True when the string looks like an http(s) URL. */
export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(String(value || '').trim());
}

/** Last path segment of a file URL, with optional upload-id prefix stripped. */
export function displayNameFromFileUrl(url: string): string {
  const raw = String(url || '').trim();
  if (!raw) return 'Document';

  let segment = raw;
  try {
    segment = decodeURIComponent(new URL(raw).pathname.split('/').pop() || '');
  } catch {
    segment = decodeURIComponent(raw.split('/').pop()?.split(/[?#]/)[0] || '');
  }

  if (!segment) return 'Document';

  const withoutPrefix = segment.replace(/^[a-f0-9]{24}_\d+_/i, '');
  return withoutPrefix || segment;
}

/** Normalize vaccination / certificate fields into a list of document URLs. */
export function collectDocumentUrls(value: unknown): string[] {
  if (value == null || value === '') return [];

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectDocumentUrls(item));
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const direct =
      obj.url ?? obj.fileUrl ?? obj.href ?? obj.certificate ?? obj.document ?? obj.path;
    if (typeof direct === 'string') return collectDocumentUrls(direct);
    if (typeof obj.fileName === 'string' && isHttpUrl(obj.fileName)) return [obj.fileName];
    if (typeof obj.name === 'string' && isHttpUrl(obj.name)) return [obj.name];
  }

  return [];
}
