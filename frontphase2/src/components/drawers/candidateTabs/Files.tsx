'use client';

import React from 'react';
import { DrawerSectionCard } from '../drawerFormUi';
import { Paperclip, FileText } from 'lucide-react';
import { DocumentUploadButton } from '../../import/documentUploadUi';
import { CandidateCvFilesSection } from '../../candidates/CandidateCvFilesSection';

export function CandidateFilesTab(props: any) {
  const {
    candidate,
    candidateFilesError,
    candidateFilesLoading,
    candidateFilesOther,
    candidateFilesUploadPercent,
    candidateFilesUploadSuccess,
    candidateFilesUploading,
    cvEditor,
    deleteCandidateFile,
    handleCvToast,
    handleViewResumeTabFromFiles,
    onUpdateCandidate,
    originalResumeFileUrl,
    saasaCv,
    saasaCvFileEntry,
    toFileHref,
    uploadCandidateFile,
    uploadsBase,
  } = props;

  return (
<DrawerSectionCard
                    title="Files"
                    subtitle="Upload and manage candidate documents"
                    icon={Paperclip}
                    accent="indigo"
                  >
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <DocumentUploadButton
                        disabled={!candidate?.id}
                        isUploading={candidateFilesUploading}
                        uploadSuccess={candidateFilesUploadSuccess}
                        uploadPercent={candidateFilesUploadPercent}
                        label="Upload File"
                        onFilesSelected={async (files: any) => {
                          await uploadCandidateFile(files[0], 'Other');
                        }}
                      />
                    </div>

                    {candidateFilesError ? (
                      <p className="text-sm text-red-600">{candidateFilesError}</p>
                    ) : null}

                    <div className="space-y-4">
                      <CandidateCvFilesSection
                        candidate={candidate}
                        cvEditor={cvEditor}
                        saasaCv={saasaCv}
                        saasaCvFileEntry={saasaCvFileEntry}
                        originalResumeUrl={originalResumeFileUrl}
                        uploadsBase={uploadsBase}
                        canEdit={Boolean(onUpdateCandidate)}
                        onToast={handleCvToast}
                        onViewResumeTab={handleViewResumeTabFromFiles}
                      />

                      {candidateFilesOther.length > 0 ? (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Other documents
                          </h4>
                        </div>
                      ) : null}

                      {candidateFilesLoading && candidateFilesOther.length === 0 ? (
                        <p className="text-sm text-slate-500">Loading attached files…</p>
                      ) : candidateFilesOther.length > 0 ? (
                        candidateFilesOther.map((file: any) => (
                          <div
                            key={file.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
                          >
                            <a
                              href={file.fileUrl ? toFileHref(file.fileUrl) : undefined}
                              target={file.fileUrl ? '_blank' : undefined}
                              rel={file.fileUrl ? 'noreferrer' : undefined}
                              className={`min-w-0 flex-1 ${!file.fileUrl ? 'pointer-events-none' : ''}`}
                              onClick={(e: any) => {
                                if (!file.fileUrl) e.preventDefault();
                              }}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-slate-900">{file.fileName}</p>
                                  <p className="mt-0.5 text-xs text-slate-500">
                                    {file.fileUrl
                                      ? `${file.fileType}${file.uploadedBy?.name ? ` · ${file.uploadedBy.name}` : ''}`
                                      : 'Uploading…'}
                                  </p>
                                </div>
                                <FileText size={16} className="shrink-0 text-slate-400" />
                              </div>
                            </a>
                            <button
                              type="button"
                              disabled={!file.fileUrl || String(file.id).startsWith('pending-')}
                              onClick={() => deleteCandidateFile(file.id)}
                              className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        ))
                      ) : !originalResumeFileUrl && !saasaCvFileEntry && candidateFilesOther.length === 0 ? (
                        <p className="text-sm text-slate-500">No files uploaded.</p>
                      ) : null}
                    </div>
                  </DrawerSectionCard>
  );
}
