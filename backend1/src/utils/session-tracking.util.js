/**
 * Device + geo helpers for Phase 1 login/session analytics.
 */

function parseDeviceFromUserAgent(userAgent = '') {
  const ua = String(userAgent || '');
  let browser = 'Unknown';
  let operatingSystem = 'Unknown';
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

function formatDisplayIp(ipAddress) {
  if (!ipAddress) return null;
  let ip = String(ipAddress).trim();
  if (!ip) return null;
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') return '127.0.0.1';
  return ip;
}

function isLoopbackIp(ip) {
  const normalized = formatDisplayIp(ip);
  return !normalized || normalized === '127.0.0.1';
}

function resolveClientIp(req, body = {}) {
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

function cleanGeoPart(value) {
  const s = String(value || '').trim();
  if (!s || /^unknown$/i.test(s)) return null;
  return s.slice(0, 80);
}

/**
 * Build session tracking fields from request + optional client geo payload.
 */
function buildSessionTrackingFields(req, body = {}) {
  const userAgent = req.headers['user-agent'] || body.userAgent || 'unknown';
  const device = parseDeviceFromUserAgent(userAgent);
  const ipAddress = resolveClientIp(req, body) || 'unknown';

  return {
    userAgent,
    ipAddress,
    loginAt: new Date(),
    deviceType: device.deviceType,
    browser: device.browser,
    operatingSystem: device.operatingSystem,
    country: cleanGeoPart(body.country || body.countryName || body.countryCode),
    state: cleanGeoPart(body.state || body.region || body.regionName),
    city: cleanGeoPart(body.city),
    timezone: cleanGeoPart(body.timezone || body.timeZone),
    isActive: true,
    logoutAt: null,
    durationMs: null,
  };
}

/**
 * Close an active session for analytics (keeps the row for HQ history).
 */
function buildSessionClosePatch(session, now = new Date()) {
  const loginAt = session?.loginAt || session?.createdAt || now;
  const startMs = new Date(loginAt).getTime();
  const endMs = now.getTime();
  const durationMs = Number.isFinite(startMs)
    ? Math.max(0, endMs - startMs)
    : 0;
  return {
    isActive: false,
    logoutAt: now,
    durationMs,
    lastUsedAt: now,
  };
}

module.exports = {
  parseDeviceFromUserAgent,
  formatDisplayIp,
  resolveClientIp,
  buildSessionTrackingFields,
  buildSessionClosePatch,
};
