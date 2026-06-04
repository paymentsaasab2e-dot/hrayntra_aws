export type SaasaCvAnnotationType = 'comment' | 'highlight' | 'important' | 'draw';

export interface SaasaCvPoint {
  x: number;
  y: number;
}

export interface SaasaCvAnnotation {
  id: string;
  type: SaasaCvAnnotationType;
  /** Anchor / start position as % of preview (0–100) */
  x: number;
  y: number;
  width?: number;
  height?: number;
  /** Freehand stroke or rectangle corner trail */
  points?: SaasaCvPoint[];
  text: string;
  color?: string;
  /** 0–1; at 1 the mark fully hides CV text underneath */
  opacity?: number;
  strokeWidth?: number;
  createdAt: string;
}

export interface SaasaCvCompanyLogo {
  url: string;
  /** Position on document (% 0–100) */
  x: number;
  y: number;
  /** Width as % of document width */
  width: number;
  /** Height as % of document height; auto from image aspect if omitted */
  height?: number;
  opacity?: number;
}

export const DEFAULT_SAASA_CV_COMPANY_LOGO: SaasaCvCompanyLogo = {
  url: '',
  x: 82,
  y: 4,
  width: 16,
  opacity: 1,
};

export interface SaasaCvAnnotationsStored {
  resumeUrl?: string | null;
  items: SaasaCvAnnotation[];
  updatedAt?: string;
  companyLogo?: SaasaCvCompanyLogo | null;
  /** Uploaded annotated CV snapshot in candidate Files */
  fileId?: string;
  fileUrl?: string | null;
  fileName?: string;
  /** True when fileUrl is a full CV raster (PDF/Word + marks + logo), not paint-only. */
  fullSnapshot?: boolean;
  /** Saved export format when known */
  snapshotFormat?: 'pdf' | 'png';
}

export const SAASA_CV_FILE_TYPE = 'SAASA_CV';

export const SAASA_CV_COLOR_PRESETS = [
  '#FDE047',
  '#F97316',
  '#22C55E',
  '#3B82F6',
  '#A855F7',
  '#EC4899',
  '#DC2626',
  '#0F172A',
] as const;

export const SAASA_CV_ANNOTATION_COLORS: Record<SaasaCvAnnotationType, string> = {
  comment: '#185FA5',
  highlight: '#FDE047',
  important: '#DC2626',
  draw: '#FDE047',
};

export const SAASA_CV_DEFAULT_OPACITY: Record<SaasaCvAnnotationType, number> = {
  comment: 1,
  highlight: 0.45,
  important: 1,
  draw: 0.55,
};

export function clampOpacity(value: unknown, fallback = 0.5): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

/** Parse #RGB / #RRGGBB to r,g,b 0–255 */
export function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.trim().replace(/^#/, '');
  if (raw.length === 3) {
    const r = parseInt(raw[0] + raw[0], 16);
    const g = parseInt(raw[1] + raw[1], 16);
    const b = parseInt(raw[2] + raw[2], 16);
    if ([r, g, b].some((v) => Number.isNaN(v))) return null;
    return { r, g, b };
  }
  if (raw.length === 6) {
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    if ([r, g, b].some((v) => Number.isNaN(v))) return null;
    return { r, g, b };
  }
  return null;
}

export function colorWithOpacity(hex: string, opacity: number): string {
  const rgb = parseHexColor(hex);
  const a = clampOpacity(opacity, 1);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

export function normalizeSaasaCvCompanyLogo(raw: unknown): SaasaCvCompanyLogo | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as SaasaCvCompanyLogo;
  const url = typeof o.url === 'string' ? o.url.trim() : '';
  if (!url) return null;
  return {
    url,
    x: Number.isFinite(Number(o.x)) ? Math.min(100, Math.max(0, Number(o.x))) : DEFAULT_SAASA_CV_COMPANY_LOGO.x,
    y: Number.isFinite(Number(o.y)) ? Math.min(100, Math.max(0, Number(o.y))) : DEFAULT_SAASA_CV_COMPANY_LOGO.y,
    width: Number.isFinite(Number(o.width))
      ? Math.min(40, Math.max(6, Number(o.width)))
      : DEFAULT_SAASA_CV_COMPANY_LOGO.width,
    height:
      o.height != null && Number.isFinite(Number(o.height))
        ? Math.min(40, Math.max(4, Number(o.height)))
        : undefined,
    opacity: clampOpacity(o.opacity, 1),
  };
}

export function readSaasaCvCompanyLogo(
  extraData?: Record<string, unknown> | null
): SaasaCvCompanyLogo | null {
  const stored = readSaasaCvAnnotations(extraData);
  if (stored?.companyLogo) {
    const normalized = normalizeSaasaCvCompanyLogo(stored.companyLogo);
    if (normalized) return normalized;
  }
  const layout = extraData?.cvEditorLayout;
  if (layout && typeof layout === 'object' && !Array.isArray(layout)) {
    const url = String((layout as { companyLogoUrl?: string }).companyLogoUrl || '').trim();
    if (url) {
      return {
        ...DEFAULT_SAASA_CV_COMPANY_LOGO,
        url,
      };
    }
  }
  return null;
}

export function normalizeSaasaCvAnnotation(raw: unknown): SaasaCvAnnotation | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as SaasaCvAnnotation;
  if (typeof o.id !== 'string' || typeof o.type !== 'string') return null;
  const validTypes: SaasaCvAnnotationType[] = ['comment', 'highlight', 'important', 'draw'];
  if (!validTypes.includes(o.type as SaasaCvAnnotationType)) return null;
  const points = Array.isArray(o.points)
    ? o.points
        .filter((p) => p && typeof p === 'object')
        .map((p) => ({
          x: Number((p as SaasaCvPoint).x),
          y: Number((p as SaasaCvPoint).y),
        }))
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    : undefined;
  return {
    id: o.id,
    type: o.type as SaasaCvAnnotationType,
    x: Number(o.x) || 0,
    y: Number(o.y) || 0,
    width: o.width != null ? Number(o.width) : undefined,
    height: o.height != null ? Number(o.height) : undefined,
    points: points?.length ? points : undefined,
    text: typeof o.text === 'string' ? o.text : '',
    color: typeof o.color === 'string' ? o.color : SAASA_CV_ANNOTATION_COLORS[o.type as SaasaCvAnnotationType],
    opacity: clampOpacity(o.opacity, SAASA_CV_DEFAULT_OPACITY[o.type as SaasaCvAnnotationType]),
    strokeWidth: o.strokeWidth != null ? Number(o.strokeWidth) : undefined,
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : new Date().toISOString(),
  };
}

export function readSaasaCvAnnotations(
  extraData?: Record<string, unknown> | null
): SaasaCvAnnotationsStored | null {
  if (!extraData || typeof extraData !== 'object' || Array.isArray(extraData)) return null;
  const raw = extraData.saasaCvAnnotations;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const items = Array.isArray((raw as SaasaCvAnnotationsStored).items)
    ? (raw as SaasaCvAnnotationsStored).items
        .map(normalizeSaasaCvAnnotation)
        .filter((item): item is SaasaCvAnnotation => item != null)
    : [];
  const bag = raw as SaasaCvAnnotationsStored;
  const companyLogo = bag.companyLogo ? normalizeSaasaCvCompanyLogo(bag.companyLogo) : null;
  return {
    resumeUrl: typeof bag.resumeUrl === 'string' ? bag.resumeUrl : null,
    items,
    updatedAt: typeof bag.updatedAt === 'string' ? bag.updatedAt : undefined,
    companyLogo,
    fileId: typeof bag.fileId === 'string' ? bag.fileId : undefined,
    fileUrl: typeof bag.fileUrl === 'string' ? bag.fileUrl : null,
    fileName: typeof bag.fileName === 'string' ? bag.fileName : undefined,
    fullSnapshot: bag.fullSnapshot === true,
    snapshotFormat:
      bag.snapshotFormat === 'pdf' || bag.snapshotFormat === 'png' ? bag.snapshotFormat : undefined,
  };
}

export type SaasaCvFileRef = {
  id?: string;
  fileUrl?: string | null;
  fileType?: string;
  fileName?: string;
};

/** Resolved URL for the exported SAASA CV file shown on the Resume tab. */
export function resolveSaasaCvPreviewUrl(
  extraData?: Record<string, unknown> | null,
  files?: SaasaCvFileRef[] | null
): string | null {
  const stored = readSaasaCvAnnotations(extraData);
  if (!stored) return null;

  const direct = String(stored.fileUrl || '').trim();
  if (direct) return direct;

  const fileList = files ?? [];
  if (stored.fileId) {
    const byId = fileList.find((f) => f.id === stored.fileId);
    const url = String(byId?.fileUrl || '').trim();
    if (url) return url;
  }

  const saasaFile = fileList.find((f) => f.fileType === SAASA_CV_FILE_TYPE);
  const fromType = String(saasaFile?.fileUrl || '').trim();
  return fromType || null;
}

export function hasSaasaCvSaved(stored: SaasaCvAnnotationsStored | null | undefined): boolean {
  if (!stored) return false;
  return Boolean(
    stored.fileId || stored.fileUrl || stored.items.length > 0 || stored.companyLogo?.url
  );
}

export function buildSaasaCvAnnotationsExtra(
  existingExtraData: Record<string, unknown> | null | undefined,
  payload: SaasaCvAnnotationsStored
): Record<string, unknown> {
  const existing =
    existingExtraData && typeof existingExtraData === 'object' && !Array.isArray(existingExtraData)
      ? existingExtraData
      : {};
  return {
    ...existing,
    saasaCvAnnotations: {
      ...payload,
      updatedAt: new Date().toISOString(),
    },
  };
}
