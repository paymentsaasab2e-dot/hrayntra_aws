'use client';

import React from 'react';
import { DrawerSectionCard } from '../drawerFormUi';
import { MessageSquareText } from 'lucide-react';
import { InternalNotesSection } from '../candidateProfileShared';

export function CandidateRemarksTab(props: any) {
  const {
    candidate,
    fallbackCurrentUser,
    onAddNote,
    onDeleteNote,
    onEditNote,
    onPinNote,
  } = props;

  return (
<DrawerSectionCard
                    title="Remarks"
                    subtitle="Internal notes and comments"
                    icon={MessageSquareText}
                    accent="rose"
                  >
                    <InternalNotesSection
                    notes={candidate.notes || []}
                    candidateId={candidate.id}
                    currentUser={fallbackCurrentUser}
                    onAddNote={onAddNote}
                    onEditNote={onEditNote}
                    onDeleteNote={onDeleteNote}
                    onPinNote={onPinNote}
                  />
                  </DrawerSectionCard>
  );
}
