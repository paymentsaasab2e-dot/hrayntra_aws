/**
 * Fetch the device's public IP as seen on the internet (for login audit on localhost / dev).
 * Browsers cannot read this directly; a short third-party lookup is used when needed.
 */
export async function fetchClientPublicIp(): Promise<string | undefined> {
  if (typeof window === 'undefined') return undefined;

  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4000);
    const response = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal,
      cache: 'no-store',
    });
    window.clearTimeout(timeout);

    if (!response.ok) return undefined;
    const data = (await response.json()) as { ip?: string };
    const ip = String(data?.ip || '').trim();
    return ip || undefined;
  } catch {
    return undefined;
  }
}
