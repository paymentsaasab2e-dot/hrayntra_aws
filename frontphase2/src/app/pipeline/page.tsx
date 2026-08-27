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
import { useRouter } from "next/navigation";
import { ImageWithFallback, initialsFromDisplayName } from "../../components/ImageWithFallback";
import { formatDateDMY } from "../../utils/dateDisplay";
import AddCandidateDrawer from "../../components/candidates/AddCandidateDrawer";
import { usePageAutoRefresh } from "../../hooks/usePageAutoRefresh";
import { useWorkspaceEntityAlerts } from "../../hooks/useWorkspaceEntityAlerts";
import { WorkspaceAlertTableCell, WorkspaceAlertTableHeader } from "../../components/ai/WorkspaceAlertTableCell";
import { TableColumnsMenu } from "../../components/table/TableColumnsMenu";
import { usePersistedColumnVisibility } from "../../hooks/usePersistedColumnVisibility";
import { PIPELINE_TABLE_COLUMNS } from "../../lib/tableColumns/moduleTableColumns";
import {
  apiGetCandidates,
  apiGetClients,
  apiGetJobs,
  apiGetMe,
  apiGetPipelineStages,
  apiGetUsers,
  apiMoveCandidateStage,
  apiFetch,
  type BackendCandidate,
  type BackendClient,
  type BackendJob,
  type BackendUser,
} from "../../lib/api";
import { shouldIncludePhase1CommonPool } from "../../lib/phase1CommonPoolAccess";
import {
  candidateHasRealJobAssignment,
  resolveCandidateListStage,
} from "../../lib/candidateListMapping";
import { resolveSubmitJobIdFromBackend } from "../../lib/candidateSubmitToClient";
import { isValidObjectId } from "../../lib/mapCandidateProfile";
import { getCandidateStageBadgeClasses } from "../../utils/candidateStage";

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
  status: "Waiting" | "Follow-up" | "Approved" | "Stalled";
  lastActivity: string;
  followUpStatus?: "Overdue" | "Due Today" | "Upcoming" | "None";
  avatar: string;
  stageId: string;
  stageName: string;
}

const DEFAULT_PIPELINE_STAGES: PipelineStageColumn[] = [
  { id: "applied", label: "Applied", color: "#3b82f6" },
  { id: "screening", label: "Screening", color: "#8b5cf6" },
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

  const partial = columns.find((col) => {
    const colKey = normalizeStageKey(col.label);
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
  if (key.includes('applied') || key.includes('submit')) {
    const appliedCol = columns.find((col) => /applied|submit/.test(normalizeStageKey(col.label)));
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

function mapBackendCandidateToPipelineCandidate(
  candidate: BackendCandidate,
  columns: PipelineStageColumn[],
  jobIdFilter?: string
): Candidate | null {
  if (!candidateHasRealJobAssignment(candidate)) return null;

  const job = Array.isArray(candidate.matches) ? candidate.matches[0]?.job : undefined;
  const assignedJobId =
    jobIdFilter ||
    resolveSubmitJobIdFromBackend(candidate) ||
    (Array.isArray(candidate.assignedJobs) && candidate.assignedJobs.length > 0
      ? String(candidate.assignedJobs[0])
      : job?.id || '');
  const jobTitle =
    candidate.currentTitle ||
    candidate.assignedJobTitles?.[0] ||
    job?.title ||
    candidate.applications?.[0]?.job?.title ||
    'Candidate';
  const clientName = job?.client?.companyName || candidate.currentCompany || 'Client';
  const candidateName =
    `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || candidate.email;
  const { stageName, stageId } = resolveCandidatePipelineStage(candidate, jobIdFilter);
  const normalizedStage = String(stageName || '').trim();
  if (!normalizedStage || normalizedStage.toLowerCase() === 'new') return null;

  const experience =
    typeof candidate.experience === 'number' ? `${candidate.experience} years` : '—';
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
    clientId: job?.client?.id || undefined,
    assignedToId: candidate.assignedTo?.id || undefined,
    ownerName: candidate.assignedTo?.name || undefined,
    experience,
    location: candidate.location || '—',
    status:
      candidate.status === 'REJECTED'
        ? 'Stalled'
        : candidate.status === 'PLACED'
          ? 'Approved'
          : 'Waiting',
    lastActivity: candidate.updatedAt ? formatDateDMY(candidate.updatedAt) : 'Just now',
    followUpStatus: getFollowUpStatus(candidate),
    avatar:
      candidate.avatar ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(candidateName)}&background=0f172a&color=fff`,
    stageId: resolvedStageId,
    stageName: normalizedStage,
  };
}

function stageHeaderClass(stage: PipelineStageColumn): string {
  if (stage.color) return 'border';
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

  const statusColors = {
    "Waiting": "bg-yellow-100 text-yellow-700",
    "Follow-up": "bg-blue-100 text-blue-700",
    "Approved": "bg-green-100 text-green-700",
    "Stalled": "bg-red-100 text-red-700",
  };

  return (
    <div
      ref={drag as any}
      className={`bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing mb-3 group ${
        isDragging ? "opacity-40 scale-95" : "opacity-100"
      }`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-100 ring-2 ring-white">
            <ImageWithFallback src={candidate.avatar || ''} fallbackInitials={initialsFromDisplayName(candidate.name)} alt={candidate.name} className="w-full h-full object-cover" />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">{candidate.name}</h4>
            <p className="text-xs text-slate-500">{candidate.jobTitle}</p>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
              Assigned to: {candidate.ownerName || 'Unassigned'}
            </p>
          </div>
        </div>
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
            aria-label="Open candidate actions"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 top-8 z-50 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
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

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <Building2 className="w-3 h-3" />
          <span className="truncate">{candidate.clientName}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <User className="w-3 h-3" />
          <span>{candidate.experience} • {candidate.location}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-50">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[candidate.status]}`}>
          {candidate.status}
        </span>
        <div className="flex items-center gap-1 text-[10px] text-slate-400">
          <Clock className="w-3 h-3" />
          {candidate.lastActivity}
        </div>
      </div>
      
      {candidate.status === "Stalled" && (
        <div className="mt-3 flex items-center gap-1.5 px-2 py-1.5 bg-red-50 rounded-lg border border-red-100">
          <AlertCircle className="w-3 h-3 text-red-500" />
          <span className="text-[10px] text-red-600 font-medium">Stalled for {candidate.lastActivity}</span>
        </div>
      )}
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
    accept: "CANDIDATE",
    drop: (item: { id: string }) => onMoveCandidate(item.id, stage.id),
    collect: (monitor: DropTargetMonitor) => ({
      isOver: !!monitor.isOver(),
    }),
  }));

  return (
    <div 
      ref={drop as any}
      className={`flex-shrink-0 w-80 flex flex-col h-full rounded-2xl transition-colors ${
        isOver ? "bg-slate-100" : "bg-slate-50/50"
      }`}
    >
      <div className="sticky top-0 z-10 p-4 pb-2 bg-transparent">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border uppercase tracking-wider ${stageHeaderClass(stage)}`}
              style={stageHeaderStyle(stage)}
            >
              {stage.label}
            </span>
            <span className="text-xs font-medium text-slate-400 bg-white px-2 py-0.5 rounded-full shadow-sm border border-slate-200">
              {candidates.length}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar">
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
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <User className="w-5 h-5 text-slate-300" />
            </div>
            <p className="text-xs text-slate-400 font-medium">No candidates yet</p>
            <p className="text-[10px] text-slate-300 mt-1">Drag someone here or add new</p>
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
  const [clients, setClients] = useState<BackendClient[]>([]);
  const [owners, setOwners] = useState<BackendUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [view, setView] = useState<"Board" | "List">("Board");
  const pipelineColumnVisibility = usePersistedColumnVisibility(
    'pipeline.visibleColumns',
    PIPELINE_TABLE_COLUMNS,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddCandidateOpen, setIsAddCandidateOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [selectedFollowUp, setSelectedFollowUp] = useState('');
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [loadingStages, setLoadingStages] = useState(true);
  const [moveError, setMoveError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function loadPipelineMeta() {
      try {
        const [jobsRes, clientsRes, ownersRes, meRes] = await Promise.all([
          apiGetJobs({ limit: 200 }),
          apiGetClients({ limit: 200 }),
          apiGetUsers({ assignable: true, isActive: true, limit: 500 }),
          apiGetMe().catch(() => null),
        ]);

        if (!mounted) return;

        setJobs(extractItems<BackendJob>(jobsRes.data));
        setClients(extractItems<BackendClient>(clientsRes.data));
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

  const loadPipelineCandidates = React.useCallback(async () => {
    setLoadingCandidates(true);
    try {
      const poolParams = shouldIncludePhase1CommonPool() ? { includeCommonPool: true as const } : {};
      const candidateParams =
        selectedOwnerId === '__me__'
          ? { page: 1, limit: 500, mine: true, ...poolParams }
          : selectedOwnerId
            ? { page: 1, limit: 500, assignedToId: selectedOwnerId, ...poolParams }
            : selectedJobId
              ? { page: 1, limit: 500, jobId: selectedJobId, ...poolParams }
              : { page: 1, limit: 500, ...poolParams };

      const candidatesRes = await apiGetCandidates(candidateParams);
      const backendCandidates = parseCandidatesResponse(candidatesRes);
      const stageColumns = pipelineStages.length > 0 ? pipelineStages : DEFAULT_PIPELINE_STAGES;
      const extraStageNames = backendCandidates
        .map((row) => resolveCandidatePipelineStage(row, selectedJobId || undefined).stageName)
        .filter(Boolean);
      const columns = mergePipelineStageColumns(stageColumns, extraStageNames);

      const mapped = backendCandidates
        .map((row) => mapBackendCandidateToPipelineCandidate(row, columns, selectedJobId || undefined))
        .filter((row): row is Candidate => Boolean(row));

      setCandidates(mapped);
    } catch (error) {
      console.error('Failed to load pipeline candidates:', error);
      setCandidates([]);
    } finally {
      setLoadingCandidates(false);
    }
  }, [pipelineStages, selectedJobId, selectedOwnerId]);

  useEffect(() => {
    if (loadingStages) return;
    void loadPipelineCandidates();
  }, [loadPipelineCandidates, loadingStages]);

  // Reusable auto-refresh — re-runs candidate fetch on focus / interval / events.
  usePageAutoRefresh(
    async () => {
      await loadPipelineCandidates();
    },
    { events: ['jobportal:candidates-changed', 'jobportal:jobs-changed'] }
  );

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
      await loadPipelineCandidates();
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
  const clientOptions = useMemo(
    () => clients.map((client) => ({ id: client.id, label: client.companyName || 'Unnamed Client' })),
    [clients]
  );
  const ownerOptions = useMemo(
    () => owners.map((owner) => ({ id: owner.id, label: owner.name || owner.email || 'Unknown team member' })),
    [owners]
  );

  const filteredCandidates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return boardCandidates.filter((candidate) => {
      const matchesSearch =
        !query ||
        candidate.name.toLowerCase().includes(query) ||
        candidate.jobTitle.toLowerCase().includes(query) ||
        candidate.clientName.toLowerCase().includes(query);
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
      const matchesFollowUp =
        !selectedFollowUp || candidate.followUpStatus === selectedFollowUp;
      return matchesSearch && matchesJob && matchesClient && matchesOwner && matchesFollowUp;
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
    selectedFollowUp,
    selectedJobId,
    selectedOwnerId,
  ]);

  const { alertsByEntityId: workspaceAlertsByEntityId, showAlertColumn: showPipelineAiAlertColumn } =
    useWorkspaceEntityAlerts('CANDIDATE', filteredCandidates.map((candidate) => candidate.id));

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="w-full min-h-screen bg-white font-sans text-slate-900">
        {/* Page Header (Pipeline specific) */}
          <header className="px-8 py-6 border-b border-slate-100 bg-white z-20">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pipeline</h1>
                <p className="text-sm text-slate-500 mt-1">Track candidates across recruitment stages</p>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button 
                    onClick={() => setView("Board")}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      view === "Board" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    Board View
                  </button>
                  <button 
                    onClick={() => setView("List")}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      view === "List" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
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
            <div className="flex flex-wrap items-center gap-3 overflow-x-auto no-scrollbar pb-1">
              <label className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[13px] font-medium text-slate-600 shadow-sm transition-colors whitespace-nowrap">
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

              <label className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[13px] font-medium text-slate-600 shadow-sm transition-colors whitespace-nowrap">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Client:</span>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="bg-transparent text-slate-900 outline-none"
                >
                  <option value="">All Clients</option>
                  {clientOptions.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[13px] font-medium text-slate-600 shadow-sm transition-colors whitespace-nowrap">
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

              <label className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[13px] font-medium text-slate-600 shadow-sm transition-colors whitespace-nowrap">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Follow-up:</span>
                <select
                  value={selectedFollowUp}
                  onChange={(e) => setSelectedFollowUp(e.target.value)}
                  className="bg-transparent text-slate-900 outline-none"
                >
                  <option value="">All Follow-ups</option>
                  <option value="Overdue">Overdue</option>
                  <option value="Due Today">Due Today</option>
                  <option value="Upcoming">Upcoming</option>
                  <option value="None">None</option>
                </select>
              </label>

              <button
                type="button"
                onClick={() => {
                  setSelectedJobId('');
                  setSelectedClientId('');
                  setSelectedOwnerId('');
                  setSelectedFollowUp('');
                }}
                className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-500 rounded-lg text-[13px] font-medium hover:bg-slate-100 transition-colors border border-dashed border-slate-300"
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
            {loadingCandidates || loadingStages ? (
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
                  className="h-full flex gap-6 overflow-x-auto p-8 custom-scrollbar bg-slate-50/50"
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
                        {show('location') ? <th className="pb-4 pt-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Location</th> : null}
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
                                <p className="text-xs text-slate-500">{candidate.location}</p>
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
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                candidate.status === "Approved" ? "bg-green-100 text-green-700" :
                                candidate.status === "Stalled" ? "bg-red-100 text-red-700" :
                                "bg-yellow-100 text-yellow-700"
                              }`}>
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
                              <span className="text-sm text-slate-700">{candidate.location || '—'}</span>
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
              void loadPipelineCandidates();
            }}
            currentUser={{ _id: '', name: 'You', email: '', role: 'RECRUITER' }}
          />
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
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


