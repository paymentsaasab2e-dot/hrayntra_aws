import { Employee } from '../employees/types'

export type DocumentCategory = 'Employee' | 'Company' | 'Compliance' | 'Asset Receipt'

export interface Document {
  id: string
  name: string
  type: string
  category: DocumentCategory
  employeeId?: string
  employeeName?: string
  uploadedBy: string
  uploadedAt: string
  size: string
  url: string
  status: 'Active' | 'Archived'
  tags?: string[]
}

export interface UploadDocumentPayload {
  name: string
  category: DocumentCategory
  type: string
  employeeId?: string
  file?: File // Mocked in store
  tags?: string[]
}
