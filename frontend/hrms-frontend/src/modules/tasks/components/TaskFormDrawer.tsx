import * as React from 'react'
import {
  DrawerWrapper,
  Button,
  FormField,
  FormFieldInput,
  FormGrid,
  FormSection,
  Input,
  Select,
  Textarea,
} from '@hryantra/ui'
import { Bell, Plus, Save, Trash2 } from 'lucide-react'
import { useStore } from '@/store/StoreProvider'
import {
  PRIORITY_OPTIONS,
  WEEKDAY_OPTIONS,
  WORK_DONE_OPTIONS,
  Task,
  TaskScheduleType,
  Weekday,
} from '../types'

interface TaskFormDrawerProps {
  open: boolean
  onClose: () => void
  defaultAssigneeId?: string
  editingTask?: Task | null
}

const multiSelectClass =
  'w-full min-h-[140px] rounded-xl border border-[#dbe3ee] bg-[#f8fafc]/80 px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/15'

const emptyForm = {
  priority: 'less_urgent' as const,
  projectId: '',
  assigneeIds: [] as string[],
  projectHeadId: '',
  title: '',
  remarks: '',
  extraDescriptions: [] as { text: string; createdAt: string }[],
  workDonePercent: 0,
  reminderDates: [] as string[],
  reminderWeekdays: [] as Weekday[],
  scheduleType: 'none' as TaskScheduleType,
  scheduledDate: '',
  scheduledWeekday: 'MON' as Weekday,
  newReminderDate: '',
  newDescription: '',
}

export function TaskFormDrawer({
  open,
  onClose,
  defaultAssigneeId,
  editingTask,
}: TaskFormDrawerProps) {
  const { addTask, updateTask, employees, projects, currentUserRole, activeEmployeeId } = useStore()
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [formState, setFormState] = React.useState(emptyForm)
  const isEmployee = currentUserRole === 'Employee'
  const isEditing = Boolean(editingTask)

  React.useEffect(() => {
    if (!open) return
    setError(null)

    if (editingTask) {
      setFormState({
        priority: editingTask.priority,
        projectId: editingTask.projectId || '',
        assigneeIds: editingTask.assignees?.map(item => item.id) || [editingTask.assignee.id],
        projectHeadId: editingTask.projectHeadId || '',
        title: editingTask.title,
        remarks: editingTask.remarks || editingTask.description || '',
        extraDescriptions: editingTask.extraDescriptions || [],
        workDonePercent: editingTask.workDonePercent ?? 0,
        reminderDates: editingTask.reminderDates || [],
        reminderWeekdays: editingTask.reminderWeekdays || [],
        scheduleType: editingTask.scheduleType || 'none',
        scheduledDate: editingTask.scheduledDate ? editingTask.scheduledDate.slice(0, 10) : '',
        scheduledWeekday: editingTask.scheduledWeekday || 'MON',
        newReminderDate: '',
        newDescription: '',
      })
      return
    }

    // Keep assignee empty on create so the user picks who to assign.
    // Only prefill when: employee self-task, or explicit defaultAssigneeId (e.g. from employee profile).
    const defaultAssignees = isEmployee
      ? (activeEmployeeId ? [activeEmployeeId] : [])
      : (defaultAssigneeId ? [defaultAssigneeId] : [])

    setFormState({
      ...emptyForm,
      assigneeIds: defaultAssignees,
    })
  }, [open, editingTask, isEmployee, activeEmployeeId, defaultAssigneeId])

  const handleAssigneeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = Array.from(event.target.selectedOptions, option => option.value)
    setFormState(prev => ({ ...prev, assigneeIds: selected }))
  }

  const toggleWeekday = (day: Weekday) => {
    setFormState(prev => ({
      ...prev,
      reminderWeekdays: prev.reminderWeekdays.includes(day)
        ? prev.reminderWeekdays.filter(item => item !== day)
        : [...prev.reminderWeekdays, day],
    }))
  }

  const addReminderDate = () => {
    if (!formState.newReminderDate) return
    if (formState.reminderDates.includes(formState.newReminderDate)) return
    setFormState(prev => ({
      ...prev,
      reminderDates: [...prev.reminderDates, prev.newReminderDate],
      newReminderDate: '',
    }))
  }

  const addExtraDescription = () => {
    if (!formState.newDescription.trim()) return
    setFormState(prev => ({
      ...prev,
      extraDescriptions: [
        ...prev.extraDescriptions,
        { text: prev.newDescription.trim(), createdAt: new Date().toISOString() },
      ],
      newDescription: '',
    }))
  }

  const handleSave = async () => {
    if (!formState.title.trim() || !formState.remarks.trim()) {
      setError('Task title and description/remarks are required.')
      return
    }
    if (!isEmployee && formState.assigneeIds.length === 0) {
      setError('Select at least one assigned employee.')
      return
    }

    const payload = {
      title: formState.title.trim(),
      remarks: formState.remarks.trim(),
      description: formState.remarks.trim(),
      priority: formState.priority,
      projectId: formState.projectId || undefined,
      projectHeadId: formState.projectHeadId || undefined,
      assigneeIds: isEmployee ? [activeEmployeeId] : formState.assigneeIds,
      workDonePercent: formState.workDonePercent,
      extraDescriptions: formState.extraDescriptions,
      reminderDates: formState.reminderDates,
      reminderWeekdays: formState.reminderWeekdays,
      scheduleType: formState.scheduleType,
      scheduledDate: formState.scheduleType === 'specific_date' ? formState.scheduledDate : undefined,
      scheduledWeekday: formState.scheduleType === 'day_of_week' ? formState.scheduledWeekday : undefined,
      isSelfTask: isEmployee && !formState.projectId,
    }

    try {
      setSaving(true)
      setError(null)
      if (isEditing && editingTask) {
        await updateTask(editingTask.id, payload)
      } else {
        await addTask(payload)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DrawerWrapper
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit Task' : 'Create New Task'}
      subtitle="All fields scroll within this panel — use the footer button to save"
      size="full"
      footer={
        <>
          <Button variant="outline" onClick={onClose} className="mr-auto" disabled={saving}>
            Cancel
          </Button>
          <Button variant="default" onClick={handleSave} disabled={saving}>
            <Save className="size-4 mr-2" />
            {saving ? 'Saving...' : isEditing ? 'Save Task' : 'Create Task'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 pb-4">
        <FormSection title="Task Details" variant="card" tone="blue">
          <FormGrid cols={2}>
            <FormField label="Priority" required labelVariant="default">
              <FormFieldInput>
                <Select
                  value={formState.priority}
                  onChange={(event) => setFormState(prev => ({
                    ...prev,
                    priority: event.target.value as typeof prev.priority,
                  }))}
                >
                  {PRIORITY_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
              </FormFieldInput>
            </FormField>

            <FormField
              label="Project Name"
              labelVariant="default"
              hint={projects.length === 0 ? 'Create a project first from Manage Projects on the Tasks page.' : undefined}
            >
              <FormFieldInput>
                <Select
                  value={formState.projectId}
                  onChange={(event) => setFormState(prev => ({ ...prev, projectId: event.target.value }))}
                >
                  <option value="">No Project (Self / General)</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </Select>
              </FormFieldInput>
            </FormField>

            <FormField
              label="Assigned Employee(s)"
              required={!isEmployee}
              labelVariant="default"
              hint={!isEmployee ? 'Select who should own this task (none selected by default). Hold Ctrl/Cmd for multiple.' : undefined}
            >
              {isEmployee ? (
                <div className="rounded-lg border border-ds-neutral-200 bg-ds-neutral-50 px-3 py-2.5 text-sm text-ds-brand-navy">
                  {employees.find(employee => employee.id === activeEmployeeId)?.name || activeEmployeeId}
                </div>
              ) : (
                <select
                  multiple
                  className={multiSelectClass}
                  value={formState.assigneeIds}
                  onChange={handleAssigneeChange}
                  aria-label="Assigned employees"
                >
                  {employees.map(employee => (
                    <option key={employee.id} value={employee.id} className="py-1">
                      {employee.name}
                    </option>
                  ))}
                </select>
              )}
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
          </FormGrid>

          <FormField label="Task Title" required labelVariant="default">
            <FormFieldInput>
              <Input
                placeholder="Enter task title"
                value={formState.title}
                onChange={(event) => setFormState(prev => ({ ...prev, title: event.target.value }))}
              />
            </FormFieldInput>
          </FormField>

          <FormField label="Description / Remarks" required labelVariant="default">
            <FormFieldInput>
              <Textarea
                rows={4}
                placeholder="Daily comments on work done"
                value={formState.remarks}
                onChange={(event) => setFormState(prev => ({ ...prev, remarks: event.target.value }))}
              />
            </FormFieldInput>
          </FormField>

          <FormField label="Work Done (%)" labelVariant="default" className="max-w-xs">
            <FormFieldInput>
              <Select
                value={String(formState.workDonePercent)}
                onChange={(event) => setFormState(prev => ({
                  ...prev,
                  workDonePercent: Number(event.target.value),
                }))}
              >
                {WORK_DONE_OPTIONS.map(value => (
                  <option key={value} value={value}>{value}%</option>
                ))}
              </Select>
            </FormFieldInput>
          </FormField>
        </FormSection>

        <FormSection title="Additional Descriptions" description="Optional extra notes added over time" variant="card" tone="lavender">
          <FormField label="New Description Entry" labelVariant="default">
            <FormFieldInput>
              <Textarea
                rows={2}
                placeholder="Type an additional description, then click Add Description"
                value={formState.newDescription}
                onChange={(event) => setFormState(prev => ({ ...prev, newDescription: event.target.value }))}
              />
            </FormFieldInput>
          </FormField>
          <Button type="button" variant="outline" onClick={addExtraDescription} className="w-full border-dashed">
            <Plus className="size-4 mr-2" />
            Add Description
          </Button>
          {formState.extraDescriptions.length > 0 && (
            <div className="space-y-2">
              {formState.extraDescriptions.map((entry, index) => (
                <div key={`${entry.createdAt}-${index}`} className="rounded-lg border border-ds-neutral-200 bg-white px-3 py-2 text-sm">
                  {entry.text}
                </div>
              ))}
            </div>
          )}
        </FormSection>

        <FormSection
          title="Reminders"
          description="Set one-off dates or weekly recurring reminder days"
          variant="card"
          tone="mint"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
              <Bell className="size-4 text-[#059669]" />
              Reminder Settings
            </div>

            <FormField label="Specific Reminder Dates" labelVariant="default">
              <div className="flex flex-col sm:flex-row gap-2">
                <FormFieldInput>
                  <Input
                    type="date"
                    value={formState.newReminderDate}
                    onChange={(event) => setFormState(prev => ({
                      ...prev,
                      newReminderDate: event.target.value,
                    }))}
                  />
                </FormFieldInput>
                <Button type="button" variant="default" onClick={addReminderDate} className="shrink-0">
                  Add Date
                </Button>
              </div>
            </FormField>

            {formState.reminderDates.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formState.reminderDates.map(date => (
                  <button
                    key={date}
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-ds-neutral-300 bg-ds-neutral-50 px-3 py-1 text-xs"
                    onClick={() => setFormState(prev => ({
                      ...prev,
                      reminderDates: prev.reminderDates.filter(item => item !== date),
                    }))}
                  >
                    {date}
                    <Trash2 className="size-3" />
                  </button>
                ))}
              </div>
            )}

            <FormField label="Weekly Recurring Reminders" labelVariant="default" hint="Receive reminders every week on the selected days.">
              <div className="flex flex-wrap gap-2 pt-1">
                {WEEKDAY_OPTIONS.map(day => {
                  const selected = formState.reminderWeekdays.includes(day.value)
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleWeekday(day.value)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                        selected
                          ? 'border-[#111827] bg-[#111827] !text-white shadow-sm'
                          : 'border-[#dbe3ee] bg-white text-[#64748b] hover:border-[#cbd5e1] hover:text-[#111827]'
                      }`}
                    >
                      {day.label}
                    </button>
                  )
                })}
              </div>
            </FormField>
          </div>
        </FormSection>

        <FormSection
          title="Task will automatically appear on this day"
          description="Choose when this task should automatically appear"
          variant="card"
          tone="white"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {([
              ['none', 'No Scheduling'],
              ['specific_date', 'Specific Date'],
              ['day_of_week', 'Day of Week (Recurring)'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFormState(prev => ({ ...prev, scheduleType: value }))}
                className={`rounded-xl border px-3 py-3 text-sm text-left font-semibold transition-all ${
                  formState.scheduleType === value
                    ? 'border-[#111827] bg-[#111827] !text-white shadow-sm'
                    : 'border-[#dbe3ee] bg-white text-[#64748b] hover:border-[#cbd5e1] hover:text-[#111827]'
                }`}
              >
                <span className={`inline-block size-2 rounded-full mr-2 align-middle ${
                  formState.scheduleType === value ? 'bg-white' : 'bg-[#cbd5e1]'
                }`} />
                {label}
              </button>
            ))}
          </div>

          {formState.scheduleType === 'specific_date' && (
            <FormField label="Scheduled Date" labelVariant="default" className="max-w-sm mt-3">
              <FormFieldInput>
                <Input
                  type="date"
                  value={formState.scheduledDate}
                  onChange={(event) => setFormState(prev => ({
                    ...prev,
                    scheduledDate: event.target.value,
                  }))}
                />
              </FormFieldInput>
            </FormField>
          )}

          {formState.scheduleType === 'day_of_week' && (
            <FormField label="Scheduled Weekday" labelVariant="default" className="max-w-sm mt-3">
              <FormFieldInput>
                <Select
                  value={formState.scheduledWeekday}
                  onChange={(event) => setFormState(prev => ({
                    ...prev,
                    scheduledWeekday: event.target.value as Weekday,
                  }))}
                >
                  {WEEKDAY_OPTIONS.map(day => (
                    <option key={day.value} value={day.value}>{day.label}</option>
                  ))}
                </Select>
              </FormFieldInput>
            </FormField>
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
