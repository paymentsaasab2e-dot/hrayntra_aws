"use client"
import * as React from 'react'
import { DrawerWrapper, Button, StatusBadge, SectionCard } from '@hryantra/ui'
import { Document } from '../types'
import { FileText, Download, Archive, User, Calendar, Tag, ShieldCheck, HardDrive } from 'lucide-react'
import { useStore } from '@/store/StoreProvider'

interface DocumentDetailDrawerProps {
  document: Document | null
  open: boolean
  onClose: () => void
}

export function DocumentDetailDrawer({ document, open, onClose }: DocumentDetailDrawerProps) {
  const { archiveDocument } = useStore()
  
  if (!document) return null

  const handleArchive = () => {
    archiveDocument(document.id)
    onClose()
  }

  return (
    <DrawerWrapper
      open={open}
      onClose={onClose}
      title={document.name}
      subtitle={`ID: ${document.id}`}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} className="mr-auto">Close</Button>
          {document.status === 'Active' && (
            <Button variant="destructive-outline" onClick={handleArchive}>
              <Archive className="size-4 mr-2" /> Archive
            </Button>
          )}
          <Button
            variant="default"
            onClick={() => {
              if (document.url) {
                window.open(document.url, '_blank', 'noopener,noreferrer')
              } else {
                alert('No downloadable file is attached to this document yet.')
              }
            }}
          >
            <Download className="size-4 mr-2" /> Download
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Status & Category */}
        <div className="flex items-center gap-3">
          <StatusBadge status={document.status} withDot />
          <div className="px-2 py-0.5 rounded bg-ds-brand-navy/5 text-ds-brand-navy text-[11px] font-bold uppercase tracking-wider">
            {document.category}
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl border border-ds-neutral-200 flex items-center gap-3 shadow-sm">
             <div className="size-10 rounded-lg bg-ds-neutral-50 flex items-center justify-center text-ds-neutral-400">
                <User className="size-5" />
             </div>
             <div className="flex flex-col">
                <span className="text-[10px] font-bold text-ds-neutral-400 uppercase tracking-wider">Uploaded By</span>
                <span className="text-ds-body-sm font-semibold text-ds-brand-navy">{document.uploadedBy}</span>
             </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-ds-neutral-200 flex items-center gap-3 shadow-sm">
             <div className="size-10 rounded-lg bg-ds-neutral-50 flex items-center justify-center text-ds-neutral-400">
                <Calendar className="size-5" />
             </div>
             <div className="flex flex-col">
                <span className="text-[10px] font-bold text-ds-neutral-400 uppercase tracking-wider">Upload Date</span>
                <span className="text-ds-body-sm font-semibold text-ds-brand-navy" suppressHydrationWarning>
                  {new Date(document.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
             </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-ds-neutral-200 flex items-center gap-3 shadow-sm">
             <div className="size-10 rounded-lg bg-ds-neutral-50 flex items-center justify-center text-ds-neutral-400">
                <HardDrive className="size-5" />
             </div>
             <div className="flex flex-col">
                <span className="text-[10px] font-bold text-ds-neutral-400 uppercase tracking-wider">File Metadata</span>
                <span className="text-ds-body-sm font-semibold text-ds-brand-navy">{document.type} • {document.size}</span>
             </div>
          </div>

          {document.employeeName && (
            <div className="bg-white p-4 rounded-xl border border-ds-neutral-200 flex items-center gap-3 shadow-sm">
              <div className="size-10 rounded-lg bg-ds-neutral-50 flex items-center justify-center text-ds-neutral-400">
                  <ShieldCheck className="size-5" />
              </div>
              <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-ds-neutral-400 uppercase tracking-wider">Owner</span>
                  <span className="text-ds-body-sm font-semibold text-ds-brand-navy">{document.employeeName}</span>
              </div>
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-col gap-2">
           <h4 className="text-ds-label font-bold text-ds-neutral-900 uppercase tracking-wide">Document Tags</h4>
           <div className="flex flex-wrap gap-2">
              {document.tags && document.tags.length > 0 ? (
                document.tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ds-neutral-100 text-ds-body-xs font-medium text-ds-neutral-600 border border-ds-neutral-200">
                    <Tag className="size-3" /> {tag}
                  </span>
                ))
              ) : (
                <span className="text-ds-caption text-ds-neutral-400 italic">No tags associated</span>
              )}
           </div>
        </div>

        {/* Preview Placeholder */}
        <div className="mt-4">
           <h4 className="text-ds-label font-bold text-ds-neutral-900 uppercase tracking-wide mb-3">Document Preview</h4>
           <div className="aspect-[4/5] w-full bg-ds-neutral-100 rounded-xl border-2 border-dashed border-ds-neutral-200 flex flex-col items-center justify-center text-ds-neutral-400 group hover:border-ds-neutral-300 transition-all">
              <FileText className="size-16 mb-4 opacity-20" />
              <p className="text-ds-body-sm font-medium">Preview not available for this file type</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-4"
                onClick={() => {
                  if (document.url) window.open(document.url, '_blank', 'noopener,noreferrer')
                  else alert('No file URL available for this document.')
                }}
              >
                Open in browser window
              </Button>
           </div>
        </div>
      </div>
    </DrawerWrapper>
  )
}
