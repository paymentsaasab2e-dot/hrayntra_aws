'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import {
  getApplicationAssessmentResults,
  gradeAssessmentSession,
} from '../../lib/api';
import { requestError, requestInfo } from '../../lib/appDialog';

export type ReviewContent =
  | {
      kind: 'MCQ';
      items: Array<{
        id: string;
        index: number;
        prompt: string;
        options: Array<{ id: string; text: string; correct?: boolean }>;
        correctOptionId?: string;
      }>;
    }
  | {
      kind: 'QUESTIONNAIRE';
      items: Array<{
        id: string;
        index: number;
        kind: 'TEXT' | 'MCQ';
        prompt: string;
        options?: Array<{ id: string; text: string; correct?: boolean }>;
        correctOptionId?: string;
      }>;
    }
  | {
      kind: 'CODING';
      multi?: boolean;
      prompt?: string;
      language?: string;
      testCases?: Array<{ input?: unknown; expected?: unknown }>;
      items?: Array<{
        id: string;
        index: number;
        title?: string;
        prompt: string;
        sampleInput?: string;
        sampleOutput?: string;
        expectedAnswer?: string;
        marks?: number | null;
        testCases?: Array<{ input?: unknown; expected?: unknown }>;
      }>;
    }
  | { kind: 'ESSAY'; prompt: string; minWords?: number | null; maxWords?: number | null }
  | { kind: 'VIDEO'; prompt: string; maxDurationSeconds?: number | null };

export type AssessmentResult = {
  sessionId?: string;
  jobAssessmentId?: string;
  assessmentId?: string;
  title?: string;
  type?: string;
  status?: string;
  scorePercent?: number | null;
  tabSwitchCount?: number;
  flagged?: boolean;
  submittedAt?: string;
  description?: string | null;
  answers?: Record<string, unknown> | null;
  reviewContent?: ReviewContent | null;
};

function AnswerBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-800">
        {children}
      </div>
    </div>
  );
}

function ReviewQuestionAnswer({ row }: { row: AssessmentResult }) {
  const type = String(row.type || '').toUpperCase();
  const content = row.reviewContent;
  const answers = row.answers && typeof row.answers === 'object' ? row.answers : {};
  const answerText = extractAnswerText(row);

  if (type === 'MCQ' && content?.kind === 'MCQ') {
    return (
      <div className="space-y-3">
        {content.items.map((q) => {
          const pickedId = String(answers[q.id] ?? '');
          const picked = q.options.find((o) => o.id === pickedId);
          const correct = q.options.find((o) => o.correct);
          const isCorrect = pickedId && pickedId === q.correctOptionId;
          return (
            <div key={q.id} className="rounded-md border border-slate-200 bg-white p-2">
              <p className="text-xs font-medium text-slate-800">
                {q.index}. {q.prompt}
              </p>
              <p className="mt-1.5 text-[10px] font-semibold uppercase text-slate-500">Candidate answer</p>
              <p className={`text-xs ${isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
                {picked?.text || '(No answer)'}
                {pickedId ? (isCorrect ? ' ✓' : ' ✗') : ''}
              </p>
              {!isCorrect && correct ? (
                <p className="mt-1 text-xs text-slate-500">Correct: {correct.text}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  if (type === 'QUESTIONNAIRE' && content?.kind === 'QUESTIONNAIRE') {
    return (
      <div className="space-y-3">
        {content.items.map((q) => {
          if (q.kind === 'MCQ') {
            const options = q.options || [];
            const pickedId = String(answers[q.id] ?? '');
            const picked = options.find((o) => o.id === pickedId);
            const correct = options.find((o) => o.correct);
            const isCorrect = pickedId && pickedId === q.correctOptionId;
            return (
              <div key={q.id} className="rounded-md border border-slate-200 bg-white p-2">
                <p className="text-xs font-medium text-slate-800">
                  {q.index}. {q.prompt}{' '}
                  <span className="text-[10px] font-normal text-slate-500">(MCQ)</span>
                </p>
                <p className="mt-1.5 text-[10px] font-semibold uppercase text-slate-500">
                  Candidate answer
                </p>
                <p className={`text-xs ${isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {picked?.text || '(No answer)'}
                  {pickedId ? (isCorrect ? ' ✓' : ' ✗') : ''}
                </p>
                {!isCorrect && correct ? (
                  <p className="mt-1 text-xs text-slate-500">Correct: {correct.text}</p>
                ) : null}
              </div>
            );
          }
          return (
            <div key={q.id} className="rounded-md border border-slate-200 bg-white p-2">
              <p className="text-xs font-medium text-slate-800">
                {q.index}. {q.prompt}{' '}
                <span className="text-[10px] font-normal text-slate-500">(Text)</span>
              </p>
              <AnswerBlock label="Candidate answer">
                {String(answers[q.id] ?? '').trim() || '(No answer)'}
              </AnswerBlock>
            </div>
          );
        })}
      </div>
    );
  }

  if (type === 'CODING' && content?.kind === 'CODING') {
    if (content.multi && content.items?.length) {
      return (
        <div className="space-y-3">
          {content.items.map((q) => {
            const candidateCode = String(answers[q.id] ?? '').trim();
            return (
              <div key={q.id} className="rounded-md border border-slate-200 bg-white p-2 space-y-2">
                <p className="text-xs font-medium text-slate-800">
                  {q.index}. {q.title || 'Coding question'}
                </p>
                <AnswerBlock label="Problem">{q.prompt}</AnswerBlock>
                {q.sampleInput || q.sampleOutput ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.sampleInput ? (
                      <AnswerBlock label="Sample input">{q.sampleInput}</AnswerBlock>
                    ) : null}
                    {q.sampleOutput ? (
                      <AnswerBlock label="Sample output">{q.sampleOutput}</AnswerBlock>
                    ) : null}
                  </div>
                ) : null}
                {q.testCases?.length ? (
                  <ul className="text-[11px] text-slate-600 space-y-1">
                    {q.testCases.map((tc, i) => (
                      <li key={i}>
                        Test {i + 1}: input {String(tc.input ?? '—')} → expected{' '}
                        {String(tc.expected ?? '—')}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <AnswerBlock label="Candidate answer">
                  {candidateCode || '(No code submitted)'}
                </AnswerBlock>
                {q.expectedAnswer ? (
                  <AnswerBlock label="Expected answer (reference)">{q.expectedAnswer}</AnswerBlock>
                ) : null}
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <AnswerBlock label="Question / problem">
          {content.prompt || row.description || '(No prompt configured)'}
          {content.language ? (
            <p className="mt-2 text-[10px] text-slate-500">Language: {content.language}</p>
          ) : null}
          {content.testCases?.length ? (
            <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-600">
              {content.testCases.map((tc, i) => (
                <li key={i}>
                  Test {i + 1}: input {String(tc.input ?? '—')} → expected {String(tc.expected ?? '—')}
                </li>
              ))}
            </ul>
          ) : null}
        </AnswerBlock>
        <AnswerBlock label="Candidate answer">{answerText || '(No code submitted)'}</AnswerBlock>
      </div>
    );
  }

  if ((type === 'ESSAY' || type === 'VIDEO') && content && (content.kind === 'ESSAY' || content.kind === 'VIDEO')) {
    return (
      <div className="space-y-2">
        <AnswerBlock label="Question / prompt">
          <>
            {content.prompt || row.description || '(No prompt configured)'}
            {content.kind === 'ESSAY' && (content.minWords || content.maxWords) ? (
              <p className="mt-2 text-[10px] text-slate-500">
                Word limit: {content.minWords ?? '—'} – {content.maxWords ?? '—'}
              </p>
            ) : null}
          </>
        </AnswerBlock>
        <AnswerBlock label="Candidate answer">{answerText || '(No response submitted)'}</AnswerBlock>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {row.description ? <AnswerBlock label="Question / prompt">{row.description}</AnswerBlock> : null}
      <AnswerBlock label="Candidate answer">{answerText || '(No response submitted)'}</AnswerBlock>
    </div>
  );
}

function extractAnswerText(row: AssessmentResult): string {
  const answers = row.answers;
  if (!answers || typeof answers !== 'object') return '';
  const review = answers._review;
  if (review && typeof review === 'object') {
    // keep _review separate from display body
  }
  if (typeof answers.essay === 'string') return answers.essay;
  if (typeof answers.code === 'string') return answers.code;
  if (typeof answers.videoNote === 'string') return answers.videoNote;
  const textKeys = Object.keys(answers).filter((k) => !k.startsWith('_'));
  const hasLongValues = textKeys.some((k) => String(answers[k] ?? '').includes('\n') || String(answers[k] ?? '').length > 40);
  if (textKeys.length && hasLongValues) {
    return textKeys.map((k) => `${k}:\n${String(answers[k] ?? '—')}`).join('\n\n');
  }
  return '';
}

export function isPendingReview(row: AssessmentResult): boolean {
  const type = String(row.type || '').toUpperCase();
  if (type === 'MCQ') return false;
  if (type === 'QUESTIONNAIRE' && row.scorePercent != null) return false;
  return row.scorePercent == null && row.status === 'SUBMITTED';
}

export function AssessmentStatusSummary({ row }: { row: AssessmentResult | null }) {
  if (!row) {
    return <span className="text-slate-400">Not started</span>;
  }
  const pending = isPendingReview(row);
  if (row.scorePercent != null) {
    return (
      <span className="font-semibold text-violet-700">
        Score {Math.round(row.scorePercent)}%
        {row.scorePercent >= 60 ? ' · Pass' : ' · Fail'}
      </span>
    );
  }
  if (pending) {
    return <span className="text-amber-700">Needs review</span>;
  }
  if (row.status === 'SUBMITTED') {
    return <span className="text-slate-500">Submitted</span>;
  }
  return <span className="text-slate-400">{row.status || '—'}</span>;
}

export function AssessmentReviewRow({
  row,
  onGraded,
}: {
  row: AssessmentResult;
  onGraded: (updated: AssessmentResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [customScore, setCustomScore] = useState('70');
  const [grading, setGrading] = useState(false);
  const sessionId = String(row.sessionId || '').trim();
  const pending = isPendingReview(row);
  const type = String(row.type || '').toUpperCase();

  const submitGrade = async (scorePercent: number) => {
    if (!sessionId) return;
    setGrading(true);
    try {
      const res = await gradeAssessmentSession(sessionId, {
        scorePercent,
        reviewNote: note.trim() || undefined,
      });
      const updated = (res?.data || res) as AssessmentResult;
      onGraded({ ...row, ...updated, sessionId });
      void requestInfo(scorePercent >= 60 ? 'Marked as pass.' : 'Marked as fail.');
      setOpen(false);
    } catch (e) {
      void requestError(e instanceof Error ? e.message : 'Could not save grade');
    } finally {
      setGrading(false);
    }
  };

  return (
    <li className="rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-1.5">
      <button
        type="button"
        className="flex w-full items-start gap-1 text-left text-xs text-slate-700"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDown className="size-3.5 shrink-0 mt-0.5 text-slate-400" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 mt-0.5 text-slate-400" />
        )}
        <span className="min-w-0 flex-1">
          <span className="font-medium">{row.title || 'Assessment'}</span>
          {row.scorePercent != null ? (
            <span className="ml-1 font-semibold text-violet-700">
              · Score {Math.round(row.scorePercent)}%
              {row.scorePercent >= 60 ? ' · Pass' : ' · Fail'}
            </span>
          ) : pending ? (
            <span className="ml-1 text-amber-700">· Needs review</span>
          ) : row.status ? (
            <span className="ml-1 text-slate-500">· {row.status}</span>
          ) : null}
          {row.flagged ? (
            <span className="ml-1 inline-flex items-center gap-0.5 text-amber-700">
              <AlertTriangle className="size-3" /> flagged ({row.tabSwitchCount ?? 0} tab switches)
            </span>
          ) : null}
        </span>
      </button>

      {open ? (
        <div className="mt-2 space-y-2 border-t border-slate-200 pt-2 pl-5">
          <ReviewQuestionAnswer row={row} />

          {type !== 'MCQ' ? (
            <div className="space-y-2">
              <textarea
                className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs"
                rows={2}
                placeholder="Reviewer note (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={grading}
                  onClick={() => void submitGrade(100)}
                  className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Pass (100%)
                </button>
                <button
                  type="button"
                  disabled={grading}
                  onClick={() => void submitGrade(0)}
                  className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Fail (0%)
                </button>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={customScore}
                  onChange={(e) => setCustomScore(e.target.value)}
                  className="w-14 rounded-md border border-slate-200 px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  disabled={grading}
                  onClick={() => {
                    const n = Number(customScore);
                    if (!Number.isFinite(n) || n < 0 || n > 100) {
                      void requestError('Enter a score between 0 and 100');
                      return;
                    }
                    void submitGrade(n);
                  }}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
                >
                  {grading ? 'Saving…' : pending ? 'Set score' : 'Update score'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function ApplicationAssessmentResults({ applicationId }: { applicationId: string }) {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<AssessmentResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getApplicationAssessmentResults(applicationId);
      const rows = Array.isArray(res?.data) ? res.data : [];
      setResults(rows as AssessmentResult[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load assessment results');
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
        <Loader2 className="size-3 animate-spin" /> Assessments…
      </span>
    );
  }

  if (error) {
    return <span className="text-xs text-rose-600">{error}</span>;
  }

  if (!results.length) {
    return <span className="text-xs text-slate-400">No assessments submitted</span>;
  }

  return (
    <ul className="mt-1 space-y-1.5">
      {results.map((row) => (
        <AssessmentReviewRow
          key={row.sessionId || row.title}
          row={row}
          onGraded={(updated) => {
            setResults((prev) =>
              prev.map((r) => (r.sessionId === updated.sessionId ? { ...r, ...updated } : r)),
            );
          }}
        />
      ))}
    </ul>
  );
}
