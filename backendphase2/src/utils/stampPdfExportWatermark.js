import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';

/**
 * Stamp a PDF buffer with org export watermark (text and/or logo imageDataUrl).
 * Returns original buffer when watermark is off or file is not a PDF.
 */
export async function stampPdfBufferWithExportWatermark(buffer, watermark) {
  const input = buffer instanceof Buffer ? buffer : Buffer.from(buffer || []);
  if (!input.length) return input;

  const cfg = watermark && typeof watermark === 'object' ? watermark : {};
  const enabled = Boolean(cfg.enabled);
  const applyToPdf = cfg.applyToPdf !== false;
  const text = String(cfg.text || '').trim();
  const imageDataUrl = String(cfg.imageDataUrl || '').trim();
  const imageUrl = String(cfg.imageUrl || '').trim();
  if (!enabled || !applyToPdf) return input;
  if (!text && !imageDataUrl.startsWith('data:image/') && !imageUrl) return input;

  // Only stamp PDF payloads.
  const head = input.subarray(0, 5).toString('utf8');
  if (!head.startsWith('%PDF')) return input;

  // Already stamped on a previous open — do not paint a second layer.
  if (input.includes('HryantraWm:stamped')) return input;

  // Older HRYantra exports already have a watermark in the page image and
  // were written by pdf-lib. Stamping those again stacks a second copy.
  // New exports are tagged HryantraWm:clean so they still receive one stamp.
  const producedByPdfLib = input.includes('pdf-lib');
  const explicitlyClean = input.includes('HryantraWm:clean');
  if (producedByPdfLib && !explicitlyClean) return input;

  try {
    const pdfDoc = await PDFDocument.load(input, { ignoreEncryption: true });
    pdfDoc.setKeywords(['HryantraWm:stamped']);
    const pages = pdfDoc.getPages();
    if (!pages.length) return input;

    const opacity = Math.min(0.5, Math.max(0.05, Number(cfg.opacity) || 0.18));
    let embeddedImage = null;

    const dataUrl = imageDataUrl.startsWith('data:image/') ? imageDataUrl : '';
    if (dataUrl) {
      try {
        const base64 = dataUrl.split(',')[1] || '';
        const bytes = Buffer.from(base64, 'base64');
        const isPng = /^data:image\/png/i.test(dataUrl) || bytes[0] === 0x89;
        embeddedImage = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
      } catch (err) {
        console.warn('[stampPdf] logo embed failed:', err?.message || err);
      }
    }

    let font = null;
    if (text) {
      try {
        font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      } catch {
        font = null;
      }
    }

    for (const page of pages) {
      const { width, height } = page.getSize();
      if (embeddedImage) {
        try {
          const imgW = Math.min(width * 0.4, 220);
          const imgH = (embeddedImage.height / Math.max(1, embeddedImage.width)) * imgW;
          page.drawImage(embeddedImage, {
            x: (width - imgW) / 2,
            y: (height - imgH) / 2,
            width: imgW,
            height: imgH,
            opacity,
            rotate: degrees(35),
          });
        } catch (err) {
          console.warn('[stampPdf] drawImage failed:', err?.message || err);
        }
      }
      if (text && font && !embeddedImage) {
        try {
          const size = Math.max(18, Math.min(48, Math.floor(width / 8)));
          page.drawText(text, {
            x: width * 0.18,
            y: height * 0.42 - (embeddedImage ? 40 : 0),
            size,
            font,
            rotate: degrees(35),
            opacity,
            color: rgb(0.45, 0.47, 0.55),
          });
        } catch (err) {
          console.warn('[stampPdf] drawText failed:', err?.message || err);
        }
      }
    }

    const out = await pdfDoc.save();
    return Buffer.from(out);
  } catch (err) {
    console.warn('[stampPdf] watermark stamp failed:', err?.message || err);
    return input;
  }
}
