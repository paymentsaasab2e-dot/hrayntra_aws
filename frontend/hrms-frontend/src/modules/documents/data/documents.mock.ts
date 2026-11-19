import { Document } from '../types'

export const mockDocuments: Document[] = [
  {
    id: 'DOC-001',
    name: 'Employment_Agreement_Sarah_Connor.pdf',
    type: 'PDF',
    category: 'Employee',
    employeeId: 'EMP-001',
    employeeName: 'Sarah Connor',
    uploadedBy: 'HR Admin',
    uploadedAt: '2025-01-15T10:30:00Z',
    size: '1.2 MB',
    url: '#',
    status: 'Active',
    tags: ['Contract', 'Legal']
  },
  {
    id: 'DOC-002',
    name: 'Company_Policy_2026.pdf',
    type: 'PDF',
    category: 'Company',
    uploadedBy: 'System',
    uploadedAt: '2026-01-01T09:00:00Z',
    size: '2.5 MB',
    url: '#',
    status: 'Active',
    tags: ['Policy', 'Handbook']
  },
  {
    id: 'DOC-003',
    name: 'Compliance_Audit_Q4.xlsx',
    type: 'Excel',
    category: 'Compliance',
    uploadedBy: 'Compliance Officer',
    uploadedAt: '2025-12-20T14:45:00Z',
    size: '850 KB',
    url: '#',
    status: 'Active',
    tags: ['Audit', 'Finance']
  },
  {
    id: 'DOC-004',
    name: 'Asset_Receipt_MAC_5521.pdf',
    type: 'PDF',
    category: 'Asset Receipt',
    employeeId: 'EMP-002',
    employeeName: 'Michael Chang',
    uploadedBy: 'IT Support',
    uploadedAt: '2026-03-10T11:20:00Z',
    size: '450 KB',
    url: '#',
    status: 'Active',
    tags: ['Asset', 'Inventory']
  }
]
