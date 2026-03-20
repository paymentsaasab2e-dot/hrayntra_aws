import React, { useState } from 'react';
import type { InterviewNote } from '../../types/interview.types';

interface DrawerNotesTabProps {
  notes: InterviewNote[];
  onAddNote: (text: string) => Promise<void>;
}

export function DrawerNotesTab({ notes, onAddNote }: DrawerNotesTabProps) {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {notes.map((note) => (
          <div key={note.id} className="rounded-xl border border-[#E5E7EB] p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-[#2563EB]">
                {note.avatar}
              </div>
              <div>
                <div className="text-sm font-semibold text-[#111827]">{note.author}</div>
                <div className="text-xs text-[#6B7280]">{note.timestamp}</div>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#374151]">{note.text}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#E5E7EB] p-4">
        <label className="text-sm font-semibold text-[#111827]">Add Internal Note</label>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={4}
          className="mt-3 w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none focus:border-[#2563EB]"
          placeholder="Add context for the recruiting team..."
        />
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={async () => {
              setIsSubmitting(true);
              try {
                await onAddNote(text);
                setText('');
              } finally {
                setIsSubmitting(false);
              }
            }}
            disabled={isSubmitting}
            className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Adding...' : 'Add Note'}
          </button>
        </div>
      </div>
    </div>
  );
}
