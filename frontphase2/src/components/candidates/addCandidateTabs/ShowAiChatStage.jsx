'use client';

import React from 'react';
import { StopCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import { CANDIDATE_FORM_STEPS } from '../AddCandidateFormSections';

export function AddCandidateShowAiChatStageBlock(props) {
  const {
    activeTab,
    bulkCvStoredEntries,
    bulkResumeFiles,
    bulkResumePhase,
    bulkResumeStopRequested,
    csvPhase,
    csvSummary,
    currentStep,
    embeddedBulkCv,
    handleBulkImport,
    handleBulkResumeImport,
    handleDrawerClose,
    handleSave,
    handleStopBulkResume,
    isBulkResumeBusy,
    isCenteredPopup,
    isSaving,
    onClose,
    onSuccess,
    resetForNext,
    setAiFlowStage,
    setCurrentStep,
    showAiChatStage,
    showAiFormStage,
    validateStep,
  } = props;

  return (
showAiChatStage ? null : (
        <div
          className={`relative border-t border-slate-200 bg-white/95 ${
            embeddedBulkCv ? 'px-5 py-4' : isCenteredPopup ? 'px-5 py-4 sm:px-7' : 'px-6 py-4'
          }`}
        >
          {!embeddedBulkCv && activeTab === 'csv' ? (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleDrawerClose}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
              >
                {csvPhase === 'complete' ? 'Done' : 'Cancel'}
              </button>
              {csvPhase === 'preview' ? (
                <button
                  type="button"
                  onClick={handleBulkImport}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Import {csvSummary.ready} Candidates →
                </button>
              ) : null}
              {csvPhase === 'complete' ? (
                <button
                  type="button"
                  onClick={() => {
                    onSuccess?.(null);
                    resetForNext(activeTab);
                    onClose();
                  }}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Done
                </button>
              ) : null}
            </div>
          ) : (embeddedBulkCv || activeTab === 'bulkResume') ? (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleDrawerClose}
                title={isBulkResumeBusy ? 'Stop parsing or confirm close' : ''}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {bulkResumePhase === 'complete'
                  ? embeddedBulkCv
                    ? 'Upload more'
                    : 'Done'
                  : 'Cancel'}
              </button>
              {bulkResumePhase === 'preview' ? (
                <button
                  type="button"
                  onClick={handleBulkResumeImport}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  {embeddedBulkCv
                    ? `Parse ${bulkCvStoredEntries.length + bulkResumeFiles.length} CV${bulkCvStoredEntries.length + bulkResumeFiles.length === 1 ? '' : 's'} →`
                    : `Create ${bulkCvStoredEntries.length + bulkResumeFiles.length} Candidates →`}
                </button>
              ) : null}
              {bulkResumePhase === 'importing' ? (
                <button
                  type="button"
                  onClick={handleStopBulkResume}
                  disabled={bulkResumeStopRequested}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition ${
                    bulkResumeStopRequested
                      ? 'cursor-not-allowed bg-red-300'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  <StopCircle size={16} />
                  {bulkResumeStopRequested ? 'Stopping…' : 'Stop parsing'}
                </button>
              ) : null}
              {bulkResumePhase === 'complete' ? (
                <button
                  type="button"
                  onClick={() => {
                    resetForNext(embeddedBulkCv ? 'bulkResume' : activeTab);
                    onSuccess?.(null);
                    if (!embeddedBulkCv) onClose();
                  }}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  {embeddedBulkCv ? 'View summary below' : 'Close'}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              {currentStep === 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (showAiFormStage) {
                      setAiFlowStage('chat');
                      return;
                    }
                    handleDrawerClose();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
                >
                  {showAiFormStage ? (
                    <>
                      <ArrowLeft className="h-4 w-4" />
                      Back to chat
                    </>
                  ) : (
                    'Cancel'
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              )}
              <div className="ml-auto flex flex-wrap items-center gap-3">
                {currentStep < CANDIDATE_FORM_STEPS.length ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!validateStep(currentStep)) return;
                      setCurrentStep((prev) => prev + 1);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#2098C8] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#2098C8]/30 hover:bg-[#1A86B3]"
                  >
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSave('saveAndAddAnother')}
                      disabled={isSaving}
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-60"
                    >
                      Save & Add Another
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSave('save')}
                      disabled={isSaving}
                      className="rounded-xl bg-[#2098C8] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#2098C8]/30 hover:bg-[#1A86B3] disabled:opacity-60"
                    >
                      {isSaving ? 'Submitting...' : 'Create Candidate'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        )
  );
}
