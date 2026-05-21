import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';

function cleanDocumentText(text = '') {
  return String(text)
    .replace(/\u0000/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \u00a0]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extensionOf(file = {}) {
  return path.extname(file.originalname || file.filename || '').toLowerCase();
}

let cachedPdfParseFn = null;

/** pdf-parse v2 exposes PDFParse class; v1 exposes a default function. */
async function getPdfParseFn() {
  if (cachedPdfParseFn) return cachedPdfParseFn;

  const pdfParseModule = await import('pdf-parse');

  if (typeof pdfParseModule.PDFParse === 'function') {
    cachedPdfParseFn = async (buffer) => {
      const parser = new pdfParseModule.PDFParse({ data: Buffer.from(buffer) });
      try {
        const result = await parser.getText({});
        return { text: result?.text || '' };
      } finally {
        if (typeof parser.destroy === 'function') await parser.destroy();
      }
    };
  } else {
    const mod = pdfParseModule.default ?? pdfParseModule;
    if (typeof mod === 'function') {
      cachedPdfParseFn = mod;
    } else if (typeof mod?.default === 'function') {
      cachedPdfParseFn = mod.default;
    } else {
      throw new Error('Unsupported pdf-parse module shape');
    }
  }

  return cachedPdfParseFn;
}

async function extractPdfText(buffer) {
  const pdfParse = await getPdfParseFn();
  const pdfData = await pdfParse(buffer);
  return cleanDocumentText(pdfData?.text || '');
}

async function extractDocxText(buffer) {
  const mammothModule = await import('mammoth');
  const mammoth = mammothModule.default || mammothModule;
  const result = await mammoth.extractRawText({ buffer });
  return cleanDocumentText(result?.value || '');
}

async function extractDocText(filePath) {
  const wordExtractorModule = await import('word-extractor');
  const WordExtractor = wordExtractorModule.default || wordExtractorModule;
  const extractor = new WordExtractor();
  const doc = await extractor.extract(filePath);
  return cleanDocumentText(doc.getBody() || '');
}

/**
 * Extract plain text from an uploaded agreement file (multer memory file).
 */
export async function extractDocumentTextFromUpload(file) {
  if (!file?.buffer?.length) {
    throw new Error('No file data received');
  }

  const extension = extensionOf(file);
  const mimetype = String(file.mimetype || '').toLowerCase();

  if (mimetype === 'application/pdf' || extension === '.pdf') {
    return extractPdfText(file.buffer);
  }

  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    extension === '.docx'
  ) {
    return extractDocxText(file.buffer);
  }

  if (mimetype === 'application/msword' || extension === '.doc') {
    const tmpPath = path.join(os.tmpdir(), `agreement-${randomUUID()}${extension || '.doc'}`);
    try {
      fs.writeFileSync(tmpPath, file.buffer);
      return await extractDocText(tmpPath);
    } finally {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        /* ignore */
      }
    }
  }

  if (mimetype === 'text/plain' || extension === '.txt') {
    return cleanDocumentText(file.buffer.toString('utf8'));
  }

  throw new Error('Unsupported file type. Upload PDF, DOC, or DOCX.');
}
