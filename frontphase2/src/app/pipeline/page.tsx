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
import { ImageWithFallback } from "../../components/ImageWithFallback";
import AddCandidateDrawer from "../../components/candidates/AddCandidateDrawer";
import {
  apiGetCandidates,
  apiGetClients,
  apiGetJobs,
  apiGetMe,
  apiGetUsers,
  type BackendCandidate,
  type BackendClient,
  type BackendJob,
  type BackendUser,
} from "../../lib/api";

// --- Types & Constants ---

type Stage = "Applied" | "Shortlisted" | "Sent to Client" | "Selected" | "Offer Released" | "Joined";

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
  stage: Stage;
}

const STAGES: { id: Stage; label: string; color: string }[] = [
  { id: "Applied", label: "Applied", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { id: "Shortlisted", label: "Shortlisted", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { id: "Sent to Client", label: "Sent to Client", color: "bg-orange-50 text-orange-700 border-orange-200" },
  { id: "Selected", label: "Selected", color: "bg-teal-50 text-teal-700 border-teal-200" },
  { id: "Offer Released", label: "Offer Released", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { id: "Joined", label: "Joined", color: "bg-green-50 text-green-700 border-green-200" },
];

const INITIAL_CANDIDATES: Candidate[] = [
  {
    id: "1",
    name: "Alex Thompson",
    jobTitle: "Senior Frontend Engineer",
    clientName: "TechFlow Systems",
    jobId: "job-1",
    clientId: "client-1",
    assignedToId: "user-1",
    ownerName: "Recruiter One",
    experience: "8 years",
    location: "London (Remote)",
    status: "Approved",
    lastActivity: "2 hours ago",
    followUpStatus: "Upcoming",
    avatar: "https://images.unsplash.com/photo-1689600944138-da3b150d9cb8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMHBvcnRyYWl0fGVufDF8fHx8MTc3MDQ2NzgyM3ww&ixlib=rb-4.1.0&q=80&w=1080",
    stage: "Applied",
  },
  {
    id: "2",
    name: "Sarah Chen",
    jobTitle: "Product Designer",
    clientName: "Innova Design Lab",
    jobId: "job-2",
    clientId: "client-2",
    assignedToId: "user-2",
    ownerName: "Recruiter Two",
    experience: "5 years",
    location: "San Francisco",
    status: "Waiting",
    lastActivity: "1 day ago",
    followUpStatus: "Due Today",
    avatar: "https://images.unsplash.com/photo-1652471949169-9c587e8898cd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b21hbiUyMHByb2Zlc3Npb25hbCUyMGhlYWRzaG90fGVufDF8fHx8MTc3MDQ1NzM5MXww&ixlib=rb-4.1.0&q=80&w=1080",
    stage: "Shortlisted",
  },
  {
    id: "3",
    name: "Marcus Miller",
    jobTitle: "Engineering Manager",
    clientName: "Quantum Solutions",
    jobId: "job-3",
    clientId: "client-3",
    assignedToId: "user-1",
    ownerName: "Recruiter One",
    experience: "12 years",
    location: "Berlin",
    status: "Stalled",
    lastActivity: "4 days ago",
    followUpStatus: "Overdue",
    avatar: "https://images.unsplash.com/photo-1672685667592-0392f458f46f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYW4lMjBwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdHxlbnwxfHx8fDE3NzA1MDI0NTV8MA&ixlib=rb-4.1.0&q=80&w=1080",
    stage: "Sent to Client",
  },
  {
    id: "4",
    name: "Elena Rodriguez",
    jobTitle: "DevOps Engineer",
    clientName: "CloudScale Inc.",
    jobId: "job-4",
    clientId: "client-4",
    assignedToId: "user-3",
    ownerName: "Recruiter Three",
    experience: "6 years",
    location: "Madrid",
    status: "Follow-up",
    lastActivity: "5 hours ago",
    followUpStatus: "Upcoming",
    avatar: "https://images.unsplash.com/photo-1655249493799-9cee4fe983bb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMHBlcnNvbiUyMHByb2ZpbGUlMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzA1Mjg4MjZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    stage: "Selected",
  },
  {
    id: "5",
    name: "James Wilson",
    jobTitle: "Sales Director",
    clientName: "Global Trade Co.",
    jobId: "job-5",
    clientId: "client-5",
    assignedToId: "user-2",
    ownerName: "Recruiter Two",
    experience: "15 years",
    location: "New York",
    status: "Approved",
    lastActivity: "Yesterday",
    followUpStatus: "None",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1080",
    stage: "Offer Released",
  },
  {
    id: "6",
    name: "Priya Patel",
    jobTitle: "Data Scientist",
    clientName: "BioTech AI",
    jobId: "job-6",
    clientId: "client-6",
    assignedToId: "user-3",
    ownerName: "Recruiter Three",
    experience: "4 years",
    location: "Toronto",
    status: "Approved",
    lastActivity: "2 days ago",
    followUpStatus: "Upcoming",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=1080",
    stage: "Joined",
  },
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

function mapBackendCandidateToPipelineCandidate(candidate: BackendCandidate): Candidate {
  const job = Array.isArray(candidate.matches) ? candidate.matches[0]?.job : undefined;
  const assignedJobId = Array.isArray(candidate.assignedJobs) && candidate.assignedJobs.length > 0
    ? candidate.assignedJobs[0]
    : job?.id || '';
  const jobTitle = candidate.currentTitle || candidate.assignedJobTitles?.[0] || job?.title || 'Candidate';
  const clientName = job?.client?.companyName || candidate.currentCompany || 'Client';
  const candidateName = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || candidate.email;
  const stage = String(candidate.stage || 'Applied').trim() as Stage;
  const experience = typeof candidate.experience === 'number' ? `${candidate.experience} years` : '—';
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
    status: candidate.status === 'REJECTED' ? 'Stalled' : candidate.status === 'PLACED' ? 'Approved' : 'Waiting',
    lastActivity: candidate.updatedAt ? new Date(candidate.updatedAt).toLocaleDateString() : 'Just now',
    followUpStatus: getFollowUpStatus(candidate),
    avatar: candidate.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(candidateName)}&background=0f172a&color=fff`,
    stage: ([
      "Applied",
      "Shortlisted",
      "Sent to Client",
      "Selected",
      "Offer Released",
      "Joined",
    ].includes(stage) ? stage : "Applied") as Stage,
  };
}

// --- Sub-components ---

const CandidateCard = ({
  candidate,
  moveCandidate,
  onViewCandidate,
  onViewJob,
  onRemove,
}: {
  candidate: Candidate;
  moveCandidate: (id: string, stage: Stage) => void;
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
            <ImageWithFallback src={candidate.avatar} alt={candidate.name} className="w-full h-full object-cover" />
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
  moveCandidate,
  onViewCandidate,
  onViewJob,
  onRemove,
}: { 
  stage: typeof STAGES[0]; 
  candidates: Candidate[];
  moveCandidate: (id: string, stage: Stage) => void;
  onViewCandidate: (candidate: Candidate) => void;
  onViewJob: (candidate: Candidate) => void;
  onRemove: (candidate: Candidate) => void;
}) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: "CANDIDATE",
    drop: (item: { id: string }) => moveCandidate(item.id, stage.id),
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
            <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border uppercase tracking-wider ${stage.color}`}>
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
            moveCandidate={moveCandidate}
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
  const [candidates, setCandidates] = useState<Candidate[]>(INITIAL_CANDIDATES);
  const [jobs, setJobs] = useState<BackendJob[]>([]);
  const [clients, setClients] = useState<BackendClient[]>([]);
  const [owners, setOwners] = useState<BackendUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [view, setView] = useState<"Board" | "List">("Board");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddCandidateOpen, setIsAddCandidateOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [selectedFollowUp, setSelectedFollowUp] = useState('');

  useEffect(() => {
    let mounted = true;
    async function loadPipelineMeta() {
      try {
        const [jobsRes, clientsRes, ownersRes, meRes] = await Promise.all([
          apiGetJobs({ limit: 200 }),
          apiGetClients({ limit: 200 }),
          apiGetUsers({ role: 'RECRUITER', isActive: true, limit: 200 }),
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

    async function loadPipelineCandidates() {
      try {
        const candidateParams =
          selectedOwnerId === '__me__'
            ? { page: 1, limit: 200, mine: true }
            : selectedOwnerId
              ? { page: 1, limit: 200, assignedToId: selectedOwnerId }
              : { page: 1, limit: 200 };

        const candidatesRes = await apiGetCandidates(candidateParams);

        if (!mounted) return;

        setCandidates(
          extractItems<BackendCandidate>(candidatesRes.data).map(mapBackendCandidateToPipelineCandidate)
        );
      } catch (error) {
        console.error('Failed to load pipeline candidates, using fallback candidates:', error);
        if (!mounted) return;
        setCandidates(INITIAL_CANDIDATES);
      }
    }

    loadPipelineCandidates();
    return () => {
      mounted = false;
    };
  }, [selectedOwnerId]);

  const moveCandidate = (id: string, newStage: Stage) => {
    setCandidates((prev) => 
      prev.map((c) => (c.id === id ? { ...c, stage: newStage, lastActivity: "Just now" } : c))
    );
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
    () => owners.map((owner) => ({ id: owner.id, label: owner.name || owner.email || 'Unknown Owner' })),
    [owners]
  );

  const filteredCandidates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return candidates.filter((candidate) => {
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
    candidates,
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
                <span>Owner:</span>
                <select
                  value={selectedOwnerId}
                  onChange={(e) => setSelectedOwnerId(e.target.value)}
                  className="bg-transparent text-slate-900 outline-none"
                >
                  <option value="">All Owners</option>
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
            <AnimatePresence mode="wait">
              {view === "Board" ? (
                <motion.div 
                  key="board"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="h-full flex gap-6 overflow-x-auto p-8 custom-scrollbar bg-slate-50/50"
                >
                  {STAGES.map((stage) => (
                    <PipelineColumn 
                      key={stage.id} 
                      stage={stage} 
                      candidates={filteredCandidates.filter(c => c.stage === stage.id)}
                      moveCandidate={moveCandidate}
                      onViewCandidate={viewCandidate}
                      onViewJob={viewJob}
                      onRemove={removeCandidate}
                    />
                  ))}
                  <div className="w-1 px-4" /> {/* Spacer for scroll end */}
                </motion.div>
              ) : (
                <motion.div 
                  key="list"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="h-full overflow-y-auto p-8 bg-white"
                >
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-white z-10">
                      <tr className="border-b border-slate-100">
                        <th className="pb-4 pt-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Candidate</th>
                        <th className="pb-4 pt-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Stage</th>
                        <th className="pb-4 pt-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Client & Job</th>
                        <th className="pb-4 pt-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                        <th className="pb-4 pt-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Last Activity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredCandidates.map((candidate) => (
                        <tr key={candidate.id} className="hover:bg-slate-50 group transition-colors">
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-100">
                                <ImageWithFallback src={candidate.avatar} alt={candidate.name} className="w-full h-full object-cover" />
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-slate-900 group-hover:text-blue-600 transition-colors">{candidate.name}</p>
                                <p className="text-xs text-slate-500">{candidate.location}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <select 
                              value={candidate.stage}
                              onChange={(e) => moveCandidate(candidate.id, e.target.value as Stage)}
                              className="bg-slate-100 border-none rounded-lg text-xs font-medium px-2 py-1 focus:ring-2 focus:ring-blue-500/20"
                            >
                              {STAGES.map(s => (
                                <option key={s.id} value={s.id}>{s.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-4 px-4">
                            <div className="max-w-[200px]">
                              <p className="text-sm font-medium text-slate-800 truncate">{candidate.jobTitle}</p>
                              <p className="text-xs text-slate-500 truncate">{candidate.clientName}</p>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              candidate.status === "Approved" ? "bg-green-100 text-green-700" :
                              candidate.status === "Stalled" ? "bg-red-100 text-red-700" :
                              "bg-yellow-100 text-yellow-700"
                            }`}>
                              {candidate.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <p className="text-xs font-medium text-slate-600">{candidate.lastActivity}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Updated</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AddCandidateDrawer
            isOpen={isAddCandidateOpen}
            onClose={() => setIsAddCandidateOpen(false)}
            onSuccess={() => {
              setIsAddCandidateOpen(false);
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


