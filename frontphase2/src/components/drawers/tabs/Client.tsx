'use client';

import React from 'react';
import { DrawerSectionCard } from '../drawerFormUi';
import { Building2 } from 'lucide-react';
import { JobClientRemarksTab } from '../../jobs/JobClientRemarksTab';
import type { ClientTabProps } from '../jobDrawerTabProps';

export function ClientTab(props: ClientTabProps) {
  const {
    clientRemarkCandidates,
    clientRemarksClientName,
    clientRemarksError,
    displayJobCandidates,
    job,
    loadingClientRemarks,
    mapJobCandidateToTableRow,
    onViewCandidateProfile,
  } = props;

  return (
<DrawerSectionCard
                  title="Client"
                  subtitle={`Submitted candidates for ${clientRemarksClientName || job.client || 'the client'}. Click a name to see comments and uploads.`}
                  icon={Building2}
                  accent="violet"
                >
                  <JobClientRemarksTab
                    loading={loadingClientRemarks}
                    error={clientRemarksError}
                    clientName={clientRemarksClientName || job.client}
                    candidates={clientRemarkCandidates}
                    onViewCandidate={
                      onViewCandidateProfile
                        ? (candidateId: any) => {
                            const fromJob = displayJobCandidates.find((row: any) => row.id === candidateId);
                            if (fromJob) {
                              onViewCandidateProfile(
                                mapJobCandidateToTableRow(fromJob, job.title, job.id),
                              );
                              return;
                            }
                            const fromRemarks = clientRemarkCandidates.find(
                              (row: any) => row.candidateId === candidateId,
                            );
                            onViewCandidateProfile(
                              mapJobCandidateToTableRow(
                                {
                                  id: candidateId,
                                  candidateName: fromRemarks?.candidateName || 'Candidate',
                                  email: fromRemarks?.email || undefined,
                                  avatar: fromRemarks?.avatar || null,
                                  currentStage: '',
                                  score: '',
                                  recruiter: '',
                                  interviewStatus: '',
                                  lastActivity: '',
                                },
                                job.title,
                                job.id,
                              ),
                            );
                          }
                        : undefined
                    }
                  />
                </DrawerSectionCard>
  );
}
