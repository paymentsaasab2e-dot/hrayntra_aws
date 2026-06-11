'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  Download,
  Eraser,
  Eye,
  Hand,
  MessageSquare,
  Paintbrush,
  Redo2,
  Save,
  Square,
  ImagePlus,
  Star,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import {
  buildResumeViewerUrl,
  canPreviewResumeAsHtml,
  getResumeExtension,
  isImageResume,
  isPdfResume,
  isTextResume,
  normalizeResumeHref,
} from '../../lib/resumePreview';
import { ResumeWordFileViewer } from './ResumeWordFileViewer';
import { SaasaCvRasterResumePreview } from './SaasaCvRasterResumePreview';
import {
  colorWithOpacity,
  DEFAULT_SAASA_CV_COMPANY_LOGO,
  SAASA_CV_ANNOTATION_COLORS,
  SAASA_CV_COLOR_PRESETS,
  SAASA_CV_DEFAULT_OPACITY,
  type SaasaCvAnnotation,
  type SaasaCvAnnotationType,
  type SaasaCvCompanyLogo,
  type SaasaCvPoint,
} from '../../lib/saasaCvAnnotations';
import {
  clearSaasaCvPdfBytesCache,
  renderSaasaPdfPages,
  type SaasaCvPdfDocumentMeta,
} from '../../lib/saasaCvPdfRender';
import {
  clientToPaintSurfacePercent,
  type DraftPaint,
  findAnnotationsHitByEraser,
  redrawPaintCanvas,
  syncCanvasToDocumentSize,
} from '../../lib/saasaCvPaintCanvas';

type ActiveTool = SaasaCvAnnotationType | 'eraser' | 'scroll' | null;

function isAnnotateOverlayTool(tool: ActiveTool): boolean {
  return tool != null && tool !== 'scroll';
}

interface SaasaCvAnnotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  resumeUrl: string | null;
  candidateName?: string;
  initialAnnotations?: SaasaCvAnnotation[];
  initialCompanyLogo?: SaasaCvCompanyLogo | null;
  canEdit?: boolean;
  saving?: boolean;
  onSave?: (
    items: SaasaCvAnnotation[],
    exportPayload: Blob | HTMLCanvasElement | null,
    companyLogo: SaasaCvCompanyLogo | null,
    fullSnapshot?: boolean
  ) => Promise<boolean>;
  onExportError?: (message: string) => void;
}

function newId(): string {
  return `saasa-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const TOOL_CONFIG: {
  type: ActiveTool;
  label: string;
  hint: string;
  icon: React.ReactNode;
  usesBrush: boolean;
}[] = [
  {
    type: 'scroll',
    label: 'Scroll CV',
    hint: 'Scroll this panel to move through all CV pages',
    icon: <Hand size={16} />,
    usesBrush: false,
  },
  {
    type: 'draw',
    label: 'Brush',
    hint: 'Click and drag — smooth paint like MS Paint',
    icon: <Paintbrush size={16} />,
    usesBrush: true,
  },
  {
    type: 'highlight',
    label: 'Fill box',
    hint: 'Drag a solid rectangle over text',
    icon: <Square size={16} />,
    usesBrush: true,
  },
  {
    type: 'eraser',
    label: 'Eraser',
    hint: 'Drag over paint or highlights to remove them',
    icon: <Eraser size={16} />,
    usesBrush: false,
  },
  {
    type: 'comment',
    label: 'Comment',
    hint: 'Click to pin a note',
    icon: <MessageSquare size={16} />,
    usesBrush: false,
  },
  {
    type: 'important',
    label: 'Important',
    hint: 'Click to mark a spot',
    icon: <Star size={16} />,
    usesBrush: false,
  },
];

const UNDO_MAX = 40;

/** Minimum height of the CV viewer area inside the modal */
const CV_VIEWER_MIN_HEIGHT = 'min(78dvh, 900px)';

/** Max width of the CV document in the scroll panel (view only) */
const CV_VIEWER_MAX_WIDTH = 'min(92%, 52rem)';

function UndoRedoButtons({
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  className = '',
}: {
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  className?: string;
}) {
  return (
    <div className={`flex gap-2 ${className}`}>
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Undo2 size={15} />
        Undo
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo (Ctrl+Y)"
        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Redo2 size={15} />
        Redo
      </button>
    </div>
  );
}

export function SaasaCvAnnotationModal({
  isOpen,
  onClose,
  resumeUrl,
  candidateName = 'Candidate',
  initialAnnotations = [],
  initialCompanyLogo = null,
  canEdit = true,
  saving = false,
  onSave,
  onExportError,
}: SaasaCvAnnotationModalProps) {
  const href = resumeUrl ? normalizeResumeHref(resumeUrl) : '';
  const canPdf = Boolean(href && isPdfResume(href));
  const canImage = Boolean(href && isImageResume(href));
  const canWord = Boolean(href && canPreviewResumeAsHtml(href));
  const canText = Boolean(href && isTextResume(href));
  const extension = getResumeExtension(href);

  const [wordPreviewError, setWordPreviewError] = useState<string | null>(null);
  const [wordPreviewReady, setWordPreviewReady] = useState(false);
  const [imagePreviewError, setImagePreviewError] = useState<string | null>(null);
  const [imagePreviewReady, setImagePreviewReady] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [textPreviewError, setTextPreviewError] = useState<string | null>(null);
  const [textPreviewReady, setTextPreviewReady] = useState(false);
  const [textLoading, setTextLoading] = useState(false);
  const [companyLogo, setCompanyLogo] = useState<SaasaCvCompanyLogo | null>(initialCompanyLogo);
  const [logoDragging, setLogoDragging] = useState(false);
  const companyLogoInputRef = useRef<HTMLInputElement>(null);
  const initialCompanyLogoRef = useRef(initialCompanyLogo);
  initialCompanyLogoRef.current = initialCompanyLogo;
  const [annotations, setAnnotations] = useState<SaasaCvAnnotation[]>(initialAnnotations);
  const [pdfDocMeta, setPdfDocMeta] = useState<SaasaCvPdfDocumentMeta | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const pdfHostRef = useRef<HTMLDivElement>(null);
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);
  const [brushColor, setBrushColor] = useState<string>(SAASA_CV_COLOR_PRESETS[0]);
  const [brushOpacity, setBrushOpacity] = useState(0.55);
  const [brushSizePx, setBrushSizePx] = useState(10);
  const [draft, setDraft] = useState<DraftPaint | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const [undoStack, setUndoStack] = useState<SaasaCvAnnotation[][]>([]);
  const [redoStack, setRedoStack] = useState<SaasaCvAnnotation[][]>([]);
  const [spacePanHeld, setSpacePanHeld] = useState(false);
  const [exporting, setExporting] = useState(false);

  const surfaceRef = useRef<HTMLDivElement>(null);
  const cvScrollRef = useRef<HTMLDivElement>(null);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasSizeRef = useRef({ width: 0, height: 0 });
  const drawingRef = useRef(false);
  const eraserHitIdsRef = useRef<Set<string>>(new Set());
  const draftRef = useRef<DraftPaint | null>(null);
  const annotationsRef = useRef(annotations);
  const paintRedrawRef = useRef<() => void>(() => {});
  const pdfLoadGenRef = useRef(0);

  const initialRef = useRef(initialAnnotations);
  initialRef.current = initialAnnotations;
  draftRef.current = draft;
  annotationsRef.current = annotations;

  const usesBrush = activeTool === 'draw' || activeTool === 'highlight';
  const pushUndo = useCallback((snapshot: SaasaCvAnnotation[]) => {
    setUndoStack((prev) => [...prev.slice(-(UNDO_MAX - 1)), snapshot]);
    setRedoStack([]);
  }, []);

  const paintRedraw = useCallback(() => {
    const canvas = canvasRef.current;
    const surface = surfaceRef.current;
    if (!canvas || !surface) return;

    let size: { width: number; height: number } | null = null;
    if (canPdf && pdfDocMeta?.totalHeight) {
      const synced = syncCanvasToDocumentSize(
        canvas,
        pdfDocMeta.width,
        pdfDocMeta.totalHeight
      );
      if (synced) size = { width: synced.width, height: synced.height };
    } else if (!canPdf) {
      const synced = syncCanvasToDocumentSize(
        canvas,
        surface.offsetWidth || surface.clientWidth,
        surface.offsetHeight || surface.clientHeight
      );
      if (synced) size = { width: synced.width, height: synced.height };
    }
    if (!size) return;

    canvasSizeRef.current = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    redrawPaintCanvas(
      ctx,
      size.width,
      size.height,
      annotationsRef.current,
      draftRef.current,
      { color: brushColor, opacity: brushOpacity, sizePx: brushSizePx }
    );
  }, [brushColor, brushOpacity, brushSizePx, pdfDocMeta, canPdf]);

  paintRedrawRef.current = paintRedraw;

  useEffect(() => {
    if (!isOpen) {
      pdfLoadGenRef.current += 1;
      clearSaasaCvPdfBytesCache();
      return;
    }
    setAnnotations([...initialRef.current]);
    setActiveTool('scroll');
    setSpacePanHeld(false);
    setDraft(null);
    setEditingId(null);
    setDraftText('');
    setPdfDocMeta(null);
    setPdfLoading(false);
    setPdfError(null);
    setWordPreviewReady(false);
    setWordPreviewError(null);
    setImagePreviewReady(false);
    setImagePreviewError(null);
    setImageLoading(false);
    setTextPreviewReady(false);
    setTextPreviewError(null);
    setTextLoading(false);
    setCompanyLogo(initialCompanyLogoRef.current);
    setLogoDragging(false);
    setUndoStack([]);
    setRedoStack([]);
    drawingRef.current = false;
    eraserHitIdsRef.current = new Set();
  }, [isOpen]);

  useEffect(() => {
    paintRedraw();
  }, [annotations, draft, brushColor, brushOpacity, brushSizePx, paintRedraw, isOpen]);

  useEffect(() => {
    if (!isOpen || !canPdf || !href) return;

    const gen = ++pdfLoadGenRef.current;
    let cancelled = false;
    const viewerUrl = buildResumeViewerUrl(href);

    setPdfLoading(true);
    setPdfError(null);

    const loadPdf = () => {
      const host = pdfHostRef.current;
      if (!host) return false;

      void renderSaasaPdfPages(host, viewerUrl)
        .then((meta) => {
          if (cancelled || gen !== pdfLoadGenRef.current) return;
          setPdfDocMeta(meta);
          requestAnimationFrame(() => paintRedrawRef.current());
        })
        .catch((e: unknown) => {
          if (cancelled || gen !== pdfLoadGenRef.current) return;
          setPdfError(e instanceof Error ? e.message : 'Failed to load CV');
          setPdfDocMeta(null);
        })
        .finally(() => {
          if (cancelled || gen !== pdfLoadGenRef.current) return;
          setPdfLoading(false);
        });
      return true;
    };

    if (!loadPdf()) {
      const id = window.requestAnimationFrame(() => {
        if (!cancelled && gen === pdfLoadGenRef.current) loadPdf();
      });
      return () => {
        cancelled = true;
        window.cancelAnimationFrame(id);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [isOpen, canPdf, href]);

  useEffect(() => {
    if (!isOpen || !canImage) {
      setImagePreviewReady(false);
      setImagePreviewError(null);
      setImageLoading(false);
      return;
    }
    setImagePreviewReady(false);
    setImagePreviewError(null);
    setImageLoading(true);
  }, [isOpen, canImage, href]);

  useEffect(() => {
    if (!isOpen || !canText) {
      setTextPreviewReady(false);
      setTextPreviewError(null);
      setTextLoading(false);
      return;
    }
    setTextPreviewReady(false);
    setTextPreviewError(null);
    setTextLoading(true);
  }, [isOpen, canText, href]);

  useEffect(() => {
    if (!isOpen || !surfaceRef.current) return;
    if (!pdfDocMeta?.totalHeight && !wordPreviewReady && !imagePreviewReady && !textPreviewReady) {
      return;
    }
    let frame = 0;
    const ro = new ResizeObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => paintRedrawRef.current());
    });
    ro.observe(surfaceRef.current);
    return () => {
      window.cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [isOpen, pdfDocMeta?.totalHeight, wordPreviewReady, imagePreviewReady, textPreviewReady]);

  useEffect(() => {
    if (!activeTool) return;
    if (activeTool === 'draw' || activeTool === 'highlight') {
      setBrushColor(SAASA_CV_ANNOTATION_COLORS[activeTool]);
      setBrushOpacity(SAASA_CV_DEFAULT_OPACITY[activeTool]);
    }
  }, [activeTool]);

  const handleWordPreviewReady = useCallback(() => {
    setWordPreviewReady(true);
    setWordPreviewError(null);
    requestAnimationFrame(() => paintRedrawRef.current());
  }, []);

  const handleWordPreviewError = useCallback((message: string) => {
    setWordPreviewError(message);
    setWordPreviewReady(false);
  }, []);

  const handleImagePreviewReady = useCallback(() => {
    setImagePreviewReady(true);
    setImagePreviewError(null);
    setImageLoading(false);
    requestAnimationFrame(() => paintRedrawRef.current());
  }, []);

  const handleImagePreviewError = useCallback((message?: string) => {
    setImagePreviewError(message || 'Failed to load CV image');
    setImagePreviewReady(false);
    setImageLoading(false);
  }, []);

  const handleTextPreviewReady = useCallback(() => {
    setTextPreviewReady(true);
    setTextPreviewError(null);
    setTextLoading(false);
    requestAnimationFrame(() => paintRedrawRef.current());
  }, []);

  const handleTextPreviewError = useCallback((message?: string) => {
    setTextPreviewError(message || 'Failed to load CV text');
    setTextPreviewReady(false);
    setTextLoading(false);
  }, []);

  const pointerToDocPercent = (clientX: number, clientY: number) => {
    const surface = surfaceRef.current;
    const scrollEl = cvScrollRef.current;
    if (!surface || !scrollEl) return null;

    const meta = pdfDocMeta;
    if (canPdf && meta?.totalHeight) {
      return clientToPaintSurfacePercent(
        clientX,
        clientY,
        surface,
        scrollEl,
        meta.width,
        meta.totalHeight
      );
    }

    const w = surface.offsetWidth || 1;
    const h = surface.offsetHeight || 1;
    return clientToPaintSurfacePercent(clientX, clientY, surface, scrollEl, w, h);
  };

  const placePin = useCallback(
    (clientX: number, clientY: number, type: 'comment' | 'important') => {
      const pt = pointerToDocPercent(clientX, clientY);
      if (!canEdit || !pt) return;
      const { x, y } = pt;
      pushUndo(annotationsRef.current);
      const id = newId();
      setAnnotations((prev) => [
        ...prev,
        {
          id,
          type,
          x,
          y,
          text: '',
          color: SAASA_CV_ANNOTATION_COLORS[type],
          opacity: 1,
          createdAt: new Date().toISOString(),
        },
      ]);
      setEditingId(id);
      setDraftText('');
    },
    [canEdit, pushUndo]
  );

  const finishDraft = useCallback(() => {
    const currentDraft = draftRef.current;
    if (!currentDraft || !canEdit) {
      setDraft(null);
      drawingRef.current = false;
      return;
    }

    const { width, height } = canvasSizeRef.current;

    if (currentDraft.type === 'eraser') {
      eraserHitIdsRef.current = new Set();
    } else if (currentDraft.type === 'draw' && currentDraft.points.length > 2) {
      pushUndo(annotationsRef.current);
      setAnnotations((prev) => [
        ...prev,
        {
          id: newId(),
          type: 'draw',
          x: currentDraft.points[0].x,
          y: currentDraft.points[0].y,
          points: currentDraft.points,
          text: '',
          color: brushColor,
          opacity: brushOpacity,
          strokeWidth: brushSizePx,
          createdAt: new Date().toISOString(),
        },
      ]);
    } else if (currentDraft.type === 'highlight' && currentDraft.width > 0.5 && currentDraft.height > 0.5) {
      pushUndo(annotationsRef.current);
      setAnnotations((prev) => [
        ...prev,
        {
          id: newId(),
          type: 'highlight',
          x: currentDraft.x,
          y: currentDraft.y,
          width: currentDraft.width,
          height: currentDraft.height,
          text: '',
          color: brushColor,
          opacity: brushOpacity,
          createdAt: new Date().toISOString(),
        },
      ]);
    }

    setDraft(null);
    drawingRef.current = false;
  }, [canEdit, brushColor, brushOpacity, brushSizePx, pushUndo]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canEdit || !activeTool) return;
    const pt = pointerToDocPercent(e.clientX, e.clientY);
    if (!pt) return;

    if (activeTool === 'comment' || activeTool === 'important') {
      placePin(e.clientX, e.clientY, activeTool);
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;

    if (activeTool === 'draw') {
      setDraft({ type: 'draw', points: [pt], x: pt.x, y: pt.y, width: 0, height: 0 });
    } else if (activeTool === 'highlight') {
      setDraft({ type: 'highlight', points: [pt], x: pt.x, y: pt.y, width: 0, height: 0 });
    } else if (activeTool === 'eraser') {
      pushUndo(annotationsRef.current);
      eraserHitIdsRef.current = new Set();
      setDraft({ type: 'eraser', points: [pt], x: pt.x, y: pt.y, width: 0, height: 0 });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drawingRef.current) return;
    const pt = pointerToDocPercent(e.clientX, e.clientY);
    if (!pt) return;
    const current = draftRef.current;
    if (!current) return;

    if (current.type === 'draw' || current.type === 'eraser') {
      const last = current.points[current.points.length - 1];
      if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 0.08) return;
      const next: DraftPaint = { ...current, points: [...current.points, pt] };
      setDraft(next);
      if (current.type === 'eraser') {
        const { width, height } = canvasSizeRef.current;
        const ids = findAnnotationsHitByEraser(
          annotationsRef.current,
          next.points,
          Math.max(brushSizePx * 1.5, 12),
          width,
          height
        );
        const newHits = ids.filter((id) => !eraserHitIdsRef.current.has(id));
        if (newHits.length) {
          newHits.forEach((id) => eraserHitIdsRef.current.add(id));
          setAnnotations((prev) => prev.filter((a) => !eraserHitIdsRef.current.has(a.id)));
        }
      }
      requestAnimationFrame(paintRedraw);
      return;
    }

    if (current.type === 'highlight') {
      const start = current.points[0];
      const x = Math.min(start.x, pt.x);
      const y = Math.min(start.y, pt.y);
      const width = Math.abs(pt.x - start.x);
      const height = Math.abs(pt.y - start.y);
      setDraft({ ...current, x, y, width, height, points: [start, pt] });
      requestAnimationFrame(paintRedraw);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drawingRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* released */
    }
    finishDraft();
    requestAnimationFrame(paintRedraw);
  };

  const handleUndo = useCallback(() => {
    setUndoStack((stack) => {
      if (!stack.length) return stack;
      const prev = stack[stack.length - 1];
      setRedoStack((r) => [...r, annotationsRef.current]);
      setAnnotations(prev);
      return stack.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setRedoStack((stack) => {
      if (!stack.length) return stack;
      const next = stack[stack.length - 1];
      setUndoStack((u) => [...u, annotationsRef.current]);
      setAnnotations(next);
      return stack.slice(0, -1);
    });
  }, []);

  useEffect(() => {
    if (!isOpen || !canEdit) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        setSpacePanHeld(true);
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        handleRedo();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpacePanHeld(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isOpen, canEdit, handleUndo, handleRedo]);

  const removeAnnotation = (id: string) => {
    pushUndo(annotationsRef.current);
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setDraftText('');
    }
  };

  const commitEdit = () => {
    if (editingId) {
      pushUndo(annotationsRef.current);
      setAnnotations((prev) =>
        prev.map((a) => (a.id === editingId ? { ...a, text: draftText.trim() } : a))
      );
      setEditingId(null);
      setDraftText('');
    }
  };

  const handleCompanyLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;
      setCompanyLogo((prev) => ({
        ...(prev ?? DEFAULT_SAASA_CV_COMPANY_LOGO),
        url: dataUrl,
      }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeCompanyLogo = () => setCompanyLogo(null);

  const updateCompanyLogo = (patch: Partial<SaasaCvCompanyLogo>) => {
    setCompanyLogo((prev) => {
      if (!prev?.url && !patch.url) return prev;
      return { ...(prev ?? DEFAULT_SAASA_CV_COMPANY_LOGO), ...patch };
    });
  };

  const handleLogoPointerDown = (e: React.PointerEvent) => {
    if (!canEdit || !companyLogo?.url) return;
    e.stopPropagation();
    e.preventDefault();
    setLogoDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleLogoPointerMove = (e: React.PointerEvent) => {
    if (!logoDragging || !companyLogo?.url) return;
    e.stopPropagation();
    const pt = pointerToDocPercent(e.clientX, e.clientY);
    if (!pt) return;
    updateCompanyLogo({ x: pt.x, y: pt.y });
  };

  const handleLogoPointerUp = (e: React.PointerEvent) => {
    if (!logoDragging) return;
    e.stopPropagation();
    setLogoDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const handleSave = async () => {
    if (!onSave || saving || exporting) return;

    const items = editingId
      ? annotations.map((a) => (a.id === editingId ? { ...a, text: draftText.trim() } : a))
      : annotations;
    annotationsRef.current = items;
    setAnnotations(items);
    setEditingId(null);
    setDraftText('');
    paintRedraw();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    setExporting(true);
    try {
      const surfaceReady =
        Boolean(pdfDocMeta?.totalHeight) || wordPreviewReady || imagePreviewReady;
      const logoPayload = companyLogo?.url?.trim() ? companyLogo : null;
      let exportPayload: Blob | HTMLCanvasElement | null = null;
      let fullSnapshot = false;

      const { exportSaasaCvDocumentPdf, captureSaasaCvSurfacePdf, withExportTimeout } =
        await import('../../lib/saasaCvExport');

      if (canPdf && pdfDocMeta?.totalHeight && href) {
        try {
          const blob = await withExportTimeout(
            exportSaasaCvDocumentPdf({
              sourcePdfUrl: buildResumeViewerUrl(href),
              width: pdfDocMeta.width,
              annotations: items,
              companyLogo: logoPayload,
              pdfHost: pdfHostRef.current,
              expectedPageCount: pdfDocMeta.pageCount,
              displayPageHeightsPx: pdfDocMeta.pageHeightsPx,
            }),
            45000,
            'CV export'
          );
          if (blob) {
            exportPayload = blob;
            fullSnapshot = true;
          }
        } catch {
          /* fall through */
        }
      }

      if (
        !exportPayload &&
        surfaceRef.current &&
        surfaceReady &&
        (canWord || canPdf || canImage || canText)
      ) {
        try {
          const blob = await captureSaasaCvSurfacePdf(surfaceRef.current);
          if (blob) {
            exportPayload = blob;
            fullSnapshot = true;
          }
        } catch {
          /* fall through */
        }
      }

      const needsFullDocument =
        (canPdf && Boolean(pdfDocMeta?.totalHeight)) ||
        (canWord && surfaceReady) ||
        (canImage && imagePreviewReady) ||
        (canText && textPreviewReady);
      if (needsFullDocument && !exportPayload) {
        onExportError?.(
          'Could not build a full SAASA CV PDF (resume text did not export). Wait for the CV to finish loading, then save again.'
        );
        return;
      }

      await onSave(items, exportPayload, logoPayload, fullSnapshot);
    } catch (error: unknown) {
      console.error('[SAASA CV] save failed:', error);
    } finally {
      setExporting(false);
    }
  };

  const isSaving = saving || exporting;

  const pinAnnotations = annotations.filter((a) => a.type === 'comment' || a.type === 'important');

  const paintSurfaceReady = Boolean(pdfDocMeta?.totalHeight);
  const documentPreviewReady =
    paintSurfaceReady || wordPreviewReady || imagePreviewReady || textPreviewReady;
  const docHeightPx = pdfDocMeta?.totalHeight ?? 0;

  const renderWordPreview = () => {
    if (canPdf || canImage || !canWord || !href) return null;
    if (wordPreviewError) {
      return (
        <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-500">{wordPreviewError}</p>
        </div>
      );
    }
    return (
      <ResumeWordFileViewer
        resumeUrl={href}
        candidateName={candidateName}
        enabled={isOpen}
        minHeight={CV_VIEWER_MIN_HEIGHT}
        className="relative z-0"
        onReady={handleWordPreviewReady}
        onError={handleWordPreviewError}
      />
    );
  };

  const renderImagePreview = () => {
    if (!canImage || !href) return null;
    return (
      <SaasaCvRasterResumePreview
        resumeUrl={href}
        candidateName={candidateName}
        mode="image"
        onReady={handleImagePreviewReady}
        onError={handleImagePreviewError}
      />
    );
  };

  const renderTextPreview = () => {
    if (!canText || !href) return null;
    return (
      <SaasaCvRasterResumePreview
        resumeUrl={href}
        candidateName={candidateName}
        mode="text"
        onReady={handleTextPreviewReady}
        onError={handleTextPreviewError}
      />
    );
  };

  const renderNonPdfPreview = () => {
    if (canPdf) return null;
    if (canWord) {
      return renderWordPreview();
    }
    if (canImage) {
      return renderImagePreview();
    }
    if (canText) {
      return renderTextPreview();
    }
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-center"
        style={{ minHeight: CV_VIEWER_MIN_HEIGHT }}
      >
        <AlertCircle className="mb-2 text-amber-500" size={28} />
        <p className="text-sm font-medium text-slate-900">Inline preview unavailable</p>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Eye size={15} />
          Open original CV
        </a>
      </div>
    );
  };

  const paintOverlayActive =
    canEdit && isAnnotateOverlayTool(activeTool) && !spacePanHeld;

  const cursorStyle =
    spacePanHeld || activeTool === 'scroll'
      ? 'default'
      : activeTool === 'draw'
        ? 'crosshair'
        : activeTool === 'highlight'
          ? 'crosshair'
          : activeTool === 'eraser'
            ? 'cell'
            : activeTool
              ? 'pointer'
              : 'default';

  return (
    <AnimatePresence>
      {isOpen && href ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] bg-slate-950/60"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: 'tween', duration: 0.2 }}
            className="fixed inset-1 z-[131] flex max-h-[calc(100dvh-0.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:inset-2 sm:max-h-[calc(100dvh-1rem)]"
            role="dialog"
            aria-modal="true"
            aria-label="SAASA CV"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={companyLogoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCompanyLogoUpload}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">SAASA CV</h3>
                <p className="text-xs text-slate-500">
                  {candidateName} · Paint on original CV (canvas brush)
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {canEdit ? (
                  <UndoRedoButtons
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    canUndo={undoStack.length > 0}
                    canRedo={redoStack.length > 0}
                    className="hidden sm:flex"
                  />
                ) : null}
                {canEdit ? (
                  <>
                    <button
                      type="button"
                      onClick={() => companyLogoInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <ImagePlus size={15} />
                      {companyLogo?.url ? 'Replace logo' : 'Upload logo'}
                    </button>
                    {companyLogo?.url ? (
                      <button
                        type="button"
                        onClick={removeCompanyLogo}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                      >
                        <Trash2 size={15} />
                        Remove
                      </button>
                    ) : null}
                  </>
                ) : null}
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Eye size={15} />
                  Open CV
                </a>
                {canEdit && onSave ? (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void handleSave()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    <Save size={15} />
                    {isSaving ? 'Saving…' : 'Save'}
                  </button>
                ) : null}
                <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                  <X size={18} />
                </button>
              </div>
            </div>

            {canEdit && companyLogo?.url ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 bg-slate-50 px-4 py-2 sm:px-5">
                <span className="text-xs font-medium text-slate-600">Logo position</span>
                <label className="flex min-w-[120px] flex-1 items-center gap-2 text-xs text-slate-600 sm:max-w-[180px]">
                  <span className="shrink-0">H</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(companyLogo.x)}
                    onChange={(e) => updateCompanyLogo({ x: Number(e.target.value) })}
                    className="w-full accent-blue-600"
                  />
                </label>
                <label className="flex min-w-[120px] flex-1 items-center gap-2 text-xs text-slate-600 sm:max-w-[180px]">
                  <span className="shrink-0">V</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(companyLogo.y)}
                    onChange={(e) => updateCompanyLogo({ y: Number(e.target.value) })}
                    className="w-full accent-blue-600"
                  />
                </label>
                <label className="flex min-w-[120px] flex-1 items-center gap-2 text-xs text-slate-600 sm:max-w-[180px]">
                  <span className="shrink-0">Size</span>
                  <input
                    type="range"
                    min={6}
                    max={40}
                    value={Math.round(companyLogo.width)}
                    onChange={(e) => updateCompanyLogo({ width: Number(e.target.value) })}
                    className="w-full accent-blue-600"
                  />
                </label>
                <label className="flex min-w-[120px] flex-1 items-center gap-2 text-xs text-slate-600 sm:max-w-[180px]">
                  <span className="shrink-0">Opacity</span>
                  <input
                    type="range"
                    min={20}
                    max={100}
                    value={Math.round((companyLogo.opacity ?? 1) * 100)}
                    onChange={(e) => updateCompanyLogo({ opacity: Number(e.target.value) / 100 })}
                    className="w-full accent-blue-600"
                  />
                </label>
                <span className="hidden text-[11px] text-slate-500 lg:inline">or drag on the CV</span>
              </div>
            ) : null}

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <div
                  ref={cvScrollRef}
                  className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain bg-slate-100 p-3 sm:p-5"
                  style={{ maxHeight: CV_VIEWER_MIN_HEIGHT }}
                >
                  {(canPdf && pdfError) ||
                  (canImage && imagePreviewError) ||
                  (canText && textPreviewError) ||
                  (canWord && wordPreviewError) ? (
                    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-center">
                      <p className="text-sm text-red-600">
                        {pdfError || imagePreviewError || textPreviewError || wordPreviewError}
                      </p>
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                      >
                        Open CV in new tab
                      </a>
                    </div>
                  ) : (
                    <div
                      ref={surfaceRef}
                      className="relative mx-auto w-full select-none rounded-xl border border-slate-200 bg-white"
                      style={
                        canPdf && paintSurfaceReady
                          ? {
                              width: '100%',
                              maxWidth: CV_VIEWER_MAX_WIDTH,
                              height: docHeightPx,
                              minHeight: docHeightPx,
                            }
                          : { minHeight: CV_VIEWER_MIN_HEIGHT, maxWidth: CV_VIEWER_MAX_WIDTH }
                      }
                    >
                      {((canPdf && pdfLoading && !paintSurfaceReady) ||
                        (canImage && imageLoading && !imagePreviewReady) ||
                        (canText && textLoading && !textPreviewReady)) ? (
                        <div
                          className="flex items-center justify-center text-sm text-slate-600"
                          style={{ minHeight: CV_VIEWER_MIN_HEIGHT }}
                        >
                          Loading CV for paint…
                        </div>
                      ) : null}

                      {canPdf ? (
                        <div ref={pdfHostRef} className="relative z-0 w-full" aria-hidden={!paintSurfaceReady} />
                      ) : (
                        renderNonPdfPreview()
                      )}

                      {companyLogo?.url ? (
                        <div
                          className="pointer-events-auto absolute z-[18] select-none"
                          style={{
                            left: `${companyLogo.x}%`,
                            top: `${companyLogo.y}%`,
                            width: `${companyLogo.width}%`,
                            maxWidth: '40%',
                            opacity: companyLogo.opacity ?? 1,
                            cursor: canEdit ? (logoDragging ? 'grabbing' : 'grab') : 'default',
                          }}
                          onPointerDown={handleLogoPointerDown}
                          onPointerMove={handleLogoPointerMove}
                          onPointerUp={handleLogoPointerUp}
                          onPointerLeave={handleLogoPointerUp}
                          title="Drag to reposition company logo"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={companyLogo.url}
                            alt="Company logo"
                            className="h-auto w-full object-contain"
                            draggable={false}
                          />
                        </div>
                      ) : null}

                      {(documentPreviewReady || (!canPdf && !canWord && !canImage && !canText)) && (
                        <>
                          <canvas
                            ref={canvasRef}
                            className="pointer-events-none absolute left-0 top-0 z-10 h-full w-full"
                            aria-hidden
                          />
                          <div
                            className="absolute inset-0 z-20"
                            style={{
                              cursor: cursorStyle,
                              touchAction: paintOverlayActive ? 'none' : 'auto',
                              pointerEvents: paintOverlayActive ? 'auto' : 'none',
                            }}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerLeave={handlePointerUp}
                            aria-label="SAASA CV paint layer"
                          />
                        </>
                      )}

                      {pinAnnotations.map((ann) => (
                        <div
                          key={ann.id}
                          className="pointer-events-auto absolute z-[25] max-w-[min(240px,40vw)]"
                          style={{
                            left: `${ann.x}%`,
                            top: `${ann.y}%`,
                            transform: 'translate(-50%, -50%)',
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          {ann.type === 'important' ? (
                            <div className="flex items-start gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 shadow-md">
                              <Star size={14} className="shrink-0 fill-red-600 text-red-600" />
                              {ann.text ? (
                                <span className="text-xs font-medium text-red-900">{ann.text}</span>
                              ) : null}
                            </div>
                          ) : (
                            <div className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 shadow-md">
                              <MessageSquare size={14} className="inline text-blue-600" />
                              {ann.text ? (
                                <p className="mt-0.5 text-xs text-blue-900">{ann.text}</p>
                              ) : null}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {canEdit ? (
                  <p className="shrink-0 px-3 pb-2 text-center text-xs text-slate-500">
                    {spacePanHeld
                      ? 'Release Space to return to the selected tool'
                      : activeTool === 'scroll' || documentPreviewReady
                        ? 'Scroll this panel — paint stays fixed on the document (MS Paint style)'
                        : (canPdf && pdfLoading) || (canImage && imageLoading)
                          ? 'Loading CV…'
                          : activeTool
                            ? `${TOOL_CONFIG.find((t) => t.type === activeTool)?.hint ?? ''}${
                                usesBrush && brushOpacity >= 0.99
                                  ? ' · 100% opacity hides CV text'
                                  : usesBrush
                                    ? ` · ${Math.round(brushOpacity * 100)}% opacity`
                                    : ''
                              }`
                            : 'Select Scroll CV or a paint tool'}
                  </p>
                ) : null}
              </div>

              <aside className="flex min-h-0 w-full max-h-[38vh] shrink-0 flex-col border-t border-slate-200 bg-slate-50 lg:max-h-none lg:w-72 lg:shrink-0 lg:border-l lg:border-t-0">
                <div className="shrink-0 border-b border-slate-200 px-4 py-3">
                  <h4 className="text-sm font-semibold text-slate-900">Paint tools</h4>
                  <p className="mt-0.5 text-xs text-slate-500">Same idea as MS Paint — brush, box, eraser</p>
                </div>

                <div
                  ref={sidebarScrollRef}
                  className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain"
                >
                {canEdit ? (
                  <>
                    <div className="flex flex-col gap-2 border-b border-slate-200 p-3">
                      {TOOL_CONFIG.map((tool) => (
                        <button
                          key={String(tool.type)}
                          type="button"
                          onClick={() => {
                            setActiveTool((prev) => (prev === tool.type ? null : tool.type));
                            setDraft(null);
                            drawingRef.current = false;
                          }}
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                            activeTool === tool.type
                              ? 'border-blue-500 bg-blue-50 text-blue-800'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="rounded-lg bg-slate-100 p-1.5 text-slate-600">{tool.icon}</span>
                          <span>
                            <span className="block">{tool.label}</span>
                            <span className="block text-[11px] font-normal text-slate-500">{tool.hint}</span>
                          </span>
                        </button>
                      ))}
                    </div>

                    {canEdit ? (
                      <div className="border-b border-slate-200 px-3 py-3">
                        <p className="mb-2 text-[11px] font-medium text-slate-500">
                          Undo brush strokes, fill boxes, or eraser marks
                        </p>
                        <UndoRedoButtons
                          onUndo={handleUndo}
                          onRedo={handleRedo}
                          canUndo={undoStack.length > 0}
                          canRedo={redoStack.length > 0}
                        />
                      </div>
                    ) : null}

                    {(usesBrush || activeTool === 'eraser') && (
                      <div className="space-y-3 border-b border-slate-200 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {activeTool === 'eraser'
                            ? 'Eraser'
                            : activeTool === 'highlight'
                              ? 'Fill box'
                              : 'Brush'}
                        </p>

                        {activeTool !== 'eraser' ? (
                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-slate-700">Color</label>
                            <div className="flex flex-wrap gap-1.5">
                              {SAASA_CV_COLOR_PRESETS.map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => setBrushColor(preset)}
                                  className={`h-7 w-7 rounded-lg border-2 ${
                                    brushColor === preset ? 'border-blue-600 ring-2 ring-blue-200' : 'border-white'
                                  }`}
                                  style={{ backgroundColor: preset }}
                                />
                              ))}
                              <label className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-slate-300 text-[9px] font-bold text-slate-500">
                                +
                                <input
                                  type="color"
                                  value={brushColor.startsWith('#') ? brushColor : '#FDE047'}
                                  onChange={(e) => setBrushColor(e.target.value)}
                                  className="absolute inset-0 cursor-pointer opacity-0"
                                />
                              </label>
                            </div>
                          </div>
                        ) : null}

                        {activeTool !== 'eraser' ? (
                          <div>
                            <div className="mb-1 flex justify-between text-xs">
                              <span className="font-medium text-slate-700">Opacity</span>
                              <span className="tabular-nums text-slate-500">{Math.round(brushOpacity * 100)}%</span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={Math.round(brushOpacity * 100)}
                              onChange={(e) => setBrushOpacity(Number(e.target.value) / 100)}
                              className="w-full accent-blue-600"
                            />
                            <p className="mt-1 text-[10px] text-slate-500">
                              100% = solid paint; CV text will not show through.
                            </p>
                            <div
                              className="mt-2 h-8 rounded-lg border border-slate-200"
                              style={{ backgroundColor: colorWithOpacity(brushColor, brushOpacity) }}
                            />
                          </div>
                        ) : null}

                        {(activeTool === 'draw' || activeTool === 'eraser') && (
                          <div>
                            <div className="mb-1 flex justify-between text-xs">
                              <span className="font-medium text-slate-700">
                                {activeTool === 'eraser' ? 'Eraser size' : 'Brush size'}
                              </span>
                              <span className="text-slate-500">{brushSizePx}px</span>
                            </div>
                            <input
                              type="range"
                              min={2}
                              max={48}
                              value={brushSizePx}
                              onChange={(e) => setBrushSizePx(Number(e.target.value))}
                              className="w-full accent-blue-600"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="px-4 py-3 text-xs text-slate-500">View only</p>
                )}

                {(() => {
                  const pinNotes = annotations.filter(
                    (a) => a.type === 'comment' || a.type === 'important'
                  );
                  if (!pinNotes.length) return null;
                  return (
                    <div className="border-t border-slate-200 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Pinned notes
                      </p>
                      <ul className="space-y-2">
                        {pinNotes.map((ann) => (
                          <li
                            key={ann.id}
                            className="rounded-xl border border-slate-200 bg-white p-2.5 text-xs shadow-sm"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold capitalize text-slate-800">{ann.type}</span>
                              {canEdit ? (
                                <button
                                  type="button"
                                  onClick={() => removeAnnotation(ann.id)}
                                  className="rounded p-1 text-slate-400 hover:text-red-600"
                                  aria-label="Remove note"
                                >
                                  <Trash2 size={14} />
                                </button>
                              ) : null}
                            </div>
                            {editingId === ann.id && canEdit ? (
                              <div className="mt-2">
                                <textarea
                                  value={draftText}
                                  onChange={(e) => setDraftText(e.target.value)}
                                  rows={2}
                                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={commitEdit}
                                  className="mt-1 text-[11px] font-semibold text-blue-600"
                                >
                                  Done
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={!canEdit}
                                onClick={() => {
                                  setEditingId(ann.id);
                                  setDraftText(ann.text);
                                }}
                                className="mt-1 block w-full text-left text-slate-600 disabled:cursor-default"
                              >
                                {ann.text || '(add note)'}
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}
                </div>
              </aside>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
