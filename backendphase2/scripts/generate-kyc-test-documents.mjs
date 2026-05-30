/**
 * Generates sample KYC test files (Excel + PDF) for the KYC parse pipeline.
 * Run: node scripts/generate-kyc-test-documents.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../docs/templates/kyc-test');

const KYC_ROWS = [
  ['SAASA B2E - KYC Form (Test Document)'],
  ['For clients with post-service payment terms.'],
  [],
  ['1. Client Information'],
  ['Company Name', 'SummitSphere Media Pvt Ltd'],
  ['Trade Name (if any)', 'SummitSphere'],
  ['Type of Entity', 'LLC'],
  ['Date of Incorporation', '2019-03-15'],
  ['Country of Incorporation', 'India'],
  ['Legal Registration Number', 'U72900MH2019PTC325841'],
  ['Tax ID / VAT Number', '27AABCS1429B1ZM'],
  ['Website', 'https://www.summitspheremedia.com'],
  ['Business Address', 'Level 4, Cyber Towers, Hitech City, Hyderabad, Telangana 500081'],
  ['Primary Contact Person', 'Priya Sharma'],
  ['Contact Designation', 'HR Director'],
  ['Email (Official)', 'hr@summitspheremedia.com'],
  ['Phone Number', '+91 40 6789 1234'],
  [],
  ['2. Authorized Signatory / General Manager Details'],
  ['Full Name', 'Rajesh Kumar Mehta'],
  ['Designation', 'General Manager'],
  ['Nationality', 'Indian'],
  ['Date of Birth', '1985-07-22'],
  ['ID Type', 'Passport'],
  ['ID Number', 'P1234567'],
  ['Issue Date', '2020-01-10'],
  ['Expiry Date', '2030-01-09'],
  ['Email', 'rajesh.mehta@summitspheremedia.com'],
  ['Phone', '+91 98 7654 3210'],
  [],
  ['3. Shareholder / Beneficial Owner Information'],
  ['Shareholder 1'],
  ['Full Name', 'Anita Desai'],
  ['Nationality', 'Indian'],
  ['Ownership %', '60'],
  ['Passport Number', 'K9876543'],
  ['Passport Expiry Date', '2028-11-30'],
  ['Shareholder 2'],
  ['Full Name', 'Vikram Singh'],
  ['Nationality', 'Indian'],
  ['Ownership %', '40'],
  ['Passport Number', 'L1122334'],
  ['Passport Expiry Date', '2029-06-15'],
  [],
  ['4. Bank Account Details'],
  ['Bank Name', 'HDFC Bank'],
  ['Account Holder Name', 'SummitSphere Media Pvt Ltd'],
  ['Account Number', '50200012345678'],
  ['IBAN', 'AE070331234567890123456'],
  ['SWIFT / BIC Code', 'HDFCINBB'],
  ['Currency', 'INR'],
  ['Bank Address', 'Banjara Hills Branch, Road No. 12, Hyderabad'],
  [],
  ['5. Attachments Checklist (Mandatory)'],
  ['Shareholder Passport Copy', 'Yes — attached'],
  ['General Manager ID Card / Passport', 'Yes — attached'],
  ['Company Document', 'Yes — provided'],
  ['Bank Account Proof', 'Yes — enclosed'],
  [],
  ['6. Declaration & Undertaking'],
  ['Authorized Signatory Name', 'Rajesh Kumar Mehta'],
  ['Date', '2026-05-29'],
];

function buildPdfLines() {
  const lines = [];
  for (const row of KYC_ROWS) {
    if (!row.length) {
      lines.push('');
      continue;
    }
    if (row.length === 1) {
      lines.push(row[0]);
      continue;
    }
    lines.push(`${row[0]}: ${row[1]}`);
  }
  return lines;
}

function writeExcel() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(KYC_ROWS);
  ws['!cols'] = [{ wch: 42 }, { wch: 52 }];
  XLSX.utils.book_append_sheet(wb, ws, 'KYC Form');
  const filePath = path.join(OUT_DIR, 'SAASA_B2E_KYC_Form_TEST.xlsx');
  XLSX.writeFile(wb, filePath);
  return filePath;
}

async function writePdf() {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontSize = 10;
  const lineHeight = 14;
  const marginX = 48;
  const marginTop = 740;
  const maxWidth = 520;

  let page = pdfDoc.addPage([612, 792]);
  let y = marginTop;

  const wrapLine = (text, useBold = false) => {
    const activeFont = useBold ? bold : font;
    const words = String(text).split(' ');
    let line = '';
    const out = [];
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (activeFont.widthOfTextAtSize(test, fontSize) > maxWidth) {
        if (line) out.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) out.push(line);
    return out.length ? out : [''];
  };

  const drawLines = (text, useBold = false) => {
    const chunks = wrapLine(text, useBold);
    for (const chunk of chunks) {
      if (y < 48) {
        page = pdfDoc.addPage([612, 792]);
        y = marginTop;
      }
      page.drawText(chunk, {
        x: marginX,
        y,
        size: fontSize,
        font: useBold ? bold : font,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= lineHeight;
    }
  };

  for (const row of KYC_ROWS) {
    if (!row.length) {
      y -= 6;
      continue;
    }
    if (row.length === 1) {
      const heading = /^(\d+\.|SAASA)/.test(row[0]);
      drawLines(row[0], heading);
      y -= heading ? 4 : 0;
      continue;
    }
    drawLines(`${row[0]}: ${row[1]}`);
  }

  const bytes = await pdfDoc.save();
  const filePath = path.join(OUT_DIR, 'SAASA_B2E_KYC_Form_TEST.pdf');
  fs.writeFileSync(filePath, bytes);
  return filePath;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const xlsxPath = writeExcel();
  const pdfPath = await writePdf();
  console.log('Created KYC test documents:');
  console.log('  Excel:', xlsxPath);
  console.log('  PDF:  ', pdfPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
