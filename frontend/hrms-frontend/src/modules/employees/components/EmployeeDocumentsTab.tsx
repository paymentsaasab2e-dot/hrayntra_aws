"use client"
import * as React from 'react'
import { SectionCard, DataTable, Button, type ColumnDef, StatusBadge } from '@hryantra/ui'
import { useStore } from '@/store/StoreProvider'
import { Document } from '@/modules/documents/types'
import { FileText, Download, MoreVertical } from 'lucide-react'
import { DocumentUploadDrawer } from '@/modules/documents/components/DocumentUploadDrawer'
import { DocumentDetailDrawer } from '@/modules/documents/components/DocumentDetailDrawer'

interface EmployeeDocumentsTabProps {
  employeeId: string
}

export function EmployeeDocumentsTab({ employeeId }: EmployeeDocumentsTabProps) {
  const { documents } = useStore()
  const [isUploadOpen, setIsUploadOpen] = React.useState(false)
  const [selectedDoc, setSelectedDoc] = React.useState<Document | null>(null)

  const employeeDocs = React.useMemo(() => {
    return documents.filter(d => d.employeeId === employeeId)
  }, [documents, employeeId])

  const columns: ColumnDef<Document>[] = [
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Document Name',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <FileText className="size-4 text-ds-neutral-400" />
          <span className="text-ds-body-sm font-semibold text-ds-brand-navy">{row.name}</span>
        </div>
      )
    },
    { id: 'category', accessorKey: 'category', header: 'Category', className: 'text-ds-body-sm text-ds-neutral-500' },
    { id: 'uploadedBy', accessorKey: 'uploadedBy', header: 'Uploaded By', className: 'text-ds-body-sm' },
    {
      id: 'date',
      accessorKey: 'uploadedAt',
      header: 'Date',
      cell: ({ row }) => (
        <span className="text-ds-body-sm text-ds-neutral-500" suppressHydrationWarning>
          {new Date(row.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      )
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.status} />
    },
    {
      id: 'actions',
      header: '',
      width: 60,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="icon-sm" onClick={(e: React.MouseEvent) => { e.stopPropagation(); setSelectedDoc(row) }}>
            <MoreVertical className="size-4 text-ds-neutral-400" />
          </Button>
        </div>
      )
    }
  ]

  return (
    <>
      <div className="flex flex-col gap-3">
        <SectionCard 
          title="Documents & Files" 
          titleAction={
            <Button variant="outline" size="sm" onClick={() => setIsUploadOpen(true)}>
              Upload Document
            </Button>
          }
        >
          <DataTable
            data={employeeDocs}
            columns={columns}
            keyExtractor={(row) => row.id}
            emptyTitle="No documents found"
            emptyDescription="Official records and employee documents will appear here."
          />
        </SectionCard>
      </div>

      <DocumentUploadDrawer open={isUploadOpen} onClose={() => setIsUploadOpen(false)} />
      <DocumentDetailDrawer 
        open={selectedDoc !== null} 
        onClose={() => setSelectedDoc(null)} 
        document={selectedDoc} 
      />
    </>
  )
}
