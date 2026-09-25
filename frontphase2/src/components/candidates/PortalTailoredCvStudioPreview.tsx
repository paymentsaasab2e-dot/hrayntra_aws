'use client';

import React, { useMemo } from 'react';
import { useOrgExportWatermark } from '../../lib/useOrgExportWatermark';
import { resolveWatermarkImageSrc } from '../../lib/exportWatermark';

interface PortalTailoredCvStudioPreviewProps {
  html: string;
  templateId?: string | null;
  className?: string;
}

function stripBuiltInWatermarks(html: string): string {
  return String(html || '')
    .replace(/<div[^>]*data-saasa-watermark=["'][^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<div[^>]*data-hryantra-watermark(?:=["'][^"']*["'])?[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<div[^>]*data-tenant-watermark=["']1["'][^>]*>[\s\S]*?<\/div>/gi, '');
}

function tenantWatermarkHtml(logoUrl: string, text: string, opacity: number): string {
  const safeOpacity = Math.min(0.5, Math.max(0.05, opacity || 0.18));
  const src = logoUrl.replace(/"/g, '&quot;');
  const safeText = text.replace(/[<>"']/g, '');
  if (src) {
    return `<div aria-hidden="true" data-tenant-watermark="1" style="position:absolute;inset:0;pointer-events:none;z-index:20;display:flex;align-items:center;justify-content:center;">
  <img src="${src}" alt="" draggable="false" style="max-height:42%;max-width:55%;object-fit:contain;opacity:${safeOpacity};user-select:none;" />
</div>`;
  }
  if (safeText) {
    return `<div aria-hidden="true" data-tenant-watermark="1" style="position:absolute;inset:0;pointer-events:none;z-index:20;display:flex;align-items:center;justify-content:center;">
  <span style="font-size:42px;font-weight:700;letter-spacing:0.08em;color:#64748b;opacity:${safeOpacity};transform:rotate(-24deg);user-select:none;">${safeText}</span>
</div>`;
  }
  return '';
}

/**
 * Renders the job-portal CV HTML with this tenant’s single export watermark.
 * The built-in center and corner logos are removed so only the Super Admin stamp shows.
 */
export function PortalTailoredCvStudioPreview({
  html,
  templateId,
  className = '',
}: PortalTailoredCvStudioPreviewProps) {
  const { settings: watermark } = useOrgExportWatermark();
  const jobPortalBase = useMemo(() => {
    const configured = process.env.NEXT_PUBLIC_JOBPORTAL_URL || process.env.NEXT_PUBLIC_PORTAL_URL;
    return String(configured || 'http://localhost:3000').replace(/\/$/, '');
  }, []);

  const srcDoc = useMemo(() => {
    const safeTemplate = String(templateId || 'studio').replace(/[<>"']/g, '');
    const normalizedHtml = stripBuiltInWatermarks(html)
      .replace(/\boverflow-hidden\b/g, 'overflow-visible')
      .replace(/overflow\s*:\s*hidden/gi, 'overflow:visible');
    const logoUrl = watermark.enabled
      ? resolveWatermarkImageSrc(watermark.imageDataUrl || watermark.imageUrl)
      : '';
    const stamp = watermark.enabled
      ? tenantWatermarkHtml(logoUrl, watermark.text, watermark.opacity)
      : '';
    const bodyHtml = stamp
      ? `<div style="position:relative;overflow:visible;padding-bottom:2.5rem;">${normalizedHtml}${stamp}</div>`
      : normalizedHtml;
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
    body { min-height: 100%; overflow: auto; }
    .portal-tailored-cv-root {
      box-sizing: border-box;
      max-width: 52rem;
      margin: 0 auto;
      padding: 1rem;
      overflow: visible;
    }
    .portal-tailored-cv-root * { box-sizing: border-box; }
    #resume-preview, #resume-preview-expanded, [id*="resume-preview"] {
      overflow: visible !important;
      min-height: auto !important;
      height: auto !important;
      max-height: none !important;
    }
  </style>
</head>
<body>
  <div class="portal-tailored-cv-root">${bodyHtml}</div>
</body>
</html>`;
  }, [html, jobPortalBase, templateId, watermark]);

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
