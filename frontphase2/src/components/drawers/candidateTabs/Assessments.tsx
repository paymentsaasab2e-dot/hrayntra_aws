'use client';

import React from 'react';
import { CandidateAssessmentsTabPanel } from '../../candidates/CandidateAssessmentsTabPanel';

export function CandidateAssessmentsTab(props: any) {
  const {
    activeTab,
    candidate,
    preferredAssessmentJobId,
  } = props;

  return (
<CandidateAssessmentsTabPanel
                    candidateId={candidate.id}
                    preferredJobId={preferredAssessmentJobId}
                    enabled={activeTab === 'Assessments'}
                  />
  );
}
