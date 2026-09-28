'use client';

import React from 'react';
import { NotesService } from '../../NotesService';

export function ClientNotesTab(props: any) {
  const {
    client,
  } = props;

  return (
client?.id ? (
                    <NotesService
                      entityType="client"
                      entityId={client.id}
                      availableTags={['Calls', 'WhatsApp', 'Emails']}
                      onNoteCreated={() => {
                        // Optionally refresh client data or show notification
                      }}
                      onNoteUpdated={() => {
                        // Optionally refresh client data or show notification
                      }}
                      onNoteDeleted={() => {
                        // Optionally refresh client data or show notification
                      }}
                    />
                  ) : (
                    <div className="py-8 text-center text-sm text-slate-500">
                      No client selected
                    </div>
                  )
  );
}
