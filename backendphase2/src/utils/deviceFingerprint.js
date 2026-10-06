import crypto from 'crypto';

/**
 * Parse User-Agent into browser / OS / device type for session UI.
 */
export function parseDeviceFromUserAgent(userAgent = '') {
  const ua = String(userAgent || '');
  let browser = 'Unknown browser';
  let operatingSystem = 'Unknown OS';
  let deviceType = 'desktop';

  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';

  if (/Windows NT/i.test(ua)) operatingSystem = 'Windows';
  else if (/Mac OS X/i.test(ua)) operatingSystem = 'macOS';
  else if (/Android/i.test(ua)) operatingSystem = 'Android';
  else if (/iPhone|iPad/i.test(ua)) operatingSystem = 'iOS';
  else if (/Linux/i.test(ua)) operatingSystem = 'Linux';

  if (/Mobile|Android|iPhone/i.test(ua)) deviceType = 'mobile';
  else if (/iPad|Tablet/i.test(ua)) deviceType = 'tablet';

  return { browser, operatingSystem, deviceType };
}

function isLoopbackIp(ip) {
  const normalized = formatDisplayIp(ip);
  return !normalized || normalized === '127.0.0.1';
}

/**
 * Best-effort client IP from proxy headers, socket, or browser-reported public IP.
 * On localhost, prefers `clientPublicIp` from the frontend (ipify) over 127.0.0.1.
 */
/** Client device identifier (MAC id surrogate from browser storage). */
export function resolveMacAddress(body = {}) {
  return String(body.macAddress || body.macId || body.deviceId || '').trim();
}

/** Short display label for device MAC id in session UI and emails. */
export function formatMacDisplay(macAddress) {
  const mac = String(macAddress || '').trim();
  if (!mac) return null;
  if (mac.length <= 16) return mac;
  return `${mac.slice(0, 6)}…${mac.slice(-8)}`;
}

export function resolveClientIp(req, body = {}) {
  const bodyIp = formatDisplayIp(body.clientPublicIp || body.ipAddress);
  const forwarded = formatDisplayIp(
    String(req.headers['x-forwarded-for'] || '')
      .split(',')[0]
      ?.trim()
  );
  const direct = formatDisplayIp(
    req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress
  );

  if (!isLoopbackIp(forwarded)) return forwarded;
  if (!isLoopbackIp(direct)) return direct;
  if (!isLoopbackIp(bodyIp)) return bodyIp;
  return direct || bodyIp || forwarded || null;
}

export function buildDeviceMeta(req, body = {}) {
  const userAgent = req.get('user-agent') || body.userAgent || 'Unknown';
  const parsed = parseDeviceFromUserAgent(userAgent);
  const ipAddress = resolveClientIp(req, body) || '';

  const deviceId =
    String(body.deviceId || '').trim() ||
    crypto.createHash('sha256').update(`${userAgent}|${ipAddress}`).digest('hex').slice(0, 24);

  const location = String(body.location || '').trim() || null;

  return {
    deviceId,
    browserInfo: parsed.browser,
    operatingSystem: parsed.operatingSystem,
    deviceType: parsed.deviceType,
    ipAddress: ipAddress || null,
    location,
    userAgent,
  };
}

export function formatDeviceLabel(session) {
  const browser = session?.browserInfo || 'Unknown browser';
  const os = session?.operatingSystem || 'Unknown OS';
  const location = session?.location ? `\n${session.location}` : '';
  const mac = formatMacDisplay(session?.macAddress || session?.deviceId);
  const macLine = mac ? `\nDevice ID: ${mac}` : '';
  return `${browser} on ${os}${location}${macLine}`;
}

/** Normalize IPv4-mapped IPv6 (::ffff:127.0.0.1 → 127.0.0.1). */
export function formatDisplayIp(ipAddress) {
  if (!ipAddress) return null;
  let ip = String(ipAddress).trim();
  if (!ip) return null;
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') return '127.0.0.1';
  return ip;
}

/** Short browser label from a stored UA string or pre-parsed browser name. */
export function formatDisplayBrowser(deviceOrUserAgent) {
  if (!deviceOrUserAgent) return null;
  const raw = String(deviceOrUserAgent).trim();
  if (!raw) return null;
  if (!/Mozilla|AppleWebKit|Chrome|Safari|Firefox|Edg/i.test(raw) && raw.length <= 32) {
    return raw;
  }
  return parseDeviceFromUserAgent(raw).browser;
}

/** Activity log line: device IP + browser (no full user-agent). */
export function formatAuthConnectionDetails(ipAddress, deviceOrUserAgent) {
  const ip = formatDisplayIp(ipAddress);
  const browser = formatDisplayBrowser(deviceOrUserAgent);
  const parts = [];
  if (ip) parts.push(`IP: ${ip}`);
  if (browser) parts.push(`Browser: ${browser}`);
  return parts.length ? parts.join(' · ') : undefined;
}

/** IP only — for dedicated activity-log columns. */
export function formatAuthIpAddress(ipAddress) {
  const ip = formatDisplayIp(ipAddress);
  return ip ? `IP: ${ip}` : undefined;
}
