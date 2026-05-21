import { parseAgreementDocumentFromUpload } from '../../services/agreementParsing.service.js';

export const agreementController = {
  async parseDocument(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }

      const { terms, filledCount, textLength } = await parseAgreementDocumentFromUpload(req.file);

      return res.json({
        success: true,
        data: {
          terms,
          filledCount,
          textLength,
        },
      });
    } catch (err) {
      return next(err);
    }
  },
};
