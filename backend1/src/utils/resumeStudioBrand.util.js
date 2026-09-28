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

function stripResumePreviewLayoutConstraints(html) {
  return String(html || '')
    .replace(/\boverflow-hidden\b/g, 'overflow-visible')
    .replace(/\bmin-h-\[1123px\]/g, '')
    .replace(/\bmin-h-\[1123\]/g, '')
    .replace(/\bh-\[1123px\]/g, '')
    .replace(/\bh-screen\b/g, '')
    .replace(/overflow\s*:\s*hidden/gi, 'overflow:visible')
    .replace(/min-height\s*:\s*1123px/gi, 'min-height:auto')
    .replace(/height\s*:\s*1123px/gi, 'height:auto')
    .replace(/zoom\s*:\s*[^;"']+/gi, 'zoom:1')
    .replace(/transform\s*:\s*[^;"']+/gi, 'transform:none')
    .replace(/padding\s*:\s*0(?:px)?\s*;?/gi, '');
}

const RESUME_VIEW_DOCUMENT_CSS = `
    html, body { margin: 0; padding: 0; background: #e2e8f0; }
    body { min-height: 100%; overflow: auto !important; height: auto !important; }
    .resume-studio-preview-root,
    .resume-container {
      box-sizing: border-box;
      max-width: 52rem;
      margin: 0 auto;
      padding: 1rem;
      overflow: visible !important;
      height: auto !important;
    }
    .resume-studio-preview-root * { box-sizing: border-box; }
    #resume-preview,
    #resume-preview-expanded,
    [id*="resume-preview"] {
      width: 100% !important;
      max-width: 840px !important;
      margin-left: auto !important;
      margin-right: auto !important;
      min-height: auto !important;
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
      transform: none !important;
      zoom: 1 !important;
      padding-bottom: 3rem !important;
      box-shadow: none !important;
    }
    [data-saasa-watermark] { pointer-events: none; }
`;

const RESUME_VIEW_DOCUMENT_SCRIPT = `
(function () {
  function prepareResumeRoot() {
    var roots = document.querySelectorAll('#resume-preview, #resume-preview-expanded, [id*="resume-preview"]');
    roots.forEach(function (node) {
      if (!node || !node.style) return;
      node.style.height = 'auto';
      node.style.minHeight = 'auto';
      node.style.maxHeight = 'none';
      node.style.overflow = 'visible';
      node.style.transform = 'none';
      node.style.zoom = '1';
      node.style.width = '100%';
      node.style.maxWidth = '840px';
      node.style.marginLeft = 'auto';
      node.style.marginRight = 'auto';
      if (node.style.padding === '0px') node.style.padding = '';
      node.classList.remove('overflow-hidden', 'min-h-[1123px]', 'h-[1123px]', 'h-screen');
      node.classList.add('overflow-visible');
    });
    document.documentElement.style.height = 'auto';
    document.body.style.height = 'auto';
    document.body.style.overflow = 'auto';
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', prepareResumeRoot);
  } else {
    prepareResumeRoot();
  }
  window.addEventListener('load', prepareResumeRoot);
  setTimeout(prepareResumeRoot, 1500);
})();
`;

function normalizeResumeStudioHtml(html, options = {}) {
  const raw = String(html || '').trim();
  if (!raw) return raw;

  const origin = String(options.origin || getJobPortalPublicOrigin()).replace(/\/$/, '');
  const logoUrl = absoluteSaasaLogoUrl(origin);

  let normalized = stripResumePreviewLayoutConstraints(raw);
  normalized = normalized.replace(
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
      normalized = `<div style="position:relative;overflow:visible;padding-bottom:2.5rem;">${normalized}${buildSaasaWatermarkOverlayHtml(logoUrl)}</div>`;
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
  <style>${RESUME_VIEW_DOCUMENT_CSS}</style>
</head>
<body>
  <div class="resume-container">${body}</div>
  <script>${RESUME_VIEW_DOCUMENT_SCRIPT}</script>
</body>
</html>`;
}

module.exports = {
  getJobPortalPublicOrigin,
  absoluteSaasaLogoUrl,
  stripResumePreviewLayoutConstraints,
  normalizeResumeStudioHtml,
  wrapResumeStudioHtmlDocument,
};
