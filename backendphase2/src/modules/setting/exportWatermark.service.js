import {
  deleteOtherOrgSettingRows,
  findOrgSettingRow,
  upsertOrgSettingJson,
} from './orgSettingStore.util.js';

export const KEY_EXPORT_WATERMARK = 'exportWatermark';

export const DEFAULT_EXPORT_WATERMARK = {
  enabled: false,
  text: '',
  imageUrl: '',
  opacity: 0.18,
  applyToPdf: true,
  applyToExcel: true,
  applyToCsv: true,
};

function clampOpacity(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_EXPORT_WATERMARK.opacity;
  return Math.min(0.5, Math.max(0.05, n));
}

export function normalizeExportWatermark(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const text = String(input.text || '').trim().slice(0, 120);
  const imageUrl = String(input.imageUrl || input.logoUrl || '').trim();
  const hasContent = text.length > 0 || imageUrl.length > 0;
  return {
    enabled: Boolean(input.enabled) && hasContent,
    text,
    imageUrl,
    opacity: clampOpacity(input.opacity),
    applyToPdf: input.applyToPdf !== false,
    applyToExcel: input.applyToExcel !== false,
    applyToCsv: input.applyToCsv !== false,
  };
}

export async function getExportWatermark() {
  const row = await findOrgSettingRow(KEY_EXPORT_WATERMARK);
  return normalizeExportWatermark(row?.value);
}

export async function setExportWatermark(payload) {
  const normalized = normalizeExportWatermark(payload);
  const keptId = await upsertOrgSettingJson(KEY_EXPORT_WATERMARK, normalized);
  await deleteOtherOrgSettingRows(KEY_EXPORT_WATERMARK, keptId).catch(() => {});
  return getExportWatermark();
}

/** Active watermark text for a given export format, or empty string when off. */
export function watermarkTextForFormat(settings, format) {
  const cfg = normalizeExportWatermark(settings);
  if (!cfg.enabled) return '';
  const fmt = String(format || '').toLowerCase();
  if (fmt === 'pdf' && !cfg.applyToPdf) return '';
  if ((fmt === 'excel' || fmt === 'xlsx') && !cfg.applyToExcel) return '';
  if (fmt === 'csv' && !cfg.applyToCsv) return '';
  if (cfg.text) return cfg.text;
  // CSV/text only — Excel embeds the logo image instead of this placeholder.
  if (cfg.imageUrl && (fmt === 'csv' || fmt === 'text')) return '[logo watermark]';
  return '';
}

/** Prepend a confidential/watermark header line for CSV/Excel row dumps. */
export function prependWatermarkRows(rows, watermarkText) {
  const text = String(watermarkText || '').trim();
  if (!text || !Array.isArray(rows) || rows.length === 0) return rows;
  const first = rows[0];
  if (!first || typeof first !== 'object') return rows;
  const keys = Object.keys(first);
  if (!keys.length) return rows;
  const stamp = {};
  keys.forEach((key, index) => {
    stamp[key] = index === 0 ? `WATERMARK: ${text}` : '';
  });
  return [stamp, ...rows];
}

export function prependWatermarkCsv(csvText, watermarkText) {
  const text = String(watermarkText || '').trim();
  if (!text) return csvText;
  const line = `"WATERMARK: ${String(text).replace(/"/g, '""')}"`;
  return `${line}\n${csvText || ''}`;
}
