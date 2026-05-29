/**
 * Robust PDF text extraction for Node (CommonJS).
 * pdf-parse@1.x bundles old pdf.js and often fails with "bad XRef entry" on modern exports.
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const pdfParse = require('pdf-parse');

function bufferToUint8Array(buffer) {
  if (!buffer || !buffer.length) return new Uint8Array(0);
  if (buffer instanceof Uint8Array && !Buffer.isBuffer(buffer)) return buffer;
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

function isRecoverablePdfParseError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    msg.includes('xref') ||
    msg.includes('formaterror') ||
    msg.includes('invalid pdf') ||
    msg.includes('corrupt') ||
    msg.includes('password') ||
    msg.includes('encrypted')
  );
}

async function extractWithPdfParseV1(buffer) {
  const data = await pdfParse(buffer);
  return String(data?.text || '').trim();
}

/** pdf-parse v2 API when installed transitively or upgraded later. */
async function extractWithPdfParseV2(buffer) {
  const mod = require('pdf-parse');
  const PDFParse = mod?.PDFParse;
  if (typeof PDFParse !== 'function') return '';

  const parser = new PDFParse({ data: Buffer.from(buffer) });
  try {
    const result = await parser.getText({
      lineEnforce: false,
      itemJoiner: ' ',
    });
    return String(result?.text || '').trim();
  } finally {
    if (typeof parser.destroy === 'function') await parser.destroy();
  }
}

let cachedWorkerHref = null;

function getPdfJsWorkerHref() {
  if (cachedWorkerHref !== null) return cachedWorkerHref;
  try {
    const pkgJson = require.resolve('pdfjs-dist/package.json');
    const workerAbs = path.join(path.dirname(pkgJson), 'legacy', 'build', 'pdf.worker.mjs');
    if (!fs.existsSync(workerAbs)) {
      cachedWorkerHref = '';
      return '';
    }
    cachedWorkerHref = pathToFileURL(workerAbs).href;
    return cachedWorkerHref;
  } catch {
    cachedWorkerHref = '';
    return '';
  }
}

async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const href = getPdfJsWorkerHref();
  if (pdfjs.GlobalWorkerOptions && href) {
    pdfjs.GlobalWorkerOptions.workerSrc = href;
  }
  return pdfjs;
}

async function runWithIsolatedPdfJsWorker(run) {
  const saved = globalThis.pdfjsWorker;
  try {
    delete globalThis.pdfjsWorker;
    return await run(await loadPdfJs());
  } finally {
    if (saved !== undefined) globalThis.pdfjsWorker = saved;
    else delete globalThis.pdfjsWorker;
  }
}

async function extractWithPdfJs(buffer) {
  const uint8 = bufferToUint8Array(buffer);

  return runWithIsolatedPdfJsWorker(async (pdfjs) => {
    const pdf = await pdfjs.getDocument({
      data: uint8,
      verbosity: 0,
      useSystemFonts: true,
      isEvalSupported: false,
      disableAutoFetch: true,
      disableStream: true,
    }).promise;

    try {
      let acc = '';
      for (let p = 1; p <= pdf.numPages; p += 1) {
        const page = await pdf.getPage(p);
        const textContent = await page.getTextContent({
          normalizeWhitespace: true,
          includeMarkedContent: true,
        });
        let pageText = '';
        for (const item of textContent.items || []) {
          if (item?.str !== undefined && item.str !== null) {
            pageText += item.str;
            if (item.hasEOL) pageText += '\n';
            else pageText += ' ';
          }
        }
        const line = pageText.trim();
        if (line) acc += acc ? `\n${line}` : line;
      }
      return acc.trim();
    } finally {
      if (typeof pdf.destroy === 'function') await pdf.destroy();
    }
  });
}

/**
 * Extract text from a PDF buffer using multiple engines.
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
async function extractPdfText(buffer) {
  if (!buffer?.length) {
    throw new Error('PDF file is empty');
  }

  const attempts = [];

  try {
    const text = await extractWithPdfParseV1(buffer);
    if (text.length > 0) {
      return { text, engine: 'pdf-parse' };
    }
    attempts.push('pdf-parse: no text');
  } catch (err) {
    attempts.push(`pdf-parse: ${err.message}`);
    if (!isRecoverablePdfParseError(err)) {
      // Still try fallbacks for unknown errors
    }
  }

  try {
    const text = await extractWithPdfParseV2(buffer);
    if (text.length > 0) {
      return { text, engine: 'pdf-parse-v2' };
    }
    attempts.push('pdf-parse-v2: no text');
  } catch (err) {
    attempts.push(`pdf-parse-v2: ${err.message}`);
  }

  try {
    const text = await extractWithPdfJs(buffer);
    if (text.length > 0) {
      return { text, engine: 'pdfjs-dist' };
    }
    attempts.push('pdfjs-dist: no text');
  } catch (err) {
    attempts.push(`pdfjs-dist: ${err.message}`);
  }

  const detail = attempts.join('; ');
  throw new Error(
    `Could not extract text from this PDF (${detail}). Try re-exporting the resume as PDF from Word, or upload a DOCX file.`
  );
}

module.exports = {
  extractPdfText,
  extractWithPdfJs,
};
