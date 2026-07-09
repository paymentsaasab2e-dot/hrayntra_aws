import {
  contentTypeForPublicUpload,
  loadPublicUpload,
} from '../utils/publicUploads.util.js';

export async function getPublicUpload(req, res) {
  try {
    const subdir = String(req.uploadSubdir || req.params.subdir || '').trim();
    const filename = String(req.params.filename || '').trim();
    const tenantDbName = String(req.query.tenantDbName || req.query.tenant || '').trim();

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
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.status(200).send(file.buffer);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'Unable to load file',
    });
  }
}
