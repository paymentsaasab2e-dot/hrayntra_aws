import type { CSSProperties } from 'react';
import type { CvEditorImagePlacement, CvEditorSectionId } from './cvEditorMapping';

export type CvEditorTemplateId = 'classic' | 'modern' | 'minimal' | 'executive';

export type CvTemplateLayout = 'single' | 'sidebar';

export interface CvEditorTemplateDefinition {
  id: CvEditorTemplateId;
  label: string;
  description: string;
  layout: CvTemplateLayout;
  accent: string;
  candidatePhotoPos: CvEditorImagePlacement;
  companyLogoPos: CvEditorImagePlacement;
}

export const CV_EDITOR_TEMPLATES: CvEditorTemplateDefinition[] = [
  {
    id: 'classic',
    label: 'Classic',
    description: 'Traditional serif CV with underline section headers',
    layout: 'single',
    accent: '#1a1a1a',
    candidatePhotoPos: { x: 430, y: 36 },
    companyLogoPos: { x: 332, y: 108 },
  },
  {
    id: 'modern',
    label: 'Modern',
    description: 'Sans-serif layout with coloured header band',
    layout: 'single',
    accent: '#185FA5',
    candidatePhotoPos: { x: 448, y: 28 },
    companyLogoPos: { x: 48, y: 28 },
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Clean airy layout with light typography',
    layout: 'single',
    accent: '#64748b',
    candidatePhotoPos: { x: 448, y: 48 },
    companyLogoPos: { x: 48, y: 48 },
  },
  {
    id: 'executive',
    label: 'Executive',
    description: 'Two-column layout — sidebar for skills & education',
    layout: 'sidebar',
    accent: '#0f172a',
    candidatePhotoPos: { x: 448, y: 24 },
    companyLogoPos: { x: 48, y: 24 },
  },
];

export function normalizeCvTemplateId(value: unknown): CvEditorTemplateId {
  const id = String(value || '').trim() as CvEditorTemplateId;
  return CV_EDITOR_TEMPLATES.some((t) => t.id === id) ? id : 'classic';
}

export function getCvEditorTemplate(id: CvEditorTemplateId): CvEditorTemplateDefinition {
  return CV_EDITOR_TEMPLATES.find((t) => t.id === id) ?? CV_EDITOR_TEMPLATES[0];
}

export type CvTemplateStyles = {
  layout: CvTemplateLayout;
  accent: string;
  headerVariant: 'default' | 'band' | 'centered';
  cvPage: CSSProperties;
  cvName: CSSProperties;
  cvJobTitle: CSSProperties;
  cvContactLine: CSSProperties;
  cvSep: CSSProperties;
  cvDivider: CSSProperties;
  sectionHead: CSSProperties;
  sectionHeadSidebar: CSSProperties;
  cvRole: CSSProperties;
  cvDate: CSSProperties;
  cvCompany: CSSProperties;
  cvDesc: CSSProperties;
  cvSummary: CSSProperties;
  cvSkill: CSSProperties;
  skillsRow: CSSProperties;
  headerWrap: CSSProperties;
  headerBand: CSSProperties;
  bodyGrid: CSSProperties;
  sidebar: CSSProperties;
  main: CSSProperties;
};

export function buildCvTemplateStyles(templateId: CvEditorTemplateId): CvTemplateStyles {
  const template = getCvEditorTemplate(templateId);
  const accent = template.accent;

  const basePage: CSSProperties = {
    background: '#fff',
    width: 580,
    minHeight: 720,
    position: 'relative',
    flexShrink: 0,
    boxShadow: '0 4px 24px rgba(15, 23, 42, 0.12)',
    fontSize: 11,
    lineHeight: 1.6,
    color: '#1a1a1a',
  };

  if (templateId === 'modern') {
    return {
      layout: 'single',
      accent,
      headerVariant: 'band',
      cvPage: {
        ...basePage,
        padding: '0 0 48px',
        fontFamily: '"Segoe UI", Arial, sans-serif',
      },
      headerWrap: { paddingRight: 100, position: 'relative', zIndex: 1 },
      headerBand: {
        margin: '0 0 28px',
        padding: '32px 48px 24px',
        background: `linear-gradient(135deg, ${accent} 0%, #0ea5e9 100%)`,
        color: '#fff',
      },
      cvName: {
        fontSize: 24,
        fontWeight: 700,
        color: '#fff',
        letterSpacing: -0.3,
        display: 'block',
      },
      cvJobTitle: { fontSize: 13, color: 'rgba(255,255,255,0.92)', display: 'block', marginTop: 4 },
      cvContactLine: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.85)',
        display: 'flex',
        flexWrap: 'wrap',
        marginTop: 8,
      },
      cvSep: { fontSize: 10, color: 'rgba(255,255,255,0.5)', padding: '0 5px', userSelect: 'none' },
      cvDivider: { border: 'none', margin: '0 48px 16px', borderTop: `2px solid ${accent}` },
      sectionHead: {
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.14em',
        color: accent,
        borderBottom: 'none',
        paddingBottom: 0,
        margin: '18px 48px 8px',
      },
      sectionHeadSidebar: {},
      cvRole: { fontSize: 12, fontWeight: 700, display: 'block', color: '#0f172a' },
      cvDate: { fontSize: 10, color: accent, display: 'block', textAlign: 'right' },
      cvCompany: { fontSize: 10.5, color: '#475569', fontStyle: 'normal', display: 'block', marginTop: 2 },
      cvDesc: { fontSize: 10, color: '#475569', display: 'block', marginTop: 4 },
      cvSummary: { fontSize: 10.5, color: '#334155', display: 'block', margin: '0 48px' },
      cvSkill: {
        fontSize: 10,
        padding: '4px 10px',
        border: 'none',
        borderRadius: 12,
        background: '#e0f2fe',
        color: accent,
      },
      skillsRow: { display: 'flex', flexWrap: 'wrap', gap: 6, margin: '0 48px', marginTop: 4 },
      bodyGrid: {},
      sidebar: {},
      main: { padding: '0 48px' },
    };
  }

  if (templateId === 'minimal') {
    return {
      layout: 'single',
      accent,
      headerVariant: 'centered',
      cvPage: {
        ...basePage,
        padding: '56px 56px 64px',
        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
        color: '#334155',
      },
      headerWrap: {
        paddingRight: 0,
        textAlign: 'center',
        position: 'relative',
        zIndex: 1,
        marginBottom: 28,
      },
      headerBand: {},
      cvName: {
        fontSize: 20,
        fontWeight: 300,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: '#0f172a',
        display: 'block',
      },
      cvJobTitle: {
        fontSize: 11,
        color: accent,
        display: 'block',
        marginTop: 8,
        letterSpacing: '0.08em',
      },
      cvContactLine: {
        fontSize: 9.5,
        color: '#94a3b8',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginTop: 10,
        gap: 4,
      },
      cvSep: { fontSize: 9.5, color: '#cbd5e1', padding: '0 3px', userSelect: 'none' },
      cvDivider: { border: 'none', borderTop: '0.5px solid #e2e8f0', margin: '20px 0 18px' },
      sectionHead: {
        fontSize: 8.5,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.22em',
        color: accent,
        borderBottom: 'none',
        paddingBottom: 0,
        margin: '20px 0 10px',
        textAlign: 'center',
      },
      sectionHeadSidebar: {},
      cvRole: { fontSize: 11, fontWeight: 600, display: 'block', color: '#0f172a' },
      cvDate: { fontSize: 9.5, color: '#94a3b8', display: 'block', textAlign: 'right' },
      cvCompany: { fontSize: 10, color: '#64748b', fontStyle: 'normal', display: 'block', marginTop: 2 },
      cvDesc: { fontSize: 10, color: '#64748b', display: 'block', marginTop: 4, lineHeight: 1.7 },
      cvSummary: { fontSize: 10.5, color: '#475569', display: 'block', lineHeight: 1.75, textAlign: 'center' },
      cvSkill: {
        fontSize: 9.5,
        padding: '2px 0',
        border: 'none',
        borderRadius: 0,
        color: '#475569',
        background: 'transparent',
      },
      skillsRow: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'center',
        marginTop: 6,
      },
      bodyGrid: {},
      sidebar: {},
      main: {},
    };
  }

  if (templateId === 'executive') {
    return {
      layout: 'sidebar',
      accent,
      headerVariant: 'default',
      cvPage: {
        ...basePage,
        padding: 0,
        fontFamily: '"Segoe UI", Arial, sans-serif',
        overflow: 'hidden',
      },
      headerWrap: {
        padding: '28px 40px 20px 200px',
        paddingRight: 100,
        position: 'relative',
        zIndex: 1,
        borderBottom: '1px solid #e2e8f0',
      },
      headerBand: {},
      cvName: { fontSize: 22, fontWeight: 700, color: '#0f172a', letterSpacing: -0.3, display: 'block' },
      cvJobTitle: { fontSize: 12, color: accent, display: 'block', marginTop: 3 },
      cvContactLine: { fontSize: 10, color: '#64748b', display: 'flex', flexWrap: 'wrap', marginTop: 6 },
      cvSep: { fontSize: 10, color: '#cbd5e1', padding: '0 4px', userSelect: 'none' },
      cvDivider: { display: 'none' },
      sectionHead: {
        fontSize: 9.5,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        color: '#0f172a',
        borderBottom: `2px solid ${accent}`,
        paddingBottom: 4,
        margin: '0 0 10px',
      },
      sectionHeadSidebar: {
        fontSize: 9,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.14em',
        color: '#94a3b8',
        borderBottom: '1px solid #334155',
        paddingBottom: 6,
        margin: '0 0 12px',
      },
      cvRole: { fontSize: 11.5, fontWeight: 700, display: 'block', color: '#0f172a' },
      cvDate: { fontSize: 10, color: '#64748b', display: 'block', textAlign: 'right' },
      cvCompany: { fontSize: 10.5, color: '#475569', fontStyle: 'normal', display: 'block', marginTop: 1 },
      cvDesc: { fontSize: 10, color: '#475569', display: 'block', marginTop: 4 },
      cvSummary: { fontSize: 10.5, color: '#334155', display: 'block', lineHeight: 1.65 },
      cvSkill: {
        fontSize: 10,
        padding: '3px 8px',
        border: 'none',
        borderRadius: 4,
        background: '#334155',
        color: '#e2e8f0',
      },
      skillsRow: { display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 },
      bodyGrid: { display: 'flex', minHeight: 520 },
      sidebar: {
        width: 188,
        flexShrink: 0,
        background: accent,
        color: '#e2e8f0',
        padding: '24px 20px 32px',
      },
      main: { flex: 1, padding: '24px 36px 40px', minWidth: 0 },
    };
  }

  // classic (default)
  return {
    layout: 'single',
    accent,
    headerVariant: 'default',
    cvPage: {
      ...basePage,
      padding: '42px 48px 64px',
      fontFamily: 'Georgia, serif',
    },
    headerWrap: { paddingRight: 100, position: 'relative', zIndex: 1 },
    headerBand: {},
    cvName: { fontSize: 22, fontWeight: 700, color: '#1a1a1a', letterSpacing: -0.4, display: 'block' },
    cvJobTitle: { fontSize: 12, color: '#555', display: 'block', marginTop: 2 },
    cvContactLine: { fontSize: 10, color: '#777', display: 'flex', flexWrap: 'wrap', marginTop: 5 },
    cvSep: { fontSize: 10, color: '#ccc', padding: '0 4px', userSelect: 'none' },
    cvDivider: { border: 'none', borderTop: '1.5px solid #1a1a1a', margin: '12px 0' },
    sectionHead: {
      fontSize: 9.5,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      color: '#1a1a1a',
      borderBottom: '0.5px solid #ccc',
      paddingBottom: 3,
      margin: '14px 0 7px',
    },
    sectionHeadSidebar: {},
    cvRole: { fontSize: 11.5, fontWeight: 700, display: 'block' },
    cvDate: { fontSize: 10, color: '#777', display: 'block', textAlign: 'right' },
    cvCompany: { fontSize: 10.5, color: '#444', fontStyle: 'italic', display: 'block', marginTop: 1 },
    cvDesc: { fontSize: 10, color: '#555', display: 'block', marginTop: 3 },
    cvSummary: { fontSize: 10.5, color: '#444', display: 'block' },
    cvSkill: {
      fontSize: 10,
      padding: '2px 8px',
      border: '0.5px solid #ccc',
      borderRadius: 3,
      color: '#444',
    },
    skillsRow: { display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 2 },
    bodyGrid: {},
    sidebar: {},
    main: {},
  };
}

export const SIDEBAR_SECTIONS: CvEditorSectionId[] = ['skills', 'education'];
export const MAIN_SECTIONS: CvEditorSectionId[] = ['summary', 'experience'];
