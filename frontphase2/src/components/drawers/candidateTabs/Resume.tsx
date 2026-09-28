'use client';

import React from 'react';
import { CandidateResumeTabPanel } from '../../candidates/CandidateResumeTabPanel';

export function CandidateResumeTab(props: any) {
  const {
    activeTab,
    candidate,
    cvEditor,
    onRefreshCandidate,
    resumeTabViewPreference,
    saasaCv,
    setResumeTabViewPreference,
    setToastMessage,
  } = props;

  return (
<div className="flex h-[calc(100vh-18rem)] min-h-[560px] flex-col">
                    <CandidateResumeTabPanel
                      candidate={candidate}
                      enabled={activeTab === 'Resume'}
                      cvEditor={cvEditor}
                      preferredResumeViewMode={resumeTabViewPreference}
                      onPreferredResumeViewModeChange={setResumeTabViewPreference}
                      saasaSavedFileUrl={saasaCv.stored?.fileUrl ?? null}
                      onOpenSaasaCv={() => saasaCv.openModal()}
                      onToast={(message: any) => setToastMessage(message)}
                      onCandidateUpdated={
                        onRefreshCandidate
                          ? () => onRefreshCandidate(candidate.id)
                          : undefined
                      }
                    />
                  </div>
  );
}
