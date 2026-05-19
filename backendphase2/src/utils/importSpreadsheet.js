import * as XLSX from 'xlsx';

/** Prefer data sheet over instruction/definition tabs in CRM templates */
export function pickImportWorksheet(workbook) {
  if (!workbook?.SheetNames?.length) return { sheetName: '', sheet: null };

  const names = workbook.SheetNames;
  const preferred = names.find((name) => /template\s*data|import\s*data|leads?\s*data/i.test(name));
  if (preferred) return { sheetName: preferred, sheet: workbook.Sheets[preferred] };

  const skipDefs = names.find((name) => !/field\s*definitions?|instructions?|readme|legend/i.test(name));
  const sheetName = skipDefs || names[0];
  return { sheetName, sheet: workbook.Sheets[sheetName] };
}

export function isImportRowEmpty(row) {
  if (!row || typeof row !== 'object') return true;
  return !Object.values(row).some((value) => {
    if (value == null) return false;
    return String(value).trim() !== '';
  });
}

/** Excel exports often include thousands of trailing empty headers (Column17, Column18, …) */
export function isMeaninglessImportColumn(name) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return true;
  if (/^column\d+$/i.test(trimmed)) return true;
  if (/^__empty/i.test(trimmed)) return true;
  return false;
}

/** Keep only columns that have at least one non-empty value in the dataset */
export function filterMeaningfulImportColumns(columns, rows = []) {
  const meaningful = columns.filter((col) => !isMeaninglessImportColumn(col));
  if (!rows.length) return meaningful;

  return meaningful.filter((col) =>
    rows.some((row) => {
      const value = row?.[col];
      if (value === null || value === undefined) return false;
      return String(value).trim() !== '';
    })
  );
}

/** Drop empty generic columns from each row (shrinks import API payload) */
export function slimImportRows(rows, columns) {
  const allowed = new Set(columns);
  return rows.map((row) => {
    const slim = {};
    for (const key of allowed) {
      if (key in row) slim[key] = row[key];
    }
    return slim;
  });
}

/** Parse sheet to JSON rows, skipping blank lines and trailing empty Excel range rows */
export function parseImportSheetRows(sheet, { defval = null } = {}) {
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json(sheet, { defval, blankrows: false });
  return rows.filter((row) => !isImportRowEmpty(row));
}
