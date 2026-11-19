import * as React from 'react'
import {
  DrawerWrapper,
  Button,
  FormField,
  FormFieldInput,
  FormSection,
  Input,
  Select,
  Textarea,
} from '@hryantra/ui'
import { Pencil, Trash2 } from 'lucide-react'
import { useStore } from '@/store/StoreProvider'
import { Project } from '../types'

interface ProjectManageDrawerProps {
  open: boolean
  onClose: () => void
}

export function ProjectManageDrawer({ open, onClose }: ProjectManageDrawerProps) {
  const { projects, employees, addProject, updateProject, deleteProject } = useStore()
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [editingProject, setEditingProject] = React.useState<Project | null>(null)
  const [formState, setFormState] = React.useState({
    name: '',
    description: '',
    projectHeadId: '',
  })

  const resetForm = React.useCallback(() => {
    setEditingProject(null)
    setFormState({ name: '', description: '', projectHeadId: '' })
    setError(null)
  }, [])

  React.useEffect(() => {
    if (!open) return
    resetForm()
  }, [open, resetForm])

  const startEdit = (project: Project) => {
    setEditingProject(project)
    setFormState({
      name: project.name,
      description: project.description || '',
      projectHeadId: project.projectHeadId || '',
    })
    setError(null)
  }

  const handleSave = async () => {
    if (!formState.name.trim()) {
      setError('Project name is required.')
      return
    }

    try {
      setSaving(true)
      setError(null)
      const payload = {
        name: formState.name.trim(),
        description: formState.description.trim(),
        projectHeadId: formState.projectHeadId || undefined,
      }

      if (editingProject) {
        await updateProject(editingProject.id, payload)
      } else {
        await addProject(payload)
      }
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (project: Project) => {
    if (!window.confirm(`Delete project "${project.name}"? Tasks will remain but lose project link.`)) {
      return
    }
    try {
      await deleteProject(project.id)
      if (editingProject?.id === project.id) resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project')
    }
  }

  return (
    <DrawerWrapper
      open={open}
      onClose={onClose}
      title="Manage Projects"
      subtitle="Create and maintain projects for task assignment"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} className="mr-auto" disabled={saving}>
            Close
          </Button>
          {editingProject && (
            <Button variant="outline" onClick={resetForm} disabled={saving}>
              Cancel Edit
            </Button>
          )}
          <Button variant="default" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : editingProject ? 'Update Project' : 'Create Project'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6 pb-4">
        <FormSection
          title={editingProject ? `Edit: ${editingProject.name}` : 'New Project'}
          description="Fill in the details below, then save from the footer."
          variant="card"
          tone="blue"
        >
          <FormField label="Project Name" required labelVariant="default">
            <FormFieldInput>
              <Input
                placeholder="e.g. Sejog"
                value={formState.name}
                onChange={(event) => setFormState(prev => ({ ...prev, name: event.target.value }))}
              />
            </FormFieldInput>
          </FormField>

          <FormField label="Description" labelVariant="default" hint="Optional summary for this project">
            <FormFieldInput>
              <Textarea
                rows={3}
                placeholder="Project scope or notes"
                value={formState.description}
                onChange={(event) => setFormState(prev => ({ ...prev, description: event.target.value }))}
              />
            </FormFieldInput>
          </FormField>

          <FormField label="Project Head" labelVariant="default">
            <FormFieldInput>
              <Select
                value={formState.projectHeadId}
                onChange={(event) => setFormState(prev => ({ ...prev, projectHeadId: event.target.value }))}
              >
                <option value="">Select Project Head (Optional)</option>
                {employees.map(employee => (
                  <option key={employee.id} value={employee.id}>{employee.name}</option>
                ))}
              </Select>
            </FormFieldInput>
          </FormField>
        </FormSection>

        <FormSection
          title="Existing Projects"
          description={`${projects.length} project(s) available for tasks`}
          variant="card"
          tone="white"
        >
          {projects.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#cbd5e1] px-4 py-6 text-center text-sm text-[#64748b]">
              No projects yet. Use the form above and click Create Project.
            </p>
          ) : (
            <div className="space-y-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className={`flex items-center justify-between rounded-xl border px-3 py-3 transition-colors ${
                    editingProject?.id === project.id
                      ? 'border-[#6366f1] bg-[#eef2ff]'
                      : 'border-[#e2e8f0] bg-white hover:border-[#cbd5e1]'
                  }`}
                >
                  <div className="min-w-0 pr-3">
                    <p className="truncate text-sm font-semibold text-[#111827]">{project.name}</p>
                    <p className="mt-0.5 text-xs text-[#64748b]">
                      {project.taskCount || 0} task(s)
                      {project.description ? ` · ${project.description}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="outline" size="sm" title="Edit project" onClick={() => startEdit(project)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="destructive-outline" size="sm" title="Delete project" onClick={() => handleDelete(project)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </FormSection>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </DrawerWrapper>
  )
}
