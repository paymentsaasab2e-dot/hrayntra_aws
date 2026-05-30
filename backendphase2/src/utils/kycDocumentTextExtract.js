import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import * as XLSX from 'xlsx';
import {
  cleanDocumentText,
  extractDocText,
  extractDocxText,
  extractPdfText,
  readFileBuffer,
} from './documentTextExtract.js';

function extensionOf(file = {}) {
  return path.extname(file.originalname || file.filename || '').toLowerCase();
}

function extractSpreadsheetText(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const lines = [];

  for (const sheetName of workbook.SheetNames) {
    lines.push(`Sheet: ${sheetName}`);
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    for (const row of rows) {
      const cells = row.map((cell) => String(cell ?? '').trim()).filter(Boolean);
      if (!cells.length) continue;
      lines.push(cells.join(' | '));
      if (cells.length === 2) {
        lines.push(`${cells[0]}: ${cells[1]}`);
      }
    }
  }

  return cleanDocumentText(lines.join('\n'));
}

/**
 * Extract plain text from KYC uploads (PDF, Word, Excel, plain text).
 * Images return empty text — use AI or manual entry for scanned IDs.
 */
export async function extractKycDocumentTextFromUpload(file) {
  const buffer = await readFileBuffer(file);
  if (!buffer?.length) {
    throw new Error('No file data received');
  }

  const extension = extensionOf(file);
  const mimetype = String(file.mimetype || '').toLowerCase();

  if (mimetype === 'application/pdf' || extension === '.pdf') {
    return { text: await extractPdfText(buffer), sourceType: 'pdf' };
  }

  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    extension === '.docx'
  ) {
    return { text: await extractDocxText(buffer), sourceType: 'docx' };
  }

  if (mimetype === 'application/msword' || extension === '.doc') {
    const tmpPath = path.join(os.tmpdir(), `kyc-${randomUUID()}${extension || '.doc'}`);
    try {
      fs.writeFileSync(tmpPath, buffer);
      return { text: await extractDocText(tmpPath), sourceType: 'doc' };
    } finally {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        /* ignore */
      }
    }
  }

  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimetype === 'application/vnd.ms-excel' ||
    extension === '.xlsx' ||
    extension === '.xls'
  ) {
    return { text: extractSpreadsheetText(buffer), sourceType: 'excel' };
  }

  if (mimetype === 'text/plain' || extension === '.txt' || extension === '.csv') {
    return { text: cleanDocumentText(buffer.toString('utf8')), sourceType: 'text' };
  }

  if (
    mimetype.startsWith('image/') ||
    ['.jpg', '.jpeg', '.png', '.webp'].includes(extension)
  ) {
    return { text: '', sourceType: 'image' };
  }

  throw new Error('Unsupported file type. Upload PDF, DOC, DOCX, XLS, XLSX, or an image.');
}
