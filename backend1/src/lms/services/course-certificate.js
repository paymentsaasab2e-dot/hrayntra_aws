const CERTIFICATE_PRESETS = [
  { id: 'classic-gold', label: 'Classic gold' },
  { id: 'modern-minimal', label: 'Modern minimal' },
  { id: 'technical-badge', label: 'Technical badge' },
];

const CERTIFICATE_FONT_FAMILIES = {
  serif: 'Georgia, "Times New Roman", serif',
  sans: 'Inter, system-ui, sans-serif',
  display: '"Palatino Linotype", Palatino, "Book Antiqua", serif',
  modern: 'Arial, Helvetica, sans-serif',
};

const DEFAULT_CERTIFICATE_SLOTS = {
  learnerName: { x: 50, y: 46, fontSize: 42, color: '#0f172a', align: 'center', fontFamily: 'serif' },
  courseTitle: { x: 50, y: 58, fontSize: 20, color: '#334155', align: 'center', fontFamily: 'serif' },
  instructorName: { x: 50, y: 68, fontSize: 14, color: '#475569', align: 'center', fontFamily: 'sans' },
  completedAt: { x: 28, y: 82, fontSize: 13, color: '#475569', align: 'left', fontFamily: 'sans' },
  certificateId: { x: 72, y: 82, fontSize: 12, color: '#64748b', align: 'right', fontFamily: 'sans' },
};

const SLOT_KEYS = Object.keys(DEFAULT_CERTIFICATE_SLOTS);

function clampNum(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function slotFrom(raw, key) {
  const base = DEFAULT_CERTIFICATE_SLOTS[key];
  const row = raw && typeof raw === 'object' ? raw[key] : null;
  const fontFamily = String(row?.fontFamily || base.fontFamily || 'serif').trim();
  return {
    x: clampNum(row?.x, 0, 100, base.x),
    y: clampNum(row?.y, 0, 100, base.y),
    fontSize: clampNum(row?.fontSize, 8, 96, base.fontSize),
    color: String(row?.color || base.color).trim() || base.color,
    align: ['left', 'center', 'right'].includes(String(row?.align || ''))
      ? String(row.align)
      : base.align,
    fontFamily: CERTIFICATE_FONT_FAMILIES[fontFamily] ? fontFamily : base.fontFamily || 'serif',
  };
}

function normalizeCertificateConfig(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const mode = String(input.mode || '').trim() === 'uploaded' ? 'uploaded' : 'preset';
  const presetId = CERTIFICATE_PRESETS.some((p) => p.id === input.presetId)
    ? input.presetId
    : 'classic-gold';
  const slots = {};
  for (const key of SLOT_KEYS) slots[key] = slotFrom(input.slots, key);
  return {
    mode,
    presetId,
    backgroundUrl: String(input.backgroundUrl || '').trim() || null,
    slots,
  };
}

function normalizeCheckpoints(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((row, index) => {
      const typeRaw = String(row?.type || '').trim().toLowerCase();
      const type = ['quiz', 'assignment', 'manual'].includes(typeRaw) ? typeRaw : null;
      if (!type) return null;
      const title = String(row?.title || '').trim() || `Checkpoint ${index + 1}`;
      const id = String(row?.id || '').trim() || `cp-${index + 1}`;
      return {
        id,
        type,
        title,
        order: Number.isFinite(Number(row?.order)) ? Number(row.order) : index + 1,
        required: row?.required === false ? false : true,
        afterLessonId: String(row?.afterLessonId || '').trim() || null,
        quizId: String(row?.quizId || '').trim() || null,
        passPercent: clampNum(row?.passPercent, 0, 100, 70),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);
}

function generateCertificateId(courseTitle) {
  const slug = String(courseTitle || 'COURSE')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 6) || 'COURSE';
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `HYC-${slug}-${stamp}-${rand}`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toLocaleDateString();
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function slotStyle(slot) {
  const transform =
    slot.align === 'center' ? 'translate(-50%, -50%)' : slot.align === 'right' ? 'translate(-100%, -50%)' : 'translate(0, -50%)';
  const textAlign = slot.align;
  const family = CERTIFICATE_FONT_FAMILIES[slot.fontFamily] || CERTIFICATE_FONT_FAMILIES.serif;
  return `position:absolute;left:${slot.x}%;top:${slot.y}%;transform:${transform};text-align:${textAlign};font-size:${slot.fontSize}px;color:${slot.color};font-family:${family};width:70%;line-height:1.2;font-weight:700;`;
}

function presetShell(presetId, inner) {
  if (presetId === 'modern-minimal') {
    return `<div class="sheet modern">${inner}</div>`;
  }
  if (presetId === 'technical-badge') {
    return `<div class="sheet technical">${inner}</div>`;
  }
  return `<div class="sheet classic">${inner}</div>`;
}

function pageCss() {
  return `
  @page { size: A4 landscape; margin: 0; }
  html, body { margin: 0; padding: 0; width: 297mm; height: 210mm; overflow: hidden; background: #fff; }
  .page { position: relative; width: 297mm; height: 210mm; overflow: hidden; box-sizing: border-box; }
  .page img.bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
  .classic { background: radial-gradient(circle at 50% 30%, #fffbeb, #fff); border: 14px solid #b45309; box-shadow: inset 0 0 0 4px #fbbf24; color: #7c2d12; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 28mm; font-family: Georgia, "Times New Roman", serif; }
  .modern { background: #fff; border: 1px solid #cbd5e1; color: #0f172a; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 28mm; font-family: Inter, system-ui, sans-serif; }
  .technical { background: linear-gradient(160deg, #0f172a, #1e293b); color: #e2e8f0; border: 10px solid #38bdf8; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 28mm; font-family: Inter, system-ui, sans-serif; }
  .kicker { letter-spacing: .28em; text-transform: uppercase; font-size: 12px; margin: 0 0 16px; }
  h1 { font-size: 42px; margin: 0 0 10px; }
  h2 { font-size: 22px; margin: 8px 0 20px; font-weight: 600; }
  .lead { margin: 0; opacity: .8; }
  .meta, .id { font-size: 13px; opacity: .85; }
`;
}

function renderCertificateHtml(payload) {
  const name = escapeHtml(payload.learnerName || 'Learner');
  const course = escapeHtml(payload.courseTitle || 'Course');
  const instructor = escapeHtml(payload.instructorName || 'HRYantra HQ');
  const issued = formatDate(payload.completedAt);
  const certId = escapeHtml(payload.certificateId || 'HYC-DRAFT');
  const config = normalizeCertificateConfig(payload.certificate);

  if (config.mode === 'uploaded' && config.backgroundUrl) {
    const slots = config.slots;
    return `<!doctype html>
<html><head><meta charset="utf-8"/><title>Certificate ${certId}</title>
<style>${pageCss()}</style></head>
<body>
  <div class="page">
    <img class="bg" src="${escapeHtml(config.backgroundUrl)}" alt=""/>
    <div style="${slotStyle(slots.learnerName)}">${name}</div>
    <div style="${slotStyle(slots.courseTitle)};font-weight:600">${course}</div>
    <div style="${slotStyle(slots.instructorName)};font-weight:500">Signed, ${instructor}</div>
    <div style="${slotStyle(slots.completedAt)};font-weight:500">${issued}</div>
    <div style="${slotStyle(slots.certificateId)};font-weight:500">${certId}</div>
  </div>
</body></html>`;
  }

  const inner = `
    <p class="kicker">Certificate of completion</p>
    <h1>${name}</h1>
    <p class="lead">has successfully completed</p>
    <h2>${course}</h2>
    <p class="meta">Issued ${issued} · ${instructor}</p>
    <p class="id">${certId}</p>
  `;

  return `<!doctype html>
<html><head><meta charset="utf-8"/><title>Certificate ${certId}</title>
<style>${pageCss()}</style></head>
<body>
  ${presetShell(config.presetId, inner).replace('class="sheet ', 'class="page ')}
</body></html>`;
}

async function renderCertificatePdf(payload) {
  const { launchBrowser } = require('../../utils/puppeteerLaunch.util');
  const html = renderCertificateHtml(payload);
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1123, height: 794, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 45000 });
    await page.evaluate(async () => {
      await Promise.all(
        Array.from(document.images).map(
          (img) =>
            img.complete ||
            new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve;
            }),
        ),
      );
    });
    return await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  } finally {
    await browser.close();
  }
}

module.exports = {
  CERTIFICATE_PRESETS,
  DEFAULT_CERTIFICATE_SLOTS,
  normalizeCertificateConfig,
  normalizeCheckpoints,
  generateCertificateId,
  renderCertificateHtml,
  renderCertificatePdf,
};

