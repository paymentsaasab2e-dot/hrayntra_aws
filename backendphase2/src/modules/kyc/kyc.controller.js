import { parseKycDocumentFromUpload } from '../../services/kycParsing.service.js';

export const kycController = {
  async parseDocument(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }

      const result = await parseKycDocumentFromUpload(req.file);

      return res.json({
        success: true,
        data: {
          form: result.form,
          filledCount: result.filledCount,
          totalExtractable: result.totalExtractable,
          coverage: result.coverage,
          textLength: result.textLength,
          sourceType: result.sourceType,
          message: result.message || null,
        },
      });
    } catch (err) {
      return next(err);
    }
  },
};
