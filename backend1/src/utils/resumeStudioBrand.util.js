const SAASA_LOGO_PATH = '/SAASA%20Logo.png';

function getJobPortalPublicOrigin() {
  return String(
    process.env.JOBPORTAL_PUBLIC_URL ||
      process.env.NEXT_PUBLIC_JOBPORTAL_URL ||
      'http://localhost:3000',
  ).replace(/\/$/, '');
}

function absoluteSaasaLogoUrl(origin) {
  const base = String(origin || getJobPortalPublicOrigin()).replace(/\/$/, '');
  return `${base}${SAASA_LOGO_PATH}`;
}

function buildSaasaWatermarkOverlayHtml(logoUrl) {
  const src = String(logoUrl || '').replace(/"/g, '&quot;');
  return `<div aria-hidden="true" data-saasa-watermark="center" style="position:absolute;inset:0;pointer-events:none;z-index:20;display:flex;align-items:center;justify-content:center;">
  <img src="${src}" alt="" draggable="false" style="max-height:54%;max-width:70%;object-fit:contain;opacity:0.13;user-select:none;" />
</div>
<div aria-hidden="true" data-saasa-watermark="corner" style="position:absolute;bottom:1.25rem;right:1.25rem;pointer-events:none;z-index:21;">
  <img src="${src}" alt="" draggable="false" style="height:2rem;width:auto;max-width:96px;object-fit:contain;opacity:0.8;user-select:none;" />
</div>`;
}

function htmlHasSaasaWatermark(html) {
  return /SAASA%20Logo|SAASA Logo|data-saasa-watermark/i.test(String(html || ''));
}

function normalizeResumeStudioHtml(html, options = {}) {
  const raw = String(html || '').trim();
  if (!raw) return raw;

  const origin = String(options.origin || getJobPortalPublicOrigin()).replace(/\/$/, '');
  const logoUrl = absoluteSaasaLogoUrl(origin);

  let normalized = raw.replace(
    /src=(["'])(?:\/SAASA%20Logo\.png|\/SAASA Logo\.png)\1/gi,
    `src="${logoUrl}"`,
  );

  if (options.ensureWatermark === false) {
    return normalized;
  }

  if (!htmlHasSaasaWatermark(normalized)) {
    const needsRelativeRoot =
      !/position\s*:\s*relative/i.test(normalized) && !/\brelative\b/.test(normalized);
    if (needsRelativeRoot) {
      normalized = `<div style="position:relative;overflow:hidden;">${normalized}${buildSaasaWatermarkOverlayHtml(logoUrl)}</div>`;
    } else {
      normalized = `${normalized}${buildSaasaWatermarkOverlayHtml(logoUrl)}`;
    }
  }

  return normalized;
}

function wrapResumeStudioHtmlDocument(html, title = 'CV', options = {}) {
  const origin = String(options.origin || getJobPortalPublicOrigin()).replace(/\/$/, '');
  const safeTitle = String(title || 'CV').replace(/[<>"']/g, '');
  const body = normalizeResumeStudioHtml(html, { origin, ensureWatermark: true });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <base href="${origin}/" />
  <script src="https://cdn.tailwindcss.com"></script>
  <title>${safeTitle}</title>
  <style>
    html, body { margin: 0; padding: 0; background: #ffffff; }
    body { min-height: 100%; }
    #resume-preview, #resume-preview-expanded {
      width: 100% !important;
      max-width: none !important;
      min-height: auto !important;
      box-shadow: none !important;
    }
  </style>
</head>
<body>
  <div class="resume-container">${body}</div>
</body>
</html>`;
}

module.exports = {
  getJobPortalPublicOrigin,
  absoluteSaasaLogoUrl,
  normalizeResumeStudioHtml,
  wrapResumeStudioHtmlDocument,
};
