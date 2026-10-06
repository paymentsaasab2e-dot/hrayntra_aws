'use client';

import React from 'react';
import { HqLeadRemarksPanel } from '../../hq/HqLeadRemarksPanel';
import { NotesService } from '../../NotesService';

export function LeadNotesTab(props: any) {
  const {
    isHqOverrideMode,
    lead,
    onUpdateLead,
  } = props;

  return (
lead?.id ? (
                  isHqOverrideMode ? (
                    <HqLeadRemarksPanel
                      leadId={lead.id}
                      remarks={lead.hqRemarks || []}
                      onUpdated={() => onUpdateLead?.()}
                    />
                  ) : (
                  <NotesService
                    entityType="lead"
                    entityId={lead.id}
                    availableTags={['Calls', 'WhatsApp', 'Emails']}
                    onNoteCreated={() => {
                      // Optionally refresh lead data or show notification
                    }}
                    onNoteUpdated={() => {
                      // Optionally refresh lead data or show notification
                    }}
                    onNoteDeleted={() => {
                      // Optionally refresh lead data or show notification
                    }}
                  />
                  )
                ) : (
                  <div className="py-8 text-center text-sm text-slate-500">
                    No lead selected
                  </div>
                )
  );
}
