"use client"
import * as React from 'react'
import { SectionCard, DataTable, Button, Input, StatusBadge, MetricStatCard, PageHeroBanner, FilterDrawer, FilterTriggerButton, FilterField, FILTER_INPUT_CLASS, Select, InputWrapper, type ColumnDef, type SortDirection } from '@hryantra/ui'
import { useStore } from '@/store/StoreProvider'
import { Document, DocumentCategory } from '@/modules/documents/types'
import { Plus, Search, FileText, Download, MoreVertical, FileIcon, FileSpreadsheet, ImageIcon, Archive } from 'lucide-react'
import { DocumentUploadDrawer } from '@/modules/documents/components/DocumentUploadDrawer'
import { DocumentDetailDrawer } from '@/modules/documents/components/DocumentDetailDrawer'

export default function DocumentsPage() {
  const { documents } = useStore()
  
  const [search, setSearch] = React.useState('')
  const [categoryFilter, setCategoryFilter] = React.useState<DocumentCategory | 'All'>('All')
  const [isUploadOpen, setIsUploadOpen] = React.useState(false)
  const [selectedDoc, setSelectedDoc] = React.useState<Document | null>(null)
  
  const [sortColumn, setSortColumn] = React.useState<string | undefined>('uploadedAt')
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('desc')
  const [page, setPage] = React.useState(1)
  const [isFilterOpen, setIsFilterOpen] = React.useState(false)
  const [draftSearch, setDraftSearch] = React.useState('')
  const [draftCategory, setDraftCategory] = React.useState<DocumentCategory | 'All'>('All')

  const activeFilterCount =
    (search.trim() ? 1 : 0) + (categoryFilter !== 'All' ? 1 : 0)

  const dateEyebrow = React.useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).toUpperCase(),
    []
  )

  const openFilters = () => {
    setDraftSearch(search)
    setDraftCategory(categoryFilter)
    setIsFilterOpen(true)
  }

  const applyFilters = () => {
    setSearch(draftSearch)
    setCategoryFilter(draftCategory)
    setIsFilterOpen(false)
  }

  const clearFilters = () => {
    setDraftSearch('')
    setDraftCategory('All')
    setSearch('')
    setCategoryFilter('All')
    setIsFilterOpen(false)
  }

  const filteredDocuments = React.useMemo(() => {
    return documents.filter(doc => {
      const matchesSearch = doc.name.toLowerCase().includes(search.toLowerCase()) || 
                           doc.employeeName?.toLowerCase().includes(search.toLowerCase()) ||
                           doc.id.toLowerCase().includes(search.toLowerCase())
      
      const matchesCategory = categoryFilter === 'All' || doc.category === categoryFilter
      
      return matchesSearch && matchesCategory
    })
  }, [documents, search, categoryFilter])

  const sortedDocuments = React.useMemo(() => {
    if (!sortColumn || !sortDirection) return filteredDocuments
    return [...filteredDocuments].sort((a, b) => {
      const aVal = String(a[sortColumn as keyof Document] || '')
      const bVal = String(b[sortColumn as keyof Document] || '')
      return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    })
  }, [filteredDocuments, sortColumn, sortDirection])

  const getFileIcon = (type: string) => {
    if (type === 'PDF') return <FileText className="size-5 text-red-500" />
    if (type === 'Excel') return <FileSpreadsheet className="size-5 text-emerald-600" />
    if (type === 'Word') return <FileIcon className="size-5 text-blue-600" />
    if (type === 'Image') return <ImageIcon className="size-5 text-amber-500" />
    return <FileText className="size-5 text-ds-neutral-400" />
  }

  const columns: ColumnDef<Document>[] = [
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Document Name',
      sortable: true,
      cell: ({ row }) => (
        <div className="flex items-center gap-3 py-1">
          <div className="size-9 rounded-lg bg-ds-neutral-50 border border-ds-neutral-200 flex items-center justify-center">
            {getFileIcon(row.type)}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-ds-body-sm font-semibold truncate text-ds-brand-navy">{row.name}</span>
            <span className="text-[10px] text-ds-neutral-500 font-bold uppercase tracking-wider">{row.id} • {row.size}</span>
          </div>
        </div>
      )
    },
    {
      id: 'category',
      accessorKey: 'category',
      header: 'Type',
      sortable: true,
      cell: ({ row }) => (
        <div className="px-2 py-0.5 rounded-full bg-ds-neutral-100 text-[11px] font-bold text-ds-neutral-600 inline-block">
          {row.category}
        </div>
      )
    },
    {
      id: 'employeeName',
      accessorKey: 'employeeName',
      header: 'Employee',
      sortable: true,
      cell: ({ row }) => row.employeeName ? (
        <span className="text-ds-body-sm text-ds-brand-navy font-medium">{row.employeeName}</span>
      ) : (
        <span className="text-ds-caption text-ds-neutral-400 italic">General</span>
      )
    },
    {
      id: 'uploadedBy',
      accessorKey: 'uploadedBy',
      header: 'Uploaded By',
      className: 'text-ds-body-sm text-ds-neutral-600',
    },
    {
      id: 'uploadedAt',
      accessorKey: 'uploadedAt',
      header: 'Date',
      sortable: true,
      cell: ({ row }) => (
        <span className="text-ds-body-sm text-ds-neutral-500" suppressHydrationWarning>
          {new Date(row.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      )
    },
    {
      id: 'actions',
      header: '',
      width: 60,
      cell: ({ row }) => (
        <div className="flex justify-end pr-2">
          <Button variant="ghost" size="icon-sm" onClick={(e: React.MouseEvent) => { e.stopPropagation(); setSelectedDoc(row) }}>
            <MoreVertical className="size-4 text-ds-neutral-400" />
          </Button>
        </div>
      )
    }
  ]

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-6 py-6">
      <section className="flex flex-col gap-4">
        <PageHeroBanner
          compact
          eyebrow={dateEyebrow}
          title="Documents"
          description="Centralized repository for employee, company, and compliance files."
          actions={
            <Button variant="default" onClick={() => setIsUploadOpen(true)}>
              <Plus className="size-4" />
              Upload Document
            </Button>
          }
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricStatCard label="Total Files" value={documents.length} subtitle="All documents" tone="blue" icon={FileText} />
          <MetricStatCard label="Employee Docs" value={documents.filter((d) => d.category === 'Employee').length} subtitle="Staff records" tone="mint" icon={Plus} />
          <MetricStatCard label="Company Policy" value={documents.filter((d) => d.category === 'Company').length} subtitle="Org policies" tone="indigo" icon={ShieldCheck} />
          <MetricStatCard label="Archived" value={documents.filter((d) => d.status === 'Archived').length} subtitle="Inactive files" tone="lavender" icon={Archive} />
        </div>
      </section>

      <section className="flex items-center justify-end rounded-2xl border border-[#e2e8f0] bg-white px-4 py-3 shadow-sm">
        <FilterTriggerButton activeCount={activeFilterCount} onClick={openFilters} />
      </section>

      <SectionCard title={`Document library (${filteredDocuments.length})`} bodyClassName="p-0" noPadding>
        <div className="p-5">
        <DataTable
          data={sortedDocuments}
          columns={columns}
          keyExtractor={(row) => row.id}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={(col, dir) => { setSortColumn(col); setSortDirection(dir) }}
          onRowClick={(row) => setSelectedDoc(row)}
          pagination={{
            page: page,
            perPage: 10,
            total: filteredDocuments.length,
            onPageChange: setPage,
            perPageOptions: [10, 20, 50]
          }}
        />
        </div>
      </SectionCard>

      <FilterDrawer
        open={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onApply={applyFilters}
        onClear={clearFilters}
      >
        <FilterField label="Search" htmlFor="doc-filter-search">
          <InputWrapper leftIcon={<Search className="size-4" />}>
            <Input
              id="doc-filter-search"
              hasLeftIcon
              placeholder="Name, employee, or ID..."
              value={draftSearch}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraftSearch(e.target.value)}
              className={FILTER_INPUT_CLASS}
            />
          </InputWrapper>
        </FilterField>
        <FilterField label="Category" htmlFor="doc-filter-category">
          <Select
            id="doc-filter-category"
            className={FILTER_INPUT_CLASS}
            value={draftCategory}
            onChange={(e) => setDraftCategory(e.target.value as DocumentCategory | 'All')}
          >
            {['All', 'Employee', 'Company', 'Compliance', 'Asset Receipt'].map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </Select>
        </FilterField>
      </FilterDrawer>

      <DocumentUploadDrawer open={isUploadOpen} onClose={() => setIsUploadOpen(false)} />
      <DocumentDetailDrawer 
        open={selectedDoc !== null} 
        onClose={() => setSelectedDoc(null)} 
        document={selectedDoc} 
      />
    </div>
  )
}

function ShieldCheck(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}
