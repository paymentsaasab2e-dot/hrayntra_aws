"use client"

import * as React from 'react'
import {
  PageHeroBanner,
  Button,
  SectionCard,
  MetricStatCard,
  SegmentedControl,
  FilterDrawer,
  FilterTriggerButton,
} from '@hryantra/ui'
import {
  FolderKanban,
  LayoutList,
  KanbanSquare,
  Plus,
  CheckSquare,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import { TaskListTable } from '../components/TaskListTable'
import { TaskBoard } from '../components/TaskBoard'
import { TaskDetailDrawer } from '../components/TaskDetailDrawer'
import {
  TaskFiltersForm,
  countActiveTaskFilters,
  EMPTY_TASK_FILTERS,
  type TaskFilterValues,
} from '../components/TaskFilters'
import { TaskFormDrawer } from '../components/TaskFormDrawer'
import { ProjectManageDrawer } from '../components/ProjectManageDrawer'
import { useStore } from '@/store/StoreProvider'
import { Task } from '../types'

const isTaskComplete = (status: string) => status === 'done' || status === 'completed'

const SCOPE_LABELS = {
  all: 'All tasks',
  project: 'Under project',
  self: 'Self tasks',
} as const

export function TaskListPage() {
  const { tasks, projects, currentUserRole, activeEmployeeId, employees } = useStore()
  const [viewMode, setViewMode] = React.useState<'list' | 'board'>('list')
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null)
  const [editingTask, setEditingTask] = React.useState<Task | null>(null)
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isProjectManageOpen, setIsProjectManageOpen] = React.useState(false)
  const [reopenTaskFormAfterProjects, setReopenTaskFormAfterProjects] = React.useState(false)
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>('all')
  const [taskScope, setTaskScope] = React.useState<'all' | 'project' | 'self'>('all')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('')
  const [priorityFilter, setPriorityFilter] = React.useState('')
  const [isFilterOpen, setIsFilterOpen] = React.useState(false)
  const [draftFilters, setDraftFilters] = React.useState<TaskFilterValues>(EMPTY_TASK_FILTERS)

  const appliedFilters: TaskFilterValues = {
    searchQuery,
    statusFilter,
    priorityFilter,
    projectFilter: selectedProjectId,
  }
  const activeFilterCount = countActiveTaskFilters(appliedFilters)

  const openFilterDrawer = () => {
    setDraftFilters(appliedFilters)
    setIsFilterOpen(true)
  }

  const applyFilters = () => {
    setSearchQuery(draftFilters.searchQuery)
    setStatusFilter(draftFilters.statusFilter)
    setPriorityFilter(draftFilters.priorityFilter)
    setSelectedProjectId(draftFilters.projectFilter)
    setIsFilterOpen(false)
  }

  const clearFilters = () => {
    setDraftFilters(EMPTY_TASK_FILTERS)
    setSearchQuery('')
    setStatusFilter('')
    setPriorityFilter('')
    setSelectedProjectId('all')
    setIsFilterOpen(false)
  }

  const canManageProjects =
    currentUserRole === 'HR' || currentUserRole === 'Manager' || currentUserRole === 'Superadmin'

  const currentUser = employees.find((e) => e.id === activeEmployeeId)
  const firstName = currentUser?.name?.split(' ')[0] || 'Team'

  const greeting = React.useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const dateEyebrow = React.useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).toUpperCase(),
    []
  )

  const scopedTasks = React.useMemo(() => {
    let result = tasks

    if (currentUserRole === 'Employee') {
      result = result.filter(
        (task) =>
          task.assignee?.id === activeEmployeeId ||
          task.assignees?.some((item) => item.id === activeEmployeeId) ||
          task.isSelfTask
      )
    }

    if (taskScope === 'project') {
      result = result.filter((task) => Boolean(task.projectId))
    } else if (taskScope === 'self') {
      result = result.filter((task) => task.isSelfTask)
    }

    return result
  }, [tasks, currentUserRole, activeEmployeeId, taskScope])

  const stats = React.useMemo(
    () => ({
      total: scopedTasks.length,
      inProgress: scopedTasks.filter((t) => t.status === 'in_progress').length,
      blocked: scopedTasks.filter((t) => t.status === 'blocked').length,
      completed: scopedTasks.filter((t) => isTaskComplete(t.status)).length,
    }),
    [scopedTasks]
  )

  const filteredTasks = React.useMemo(() => {
    let result = scopedTasks

    if (selectedProjectId !== 'all') {
      result = result.filter((task) => task.projectId === selectedProjectId)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase()
      result = result.filter(
        (task) =>
          task.title.toLowerCase().includes(query) ||
          (task.description || '').toLowerCase().includes(query) ||
          (task.projectName || '').toLowerCase().includes(query) ||
          task.assignee.name.toLowerCase().includes(query) ||
          (task.assignees || []).some((item) => item.name.toLowerCase().includes(query))
      )
    }

    if (statusFilter) {
      result = result.filter((task) => task.status === statusFilter)
    }

    if (priorityFilter) {
      result = result.filter((task) => task.priority === priorityFilter)
    }

    return result
  }, [scopedTasks, priorityFilter, searchQuery, selectedProjectId, statusFilter])

  const openCreate = () => {
    setEditingTask(null)
    setIsCreateOpen(true)
  }

  const openEdit = (task: Task) => {
    setEditingTask(task)
    setIsCreateOpen(true)
    setSelectedTask(null)
  }

  const openManageProjects = () => {
    setIsCreateOpen(false)
    setReopenTaskFormAfterProjects(isCreateOpen)
    setIsProjectManageOpen(true)
  }

  const closeManageProjects = () => {
    setIsProjectManageOpen(false)
    if (reopenTaskFormAfterProjects) {
      setReopenTaskFormAfterProjects(false)
      setIsCreateOpen(true)
    }
  }

  const scopeSubtitle = SCOPE_LABELS[taskScope]

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 px-6 py-6">
      {/* ── Executive Action Bar: Scope on Left, Primary Actions on Right ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/90 pb-3">
        <SegmentedControl
          aria-label="Task scope"
          size="sm"
          value={taskScope}
          onChange={(v) => setTaskScope(v as typeof taskScope)}
          options={[
            { value: 'all', label: 'All Tasks' },
            { value: 'project', label: 'Under Project' },
            { value: 'self', label: 'Self Tasks' },
          ]}
        />

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <FilterTriggerButton activeCount={activeFilterCount} onClick={openFilterDrawer} />
          {canManageProjects && (
            <Button variant="outline" size="sm" onClick={openManageProjects}>
              <FolderKanban className="size-4 mr-1.5" />
              Manage Projects
            </Button>
          )}
          <SegmentedControl
            aria-label="View mode"
            size="sm"
            value={viewMode}
            onChange={(v) => setViewMode(v as 'list' | 'board')}
            options={[
              { value: 'list', label: 'List', icon: LayoutList },
              { value: 'board', label: 'Board', icon: KanbanSquare },
            ]}
          />
          <Button variant="default" size="sm" onClick={openCreate}>
            <Plus className="size-4 mr-1.5" />
            {currentUserRole === 'Employee' ? 'Add Self Task' : 'Create Task'}
          </Button>
        </div>
      </div>

      {/* ── KPI Stats Row (subtle gradient highlight) ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricStatCard
          label="Total Tasks"
          value={stats.total}
          subtitle={scopeSubtitle}
          tone="lavender"
          icon={CheckSquare}
        />
        <MetricStatCard
          label="In Progress"
          value={stats.inProgress}
          subtitle="Active work items"
          tone="indigo"
          icon={Clock}
        />
        <MetricStatCard
          label="Blocked"
          value={stats.blocked}
          subtitle="Needs attention"
          tone="amber"
          icon={AlertTriangle}
        />
        <MetricStatCard
          label="Completed"
          value={stats.completed}
          subtitle="Done or resolved"
          tone="mint"
          icon={CheckCircle2}
        />
      </div>

      {/* Zone 3 — Results table / board */}
      <SectionCard
        title={`${viewMode === 'list' ? 'Task List' : 'Task Board'} (${filteredTasks.length})`}
        className="min-h-[360px] flex-1"
        bodyClassName="p-0"
        noPadding
      >
        <div className="overflow-auto p-5">
          {viewMode === 'list' ? (
            <TaskListTable
              tasks={filteredTasks}
              onTaskClick={setSelectedTask}
              onEditTask={openEdit}
            />
          ) : (
            <TaskBoard tasks={filteredTasks} onTaskClick={setSelectedTask} />
          )}
        </div>
      </SectionCard>

      <TaskDetailDrawer
        open={selectedTask !== null}
        onClose={() => setSelectedTask(null)}
        task={selectedTask}
        onEdit={openEdit}
      />
      <TaskFormDrawer
        open={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false)
          setEditingTask(null)
        }}
        editingTask={editingTask}
      />
      <ProjectManageDrawer open={isProjectManageOpen} onClose={closeManageProjects} />

      <FilterDrawer
        open={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onApply={applyFilters}
        onClear={clearFilters}
      >
        <TaskFiltersForm
          {...draftFilters}
          projects={projects}
          onChange={(patch) => setDraftFilters((prev) => ({ ...prev, ...patch }))}
        />
      </FilterDrawer>
    </div>
  )
}
