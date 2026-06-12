'use client';

import React, { useMemo } from 'react';

interface PortalTailoredCvStudioPreviewProps {
  html: string;
  templateId?: string | null;
  className?: string;
}

/**
 * Renders the exact LMS studio preview HTML captured on portal apply
 * (template, SAASA watermark, section layout from Phase 1).
 */
export function PortalTailoredCvStudioPreview({
  html,
  templateId,
  className = '',
}: PortalTailoredCvStudioPreviewProps) {
  const jobPortalBase = useMemo(() => {
    const configured = process.env.NEXT_PUBLIC_JOBPORTAL_URL || process.env.NEXT_PUBLIC_PORTAL_URL;
    return String(configured || 'http://localhost:3000').replace(/\/$/, '');
  }, []);

  const srcDoc = useMemo(() => {
    const safeTemplate = String(templateId || 'studio').replace(/[<>"']/g, '');
    const logoUrl = `${jobPortalBase}/SAASA%20Logo.png`;
    const watermark = `<div aria-hidden="true" style="position:absolute;inset:0;pointer-events:none;z-index:20;display:flex;align-items:center;justify-content:center;">
  <img src="${logoUrl}" alt="" style="max-height:54%;max-width:70%;object-fit:contain;opacity:0.13;" />
</div>
<div aria-hidden="true" style="position:absolute;bottom:1.25rem;right:1.25rem;pointer-events:none;z-index:21;">
  <img src="${logoUrl}" alt="" style="height:2rem;width:auto;max-width:96px;object-fit:contain;opacity:0.8;" />
</div>`;
    const bodyHtml = /SAASA%20Logo|SAASA Logo|data-saasa-watermark/i.test(html)
      ? html.replace(/src=(["'])(?:\/SAASA%20Logo\.png|\/SAASA Logo\.png)\1/gi, `src="${logoUrl}"`)
      : `<div style="position:relative;overflow:hidden;">${html}${watermark}</div>`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <base href="${jobPortalBase}/" />
  <script src="https://cdn.tailwindcss.com"></script>
  <title>AI CV — ${safeTemplate}</title>
  <style>
    html, body { margin: 0; padding: 0; background: #e2e8f0; }
    body { min-height: 100%; }
    .portal-tailored-cv-root {
      box-sizing: border-box;
      max-width: 52rem;
      margin: 0 auto;
      padding: 1rem;
    }
    .portal-tailored-cv-root * { box-sizing: border-box; }
  </style>
</head>
<body>
  <div class="portal-tailored-cv-root">${bodyHtml}</div>
</body>
</html>`;
  }, [html, jobPortalBase, templateId]);

  return (
    <div className={`h-full min-h-0 overflow-auto bg-slate-200/80 p-3 sm:p-4 ${className}`.trim()}>
      <iframe
        title="AI CV from job portal"
        srcDoc={srcDoc}
        className="mx-auto block min-h-[640px] w-full max-w-[52rem] rounded-xl border border-slate-200 bg-white shadow-sm"
        sandbox="allow-same-origin allow-scripts"
      />
    </div>
  );
}
