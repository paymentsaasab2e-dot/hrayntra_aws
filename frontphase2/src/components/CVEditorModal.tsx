import { useState, useRef, useCallback, useEffect } from "react";
import type { CVEditorData, CvEditorSectionId } from "../lib/cvEditorMapping";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExpItem {
  id: number;
  role: string;
  company: string;
  period: string;
  desc: string;
}

interface EduItem {
  id: number;
  degree: string;
  school: string;
  period: string;
}

interface WatermarkConfig {
  text: string;
  opacity: number;
  color: string;
  active: boolean;
}

interface CVEditorModalProps {
  initialData?: CVEditorData | null;
  onClose?: () => void;
  /** Plain-text export (legacy) */
  onSubmit?: (cvText: string) => void;
  /** Structured save — used by Submit to Client drawer */
  onSave?: (data: CVEditorData) => void | Promise<void>;
  primaryButtonLabel?: string;
  /** Read-only preview (View CV) */
  readOnly?: boolean;
  /** Inline on a page (e.g. public client review) — no fullscreen overlay */
  embedded?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _idCounter = 100;
const uid = () => ++_idCounter;

const DEFAULT_EXP: ExpItem[] = [
  {
    id: uid(),
    role: "Senior Product Designer",
    company: "Stripe Inc.",
    period: "Jan 2021 – Present",
    desc: "Led end-to-end design for Stripe Dashboard redesign serving 2M+ merchants. Established a component library adopted by 12 teams.",
  },
  {
    id: uid(),
    role: "Product Designer",
    company: "Figma",
    period: "Mar 2018 – Dec 2020",
    desc: "Designed core collaboration features including multiplayer cursors and commenting. Shipped 4 major launches that grew DAU by 3×.",
  },
];

const DEFAULT_EDU: EduItem[] = [
  {
    id: uid(),
    degree: "B.Des Interaction Design",
    school: "Rhode Island School of Design — 3.9 GPA",
    period: "2014 – 2018",
  },
];

const DEFAULT_SKILLS = [
  "Figma", "Sketch", "User Research", "Prototyping",
  "Design Systems", "Usability Testing", "HTML / CSS",
];

const DEFAULT_SECTION_ORDER: CvEditorSectionId[] = ["summary", "experience", "education", "skills"];

const SECTION_TITLES: Record<CvEditorSectionId, string> = {
  summary: "Professional Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
};

interface ImagePlacement {
  x: number;
  y: number;
}

function moveInOrder<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function moveSectionOrder(order: CvEditorSectionId[], id: CvEditorSectionId, direction: -1 | 1): CvEditorSectionId[] {
  const index = order.indexOf(id);
  return index < 0 ? order : (moveInOrder(order, index, direction) as CvEditorSectionId[]);
}

// ─── Delete control on CV photo / logo ─────────────────────────────────────────

function CvImageDeleteButton({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        top: 3,
        right: 3,
        width: 22,
        height: 22,
        borderRadius: "50%",
        border: "1.5px solid #fff",
        background: "#E24B4A",
        color: "#fff",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 30,
        padding: 0,
        boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </svg>
    </button>
  );
}

// ─── Draggable image on CV canvas ─────────────────────────────────────────────

interface DraggableCvImageProps {
  src: string | null;
  label: string;
  placement: ImagePlacement;
  width: number;
  height: number;
  borderRadius: number | string;
  onPlacementChange: (placement: ImagePlacement) => void;
  onUploadClick: () => void;
  onRemove?: () => void;
  readOnly?: boolean;
}

function DraggableCvImage({
  src,
  label,
  placement,
  width,
  height,
  borderRadius,
  onPlacementChange,
  onUploadClick,
  onRemove,
  readOnly = false,
}: DraggableCvImageProps) {
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly) return;
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: placement.x,
      originY: placement.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    onPlacementChange({
      x: Math.max(0, dragRef.current.originX + dx),
      y: Math.max(0, dragRef.current.originY + dy),
    });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={readOnly ? undefined : onUploadClick}
      title={
        readOnly
          ? label
          : `Drag to move · Double-click to upload ${label}`
      }
      style={{
        position: "absolute",
        left: placement.x,
        top: placement.y,
        width,
        height,
        borderRadius,
        border: `1.5px dashed ${src ? "#185FA5" : "#ccc"}`,
        background: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: readOnly ? "default" : "grab",
        overflow: "hidden",
        zIndex: 20,
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        touchAction: "none",
      }}
    >
      {src ? (
        <img src={src} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} />
      ) : (
        <span style={{ fontSize: 22, color: "#ccc", pointerEvents: "none" }}>{label === "Candidate" ? "👤" : "🏢"}</span>
      )}
      {!readOnly && onRemove ? (
        <CvImageDeleteButton
          title={src ? `Remove ${label.toLowerCase()}` : `Hide ${label.toLowerCase()} placeholder`}
          onClick={onRemove}
        />
      ) : null}
    </div>
  );
}

interface SectionHeadProps {
  title: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  readOnly?: boolean;
}

function SectionHead({ title, canMoveUp, canMoveDown, onMoveUp, onMoveDown, readOnly = false }: SectionHeadProps) {
  const btnStyle: React.CSSProperties = {
    width: 24,
    height: 24,
    border: "0.5px solid #ccc",
    borderRadius: 4,
    background: "#fff",
    cursor: "pointer",
    fontSize: 12,
    color: "#555",
    lineHeight: 1,
    padding: 0,
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 7px" }}>
      <div
        style={{
          flex: 1,
          fontSize: 9.5,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "#1a1a1a",
          borderBottom: "0.5px solid #ccc",
          paddingBottom: 3,
          userSelect: "none",
        }}
      >
        {title}
      </div>
      {!readOnly ? (
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button type="button" style={{ ...btnStyle, opacity: canMoveUp ? 1 : 0.35 }} disabled={!canMoveUp} onClick={onMoveUp} title="Move section up">
            ↑
          </button>
          <button type="button" style={{ ...btnStyle, opacity: canMoveDown ? 1 : 0.35 }} disabled={!canMoveDown} onClick={onMoveDown} title="Move section down">
            ↓
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ─── Watermark Layer ──────────────────────────────────────────────────────────

function WatermarkLayer({ config }: { config: WatermarkConfig }) {
  if (!config.active || !config.text) return null;

  const r = parseInt(config.color.slice(1, 3), 16);
  const g = parseInt(config.color.slice(3, 5), 16);
  const b = parseInt(config.color.slice(5, 7), 16);
  const rgba = `rgba(${r},${g},${b},${config.opacity / 100})`;

  const positions = [
    { top: "8%",  left: "-10%" }, { top: "22%", left: "5%"  },
    { top: "36%", left: "-5%"  }, { top: "50%", left: "10%" },
    { top: "64%", left: "-8%"  }, { top: "78%", left: "5%"  },
    { top: "92%", left: "0%"   }, { top: "14%", left: "40%" },
    { top: "28%", left: "55%"  }, { top: "42%", left: "40%" },
    { top: "56%", left: "50%"  }, { top: "70%", left: "38%" },
    { top: "84%", left: "48%"  },
  ];

  return (
    <div
      style={{
        position: "absolute", top: 0, left: 0,
        width: "100%", height: "100%",
        pointerEvents: "none", overflow: "hidden", zIndex: 10,
      }}
    >
      {positions.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: p.top, left: p.left,
            fontSize: 50, fontWeight: 700,
            color: rgba,
            transform: "rotate(-35deg)",
            whiteSpace: "nowrap",
            fontFamily: "Georgia, serif",
            letterSpacing: 2,
            userSelect: "none",
          }}
        >
          {config.text}
        </span>
      ))}
    </div>
  );
}

// ─── Editable Span ────────────────────────────────────────────────────────────

interface EditableProps {
  value: string;
  onChange: (v: string) => void;
  style?: React.CSSProperties;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  readOnly?: boolean;
}

function Editable({ value, onChange, style, placeholder, multiline, readOnly = false }: EditableProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isComposing = useRef(false);

  useEffect(() => {
    if (ref.current && ref.current.innerText !== value) {
      ref.current.innerText = value;
    }
  }, [value]);

  if (readOnly) {
    return (
      <span style={{ display: "block", whiteSpace: multiline ? "pre-wrap" : "normal", ...style }}>
        {value || placeholder || ""}
      </span>
    );
  }

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-placeholder={placeholder}
      onCompositionStart={() => { isComposing.current = true; }}
      onCompositionEnd={(e) => {
        isComposing.current = false;
        onChange((e.currentTarget as HTMLSpanElement).innerText);
      }}
      onInput={(e) => {
        if (!isComposing.current) {
          onChange((e.currentTarget as HTMLSpanElement).innerText);
        }
      }}
      onKeyDown={(e) => {
        if (!multiline && e.key === "Enter") e.preventDefault();
      }}
      style={{
        outline: "none",
        cursor: "text",
        borderRadius: 2,
        display: "block",
        minWidth: 30,
        transition: "background 0.1s",
        ...style,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLSpanElement).style.background = "rgba(24,95,165,0.07)";
      }}
      onMouseLeave={(e) => {
        if (document.activeElement !== e.currentTarget)
          (e.currentTarget as HTMLSpanElement).style.background = "transparent";
      }}
      onFocus={(e) => {
        (e.currentTarget as HTMLSpanElement).style.background = "rgba(24,95,165,0.11)";
        (e.currentTarget as HTMLSpanElement).style.boxShadow = "0 0 0 1.5px rgba(24,95,165,0.4)";
      }}
      onBlur={(e) => {
        (e.currentTarget as HTMLSpanElement).style.background = "transparent";
        (e.currentTarget as HTMLSpanElement).style.boxShadow = "none";
      }}
    />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function buildEditorSnapshot(
  name: string,
  jobTitle: string,
  email: string,
  phone: string,
  location: string,
  linkedin: string,
  summary: string,
  experiences: ExpItem[],
  education: EduItem[],
  skills: string[],
  candidatePhotoUrl: string | null,
  initialCandidatePhotoUrl: string | null,
  companyLogoUrl: string | null,
  initialCompanyLogoUrl: string | null,
  candidatePhotoPos: ImagePlacement,
  companyLogoPos: ImagePlacement,
  showCandidatePhotoSlot: boolean,
  showCompanyLogoSlot: boolean,
  sectionOrder: CvEditorSectionId[],
  watermark: WatermarkConfig
): CVEditorData {
  return {
    name,
    jobTitle,
    email,
    phone,
    location,
    linkedin,
    summary,
    experiences: experiences.map((e) => ({ ...e })),
    education: education.map((e) => ({ ...e })),
    skills: [...skills],
    candidatePhotoUrl,
    initialCandidatePhotoUrl,
    companyLogoUrl,
    initialCompanyLogoUrl,
    candidatePhotoPos: { ...candidatePhotoPos },
    companyLogoPos: { ...companyLogoPos },
    showCandidatePhotoSlot,
    showCompanyLogoSlot,
    sectionOrder: [...sectionOrder],
    watermark: { ...watermark },
  };
}

export default function CVEditorModal({
  initialData,
  onClose,
  onSubmit,
  onSave,
  primaryButtonLabel = "Save CV",
  readOnly = false,
  embedded = false,
}: CVEditorModalProps) {
  const [name, setName] = useState(initialData?.name ?? "Alexandra Chen");
  const [jobTitle, setJobTitle] = useState(initialData?.jobTitle ?? "Senior Product Designer");
  const [email, setEmail] = useState(initialData?.email ?? "alex.chen@email.com");
  const [phone, setPhone] = useState(initialData?.phone ?? "+1 (415) 555-0192");
  const [location, setLocation] = useState(initialData?.location ?? "San Francisco, CA");
  const [linkedin, setLinkedin] = useState(initialData?.linkedin ?? "linkedin.com/in/alexchen");
  const [summary, setSummary] = useState(
    initialData?.summary ??
      "Award-winning product designer with 8+ years crafting user-centred digital experiences across fintech and SaaS. Led redesigns that increased user engagement by 40% and drove $12M in new ARR."
  );
  const hasInitial = initialData != null;
  const [experiences, setExperiences] = useState<ExpItem[]>(
    hasInitial ? initialData.experiences : DEFAULT_EXP
  );
  const [education, setEducation] = useState<EduItem[]>(
    hasInitial ? initialData.education : DEFAULT_EDU
  );
  const [skills, setSkills] = useState<string[]>(
    hasInitial ? initialData.skills : DEFAULT_SKILLS
  );
  const [newSkill, setNewSkill] = useState("");

  // Photo state — draggable on CV canvas
  const [candidatePhoto, setCandidatePhoto] = useState<string | null>(
    initialData?.candidatePhotoUrl ?? null
  );
  const initialCandidatePhotoRef = useRef<string | null>(
    initialData?.initialCandidatePhotoUrl ?? initialData?.candidatePhotoUrl ?? null
  );
  const [companyLogo, setCompanyLogo] = useState<string | null>(
    initialData?.companyLogoUrl ?? null
  );
  const initialCompanyLogoRef = useRef<string | null>(
    initialData?.initialCompanyLogoUrl ?? initialData?.companyLogoUrl ?? null
  );
  const [candidatePhotoPos, setCandidatePhotoPos] = useState<ImagePlacement>(
    initialData?.candidatePhotoPos ?? { x: 430, y: 36 }
  );
  const [companyLogoPos, setCompanyLogoPos] = useState<ImagePlacement>(
    initialData?.companyLogoPos ?? { x: 430, y: 118 }
  );
  const [showCandidatePhotoSlot, setShowCandidatePhotoSlot] = useState(
    initialData?.showCandidatePhotoSlot !== false
  );
  const [showCompanyLogoSlot, setShowCompanyLogoSlot] = useState(
    initialData?.showCompanyLogoSlot !== false
  );
  const [sectionOrder, setSectionOrder] = useState<CvEditorSectionId[]>(
    initialData?.sectionOrder?.length ? initialData.sectionOrder : DEFAULT_SECTION_ORDER
  );

  // Watermark state
  const [wm, setWm] = useState<WatermarkConfig>(
    initialData?.watermark ?? {
      text: "CONFIDENTIAL", opacity: 8, color: "#000000", active: false,
    }
  );
  const [showWmPanel, setShowWmPanel] = useState(false);

  // Status bar
  const [status, setStatus] = useState("Click any text on the CV to edit it directly");
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const candidateInputRef = useRef<HTMLInputElement>(null);
  const companyInputRef = useRef<HTMLInputElement>(null);
  const cvPageRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!initialData) return;
    setName(initialData.name);
    setJobTitle(initialData.jobTitle);
    setEmail(initialData.email);
    setPhone(initialData.phone);
    setLocation(initialData.location);
    setLinkedin(initialData.linkedin);
    setSummary(initialData.summary);
    setExperiences(initialData.experiences);
    setEducation(initialData.education);
    setSkills(initialData.skills);
    const photoUrl = initialData.candidatePhotoUrl?.trim() || null;
    setCandidatePhoto(photoUrl);
    initialCandidatePhotoRef.current =
      initialData.initialCandidatePhotoUrl?.trim() || photoUrl;
    const logoUrl = initialData.companyLogoUrl?.trim() || null;
    setCompanyLogo(logoUrl);
    initialCompanyLogoRef.current =
      initialData.initialCompanyLogoUrl?.trim() || logoUrl;
    setCandidatePhotoPos(initialData.candidatePhotoPos ?? { x: 430, y: 36 });
    setCompanyLogoPos(initialData.companyLogoPos ?? { x: 430, y: 118 });
    setShowCandidatePhotoSlot(initialData.showCandidatePhotoSlot !== false);
    setShowCompanyLogoSlot(initialData.showCompanyLogoSlot !== false);
    setSectionOrder(
      initialData.sectionOrder?.length ? initialData.sectionOrder : DEFAULT_SECTION_ORDER
    );
    setWm(
      initialData.watermark ?? {
        text: "CONFIDENTIAL", opacity: 8, color: "#000000", active: false,
      }
    );
  }, [initialData]);

  const showStatus = useCallback((msg: string) => {
    setStatus(msg);
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => {
      setStatus("Click any text on the CV to edit it directly");
    }, 2500);
  }, []);

  const removeCandidatePhoto = useCallback(() => {
    setCandidatePhoto(null);
    setShowCandidatePhotoSlot(false);
    showStatus("Candidate photo removed");
  }, [showStatus]);

  const removeCompanyLogo = useCallback(() => {
    setCompanyLogo(null);
    setShowCompanyLogoSlot(false);
    showStatus("Company logo removed");
  }, [showStatus]);

  // ── Photo handlers ──────────────────────────────────────────────────────────

  const handlePhotoUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (v: string) => void,
    label: string,
    showSlot?: () => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    showSlot?.();
    const reader = new FileReader();
    reader.onload = (ev) => {
      setter(ev.target?.result as string);
      showStatus(`${label} added`);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ── Formatting (execCommand) ────────────────────────────────────────────────

  const fmt = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
  };

  const changeFontSize = (dir: number) => {
    const sel = window.getSelection();
    if (!sel?.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    const node = range.startContainer.parentElement;
    const cur = parseFloat(window.getComputedStyle(node!).fontSize) || 11;
    const span = document.createElement("span");
    span.style.fontSize = `${Math.max(8, cur + dir)}px`;
    try { range.surroundContents(span); } catch {}
  };

  // ── Experience ──────────────────────────────────────────────────────────────

  const addExp = () => {
    const item: ExpItem = {
      id: uid(), role: "Job Title", company: "Company Name",
      period: "Year – Year", desc: "Describe your key achievements and responsibilities.",
    };
    setExperiences((prev) => [...prev, item]);
    showStatus("New position added — click to edit");
  };

  const removeExp = (id: number) => {
    setExperiences((prev) => prev.filter((e) => e.id !== id));
    showStatus("Position removed");
  };

  const moveExp = (id: number, direction: -1 | 1) => {
    setExperiences((prev) => {
      const index = prev.findIndex((e) => e.id === id);
      return index < 0 ? prev : moveInOrder(prev, index, direction);
    });
  };

  const updateExp = (id: number, field: keyof ExpItem, value: string) => {
    setExperiences((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  };

  // ── Education ───────────────────────────────────────────────────────────────

  const addEdu = () => {
    const item: EduItem = {
      id: uid(), degree: "Degree / Qualification",
      school: "University / School", period: "Year – Year",
    };
    setEducation((prev) => [...prev, item]);
    showStatus("New education added — click to edit");
  };

  const removeEdu = (id: number) => {
    setEducation((prev) => prev.filter((e) => e.id !== id));
    showStatus("Education removed");
  };

  const moveEdu = (id: number, direction: -1 | 1) => {
    setEducation((prev) => {
      const index = prev.findIndex((e) => e.id === id);
      return index < 0 ? prev : moveInOrder(prev, index, direction);
    });
  };

  const moveSection = (id: CvEditorSectionId, direction: -1 | 1) => {
    setSectionOrder((prev) => moveSectionOrder(prev, id, direction));
    showStatus("Section order updated");
  };

  const updateEdu = (id: number, field: keyof EduItem, value: string) => {
    setEducation((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  };

  // ── Skills ──────────────────────────────────────────────────────────────────

  const addSkill = () => {
    const trimmed = newSkill.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills((prev) => [...prev, trimmed]);
      setNewSkill("");
      showStatus("Skill added");
    }
  };

  const removeSkill = (idx: number) => {
    setSkills((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Export / Submit ─────────────────────────────────────────────────────────

  const getCVText = () => cvPageRef.current?.innerText ?? "";

  const handleExport = (type: "PDF" | "DOCX") => {
    showStatus(`Preparing ${type}…`);
    // Integrate with your export logic here
    console.log(`Export as ${type}:`, getCVText());
  };

  const handleSubmit = async () => {
    const snapshot = buildEditorSnapshot(
      name,
      jobTitle,
      email,
      phone,
      location,
      linkedin,
      summary,
      experiences,
      education,
      skills,
      candidatePhoto,
      initialCandidatePhotoRef.current,
      companyLogo,
      initialCompanyLogoRef.current,
      candidatePhotoPos,
      companyLogoPos,
      showCandidatePhotoSlot,
      showCompanyLogoSlot,
      sectionOrder,
      wm
    );
    if (onSave) {
      setSaving(true);
      try {
        await onSave(snapshot);
        showStatus("CV saved");
      } catch {
        showStatus("Could not save CV");
      } finally {
        setSaving(false);
      }
      return;
    }
    onSubmit?.(getCVText());
    showStatus("Submitted to client!");
  };

  // ── Styles (inline, no external deps) ──────────────────────────────────────

  const S = {
    overlay: {
      position: "fixed" as const, inset: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "flex-start",
      justifyContent: "center", padding: 16, zIndex: 1300,
      overflowY: "auto" as const,
    },
    modal: {
      background: "#fff", borderRadius: 12,
      border: "0.5px solid #d0d0d0",
      width: "100%", maxWidth: 860,
      maxHeight: "calc(100vh - 32px)",
      display: "flex", flexDirection: "column" as const,
      overflow: "hidden", marginTop: 8,
    },
    header: {
      display: "flex", alignItems: "center",
      justifyContent: "space-between",
      padding: "10px 14px",
      borderBottom: "0.5px solid #e0e0e0",
      background: "#f7f7f7",
    },
    headerTitle: {
      fontSize: 13, fontWeight: 500, color: "#1a1a1a",
      display: "flex", alignItems: "center", gap: 7,
    },
    hbtn: (primary?: boolean, danger?: boolean): React.CSSProperties => ({
      fontSize: 12, padding: "5px 11px",
      borderRadius: 8, cursor: "pointer",
      display: "flex", alignItems: "center", gap: 4,
      fontFamily: "inherit", border: "0.5px solid",
      borderColor: danger ? "#E24B4A" : primary ? "#185FA5" : "#d0d0d0",
      background: danger ? "#FCEBEB" : primary ? "#185FA5" : "#fff",
      color: danger ? "#A32D2D" : primary ? "#fff" : "#1a1a1a",
    }),
    toolbar: {
      display: "flex", alignItems: "center", flexWrap: "wrap" as const,
      gap: 1, padding: "5px 10px",
      borderBottom: "0.5px solid #e0e0e0",
      background: "#f7f7f7", rowGap: 4,
    },
    tgroup: {
      display: "flex", alignItems: "center",
      gap: 2, paddingRight: 8,
      borderRight: "0.5px solid #e0e0e0", marginRight: 2,
    },
    tgroupLast: {
      display: "flex", alignItems: "center", gap: 2,
    },
    tgLabel: {
      fontSize: 10, color: "#888", marginRight: 3, whiteSpace: "nowrap" as const,
    },
    tbtn: (active?: boolean, danger?: boolean): React.CSSProperties => ({
      height: 26, minWidth: 26, padding: "0 6px",
      border: `0.5px solid ${active ? "#185FA5" : danger ? "#E24B4A" : "transparent"}`,
      borderRadius: 4, background: active ? "#E6F1FB" : "none",
      cursor: "pointer", display: "flex", alignItems: "center",
      gap: 3, fontSize: 12, color: active ? "#185FA5" : danger ? "#A32D2D" : "#555",
      fontFamily: "inherit", whiteSpace: "nowrap" as const,
    }),
    wmPanel: {
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 12px",
      borderBottom: "0.5px solid #e0e0e0",
      background: "#f7f7f7", fontSize: 12, flexWrap: "wrap" as const,
    },
    pageWrap: {
      background: "#e8eaed",
      overflowY: "auto" as const,
      flex: 1,
      minHeight: 0,
      display: "flex",
      justifyContent: "center",
      alignItems: "flex-start",
      padding: "24px 16px 32px",
    },
    cvPage: {
      background: "#fff",
      width: 580,
      minHeight: 720,
      padding: "42px 48px 64px",
      fontFamily: "Georgia, serif",
      color: "#1a1a1a",
      fontSize: 11,
      lineHeight: 1.6,
      position: "relative" as const,
      flexShrink: 0,
      boxShadow: "0 4px 24px rgba(15, 23, 42, 0.12)",
    },
    cvName: {
      fontSize: 22, fontWeight: 700, color: "#1a1a1a",
      letterSpacing: -0.4, display: "block",
    },
    cvJobTitle: { fontSize: 12, color: "#555", display: "block", marginTop: 2 },
    cvContactLine: {
      fontSize: 10, color: "#777",
      display: "flex", flexWrap: "wrap" as const, marginTop: 5,
    },
    cvSep: { fontSize: 10, color: "#ccc", padding: "0 4px", userSelect: "none" as const },
    cvDivider: { border: "none", borderTop: "1.5px solid #1a1a1a", margin: "12px 0" },
    cvSectionHead: {
      fontSize: 9.5, fontWeight: 700, textTransform: "uppercase" as const,
      letterSpacing: "0.1em", color: "#1a1a1a",
      borderBottom: "0.5px solid #ccc", paddingBottom: 3,
      margin: "14px 0 7px", userSelect: "none" as const,
    },
    cvRole: { fontSize: 11.5, fontWeight: 700, display: "block" },
    cvDate: { fontSize: 10, color: "#777", display: "block", textAlign: "right" as const },
    cvCompany: {
      fontSize: 10.5, color: "#444", fontStyle: "italic" as const,
      display: "block", marginTop: 1,
    },
    cvDesc: { fontSize: 10, color: "#555", display: "block", marginTop: 3 },
    cvSummary: { fontSize: 10.5, color: "#444", display: "block" },
    cvSkill: {
      fontSize: 10, padding: "2px 8px",
      border: "0.5px solid #ccc", borderRadius: 3,
      color: "#444", cursor: "text", outline: "none",
    },
    addBtnCv: {
      fontSize: 10, padding: "2px 8px",
      border: "0.5px dashed #bbb", borderRadius: 3,
      color: "#999", cursor: "pointer", background: "none",
      fontFamily: "Georgia, serif", marginTop: 3,
    },
    photoCircle: (hasPhoto: boolean): React.CSSProperties => ({
      width: 72, height: 72, borderRadius: "50%",
      border: `1.5px dashed ${hasPhoto ? "#185FA5" : "#ccc"}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer", overflow: "hidden", flexShrink: 0,
    }),
    companyBox: (hasLogo: boolean): React.CSSProperties => ({
      width: 72, height: 40,
      border: `1.5px dashed ${hasLogo ? "#185FA5" : "#ccc"}`,
      borderRadius: 4, display: "flex", alignItems: "center",
      justifyContent: "center", cursor: "pointer", overflow: "hidden", flexShrink: 0,
    }),
    statusBar: {
      padding: "5px 12px",
      borderTop: "0.5px solid #e0e0e0",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      fontSize: 11, color: "#888", background: "#f7f7f7",
    },
    skillsRow: { display: "flex", flexWrap: "wrap" as const, gap: 5, marginTop: 2 },
    skillInput: {
      fontSize: 10, padding: "2px 6px",
      border: "0.5px solid #ccc", borderRadius: 3,
      color: "#444", fontFamily: "Georgia, serif", outline: "none", width: 90,
    },
    delExpBtn: {
      fontSize: 14, color: "#ccc", cursor: "pointer",
      border: "none", background: "none", lineHeight: 1, marginLeft: 4,
    },
    skillDelBtn: {
      fontSize: 11, color: "#bbb", cursor: "pointer",
      border: "none", background: "none", marginLeft: 2, lineHeight: 1,
    },
    itemMoveBtn: {
      fontSize: 11,
      color: "#888",
      cursor: "pointer",
      border: "0.5px solid #ddd",
      borderRadius: 3,
      background: "#fafafa",
      width: 20,
      height: 20,
      lineHeight: 1,
      marginLeft: 2,
      padding: 0,
    },
  };

  const renderSection = (sectionId: CvEditorSectionId) => {
    const index = sectionOrder.indexOf(sectionId);
    const canMoveUp = index > 0;
    const canMoveDown = index >= 0 && index < sectionOrder.length - 1;

    if (sectionId === "summary") {
      return (
        <div key="summary">
          <SectionHead
            title={SECTION_TITLES.summary}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            onMoveUp={() => moveSection("summary", -1)}
            onMoveDown={() => moveSection("summary", 1)}
            readOnly={readOnly}
          />
          <Editable readOnly={readOnly} value={summary} onChange={setSummary} style={S.cvSummary} multiline placeholder="Write a summary…" />
        </div>
      );
    }

    if (sectionId === "experience") {
      return (
        <div key="experience">
          <SectionHead
            title={SECTION_TITLES.experience}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            onMoveUp={() => moveSection("experience", -1)}
            onMoveDown={() => moveSection("experience", 1)}
          />
          {experiences.map((exp, expIndex) => (
            <div key={exp.id} style={{ marginBottom: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <Editable readOnly={readOnly} value={exp.role} onChange={(v) => updateExp(exp.id, "role", v)} style={S.cvRole} />
                <div style={{ display: "flex", alignItems: "center" }}>
                  <Editable readOnly={readOnly} value={exp.period} onChange={(v) => updateExp(exp.id, "period", v)} style={S.cvDate} />
                  {!readOnly ? (
                    <>
                      <button type="button" style={S.itemMoveBtn} disabled={expIndex === 0} onClick={() => moveExp(exp.id, -1)} title="Move up">↑</button>
                      <button type="button" style={S.itemMoveBtn} disabled={expIndex === experiences.length - 1} onClick={() => moveExp(exp.id, 1)} title="Move down">↓</button>
                      <button style={S.delExpBtn} onClick={() => removeExp(exp.id)} title="Remove position">×</button>
                    </>
                  ) : null}
                </div>
              </div>
              <Editable readOnly={readOnly} value={exp.company} onChange={(v) => updateExp(exp.id, "company", v)} style={S.cvCompany} />
              <Editable readOnly={readOnly} value={exp.desc} onChange={(v) => updateExp(exp.id, "desc", v)} style={S.cvDesc} multiline />
            </div>
          ))}
          {!readOnly ? <button style={S.addBtnCv} onClick={addExp}>+ Add position</button> : null}
        </div>
      );
    }

    if (sectionId === "education") {
      return (
        <div key="education">
          <SectionHead
            title={SECTION_TITLES.education}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            onMoveUp={() => moveSection("education", -1)}
            onMoveDown={() => moveSection("education", 1)}
            readOnly={readOnly}
          />
          {education.map((edu, eduIndex) => (
            <div key={edu.id} style={{ marginBottom: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <Editable readOnly={readOnly} value={edu.degree} onChange={(v) => updateEdu(edu.id, "degree", v)} style={S.cvRole} />
                <div style={{ display: "flex", alignItems: "center" }}>
                  <Editable readOnly={readOnly} value={edu.period} onChange={(v) => updateEdu(edu.id, "period", v)} style={S.cvDate} />
                  {!readOnly ? (
                    <>
                      <button type="button" style={S.itemMoveBtn} disabled={eduIndex === 0} onClick={() => moveEdu(edu.id, -1)} title="Move up">↑</button>
                      <button type="button" style={S.itemMoveBtn} disabled={eduIndex === education.length - 1} onClick={() => moveEdu(edu.id, 1)} title="Move down">↓</button>
                      <button style={S.delExpBtn} onClick={() => removeEdu(edu.id)} title="Remove">×</button>
                    </>
                  ) : null}
                </div>
              </div>
              <Editable readOnly={readOnly} value={edu.school} onChange={(v) => updateEdu(edu.id, "school", v)} style={S.cvCompany} />
            </div>
          ))}
          {!readOnly ? <button style={S.addBtnCv} onClick={addEdu}>+ Add education</button> : null}
        </div>
      );
    }

    return (
      <div key="skills">
        <SectionHead
          title={SECTION_TITLES.skills}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onMoveUp={() => moveSection("skills", -1)}
            onMoveDown={() => moveSection("skills", 1)}
            readOnly={readOnly}
          />
        <div style={S.skillsRow}>
          {skills.map((skill, i) => (
            <span key={i} style={{ ...S.cvSkill, display: "inline-flex", alignItems: "center", gap: 2 }}>
              {skill}
              {!readOnly ? (
                <button style={S.skillDelBtn} onClick={() => removeSkill(i)} title="Remove skill">×</button>
              ) : null}
            </span>
          ))}
          {!readOnly ? (
            <input
              type="text"
              placeholder="+ Add skill"
              value={newSkill}
              style={S.skillInput}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addSkill();
              }}
              onBlur={addSkill}
            />
          ) : null}
        </div>
      </div>
    );
  };

  const shellStyle: React.CSSProperties = embedded
    ? { width: '100%', display: 'flex', justifyContent: 'center' }
    : S.overlay;

  const panelStyle: React.CSSProperties = embedded
    ? { ...S.modal, maxWidth: '100%', maxHeight: 'none', marginTop: 0 }
    : S.modal;

  return (
    <div style={shellStyle}>
      {/* Hidden file inputs */}
      <input
        ref={candidateInputRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) =>
          handlePhotoUpload(e, setCandidatePhoto, "Candidate photo", () => setShowCandidatePhotoSlot(true))
        }
      />
      <input
        ref={companyInputRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) =>
          handlePhotoUpload(e, setCompanyLogo, "Company logo", () => setShowCompanyLogoSlot(true))
        }
      />

      <div style={panelStyle}>
        {/* ── Header ── */}
        <div style={S.header}>
          <div style={S.headerTitle}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>
            {readOnly ? (embedded ? 'Candidate CV' : 'View CV') : 'Submit to Client — CV Editor'}
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            {!readOnly ? (
              <>
                <button style={S.hbtn()} onClick={() => handleExport("PDF")}>📄 PDF</button>
                <button style={S.hbtn()} onClick={() => handleExport("DOCX")}>📝 DOCX</button>
                <button style={S.hbtn(true)} onClick={() => void handleSubmit()} disabled={saving}>
                  {saving ? "Saving…" : `➤ ${primaryButtonLabel}`}
                </button>
              </>
            ) : null}
            {onClose ? (
              <button style={S.hbtn()} onClick={onClose}>{readOnly ? "Close" : "✕"}</button>
            ) : null}
          </div>
        </div>

        {!readOnly ? (
        <>
        {/* ── Toolbar ── */}
        <div style={S.toolbar}>
          {/* Format */}
          <div style={S.tgroup}>
            <span style={S.tgLabel}>Format</span>
            <button style={S.tbtn()} onClick={() => fmt("bold")} title="Bold"><b>B</b></button>
            <button style={S.tbtn()} onClick={() => fmt("italic")} title="Italic"><i>I</i></button>
            <button style={S.tbtn()} onClick={() => fmt("underline")} title="Underline"><u>U</u></button>
            <button style={S.tbtn()} onClick={() => changeFontSize(1)} title="Bigger">A↑</button>
            <button style={S.tbtn()} onClick={() => changeFontSize(-1)} title="Smaller">A↓</button>
            <label style={{ ...S.tbtn(), position: "relative", cursor: "pointer" }} title="Text colour">
              A🎨
              <input type="color" defaultValue="#1a1a1a" onChange={(e) => fmt("foreColor", e.target.value)}
                style={{ opacity: 0, position: "absolute", width: 0, height: 0 }} />
            </label>
            <button style={S.tbtn()} onClick={() => document.execCommand("undo")} title="Undo">↩</button>
            <button style={S.tbtn()} onClick={() => document.execCommand("redo")} title="Redo">↪</button>
          </div>

          {/* Candidate Photo */}
          <div style={S.tgroup}>
            <span style={S.tgLabel}>Candidate photo</span>
            <button
              style={S.tbtn()}
              onClick={() => {
                setShowCandidatePhotoSlot(true);
                candidateInputRef.current?.click();
              }}
              title="Upload candidate photo"
            >
              👤 Upload
            </button>
            {(candidatePhoto || showCandidatePhotoSlot) && (
              <button style={S.tbtn(false, true)} onClick={removeCandidatePhoto} title="Remove candidate photo">
                ✕ Remove
              </button>
            )}
          </div>

          {/* Company Logo */}
          <div style={S.tgroup}>
            <span style={S.tgLabel}>Company logo</span>
            <button
              style={S.tbtn()}
              onClick={() => {
                setShowCompanyLogoSlot(true);
                companyInputRef.current?.click();
              }}
              title="Upload company logo"
            >
              🏢 Upload
            </button>
            {(companyLogo || showCompanyLogoSlot) && (
              <button style={S.tbtn(false, true)} onClick={removeCompanyLogo} title="Remove company logo">
                ✕ Remove
              </button>
            )}
          </div>

          {/* Watermark */}
          <div style={S.tgroup}>
            <span style={S.tgLabel}>Watermark</span>
            <button
              style={S.tbtn(showWmPanel || wm.active)}
              onClick={() => setShowWmPanel((v) => !v)}
              title="Watermark settings"
            >
              💧 {wm.active ? "Edit" : "Add"}
            </button>
            {wm.active && (
              <button
                style={S.tbtn(false, true)}
                onClick={() => { setWm((w) => ({ ...w, active: false })); setShowWmPanel(false); showStatus("Watermark removed"); }}
                title="Remove watermark"
              >
                ✕ Remove
              </button>
            )}
          </div>

          {/* Add sections */}
          <div style={S.tgroupLast}>
            <span style={S.tgLabel}>Add</span>
            <button style={S.tbtn()} onClick={addExp} title="Add experience">💼 Experience</button>
            <button style={S.tbtn()} onClick={addEdu} title="Add education">🎓 Education</button>
            <button style={S.tbtn()} onClick={() => setNewSkill(" ")} title="Add skill">🏷 Skill</button>
          </div>
        </div>

        {/* ── Watermark Panel ── */}
        {showWmPanel && (
          <div style={S.wmPanel}>
            <span style={{ fontSize: 12, color: "#888" }}>💧 Watermark</span>
            <label style={{ fontSize: 11, color: "#888" }}>Text</label>
            <input
              type="text" value={wm.text} style={{ ...S.skillInput, width: 130, fontSize: 12 }}
              onChange={(e) => setWm((w) => ({ ...w, text: e.target.value }))}
            />
            <label style={{ fontSize: 11, color: "#888" }}>Opacity</label>
            <input
              type="range" min={2} max={25} step={1} value={wm.opacity}
              style={{ width: 80 }}
              onChange={(e) => setWm((w) => ({ ...w, opacity: parseInt(e.target.value) }))}
            />
            <span style={{ fontSize: 11, color: "#888" }}>{wm.opacity}%</span>
            <label style={{ fontSize: 11, color: "#888" }}>Colour</label>
            <input
              type="color" value={wm.color}
              style={{ width: 28, height: 28, border: "0.5px solid #ccc", borderRadius: 4, cursor: "pointer", padding: 1 }}
              onChange={(e) => setWm((w) => ({ ...w, color: e.target.value }))}
            />
            <button
              style={{ ...S.hbtn(true), fontSize: 12 }}
              onClick={() => { setWm((w) => ({ ...w, active: true })); setShowWmPanel(false); showStatus("Watermark applied"); }}
            >
              ✓ Apply
            </button>
          </div>
        )}
        </>
        ) : null}

        {/* ── CV Page ── */}
        <div style={S.pageWrap}>
          <div ref={cvPageRef} style={S.cvPage}>
            <WatermarkLayer config={wm} />

            {showCandidatePhotoSlot ? (
              <DraggableCvImage
                src={candidatePhoto}
                label="Candidate"
                placement={candidatePhotoPos}
                width={72}
                height={72}
                borderRadius="50%"
                onPlacementChange={setCandidatePhotoPos}
                onUploadClick={() => {
                  setShowCandidatePhotoSlot(true);
                  candidateInputRef.current?.click();
                }}
                onRemove={removeCandidatePhoto}
                readOnly={readOnly}
              />
            ) : null}
            {showCompanyLogoSlot ? (
              <DraggableCvImage
                src={companyLogo}
                label="Company"
                placement={companyLogoPos}
                width={88}
                height={48}
                borderRadius={4}
                onPlacementChange={setCompanyLogoPos}
                onUploadClick={() => {
                  setShowCompanyLogoSlot(true);
                  companyInputRef.current?.click();
                }}
                onRemove={removeCompanyLogo}
                readOnly={readOnly}
              />
            ) : null}

            <div style={{ paddingRight: 100, position: "relative", zIndex: 1 }}>
              <Editable readOnly={readOnly} value={name} onChange={setName} style={S.cvName} placeholder="Full Name" />
              <Editable readOnly={readOnly} value={jobTitle} onChange={setJobTitle} style={S.cvJobTitle} placeholder="Job Title" />
              <div style={S.cvContactLine}>
                <Editable readOnly={readOnly} value={email} onChange={setEmail} style={{ display: "inline", minWidth: 20, padding: "0 2px" }} />
                <span style={S.cvSep}>·</span>
                <Editable readOnly={readOnly} value={phone} onChange={setPhone} style={{ display: "inline", minWidth: 20, padding: "0 2px" }} />
                <span style={S.cvSep}>·</span>
                <Editable readOnly={readOnly} value={location} onChange={setLocation} style={{ display: "inline", minWidth: 20, padding: "0 2px" }} />
                <span style={S.cvSep}>·</span>
                <Editable readOnly={readOnly} value={linkedin} onChange={setLinkedin} style={{ display: "inline", minWidth: 20, padding: "0 2px" }} />
              </div>
            </div>

            <hr style={S.cvDivider} />

            {sectionOrder.map((sectionId) => renderSection(sectionId))}
          </div>
        </div>

        {/* ── Status Bar ── */}
        <div style={S.statusBar}>
          <span>✏️ {status}</span>
          <span>Drag photos to reposition · ↑↓ reorder sections &amp; entries</span>
        </div>
      </div>
    </div>
  );
}
