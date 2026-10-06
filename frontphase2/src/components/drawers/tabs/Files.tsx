'use client';

import React, { useState } from 'react';
import { useFiles } from '../../../hooks/useFiles';
import { DocumentUploadButton } from '../../import/documentUploadUi';
import {
  DrawerSectionCard,
  DRAWER_TABLE_ACTIONS,
  DRAWER_TABLE_BODY,
  DRAWER_TABLE_HEAD_ROW,
  DRAWER_TABLE_SCROLL,
  DRAWER_TABLE_SHELL,
  DRAWER_TABLE_TD,
  DRAWER_TABLE_TH,
  DRAWER_TABLE_TR,
} from '../drawerFormUi';
import { ImageWithFallback } from '../../ImageWithFallback';
import { formatDateDMY } from '../../../utils/dateDisplay';
import { buildFileHref } from '../../../utils/cloudinaryUrls';
import { Briefcase, Download, Eye, FileCheck, FileText, Paperclip, Trash2, User } from 'lucide-react';
import { JobFileType, JOB_FILE_TYPE_BADGE_STYLES } from '../jobDetailsTypes';
import type { JobForDrawer } from '../JobDetailsDrawer';

export function FilesTab({ job }: { job: JobForDrawer | null }) {
  const {
    files,
    loading: filesLoading,
    uploading: filesUploading,
    uploadSuccess: filesUploadSuccess,
    uploadPercent: filesUploadPercent,
    error: filesError,
    uploadFile,
    deleteFile,
  } = useFiles('job', job?.id);
  const [filesTypeFilter, setFilesTypeFilter] = useState<JobFileType | 'All'>('All');
  const JOB_FILE_TYPE_OPTIONS: (JobFileType | 'All')[] = ['All', 'JD', 'Contract', 'Offer Letter', 'Policy', 'Resume', 'Other'];
  const allFiles = files;
  const filteredFiles = filesTypeFilter === 'All' ? allFiles : allFiles.filter((f) => f.fileType === filesTypeFilter);
  const uploadsBase = (typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1') : 'http://localhost:5001/api/v1').replace(/\/api\/v1\/?$/, '');
  const toFileHref = (fileUrl?: string | null) => buildFileHref(fileUrl, uploadsBase);
  const FileTypeIcon = ({ type }: { type: string }) => {
    switch (type) {
      case 'JD': return <Briefcase size={14} className="text-indigo-600 shrink-0" />;
      case 'Contract': return <FileText size={14} className="text-blue-600 shrink-0" />;
      case 'Offer Letter': return <FileCheck size={14} className="text-emerald-600 shrink-0" />;
      case 'Policy': return <FileText size={14} className="text-amber-600 shrink-0" />;
      case 'Resume': return <FileText size={14} className="text-slate-600 shrink-0" />;
      case 'Other': return <Paperclip size={14} className="text-slate-500 shrink-0" />;
      default: return <Paperclip size={14} className="text-slate-500 shrink-0" />;
    }
  };
  const formatUploadDate = (d: string) => {
    if (!d) return '—';
    try {
      return formatDateDMY(d) || d;
    } catch {
      return d;
    }
  };
  return (
                  <DrawerSectionCard
                    title="Files"
                    subtitle={`${filesLoading ? 'Loading…' : `${filteredFiles.length} files`}`}
                    icon={Paperclip}
                    accent="indigo"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <DocumentUploadButton
                        disabled={!job?.id}
                        isUploading={filesUploading}
                        uploadSuccess={filesUploadSuccess}
                        uploadPercent={filesUploadPercent}
                        label="Upload File"
                        onFilesSelected={async (files) => {
                          await uploadFile(files[0], 'JD');
                        }}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        {JOB_FILE_TYPE_OPTIONS.map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setFilesTypeFilter(type)}
                            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${filesTypeFilter === type ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                    {filesError && <p className="text-sm text-red-600">{filesError}</p>}
                    <div className={DRAWER_TABLE_SHELL}>
                      <div className={DRAWER_TABLE_SCROLL}>
                        <table className="w-full min-w-[640px] border-collapse text-left">
                          <thead>
                            <tr className={DRAWER_TABLE_HEAD_ROW}>
                              <th className={`${DRAWER_TABLE_TH} first:pl-4 sm:first:pl-5`}>File name</th>
                              <th className={DRAWER_TABLE_TH}>Type</th>
                              <th className={DRAWER_TABLE_TH}>Uploaded by</th>
                              <th className={DRAWER_TABLE_TH}>Upload date</th>
                              <th className={`${DRAWER_TABLE_TH} w-32 text-right sm:pr-5`}>Actions</th>
                            </tr>
                          </thead>
                          <tbody className={DRAWER_TABLE_BODY}>
                            {filesLoading && filteredFiles.length === 0 ? (
                              <tr>
                                <td colSpan={5} className={`${DRAWER_TABLE_TD} py-12 text-center text-sm text-slate-500`}>
                                  Loading files…
                                </td>
                              </tr>
                            ) : filteredFiles.length === 0 ? (
                              <tr>
                                <td colSpan={5} className={`${DRAWER_TABLE_TD} py-12 text-center text-sm text-slate-500`}>
                                  No files for this type.
                                </td>
                              </tr>
                            ) : (
                              filteredFiles.map((file) => (
                                <tr key={file.id} className={DRAWER_TABLE_TR}>
                                  <td className={`${DRAWER_TABLE_TD} first:pl-4 sm:first:pl-5`}>
                                    <p className="max-w-[200px] truncate text-sm font-semibold text-slate-900">
                                      {file.fileName}
                                    </p>
                                  </td>
                                  <td className={DRAWER_TABLE_TD}>
                                    <span
                                      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold shadow-sm ${JOB_FILE_TYPE_BADGE_STYLES[file.fileType as JobFileType] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}
                                    >
                                      <FileTypeIcon type={file.fileType} />
                                      {file.fileType}
                                    </span>
                                  </td>
                                  <td className={DRAWER_TABLE_TD}>
                                    <div className="flex min-w-0 items-center gap-2">
                                      {file.uploadedBy?.avatar ? (
                                        <ImageWithFallback
                                          src={file.uploadedBy.avatar}
                                          alt={file.uploadedBy.name}
                                          className="h-6 w-6 shrink-0 rounded-full border border-indigo-100 shadow-sm"
                                        />
                                      ) : (
                                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 ring-1 ring-indigo-100">
                                          <User size={12} className="text-indigo-500" />
                                        </div>
                                      )}
                                      <span className="truncate text-sm text-slate-600">
                                        {file.uploadedBy?.name ?? '—'}
                                      </span>
                                    </div>
                                  </td>
                                  <td className={`${DRAWER_TABLE_TD} text-sm text-slate-600`}>
                                    {formatUploadDate(file.uploadDate)}
                                  </td>
                                  <td className={`${DRAWER_TABLE_TD} text-right sm:pr-5`}>
                                    <div className="flex items-center justify-end">
                                      <div className={DRAWER_TABLE_ACTIONS}>
                                        {file.fileUrl ? (
                                          <a
                                            href={toFileHref(file.fileUrl)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex h-8 w-8 items-center justify-center rounded-xl text-indigo-600 transition-all hover:bg-white hover:text-indigo-800 hover:shadow-sm"
                                            title="Download"
                                          >
                                            <Download size={14} />
                                          </a>
                                        ) : null}
                                        {file.fileUrl ? (
                                          <a
                                            href={toFileHref(file.fileUrl)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex h-8 w-8 items-center justify-center rounded-xl text-emerald-600 transition-all hover:bg-white hover:text-emerald-800 hover:shadow-sm"
                                            title="Preview"
                                          >
                                            <Eye size={14} />
                                          </a>
                                        ) : null}
                                        <button
                                          type="button"
                                          onClick={() => deleteFile(file.id)}
                                          className="flex h-8 w-8 items-center justify-center rounded-xl text-rose-500 transition-all hover:bg-white hover:text-rose-700 hover:shadow-sm"
                                          title="Delete"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </DrawerSectionCard>
                  );
}
