"use client"
import * as React from 'react'
import { DrawerWrapper, FormField, FormFieldInput, Input, Select, Textarea, Button, FormGrid } from '@hryantra/ui'
import { useStore } from '@/store/StoreProvider'
import { DocumentCategory } from '../types'

interface DocumentUploadDrawerProps {
  open: boolean
  onClose: () => void
}

export function DocumentUploadDrawer({ open, onClose }: DocumentUploadDrawerProps) {
  const { employees, addDocument } = useStore()
  
  const [name, setName] = React.useState('')
  const [category, setCategory] = React.useState<DocumentCategory>('Employee')
  const [employeeId, setEmployeeId] = React.useState('')
  const [type, setType] = React.useState('PDF')
  const [tags, setTags] = React.useState('')
  const [fileName, setFileName] = React.useState('')
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    if (!name) setName(file.name.replace(/\.[^.]+$/, ''))
    const ext = file.name.split('.').pop()?.toUpperCase()
    if (ext) setType(ext.slice(0, 8))
  }

  const handleSave = () => {
    if (!name || !category) return
    if (!fileName) {
      alert('Please select a file first')
      return
    }
    
    addDocument({
      name,
      category,
      type,
      employeeId: employeeId || undefined,
      tags: tags.split(',').map(t => t.trim()).filter(t => t !== '')
    })
    
    // Reset and close
    setName('')
    setCategory('Employee')
    setEmployeeId('')
    setType('PDF')
    setTags('')
    setFileName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    onClose()
  }

  return (
    <DrawerWrapper
      open={open}
      onClose={onClose}
      title="Upload Document"
      subtitle="Add a new file to the secure repository"
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} className="mr-auto">Cancel</Button>
          <Button variant="default" onClick={handleSave}>Upload File</Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <FormField label="Document Name" required>
          <FormFieldInput>
            <Input 
              placeholder="e.g. Health_Insurance_Policy.pdf" 
              value={name} 
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} 
            />
          </FormFieldInput>
        </FormField>

        <FormGrid cols={2}>
          <FormField label="Category" required>
            <FormFieldInput>
              <Select 
                value={category} 
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCategory(e.target.value as DocumentCategory)}
              >
                <option value="Employee">Employee</option>
                <option value="Company">Company</option>
                <option value="Compliance">Compliance</option>
                <option value="Asset Receipt">Asset Receipt</option>
              </Select>
            </FormFieldInput>
          </FormField>

          <FormField label="File Type">
            <FormFieldInput>
              <Select 
                value={type} 
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setType(e.target.value)}
              >
                <option value="PDF">PDF</option>
                <option value="Excel">Excel</option>
                <option value="Word">Word</option>
                <option value="Image">Image</option>
                <option value="Other">Other</option>
              </Select>
            </FormFieldInput>
          </FormField>
        </FormGrid>

        {category === 'Employee' || category === 'Asset Receipt' ? (
          <FormField label="Associate Employee">
            <FormFieldInput>
              <Select 
                value={employeeId} 
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEmployeeId(e.target.value)}
              >
                <option value="">None (General)</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name} ({emp.id})</option>
                ))}
              </Select>
            </FormFieldInput>
          </FormField>
        ) : null}

        <FormField label="Tags" hint="Comma separated values">
          <FormFieldInput>
            <Input 
              placeholder="e.g. Legal, HR, confidential" 
              value={tags} 
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTags(e.target.value)} 
            />
          </FormFieldInput>
        </FormField>

        <div className="flex flex-col gap-2">
            <span className="text-ds-label text-ds-neutral-900 font-semibold uppercase tracking-wide">File Upload</span>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFilePick}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-ds-neutral-200 rounded-xl p-8 flex flex-col items-center justify-center text-center bg-ds-neutral-50/50 cursor-pointer hover:bg-ds-neutral-50 transition-all group"
            >
               <div className="size-12 rounded-full bg-white border border-ds-neutral-200 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <svg className="size-6 text-ds-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
               </div>
               <span className="text-ds-body-sm text-ds-brand-navy font-bold">
                 {fileName || 'Click to select file'}
               </span>
               <span className="text-ds-caption text-ds-neutral-500 mt-1">
                 {fileName ? 'Metadata will be saved (binary upload can be added later)' : 'Maximum file size: 10MB'}
               </span>
            </button>
        </div>
      </div>
    </DrawerWrapper>
  )
}
