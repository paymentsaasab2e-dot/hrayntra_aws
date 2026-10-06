'use client';

import React from 'react';
import { FileSpreadsheet, Download, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { CandidatePhotoUpload, AddCandidateFormSections } from '../AddCandidateFormSections';
import { StepProgress, validateNoDigits, stripDigits, MAX_RESUME_FILE_LABEL, CURRENCY_OPTIONS, PIPELINE_STAGES, SOURCE_OPTIONS, MARITAL_STATUS_OPTIONS, PROFICIENCY_OPTIONS } from '../addCandidateShared';

export function AddCandidateCsvBlock(props) {
  const {
    activeTab,
    autoFilledFields,
    avatarPreview,
    clearAvatarFile,
    csvExpanded,
    csvImportProgress,
    csvPhase,
    csvResult,
    csvRows,
    csvSummary,
    currentStep,
    embeddedBulkCv,
    errors,
    fieldRefs,
    formData,
    handleAvatarFile,
    handleCsvSelected,
    handleDownloadCsvTemplate,
    handleDuplicateCheck,
    jobs,
    lockJobSelection,
    manualResumeFile,
    parsedResumeFile,
    recruiters,
    renderCandidateConflict,
    resumeFileRef,
    selectedJob,
    setCsvExpanded,
    setManualResumeFile,
    showAiChatStage,
    updateFormData,
    validateEmail,
  } = props;

  return (
!embeddedBulkCv && activeTab === 'csv' ? (
            <div className="space-y-5">
              {csvPhase === 'upload' ? (
                <>
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                    <FileSpreadsheet size={24} className="mb-3 text-slate-400" />
                    <p className="text-sm font-medium text-slate-700">Drag CSV file here or click browse</p>
                    <p className="mt-1 text-xs text-slate-500">.csv files only</p>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(event) => handleCsvSelected(event.target.files?.[0])}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleDownloadCsvTemplate}
                    className="inline-flex items-center gap-2 text-sm font-medium text-blue-600"
                  >
                    <Download size={16} />
                    Download CSV template
                  </button>
                </>
              ) : null}

              {csvPhase === 'preview' ? (
                <>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {csvSummary.ready} ready to import · {csvSummary.duplicates} duplicates will be skipped ·{' '}
                    {csvSummary.errorsCount} rows have errors
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <div className="max-h-[420px] overflow-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-3 py-2">#</th>
                            <th className="px-3 py-2">Name</th>
                            <th className="px-3 py-2">Email</th>
                            <th className="px-3 py-2">Company</th>
                            <th className="px-3 py-2">Designation</th>
                            <th className="px-3 py-2">Source</th>
                            <th className="px-3 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csvRows.slice(0, 10).map((row) => (
                            <tr key={row.__index} className="border-t border-slate-100">
                              <td className="px-3 py-2">{row.__index}</td>
                              <td className="px-3 py-2">{`${row.firstName || ''} ${row.lastName || ''}`.trim() || '-'}</td>
                              <td className="px-3 py-2">{row.email || '-'}</td>
                              <td className="px-3 py-2">{row.currentCompany || '-'}</td>
                              <td className="px-3 py-2">{row.designation || '-'}</td>
                              <td className="px-3 py-2">{row.source || '-'}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                    row.__status === 'Ready'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : row.__status === 'Duplicate'
                                        ? 'bg-amber-50 text-amber-700'
                                        : 'bg-rose-50 text-rose-700'
                                  }`}
                                >
                                  {row.__status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}

              {csvPhase === 'importing' ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-800">
                    <Loader2 size={16} className="animate-spin" />
                    Importing... {csvImportProgress.current} / {csvImportProgress.total}
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all"
                      style={{
                        width: `${csvImportProgress.total ? (csvImportProgress.current / csvImportProgress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ) : null}

              {csvPhase === 'complete' && csvResult ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="space-y-3 text-sm text-slate-700">
                    <p className="font-semibold text-emerald-600">✓ {csvResult.created} candidates imported successfully</p>
                    <p className="font-semibold text-amber-600">⚠ {csvResult.skipped} skipped (duplicate email)</p>
                    <p className="font-semibold text-rose-600">✕ {csvResult.failed} failed (missing required fields)</p>
                    <button
                      type="button"
                      onClick={() => setCsvExpanded((prev) => !prev)}
                      className="inline-flex items-center gap-1 text-sm font-medium text-slate-700"
                    >
                      {csvExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      Show skipped details
                    </button>
                    {csvExpanded && csvResult.skippedDetails?.length ? (
                      <div className="rounded-xl bg-slate-50 p-3 text-xs">
                        {csvResult.skippedDetails.map((detail, index) => (
                          <div key={`${detail.row}-${index}`} className="py-1">
                            Row {detail.row} - {detail.email || 'No email'} - {detail.reason}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (showAiChatStage || embeddedBulkCv || activeTab === 'bulkResume') ? null : (
            <>
              {activeTab === 'manual' && currentStep === 1 ? (
                <CandidatePhotoUpload
                  preview={avatarPreview || formData.avatar}
                  onSelectFile={handleAvatarFile}
                  onRemove={clearAvatarFile}
                  className="mb-3"
                  compact
                />
              ) : null}
              <StepProgress currentStep={currentStep} />
              <AddCandidateFormSections
              currentStep={currentStep}
              formData={formData}
              updateFormData={updateFormData}
              errors={errors}
              autoFilledFields={autoFilledFields}
              fieldRefs={fieldRefs}
              jobs={jobs}
              recruiters={recruiters}
              selectedJob={selectedJob}
              lockJobSelection={lockJobSelection}
              manualResumeFile={manualResumeFile}
              setManualResumeFile={setManualResumeFile}
              resumeFileRef={resumeFileRef}
              parsedResumeFile={parsedResumeFile}
              activeTab={activeTab}
              renderCandidateConflict={renderCandidateConflict}
              handleDuplicateCheck={handleDuplicateCheck}
              validateEmail={validateEmail}
              validateNoDigits={validateNoDigits}
              stripDigits={stripDigits}
              maxResumeFileLabel={MAX_RESUME_FILE_LABEL}
              currencyOptions={CURRENCY_OPTIONS}
              pipelineStages={PIPELINE_STAGES}
              sourceOptions={SOURCE_OPTIONS}
              maritalStatusOptions={MARITAL_STATUS_OPTIONS}
              proficiencyOptions={PROFICIENCY_OPTIONS}
            />
            </>
          )
  );
}
