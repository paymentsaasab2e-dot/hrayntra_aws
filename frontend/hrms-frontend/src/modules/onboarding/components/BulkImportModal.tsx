"use client"

import * as React from 'react'
import { Button, Textarea } from '@hryantra/ui'
import { Upload, X } from 'lucide-react'
import { api } from '@/shared/api'

type Props = {
  open: boolean
  onClose: () => void
  onImported: () => void
}

function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const idx = (name: string) => headers.indexOf(name)

  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim())
    return {
      name: cols[idx('name')] || cols[0] || '',
      email: cols[idx('email')] || '',
      role: cols[idx('role')] || cols[idx('designation')] || 'Employee',
      department: cols[idx('department')] || 'General',
      phone: cols[idx('phone')] || '',
      country: cols[idx('country')] || 'India',
      region: cols[idx('region')] || cols[idx('state')] || '',
      city: cols[idx('city')] || '',
      locality: cols[idx('locality')] || '',
      joinDate: cols[idx('joindate')] || cols[idx('join_date')] || new Date().toISOString().slice(0, 10),
    }
  }).filter((row) => row.name)
}

export function BulkImportModal({ open, onClose, onImported }: Props) {
  const [text, setText] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  const sample = `name,email,role,department,country,city,joindate
Asha Patel,asha@example.com,Software Engineer,Engineering,India,Mumbai,2026-07-01
John Smith,john@example.com,Accountant,Finance,USA,New York,2026-07-15`

  const handleImport = async () => {
    const candidates = parseCsv(text)
    if (!candidates.length) {
      setError('Paste CSV with header: name,email,role,department,country,city,joindate')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.onboarding.bulkImport(candidates)
      onImported()
      onClose()
      setText('')
    } catch (e: any) {
      setError(e.message || 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-[0_25px_60px_-15px_rgba(15,23,42,0.3)] border border-slate-200/90 p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-600">
              <Upload className="size-4.5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">Bulk Import Candidates</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Batch ingest candidates via CSV. Fields are automatically mapped to localized CTC profiles.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X className="size-5" />
          </button>
        </div>
        {error && <div className="mb-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 font-medium">{error}</div>}
        <Textarea
          rows={9}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={sample}
          className="font-mono text-xs border-slate-200 rounded-xl"
        />
        <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={() => setText(sample)} className="text-xs h-8 text-slate-700 border-slate-200 hover:bg-slate-50">
            Load sample
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs h-8 text-slate-700 border-slate-200 hover:bg-slate-50">
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleImport}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs h-8 shadow-xs"
            >
              <Upload className="size-3.5 mr-1.5" />
              {loading ? 'Importing…' : 'Import Candidates'}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
