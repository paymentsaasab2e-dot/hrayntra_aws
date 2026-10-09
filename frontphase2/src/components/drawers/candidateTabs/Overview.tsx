'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { EntityWorkspaceAlertsPanel } from '../../ai/EntityWorkspaceAlertsPanel';
import { isPhase1PortalCandidate } from '../../../lib/phase1ProfileSnapshot';
import { CandidatePhase1DetailSections } from '../../candidates/CandidatePhase1DetailSections';
import { CandidateAtsExtractedOverview } from '../../candidates/CandidateAtsExtractedOverview';

export function CandidateOverviewTab(props: any) {
  const {
    candidate,
    candidateEditFormFooter,
    candidateEditFormSections,
    editError,
    onAddToPipeline,
    onUpdateCandidate,
    overviewContentKey,
    setShowAddToPipelineModal,
    showEditModal,
    startOverviewEdit,
    loadingCandidateProfile = false,
  } = props;

  // Wait for full profile hydrate so we don't flash ATS sections → Phase 1 sections
  // when list stub lacks extraData.phase1ProfileSnapshot.
  if (loadingCandidateProfile && !showEditModal) {
    return (
      <div className="flex min-h-[16rem] flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 size={28} className="animate-spin text-blue-600" />
        <p className="text-sm font-medium">Loading candidate details…</p>
      </div>
    );
  }

  return (
<div className="space-y-5">
                    {showEditModal && onUpdateCandidate ? (
                      <>
                        {editError ? (
                          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            {editError}
                          </div>
                        ) : null}
                        {candidateEditFormSections}
                        {candidateEditFormFooter}
                      </>
                    ) : (
                      <>
                        {candidate?.id ? (
                          <>
                            <EntityWorkspaceAlertsPanel
                              entityType="CANDIDATE"
                              entityId={candidate.id}
                              entityLabel={candidate.name || candidate.email || 'Candidate'}
                            />
                          </>
                        ) : null}
                        {isPhase1PortalCandidate(candidate) ? (
                          <CandidatePhase1DetailSections
                            key={overviewContentKey}
                            candidate={candidate}
                            onAssignJob={
                              onAddToPipeline ? () => setShowAddToPipelineModal(true) : undefined
                            }
                            onEditCareerPreferences={
                              onUpdateCandidate ? startOverviewEdit : undefined
                            }
                          />
                        ) : (
                          <CandidateAtsExtractedOverview
                            key={overviewContentKey}
                            candidate={candidate}
                            onAssignJob={
                              onAddToPipeline ? () => setShowAddToPipelineModal(true) : undefined
                            }
                            onEditCareerPreferences={
                              onUpdateCandidate ? startOverviewEdit : undefined
                            }
                          />
                        )}
                      </>
                    )}
                  </div>
  );
}
