import path from 'path';
import { getActiveTenantDbName } from '../../config/prisma.js';
import { loadPublicUpload } from '../../utils/publicUploads.util.js';
import {
  getExportWatermark,
  normalizeExportWatermark,
} from './exportWatermark.service.js';

function mimeFromFilename(filename = '') {
  const ext = path.extname(String(filename || '')).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.svg') return 'image/svg+xml';
  return 'image/png';
}

function parseWatermarkLogoRef(imageUrl = '') {
  const raw = String(imageUrl || '').trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw, 'http://localhost');
    const parts = parsed.pathname.split('/').filter(Boolean);
    const filename = decodeURIComponent(parts[parts.length - 1] || '');
    if (!filename) return null;
    const tenantDbName =
      parsed.searchParams.get('tenantDbName') ||
      parsed.searchParams.get('tenant') ||
      getActiveTenantDbName() ||
      '';
    return { filename, tenantDbName };
  } catch {
    return null;
  }
}

/**
 * Org export watermark for public client-review exports (no auth cookie).
 * Embeds logo as data URL when possible so Excel/PDF stamp works offline.
 */
export async function getPublicClientReviewExportWatermark() {
  const watermark = normalizeExportWatermark(await getExportWatermark());
  if (!watermark.enabled) {
    return { ...watermark, imageDataUrl: '' };
  }

  let imageDataUrl = '';
  const ref = parseWatermarkLogoRef(watermark.imageUrl);
  const activeTenant = String(getActiveTenantDbName() || '').trim();
  // Public review has no login. Only the tenant that owns this request may supply the logo.
  const logoTenant = activeTenant || String(ref?.tenantDbName || '').trim();
  const foreignLogo =
    Boolean(activeTenant) &&
    Boolean(ref?.tenantDbName) &&
    String(ref.tenantDbName).trim() !== activeTenant;
  if (ref?.filename && logoTenant && !foreignLogo) {
    try {
      const file = await loadPublicUpload({
        subdir: 'export-watermarks',
        filename: ref.filename,
        tenantDbName: logoTenant,
      });
      if (file?.buffer?.length) {
        const mime = mimeFromFilename(file.filename || ref.filename);
        imageDataUrl = `data:${mime};base64,${Buffer.from(file.buffer).toString('base64')}`;
      }
    } catch (err) {
      console.warn(
        '[exportWatermark] public review logo embed failed:',
        err?.message || err,
      );
    }
  }

  return {
    ...watermark,
    imageDataUrl,
  };
}
