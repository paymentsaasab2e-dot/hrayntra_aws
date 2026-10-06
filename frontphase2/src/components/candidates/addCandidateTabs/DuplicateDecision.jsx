'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';

export function AddCandidateDuplicateDecisionBlock(props) {
  const {
    closeDuplicateDecision,
    duplicateDecision,
    handleSave,
  } = props;

  return (
duplicateDecision ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/40 px-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-amber-100 p-2 text-amber-700">
                  <AlertCircle size={18} />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-slate-900">Duplicate Candidate Found</h3>
                  <p className="mt-1 text-sm text-slate-600">{duplicateDecision.message}</p>
                  {duplicateDecision.candidate ? (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      <p className="font-medium text-slate-900">{duplicateDecision.candidate.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {duplicateDecision.candidate.currentTitle || 'Candidate'} at{' '}
                        {duplicateDecision.candidate.currentCompany || 'Unknown Company'} ({duplicateDecision.candidate.stage || 'Applied'})
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-2">
                <button
                  type="button"
                  disabled={!duplicateDecision.canCreateAnyway}
                  onClick={() => {
                    const nextMode = duplicateDecision.mode || 'save';
                    closeDuplicateDecision();
                    if (duplicateDecision.canCreateAnyway) {
                      handleSave(nextMode, 'createAnyway');
                    }
                  }}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
                    duplicateDecision.canCreateAnyway
                      ? 'bg-amber-500 text-white'
                      : 'cursor-not-allowed bg-slate-100 text-slate-400'
                  }`}
                >
                  Create Anyway
                </button>
                <button
                  type="button"
                  onClick={() => closeDuplicateDecision()}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"
                >
                  Duplicate Found Still Continue
                </button>
                <button
                  type="button"
                  disabled={!duplicateDecision.canUpdate}
                  onClick={() => {
                    const nextMode = duplicateDecision.mode || 'save';
                    closeDuplicateDecision();
                    if (duplicateDecision.canUpdate) {
                      handleSave(nextMode, 'updateExisting');
                    }
                  }}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
                    duplicateDecision.canUpdate
                      ? 'bg-slate-900 text-white'
                      : 'cursor-not-allowed bg-slate-100 text-slate-400'
                  }`}
                >
                  Update Existing
                </button>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                Duplicates are detected by email only. Create Anyway saves a copy with the same email from the CV.
              </p>
            </div>
          </div>
        ) : null
  );
}
