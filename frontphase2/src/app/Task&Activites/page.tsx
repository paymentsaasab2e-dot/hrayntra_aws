'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Briefcase, 
  Calendar, 
  CheckSquare, 
  Contact, 
  Search, 
  Plus, 
  ChevronRight,
  MoreVertical,
  Phone,
  Mail,
  Users2,
  FileText,
  Clock,
  Filter,
  X,
  ChevronLeft,
  Calendar as CalendarIcon,
  List as ListIcon,
  Pencil,
  AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageWithFallback } from '../../components/ImageWithFallback';
import { TaskDetailsDrawer, type TaskForDrawer, type TaskActivityItem } from '../../components/drawers/TaskDetailsDrawer';
import { TaskSLAAlertBadge, TaskSLAAlertsPanel, getDaysOverdue } from '../../components/TaskSLAAlerts';
import { TaskAnalyticsCards, type TaskAnalyticsData, type TaskAnalyticsCardId } from '../../components/TaskAnalyticsCards';
import {
  MOCK_TASK_ACTIVITY_EVENTS,
  MOCK_TASK_COMMUNICATIONS,
  MOCK_CANDIDATE_INTERACTIONS,
  MOCK_AI_TASK_SUGGESTIONS,
} from './types';
import type { TaskFormValues } from './types';
import { apiGetTasks, apiGetTask, apiMarkTaskCompleted, apiDeleteTask, apiGetTaskStats, type TaskStats } from '../../lib/api';
import { transformBackendTaskToFrontend, transformBackendTaskToDrawer } from '../../lib/taskTransform';
import type { BackendTask } from '../../lib/api';

// --- Types ---

type TaskType = 'Call' | 'Email' | 'Interview' | 'Follow-up' | 'Meeting' | 'Note';
type Priority = 'Low' | 'Medium' | 'High';
type Status = 'Pending' | 'Completed' | 'Overdue';

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

const MOCK_TASKS: Task[] = [
  {
    id: '1',
    title: 'Screening call with Sarah Jenkins',
    type: 'Call',
    relatedTo: { id: 'c1', name: 'Sarah Jenkins', type: 'Candidate' },
    dueDate: '2026-02-10',
    time: '10:00 AM',
    priority: 'High',
    status: 'Pending',
    owner: { name: 'Alex Thompson', avatar: 'https://images.unsplash.com/photo-1752118464988-2914fb27d0f0?q=80&w=150&h=150&auto=format&fit=crop' }
  },
  {
    id: '2',
    title: 'Send offer letter for Senior Frontend Dev',
    type: 'Email',
    relatedTo: { id: 'j1', name: 'Senior Frontend Developer', type: 'Job' },
    dueDate: '2026-02-09',
    time: '04:00 PM',
    priority: 'High',
    status: 'Overdue',
    owner: { name: 'Alex Thompson', avatar: 'https://images.unsplash.com/photo-1752118464988-2914fb27d0f0?q=80&w=150&h=150&auto=format&fit=crop' }
  },
  {
    id: '3',
    title: 'Technical interview: Marcus Chen',
    type: 'Interview',
    relatedTo: { id: 'c2', name: 'Marcus Chen', type: 'Candidate' },
    dueDate: '2026-02-10',
    time: '02:30 PM',
    priority: 'Medium',
    status: 'Pending',
    owner: { name: 'Elena Rodriguez', avatar: 'https://images.unsplash.com/photo-1672675389084-5415d558dfd7?q=80&w=150&h=150&auto=format&fit=crop' }
  },
  {
    id: '4',
    title: 'Follow-up on Acme Corp contract',
    type: 'Follow-up',
    relatedTo: { id: 'cl1', name: 'Acme Corp', type: 'Client' },
    dueDate: '2026-02-11',
    time: '09:00 AM',
    priority: 'Medium',
    status: 'Pending',
    owner: { name: 'Alex Thompson', avatar: 'https://images.unsplash.com/photo-1752118464988-2914fb27d0f0?q=80&w=150&h=150&auto=format&fit=crop' }
  },
  {
    id: '5',
    title: 'Review resumes for Marketing Manager',
    type: 'Note',
    relatedTo: { id: 'j2', name: 'Marketing Manager', type: 'Job' },
    dueDate: '2026-02-10',
    time: '11:30 AM',
    priority: 'Low',
    status: 'Completed',
    owner: { name: 'Marcus Wong', avatar: 'https://images.unsplash.com/photo-1617386124435-9eb3935b1e11?q=80&w=150&h=150&auto=format&fit=crop' }
  },
  {
    id: '6',
    title: 'Candidate feedback sync',
    type: 'Meeting',
    relatedTo: { id: 'cl2', name: 'TechFlow Inc', type: 'Client' },
    dueDate: '2026-02-12',
    time: '03:00 PM',
    priority: 'Medium',
    status: 'Pending',
    owner: { name: 'Elena Rodriguez', avatar: 'https://images.unsplash.com/photo-1672675389084-5415d558dfd7?q=80&w=150&h=150&auto=format&fit=crop' }
  },
];

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

const SummaryCard = ({ label, count, icon: Icon, color }: { label: string, count: number, icon: any, color: string }) => (
  <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow cursor-default">
    <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
      <Icon size={20} />
    </div>
    <div>
      <div className="text-2xl font-bold text-gray-900">{count}</div>
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</div>
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

const FilterBar = ({
  onAddTask,
  onOpenSLAAlerts,
  slaOverdueCount = 0,
}: {
  onAddTask: () => void;
  onOpenSLAAlerts?: () => void;
  slaOverdueCount?: number;
}) => (
  <div className="flex items-center justify-between py-4 border-b border-gray-200 gap-4 flex-wrap">
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 cursor-pointer hover:bg-gray-50">
        <CalendarIcon size={16} />
        <span>Today</span>
      </div>
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 cursor-pointer hover:bg-gray-50">
        <Filter size={16} />
        <span>Task Type</span>
      </div>
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 cursor-pointer hover:bg-gray-50">
        <span>Priority</span>
      </div>
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 cursor-pointer hover:bg-gray-50">
        <span>Assigned to</span>
      </div>
      <button className="text-sm font-medium text-blue-600 hover:text-blue-700 ml-2">Clear Filters</button>
    </div>

    <div className="flex items-center gap-3">
      {onOpenSLAAlerts != null && (
        <button
          type="button"
          onClick={onOpenSLAAlerts}
          className="relative flex items-center gap-2 bg-white border border-gray-200 rounded-lg pl-3 pr-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:border-red-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-colors"
          title="View all SLA alerts"
        >
          <AlertTriangle size={18} className="text-red-500" />
          <span className="font-medium">SLA Alerts</span>
          {slaOverdueCount > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">
              {slaOverdueCount > 99 ? '99+' : slaOverdueCount}
            </span>
          )}
        </button>
      )}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search Related..."
          className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
      </div>
      <button
        onClick={onAddTask}
        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 shadow-sm active:scale-95 transition-all"
      >
        <Plus size={18} />
        Create Task
      </button>
    </div>
  </div>
);

const CalendarView = ({ tasks, onTaskClick }: { tasks: Task[]; onTaskClick: (task: Task) => void }) => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const dates = [9, 10, 11, 12, 13];
  
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mt-6">
      <div className="grid grid-cols-5 border-b border-gray-100">
        {days.map((day, idx) => (
          <div key={idx} className="p-4 text-center border-r last:border-r-0 border-gray-100">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">{day}</div>
            <div className={`text-xl font-bold mt-1 ${dates[idx] === 10 ? 'text-blue-600' : 'text-gray-900'}`}>{dates[idx]}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5 min-h-[500px]">
        {days.map((day, dIdx) => (
          <div key={dIdx} className="p-2 space-y-2 border-r last:border-r-0 border-gray-100 bg-gray-50/30">
            {tasks.filter(t => t.dueDate.endsWith(String(dates[dIdx]).padStart(2, '0'))).map((task) => (
              <div 
                key={task.id} 
                onClick={() => onTaskClick(task)}
                className="p-3 bg-white border border-gray-100 rounded-lg shadow-sm hover:shadow-md cursor-pointer transition-all border-l-4"
                style={{ borderLeftColor: task.priority === 'High' ? '#ef4444' : task.priority === 'Medium' ? '#f59e0b' : '#3b82f6' }}
              >
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">{task.time}</div>
                <div className="text-xs font-bold text-gray-900 truncate mb-1">{task.title}</div>
                <div className="flex items-center gap-1">
                  <TaskTypeIcon type={task.type} />
                  <span className="text-[10px] text-gray-500 font-medium">{task.type}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
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
  const [slaDrawerOpen, setSlaDrawerOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS);
  const [backendTasks, setBackendTasks] = useState<BackendTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Fetch tasks and stats from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setStatsLoading(true);
        setError(null);
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        
        if (!token) {
          console.warn('No authentication token found. Using mock data.');
          setTasks(MOCK_TASKS);
          setLoading(false);
          setStatsLoading(false);
          return;
        }

        // Fetch tasks and stats in parallel
        const [tasksResponse, statsResponse] = await Promise.all([
          apiGetTasks().catch(err => {
            console.error('Failed to fetch tasks:', err);
            return { data: null };
          }),
          apiGetTaskStats().catch(err => {
            console.error('Failed to fetch stats:', err);
            return { data: null };
          }),
        ]);

        // Process tasks
        if (tasksResponse.data) {
          let fetchedBackendTasks: any[] = [];
          if (Array.isArray(tasksResponse.data)) {
            fetchedBackendTasks = tasksResponse.data;
          } else if (Array.isArray(tasksResponse.data.data)) {
            fetchedBackendTasks = tasksResponse.data.data;
          } else if (Array.isArray(tasksResponse.data.items)) {
            fetchedBackendTasks = tasksResponse.data.items;
          }

          if (Array.isArray(fetchedBackendTasks) && fetchedBackendTasks.length > 0) {
            const typedBackendTasks = fetchedBackendTasks as BackendTask[];
            setBackendTasks(typedBackendTasks);
            const transformedTasks = typedBackendTasks.map(transformBackendTaskToFrontend);
            setTasks(transformedTasks);
          } else {
            setTasks(MOCK_TASKS);
            setBackendTasks([]);
          }
        } else {
          setTasks(MOCK_TASKS);
          setBackendTasks([]);
        }

        // Process stats
        if (statsResponse.data) {
          setStats(statsResponse.data as TaskStats);
        }
      } catch (err: any) {
        console.error('Failed to fetch data:', err);
        setError(err.message || 'Failed to load data');
        setTasks(MOCK_TASKS);
        setBackendTasks([]);
      } finally {
        setLoading(false);
        setStatsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Use stats from API if available, otherwise calculate from tasks
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const completedToday = stats?.completedToday ?? 0;
  const overdueCount = stats?.overdueCount ?? 0;
  const avgCompletionTimeDays = stats?.avgCompletionTimeDays ?? 0;
  const productivityPercent = stats?.productivityPercent ?? 0;
  const dueTodayCount = stats?.dueToday ?? 0;
  const slaOverdueCount = stats?.overdue ?? 0;
  const upcoming7dCount = stats?.upcoming7d ?? 0;
  const completedCount = stats?.completed ?? 0;

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

  const handleRowClick = async (task: Task) => {
    try {
      // Fetch full task details from API
      const response = await apiGetTask(task.id);
      if (response.data) {
        const backendTask = response.data as BackendTask;
        setSelectedBackendTask(backendTask);
        const fullTask = transformBackendTaskToFrontend(backendTask);
        setSelectedTask(fullTask);
      } else {
        setSelectedBackendTask(null);
        setSelectedTask(task);
      }
      setDrawerMode('detail');
      setDrawerOpen(true);
    } catch (error) {
      console.error('Failed to fetch task details:', error);
      // Fallback to basic task data
      setSelectedBackendTask(null);
      setSelectedTask(task);
      setDrawerMode('detail');
      setDrawerOpen(true);
    }
  };

  const handleEditTask = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTask(task);
    setDrawerMode('edit');
    setDrawerOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <main className="p-8">
          {/* Top Bar with Title and View Toggle */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tasks & Activities</h1>
              <p className="text-sm text-gray-500">Manage your daily recruitment workflow and follow-ups.</p>
            </div>
            
            <div className="flex items-center bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
              <button 
                onClick={() => setView('list')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'list' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <ListIcon size={18} />
                List View
              </button>
              <button 
                onClick={() => setView('calendar')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'calendar' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <CalendarIcon size={18} />
                Calendar
              </button>
            </div>
          </div>

          {/* Task Analytics Summary - Row 1 (4 cards) */}
          <div className="mb-6">
            <TaskAnalyticsCards
              data={{
                completedToday,
                overdueCount,
                avgCompletionTimeDays,
                productivityPercent,
                trendCompletedToday: stats?.trendCompletedToday || (completedToday > 0 ? `+${completedToday} vs yesterday` : 'No change vs yesterday'),
                helperOverdue:
                  overdueCount > 0
                    ? `${overdueCount} task${overdueCount === 1 ? '' : 's'} need attention`
                    : undefined,
                helperAvgTime: 'Based on tasks completed this week',
                helperProductivity: 'Based on all tasks',
              }}
              onCardClick={(cardId: TaskAnalyticsCardId) => {
                if (cardId === 'overdue' && overdueCount > 0) setSlaDrawerOpen(true);
              }}
            />
          </div>

          {/* Summary Section - Row 2 (4 cards) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <SummaryCard label="Due Today" count={dueTodayCount} icon={CalendarIcon} color="bg-blue-100 text-blue-600" />
            <SummaryCard label="Overdue" count={slaOverdueCount} icon={Clock} color="bg-red-100 text-red-600" />
            <SummaryCard label="Upcoming (7d)" count={upcoming7dCount} icon={CalendarIcon} color="bg-emerald-100 text-emerald-600" />
            <SummaryCard label="Completed" count={completedCount} icon={CheckSquare} color="bg-gray-100 text-gray-600" />
          </div>

          {/* Filters */}
          <FilterBar
            onAddTask={openCreateTask}
            onOpenSLAAlerts={() => setSlaDrawerOpen(true)}
            slaOverdueCount={slaOverdueCount}
          />

          {/* Main Content */}
          {view === 'list' ? (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm mt-6 overflow-hidden">
              <table className="w-full text-left">
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
                      <td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">
                        Loading tasks...
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-sm text-red-500">
                        {error}
                      </td>
                    </tr>
                  ) : tasks.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">
                        No tasks found. Click "Create Task" to add one.
                      </td>
                    </tr>
                  ) : (
                    tasks.map((task) => (
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
                          <span className={`text-sm font-bold text-gray-900 ${task.status === 'Completed' ? 'line-through text-gray-400' : ''}`}>
                            {task.title}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium text-gray-600">{task.type}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-900">{task.relatedTo.name}</span>
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
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button className="p-1.5 hover:bg-white border border-gray-200 rounded-lg text-gray-400 hover:text-blue-600 transition-all cursor-pointer">
                            <CheckSquare size={16} />
                          </button>
                          <button
                            onClick={(e) => handleEditTask(task, e)}
                            className="p-1.5 hover:bg-white border border-transparent hover:border-gray-200 rounded-lg text-gray-400 hover:text-blue-600 transition-all cursor-pointer"
                            title="Edit task"
                          >
                            <Pencil size={16} />
                          </button>
                          <button className="p-1.5 hover:bg-white border border-transparent hover:border-gray-200 rounded-lg text-gray-400 hover:text-gray-600 transition-all cursor-pointer">
                            <MoreVertical size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/30">
                <span className="text-xs text-gray-500 font-medium">Showing 6 of 124 tasks</span>
                <div className="flex items-center gap-2">
                  <button className="p-2 hover:bg-white border border-gray-200 rounded-lg text-gray-400 disabled:opacity-50" disabled>
                    <ChevronLeft size={16} />
                  </button>
                  <button className="p-2 hover:bg-white border border-gray-200 rounded-lg text-gray-400">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <CalendarView tasks={tasks} onTaskClick={handleRowClick} />
          )}
      </main>

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
                  tasks={MOCK_TASKS}
                  onTaskClick={(id) => {
                    setSlaDrawerOpen(false);
                    const t = MOCK_TASKS.find((x) => x.id === id);
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
        task={(drawerMode === 'detail' || drawerMode === 'edit') && selectedBackendTask ? transformBackendTaskToDrawer(selectedBackendTask) : (selectedTask ? (() => {
          // Convert Task to TaskForDrawer format (fallback)
          const taskForDrawer: TaskForDrawer = {
            id: selectedTask.id,
            title: selectedTask.title,
            type: selectedTask.type,
            relatedTo: selectedTask.relatedTo,
            dueDate: selectedTask.dueDate,
            time: selectedTask.time,
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
          // Refresh tasks after creation
          try {
            const response = await apiGetTasks();
            let backendTasks: any[] = [];
            if (response.data) {
              if (Array.isArray(response.data)) {
                backendTasks = response.data;
              } else if (Array.isArray(response.data.data)) {
                backendTasks = response.data.data;
              } else if (Array.isArray(response.data.items)) {
                backendTasks = response.data.items;
              }
            }
            if (Array.isArray(backendTasks) && backendTasks.length > 0) {
              const transformedTasks = backendTasks.map(transformBackendTaskToFrontend);
              setTasks(transformedTasks);
            }
          } catch (error) {
            console.error('Failed to refresh tasks:', error);
          }
        }}
        onRequestEdit={() => setDrawerMode('edit')}
        onExitEdit={async () => {
          setDrawerMode('detail');
          // Refresh task details after update
          if (selectedTask) {
            try {
              const response = await apiGetTask(selectedTask.id);
              if (response.data) {
                const backendTask = response.data as BackendTask;
                setSelectedBackendTask(backendTask);
                const updatedTask = transformBackendTaskToFrontend(backendTask);
                setSelectedTask(updatedTask);
              }
            } catch (error) {
              console.error('Failed to refresh task:', error);
            }
          }
        }}
        onUpdateSuccess={async () => {
          // Refresh tasks list after update
          try {
            const response = await apiGetTasks();
            let backendTasks: any[] = [];
            if (response.data) {
              if (Array.isArray(response.data)) {
                backendTasks = response.data;
              } else if (Array.isArray(response.data.data)) {
                backendTasks = response.data.data;
              } else if (Array.isArray(response.data.items)) {
                backendTasks = response.data.items;
              }
            }
            if (Array.isArray(backendTasks) && backendTasks.length > 0) {
              const transformedTasks = backendTasks.map(transformBackendTaskToFrontend);
              setTasks(transformedTasks);
              
              // Also refresh selected task if it exists
              if (selectedTask) {
                const taskResponse = await apiGetTask(selectedTask.id);
                if (taskResponse.data) {
                  const backendTask = taskResponse.data as BackendTask;
                  setSelectedBackendTask(backendTask);
                  setSelectedTask(transformBackendTaskToFrontend(backendTask));
                }
              }
            }
          } catch (error) {
            console.error('Failed to refresh tasks:', error);
          }
        }}
        onMarkCompleted={async (taskId) => {
          try {
            await apiMarkTaskCompleted(taskId);
            // Refresh tasks
            const response = await apiGetTasks();
            let backendTasks: any[] = [];
            if (response.data) {
              if (Array.isArray(response.data)) {
                backendTasks = response.data;
              } else if (Array.isArray(response.data.data)) {
                backendTasks = response.data.data;
              } else if (Array.isArray(response.data.items)) {
                backendTasks = response.data.items;
              }
            }
            if (Array.isArray(backendTasks) && backendTasks.length > 0) {
              const transformedTasks = backendTasks.map(transformBackendTaskToFrontend);
              setTasks(transformedTasks);
            }
            // Refresh selected task if it's the one we just updated
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
            alert(error.message || 'Failed to update task');
          }
        }}
        onDelete={async (taskId) => {
          if (!confirm('Are you sure you want to delete this task?')) return;
          try {
            await apiDeleteTask(taskId);
            setTasks(tasks.filter(t => t.id !== taskId));
            setDrawerOpen(false);
            setSelectedTask(null);
            setSelectedBackendTask(null);
          } catch (error: any) {
            console.error('Failed to delete task:', error);
            alert(error.message || 'Failed to delete task');
          }
        }}
        onRelatedEntityClick={(entity) => { /* TODO: navigate to /candidate, /job, /client by entity.type and entity.id */ }}
      />
    </div>
  );
}
