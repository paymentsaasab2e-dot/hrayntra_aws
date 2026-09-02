import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';

export function cleanDocumentText(text = '') {
  const repaired = repairBrokenPdfLines(String(text || ''));
  return repaired
    .replace(/\u0000/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \u00a0]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** pdf-parse sometimes emits one character/word per line; join those back into prose. */
function repairBrokenPdfLines(text = '') {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 30) return String(text || '');
  const short = lines.filter((line) => line.length <= 2).length;
  if (short / lines.length < 0.5) return String(text || '');
  return lines.join('');
}

function significantTextLength(text = '') {
  return String(text || '').replace(/\s+/g, '').length;
}

async function ocrPdfBuffer(buffer) {
  try {
    const pdfParseModule = await import('pdf-parse');
    const PDFParse = pdfParseModule.PDFParse;
    if (typeof PDFParse !== 'function') return '';
    const { createWorker } = await import('tesseract.js');
    const parser = new PDFParse({ data: Buffer.from(buffer) });
    let worker;
    try {
      worker = await createWorker('eng');
      const screenshot = await parser.getScreenshot({
        first: 12,
        scale: 2,
        imageBuffer: true,
        imageDataUrl: false,
      });
      const chunks = [];
      for (const page of screenshot.pages || []) {
        if (!page?.data?.length) continue;
        const {
          data: { text },
        } = await worker.recognize(Buffer.from(page.data));
        chunks.push(String(text || '').trim());
      }
      return cleanDocumentText(chunks.filter(Boolean).join('\n'));
    } finally {
      if (worker && typeof worker.terminate === 'function') {
        try {
          await worker.terminate();
        } catch {
          /* ignore */
        }
      }
      if (typeof parser.destroy === 'function') {
        try {
          await parser.destroy();
        } catch {
          /* ignore */
        }
      }
    }
  } catch (error) {
    console.error('[document-extract] PDF OCR failed:', error?.message || error);
    return '';
  }
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

export async function extractPdfText(buffer) {
  const pdfParse = await getPdfParseFn();
  const pdfData = await pdfParse(buffer);
  return cleanDocumentText(pdfData?.text || '');
}

/** Text-layer first; OCR scanned/image PDFs when native extract is too thin. */
export async function extractPdfTextWithOcrFallback(buffer) {
  let text = '';
  try {
    text = await extractPdfText(buffer);
  } catch (error) {
    console.warn('[document-extract] pdf-parse failed:', error?.message || error);
  }
  if (significantTextLength(text) >= 120) return text;
  const ocr = await ocrPdfBuffer(buffer);
  if (significantTextLength(ocr) > significantTextLength(text)) {
    return cleanDocumentText([text, ocr].filter(Boolean).join('\n\n'));
  }
  return text || ocr || '';
}

export async function extractDocxText(buffer) {
  const mammothModule = await import('mammoth');
  const mammoth = mammothModule.default || mammothModule;
  const result = await mammoth.extractRawText({ buffer });
  return cleanDocumentText(result?.value || '');
}

export async function extractDocText(filePath) {
  const wordExtractorModule = await import('word-extractor');
  const WordExtractor = wordExtractorModule.default || wordExtractorModule;
  const extractor = new WordExtractor();
  const doc = await extractor.extract(filePath);
  return cleanDocumentText(doc.getBody() || '');
}

export async function readFileBuffer(file) {
  if (file?.buffer?.length) {
    return file.buffer;
  }
  const filePath = String(file?.path || '').trim();
  if (filePath && fs.existsSync(filePath)) {
    return fs.readFileSync(filePath);
  }
  return null;
}

/**
 * Extract plain text from an uploaded agreement file (multer memory file).
 */
export async function extractDocumentTextFromUpload(file) {
  const buffer = await readFileBuffer(file);
  if (!buffer?.length) {
    throw new Error('No file data received');
  }

  const extension = extensionOf(file);
  const mimetype = String(file.mimetype || '').toLowerCase();

  if (mimetype === 'application/pdf' || extension === '.pdf') {
    return extractPdfTextWithOcrFallback(buffer);
  }

  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    extension === '.docx'
  ) {
    return extractDocxText(buffer);
  }

  if (mimetype === 'application/msword' || extension === '.doc') {
    const tmpPath = path.join(os.tmpdir(), `agreement-${randomUUID()}${extension || '.doc'}`);
    try {
      fs.writeFileSync(tmpPath, buffer);
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
    return cleanDocumentText(buffer.toString('utf8'));
  }

  throw new Error('Unsupported file type. Upload PDF, DOC, or DOCX.');
}
