'use client';

import React, { useEffect, useMemo, useRef, useState } from "react";
import { 
  Search, 
  Filter, 
  LayoutDashboard, 
  List, 
  ChevronRight, 
  MoreHorizontal, 
  User, 
  Building2, 
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowRight,
  MoreVertical,
  Briefcase,
  Users,
  Settings,
  Mail,
  PieChart,
  LogOut,
  Bell
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { DndProvider, useDrag, useDrop, DragSourceMonitor, DropTargetMonitor } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { matchesQuickSearch, buildQuickSearchHaystack } from "../../lib/quickSearch";
import { useRouter } from "next/navigation";
import { ImageWithFallback, initialsFromDisplayName } from "../../components/ImageWithFallback";
import { formatDateDMY } from "../../utils/dateDisplay";
import AddCandidateDrawer from "../../components/candidates/AddCandidateDrawer";
import { usePageAutoRefresh } from "../../hooks/usePageAutoRefresh";
import { useWorkspaceEntityAlerts } from "../../hooks/useWorkspaceEntityAlerts";
import { WorkspaceAlertTableCell, WorkspaceAlertTableHeader } from "../../components/ai/WorkspaceAlertTableCell";
import { TableColumnsMenu } from "../../components/table/TableColumnsMenu";
import { useFormatTableLocationCell } from "../../components/table/LocationColumnHeader";
import { usePersistedColumnVisibility } from "../../hooks/usePersistedColumnVisibility";
import { PIPELINE_TABLE_COLUMNS } from "../../lib/tableColumns/moduleTableColumns";
import {
  apiGetCandidates,
  apiGetJobs,
  apiGetMe,
  apiGetPipelineStages,
  apiGetUsers,
  apiMoveCandidateStage,
  apiFetch,
  type BackendCandidate,
  type BackendJob,
  type BackendUser,
} from "../../lib/api";
import { shouldIncludePhase1CommonPool } from "../../lib/phase1CommonPoolAccess";
import {
  displayJobStatusFromBackend,
  mapJobStatusLabelToBackend,
} from "../../lib/jobStatus";
import {
  candidateHasRealJobAssignment,
  resolveCandidateListStage,
} from "../../lib/candidateListMapping";
import { resolveSubmitJobIdFromBackend } from "../../lib/candidateSubmitToClient";
import { isValidObjectId } from "../../lib/mapCandidateProfile";
import { getCandidateStageBadgeClasses } from "../../utils/candidateStage";

function isOpenPipelineJob(job: BackendJob): boolean {
  const label = displayJobStatusFromBackend(job.status, job.statusLabel);
  return mapJobStatusLabelToBackend(label) === 'OPEN';
}
// --- Types & Constants ---

type PipelineStageColumn = {
  id: string;
  label: string;
  color?: string;
};

interface Candidate {
  id: string;
  name: string;
  jobTitle: string;
  clientName: string;
  jobId?: string;
  clientId?: string;
  assignedToId?: string;
  ownerName?: string;
  experience: string;
  location: string;
  city?: string;
  country?: string;
  status: string;
  lastActivity: string;
  followUpStatus?: "Overdue" | "Due Today" | "Upcoming" | "None";
  avatar: string;
  stageId: string;
  stageName: string;
}

const DEFAULT_PIPELINE_STAGES: PipelineStageColumn[] = [
  { id: "applied", label: "Applied", color: "#3b82f6" },
  { id: "screening", label: "Screening", color: "#8b5cf6" },
  { id: "submit-to-client", label: "Submit to Client", color: "#4f46e5" },
  { id: "interviewing", label: "Interviewing", color: "#f59e0b" },
  { id: "offer", label: "Offer", color: "#10b981" },
  { id: "hired", label: "Hired", color: "#059669" },
  { id: "rejected", label: "Rejected", color: "#ef4444" },
];

function extractItems<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const obj = payload as { data?: unknown; items?: unknown };
    if (Array.isArray(obj.data)) return obj.data as T[];
    if (Array.isArray(obj.items)) return obj.items as T[];
  }
  return [];
}

function parseCandidatesResponse(res: { data?: unknown }): BackendCandidate[] {
  const payload = res.data as
    | BackendCandidate[]
    | { data?: BackendCandidate[]; items?: BackendCandidate[] }
    | undefined;
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
  return extractItems<BackendCandidate>(payload);
}

function normalizeStageKey(name: string): string {
  return String(name || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function parsePipelineStagesPayload(payload: unknown): PipelineStageColumn[] {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: unknown })?.data)
      ? ((payload as { data: unknown[] }).data as unknown[])
      : [];
  return rows
    .map((row, index) => {
      const item = row as { id?: string; name?: string; order?: number; color?: string };
      const name = String(item?.name || '').trim();
      if (!name) return null;
      return {
        id: String(item.id || normalizeStageKey(name) || `stage-${index}`),
        label: name,
        color: typeof item.color === 'string' ? item.color : undefined,
      };
    })
    .filter((row): row is PipelineStageColumn => Boolean(row));
}

function mergePipelineStageColumns(
  base: PipelineStageColumn[],
  extraNames: string[]
): PipelineStageColumn[] {
  const merged = [...base];
  const seen = new Set(base.map((stage) => normalizeStageKey(stage.label)));
  for (const name of extraNames) {
    const label = String(name || '').trim();
    if (!label) continue;
    const key = normalizeStageKey(label);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      id: key,
      label,
    });
  }
  return merged;
}

function matchStageColumnId(stageName: string, columns: PipelineStageColumn[]): string {
  const key = normalizeStageKey(stageName);
  if (!key) return columns[0]?.id || 'unknown';

  const exact = columns.find((col) => normalizeStageKey(col.label) === key);
  if (exact) return exact.id;

  if ((key.includes('submit') && key.includes('client')) || key.includes('submittedtoclient')) {
    const submitCol = columns.find((col) => {
      const colKey = normalizeStageKey(col.label);
      return (colKey.includes('submit') && colKey.includes('client')) || colKey.includes('submittedtoclient');
    });
    if (submitCol) return submitCol.id;
  }

  const partial = columns.find((col) => {
    const colKey = normalizeStageKey(col.label);
    if (colKey.length < 5) return false;
    return key.includes(colKey) || colKey.includes(key);
  });
  if (partial) return partial.id;

  if (key.includes('interview')) {
    const interviewCol = columns.find((col) => normalizeStageKey(col.label).includes('interview'));
    if (interviewCol) return interviewCol.id;
  }
  if (key.includes('screen') || key.includes('short') || key.includes('long')) {
    const screenCol = columns.find((col) => /screen|short|long/.test(normalizeStageKey(col.label)));
    if (screenCol) return screenCol.id;
  }
  if (key.includes('offer')) {
    const offerCol = columns.find((col) => normalizeStageKey(col.label).includes('offer'));
    if (offerCol) return offerCol.id;
  }
  if (key.includes('hire') || key.includes('join') || key.includes('placed')) {
    const hiredCol = columns.find((col) => /hire|join|placed/.test(normalizeStageKey(col.label)));
    if (hiredCol) return hiredCol.id;
  }
  if (key.includes('reject')) {
    const rejectedCol = columns.find((col) => normalizeStageKey(col.label).includes('reject'));
    if (rejectedCol) return rejectedCol.id;
  }
  if (key.includes('applied') || (key.includes('submit') && !key.includes('client'))) {
    const appliedCol = columns.find((col) => {
      const colKey = normalizeStageKey(col.label);
      if (colKey.includes('client')) return false;
      return /applied|submit/.test(colKey);
    });
    if (appliedCol) return appliedCol.id;
  }

  return columns[0]?.id || key;
}

function resolveCandidatePipelineStage(
  candidate: BackendCandidate,
  jobIdFilter?: string
): { stageName: string; stageId?: string } {
  const linkedJobId = jobIdFilter || resolveSubmitJobIdFromBackend(candidate);
  if (linkedJobId && Array.isArray(candidate.pipelineEntries)) {
    const entry = candidate.pipelineEntries.find(
      (row) => String(row.jobId || '').trim() === linkedJobId
    );
    const pipelineStageName = String(entry?.stage?.name || '').trim();
    if (pipelineStageName) {
      return {
        stageName: pipelineStageName,
        stageId: entry?.stage?.id ? String(entry.stage.id) : undefined,
      };
    }
  }

  return { stageName: resolveCandidateListStage(candidate) };
}

function getFollowUpStatus(candidate: BackendCandidate): Candidate['followUpStatus'] {
  const value = String(candidate.nextFollowUp || '').trim();
  if (!value) return 'None';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Upcoming';
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const compare = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
  if (compare < startOfToday) return 'Overdue';
  if (compare === startOfToday) return 'Due Today';
  return 'Upcoming';
}

/** Real candidate CRM status for the pipeline Status column (not a fake "Waiting" default). */
function mapPipelineCandidateStatus(candidate: BackendCandidate): string {
  const raw = String(candidate.status || '').trim().toUpperCase();
  switch (raw) {
    case 'NEW':
      return 'New';
    case 'ACTIVE':
      return 'Active';
    case 'PLACED':
      return 'Placed';
    case 'INACTIVE':
      return 'Inactive';
    case 'BLACKLISTED':
      return 'Blacklisted';
    case 'REJECTED':
      return 'Rejected';
    default:
      if (!raw) return 'Active';
      return raw
        .toLowerCase()
        .split(/[_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
  }
}

function pipelineStatusBadgeClass(status: string): string {
  const key = String(status || '').trim().toLowerCase();
  if (key === 'placed' || key === 'approved') {
    return 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80';
  }
  if (key === 'stalled' || key === 'rejected' || key === 'blacklisted' || key === 'inactive') {
    return 'bg-rose-50 text-rose-800 ring-1 ring-rose-200/80';
  }
  if (key === 'follow-up' || key === 'new') {
    return 'bg-sky-50 text-sky-800 ring-1 ring-sky-200/80';
  }
  if (key === 'waiting') {
    return 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/80';
  }
  return 'bg-teal-50 text-teal-800 ring-1 ring-teal-200/80';
}

function pipelineStatusListBadgeClass(status: string): string {
  const key = String(status || '').trim().toLowerCase();
  if (key === 'placed' || key === 'approved') return 'bg-green-100 text-green-700';
  if (key === 'stalled' || key === 'rejected' || key === 'blacklisted' || key === 'inactive') {
    return 'bg-red-100 text-red-700';
  }
  if (key === 'new' || key === 'follow-up') return 'bg-sky-100 text-sky-700';
  if (key === 'waiting') return 'bg-yellow-100 text-yellow-700';
  return 'bg-teal-100 text-teal-800';
}

function resolvePipelineJobContext(
  candidate: BackendCandidate,
  jobIdFilter: string | undefined,
  jobsById: Map<string, BackendJob>,
): {
  jobId: string;
  jobTitle: string;
  clientId?: string;
  clientName: string;
} {
  const matchList = Array.isArray(candidate.matches) ? candidate.matches : [];
  const preferredJobId =
    String(jobIdFilter || '').trim() ||
    resolveSubmitJobIdFromBackend(candidate) ||
    (Array.isArray(candidate.assignedJobs) && candidate.assignedJobs.length > 0
      ? String(candidate.assignedJobs[0] || '').trim()
      : '') ||
    String(matchList[0]?.jobId || matchList[0]?.job?.id || '').trim();

  const matched =
    matchList.find((row) => String(row.jobId || row.job?.id || '').trim() === preferredJobId) ||
    matchList[0];
  const jobFromList = preferredJobId ? jobsById.get(preferredJobId) : undefined;
  const jobFromMatch = matched?.job;

  const jobId = preferredJobId || String(jobFromList?.id || jobFromMatch?.id || '').trim();
  const jobTitle =
    String(jobFromList?.title || '').trim() ||
    String(jobFromMatch?.title || '').trim() ||
    String(candidate.assignedJobTitles?.[0] || '').trim() ||
    String(candidate.applications?.[0]?.job?.title || '').trim() ||
    String(candidate.currentTitle || '').trim() ||
    'Open role';

  // Always prefer the job's recruiting client — never candidate.currentCompany (employer CRM noise).
  const clientId =
    String(jobFromList?.client?.id || '').trim() ||
    String((jobFromMatch?.client as { id?: string } | undefined)?.id || '').trim() ||
    undefined;
  const clientName =
    String(jobFromList?.client?.companyName || '').trim() ||
    String(jobFromMatch?.client?.companyName || '').trim() ||
    '—';

  return { jobId, jobTitle, clientId: clientId || undefined, clientName };
}

function mapBackendCandidateToPipelineCandidate(
  candidate: BackendCandidate,
  columns: PipelineStageColumn[],
  jobIdFilter: string | undefined,
  jobsById: Map<string, BackendJob>,
): Candidate | null {
  if (!candidateHasRealJobAssignment(candidate)) return null;

  const { jobId: assignedJobId, jobTitle, clientId, clientName } = resolvePipelineJobContext(
    candidate,
    jobIdFilter,
    jobsById,
  );
  const candidateName =
    `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || candidate.email;
  const { stageName, stageId } = resolveCandidatePipelineStage(candidate, jobIdFilter);
  const normalizedStage = String(stageName || '').trim();
  if (!normalizedStage || normalizedStage.toLowerCase() === 'new') return null;

  const experience =
    typeof candidate.experience === 'number' ? `${candidate.experience} yrs` : '—';
  const locationRaw = String(candidate.location || '').trim();
  const location =
    !locationRaw ||
    locationRaw.length > 48 ||
    /requirement|full-stack|develop/i.test(locationRaw)
      ? ''
      : locationRaw;
  const resolvedStageId =
    stageId && columns.some((col) => col.id === stageId)
      ? stageId
      : matchStageColumnId(normalizedStage, columns);

  return {
    id: candidate.id,
    name: candidateName,
    jobTitle,
    clientName,
    jobId: assignedJobId || undefined,
    clientId,
    assignedToId: candidate.assignedTo?.id || undefined,
    ownerName: candidate.assignedTo?.name || undefined,
    experience,
    location: location || '—',
    country: (candidate as { country?: string }).country || undefined,
    city: (candidate as { city?: string }).city || undefined,
    status: mapPipelineCandidateStatus(candidate),
    lastActivity: candidate.updatedAt ? formatDateDMY(candidate.updatedAt) : 'Just now',
    followUpStatus: getFollowUpStatus(candidate),
    avatar:
      candidate.avatar ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(candidateName)}&background=0f766e&color=fff`,
    stageId: resolvedStageId,
    stageName: normalizedStage,
  };
}

function stageHeaderClass(stage: PipelineStageColumn): string {
  if (stage.color) return 'border border-transparent';
  return getCandidateStageBadgeClasses(stage.label)
    .split(' ')
    .filter((token) => !token.startsWith('text-'))
    .join(' ');
}

function stageHeaderStyle(stage: PipelineStageColumn): React.CSSProperties | undefined {
  if (!stage.color) return undefined;
  return {
    backgroundColor: `${stage.color}18`,
    color: stage.color,
    borderColor: `${stage.color}55`,
  };
}

// --- Sub-components ---

const CandidateCard = ({
  candidate,
  onViewCandidate,
  onViewJob,
  onRemove,
}: {
  candidate: Candidate;
  onViewCandidate: (candidate: Candidate) => void;
  onViewJob: (candidate: Candidate) => void;
  onRemove: (candidate: Candidate) => void;
}) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: "CANDIDATE",
    item: { id: candidate.id },
    collect: (monitor: DragSourceMonitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const metaLine = [candidate.experience, candidate.location !== '—' ? candidate.location : '']
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      ref={drag as any}
      className={`group relative mb-3 cursor-grab overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-200/80 hover:shadow-[0_10px_28px_-12px_rgba(15,118,110,0.28)] active:cursor-grabbing ${
        isDragging ? 'scale-[0.98] opacity-40' : 'opacity-100'
      }`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-teal-500 via-cyan-500 to-teal-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200/80">
            <ImageWithFallback
              src={candidate.avatar || ''}
              fallbackInitials={initialsFromDisplayName(candidate.name)}
              alt={candidate.name}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold tracking-tight text-slate-900 transition-colors group-hover:text-teal-700">
              {candidate.name}
            </h4>
            <p className="mt-0.5 truncate text-xs font-medium text-slate-600">{candidate.jobTitle}</p>
            <p className="mt-1 truncate text-[11px] text-slate-400">
              {candidate.ownerName ? `Owned by ${candidate.ownerName}` : 'Unassigned'}
            </p>
          </div>
        </div>
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
            aria-label="Open candidate actions"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 top-9 z-50 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onViewCandidate(candidate);
                  }}
                  className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                >
                  View Candidate
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onViewJob(candidate);
                  }}
                  className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                >
                  View Job
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onRemove(candidate);
                  }}
                  className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
                >
                  Remove
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="mb-3 space-y-1.5">
        {candidate.clientName && candidate.clientName !== '—' ? (
          <div className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200/70">
            <Building2 className="h-3 w-3 shrink-0 text-teal-600" />
            <span className="truncate">{candidate.clientName}</span>
          </div>
        ) : null}
        {metaLine ? (
          <p className="truncate text-[11px] text-slate-500">{metaLine}</p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${pipelineStatusBadgeClass(
            candidate.status,
          )}`}
        >
          {candidate.status}
        </span>
        <div className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
          <Clock className="h-3 w-3" />
          {candidate.lastActivity}
        </div>
      </div>

      {candidate.status === 'Stalled' || candidate.status === 'Inactive' ? (
        <div className="mt-2.5 flex items-center gap-1.5 rounded-xl border border-rose-100 bg-rose-50 px-2 py-1.5">
          <AlertCircle className="h-3 w-3 text-rose-500" />
          <span className="text-[10px] font-medium text-rose-600">
            {candidate.status} · {candidate.lastActivity}
          </span>
        </div>
      ) : null}
    </div>
  );
};

const PipelineColumn = ({
  stage,
  candidates,
  onMoveCandidate,
  onViewCandidate,
  onViewJob,
  onRemove,
}: {
  stage: PipelineStageColumn;
  candidates: Candidate[];
  onMoveCandidate: (candidateId: string, stageId: string) => void;
  onViewCandidate: (candidate: Candidate) => void;
  onViewJob: (candidate: Candidate) => void;
  onRemove: (candidate: Candidate) => void;
}) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'CANDIDATE',
    drop: (item: { id: string }) => onMoveCandidate(item.id, stage.id),
    collect: (monitor: DropTargetMonitor) => ({
      isOver: !!monitor.isOver(),
    }),
  }));

  return (
    <div
      ref={drop as any}
      className={`flex h-full w-[19.5rem] flex-shrink-0 flex-col rounded-3xl border transition-all duration-200 ${
        isOver
          ? 'border-teal-300 bg-teal-50/40 shadow-[inset_0_0_0_1px_rgba(45,212,191,0.25)]'
          : 'border-slate-200/70 bg-white/70 backdrop-blur-sm'
      }`}
    >
      <div className="sticky top-0 z-10 rounded-t-3xl px-4 pb-2 pt-4">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${stageHeaderClass(stage)}`}
              style={stageHeaderStyle(stage)}
            >
              {stage.label}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
              {candidates.length}
            </span>
          </div>
        </div>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto px-3 pb-4">
        {candidates.map((c) => (
          <CandidateCard
            key={c.id}
            candidate={c}
            onViewCandidate={onViewCandidate}
            onViewJob={onViewJob}
            onRemove={onRemove}
          />
        ))}
        {candidates.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
              <User className="h-5 w-5 text-slate-300" />
            </div>
            <p className="text-xs font-medium text-slate-400">No candidates yet</p>
            <p className="mt-1 text-[10px] text-slate-300">Drag someone here or add new</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Main App Component ---

export default function App() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [pipelineStages, setPipelineStages] = useState<PipelineStageColumn[]>(DEFAULT_PIPELINE_STAGES);
  const [jobs, setJobs] = useState<BackendJob[]>([]);
  const [owners, setOwners] = useState<BackendUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [view, setView] = useState<"Board" | "List">("Board");
  const pipelineColumnVisibility = usePersistedColumnVisibility(
    'pipeline.visibleColumns',
    PIPELINE_TABLE_COLUMNS,
  );
  const { format: formatLocationCell } = useFormatTableLocationCell();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddCandidateOpen, setIsAddCandidateOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [loadingStages, setLoadingStages] = useState(true);
  const [moveError, setMoveError] = useState('');
  /** Once the board has rows, keep it visible during refreshes (same pattern as Jobs/Candidates). */
  const hasBoardDataRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    async function loadPipelineMeta() {
      try {
        const [jobsRes, ownersRes, meRes] = await Promise.all([
          apiGetJobs({ limit: 200 }),
          apiGetUsers({ assignable: true, isActive: true, limit: 500 }),
          apiGetMe().catch(() => null),
        ]);

        if (!mounted) return;

        setJobs(extractItems<BackendJob>(jobsRes.data));
        setOwners(extractItems<BackendUser>(ownersRes.data));
        if (meRes?.data?.id) setCurrentUserId(meRes.data.id);
        if (meRes?.data?.name) setCurrentUserName(meRes.data.name);
      } catch (error) {
        console.error('Failed to load pipeline metadata:', error);
      }
    }

    loadPipelineMeta();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadPipelineStages() {
      setLoadingStages(true);
      try {
        if (selectedJobId) {
          const response = await apiGetPipelineStages(selectedJobId);
          const parsed = parsePipelineStagesPayload(response.data);
          if (!mounted) return;
          setPipelineStages(parsed.length > 0 ? parsed : DEFAULT_PIPELINE_STAGES);
          return;
        }

        const templateRes = await apiFetch<{
          stages?: Array<{ name?: string; order?: number; color?: string; systemRole?: string }>;
        }>('/settings/org/pipeline-template', { auth: true });
        const parsed = parsePipelineStagesPayload(templateRes.data?.stages);
        if (!mounted) return;
        setPipelineStages(parsed.length > 0 ? parsed : DEFAULT_PIPELINE_STAGES);
      } catch (error) {
        console.error('Failed to load pipeline stages:', error);
        if (!mounted) return;
        setPipelineStages(DEFAULT_PIPELINE_STAGES);
      } finally {
        if (mounted) setLoadingStages(false);
      }
    }

    void loadPipelineStages();
    return () => {
      mounted = false;
    };
  }, [selectedJobId]);

  const loadPipelineCandidates = React.useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    // Foreground spinner only on first load (or when board is empty) — never blank an existing board.
    const showForegroundLoader = !silent && !hasBoardDataRef.current;
    if (showForegroundLoader) setLoadingCandidates(true);
    try {
      const poolParams = shouldIncludePhase1CommonPool() ? { includeCommonPool: true as const } : {};
      const candidateParams =
        selectedOwnerId === '__me__'
          ? { page: 1, limit: 100, mine: true, ...poolParams }
          : selectedOwnerId
            ? { page: 1, limit: 100, assignedToId: selectedOwnerId, ...poolParams }
            : selectedJobId
              ? { page: 1, limit: 100, jobId: selectedJobId, ...poolParams }
              : { page: 1, limit: 100, ...poolParams };

      const candidatesRes = await apiGetCandidates(candidateParams);
      const backendCandidates = parseCandidatesResponse(candidatesRes);
      const stageColumns = pipelineStages.length > 0 ? pipelineStages : DEFAULT_PIPELINE_STAGES;
      const jobsById = new Map(jobs.map((job) => [job.id, job] as const));
      const extraStageNames = backendCandidates
        .map((row) => resolveCandidatePipelineStage(row, selectedJobId || undefined).stageName)
        .filter(Boolean);
      const columns = mergePipelineStageColumns(stageColumns, extraStageNames);

      const mapped = backendCandidates
        .map((row) =>
          mapBackendCandidateToPipelineCandidate(
            row,
            columns,
            selectedJobId || undefined,
            jobsById,
          ),
        )
        .filter((row): row is Candidate => Boolean(row));

      setCandidates(mapped);
      hasBoardDataRef.current = mapped.length > 0;
    } catch (error) {
      console.error('Failed to load pipeline candidates:', error);
      // Keep existing board data on silent/background refresh failures.
      if (!silent && !hasBoardDataRef.current) setCandidates([]);
    } finally {
      if (!silent) setLoadingCandidates(false);
    }
  }, [jobs, pipelineStages, selectedJobId, selectedOwnerId]);

  useEffect(() => {
    if (loadingStages) return;
    // Soft refresh when filters change and board already has data (background, like other list pages).
    void loadPipelineCandidates({ silent: hasBoardDataRef.current });
  }, [loadPipelineCandidates, loadingStages]);

  // Background auto-refresh — polls / focus / cross-page events without the foreground loader.
  const pipelineAutoLoad = React.useCallback(
    ({ silent }: { silent: boolean }) => loadPipelineCandidates({ silent }),
    [loadPipelineCandidates],
  );
  usePageAutoRefresh(pipelineAutoLoad, {
    events: ['jobportal:candidates-changed', 'jobportal:jobs-changed'],
  });

  const displayStages = useMemo(() => {
    const extraNames = candidates.map((candidate) => candidate.stageName).filter(Boolean);
    return mergePipelineStageColumns(
      pipelineStages.length > 0 ? pipelineStages : DEFAULT_PIPELINE_STAGES,
      extraNames
    );
  }, [candidates, pipelineStages]);

  const boardCandidates = useMemo(
    () =>
      candidates.map((candidate) => ({
        ...candidate,
        stageId: matchStageColumnId(candidate.stageName, displayStages),
      })),
    [candidates, displayStages]
  );

  const resolveStageIdForMove = async (
    candidate: Candidate,
    targetStageId: string
  ): Promise<string | null> => {
    if (isValidObjectId(targetStageId)) return targetStageId;
    const jobId = selectedJobId || candidate.jobId;
    if (!jobId) return null;
    const response = await apiGetPipelineStages(jobId);
    const stages = parsePipelineStagesPayload(response.data);
    const targetColumn = displayStages.find((stage) => stage.id === targetStageId);
    const targetName = targetColumn?.label || targetStageId;
    const match = stages.find(
      (stage) =>
        stage.id === targetStageId ||
        normalizeStageKey(stage.label) === normalizeStageKey(targetName)
    );
    return match?.id && isValidObjectId(match.id) ? match.id : null;
  };

  const moveCandidate = async (id: string, newStageId: string) => {
    const candidate = candidates.find((row) => row.id === id);
    if (!candidate) return;
    const currentStageId = matchStageColumnId(candidate.stageName, displayStages);
    if (currentStageId === newStageId) return;

    const previous = candidates;
    const targetColumn = displayStages.find((stage) => stage.id === newStageId);
    setCandidates((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              stageId: newStageId,
              stageName: targetColumn?.label || row.stageName,
              lastActivity: 'Just now',
            }
          : row
      )
    );
    setMoveError('');

    try {
      const jobId = selectedJobId || candidate.jobId;
      if (!jobId) {
        throw new Error('Assign this candidate to a job before moving pipeline stages.');
      }
      const stageId = await resolveStageIdForMove(candidate, newStageId);
      if (!stageId) {
        throw new Error('Could not resolve the target pipeline stage for this job.');
      }
      await apiMoveCandidateStage(jobId, {
        candidateId: id,
        stageId,
      });
      await loadPipelineCandidates({ silent: true });
    } catch (error) {
      console.error('Failed to move candidate in pipeline:', error);
      setCandidates(previous);
      setMoveError(error instanceof Error ? error.message : 'Failed to move candidate');
    }
  };

  const viewCandidate = (candidate: Candidate) => {
    router.push(`/candidate?candidateId=${encodeURIComponent(candidate.id)}`);
  };

  const viewJob = (candidate: Candidate) => {
    if (candidate.jobId) {
      router.push(`/job?jobId=${encodeURIComponent(candidate.jobId)}`);
      return;
    }
    router.push('/job');
  };

  const removeCandidate = (candidate: Candidate) => {
    setCandidates((prev) => prev.filter((item) => item.id !== candidate.id));
  };

  const jobOptions = useMemo(() => jobs.map((job) => ({ id: job.id, label: job.title })), [jobs]);
  /** Only clients that currently have at least one open (Active) job — not the full CRM list. */
  const clientOptions = useMemo(() => {
    const byId = new Map<string, { id: string; label: string }>();
    for (const job of jobs) {
      if (!isOpenPipelineJob(job)) continue;
      const id = String(job.client?.id || '').trim();
      const label = String(job.client?.companyName || '').trim() || 'Unnamed Client';
      if (!id || byId.has(id)) continue;
      byId.set(id, { id, label });
    }
    return Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [jobs]);

  useEffect(() => {
    if (!selectedClientId) return;
    if (clientOptions.some((client) => client.id === selectedClientId)) return;
    setSelectedClientId('');
  }, [clientOptions, selectedClientId]);

  const ownerOptions = useMemo(
    () => owners.map((owner) => ({ id: owner.id, label: owner.name || owner.email || 'Unknown team member' })),
    [owners]
  );

  const filteredCandidates = useMemo(() => {
    const query = searchQuery.trim();
    return boardCandidates.filter((candidate) => {
      const matchesSearch =
        !query ||
        matchesQuickSearch(
          buildQuickSearchHaystack(candidate.name, candidate.jobTitle, candidate.clientName),
          query,
        );
      const matchesJob =
        !selectedJobId ||
        candidate.jobId === selectedJobId ||
        candidate.jobTitle.toLowerCase() === (jobOptions.find((job) => job.id === selectedJobId)?.label || '').toLowerCase();
      const matchesClient =
        !selectedClientId ||
        candidate.clientId === selectedClientId ||
        candidate.clientName.toLowerCase() === (clientOptions.find((client) => client.id === selectedClientId)?.label || '').toLowerCase();
      const matchesOwner =
        !selectedOwnerId ||
        (selectedOwnerId === '__me__'
          ? candidate.assignedToId === currentUserId ||
            candidate.ownerName?.toLowerCase() === currentUserName.toLowerCase()
          : candidate.assignedToId === selectedOwnerId ||
            candidate.ownerName?.toLowerCase() === ownerOptions.find((owner) => owner.id === selectedOwnerId)?.label?.toLowerCase());
      return matchesSearch && matchesJob && matchesClient && matchesOwner;
    });
  }, [
    boardCandidates,
    clientOptions,
    currentUserId,
    currentUserName,
    jobOptions,
    ownerOptions,
    searchQuery,
    selectedClientId,
    selectedJobId,
    selectedOwnerId,
  ]);

  const { alertsByEntityId: workspaceAlertsByEntityId, showAlertColumn: showPipelineAiAlertColumn } =
    useWorkspaceEntityAlerts('CANDIDATE', filteredCandidates.map((candidate) => candidate.id));

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="w-full min-w-0 max-w-full min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_42%,#f1f5f9_100%)] font-sans text-slate-900">
        {/* Page Header (Pipeline specific) */}
          <header className="relative z-20 border-b border-slate-200/80 bg-white/90 px-8 py-6 backdrop-blur-md">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-700/80">
                  Recruitment
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Pipeline</h1>
                <p className="mt-1 text-sm text-slate-500">Track candidates across recruitment stages</p>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-100/80 p-1">
                  <button 
                    onClick={() => setView("Board")}
                    className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                      view === "Board" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    Board View
                  </button>
                  <button 
                    onClick={() => setView("List")}
                    className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                      view === "List" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    List View
                  </button>
                </div>

                {view === "List" ? (
                  <TableColumnsMenu
                    columns={PIPELINE_TABLE_COLUMNS}
                    isVisible={pipelineColumnVisibility.isVisible}
                    onToggle={pipelineColumnVisibility.toggle}
                    onReset={pipelineColumnVisibility.resetToDefault}
                    unlockedVisibleCount={pipelineColumnVisibility.unlockedVisibleCount}
                  />
                ) : null}

                <div className="h-8 w-px bg-slate-200 mx-1" />
                
                <button
                  type="button"
                  onClick={() => setIsAddCandidateOpen(true)}
                  className="flex items-center gap-2 bg-[#00bba7] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 shadow-lg shadow-teal-500/10 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  Add Candidate
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-nowrap items-center gap-2.5 overflow-x-auto no-scrollbar pb-1">
              <label className="flex items-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-600 shadow-sm transition-colors">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                <span>Job:</span>
                <select
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="bg-transparent text-slate-900 outline-none"
                >
                  <option value="">All Jobs</option>
                  {jobOptions.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-600 shadow-sm transition-colors">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Client:</span>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="bg-transparent text-slate-900 outline-none"
                >
                  <option value="">All Recruitment Clients</option>
                  {clientOptions.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-600 shadow-sm transition-colors">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Team Member:</span>
                <select
                  value={selectedOwnerId}
                  onChange={(e) => setSelectedOwnerId(e.target.value)}
                  className="bg-transparent text-slate-900 outline-none"
                >
                  <option value="">All team members</option>
                  <option value="__me__">Myself</option>
                  {ownerOptions.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={() => {
                  setSelectedJobId('');
                  setSelectedClientId('');
                  setSelectedOwnerId('');
                }}
                className="ml-auto flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:bg-slate-100"
              >
                <Filter className="w-3.5 h-3.5" />
                Clear Filters
              </button>
            </div>
          </header>

          {/* Pipeline Content */}
          <div className="flex-1 overflow-hidden relative">
            {moveError ? (
              <div className="mx-8 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {moveError}
              </div>
            ) : null}
            {((loadingCandidates || loadingStages) && candidates.length === 0) ? (
              <div className="flex h-64 items-center justify-center text-sm text-slate-500">
                Loading pipeline…
              </div>
            ) : (
            <AnimatePresence mode="wait">
              {view === "Board" ? (
                <motion.div 
                  key="board"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="custom-scrollbar flex h-full gap-4 overflow-x-auto bg-transparent p-8"
                >
                  {displayStages.map((stage) => (
                    <PipelineColumn 
                      key={stage.id} 
                      stage={stage} 
                      candidates={filteredCandidates.filter((c) => c.stageId === stage.id)}
                      onMoveCandidate={moveCandidate}
                      onViewCandidate={viewCandidate}
                      onViewJob={viewJob}
                      onRemove={removeCandidate}
                    />
                  ))}
                  <div className="w-1 px-4" />
                </motion.div>
              ) : (
                <motion.div 
                  key="list"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="h-full overflow-y-auto p-8 bg-white"
                >
                  {(() => {
                    const show = pipelineColumnVisibility.isVisible;
                    return (
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-white z-10">
                      <tr className="border-b border-slate-100">
                        <th className="pb-4 pt-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Candidate</th>
                        {show('stage') ? <th className="pb-4 pt-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Stage</th> : null}
                        {show('clientJob') ? <th className="pb-4 pt-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Client & Job</th> : null}
                        {show('status') ? <th className="pb-4 pt-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th> : null}
                        {showPipelineAiAlertColumn ? (
                          <th className="pb-4 pt-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">AI Alert</th>
                        ) : null}
                        {show('lastActivity') ? (
                          <th className="pb-4 pt-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Last Activity</th>
                        ) : null}
                        {show('owner') ? <th className="pb-4 pt-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Team member</th> : null}
                        {show('experience') ? <th className="pb-4 pt-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Experience</th> : null}
                        {show('location') ? (
                          <th className="pb-4 pt-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Location
                          </th>
                        ) : null}
                        {show('followUp') ? <th className="pb-4 pt-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Follow-up</th> : null}
                        {show('job') ? <th className="pb-4 pt-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Job</th> : null}
                        {show('client') ? <th className="pb-4 pt-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Client</th> : null}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredCandidates.map((candidate) => (
                        <tr key={candidate.id} className="hover:bg-slate-50 group transition-colors">
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-100">
                                <ImageWithFallback src={candidate.avatar || ''} fallbackInitials={initialsFromDisplayName(candidate.name)} alt={candidate.name} className="w-full h-full object-cover" />
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-slate-900 group-hover:text-blue-600 transition-colors">{candidate.name}</p>
                                <p className="text-xs text-slate-500">
                                  {formatLocationCell({
                                    location: candidate.location,
                                    country: candidate.country,
                                    city: candidate.city,
                                  })}
                                </p>
                              </div>
                            </div>
                          </td>
                          {show('stage') ? (
                            <td className="py-4 px-4">
                              <select 
                                value={candidate.stageId}
                                onChange={(e) => void moveCandidate(candidate.id, e.target.value)}
                                className="bg-slate-100 border-none rounded-lg text-xs font-medium px-2 py-1 focus:ring-2 focus:ring-blue-500/20"
                              >
                                {displayStages.map((stage) => (
                                  <option key={stage.id} value={stage.id}>{stage.label}</option>
                                ))}
                              </select>
                            </td>
                          ) : null}
                          {show('clientJob') ? (
                            <td className="py-4 px-4">
                              <div className="max-w-[200px]">
                                <p className="text-sm font-medium text-slate-800 truncate">{candidate.jobTitle}</p>
                                <p className="text-xs text-slate-500 truncate">{candidate.clientName}</p>
                              </div>
                            </td>
                          ) : null}
                          {show('status') ? (
                            <td className="py-4 px-4">
                              <span
                                className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${pipelineStatusListBadgeClass(
                                  candidate.status,
                                )}`}
                              >
                                {candidate.status.toUpperCase()}
                              </span>
                            </td>
                          ) : null}
                          {showPipelineAiAlertColumn ? (
                            <td className="py-4 px-4">
                              <WorkspaceAlertTableCell alerts={workspaceAlertsByEntityId?.[candidate.id]} />
                            </td>
                          ) : null}
                          {show('lastActivity') ? (
                            <td className="py-4 px-4 text-right">
                              <p className="text-xs font-medium text-slate-600">{candidate.lastActivity}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">Updated</p>
                            </td>
                          ) : null}
                          {show('owner') ? (
                            <td className="py-4 px-4">
                              <span className="text-sm text-slate-700">{candidate.ownerName || '—'}</span>
                            </td>
                          ) : null}
                          {show('experience') ? (
                            <td className="py-4 px-4">
                              <span className="text-sm text-slate-700">{candidate.experience || '—'}</span>
                            </td>
                          ) : null}
                          {show('location') ? (
                            <td className="py-4 px-4">
                              <span className="text-sm text-slate-700">
                                {formatLocationCell({
                                  location: candidate.location,
                                  country: candidate.country,
                                  city: candidate.city,
                                })}
                              </span>
                            </td>
                          ) : null}
                          {show('followUp') ? (
                            <td className="py-4 px-4">
                              <span className="text-sm text-slate-700">{candidate.followUpStatus || '—'}</span>
                            </td>
                          ) : null}
                          {show('job') ? (
                            <td className="py-4 px-4">
                              <span className="max-w-[160px] truncate text-sm text-slate-700" title={candidate.jobTitle}>
                                {candidate.jobTitle || '—'}
                              </span>
                            </td>
                          ) : null}
                          {show('client') ? (
                            <td className="py-4 px-4">
                              <span className="max-w-[160px] truncate text-sm text-slate-700" title={candidate.clientName}>
                                {candidate.clientName || '—'}
                              </span>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                    );
                  })()}
                </motion.div>
              )}
            </AnimatePresence>
            )}
          </div>

          <AddCandidateDrawer
            isOpen={isAddCandidateOpen}
            onClose={() => setIsAddCandidateOpen(false)}
            onSuccess={() => {
              setIsAddCandidateOpen(false);
              void loadPipelineCandidates({ silent: true });
            }}
            currentUser={{ _id: '', name: 'You', email: '', role: 'RECRUITER' }}
          />
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgb(165 180 252 / 0.55);
          border-radius: 999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgb(129 140 248 / 0.75);
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </DndProvider>
  );
}


