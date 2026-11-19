import * as React from 'react'
import { FormField, FormFieldInput, Input, Textarea, Select, FormGrid } from '@hryantra/ui'

export function TaskForm() {
  return (
    <div className="flex flex-col gap-4">
      <FormField label="Task Title" required>
        <FormFieldInput>
          <Input placeholder="Enter task title" autoFocus />
        </FormFieldInput>
      </FormField>

      <FormField label="Description">
        <FormFieldInput>
          <Textarea placeholder="Describe the task in detail..." rows={4} />
        </FormFieldInput>
      </FormField>

      <FormGrid cols={2}>
        <FormField label="Assignee">
          <FormFieldInput>
            <Select>
              <option value="">Select Assignee</option>
              <option value="EMP-001">Sarah Connor</option>
              <option value="EMP-002">Michael Chang</option>
              <option value="EMP-003">David Wallace</option>
              <option value="EMP-004">Pam Beesly</option>
              <option value="EMP-005">Jim Halpert</option>
            </Select>
          </FormFieldInput>
        </FormField>
        
        <FormField label="Priority">
          <FormFieldInput>
            <Select>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
          </FormFieldInput>
        </FormField>

        <FormField label="Due Date">
          <FormFieldInput>
            <Input type="date" />
          </FormFieldInput>
        </FormField>
        
        <FormField label="Estimated Hours">
          <FormFieldInput>
            <Input type="number" min="0" placeholder="e.g. 8" />
          </FormFieldInput>
        </FormField>
      </FormGrid>
    </div>
  )
}
