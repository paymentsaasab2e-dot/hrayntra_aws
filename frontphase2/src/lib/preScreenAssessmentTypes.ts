export type PreScreenAssessmentType = 'MCQ' | 'CODING' | 'ESSAY' | 'VIDEO';
export type AssessmentSessionTiming = 'AFTER_APPLY' | 'BEFORE_SUBMIT';

export interface McqOption {
  id: string;
  text: string;
}

export interface McqQuestion {
  id: string;
  prompt: string;
  options: McqOption[];
  correctOptionId: string;
  marks?: number;
}

export interface PreScreenAssessment {
  id: string;
  title: string;
  type: PreScreenAssessmentType;
  description?: string | null;
  durationMinutes: number;
  passScorePercent?: number | null;
  antiCheatEnabled: boolean;
  config: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface JobPreScreenAssessmentLink {
  id?: string;
  assessmentId: string;
  sortOrder: number;
  required: boolean;
  timing: AssessmentSessionTiming;
  durationOverrideMinutes?: number | null;
  passScoreOverridePercent?: number | null;
  assessment?: PreScreenAssessment;
}

export const ASSESSMENT_TYPE_LABELS: Record<PreScreenAssessmentType, string> = {
  MCQ: 'MCQ',
  CODING: 'Coding',
  ESSAY: 'Essay',
  VIDEO: 'Video',
};
