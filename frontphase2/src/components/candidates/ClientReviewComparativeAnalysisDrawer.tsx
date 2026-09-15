'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, type Variants } from 'motion/react';
import { Columns2, FileSpreadsheet, FileText, Loader2, Printer, X } from 'lucide-react';
import type { ClientReviewBatchRow, ClientReviewData } from '../../lib/clientReviewTypes';
import type { ClientReviewSection } from '../../lib/clientPresentationSections';
import {
  isSubmitToClientReviewFieldVisible,
  SUBMIT_TO_CLIENT_FIELD_GROUPS,
  type SubmitToClientFieldId,
} from '../../lib/submitToClientFieldVisibility';
import { normalizeClientTrackerOptions } from '../../lib/clientTrackerOptions';

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Single motion root — nested exit without remount flash (same as DetailsModalShell). */
const shellVariants: Variants = {
  hidden: { transition: { when: 'afterChildren', duration: 0.01 } },
  visible: { transition: { when: 'beforeChildren', staggerChildren: 0 } },
};

const backdropVariants: Variants = {
  hidden: { opacity: 0, transition: { duration: 0.16, ease: EASE_OUT } },
  visible: { opacity: 1, transition: { duration: 0.16, ease: EASE_OUT } },
};

/** Panel transforms only — opacity fades cause a white flicker. */
const panelVariants: Variants = {
  hidden: { y: 18, transition: { duration: 0.18, ease: EASE_OUT } },
  visible: { y: 0, transition: { duration: 0.2, ease: EASE_OUT } },
};

type Props = {
  open: boolean;
  rows: ClientReviewBatchRow[];
  jobTitle?: string;
  clientName?: string;
  onClose: () => void;
};

type CompareParam =
  | { kind: 'section'; id: string; label: string }
  | {
      kind: 'field';
      id: string;
      label: string;
      emphasize?: boolean;
      valuesByMatchId: Record<string, string>;
    };

function displayValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    if (!value.length) return '';
    const parts = value
      .map((item) => {
        if (item == null) return '';
        if (typeof item === 'string' || typeof item === 'number') return String(item).trim();
        if (typeof item === 'object') {
          const record = item as Record<string, unknown>;
          return (
            displayValue(record.label) ||
            displayValue(record.name) ||
            displayValue(record.title) ||
            displayValue(record.value) ||
            ''
          );
        }
        return String(item).trim();
      })
      .filter(Boolean);
    return parts.join(', ');
  }
  if (typeof value === 'object') {
    try {
      const text = JSON.stringify(value).trim();
      if (!text || text === '{}' || text === '[]' || text === 'null') return '';
    } catch {
      return '';
    }
  }
  const text = String(value).trim();
  if (!text) return '';
  const lower = text.toLowerCase();
  if (
    lower === 'null' ||
    lower === 'undefined' ||
    lower === 'n/a' ||
    lower === '-' ||
    lower === '—' ||
    lower === '[]' ||
    lower === '{}' ||
    lower === 'none' ||
    lower === 'not available'
  ) {
    return '';
  }
  // Presentation payloads sometimes store empty lists as the literal "[]".
  if (/^\[\s*\]$/.test(text) || /^\{\s*\}$/.test(text)) return '';
  return text;
}

function cell(value: unknown): string {
  return displayValue(value) || '—';
}

function isEmptyCompareValue(value: unknown): boolean {
  const text = displayValue(value);
  return !text;
}

/** Permanently hide sensitive / non-compare rows (not empty-value filtering). */
function isPermanentlyHiddenCompareLabel(label: string, value = ''): boolean {
  const key = String(label || '')
    .trim()
    .toLowerCase();
  if (!key) return true;
  if (key === 'resume url' || key === 'file url') return true;
  if (key === 'candidate image' || key === 'avatar') return true;
  if (key.includes('url') && /amazonaws\.com|\/uploads\//i.test(value)) return true;
  return false;
}

function shouldHideField(label: string, value: string): boolean {
  return isPermanentlyHiddenCompareLabel(label, value);
}

function visibleFieldsOf(row: ClientReviewBatchRow): Record<string, boolean> | null {
  const raw = row.detail?.visibleFields;
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null;
}

function resolveBatchVisibility(
  selectedRows: ClientReviewBatchRow[],
): Record<string, boolean> | null {
  for (const row of selectedRows) {
    const fields = visibleFieldsOf(row);
    if (fields) return fields;
  }
  return null;
}

function isFieldIdVisibleForClient(
  fieldId: SubmitToClientFieldId,
  visibility: Record<string, boolean> | null,
): boolean {
  if (!visibility) return true;
  return visibility[fieldId] !== false;
}

function fieldValueFromSections(detail: ClientReviewData | undefined, label: string): string {
  const wanted = label.trim().toLowerCase();
  if (!wanted) return '';
  for (const section of detail?.presentationSections || []) {
    for (const field of section.fields || []) {
      const fieldLabel = String(field.label || '')
        .trim()
        .toLowerCase();
      if (fieldLabel === wanted) return displayValue(field.value);
    }
  }
  return '';
}

function formatEntryRows(entries: Array<Record<string, unknown>> | undefined): string {
  if (!Array.isArray(entries) || !entries.length) return '';
  return entries
    .map((entry) => {
      const title =
        displayValue(entry.degreeProgram) ||
        displayValue(entry.degree) ||
        displayValue(entry.jobTitle) ||
        displayValue(entry.title) ||
        displayValue(entry.company) ||
        displayValue(entry.institutionName) ||
        displayValue(entry.institution) ||
        '';
      const meta = [
        displayValue(entry.institutionName) ||
          displayValue(entry.institution) ||
          displayValue(entry.companyName) ||
          displayValue(entry.company),
        [
          displayValue(entry.startYear) || displayValue(entry.startDate),
          displayValue(entry.endYear) || displayValue(entry.endDate),
        ]
          .filter(Boolean)
          .join('–'),
      ]
        .filter(Boolean)
        .filter((part) => part !== title);
      if (!title && !meta.length) return '';
      return meta.length ? `${title}${title ? ' · ' : ''}${meta.join(' · ')}` : title;
    })
    .filter(Boolean)
    .join('\n');
}

function formatEntries(section: ClientReviewSection): string {
  return formatEntryRows(section.entries as Array<Record<string, unknown>> | undefined);
}

function sectionsOf(row: ClientReviewBatchRow): ClientReviewSection[] {
  return Array.isArray(row.detail?.presentationSections) ? row.detail.presentationSections : [];
}

function splitCandidateName(row: ClientReviewBatchRow): { first: string; last: string; full: string } {
  const full = displayValue(row.candidateName || row.detail?.candidate?.name);
  const parts = full.split(/\s+/).filter(Boolean);
  return {
    full,
    first: parts[0] || '',
    last: parts.slice(1).join(' '),
  };
}

function locationFromRow(row: ClientReviewBatchRow): string {
  const candidate = row.detail?.candidate;
  const parts = [candidate?.city, candidate?.country].map((part) => displayValue(part)).filter(Boolean);
  if (parts.length) return Array.from(new Set(parts)).join(', ');
  const address = displayValue(candidate?.address);
  if (address) return address;
  return displayValue(row.detail?.cvEditorPreview?.location);
}

function skillsFromRow(row: ClientReviewBatchRow): string {
  const candidate = row.detail?.candidate;
  const fromCandidate = Array.isArray(candidate?.skills)
    ? candidate.skills.map((skill) => displayValue(skill)).filter(Boolean)
    : [];
  if (fromCandidate.length) return fromCandidate.join(', ');
  const fromCv = Array.isArray(row.detail?.cvEditorPreview?.skills)
    ? row.detail.cvEditorPreview.skills.map((skill) => displayValue(skill)).filter(Boolean)
    : [];
  return fromCv.join(', ');
}

function educationFromRow(row: ClientReviewBatchRow): string {
  const candidate = row.detail?.candidate;
  const fromCandidate = formatEntryRows(
    (candidate?.cvEducationEntries || []) as Array<Record<string, unknown>>,
  );
  if (fromCandidate) return fromCandidate;
  const fromCv = formatEntryRows(
    (row.detail?.cvEditorPreview?.education || []).map((entry) => ({
      degree: entry.degree,
      institution: entry.school,
      startDate: entry.period,
    })) as Array<Record<string, unknown>>,
  );
  if (fromCv) return fromCv;
  return displayValue(candidate?.education);
}

function workFromRow(row: ClientReviewBatchRow): string {
  const candidate = row.detail?.candidate;
  const fromCandidate = formatEntryRows(
    (candidate?.cvWorkExperienceEntries || []) as Array<Record<string, unknown>>,
  );
  if (fromCandidate) return fromCandidate;
  return formatEntryRows(
    (row.detail?.cvEditorPreview?.experiences || []).map((entry) => ({
      title: entry.role,
      company: entry.company,
      startDate: entry.period,
    })) as Array<Record<string, unknown>>,
  );
}

/**
 * When presentation fields are empty for a candidate, pull the same attribute
 * from profile / CV payload so comparative columns stay filled.
 */
function profileFallbackForLabel(row: ClientReviewBatchRow, label: string): string {
  const key = String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const candidate = row.detail?.candidate;
  const preview = row.detail?.cvEditorPreview;
  const names = splitCandidateName(row);

  switch (key) {
    case 'name':
    case 'name of candidate':
      return names.full;
    case 'first name':
      return names.first;
    case 'last name':
      return names.last;
    case 'e mail':
    case 'email':
      return displayValue(candidate?.email) || displayValue(preview?.email);
    case 'mobile no':
    case 'mobile':
    case 'phone':
    case 'phone number':
      return displayValue(candidate?.phone) || displayValue(preview?.phone);
    case 'candidate score':
    case 'match score':
    case 'score': {
      const score = row.matchScore ?? row.detail?.matchScore;
      return Number.isFinite(Number(score)) ? String(Math.round(Number(score))) : '';
    }
    case 'city state':
    case 'city':
      return displayValue(candidate?.city);
    case 'state':
      return '';
    case 'country':
      return (
        displayValue(candidate?.country) ||
        (() => {
          const location = locationFromRow(row);
          const parts = location.split(',').map((part) => part.trim()).filter(Boolean);
          return parts.length > 1 ? parts[parts.length - 1] : '';
        })()
      );
    case 'location display':
    case 'actual location':
    case 'location':
    case 'preferred location':
      return locationFromRow(row);
    case 'current address':
    case 'address':
      return displayValue(candidate?.address);
    case 'current company':
    case 'current employer':
    case 'company':
    case 'employer':
      return displayValue(candidate?.currentCompany);
    case 'current designation':
    case 'designation':
    case 'job title':
      return displayValue(row.designation || candidate?.designation || preview?.jobTitle);
    case 'year of experience':
    case 'years of experience':
    case 'experience years':
    case 'experience': {
      const years = row.experience ?? candidate?.experience;
      return Number.isFinite(Number(years)) ? String(years) : '';
    }
    case 'domain of expertise':
    case 'skills':
      return skillsFromRow(row);
    case 'education':
    case 'education summary':
    case 'education entries':
      return educationFromRow(row);
    case 'work experience':
    case 'work experience entries':
      return workFromRow(row);
    case 'professional summary':
    case 'summary':
    case 'cv summary':
      return displayValue(candidate?.cvSummary) || displayValue(preview?.summary);
    case 'languages':
    case 'language proficiency': {
      const languages = Array.isArray(candidate?.languages)
        ? candidate.languages.map((item) => displayValue(item)).filter(Boolean)
        : [];
      if (languages.length) return languages.join(', ');
      return fieldValueFromSections(row.detail, 'Language & proficiency');
    }
    case 'linkedin':
      return displayValue(preview?.linkedin);
    case 'stage':
    case 'candidate stage':
      return displayValue(row.clientMarkedStage || row.detail?.clientMarkedStage);
    default:
      return '';
  }
}

function isCompareLabelAllowed(row: ClientReviewBatchRow, label: string): boolean {
  return isSubmitToClientReviewFieldVisible(label, visibleFieldsOf(row));
}

/** Resolve value for compare/export — do not blank out when the cell is empty. */
function resolveFieldValueRaw(row: ClientReviewBatchRow, label: string): string {
  return profileFallbackForLabel(row, label) || fieldValueFromSections(row.detail, label);
}

function resolveFieldValue(row: ClientReviewBatchRow, label: string): string {
  if (!isCompareLabelAllowed(row, label)) return '';
  return resolveFieldValueRaw(row, label);
}

function resolveEntriesValueRaw(row: ClientReviewBatchRow, sectionId: string): string {
  const section = sectionsOf(row).find(
    (item) => String(item.id || item.title || '') === sectionId,
  );
  const fromSection = section ? formatEntries(section) : '';
  if (fromSection) return fromSection;
  if (sectionId === 'education') return educationFromRow(row);
  if (sectionId === 'work') return workFromRow(row);
  return '';
}

function resolveEntriesValue(row: ClientReviewBatchRow, sectionId: string): string {
  if (sectionId === 'education') {
    if (
      !isCompareLabelAllowed(row, 'Education entries') &&
      !isCompareLabelAllowed(row, 'Education summary') &&
      !isCompareLabelAllowed(row, 'Education')
    ) {
      return '';
    }
  }
  if (
    sectionId === 'work' &&
    !isCompareLabelAllowed(row, 'Work experience') &&
    !isCompareLabelAllowed(row, 'Work experience entries')
  ) {
    return '';
  }
  return resolveEntriesValueRaw(row, sectionId);
}

function resolveCompareCellValue(
  row: ClientReviewBatchRow,
  fieldId: SubmitToClientFieldId,
  label: string,
): string {
  if (fieldId === 'cvEducationEntries') {
    return resolveEntriesValueRaw(row, 'education') || resolveFieldValueRaw(row, label);
  }
  if (fieldId === 'cvWorkExperienceEntries') {
    return resolveEntriesValueRaw(row, 'work') || resolveFieldValueRaw(row, label);
  }
  if (fieldId === 'educationSummary') {
    return (
      resolveFieldValueRaw(row, 'Education summary') ||
      resolveFieldValueRaw(row, 'Education') ||
      educationFromRow(row)
    );
  }
  return resolveFieldValueRaw(row, label);
}

function fallbackValue(row: ClientReviewBatchRow, key: string): string {
  switch (key) {
    case 'location':
      return locationFromRow(row);
    case 'employer':
      return profileFallbackForLabel(row, 'Current Employer');
    case 'designation':
      return profileFallbackForLabel(row, 'Current Designation');
    case 'experience':
      return profileFallbackForLabel(row, 'Year of experience');
    case 'domain': {
      const skills = skillsFromRow(row);
      const summary = profileFallbackForLabel(row, 'Professional summary');
      if (skills && summary) return `${skills}\n\n${summary}`;
      return skills || summary;
    }
    case 'education':
      return educationFromRow(row);
    case 'stage':
      return profileFallbackForLabel(row, 'Stage');
    default:
      return '';
  }
}

function normalizeCompareLabel(label: string): string {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function aliasCompareLabelKey(label: string): string {
  const key = normalizeCompareLabel(label);
  if (key === 'experience years' || key === 'years of experience' || key === 'experience') {
    return 'year of experience';
  }
  if (key === 'education summary' || key === 'education entries') return 'education';
  if (key === 'current employer' || key === 'company' || key === 'employer') return 'current company';
  if (key === 'language proficiency' || key === 'languages') return 'language proficiency';
  if (key === 'name of candidate') return 'name';
  return key;
}

function buildCompareParams(selectedRows: ClientReviewBatchRow[]): CompareParam[] {
  const params: CompareParam[] = [];
  const seenFieldIds = new Set<string>();
  const visibility = resolveBatchVisibility(selectedRows);
  const showStage = selectedRows.some((row) =>
    Boolean(normalizeClientTrackerOptions(row.detail?.trackerOptions, true).changeStage),
  );

  const nameValues: Record<string, string> = {};
  for (const row of selectedRows) {
    nameValues[row.matchId] = cell(row.candidateName || row.detail?.candidate?.name);
  }
  params.push({ kind: 'section', id: 'candidate-details', label: 'Candidate Details' });
  params.push({
    kind: 'field',
    id: 'name',
    label: 'Name of Candidate',
    emphasize: true,
    valuesByMatchId: nameValues,
  });
  seenFieldIds.add('name');

  if (showStage) {
    const stageValues: Record<string, string> = {};
    for (const row of selectedRows) {
      stageValues[row.matchId] = cell(profileFallbackForLabel(row, 'Stage'));
    }
    params.push({
      kind: 'field',
      id: 'stage',
      label: 'Stage',
      valuesByMatchId: stageValues,
    });
    seenFieldIds.add('stage');
  }

  // Mirror Settings → Submit to Client visibility: show every allowed field even when empty.
  for (const group of SUBMIT_TO_CLIENT_FIELD_GROUPS) {
    const visibleFields = group.fields.filter(
      (field) =>
        isFieldIdVisibleForClient(field.id, visibility) &&
        !isPermanentlyHiddenCompareLabel(field.label),
    );
    if (!visibleFields.length) continue;

    const isPersonal = group.id === 'personal';
    if (!isPersonal) {
      params.push({
        kind: 'section',
        id: `section-${group.id}`,
        label: group.title,
      });
    }

    for (const field of visibleFields) {
      const key = aliasCompareLabelKey(field.label) || field.id;
      if (seenFieldIds.has(key) || seenFieldIds.has(field.id)) continue;
      seenFieldIds.add(key);
      seenFieldIds.add(field.id);

      const valuesByMatchId: Record<string, string> = {};
      for (const row of selectedRows) {
        valuesByMatchId[row.matchId] = cell(
          resolveCompareCellValue(row, field.id, field.label),
        );
      }

      params.push({
        kind: 'field',
        id: field.id,
        label: field.label,
        valuesByMatchId,
      });
    }
  }

  return params;
}

type CompareExportRow =
  | { kind: 'section'; label: string }
  | { kind: 'field'; label: string; values: string[]; emphasize?: boolean };

function buildCompareExportModel(
  selectedRows: ClientReviewBatchRow[],
  compareParams: CompareParam[],
  meta?: { jobTitle?: string; clientName?: string },
) {
  const headers = [
    'Attribute',
    ...selectedRows.map((row) => row.candidateName || 'Candidate'),
  ];
  // Keep the same rows as the on-screen table — including empty (—) client-visible fields.
  const rows: CompareExportRow[] = compareParams.map((param) => {
    if (param.kind === 'section') return { kind: 'section', label: param.label };
    return {
      kind: 'field',
      label: param.label,
      emphasize: param.emphasize,
      values: selectedRows.map((row) => {
        const raw = param.valuesByMatchId[row.matchId];
        return cell(raw === '[]' || raw === '{}' ? '' : raw);
      }),
    };
  });

  const title = meta?.jobTitle
    ? `Comparative analysis — ${meta.jobTitle}`
    : 'Comparative analysis — Shortlisted candidates';
  const subtitle = [
    meta?.clientName ? `Client: ${meta.clientName}` : '',
    `${selectedRows.length} candidate${selectedRows.length === 1 ? '' : 's'}`,
    new Date().toLocaleString(),
  ]
    .filter(Boolean)
    .join(' · ');
  return { title, subtitle, headers, rows };
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildCompareExportHtml(model: ReturnType<typeof buildCompareExportModel>): string {
  const bodyRows = model.rows
    .map((row) => {
      if (row.kind === 'section') {
        return `<tr class="section"><td colspan="${model.headers.length}">${escapeHtml(row.label)}</td></tr>`;
      }
      const valueCells = row.values
        .map(
          (value) =>
            `<td class="${row.emphasize ? 'emphasize' : ''}">${escapeHtml(value).replace(/\n/g, '<br/>')}</td>`,
        )
        .join('');
      return `<tr class="field"><th scope="row" class="${row.emphasize ? 'emphasize' : ''}">${escapeHtml(row.label)}</th>${valueCells}</tr>`;
    })
    .join('');

  const headCells = model.headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(model.title)}</title>
  <style>
    @page { size: landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #fff;
    }
    h1 { font-size: 18px; margin: 0 0 4px; }
    p.sub { margin: 0 0 16px; color: #64748b; font-size: 12px; }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 11px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      vertical-align: top;
      text-align: left;
      white-space: pre-wrap;
      word-break: break-word;
    }
    thead th {
      background: #0f172a;
      color: #fff;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    tr.section td {
      background: #eef2ff;
      color: #3730a3;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 10px;
    }
    tr.field th {
      width: 180px;
      background: #f8fafc;
      font-weight: 600;
      color: #475569;
    }
    tr.field th.emphasize,
    tr.field td.emphasize {
      background: #eef2ff;
      color: #0f172a;
      font-weight: 700;
    }
    tr.field:nth-child(even) td { background: #f8fafc; }
    tr.field:nth-child(even) td.emphasize { background: #e0e7ff; }
  </style>
</head>
<body>
  <h1>${escapeHtml(model.title)}</h1>
  <p class="sub">${escapeHtml(model.subtitle)}</p>
  <table>
    <thead><tr>${headCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`;
}

function safeFileSlug(value: string): string {
  return (
    String(value || 'comparative-analysis')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'comparative-analysis'
  );
}

async function downloadCompareExcel(model: ReturnType<typeof buildCompareExportModel>) {
  const ExcelJSMod: any = await import('exceljs');
  const ExcelJS = ExcelJSMod?.default ?? ExcelJSMod;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'HRYANTRA';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Comparative analysis', {
    views: [{ state: 'frozen', ySplit: 4, xSplit: 1, showGridLines: false }],
    properties: { defaultRowHeight: 18 },
  });
  sheet.properties.showGridLines = false;

  const colCount = Math.max(1, model.headers.length);
  sheet.columns = model.headers.map((_, index) => ({
    width: index === 0 ? 30 : 42,
  }));

  // Same palette as the comparative analysis UI / print sheet
  const COLORS = {
    title: 'FF0F172A',
    subtitle: 'FF64748B',
    headerBg: 'FF0F172A',
    headerFg: 'FFFFFFFF',
    sectionBg: 'FFEEF2FF',
    sectionFg: 'FF3730A3',
    attributeBg: 'FFFFFFFF',
    attributeFg: 'FF475569',
    attributeAltBg: 'FFF1F5F9',
    valueFg: 'FF1E293B',
    valueAltBg: 'FFF8FAFC',
    emphasizeBg: 'FFEEF2FF',
    emphasizeFg: 'FF312E81',
    emphasizeValueBg: 'FFE0E7FF',
    border: 'FF94A3B8',
  };

  const cellBorder = {
    top: { style: 'thin' as const, color: { argb: COLORS.border } },
    left: { style: 'thin' as const, color: { argb: COLORS.border } },
    bottom: { style: 'thin' as const, color: { argb: COLORS.border } },
    right: { style: 'thin' as const, color: { argb: COLORS.border } },
  };

  const paintRange = (
    rowNumber: number,
    fromCol: number,
    toCol: number,
    style: {
      fill?: string;
      fontColor?: string;
      bold?: boolean;
      size?: number;
      align?: 'top' | 'middle';
    },
  ) => {
    for (let col = fromCol; col <= toCol; col += 1) {
      const cell = sheet.getRow(rowNumber).getCell(col);
      if (style.fill) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: style.fill },
        };
      }
      cell.font = {
        name: 'Calibri',
        bold: Boolean(style.bold),
        size: style.size || 11,
        color: { argb: style.fontColor || COLORS.valueFg },
      };
      cell.alignment = {
        vertical: style.align || 'top',
        horizontal: 'left',
        wrapText: true,
      };
      cell.border = cellBorder;
    }
  };

  const titleRow = sheet.addRow([model.title, ...Array(Math.max(0, colCount - 1)).fill('')]);
  if (colCount > 1) sheet.mergeCells(1, 1, 1, colCount);
  titleRow.height = 24;
  paintRange(1, 1, colCount, {
    fontColor: COLORS.title,
    bold: true,
    size: 16,
    align: 'middle',
  });

  const subtitleRow = sheet.addRow([model.subtitle, ...Array(Math.max(0, colCount - 1)).fill('')]);
  if (colCount > 1) sheet.mergeCells(2, 1, 2, colCount);
  subtitleRow.height = 18;
  paintRange(2, 1, colCount, {
    fontColor: COLORS.subtitle,
    size: 11,
    align: 'middle',
  });

  sheet.addRow(Array(colCount).fill(''));

  const headerValues = [...model.headers];
  while (headerValues.length < colCount) headerValues.push('');
  const headerRow = sheet.addRow(headerValues);
  headerRow.height = 22;
  paintRange(headerRow.number, 1, colCount, {
    fill: COLORS.headerBg,
    fontColor: COLORS.headerFg,
    bold: true,
    size: 10,
    align: 'middle',
  });

  let fieldIndex = 0;
  for (const row of model.rows) {
    if (row.kind === 'section') {
      const values = [row.label, ...Array(Math.max(0, colCount - 1)).fill('')];
      const sectionRow = sheet.addRow(values);
      if (colCount > 1) sheet.mergeCells(sectionRow.number, 1, sectionRow.number, colCount);
      sectionRow.height = 20;
      paintRange(sectionRow.number, 1, colCount, {
        fill: COLORS.sectionBg,
        fontColor: COLORS.sectionFg,
        bold: true,
        size: 10,
        align: 'middle',
      });
      continue;
    }

    const isAlt = fieldIndex % 2 === 1;
    fieldIndex += 1;
    const values = [row.label, ...row.values];
    while (values.length < colCount) values.push('—');
    const dataRow = sheet.addRow(values.slice(0, colCount));
    const lineCount = Math.max(
      1,
      ...values.map((value) => String(value || '').split('\n').length),
    );
    dataRow.height = Math.min(60, 16 + lineCount * 12);

    for (let col = 1; col <= colCount; col += 1) {
      const cell = dataRow.getCell(col);
      const isAttribute = col === 1;
      const emphasize = Boolean(row.emphasize);
      let fill = COLORS.attributeBg;
      let fontColor = COLORS.valueFg;
      let bold = false;

      if (emphasize) {
        fill = isAttribute ? COLORS.emphasizeBg : COLORS.emphasizeValueBg;
        fontColor = COLORS.emphasizeFg;
        bold = true;
      } else if (isAttribute) {
        fill = isAlt ? COLORS.attributeAltBg : COLORS.attributeBg;
        fontColor = COLORS.attributeFg;
        bold = true;
      } else if (isAlt) {
        fill = COLORS.valueAltBg;
        fontColor = COLORS.valueFg;
      }

      cell.value = values[col - 1] ?? '';
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: fill },
      };
      cell.font = {
        name: 'Calibri',
        bold,
        size: 11,
        color: { argb: fontColor },
      };
      cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
      cell.border = cellBorder;
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFileSlug(model.title)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function downloadComparePdf(model: ReturnType<typeof buildCompareExportModel>) {
  const html2canvas = (await import('html2canvas')).default;
  const { jsPDF } = await import('jspdf');
  const html = buildCompareExportHtml(model);
  const host = document.createElement('div');
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;width:1400px;background:#fff;z-index:-1;pointer-events:none;';
  host.innerHTML = html;
  document.body.appendChild(host);
  try {
    const canvas = await html2canvas(host, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;
    const imgWidth = usableWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const pageCanvasHeight = Math.floor((usableHeight * canvas.width) / imgWidth);

    let rendered = 0;
    let pageIndex = 0;
    while (rendered < canvas.height) {
      const sliceHeight = Math.min(pageCanvasHeight, canvas.height - rendered);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      const ctx = pageCanvas.getContext('2d');
      if (!ctx) break;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(
        canvas,
        0,
        rendered,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight,
      );
      const pageData = pageCanvas.toDataURL('image/jpeg', 0.95);
      const sliceMm = (sliceHeight * imgWidth) / canvas.width;
      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(pageData, 'JPEG', margin, margin, imgWidth, sliceMm);
      rendered += sliceHeight;
      pageIndex += 1;
    }

    pdf.save(`${safeFileSlug(model.title)}.pdf`);
  } finally {
    host.remove();
  }
}

function printCompareSheet(model: ReturnType<typeof buildCompareExportModel>) {
  const html = buildCompareExportHtml(model);
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1280,height=900');
  if (!printWindow) {
    throw new Error('Pop-up blocked. Allow pop-ups to print the comparative analysis.');
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  const triggerPrint = () => {
    try {
      printWindow.focus();
      printWindow.print();
    } catch {
      /* ignore */
    }
  };
  if (printWindow.document.readyState === 'complete') {
    window.setTimeout(triggerPrint, 250);
  } else {
    printWindow.onload = () => window.setTimeout(triggerPrint, 250);
  }
}

export function ClientReviewComparativeAnalysisDrawer({
  open,
  rows,
  jobTitle,
  clientName,
  onClose,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | 'print' | null>(null);
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    if (!open) return;
    setSelectedIds(rows.map((row) => row.matchId));
    setExportError('');
    setExporting(null);
  }, [open, rows]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.includes(row.matchId)),
    [rows, selectedIds],
  );

  const compareParams = useMemo(() => buildCompareParams(selectedRows), [selectedRows]);

  const exportModel = useMemo(
    () => buildCompareExportModel(selectedRows, compareParams, { jobTitle, clientName }),
    [selectedRows, compareParams, jobTitle, clientName],
  );

  const toggleCandidate = (matchId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(matchId)) {
        if (prev.length <= 1) return prev;
        return prev.filter((id) => id !== matchId);
      }
      return [...prev, matchId];
    });
  };

  const runExport = async (kind: 'excel' | 'pdf' | 'print') => {
    if (!selectedRows.length || exporting) return;
    setExportError('');
    setExporting(kind);
    try {
      if (kind === 'excel') await downloadCompareExcel(exportModel);
      else if (kind === 'pdf') await downloadComparePdf(exportModel);
      else printCompareSheet(exportModel);
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : 'Unable to export comparative analysis');
    } finally {
      setExporting(null);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="comparative-analysis"
          className="pointer-events-none fixed inset-0 z-[200] flex flex-col"
          variants={shellVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          <motion.div
            variants={backdropVariants}
            onClick={onClose}
            className="pointer-events-auto absolute inset-0 bg-slate-950/50"
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="comparative-analysis-title"
            variants={panelVariants}
            className="pointer-events-auto relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#F4F6FB]"
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.14),_transparent_65%)]"
              aria-hidden
            />

            <header className="relative z-10 shrink-0 border-b border-slate-200/80 bg-white/90 px-4 py-2.5 sm:px-6 lg:px-8">
              <div className="flex w-full items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-700 ring-1 ring-indigo-100">
                      <Columns2 className="h-3 w-3" />
                      Comparative analysis
                    </span>
                    <h2
                      id="comparative-analysis-title"
                      className="truncate text-sm font-semibold tracking-tight text-slate-900 sm:text-base"
                    >
                      {jobTitle ? `Shortlisted — ${jobTitle}` : 'Shortlisted candidates'}
                    </h2>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] leading-4 text-slate-500 sm:text-xs">
                    Only visible shared parameters are compared
                    {clientName ? ` for ${clientName}` : ''}. Toggle candidates to change columns.
                  </p>
                  {exportError ? (
                    <p className="mt-1 text-[11px] font-medium text-rose-600">{exportError}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  <button
                    type="button"
                    disabled={!selectedRows.length || Boolean(exporting)}
                    onClick={() => void runExport('excel')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
                  >
                    {exporting === 'excel' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                    )}
                    Excel
                  </button>
                  <button
                    type="button"
                    disabled={!selectedRows.length || Boolean(exporting)}
                    onClick={() => void runExport('pdf')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-800 transition hover:bg-rose-100 disabled:opacity-50"
                  >
                    {exporting === 'pdf' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileText className="h-3.5 w-3.5" />
                    )}
                    PDF
                  </button>
                  <button
                    type="button"
                    disabled={!selectedRows.length || Boolean(exporting)}
                    onClick={() => void runExport('print')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    {exporting === 'print' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Printer className="h-3.5 w-3.5" />
                    )}
                    Print
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                    aria-label="Close comparative analysis"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </header>

            {rows.length > 1 ? (
              <div className="relative z-10 shrink-0 border-b border-slate-200/80 bg-white/70 px-4 py-2 sm:px-6 lg:px-8">
                <div className="flex w-full flex-wrap gap-1.5">
                  {rows.map((row) => {
                    const active = selectedIds.includes(row.matchId);
                    return (
                      <button
                        key={row.matchId}
                        type="button"
                        onClick={() => toggleCandidate(row.matchId)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                          active
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {row.candidateName || 'Candidate'}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="relative z-10 min-h-0 flex-1 overflow-auto">
              {selectedRows.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm text-slate-500">
                  No candidates available to compare.
                </div>
              ) : (
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 top-0 z-30 min-w-[12rem] border-b border-r border-slate-800 bg-slate-900 px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80 sm:min-w-[15rem] sm:px-6 lg:px-8">
                        Attribute
                      </th>
                      {selectedRows.map((row) => (
                        <th
                          key={row.matchId}
                          className="sticky top-0 z-20 min-w-[15rem] border-b border-slate-800 bg-slate-900 px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-white sm:px-6"
                        >
                          {row.candidateName || 'Candidate'}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {compareParams.map((meta, index) => {
                      if (meta.kind === 'section') {
                        return (
                          <tr key={`${meta.kind}-${meta.id}-${index}`}>
                            <td
                              colSpan={selectedRows.length + 1}
                              className="sticky left-0 z-10 border-y border-indigo-100 bg-indigo-50 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-800 sm:px-6 lg:px-8"
                            >
                              {meta.label}
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={`${meta.kind}-${meta.id}-${index}`} className="align-top odd:bg-slate-50/50">
                          <th
                            scope="row"
                            className={`sticky left-0 z-10 border-b border-r border-slate-100 px-4 py-3.5 text-left text-xs font-semibold text-slate-600 sm:px-6 lg:px-8 ${
                              meta.emphasize ? 'bg-indigo-50/90 text-indigo-900' : 'bg-white'
                            }`}
                          >
                            {meta.label}
                          </th>
                          {selectedRows.map((row) => (
                            <td
                              key={`${row.matchId}-${meta.id}-${index}`}
                              className={`border-b border-slate-100 px-4 py-3.5 text-sm leading-6 whitespace-pre-line sm:px-6 ${
                                meta.emphasize
                                  ? 'bg-indigo-50/60 font-semibold text-slate-900'
                                  : 'text-slate-800'
                              }`}
                            >
                              {meta.valuesByMatchId[row.matchId] || '—'}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
