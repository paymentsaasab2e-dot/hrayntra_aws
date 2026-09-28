'use client';

import React from 'react';
import { Upload, Loader2, Plus, FileText, StopCircle } from 'lucide-react';
import { MAX_BULK_CV_FILES_PER_SESSION, MAX_RESUME_FILE_LABEL, BROWSER_FILE_PICKER_SOFT_CAP, BULK_CV_PREVIEW_NAME_LIMIT } from '../addCandidateShared';
import { BULK_CV_FORMAT_LABEL, BULK_CV_ACCEPT_INPUT } from '@/lib/bulkCvFileTypes';

export function AddCandidateBulkResumeBlock(props) {
  const {
    activeTab,
    bulkCvAddMoreInputRef,
    bulkCvFolderInputRef,
    bulkCvStoredEntries,
    bulkCvSummary,
    bulkCvZipInputRef,
    bulkDropActive,
    bulkResumeCompleteCardClass,
    bulkResumeFiles,
    bulkResumePhase,
    bulkResumeProgress,
    bulkResumeResultRowClass,
    bulkResumeResults,
    bulkResumeStatusPill,
    bulkResumeStopRequested,
    bulkZipExpanding,
    embeddedBulkCv,
    handleBulkResumeAddMore,
    handleBulkResumeDrop,
    handleBulkResumeFolderSelected,
    handleBulkResumeSelected,
    handleBulkResumeZipSelected,
    handleStopBulkResume,
    renderBulkCvDuplicatePolicySection,
    setBulkDropActive,
  } = props;

  return (
(embeddedBulkCv || activeTab === 'bulkResume') ? (
            <div className="space-y-4">
              {bulkResumePhase === 'upload' ? (
                <div
                  className={`rounded-2xl border-2 border-dashed px-6 py-8 text-center transition ${
                    bulkDropActive ? 'border-blue-400 bg-blue-50/80' : 'border-slate-300 bg-slate-50'
                  }`}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setBulkDropActive(true);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragLeave={() => setBulkDropActive(false)}
                  onDrop={handleBulkResumeDrop}
                >
                  <Upload size={26} className="mx-auto mb-3 text-slate-400" />
                  <p className="text-sm font-medium text-slate-700">
                    Upload up to {MAX_BULK_CV_FILES_PER_SESSION} CVs (e.g. 4000 in one ZIP)
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {BULK_CV_FORMAT_LABEL} · max {MAX_RESUME_FILE_LABEL} each · drag folder or ZIP here
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                      Select files
                      <input
                        type="file"
                        accept={BULK_CV_ACCEPT_INPUT}
                        multiple
                        className="hidden"
                        onChange={(event) => handleBulkResumeSelected(event.target.files)}
                      />
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                      Select folder
                      <input
                        ref={bulkCvFolderInputRef}
                        type="file"
                        accept={BULK_CV_ACCEPT_INPUT}
                        multiple
                        className="hidden"
                        webkitdirectory=""
                        directory=""
                        onChange={(event) => handleBulkResumeFolderSelected(event.target.files)}
                      />
                    </label>
                    <label
                      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-900 hover:bg-violet-100 ${
                        bulkZipExpanding ? 'pointer-events-none opacity-60' : ''
                      }`}
                    >
                      {bulkZipExpanding ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Extracting ZIP…
                        </>
                      ) : (
                        <>Upload ZIP (best for 3000+)</>
                      )}
                      <input
                        ref={bulkCvZipInputRef}
                        type="file"
                        accept=".zip,application/zip"
                        className="hidden"
                        disabled={bulkZipExpanding}
                        onChange={(event) => void handleBulkResumeZipSelected(event.target.files)}
                      />
                    </label>
                  </div>
                  <p className="mt-3 text-xs text-amber-800">
                    For large batches (3000+ CVs): zip all {BULK_CV_FORMAT_LABEL} files into one <strong>.zip</strong> (up to 2GB) and use Upload ZIP.
                    File picker alone is limited to ~{BROWSER_FILE_PICKER_SOFT_CAP} per click in some browsers.
                  </p>
                </div>
              ) : null}

              {bulkResumePhase === 'upload' || bulkResumePhase === 'preview' ? (
                renderBulkCvDuplicatePolicySection()
              ) : null}

              {bulkResumePhase === 'preview' ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ready To Process</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {bulkCvStoredEntries.length + bulkResumeFiles.length} CV
                      {bulkCvStoredEntries.length + bulkResumeFiles.length === 1 ? '' : 's'} ready
                      {bulkCvStoredEntries.length
                        ? ` (${bulkCvStoredEntries.length} from ZIP${bulkResumeFiles.length ? ` + ${bulkResumeFiles.length} local` : ''})`
                        : ''}
                      . Each will join the pool with a &quot;New&quot; tag.
                    </p>
                    {bulkCvStoredEntries.length + bulkResumeFiles.length >= BROWSER_FILE_PICKER_SOFT_CAP &&
                    !bulkCvStoredEntries.length ? (
                      <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        Large list — use <strong>Upload ZIP</strong> for 3000+ CVs, or <strong>Add more CVs</strong>{' '}
                        below.
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100">
                        <Plus size={14} />
                        Add more CVs
                        <input
                          ref={bulkCvAddMoreInputRef}
                          type="file"
                          accept={BULK_CV_ACCEPT_INPUT}
                          multiple
                          className="hidden"
                          onChange={(event) => handleBulkResumeAddMore(event.target.files)}
                        />
                      </label>
                      <span className="text-[11px] text-slate-500">Append another batch (duplicates skipped)</span>
                    </div>
                    <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
                      {[
                        ...bulkCvStoredEntries.map((e) => ({ key: `z-${e.storedFileId}`, name: e.name, size: e.size })),
                        ...bulkResumeFiles.map((file) => ({
                          key: `f-${file.name}-${file.size}`,
                          name: file.name,
                          size: file.size,
                        })),
                      ]
                        .slice(0, BULK_CV_PREVIEW_NAME_LIMIT)
                        .map((row) => (
                          <div
                            key={row.key}
                            className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm text-slate-700"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <FileText size={16} className="shrink-0" />
                              <span className="truncate">{row.name}</span>
                            </span>
                            <span className="shrink-0 text-xs text-slate-500">
                              {Math.max(1, Math.round(row.size / 1024))} KB
                            </span>
                          </div>
                        ))}
                      {bulkCvStoredEntries.length + bulkResumeFiles.length > BULK_CV_PREVIEW_NAME_LIMIT ? (
                        <p className="px-2 py-2 text-center text-xs text-slate-500">
                          … and{' '}
                          {bulkCvStoredEntries.length +
                            bulkResumeFiles.length -
                            BULK_CV_PREVIEW_NAME_LIMIT}{' '}
                          more (all will be processed)
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {bulkResumePhase === 'importing' ? (
                <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 text-blue-700">
                      <Loader2 size={18} className="animate-spin" />
                      <div>
                        <p className="text-sm font-semibold">
                          {bulkResumeStopRequested
                            ? 'Stopping after current file...'
                            : 'Creating candidates from uploaded CVs...'}
                        </p>
                        <p className="text-xs text-blue-600">
                          Processed {bulkResumeProgress.current} of {bulkResumeProgress.total}
                        </p>
                        <p className="mt-1 text-[11px] leading-snug text-blue-500/90">
                          Keep this tab open. Screen sleep is blocked while uploading — also plug in the laptop and avoid closing the lid.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleStopBulkResume}
                      disabled={bulkResumeStopRequested}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                        bulkResumeStopRequested
                          ? 'cursor-not-allowed border-red-200 bg-red-50 text-red-400'
                          : 'border-red-200 bg-white text-red-600 hover:bg-red-50'
                      }`}
                    >
                      <StopCircle size={14} />
                      {bulkResumeStopRequested ? 'Stopping…' : 'Stop parsing'}
                    </button>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-blue-100">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all"
                      style={{
                        width: `${bulkResumeProgress.total ? (bulkResumeProgress.current / bulkResumeProgress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  {bulkResumeResults.length ? (
                    <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
                      {bulkResumeResults.map((result, index) => (
                        <div
                          key={`${result.fileName}-${index}`}
                          className={`rounded-xl px-4 py-3 text-sm ${bulkResumeResultRowClass(result)}`}
                        >
                          <p className="font-medium">{result.fileName}</p>
                          <p className="mt-1 text-xs">{result.message}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {bulkResumePhase === 'complete' ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bulk CV Upload Result</p>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                      <div className="rounded-xl bg-white p-3">
                        <p className="text-xs text-slate-500">Total Files</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">
                          {bulkCvSummary?.totalReceived ?? bulkResumeResults.length}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white p-3">
                        <p className="text-xs text-slate-500">Created</p>
                        <p className="mt-1 text-lg font-semibold text-emerald-600">
                          {bulkCvSummary?.succeeded ?? bulkResumeResults.filter((item) => item.status === 'created').length}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white p-3">
                        <p className="text-xs text-slate-500">Skipped</p>
                        <p className="mt-1 text-lg font-semibold text-slate-600">
                          {bulkCvSummary?.skipped ?? bulkResumeResults.filter((item) => item.status === 'skipped').length}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white p-3">
                        <p className="text-xs text-slate-500">Failed</p>
                        <p className="mt-1 text-lg font-semibold text-red-600">
                          {bulkCvSummary?.failed ?? bulkResumeResults.filter((item) => item.status === 'failed').length}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white p-3">
                        <p className="text-xs text-slate-500">Batch time</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {bulkCvSummary?.durationMs != null
                            ? `${(bulkCvSummary.durationMs / 1000).toFixed(1)}s`
                            : '—'}
                        </p>
                      </div>
                    </div>
                    {bulkCvSummary?.failures?.length ? (
                      <div className="mt-3 rounded-xl border border-red-100 bg-white p-3 text-xs text-red-800">
                        <p className="font-semibold text-red-900">Failures</p>
                        <ul className="mt-2 list-inside list-disc space-y-1">
                          {bulkCvSummary.failures.map((f) => (
                            <li key={f.fileName}>
                              <span className="font-medium">{f.fileName}</span> — {f.reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>

                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {bulkResumeResults.map((result, index) => {
                      const pill = bulkResumeStatusPill(result);
                      return (
                        <div
                          key={`${result.fileName}-${index}`}
                          className={`rounded-xl border px-4 py-3 ${bulkResumeCompleteCardClass(result)}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{result.fileName}</p>
                              {result.candidateName ? (
                                <p className="mt-1 text-xs text-slate-600">{result.candidateName}</p>
                              ) : null}
                            </div>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${pill.className}`}
                            >
                              {pill.label}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-slate-600">{result.message}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null
  );
}
