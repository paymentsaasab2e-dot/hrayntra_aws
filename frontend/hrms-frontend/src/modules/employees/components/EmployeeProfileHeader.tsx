import * as React from 'react'
import { SectionCard, Avatar, StatusBadge, Button } from '@hryantra/ui'
import { Employee } from '../types'
import { Building2, Briefcase, UserRound } from 'lucide-react'

interface EmployeeProfileHeaderProps {
  employee: Employee
  onAssignTask?: () => void
}

export function EmployeeProfileHeader({ employee, onAssignTask }: EmployeeProfileHeaderProps) {
  const initials = employee.name.split(' ').map(n => n.charAt(0)).join('').substring(0, 2)
  
  return (
    <SectionCard>
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
          <Avatar initials={initials} size="sm" gradient="emerald" />
          <div className="flex flex-col">
            <h2 className="text-ds-heading-sm flex items-center gap-1.5 leading-tight">
              {employee.name}
              <StatusBadge status={employee.status} withDot />
            </h2>
            <div className="text-ds-caption text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <span>{employee.designation}</span>
              <span>&middot;</span>
              <span>{employee.department}</span>
            </div>
            <div className="text-ds-caption text-muted-foreground mt-0.5">
              Reports to: <span className="font-medium text-foreground">{employee.manager}</span>
            </div>
          </div>
        </div>
        
          <div className="flex flex-row gap-1.5 self-start sm:self-center">
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs">Edit</Button>
            <Button variant="default" size="sm" className="h-8 px-3 text-xs" onClick={onAssignTask}>Assign Task</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="rounded-lg border border-ds-neutral-200 bg-ds-neutral-50/50 px-2 py-1.5">
            <div className="flex items-center gap-2 text-ds-caption text-ds-neutral-500 uppercase font-semibold tracking-wide">
              <Briefcase className="size-4" />
              Designation
            </div>
            <div className="text-ds-caption font-semibold text-ds-brand-navy mt-0.5">{employee.designation}</div>
          </div>
          <div className="rounded-lg border border-ds-neutral-200 bg-ds-neutral-50/50 px-2 py-1.5">
            <div className="flex items-center gap-2 text-ds-caption text-ds-neutral-500 uppercase font-semibold tracking-wide">
              <Building2 className="size-4" />
              Department
            </div>
            <div className="text-ds-caption font-semibold text-ds-brand-navy mt-0.5">{employee.department}</div>
          </div>
          <div className="rounded-lg border border-ds-neutral-200 bg-ds-neutral-50/50 px-2 py-1.5">
            <div className="flex items-center gap-2 text-ds-caption text-ds-neutral-500 uppercase font-semibold tracking-wide">
              <UserRound className="size-4" />
              Reporting To
            </div>
            <div className="text-ds-caption font-semibold text-ds-brand-navy mt-0.5">{employee.manager}</div>
          </div>
        </div>
      </div>
    </SectionCard>
  )
}
