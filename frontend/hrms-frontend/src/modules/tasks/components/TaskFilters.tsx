import * as React from 'react'
import { Input, Select, InputWrapper, FilterField, FILTER_INPUT_CLASS } from '@hryantra/ui'
import { Search } from 'lucide-react'
import { Project } from '../types'

export interface TaskFilterValues {
  searchQuery: string
  statusFilter: string
  priorityFilter: string
  projectFilter: string
}

interface TaskFiltersProps extends TaskFilterValues {
  projects: Project[]
  onChange: (patch: Partial<TaskFilterValues>) => void
}

export function TaskFiltersForm({ searchQuery, statusFilter, priorityFilter, projectFilter, projects, onChange }: TaskFiltersProps) {
  return (
    <>
      <FilterField label="Search" htmlFor="task-filter-search">
        <InputWrapper leftIcon={<Search className="size-4" />}>
          <Input
            id="task-filter-search"
            placeholder="Task title, project, assignee..."
            type="search"
            hasLeftIcon
            value={searchQuery}
            onChange={(event) => onChange({ searchQuery: event.target.value })}
            className={FILTER_INPUT_CLASS}
          />
        </InputWrapper>
      </FilterField>

      <FilterField label="Project" htmlFor="task-filter-project">
        <Select
          id="task-filter-project"
          className={FILTER_INPUT_CLASS}
          value={projectFilter}
          onChange={(event) => onChange({ projectFilter: event.target.value })}
        >
          <option value="all">All Projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
      </FilterField>

      <FilterField label="Status" htmlFor="task-filter-status">
        <Select
          id="task-filter-status"
          className={FILTER_INPUT_CLASS}
          value={statusFilter}
          onChange={(event) => onChange({ statusFilter: event.target.value })}
        >
          <option value="">All Statuses</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="blocked">Blocked</option>
          <option value="completed">Completed</option>
        </Select>
      </FilterField>

      <FilterField label="Priority" htmlFor="task-filter-priority">
        <Select
          id="task-filter-priority"
          className={FILTER_INPUT_CLASS}
          value={priorityFilter}
          onChange={(event) => onChange({ priorityFilter: event.target.value })}
        >
          <option value="">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="less_urgent">Less Urgent</option>
          <option value="low">Low</option>
        </Select>
      </FilterField>
    </>
  )
}

export function countActiveTaskFilters(values: TaskFilterValues): number {
  let count = 0
  if (values.searchQuery.trim()) count += 1
  if (values.statusFilter) count += 1
  if (values.priorityFilter) count += 1
  if (values.projectFilter !== 'all') count += 1
  return count
}

export const EMPTY_TASK_FILTERS: TaskFilterValues = {
  searchQuery: '',
  statusFilter: '',
  priorityFilter: '',
  projectFilter: 'all',
}
