'use client';

import React from 'react';
import { DrawerSectionCard } from '../drawerFormUi';
import { Upload, Loader2, FileText } from 'lucide-react';

export function CreateJobJdStep(props: any) {
  const {
    aiGenerating,
    handleSmartJobFilePick,
    smartJobAttachment,
    smartJobError,
    smartJobFileInputRef,
  } = props;

  return (
<DrawerSectionCard
                  title="Upload Job Description"
                  icon={Upload}
                  accent="blue"
                >
                  <div className="space-y-4">
                    <input
                      ref={smartJobFileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                      className="hidden"
                      onChange={(e: any) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        void handleSmartJobFilePick(file);
                      }}
                    />
                    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/40 px-4 py-10 text-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md">
                        {aiGenerating ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <FileText className="h-5 w-5" />
                        )}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {aiGenerating ? 'Extracting job details…' : 'Upload a JD file'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">PDF, DOC, DOCX, or TXT</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => smartJobFileInputRef.current?.click()}
                        disabled={aiGenerating}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
                      >
                        <Upload className="h-4 w-4" />
                        Upload JD
                      </button>
                    </div>
                    {smartJobAttachment ? (
                      <div className="flex items-center gap-2 rounded-lg border border-slate-700/30 bg-slate-900 px-2.5 py-2 text-white">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600">
                          {smartJobAttachment.status === 'processing' ? (
                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                          ) : (
                            <FileText className="h-4 w-4 text-white" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{smartJobAttachment.file.name}</p>
                          <p className="text-[11px] text-slate-400">
                            {smartJobAttachment.status === 'processing'
                              ? 'Extracting…'
                              : smartJobAttachment.status === 'error'
                                ? smartJobAttachment.error || 'Failed'
                                : 'Ready — continue to review the form'}
                          </p>
                        </div>
                      </div>
                    ) : null}
                    {smartJobError ? (
                      <p className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
                        {smartJobError}
                      </p>
                    ) : null}
                    <p className="text-xs text-slate-500">
                      Or skip and fill the job form manually on the next step.
                    </p>
                  </div>
                </DrawerSectionCard>
  );
}
