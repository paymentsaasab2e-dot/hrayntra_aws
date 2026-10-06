'use client';

import React from 'react';
import { buildFileHref } from '../../../utils/cloudinaryUrls';
import { formatDateTimeDMY } from '../../../utils/dateDisplay';
import { DocumentUploadButton } from '../../import/documentUploadUi';
import { FileText, User, Download, Eye, Trash2 } from 'lucide-react';
import { ImageWithFallback } from '../../ImageWithFallback';

export function LeadFilesTab(props: any) {
  const {
    deleteFile,
    filesError,
    filesLoading,
    filesUploadPercent,
    filesUploadSuccess,
    filesUploading,
    isHqOverrideMode,
    lead,
    leadFiles,
    leadFilesTypeFilter,
    setLeadFilesTypeFilter,
    uploadFile,
  } = props;

const LEAD_FILE_TYPE_OPTIONS = ['All', 'Contract', 'Proposal', 'Other'] as const;
const filteredFiles = leadFilesTypeFilter === 'All' ? leadFiles : leadFiles.filter((f: any) => f.fileType === leadFilesTypeFilter);
const uploadsBase = (typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1') : 'http://localhost:5001/api/v1').replace(/\/api\/v1\/?$/, '');
const toFileHref = (fileUrl?: string | null) => buildFileHref(fileUrl, uploadsBase);
const formatUploadDate = (d: string) => {
                    if (!d) return '—';
                    try {
                      return formatDateTimeDMY(d);
                    } catch {
                      return d;
                    }
                  };
const leadFileTypeStyles: Record<string, string> = {
                    Contract: 'bg-amber-100 text-amber-700 border-amber-200',
                    Proposal: 'bg-blue-100 text-blue-700 border-blue-200',
                    Other: 'bg-slate-100 text-slate-600 border-slate-200',
                  };

  return (
<div className="space-y-4">
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <DocumentUploadButton
                            disabled={!lead?.id || isHqOverrideMode}
                            isUploading={filesUploading}
                            uploadSuccess={filesUploadSuccess}
                            uploadPercent={filesUploadPercent}
                            label="Upload File"
                            onFilesSelected={async (files: any) => {
                              await uploadFile(files[0], 'Other');
                            }}
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            {LEAD_FILE_TYPE_OPTIONS.map((type: any) => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => setLeadFilesTypeFilter(type)}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 ${leadFilesTypeFilter === type ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                              >
                                {type}
                              </button>
                            ))}
                          </div>
                        </div>
                        {isHqOverrideMode && (
                          <p className="mt-2 text-sm text-slate-500">
                            File storage for HQ leads is not available yet.
                          </p>
                        )}
                        {filesError && <p className="mt-2 text-sm text-red-600">{filesError}</p>}
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Files</h4>
                          <p className="text-xs text-slate-500">{filesLoading ? 'Loading…' : `${filteredFiles.length} files`}</p>
                        </div>
                        <div className="overflow-x-auto custom-scrollbar">
                          <table className="w-full text-left border-collapse min-w-[640px]">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">File name</th>
                                <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Type</th>
                                <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Uploaded by</th>
                                <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Upload date</th>
                                <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right w-32">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {filesLoading && filteredFiles.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">Loading files…</td>
                                </tr>
                              ) : filteredFiles.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">No files for this type.</td>
                                </tr>
                              ) : (
                                filteredFiles.map((file: any) => (
                                  <tr key={file.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="px-4 py-3">
                                      <p className="text-sm font-medium text-slate-900 truncate max-w-[200px]">{file.fileName}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${leadFileTypeStyles[file.fileType] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                        <FileText size={14} className="text-slate-500 shrink-0" />
                                        {file.fileType}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2 min-w-0">
                                        {file.uploadedBy?.avatar ? (
                                          <ImageWithFallback src={file.uploadedBy.avatar} alt={file.uploadedBy.name} className="w-6 h-6 rounded-full border border-slate-200 shrink-0" />
                                        ) : (
                                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0"><User size={12} className="text-slate-500" /></div>
                                        )}
                                        <span className="text-sm text-slate-600 truncate">{file.uploadedBy?.name ?? '—'}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-600">{formatUploadDate(file.uploadDate)}</td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center justify-end gap-1">
                                        {file.fileUrl && (
                                          <a href={toFileHref(file.fileUrl)} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Download"><Download size={14} /></a>
                                        )}
                                        {file.fileUrl && (
                                          <a href={toFileHref(file.fileUrl)} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Preview"><Eye size={14} /></a>
                                        )}
                                        <button type="button" onClick={() => deleteFile(file.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 size={14} /></button>
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
  );
}
