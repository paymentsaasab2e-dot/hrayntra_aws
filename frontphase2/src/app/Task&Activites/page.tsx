'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckSquare, 
  Search, 
  Plus, 
  Eye,
  Trash2,
  Phone,
  Mail,
  Users2,
  FileText,
  Clock,
  X,
  Calendar as CalendarIcon,
  List as ListIcon,
  Pencil,
  AlertTriangle,
  Download,
  RefreshCcw,
  XCircle,
} from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { downloadCsv, csvDate } from '../../utils/csv';
import { motion, AnimatePresence } from 'motion/react';
import { ImageWithFallback } from '../../components/ImageWithFallback';
import PaginationAll from '../../components/PaginationAll';
import { TABLE_PAGE_SIZE_OPTIONS, type TablePageSize } from '../../constants/tablePagination';
import { TaskDetailsDrawer, type TaskForDrawer, type TaskActivityItem } from '../../components/drawers/TaskDetailsDrawer';
import { TaskSLAAlertBadge, TaskSLAAlertsPanel } from '../../components/TaskSLAAlerts';
import {
  MOCK_TASK_ACTIVITY_EVENTS,
  MOCK_TASK_COMMUNICATIONS,
  MOCK_CANDIDATE_INTERACTIONS,
  MOCK_AI_TASK_SUGGESTIONS,
} from './types';
import type { TaskFormValues } from './types';
import { apiGetTasks, apiGetJobs, apiGetCandidates, apiGetClients, apiGetInterviews, apiGetTask, apiMarkTaskCompleted, apiDeleteTask, apiGetTaskStats, type TaskStats } from '../../lib/api';
import { transformBackendTaskToFrontend, transformBackendTaskToDrawer } from '../../lib/taskTransform';
import type { BackendCandidate, BackendClient, BackendInterviewListItem, BackendJob, BackendTask } from '../../lib/api';
import { requestConfirm, requestError } from '../../lib/appDialog';
import { usePageAutoRefresh } from '../../hooks/usePageAutoRefresh';
import { TableSkeleton } from '../../components/ui/Skeleton';
import {
  PH2_TABLE_CARD_CLASS,
  PH2_TABLE_CARD_FOOTER_CLASS,
  PH2_TOOLBAR_ROW_CLASS,
  PH2_TOOLBAR_SELECT_CLASS,
} from '../../components/layout/Ph2ModulePageLayout';
import { SummaryCardSkeleton, type SummaryCardColor } from '../../components/ui/SummaryCard';

// --- Types ---

type TaskType = 'Call' | 'Email' | 'Interview' | 'Follow-up' | 'Meeting' | 'Note';
type Priority = 'Low' | 'Medium' | 'High';
type Status = 'Pending' | 'Completed' | 'Overdue';
type TaskStatusSummary = 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';

interface RelatedTo {
  id: string;
  name: string;
  type: 'Candidate' | 'Job' | 'Client';
}

interface Task {
  id: string;
  title: string;
  type: TaskType;
  relatedTo: RelatedTo;
  dueDate: string;
  time: string;
  priority: Priority;
  status: Status;
  owner: {
    name: string;
    avatar: string;
  };
}

interface Activity {
  id: string;
  type: TaskType;
  note: string;
  timestamp: string;
  recruiter: string;
}

// --- Mock Data ---

/** Backend task detail API expects a MongoDB ObjectId (24 hex chars). Mock rows use "1", "2", etc. */
function isBackendTaskObjectId(id: string): boolean {
  return typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id.trim());
}

function getTaskStatusSummary(backendTask: BackendTask): TaskStatusSummary {
  const rawStatus = String(backendTask.status || '').trim().toUpperCase();

  if (rawStatus === 'IN_PROGRESS' || rawStatus === 'WORKING' || rawStatus === 'ONGOING') {
    return 'In Progress';
  }
  if (rawStatus === 'DONE' || rawStatus === 'COMPLETED') {
    return 'Completed';
  }
  if (rawStatus === 'CANCELLED' || rawStatus === 'CANCELED') {
    return 'Cancelled';
  }
  return 'Pending';
}

const MOCK_ACTIVITIES: Record<string, Activity[]> = {
  '1': [
    { id: 'a1', type: 'Note', note: 'Sarah expressed interest in the remote-first policy.', timestamp: '2026-02-08 10:15 AM', recruiter: 'Alex Thompson' },
    { id: 'a2', type: 'Email', note: 'Sent preliminary interview invite.', timestamp: '2026-02-07 02:30 PM', recruiter: 'Alex Thompson' },
  ],
  '2': [
    { id: 'a3', type: 'Follow-up', note: 'Waiting on compensation details from hiring manager.', timestamp: '2026-02-09 11:00 AM', recruiter: 'Alex Thompson' },
  ]
};

// --- Components ---

const SummaryCard = ({ label, count, icon: Icon, color }: { label: string; count: number; icon: any; color: string }) => (
  <div className="flex items-center gap-3 rounded-xl border border-indigo-100/60 bg-white/70 p-4 shadow-[0_8px_28px_-14px_rgba(59,130,246,0.14)] backdrop-blur-sm transition-shadow hover:shadow-[0_12px_36px_-12px_rgba(79,70,229,0.14)]">
    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${color}`}>
      <Icon size={20} />
    </div>
    <div className="min-w-0">
      <div className="text-lg font-bold text-slate-900">{count}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  </div>
);

const PriorityBadge = ({ priority }: { priority: Priority }) => {
  const colors = {
    High: 'bg-red-50 text-red-600 border-red-100',
    Medium: 'bg-amber-50 text-amber-600 border-amber-100',
    Low: 'bg-blue-50 text-blue-600 border-blue-100',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${colors[priority]}`}>
      {priority}
    </span>
  );
};

const StatusBadge = ({ status }: { status: Status }) => {
  const colors = {
    Pending: 'bg-gray-100 text-gray-600',
    Completed: 'bg-emerald-100 text-emerald-600',
    Overdue: 'bg-red-100 text-red-600',
  };
  return (
    <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${colors[status]}`}>
      {status}
    </span>
  );
};

const TaskTypeIcon = ({ type }: { type: TaskType }) => {
  const icons = {
    Call: Phone,
    Email: Mail,
    Interview: Users2,
    'Follow-up': Clock,
    Meeting: CalendarIcon,
    Note: FileText,
  };
  const Icon = icons[type];
  return <Icon size={16} className="text-gray-400" />;
};

const CALENDAR_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildMonthGrid(monthAnchor: Date): Date[] {
  const firstOfMonth = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const cell = new Date(gridStart);
    cell.setDate(gridStart.getDate() + index);
    return cell;
  });
}

const TasksFilterToolbar = ({
  todayOnly,
  priority,
  assignedTo,
  assigneeOptions,
  searchQuery,
  onTodayToggle,
  onPriorityChange,
  onAssignedToChange,
  onSearchChange,
  onClearFilters,
  hasActiveFilters,
  totalCount,
  viewSegmented,
}: {
  todayOnly: boolean;
  priority: string;
  assignedTo: string;
  assigneeOptions: string[];
  searchQuery: string;
  onTodayToggle: () => void;
  onPriorityChange: (value: string) => void;
  onAssignedToChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  totalCount: number;
  viewSegmented: React.ReactNode;
}) => (
  <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
    <div className="relative w-full lg:max-w-md lg:flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-400" strokeWidth={2.25} />
      <input
        type="text"
        placeholder="Search title, related record, or owner…"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="h-9 w-full rounded-xl border border-indigo-100/90 bg-white/95 pl-10 pr-3 text-xs text-slate-800 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] placeholder:text-slate-400 transition-all focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
      />
    </div>
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
      {viewSegmented}
      <button
        type="button"
        onClick={onTodayToggle}
        className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all ${
          todayOnly
            ? 'border-indigo-300 bg-indigo-100/80 text-indigo-900'
            : 'border-indigo-100/90 bg-white/95 text-slate-700 shadow-sm ring-1 ring-indigo-100/40 hover:bg-indigo-50/50'
        }`}
      >
        <CalendarIcon size={14} />
        Today
      </button>
      <select
        value={priority}
        onChange={(e) => onPriorityChange(e.target.value)}
        className={PH2_TOOLBAR_SELECT_CLASS}
      >
        <option value="">All priorities</option>
        <option value="High">High</option>
        <option value="Medium">Medium</option>
        <option value="Low">Low</option>
      </select>
      <select
        value={assignedTo}
        onChange={(e) => onAssignedToChange(e.target.value)}
        className={PH2_TOOLBAR_SELECT_CLASS}
      >
        <option value="">All assignees</option>
        {assigneeOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {hasActiveFilters ? (
        <button
          type="button"
          onClick={onClearFilters}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
        >
          <XCircle size={15} className="shrink-0 text-rose-500" strokeWidth={2.35} />
          Clear
        </button>
      ) : null}
      <span className="whitespace-nowrap text-[11px] font-medium text-slate-500">
        Total: <span className="font-semibold text-slate-800">{totalCount}</span>
      </span>
    </div>
  </div>
);

const CalendarView = ({ tasks, onTaskClick, shellClassName = '' }: { tasks: Task[]; onTaskClick: (task: Task) => void; shellClassName?: string }) => {
  const [activeMonth, setActiveMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const todayKey = toLocalDateKey(new Date());
  const monthLabel = `${String(activeMonth.getMonth() + 1).padStart(2, '0')}/${activeMonth.getFullYear()}`;

  const tasksByDate = useMemo(() => {
    return tasks.reduce<Record<string, Task[]>>((acc, task) => {
      if (!task.dueDate) return acc;
      const key = task.dueDate.slice(0, 10);
      if (!acc[key]) acc[key] = [];
      acc[key].push(task);
      return acc;
    }, {});
  }, [tasks]);

  const monthGrid = useMemo(() => buildMonthGrid(activeMonth), [activeMonth]);

  const goToToday = () => {
    const now = new Date();
    setActiveMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  return (
    <div className={`overflow-hidden border border-gray-200 bg-white shadow-sm ${shellClassName}`}>
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-100">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Calendar</h2>
          <p className="text-xs text-gray-500">Tasks placed on their due dates</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ← Prev
          </button>
          <button
            type="button"
            onClick={goToToday}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setActiveMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Next →
          </button>
          <div className="ml-3 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
            {monthLabel}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/70">
        {CALENDAR_WEEKDAYS.map((day) => (
          <div key={day} className="px-3 py-3 text-xs font-bold uppercase tracking-[0.18em] text-gray-500 text-center">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 auto-rows-[minmax(140px,1fr)]">
        {monthGrid.map((date) => {
          const dateKey = toLocalDateKey(date);
          const dayTasks = tasksByDate[dateKey] || [];
          const isCurrentMonth = date.getMonth() === activeMonth.getMonth();
          const isToday = dateKey === todayKey;
          const visibleTasks = dayTasks.slice(0, 3);
          const remainingTasks = Math.max(dayTasks.length - visibleTasks.length, 0);

          return (
            <div
              key={dateKey}
              className={`border-r border-b border-gray-100 p-2 flex flex-col gap-2 ${isCurrentMonth ? 'bg-white' : 'bg-gray-50/40 text-gray-400'}`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                    isToday ? 'bg-blue-600 text-white' : 'text-gray-700'
                  }`}
                >
                  {date.getDate()}
                </span>
                {dayTasks.length > 0 && (
                  <span className="text-[11px] font-medium text-gray-500">
                    {dayTasks.length} task{dayTasks.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>

              <div className="flex-1 space-y-2 overflow-hidden">
                {visibleTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onTaskClick(task)}
                    className="w-full rounded-lg border border-gray-200 bg-white p-2 text-left shadow-sm hover:shadow-md hover:border-blue-200 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-gray-900 truncate">{task.title}</div>
                        <div className="mt-0.5 text-[10px] text-gray-500">
                          {task.time || task.type}
                        </div>
                      </div>
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            task.priority === 'High' ? '#ef4444' : task.priority === 'Medium' ? '#f59e0b' : '#3b82f6',
                        }}
                      />
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      <TaskTypeIcon type={task.type} />
                      <span className="text-[10px] font-medium text-gray-500">{task.type}</span>
                    </div>
                  </button>
                ))}

                {remainingTasks > 0 && (
                  <div className="rounded-lg border border-dashed border-gray-200 px-2 py-2 text-[11px] font-medium text-gray-500 text-center">
                    +{remainingTasks} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function App() {
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'detail' | 'edit'>('detail');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedBackendTask, setSelectedBackendTask] = useState<BackendTask | null>(null);
  const [createTaskPrefill, setCreateTaskPrefill] = useState<Partial<TaskFormValues> | null>(null);
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<Task | null>(null);
  const [slaDrawerOpen, setSlaDrawerOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [backendTasks, setBackendTasks] = useState<BackendTask[]>([]);
  const [jobTitleById, setJobTitleById] = useState<Record<string, string>>({});
  const [candidateNameById, setCandidateNameById] = useState<Record<string, string>>({});
  const [clientNameById, setClientNameById] = useState<Record<string, string>>({});
  const [interviewNameById, setInterviewNameById] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<TablePageSize>(10);
  const [showTaskSuccessToast, setShowTaskSuccessToast] = useState(false);
  const [taskSuccessToastMessage, setTaskSuccessToastMessage] = useState('Task created successfully');
  const [filters, setFilters] = useState({
    todayOnly: false,
    priority: '',
    assignedTo: '',
    search: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<TaskStats | null>(null);

  useEffect(() => {
    if (!showTaskSuccessToast) return;
    const timeout = window.setTimeout(() => setShowTaskSuccessToast(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [showTaskSuccessToast]);

  const extractBackendTasks = (responseData: unknown): BackendTask[] => {
    if (Array.isArray(responseData)) return responseData as BackendTask[];
    if (responseData && typeof responseData === 'object') {
      const payload = responseData as { data?: unknown; items?: unknown };
      if (Array.isArray(payload.data)) return payload.data as BackendTask[];
      if (Array.isArray(payload.items)) return payload.items as BackendTask[];
    }
    return [];
  };

  const extractBackendJobs = (responseData: unknown): BackendJob[] => {
    if (Array.isArray(responseData)) return responseData as BackendJob[];
    if (responseData && typeof responseData === 'object') {
      const payload = responseData as { data?: unknown; items?: unknown };
      if (Array.isArray(payload.data)) return payload.data as BackendJob[];
      if (Array.isArray(payload.items)) return payload.items as BackendJob[];
    }
    return [];
  };

  const extractBackendCandidates = (responseData: unknown): BackendCandidate[] => {
    if (Array.isArray(responseData)) return responseData as BackendCandidate[];
    if (responseData && typeof responseData === 'object') {
      const payload = responseData as { data?: unknown; items?: unknown };
      if (Array.isArray(payload.data)) return payload.data as BackendCandidate[];
      if (Array.isArray(payload.items)) return payload.items as BackendCandidate[];
    }
    return [];
  };

  const extractBackendClients = (responseData: unknown): BackendClient[] => {
    if (Array.isArray(responseData)) return responseData as BackendClient[];
    if (responseData && typeof responseData === 'object') {
      const payload = responseData as { data?: unknown; items?: unknown };
      if (Array.isArray(payload.data)) return payload.data as BackendClient[];
      if (Array.isArray(payload.items)) return payload.items as BackendClient[];
    }
    return [];
  };

  const extractBackendInterviews = (responseData: unknown): BackendInterviewListItem[] => {
    if (Array.isArray(responseData)) return responseData as BackendInterviewListItem[];
    if (responseData && typeof responseData === 'object') {
      const payload = responseData as { data?: unknown; items?: unknown };
      if (Array.isArray(payload.data)) return payload.data as BackendInterviewListItem[];
      if (Array.isArray(payload.items)) return payload.items as BackendInterviewListItem[];
    }
    return [];
  };

  const getRelatedEntityName = (backendTask: BackendTask) => {
    if (!backendTask.linkedEntityId) return undefined;
    switch (backendTask.linkedEntityType) {
      case 'JOB':
        return jobTitleById[backendTask.linkedEntityId];
      case 'CANDIDATE':
        return candidateNameById[backendTask.linkedEntityId];
      case 'CLIENT':
        return clientNameById[backendTask.linkedEntityId];
      case 'INTERVIEW':
        return interviewNameById[backendTask.linkedEntityId];
      default:
        return undefined;
    }
  };

  const extractTaskStats = (responseData: unknown): TaskStats | null => {
    if (!responseData || typeof responseData !== 'object') return null;

    const payload = responseData as {
      data?: unknown;
      stats?: unknown;
      item?: unknown;
      completedToday?: unknown;
      overdueCount?: unknown;
      avgCompletionTimeDays?: unknown;
      productivityPercent?: unknown;
      dueToday?: unknown;
      overdue?: unknown;
      upcoming7d?: unknown;
      completed?: unknown;
      trendCompletedToday?: unknown;
    };

    const source =
      (payload.data && typeof payload.data === 'object' ? payload.data : null) ||
      (payload.stats && typeof payload.stats === 'object' ? payload.stats : null) ||
      (payload.item && typeof payload.item === 'object' ? payload.item : null) ||
      responseData;

    const readNumber = (value: unknown, fallback = 0) => {
      const num = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(num) ? num : fallback;
    };

    const statSource = source as Record<string, unknown>;
    const stats: TaskStats = {
      completedToday: readNumber(statSource.completedToday ?? payload.completedToday),
      overdueCount: readNumber(statSource.overdueCount ?? payload.overdueCount),
      avgCompletionTimeDays: readNumber(statSource.avgCompletionTimeDays ?? payload.avgCompletionTimeDays),
      productivityPercent: readNumber(statSource.productivityPercent ?? payload.productivityPercent),
      dueToday: readNumber(statSource.dueToday ?? payload.dueToday),
      overdue: readNumber(statSource.overdue ?? payload.overdue),
      upcoming7d: readNumber(statSource.upcoming7d ?? payload.upcoming7d),
      completed: readNumber(statSource.completed ?? payload.completed),
      trendCompletedToday:
        typeof statSource.trendCompletedToday === 'string'
          ? statSource.trendCompletedToday
          : typeof payload.trendCompletedToday === 'string'
            ? payload.trendCompletedToday
            : undefined,
    };

    return stats;
  };

  const refreshTasksAndStats = async ({ includeStats = true }: { includeStats?: boolean } = {}) => {
    // Tasks themselves are required; everything else is best-effort so a user
    // without `jobs_read` (e.g. a sales role) can still open the Tasks tab.
    // Tasks may link to leads / clients / billing or stand alone — fetching
    // jobs is just a label lookup and must not block the page.
    const tasksResponse = await apiGetTasks({ page: 1, limit: 500 });
    const [jobsResult, candidatesResult, clientsResult, interviewsResult] = await Promise.allSettled([
      apiGetJobs({ limit: 500 }),
      apiGetCandidates({ limit: 500 }),
      apiGetClients({ limit: 500 }),
      apiGetInterviews({ limit: 100 }),
    ]);

    const taskCollection = tasksResponse.data
      ? (() => {
          if (Array.isArray(tasksResponse.data)) {
            return { items: tasksResponse.data as BackendTask[], pagination: undefined };
          }
          const payload = tasksResponse.data as { data?: unknown; items?: unknown; pagination?: { total?: number } };
          return {
            items: extractBackendTasks(tasksResponse.data),
            pagination: payload.pagination,
          };
        })()
      : { items: [] as BackendTask[], pagination: undefined };

    const typedBackendTasks = Array.isArray(taskCollection.items) ? taskCollection.items : [];
    const typedJobs = jobsResult.status === 'fulfilled' ? extractBackendJobs(jobsResult.value.data) : [];
    const typedCandidates = candidatesResult.status === 'fulfilled' ? extractBackendCandidates(candidatesResult.value.data) : [];
    const typedClients = clientsResult.status === 'fulfilled' ? extractBackendClients(clientsResult.value.data) : [];
    const typedInterviews = interviewsResult.status === 'fulfilled' ? extractBackendInterviews(interviewsResult.value.data) : [];
    const jobsLookup = typedJobs.reduce<Record<string, string>>((acc, job) => {
      acc[job.id] = job.title;
      return acc;
    }, {});
    const candidatesLookup = typedCandidates.reduce<Record<string, string>>((acc, candidate) => {
      acc[candidate.id] = `${candidate.firstName} ${candidate.lastName}`.trim();
      return acc;
    }, {});
    const clientsLookup = typedClients.reduce<Record<string, string>>((acc, client) => {
      acc[client.id] = client.companyName;
      return acc;
    }, {});
    const interviewsLookup = typedInterviews.reduce<Record<string, string>>((acc, interview) => {
      const candidateName = `${interview.candidate.firstName} ${interview.candidate.lastName}`.trim();
      const round = interview.round?.trim() || interview.type?.trim() || 'Interview';
      acc[interview.id] = `${candidateName} - ${round}`;
      return acc;
    }, {});

    setBackendTasks(typedBackendTasks);
    setJobTitleById(jobsLookup);
    setCandidateNameById(candidatesLookup);
    setClientNameById(clientsLookup);
    setInterviewNameById(interviewsLookup);
    setTasks(
      typedBackendTasks.map((backendTask) => {
        return transformBackendTaskToFrontend(backendTask, {
          relatedEntityName:
            backendTask.linkedEntityType === 'JOB' && backendTask.linkedEntityId
              ? jobsLookup[backendTask.linkedEntityId]
              : backendTask.linkedEntityType === 'CANDIDATE' && backendTask.linkedEntityId
                ? candidatesLookup[backendTask.linkedEntityId]
                : backendTask.linkedEntityType === 'CLIENT' && backendTask.linkedEntityId
                  ? clientsLookup[backendTask.linkedEntityId]
                  : backendTask.linkedEntityType === 'INTERVIEW' && backendTask.linkedEntityId
                    ? interviewsLookup[backendTask.linkedEntityId]
                    : undefined,
        });
      })
    );
    if (includeStats) {
      const statsResponse = await apiGetTaskStats();
      setStats(extractTaskStats(statsResponse.data));
    }

    return typedBackendTasks;
  };

  // Fetch tasks and stats from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        
        if (!token) {
          console.warn('No authentication token found. Showing empty task state.');
          setTasks([]);
          setBackendTasks([]);
          setJobTitleById({});
          setCandidateNameById({});
          setClientNameById({});
          setInterviewNameById({});
          setLoading(false);
          return;
        }

        await refreshTasksAndStats();
      } catch (err: any) {
        console.error('Failed to fetch data:', err);
        setError(err.message || 'Failed to load data');
        setTasks([]);
        setBackendTasks([]);
        setJobTitleById({});
        setCandidateNameById({});
        setClientNameById({});
        setInterviewNameById({});
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Reusable auto-refresh — same hook used on jobs / dashboard / leads etc.
  usePageAutoRefresh(
    async ({ silent }) => {
      try {
        if (!silent) setLoading(true);
        await refreshTasksAndStats();
      } catch {
        /* keep current state on transient failure */
      } finally {
        if (!silent) setLoading(false);
      }
    },
    { events: ['jobportal:tasks-changed', 'jobportal:jobs-changed'] }
  );

  const statusSummaryCounts = useMemo(() => {
    return backendTasks.reduce<Record<TaskStatusSummary, number>>(
      (counts, task) => {
        counts[getTaskStatusSummary(task)] += 1;
        return counts;
      },
      {
        Pending: 0,
        'In Progress': 0,
        Completed: 0,
        Cancelled: 0,
      }
    );
  }, [backendTasks]);

  const slaOverdueCount = stats?.overdue ?? 0;
  const filteredTasks = useMemo(() => {
    const todayString = new Date().toISOString().split('T')[0];

    return tasks.filter((task) => {
      if (filters.todayOnly && task.dueDate !== todayString) return false;
      if (filters.priority && task.priority !== filters.priority) return false;
      if (filters.assignedTo && task.owner.name !== filters.assignedTo) return false;
      const q = filters.search.trim().toLowerCase();
      if (q) {
        const relatedLabel =
          task.relatedTo.type === 'Job' && jobTitleById[task.relatedTo.id]
            ? jobTitleById[task.relatedTo.id]
            : task.relatedTo.name;
        const hay = [task.title, relatedLabel, task.relatedTo.type, task.owner.name, task.type, task.status]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [filters, tasks, jobTitleById]);

  const totalPages = Math.max(Math.ceil(filteredTasks.length / pageSize), 1);
  const visibleTasks = filteredTasks.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showingStart = filteredTasks.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const showingEnd = filteredTasks.length === 0 ? 0 : Math.min(currentPage * pageSize, filteredTasks.length);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters.todayOnly, filters.priority, filters.assignedTo, filters.search]);

  const assigneeOptions = useMemo(() => {
    return Array.from(new Set(tasks.map((task) => task.owner.name))).sort();
  }, [tasks]);

  const clearFilters = () => {
    setCurrentPage(1);
    setFilters({
      todayOnly: false,
      priority: '',
      assignedTo: '',
      search: '',
    });
  };

  const handleMarkTaskCompleted = async (taskId: string) => {
    if (!isBackendTaskObjectId(taskId)) {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: 'Completed' as Status } : t))
      );
      setSelectedTask((prev) =>
        prev && prev.id === taskId ? { ...prev, status: 'Completed' } : prev
      );
      setTaskSuccessToastMessage('Task marked as completed');
      setShowTaskSuccessToast(true);
      return;
    }

    try {
      await apiMarkTaskCompleted(taskId);
      await refreshTasksAndStats();
      if (selectedTask && selectedTask.id === taskId) {
        const taskResponse = await apiGetTask(taskId);
        if (taskResponse.data) {
          const backendTask = taskResponse.data as BackendTask;
          setSelectedBackendTask(backendTask);
          setSelectedTask(transformBackendTaskToFrontend(backendTask));
        }
      }
      setTaskSuccessToastMessage('Task marked as completed');
      setShowTaskSuccessToast(true);
    } catch (error: any) {
      console.error('Failed to mark task as completed:', error);
      void requestError(error.message || 'Failed to update task');
    }
  };

  const openCreateTask = () => {
    setSelectedTask(null);
    setCreateTaskPrefill(null);
    setDrawerMode('create');
    setDrawerOpen(true);
  };

  const handleCreateTaskFromSuggestion = (suggestion: { prefill?: Partial<TaskFormValues> }) => {
    setSelectedTask(null);
    setCreateTaskPrefill(suggestion.prefill ?? null);
    setDrawerMode('create');
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setCreateTaskPrefill(null);
    setSelectedBackendTask(null);
  };

  const handleRequestTaskDelete = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmTask(task);
  };

  const handleConfirmTaskDelete = async () => {
    if (!deleteConfirmTask) return;
    try {
      await apiDeleteTask(deleteConfirmTask.id);
      setTasks((prev) => prev.filter((item) => item.id !== deleteConfirmTask.id));
      setBackendTasks((prev) => prev.filter((item) => item.id !== deleteConfirmTask.id));
      setDeleteConfirmTask(null);
      await refreshTasksAndStats({ includeStats: true });
      if (selectedTask?.id === deleteConfirmTask.id) {
        setDrawerOpen(false);
        setSelectedTask(null);
        setSelectedBackendTask(null);
      }
    } catch (error: any) {
      console.error('Failed to delete task:', error);
      void requestError(error.message || 'Failed to delete task');
    }
  };

  const handleRowClick = async (task: Task) => {
    if (!isBackendTaskObjectId(task.id)) {
      setSelectedBackendTask(null);
      setSelectedTask(task);
      setDrawerMode('detail');
      setDrawerOpen(true);
      return;
    }

    try {
        const response = await apiGetTask(task.id);
        if (response.data) {
          const backendTask = response.data as BackendTask;
          setSelectedBackendTask(backendTask);
          const fullTask = transformBackendTaskToFrontend(backendTask, {
            relatedEntityName: getRelatedEntityName(backendTask),
          });
          setSelectedTask(fullTask);
        } else {
        setSelectedBackendTask(null);
        setSelectedTask(task);
      }
      setDrawerMode('detail');
      setDrawerOpen(true);
    } catch (error) {
      console.error('Failed to fetch task details:', error);
      setSelectedBackendTask(null);
      setSelectedTask(task);
      setDrawerMode('detail');
      setDrawerOpen(true);
    }
  };

  const handleEditTask = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    setDrawerMode('edit');

    if (isBackendTaskObjectId(task.id)) {
      try {
        const response = await apiGetTask(task.id);
        if (response.data) {
          const backendTask = response.data as BackendTask;
          setSelectedBackendTask(backendTask);
          setSelectedTask(transformBackendTaskToFrontend(backendTask, {
            relatedEntityName: getRelatedEntityName(backendTask),
          }));
        } else {
          setSelectedBackendTask(null);
          setSelectedTask(task);
        }
      } catch (error) {
        console.error('Failed to fetch task details for edit:', error);
        setSelectedBackendTask(null);
        setSelectedTask(task);
      }
    } else {
      setSelectedBackendTask(null);
      setSelectedTask(task);
    }

    setDrawerOpen(true);
  };

  const hasToolbarFilters = Boolean(
    filters.search.trim() || filters.todayOnly || filters.priority || filters.assignedTo
  );

  const viewSegmented = (
    <div className="inline-flex w-fit items-center rounded-lg border border-indigo-100/90 bg-white/95 p-0.5 shadow-sm ring-1 ring-indigo-100/40">
      <button
        type="button"
        onClick={() => setView('list')}
        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
          view === 'list'
            ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-sm'
            : 'text-slate-600 hover:bg-indigo-50/50'
        }`}
      >
        <ListIcon size={14} className="shrink-0" />
        List
      </button>
      <button
        type="button"
        onClick={() => setView('calendar')}
        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
          view === 'calendar'
            ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-sm'
            : 'text-slate-600 hover:bg-indigo-50/50'
        }`}
      >
        <CalendarIcon size={14} className="shrink-0" />
        Calendar
      </button>
    </div>
  );

  const tasksToolbar = (
    <TasksFilterToolbar
      todayOnly={filters.todayOnly}
      priority={filters.priority}
      assignedTo={filters.assignedTo}
      assigneeOptions={assigneeOptions}
      searchQuery={filters.search}
      onSearchChange={(search) => {
        setCurrentPage(1);
        setFilters((prev) => ({ ...prev, search }));
      }}
      onTodayToggle={() => {
        setCurrentPage(1);
        setFilters((prev) => ({ ...prev, todayOnly: !prev.todayOnly }));
      }}
      onPriorityChange={(priority) => {
        setCurrentPage(1);
        setFilters((prev) => ({ ...prev, priority }));
      }}
      onAssignedToChange={(assignedTo) => {
        setCurrentPage(1);
        setFilters((prev) => ({ ...prev, assignedTo }));
      }}
      onClearFilters={clearFilters}
      hasActiveFilters={hasToolbarFilters}
      totalCount={filteredTasks.length}
      viewSegmented={viewSegmented}
    />
  );

  return (
    <>
      <Toaster position="top-right" richColors style={{ top: '5rem' }} />
      <div className="w-full min-h-screen overflow-hidden text-slate-900">
        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <header className="flex min-h-[4.5rem] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-indigo-100/50 bg-white/80 px-4 py-3 shadow-[inset_0_-1px_0_0_rgba(99,102,241,0.08)] backdrop-blur-md sm:px-6">
            <div className="flex items-start gap-2.5 sm:gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 via-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-white/20">
                <CheckSquare className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <div>
                <h1 className="text-xl font-bold leading-tight tracking-tight text-slate-900 sm:text-[1.35rem]">Tasks & Activities</h1>
                <p className="mt-0.5 max-w-xl text-xs text-slate-500">Manage your daily recruitment workflow and follow-ups.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    setLoading(true);
                    await refreshTasksAndStats();
                  } catch {
                    /* ignore */
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-200/80 bg-white text-indigo-700 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.2)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98] disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCcw size={16} strokeWidth={2.25} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                type="button"
                onClick={() => setSlaDrawerOpen(true)}
                className="relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-indigo-200/80 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition-all hover:border-red-200/80 hover:bg-red-50/40"
                title="View all SLA alerts"
              >
                <AlertTriangle size={16} className="text-red-500" />
                <span>SLA</span>
                {slaOverdueCount > 0 ? (
                  <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {slaOverdueCount > 99 ? '99+' : slaOverdueCount}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (filteredTasks.length === 0) {
                    toast.message('No tasks to export with current filters.');
                    return;
                  }
                  downloadCsv<Task>(
                    `tasks-${new Date().toISOString().slice(0, 10)}.csv`,
                    [
                      { id: 'title', accessor: (t) => t.title },
                      { id: 'type', accessor: (t) => t.type },
                      { id: 'relatedTo', accessor: (t) => `${t.relatedTo?.type || ''}: ${t.relatedTo?.name || ''}`.replace(/^:\s*/, '') },
                      { id: 'dueDate', accessor: (t) => csvDate(t.dueDate) },
                      { id: 'time', accessor: (t) => t.time || '' },
                      { id: 'priority', accessor: (t) => t.priority },
                      { id: 'status', accessor: (t) => t.status },
                      { id: 'owner', accessor: (t) => t.owner?.name || '' },
                    ],
                    filteredTasks,
                  );
                  toast.success(`Exported ${filteredTasks.length} task${filteredTasks.length === 1 ? '' : 's'} to CSV`);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-indigo-200/70 bg-white px-3 py-2 text-xs font-semibold text-indigo-900 shadow-[0_4px_14px_-4px_rgba(99,102,241,0.25)] transition-all hover:border-indigo-300 hover:bg-indigo-50/90 active:scale-[0.98]"
                title="Export visible tasks to CSV"
              >
                <Download size={16} className="text-indigo-600" strokeWidth={2.25} />
                <span>Export</span>
              </button>
              <button
                type="button"
                onClick={openCreateTask}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 active:scale-[0.98]"
              >
                <Plus size={16} className="text-white" strokeWidth={2.5} />
                <span>Create task</span>
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
            <div className="mx-auto max-w-[1600px]">
              <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
                {loading && tasks.length === 0 ? (
                  (['blue', 'cyan', 'orange', 'purple'] as SummaryCardColor[]).map((c, i) => <SummaryCardSkeleton key={i} color={c} />)
                ) : (
                  <>
                    <SummaryCard label="Pending" count={statusSummaryCounts.Pending} icon={Clock} color="bg-amber-100 text-amber-600" />
                    <SummaryCard label="In Progress" count={statusSummaryCounts['In Progress']} icon={Pencil} color="bg-blue-100 text-blue-600" />
                    <SummaryCard label="Completed" count={statusSummaryCounts.Completed} icon={CheckSquare} color="bg-emerald-100 text-emerald-600" />
                    <SummaryCard label="Cancelled" count={statusSummaryCounts.Cancelled} icon={X} color="bg-rose-100 text-rose-600" />
                  </>
                )}
              </div>

          {/* Main Content */}
          {view === 'list' ? (
            <div className={PH2_TABLE_CARD_CLASS}>
              <div className={PH2_TOOLBAR_ROW_CLASS}>{tasksToolbar}</div>
              <div className="overflow-hidden">
                <div className="no-scrollbar overflow-x-auto">
              <table className="w-full min-w-[1180px] text-left">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Task Title</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Related To</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Due Date</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Priority</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Assigned to</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="p-0">
                        <TableSkeleton rows={6} columns={8} className="border-0 shadow-none rounded-none" />
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-sm text-red-500">
                        {error}
                      </td>
                    </tr>
                  ) : filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">
                        No tasks found. Try clearing the filters or create a new task.
                      </td>
                    </tr>
                  ) : (
                    visibleTasks.map((task) => (
                    <tr 
                      key={task.id} 
                      onClick={() => handleRowClick(task)}
                      className="hover:bg-blue-50/30 cursor-pointer transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${task.status === 'Completed' ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                            <TaskTypeIcon type={task.type} />
                          </div>
                          <span className="text-sm font-bold text-gray-900">
                            {task.title}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium text-gray-600">{task.type}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-900">
                            {task.relatedTo.type === 'Job' && jobTitleById[task.relatedTo.id]
                              ? jobTitleById[task.relatedTo.id]
                              : task.relatedTo.name}
                          </span>
                          <span className="text-[10px] text-gray-400 uppercase font-bold">{task.relatedTo.type}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">{task.dueDate}</span>
                          <span className="text-[11px] text-gray-400">{task.time}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <PriorityBadge priority={task.priority} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={task.status} />
                          <TaskSLAAlertBadge dueDate={task.dueDate} status={task.status} variant="row" />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <ImageWithFallback src={task.owner.avatar} className="w-6 h-6 rounded-full" />
                          <span className="text-[13px] font-medium text-gray-600">{task.owner.name.split(' ')[0]}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        {/* Colored action icons — same design language as
                            Leads / Clients / Candidates / Contacts. */}
                        <div className="inline-flex items-center justify-end gap-0.5 rounded-2xl bg-slate-100/70 p-1 ring-1 ring-slate-200/60">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleMarkTaskCompleted(task.id);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-xl text-emerald-600 hover:bg-white hover:text-emerald-800 hover:shadow-sm transition-all"
                            title="Mark completed"
                          >
                            <CheckSquare size={16} strokeWidth={2.25} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRowClick(task);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-xl text-blue-600 hover:bg-white hover:text-blue-700 hover:shadow-sm transition-all"
                            title="View task"
                          >
                            <Eye size={16} strokeWidth={2.25} />
                          </button>
                          <button
                            onClick={(e) => handleEditTask(task, e)}
                            className="flex h-8 w-8 items-center justify-center rounded-xl text-amber-600 hover:bg-white hover:text-amber-800 hover:shadow-sm transition-all"
                            title="Edit task"
                          >
                            <Pencil size={16} strokeWidth={2.25} />
                          </button>
                          <button
                            onClick={async (e) => {
                              handleRequestTaskDelete(task, e);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-xl text-rose-500 hover:bg-white hover:text-rose-700 hover:shadow-sm transition-all"
                            title="Delete task"
                          >
                            <Trash2 size={16} strokeWidth={2.25} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    ))
                  )}
                </tbody>
              </table>
                </div>
              </div>
              <div className={PH2_TABLE_CARD_FOOTER_CLASS}>
                <PaginationAll
                  initialPage={currentPage}
                  totalPages={Math.max(totalPages, 1)}
                  totalCount={filteredTasks.length}
                  pageSize={pageSize}
                  pageSizeOptions={[...TABLE_PAGE_SIZE_OPTIONS]}
                  onPageSizeChange={(n) => {
                    if (!(TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) return;
                    setPageSize(n as TablePageSize);
                    setCurrentPage(1);
                  }}
                  itemLabel="tasks"
                  onPageChange={setCurrentPage}
                />
              </div>
            </div>
          ) : (
            <div className={PH2_TABLE_CARD_CLASS}>
              <div className={PH2_TOOLBAR_ROW_CLASS}>{tasksToolbar}</div>
              <CalendarView
                tasks={filteredTasks}
                onTaskClick={handleRowClick}
                shellClassName="rounded-b-xl border-0 border-t border-gray-200 shadow-none"
              />
            </div>
          )}
            </div>
          </div>
      </main>

      <AnimatePresence>
        {deleteConfirmTask && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDeleteConfirmTask(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="bg-white rounded-xl border border-slate-200 shadow-xl p-5 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">Delete task?</p>
                  <p className="text-xs text-slate-500">This action cannot be undone.</p>
                </div>
              </div>

              <p className="mb-4 text-xs text-slate-500">
                Are you sure you want to delete <span className="font-medium text-slate-900">"{deleteConfirmTask.title}"</span>?
              </p>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmTask(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmTaskDelete}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* All SLA Alerts drawer (from Tasks page button) */}
      <AnimatePresence>
        {slaDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSlaDrawerOpen(false)}
              className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] pointer-events-auto"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 pointer-events-auto border-l border-slate-200 flex flex-col"
            >
              <div className="shrink-0 border-b border-slate-200 p-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">SLA Alerts</h2>
                <button
                  type="button"
                  onClick={() => setSlaDrawerOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <TaskSLAAlertsPanel
                  tasks={tasks}
                  onTaskClick={(id) => {
                    setSlaDrawerOpen(false);
                    const t = tasks.find((x) => x.id === id);
                    if (t) handleRowClick(t);
                  }}
                  showAITip
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <TaskDetailsDrawer
        isOpen={drawerOpen}
        onClose={handleCloseDrawer}
        mode={drawerMode}
        task={(drawerMode === 'detail' || drawerMode === 'edit') && selectedBackendTask ? transformBackendTaskToDrawer(selectedBackendTask, {
          relatedEntityName:
            selectedBackendTask.linkedEntityType === 'JOB' && selectedBackendTask.linkedEntityId
              ? jobTitleById[selectedBackendTask.linkedEntityId] || selectedBackendTask.linkedEntityId
              : selectedBackendTask.linkedEntityType === 'CANDIDATE' && selectedBackendTask.linkedEntityId
                ? candidateNameById[selectedBackendTask.linkedEntityId] || selectedBackendTask.linkedEntityId
                : selectedBackendTask.linkedEntityType === 'CLIENT' && selectedBackendTask.linkedEntityId
                  ? clientNameById[selectedBackendTask.linkedEntityId] || selectedBackendTask.linkedEntityId
                  : selectedBackendTask.linkedEntityType === 'INTERVIEW' && selectedBackendTask.linkedEntityId
                    ? interviewNameById[selectedBackendTask.linkedEntityId] || selectedBackendTask.linkedEntityId
                    : selectedBackendTask.linkedEntityId || undefined,
        }) : (selectedTask ? (() => {
          // Convert Task to TaskForDrawer format (fallback)
          const taskForDrawer: TaskForDrawer = {
            id: selectedTask.id,
            title: selectedTask.title,
            type: selectedTask.type,
            relatedTo: selectedTask.relatedTo,
            dueDate: selectedTask.dueDate,
            time: selectedTask.time,
            dueTime: selectedTask.time,
            priority: selectedTask.priority,
            status: selectedTask.status,
            owner: selectedTask.owner,
          };
          return taskForDrawer;
        })() : null)}
        activities={(selectedTask ? (MOCK_ACTIVITIES[selectedTask.id] ?? []) : []) as TaskActivityItem[]}
        activityEvents={selectedTask ? (MOCK_TASK_ACTIVITY_EVENTS[selectedTask.id] ?? []) : []}
        communicationEntries={selectedTask ? (MOCK_TASK_COMMUNICATIONS[selectedTask.id] ?? []) : []}
        candidateInteractionEntries={selectedTask ? (MOCK_CANDIDATE_INTERACTIONS[selectedTask.id] ?? []) : []}
        createTaskPrefill={createTaskPrefill}
        aiSuggestions={MOCK_AI_TASK_SUGGESTIONS}
        onCreateTaskFromSuggestion={handleCreateTaskFromSuggestion}
        onCreateSuccess={async () => {
          setCreateTaskPrefill(null);
          setTaskSuccessToastMessage('Task created successfully');
          setShowTaskSuccessToast(true);
          try {
            await refreshTasksAndStats();
          } catch (error) {
            console.error('Failed to refresh tasks:', error);
          }
        }}
        onRequestEdit={() => setDrawerMode('edit')}
        onExitEdit={async () => {
          setDrawerMode('detail');
          if (selectedTask && isBackendTaskObjectId(selectedTask.id)) {
            try {
              const response = await apiGetTask(selectedTask.id);
              if (response.data) {
                const backendTask = response.data as BackendTask;
                setSelectedBackendTask(backendTask);
                const updatedTask = transformBackendTaskToFrontend(backendTask, {
                  relatedEntityName: getRelatedEntityName(backendTask),
                });
                setSelectedTask(updatedTask);
              }
            } catch (error) {
              console.error('Failed to refresh task:', error);
            }
          }
        }}
        onUpdateSuccess={async () => {
          try {
            await refreshTasksAndStats();

            if (selectedTask && isBackendTaskObjectId(selectedTask.id)) {
              const taskResponse = await apiGetTask(selectedTask.id);
              if (taskResponse.data) {
                const backendTask = taskResponse.data as BackendTask;
                setSelectedBackendTask(backendTask);
                setSelectedTask(transformBackendTaskToFrontend(backendTask, {
                  relatedEntityName: getRelatedEntityName(backendTask),
                }));
              }
            }
          } catch (error) {
            console.error('Failed to refresh tasks:', error);
          }
        }}
        onMarkCompleted={async (taskId) => {
          if (!isBackendTaskObjectId(taskId)) {
            setTasks((prev) =>
              prev.map((t) => (t.id === taskId ? { ...t, status: 'Completed' as Status } : t))
            );
            setSelectedTask((prev) =>
              prev && prev.id === taskId ? { ...prev, status: 'Completed' } : prev
            );
            return;
          }
          try {
            await apiMarkTaskCompleted(taskId);
            await refreshTasksAndStats();
            if (selectedTask && selectedTask.id === taskId) {
              const taskResponse = await apiGetTask(taskId);
              if (taskResponse.data) {
                const backendTask = taskResponse.data as BackendTask;
                setSelectedBackendTask(backendTask);
                setSelectedTask(transformBackendTaskToFrontend(backendTask));
              }
            }
          } catch (error: any) {
            console.error('Failed to mark task as completed:', error);
            void requestError(error.message || 'Failed to update task');
          }
        }}
        onDelete={async (taskId) => {
          if (!(await requestConfirm('Are you sure you want to delete this task?'))) return;
          if (!isBackendTaskObjectId(taskId)) {
            setTasks((prev) => prev.filter((t) => t.id !== taskId));
            setDrawerOpen(false);
            setSelectedTask(null);
            setSelectedBackendTask(null);
            return;
          }
          try {
            await apiDeleteTask(taskId);
            await refreshTasksAndStats();
            setDrawerOpen(false);
            setSelectedTask(null);
            setSelectedBackendTask(null);
          } catch (error: any) {
            console.error('Failed to delete task:', error);
            void requestError(error.message || 'Failed to delete task');
          }
        }}
        onRelatedEntityClick={(entity) => { /* TODO: navigate to /candidate, /job, /client by entity.type and entity.id */ }}
      />

      <AnimatePresence>
        {showTaskSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed top-6 right-6 z-[80] bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2"
          >
            <CheckSquare size={18} />
            <span className="text-sm font-medium">{taskSuccessToastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </>
  );
}
