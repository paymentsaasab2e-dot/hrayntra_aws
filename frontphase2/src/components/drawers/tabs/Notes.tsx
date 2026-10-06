'use client';

import React from 'react';
import { DrawerSectionCard } from '../drawerFormUi';
import { StickyNote } from 'lucide-react';
import { NotesService } from '../../NotesService';
import type { NotesTabProps } from '../jobDrawerTabProps';

export function NotesTab(props: NotesTabProps) {
  const {
    job,
  } = props;

  return (
job?.id ? (
                  <DrawerSectionCard
                    title="Notes"
                    subtitle="Calls, WhatsApp, and email notes for this job"
                    icon={StickyNote}
                    accent="rose"
                  >
                    <NotesService
                      entityType="job"
                      entityId={job.id}
                      availableTags={['Calls', 'WhatsApp', 'Emails']}
                      onNoteCreated={() => {
                        // Optionally refresh job data or show notification
                      }}
                      onNoteUpdated={() => {
                        // Optionally refresh job data or show notification
                      }}
                      onNoteDeleted={() => {
                        // Optionally refresh job data or show notification
                      }}
                    />
                  </DrawerSectionCard>
                ) : (
                  <div className="py-8 text-center text-sm text-slate-500">
                    No job selected
                  </div>
                )
  );
}
