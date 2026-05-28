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

export function buildDeviceMeta(req, body = {}) {
  const userAgent = req.get('user-agent') || body.userAgent || 'Unknown';
  const parsed = parseDeviceFromUserAgent(userAgent);
  const ipAddress =
    String(body.ipAddress || '').trim() ||
    String(req.headers['x-forwarded-for'] || '')
      .split(',')[0]
      ?.trim() ||
    req.ip ||
    req.connection?.remoteAddress ||
    '';

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
  const ip = session?.ipAddress ? `\nIP: ${session.ipAddress}` : '';
  return `${browser} on ${os}${location}${ip}`;
}
