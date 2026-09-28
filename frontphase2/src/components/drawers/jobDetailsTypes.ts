/** Shared job detail constants and types used by the drawer shell and tabs. */
export type JobNoteTag = 'JD' | 'Requirements' | 'Feedback' | 'Hiring' | 'Other';
export interface JobNote {
  id: string;
  title: string;
  content?: string;
  tags: JobNoteTag[];
  createdBy: { name: string; avatar?: string };
  createdAt: string;
  isPinned?: boolean;
}

const JOB_NOTE_TAG_STYLES: Record<JobNoteTag, string> = {
  JD: 'bg-blue-100 text-blue-700 border-blue-200',
  Requirements: 'bg-violet-100 text-violet-700 border-violet-200',
  Feedback: 'bg-amber-100 text-amber-700 border-amber-200',
  Hiring: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Other: 'bg-slate-100 text-slate-600 border-slate-200',
};

export type JobFileType = 'JD' | 'Contract' | 'Offer Letter' | 'Policy' | 'Resume' | 'Other';
export interface JobFile {
  id: string;
  fileName: string;
  fileType: JobFileType;
  uploadedBy: { name: string; avatar?: string };
  uploadDate: string;
}

const JOB_FILE_TYPE_BADGE_STYLES: Record<JobFileType, string> = {
  JD: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  Contract: 'bg-blue-100 text-blue-700 border-blue-200',
  'Offer Letter': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Policy: 'bg-amber-100 text-amber-700 border-amber-200',
  Resume: 'bg-slate-100 text-slate-700 border-slate-200',
  Other: 'bg-slate-100 text-slate-600 border-slate-200',
};

const MOCK_JOB_NOTES: Record<string, JobNote[]> = {
  default: [
    { id: 'jn1', title: 'JD review with hiring manager', content: 'Clarified must-have vs nice-to-have skills. Remote OK.', tags: ['JD', 'Requirements'], createdBy: { name: 'Alex Thompson', avatar: 'https://images.unsplash.com/photo-1701463387028-3947648f1337?q=80&w=150' }, createdAt: 'Mar 5, 2026, 10:30 AM', isPinned: true },
    { id: 'jn2', title: 'Feedback on shortlisted candidates', content: 'Tech lead liked 2 of 5. Requested one more round.', tags: ['Feedback'], createdBy: { name: 'Sarah Chen' }, createdAt: 'Mar 4, 2026, 2:00 PM', isPinned: false },
    { id: 'jn3', title: 'Offer approval', content: 'Comp approved. Start date aligned to Apr 1.', tags: ['Hiring'], createdBy: { name: 'Alex Thompson', avatar: 'https://images.unsplash.com/photo-1701463387028-3947648f1337?q=80&w=150' }, createdAt: 'Mar 3, 2026, 5:00 PM', isPinned: true },
  ],
};

export { JOB_NOTE_TAG_STYLES, JOB_FILE_TYPE_BADGE_STYLES, MOCK_JOB_NOTES };
