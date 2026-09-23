import {
  contentTypeForPublicUpload,
  loadPublicUpload,
  verifySignedUpload,
} from '../utils/publicUploads.util.js';

const SIGNED_SUBDIRS = new Set(['placements', 'interview-client-review']);

export async function getPublicUpload(req, res) {
  try {
    const subdir = String(req.uploadSubdir || req.params.subdir || '').trim();
    const filename = String(req.params.filename || '').trim();
    const tenantDbName = String(req.query.tenantDbName || req.query.tenant || '').trim();

    if (SIGNED_SUBDIRS.has(subdir)) {
      const ok = verifySignedUpload(`${subdir}/${filename}`, req.query.exp, req.query.sig);
      if (!ok) {
        return res.status(403).json({
          success: false,
          message: 'Link expired or invalid',
        });
      }
    }

    const file = await loadPublicUpload({ subdir, filename, tenantDbName });
    if (!file?.buffer?.length) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    const contentType = contentTypeForPublicUpload(file.filename);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    res.setHeader('Content-Length', String(file.buffer.length));
    res.setHeader(
      'Cache-Control',
      SIGNED_SUBDIRS.has(subdir) ? 'private, no-store' : 'public, max-age=86400',
    );
    // Allow email clients / cross-origin <img> tags to load the logo.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return res.status(200).send(file.buffer);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Unable to load file',
    });
  }
}
