'use client';

import React from 'react';
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
  } = props;

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
