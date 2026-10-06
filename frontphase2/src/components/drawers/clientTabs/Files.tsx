'use client';

import React from 'react';
import { buildFileHref } from '../../../utils/cloudinaryUrls';
import { formatDateDMY } from '../../../utils/dateDisplay';
import { Shield, FileText, FileCheck, Receipt, Briefcase, Paperclip, User, Download, Eye, Trash2 } from 'lucide-react';
import { DocumentUploadButton } from '../../import/documentUploadUi';
import { FILE_TYPE_BADGE_STYLES } from '../clientDetailsShared';
import { ClientFileType } from '@/app/client/types';
import { ImageWithFallback } from '../../ImageWithFallback';

export function ClientFilesTab(props: any) {
  const {
    FILE_TYPE_OPTIONS,
    client,
    clientFiles,
    deleteFile,
    filesError,
    filesLoading,
    filesTypeFilter,
    filesUploadPercent,
    filesUploadSuccess,
    filesUploading,
    isHqOverrideMode,
    setFilesTypeFilter,
    uploadFile,
  } = props;

const filteredFiles = filesTypeFilter === 'All'
                    ? clientFiles
                    : clientFiles.filter((f: any) => f.fileType === filesTypeFilter);
const uploadsBase = (typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1') : 'http://localhost:5001/api/v1').replace(/\/api\/v1\/?$/, '');
const toFileHref = (fileUrl?: string | null) => buildFileHref(fileUrl, uploadsBase);
const formatUploadDate = (d: string) => {
                    if (!d) return '—';
                    try {
                      return formatDateDMY(d);
                    } catch {
                      return d;
                    }
                  };
const FileTypeIcon = ({ type }: { type: string }) => {
                    switch (type) {
                      case 'NDA': return <Shield size={14} className="text-slate-600 shrink-0" />;
                      case 'Contract': return <FileText size={14} className="text-blue-600 shrink-0" />;
                      case 'SLA': return <FileCheck size={14} className="text-emerald-600 shrink-0" />;
                      case 'Policy': return <FileText size={14} className="text-amber-600 shrink-0" />;
                      case 'Invoice': return <Receipt size={14} className="text-violet-600 shrink-0" />;
                      case 'Job Brief': return <Briefcase size={14} className="text-indigo-600 shrink-0" />;
                      default: return <Paperclip size={14} className="text-slate-500 shrink-0" />;
                    }
                  };

  return (
<div className="space-y-4">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <DocumentUploadButton
                          disabled={!client?.id || isHqOverrideMode}
                          isUploading={filesUploading}
                          uploadSuccess={filesUploadSuccess}
                          uploadPercent={filesUploadPercent}
                          label="Upload File"
                          onFilesSelected={async (files: any) => {
                            await uploadFile(files[0], 'Contract');
                          }}
                        />
                        <div className="flex flex-wrap items-center gap-2 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                          {FILE_TYPE_OPTIONS.map((type: any) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setFilesTypeFilter(type)}
                              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 ${filesTypeFilter === type ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                      </div>
                      {isHqOverrideMode && (
                        <p className="mt-2 text-sm text-slate-500">
                          File storage for HQ clients is not available yet.
                        </p>
                      )}
                      {filesError && <p className="mt-2 text-sm text-red-600">{filesError}</p>}
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Files</h4>
                        <p className="text-xs text-slate-500">{filesLoading ? 'Loading…' : `${filteredFiles.length} files`}</p>
                      </div>
                      <div className="overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
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
                                <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">
                                  No files for this type.
                                </td>
                              </tr>
                            ) : (
                              filteredFiles.map((file: any) => (
                                <tr key={file.id} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="px-4 py-3">
                                    <p className="text-sm font-medium text-slate-900 truncate max-w-[200px]">{file.fileName}</p>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${FILE_TYPE_BADGE_STYLES[file.fileType as ClientFileType] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                      <FileTypeIcon type={file.fileType} />
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
