'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { generateCodingPreScreenAssessmentWithAi, generateMcqPreScreenAssessmentWithAi } from '../../lib/api';
import { requestError } from '../../lib/appDialog';
import { extractApiData } from '../../lib/mapCandidateProfile';
import type { PreScreenAssessment, PreScreenAssessmentType } from '../../lib/preScreenAssessmentTypes';
import {
  CODING_LANGUAGES,
  type AssessmentConfig,
  type CodingAssessmentConfig,
  type CodingQuestion,
  type EssayAssessmentConfig,
  type McqAssessmentConfig,
  type McqQuestion,
  type QuestionnaireAssessmentConfig,
  type QuestionnaireQuestion,
  type VideoAssessmentConfig,
  countQuestionnaireMcqQuestions,
  defaultConfigForType,
  defaultDurationForType,
  defaultPassScoreForType,
  defaultTitleForType,
  isAntiCheatActive,
  newId,
  parseAssessmentConfig,
  questionnairePassPercentFromCount,
  resolveQuestionnairePassCorrectCount,
} from '../../lib/preScreenAssessmentConfig';
import { AssessmentAntiCheatPanel } from './AssessmentAntiCheatPanel';

const fieldClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400';

const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1';

export type AssessmentDraft = {
  title: string;
  type: PreScreenAssessmentType;
  durationMinutes: number;
  passScorePercent: number;
  config: AssessmentConfig;
};

export function assessmentToDraft(assessment: PreScreenAssessment): AssessmentDraft {
  const type = assessment.type || 'MCQ';
  return {
    title: assessment.title || defaultTitleForType(type),
    type,
    durationMinutes: assessment.durationMinutes ?? defaultDurationForType(type),
    passScorePercent: assessment.passScorePercent ?? defaultPassScoreForType(type),
    config: parseAssessmentConfig(type, assessment.config),
  };
}

export function newAssessmentDraft(type: PreScreenAssessmentType): AssessmentDraft {
  return {
    title: defaultTitleForType(type),
    type,
    durationMinutes: defaultDurationForType(type),
    passScorePercent: defaultPassScoreForType(type),
    config: defaultConfigForType(type),
  };
}

export function draftToPayload(draft: AssessmentDraft) {
  return {
    title: draft.title.trim(),
    type: draft.type,
    durationMinutes: draft.durationMinutes,
    passScorePercent: draft.passScorePercent,
    antiCheatEnabled: isAntiCheatActive(draft.config),
    config: draft.config,
  };
}

function SettingsRow({
  passScorePercent,
  durationMinutes,
  onPassChange,
  onDurationChange,
  disabled,
  showGrading = true,
  questionnairePass = null,
}: {
  passScorePercent: number;
  durationMinutes: number;
  onPassChange: (v: number) => void;
  onDurationChange: (v: number) => void;
  disabled?: boolean;
  showGrading?: boolean;
  /** When set, replaces % marking with “X of Y correct” pass rule. */
  questionnairePass?: {
    passCorrectCount: number;
    mcqTotal: number;
    onPassCorrectChange: (count: number) => void;
  } | null;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <p className="sm:col-span-2 text-sm font-semibold text-slate-800">Settings</p>
      {questionnairePass ? (
        <div className="sm:col-span-2">
          <label className={labelClass}>Correct answers required to pass</label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={questionnairePass.mcqTotal > 0 ? 1 : 0}
              max={Math.max(0, questionnairePass.mcqTotal)}
              className={`${fieldClass} max-w-[7rem]`}
              value={questionnairePass.mcqTotal > 0 ? questionnairePass.passCorrectCount : 0}
              disabled={disabled || questionnairePass.mcqTotal <= 0}
              onChange={(e) => {
                const total = questionnairePass.mcqTotal;
                if (total <= 0) return;
                const next = Math.max(1, Math.min(total, Number(e.target.value) || 1));
                questionnairePass.onPassCorrectChange(next);
              }}
            />
            <span className="text-sm font-medium text-slate-600">
              out of {questionnairePass.mcqTotal} MCQ question
              {questionnairePass.mcqTotal === 1 ? '' : 's'}
            </span>
          </div>
          <p className="mt-1 text-[10px] text-slate-500">
            {questionnairePass.mcqTotal > 0
              ? `Candidate must get at least ${questionnairePass.passCorrectCount} of ${questionnairePass.mcqTotal} MCQ correct to pass. Text answers are not auto-scored.`
              : 'Add at least one MCQ question to set a pass rule.'}
          </p>
        </div>
      ) : showGrading ? (
        <>
          <div>
            <label className={labelClass}>Total test score</label>
            <input
              type="text"
              className={`${fieldClass} bg-slate-100 text-slate-700`}
              value="100%"
              readOnly
              disabled
            />
            <p className="mt-1 text-[10px] text-slate-500">
              Every assessment is scored out of 100%
            </p>
          </div>
          <div>
            <label className={labelClass}>Passing threshold (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              className={fieldClass}
              value={passScorePercent}
              disabled={disabled}
              onChange={(e) => onPassChange(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
            />
            <p className="mt-1 text-[10px] text-slate-500">
              Candidate must score at least {passScorePercent}% to pass; below that is reject
            </p>
          </div>
        </>
      ) : null}
      <div>
        <label className={labelClass}>Time limit (minutes)</label>
        <input
          type="number"
          min={1}
          max={180}
          className={fieldClass}
          value={durationMinutes}
          disabled={disabled}
          onChange={(e) => onDurationChange(Math.max(1, Math.min(180, Number(e.target.value) || 1)))}
        />
      </div>
    </div>
  );
}

const MCQ_AI_QUESTION_COUNT = 5;
const MCQ_REVEAL_MS = 550;

function McqEditor({
  config,
  onChange,
  disabled,
  jobTitle = '',
  skills = [],
  jobDescription = '',
  onAssessmentMetaChange,
  onAiBusyChange,
}: {
  config: McqAssessmentConfig;
  onChange: (c: McqAssessmentConfig) => void;
  disabled?: boolean;
  jobTitle?: string;
  skills?: string[];
  jobDescription?: string;
  onAssessmentMetaChange?: (patch: {
    title?: string;
    durationMinutes?: number;
    passScorePercent?: number;
  }) => void;
  onAiBusyChange?: (busy: boolean) => void;
}) {
  const [aiPhase, setAiPhase] = useState<'idle' | 'loading' | 'revealing' | 'done'>('idle');
  const [revealCount, setRevealCount] = useState(0);
  const pendingQuestionsRef = useRef<McqQuestion[]>([]);
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    onAiBusyChange?.(aiPhase === 'loading' || aiPhase === 'revealing');
  }, [aiPhase, onAiBusyChange]);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) clearInterval(revealTimerRef.current);
    };
  }, []);

  const startReveal = (questions: McqQuestion[], antiCheat: McqAssessmentConfig['antiCheat']) => {
    if (revealTimerRef.current) clearInterval(revealTimerRef.current);
    pendingQuestionsRef.current = questions;
    setAiPhase('revealing');
    setRevealCount(0);
    onChange({ ...configRef.current, questions: [], antiCheat });

    let index = 0;
    revealTimerRef.current = setInterval(() => {
      index += 1;
      const slice = pendingQuestionsRef.current.slice(0, index);
      onChange({ ...configRef.current, questions: slice, antiCheat });
      setRevealCount(index);
      if (index >= questions.length) {
        if (revealTimerRef.current) clearInterval(revealTimerRef.current);
        revealTimerRef.current = null;
        setAiPhase('done');
      }
    }, MCQ_REVEAL_MS);
  };

  const generateWithAi = async () => {
    const role = String(jobTitle || '').trim();
    if (!role) {
      void requestError('Enter a job title first so AI can tailor the MCQ questions.');
      return;
    }
    if (revealTimerRef.current) clearInterval(revealTimerRef.current);

    setAiPhase('loading');
    setRevealCount(0);
    try {
      const res = await generateMcqPreScreenAssessmentWithAi({
        jobTitle: role,
        skills: Array.isArray(skills) ? skills.filter(Boolean) : [],
        jobDescription: String(jobDescription || '').trim() || undefined,
      });
      const generated = extractApiData<{
        title?: string;
        durationMinutes?: number;
        passScorePercent?: number;
        config?: McqAssessmentConfig;
      }>(res);
      const parsedConfig = parseAssessmentConfig('MCQ', generated?.config);
      const questions = (parsedConfig as McqAssessmentConfig).questions || [];
      if (questions.length < 1) {
        throw new Error('AI did not return any questions.');
      }

      onAssessmentMetaChange?.({
        title: generated?.title,
        durationMinutes: generated?.durationMinutes,
        passScorePercent: generated?.passScorePercent,
      });

      startReveal(questions, (parsedConfig as McqAssessmentConfig).antiCheat);
    } catch (err) {
      setAiPhase('idle');
      setRevealCount(0);
      void requestError(err instanceof Error ? err.message : 'Could not generate MCQ questions with AI.');
    }
  };

  const aiBusy = aiPhase === 'loading' || aiPhase === 'revealing';
  const statusLine =
    aiPhase === 'loading'
      ? `AI is generating ${MCQ_AI_QUESTION_COUNT} questions for “${jobTitle.trim()}”…`
      : aiPhase === 'revealing'
        ? `Showing question ${revealCount} of ${pendingQuestionsRef.current.length || MCQ_AI_QUESTION_COUNT}…`
        : aiPhase === 'done'
          ? `${config.questions.length} questions ready — review and click Save assessment.`
          : null;
  const updateQuestion = (index: number, patch: Partial<McqQuestion>) => {
    onChange({
      ...config,
      questions: config.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    });
  };

  const addQuestion = () => {
    const o1 = newId('o');
    const o2 = newId('o');
    onChange({
      ...config,
      questions: [
        ...config.questions,
        {
          id: newId('q'),
          prompt: '',
          options: [
            { id: o1, text: 'Option 1' },
            { id: o2, text: 'Option 2' },
          ],
          correctOptionId: o1,
          marks: 5,
        },
      ],
    });
  };

  const removeQuestion = (index: number) => {
    onChange({ ...config, questions: config.questions.filter((_, i) => i !== index) });
  };

  const addOption = (qIndex: number) => {
    const q = config.questions[qIndex];
    const opt = { id: newId('o'), text: `Option ${q.options.length + 1}` };
    updateQuestion(qIndex, { options: [...q.options, opt] });
  };

  const updateOption = (qIndex: number, oIndex: number, text: string) => {
    const q = config.questions[qIndex];
    updateQuestion(qIndex, {
      options: q.options.map((o, i) => (i === oIndex ? { ...o, text } : o)),
    });
  };

  const removeOption = (qIndex: number, oIndex: number) => {
    const q = config.questions[qIndex];
    if (q.options.length <= 2) return;
    const next = q.options.filter((_, i) => i !== oIndex);
    updateQuestion(qIndex, {
      options: next,
      correctOptionId: next.some((o) => o.id === q.correctOptionId)
        ? q.correctOptionId
        : next[0]?.id || '',
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">Questions</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={disabled || aiBusy}
            onClick={() => void generateWithAi()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-gradient-to-r from-violet-600 to-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50"
          >
            {aiPhase === 'loading' ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {aiPhase === 'loading' ? 'Generating…' : 'Generate with AI'}
          </button>
          <button
            type="button"
            disabled={disabled || aiBusy}
            onClick={addQuestion}
            className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50"
          >
            <Plus className="size-3.5" /> Add question
          </button>
        </div>
      </div>

      {statusLine ? (
        <div
          className={`rounded-lg border px-3 py-2 text-xs ${
            aiPhase === 'done'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-violet-200 bg-violet-50 text-violet-800'
          }`}
        >
          {aiPhase !== 'done' ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="size-3 animate-spin shrink-0" />
              {statusLine}
            </span>
          ) : (
            statusLine
          )}
        </div>
      ) : null}

      {aiPhase === 'loading' ? (
        <div className="space-y-2">
          {Array.from({ length: MCQ_AI_QUESTION_COUNT }).map((_, i) => (
            <div
              key={`mcq-skeleton-${i}`}
              className="rounded-xl border border-dashed border-violet-200 bg-violet-50/50 p-4 animate-pulse"
            >
              <div className="h-3 w-24 rounded bg-violet-200/80 mb-3" />
              <div className="h-10 rounded bg-violet-100/80 mb-2" />
              <div className="space-y-2">
                <div className="h-8 rounded bg-violet-100/60" />
                <div className="h-8 rounded bg-violet-100/60" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {config.questions.map((q, qi) => (
        <div
          key={q.id}
          className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-bold text-violet-700">Question {qi + 1}</p>
            {config.questions.length > 1 ? (
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeQuestion(qi)}
                className="text-rose-500 hover:bg-rose-50 rounded p-1"
              >
                <Trash2 className="size-4" />
              </button>
            ) : null}
          </div>

          <div>
            <label className={labelClass}>Question</label>
            <textarea
              className={`${fieldClass} min-h-[72px]`}
              value={q.prompt}
              disabled={disabled}
              placeholder="What is React?"
              onChange={(e) => updateQuestion(qi, { prompt: e.target.value })}
            />
          </div>

          <div>
            <label className={labelClass}>Options</label>
            <div className="space-y-2">
              {q.options.map((opt, oi) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${q.id}`}
                    checked={q.correctOptionId === opt.id}
                    disabled={disabled}
                    onChange={() => updateQuestion(qi, { correctOptionId: opt.id })}
                    title="Correct answer"
                  />
                  <input
                    className={fieldClass}
                    value={opt.text}
                    disabled={disabled}
                    onChange={(e) => updateOption(qi, oi, e.target.value)}
                  />
                  {q.options.length > 2 ? (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => removeOption(qi, oi)}
                      className="text-slate-400 hover:text-rose-500 p-1"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => addOption(qi)}
              className="mt-2 text-xs text-violet-600 font-medium hover:underline"
            >
              + Add option
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Correct answer</label>
              <select
                className={fieldClass}
                value={q.correctOptionId}
                disabled={disabled}
                onChange={(e) => updateQuestion(qi, { correctOptionId: e.target.value })}
              >
                {q.options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.text || 'Option'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Marks</label>
              <input
                type="number"
                min={1}
                max={100}
                className={fieldClass}
                value={q.marks}
                disabled={disabled}
                onChange={(e) => updateQuestion(qi, { marks: Math.max(1, Number(e.target.value) || 1) })}
              />
            </div>
          </div>
        </div>
      ))}

      {aiPhase === 'revealing' && revealCount < MCQ_AI_QUESTION_COUNT
        ? Array.from({
            length: Math.max(
              0,
              (pendingQuestionsRef.current.length || MCQ_AI_QUESTION_COUNT) - revealCount,
            ),
          }).map((_, i) => (
            <div
              key={`mcq-pending-${i}`}
              className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-4 animate-pulse"
            >
              <div className="h-3 w-28 rounded bg-slate-200 mb-3" />
              <div className="h-10 rounded bg-slate-100 mb-2" />
            </div>
          ))
        : null}
    </div>
  );
}

const CODING_AI_QUESTION_COUNT = 5;
const CODING_REVEAL_MS = 600;

function CodingEditor({
  config,
  onChange,
  disabled,
  jobTitle = '',
  skills = [],
  jobDescription = '',
  onAssessmentMetaChange,
  onAiBusyChange,
}: {
  config: CodingAssessmentConfig;
  onChange: (c: CodingAssessmentConfig) => void;
  disabled?: boolean;
  jobTitle?: string;
  skills?: string[];
  jobDescription?: string;
  onAssessmentMetaChange?: (patch: {
    title?: string;
    durationMinutes?: number;
    passScorePercent?: number;
  }) => void;
  onAiBusyChange?: (busy: boolean) => void;
}) {
  const [aiPhase, setAiPhase] = useState<'idle' | 'loading' | 'revealing' | 'done'>('idle');
  const [revealCount, setRevealCount] = useState(0);
  const pendingQuestionsRef = useRef<CodingQuestion[]>([]);
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  const questions = config.questions || [];
  const multiMode = questions.length > 0;

  useEffect(() => {
    onAiBusyChange?.(aiPhase === 'loading' || aiPhase === 'revealing');
  }, [aiPhase, onAiBusyChange]);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) clearInterval(revealTimerRef.current);
    };
  }, []);

  const patch = (p: Partial<CodingAssessmentConfig>) => onChange({ ...configRef.current, ...p });

  const updateQuestion = (index: number, patchQ: Partial<CodingQuestion>) => {
    const next = (configRef.current.questions || []).map((q, i) =>
      i === index ? { ...q, ...patchQ } : q,
    );
    patch({ questions: next, totalMarks: next.reduce((s, q) => s + (q.marks || 20), 0) });
  };

  const startReveal = (nextQuestions: CodingQuestion[], language: string) => {
    if (revealTimerRef.current) clearInterval(revealTimerRef.current);
    pendingQuestionsRef.current = nextQuestions;
    setAiPhase('revealing');
    setRevealCount(0);
    patch({ questions: [], language, prompt: '', testCases: [] });

    let index = 0;
    revealTimerRef.current = setInterval(() => {
      index += 1;
      const slice = pendingQuestionsRef.current.slice(0, index);
      patch({
        questions: slice,
        language,
        prompt: '',
        testCases: [],
        totalMarks: slice.reduce((s, q) => s + (q.marks || 20), 0),
      });
      setRevealCount(index);
      if (index >= nextQuestions.length) {
        if (revealTimerRef.current) clearInterval(revealTimerRef.current);
        revealTimerRef.current = null;
        setAiPhase('done');
      }
    }, CODING_REVEAL_MS);
  };

  const generateWithAi = async () => {
    const role = String(jobTitle || '').trim();
    if (!role) {
      void requestError('Enter a job title first so AI can tailor the coding questions.');
      return;
    }
    if (revealTimerRef.current) clearInterval(revealTimerRef.current);

    setAiPhase('loading');
    setRevealCount(0);
    try {
      const res = await generateCodingPreScreenAssessmentWithAi({
        jobTitle: role,
        skills: Array.isArray(skills) ? skills.filter(Boolean) : [],
        jobDescription: String(jobDescription || '').trim() || undefined,
      });
      const generated = extractApiData<{
        title?: string;
        durationMinutes?: number;
        passScorePercent?: number;
        config?: CodingAssessmentConfig;
      }>(res);
      const parsedConfig = parseAssessmentConfig('CODING', generated?.config) as CodingAssessmentConfig;
      const nextQuestions = parsedConfig.questions || [];
      if (!nextQuestions.length) {
        throw new Error('AI did not return coding questions.');
      }

      onAssessmentMetaChange?.({
        title: generated?.title,
        durationMinutes: generated?.durationMinutes,
        passScorePercent: generated?.passScorePercent,
      });

      startReveal(nextQuestions, parsedConfig.language || 'javascript');
    } catch (err) {
      setAiPhase('idle');
      setRevealCount(0);
      void requestError(
        err instanceof Error ? err.message : 'Could not generate coding questions with AI.',
      );
    }
  };

  const aiBusy = aiPhase === 'loading' || aiPhase === 'revealing';
  const statusLine =
    aiPhase === 'loading'
      ? `AI is generating ${CODING_AI_QUESTION_COUNT} coding challenges for “${jobTitle.trim()}”…`
      : aiPhase === 'revealing'
        ? `Showing question ${revealCount} of ${pendingQuestionsRef.current.length || CODING_AI_QUESTION_COUNT}…`
        : aiPhase === 'done'
          ? `${questions.length} coding questions ready — review and click Save assessment.`
          : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">
          {multiMode ? 'Coding questions' : 'Coding challenge'}
        </p>
        <button
          type="button"
          disabled={disabled || aiBusy}
          onClick={() => void generateWithAi()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-gradient-to-r from-violet-600 to-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50"
        >
          {aiPhase === 'loading' ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          {aiPhase === 'loading' ? 'Generating…' : 'Generate with AI'}
        </button>
      </div>

      {statusLine ? (
        <div
          className={`rounded-lg border px-3 py-2 text-xs ${
            aiPhase === 'done'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-violet-200 bg-violet-50 text-violet-800'
          }`}
        >
          {aiPhase !== 'done' ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="size-3 animate-spin shrink-0" />
              {statusLine}
            </span>
          ) : (
            statusLine
          )}
        </div>
      ) : null}

      <div>
        <label className={labelClass}>Programming language</label>
        <select
          className={fieldClass}
          value={config.language}
          disabled={disabled || aiBusy}
          onChange={(e) => patch({ language: e.target.value })}
        >
          {CODING_LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      {aiPhase === 'loading' ? (
        <div className="space-y-2">
          {Array.from({ length: CODING_AI_QUESTION_COUNT }).map((_, i) => (
            <div
              key={`coding-skeleton-${i}`}
              className="rounded-xl border border-dashed border-violet-200 bg-violet-50/50 p-4 animate-pulse"
            >
              <div className="h-3 w-32 rounded bg-violet-200/80 mb-3" />
              <div className="h-16 rounded bg-violet-100/80 mb-2" />
              <div className="grid grid-cols-2 gap-2">
                <div className="h-8 rounded bg-violet-100/60" />
                <div className="h-8 rounded bg-violet-100/60" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {multiMode
        ? questions.map((q, qi) => (
            <div
              key={q.id}
              className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <p className="text-xs font-bold text-violet-700">
                Question {qi + 1}
                {q.title ? ` — ${q.title}` : ''}
              </p>

              <div>
                <label className={labelClass}>Title</label>
                <input
                  className={fieldClass}
                  value={q.title}
                  disabled={disabled || aiBusy}
                  onChange={(e) => updateQuestion(qi, { title: e.target.value })}
                />
              </div>

              <div>
                <label className={labelClass}>Problem</label>
                <textarea
                  className={`${fieldClass} min-h-[80px]`}
                  value={q.prompt}
                  disabled={disabled || aiBusy}
                  onChange={(e) => updateQuestion(qi, { prompt: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Sample input</label>
                  <textarea
                    className={`${fieldClass} min-h-[60px] font-mono text-xs`}
                    value={q.sampleInput || ''}
                    disabled={disabled || aiBusy}
                    onChange={(e) => updateQuestion(qi, { sampleInput: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass}>Sample output</label>
                  <textarea
                    className={`${fieldClass} min-h-[60px] font-mono text-xs`}
                    value={q.sampleOutput || ''}
                    disabled={disabled || aiBusy}
                    onChange={(e) => updateQuestion(qi, { sampleOutput: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Expected answer (hidden from candidates)</label>
                <textarea
                  className={`${fieldClass} min-h-[120px] font-mono text-xs`}
                  value={q.expectedAnswer || ''}
                  disabled={disabled || aiBusy}
                  onChange={(e) => updateQuestion(qi, { expectedAnswer: e.target.value })}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelClass}>Test cases</label>
                  <button
                    type="button"
                    disabled={disabled || aiBusy}
                    onClick={() =>
                      updateQuestion(qi, {
                        testCases: [
                          ...q.testCases,
                          { id: newId('tc'), input: '', expected: '' },
                        ],
                      })
                    }
                    className="text-xs text-violet-600 font-semibold hover:underline"
                  >
                    + Add test case
                  </button>
                </div>
                <div className="space-y-2">
                  {q.testCases.map((tc, ti) => (
                    <div
                      key={tc.id}
                      className="rounded-lg border border-slate-200 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2"
                    >
                      <div>
                        <label className="text-[11px] text-slate-500">Input</label>
                        <input
                          className={fieldClass}
                          value={tc.input}
                          disabled={disabled || aiBusy}
                          onChange={(e) =>
                            updateQuestion(qi, {
                              testCases: q.testCases.map((t, i) =>
                                i === ti ? { ...t, input: e.target.value } : t,
                              ),
                            })
                          }
                        />
                      </div>
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="text-[11px] text-slate-500">Expected</label>
                          <input
                            className={fieldClass}
                            value={tc.expected}
                            disabled={disabled || aiBusy}
                            onChange={(e) =>
                              updateQuestion(qi, {
                                testCases: q.testCases.map((t, i) =>
                                  i === ti ? { ...t, expected: e.target.value } : t,
                                ),
                              })
                            }
                          />
                        </div>
                        {q.testCases.length > 1 ? (
                          <button
                            type="button"
                            disabled={disabled || aiBusy}
                            onClick={() =>
                              updateQuestion(qi, {
                                testCases: q.testCases.filter((_, i) => i !== ti),
                              })
                            }
                            className="text-rose-500 p-2"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="max-w-xs">
                <label className={labelClass}>Marks</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  className={fieldClass}
                  value={q.marks ?? 20}
                  disabled={disabled || aiBusy}
                  onChange={(e) =>
                    updateQuestion(qi, { marks: Math.max(1, Number(e.target.value) || 1) })
                  }
                />
              </div>
            </div>
          ))
        : aiPhase !== 'loading' ? (
            <>
              <div>
                <label className={labelClass}>Problem statement</label>
                <textarea
                  className={`${fieldClass} min-h-[100px]`}
                  value={config.prompt}
                  disabled={disabled}
                  placeholder="Write a function to reverse a string"
                  onChange={(e) => patch({ prompt: e.target.value })}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelClass}>Test cases</label>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      patch({
                        testCases: [...config.testCases, { id: newId('tc'), input: '', expected: '' }],
                      })
                    }
                    className="text-xs text-violet-600 font-semibold hover:underline"
                  >
                    + Add test case
                  </button>
                </div>
                <div className="space-y-3">
                  {config.testCases.map((tc, ti) => (
                    <div
                      key={tc.id}
                      className="rounded-lg border border-slate-200 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2"
                    >
                      <div>
                        <label className="text-[11px] text-slate-500">Input</label>
                        <input
                          className={fieldClass}
                          value={tc.input}
                          disabled={disabled}
                          placeholder='"hello"'
                          onChange={(e) =>
                            patch({
                              testCases: config.testCases.map((t, i) =>
                                i === ti ? { ...t, input: e.target.value } : t,
                              ),
                            })
                          }
                        />
                      </div>
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="text-[11px] text-slate-500">Expected</label>
                          <input
                            className={fieldClass}
                            value={tc.expected}
                            disabled={disabled}
                            placeholder='"olleh"'
                            onChange={(e) =>
                              patch({
                                testCases: config.testCases.map((t, i) =>
                                  i === ti ? { ...t, expected: e.target.value } : t,
                                ),
                              })
                            }
                          />
                        </div>
                        {config.testCases.length > 1 ? (
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() =>
                              patch({ testCases: config.testCases.filter((_, i) => i !== ti) })
                            }
                            className="text-rose-500 p-2"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}

      {aiPhase === 'revealing' && revealCount < CODING_AI_QUESTION_COUNT
        ? Array.from({
            length: Math.max(
              0,
              (pendingQuestionsRef.current.length || CODING_AI_QUESTION_COUNT) - revealCount,
            ),
          }).map((_, i) => (
            <div
              key={`coding-pending-${i}`}
              className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-4 animate-pulse"
            >
              <div className="h-3 w-28 rounded bg-slate-200 mb-3" />
              <div className="h-16 rounded bg-slate-100 mb-2" />
            </div>
          ))
        : null}

      <div className="max-w-xs">
        <label className={labelClass}>Allowed attempts</label>
        <input
          type="number"
          min={1}
          max={5}
          className={fieldClass}
          value={config.allowedAttempts}
          disabled={disabled || aiBusy}
          onChange={(e) => patch({ allowedAttempts: Math.max(1, Number(e.target.value) || 1) })}
        />
      </div>
    </div>
  );
}

function EssayEditor({
  config,
  onChange,
  disabled,
}: {
  config: EssayAssessmentConfig;
  onChange: (c: EssayAssessmentConfig) => void;
  disabled?: boolean;
}) {
  const patch = (p: Partial<EssayAssessmentConfig>) => onChange({ ...config, ...p });
  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Question</label>
        <textarea
          className={`${fieldClass} min-h-[88px]`}
          value={config.prompt}
          disabled={disabled}
          onChange={(e) => patch({ prompt: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Minimum words</label>
          <input
            type="number"
            min={0}
            className={fieldClass}
            value={config.minWords}
            disabled={disabled}
            onChange={(e) => patch({ minWords: Math.max(0, Number(e.target.value) || 0) })}
          />
        </div>
        <div>
          <label className={labelClass}>Maximum words</label>
          <input
            type="number"
            min={1}
            className={fieldClass}
            value={config.maxWords}
            disabled={disabled}
            onChange={(e) => patch({ maxWords: Math.max(1, Number(e.target.value) || 1) })}
          />
        </div>
      </div>
    </div>
  );
}

function VideoEditor({
  config,
  onChange,
  disabled,
}: {
  config: VideoAssessmentConfig;
  onChange: (c: VideoAssessmentConfig) => void;
  disabled?: boolean;
}) {
  const patch = (p: Partial<VideoAssessmentConfig>) => onChange({ ...config, ...p });
  const durationMinutes = Math.max(1, Math.round(config.maxDurationSeconds / 60));

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Question</label>
        <textarea
          className={`${fieldClass} min-h-[72px]`}
          value={config.prompt}
          disabled={disabled}
          onChange={(e) => patch({ prompt: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Video duration (minutes)</label>
          <input
            type="number"
            min={1}
            max={30}
            className={fieldClass}
            value={durationMinutes}
            disabled={disabled}
            onChange={(e) =>
              patch({ maxDurationSeconds: Math.max(60, (Number(e.target.value) || 1) * 60) })
            }
          />
        </div>
        <div>
          <label className={labelClass}>Attempts</label>
          <input
            type="number"
            min={1}
            max={5}
            className={fieldClass}
            value={config.maxRetakes}
            disabled={disabled}
            onChange={(e) => patch({ maxRetakes: Math.max(1, Number(e.target.value) || 1) })}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={config.cameraRequired}
            disabled={disabled}
            onChange={(e) => patch({ cameraRequired: e.target.checked })}
          />
          Camera required
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={config.microphoneRequired}
            disabled={disabled}
            onChange={(e) => patch({ microphoneRequired: e.target.checked })}
          />
          Microphone required
        </label>
      </div>
    </div>
  );
}

function QuestionnaireEditor({
  config,
  onChange,
  disabled,
}: {
  config: QuestionnaireAssessmentConfig;
  onChange: (c: QuestionnaireAssessmentConfig) => void;
  disabled?: boolean;
}) {
  const updateQuestions = (questions: QuestionnaireQuestion[]) => {
    const next: QuestionnaireAssessmentConfig = { ...config, questions };
    const mcqTotal = countQuestionnaireMcqQuestions(next);
    if (mcqTotal <= 0) {
      next.passCorrectCount = 0;
    } else {
      const current = resolveQuestionnairePassCorrectCount(next, 70);
      next.passCorrectCount = Math.max(1, Math.min(mcqTotal, current));
    }
    onChange(next);
  };

  const updateQuestion = (index: number, patch: Partial<QuestionnaireQuestion>) => {
    updateQuestions(
      config.questions.map((q, i) => (i === index ? ({ ...q, ...patch } as QuestionnaireQuestion) : q)),
    );
  };

  const addTextQuestion = () => {
    updateQuestions([
      ...config.questions,
      {
        id: newId('q'),
        kind: 'TEXT',
        prompt: '',
        required: true,
        maxLength: 1000,
      },
    ]);
  };

  const addMcqQuestion = () => {
    const o1 = newId('o');
    const o2 = newId('o');
    updateQuestions([
      ...config.questions,
      {
        id: newId('q'),
        kind: 'MCQ',
        prompt: '',
        options: [
          { id: o1, text: 'Option 1' },
          { id: o2, text: 'Option 2' },
        ],
        correctOptionId: o1,
      },
    ]);
  };

  const removeQuestion = (index: number) => {
    if (config.questions.length <= 1) return;
    updateQuestions(config.questions.filter((_, i) => i !== index));
  };

  const addOption = (qIndex: number) => {
    const q = config.questions[qIndex];
    if (q.kind !== 'MCQ') return;
    const opt = { id: newId('o'), text: `Option ${q.options.length + 1}` };
    updateQuestion(qIndex, { options: [...q.options, opt] });
  };

  const updateOption = (qIndex: number, oIndex: number, text: string) => {
    const q = config.questions[qIndex];
    if (q.kind !== 'MCQ') return;
    updateQuestion(qIndex, {
      options: q.options.map((o, i) => (i === oIndex ? { ...o, text } : o)),
    });
  };

  const removeOption = (qIndex: number, oIndex: number) => {
    const q = config.questions[qIndex];
    if (q.kind !== 'MCQ' || q.options.length <= 2) return;
    const next = q.options.filter((_, i) => i !== oIndex);
    updateQuestion(qIndex, {
      options: next,
      correctOptionId: next.some((o) => o.id === q.correctOptionId)
        ? q.correctOptionId
        : next[0]?.id || '',
    });
  };

  const mcqCount = countQuestionnaireMcqQuestions(config);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-800">Questionnaire questions</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Mix open text and MCQ. Each MCQ counts as 1 correct or incorrect — set how many must be
            right to pass in Settings below.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={addTextQuestion}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Plus className="size-3.5" /> Text question
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={addMcqQuestion}
            className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50"
          >
            <Plus className="size-3.5" /> MCQ question
          </button>
        </div>
      </div>

      {mcqCount === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Add at least one MCQ with a correct answer so pass/fail can be decided automatically (e.g.
          4 of 5 correct).
        </p>
      ) : null}

      {config.questions.map((q, qi) => (
        <div
          key={q.id}
          className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-bold text-violet-700">
              Question {qi + 1} · {q.kind === 'MCQ' ? 'MCQ' : 'Text'}
            </p>
            {config.questions.length > 1 ? (
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeQuestion(qi)}
                className="text-rose-500 hover:bg-rose-50 rounded p-1"
              >
                <Trash2 className="size-4" />
              </button>
            ) : null}
          </div>

          <div>
            <label className={labelClass}>Question</label>
            <textarea
              className={`${fieldClass} min-h-[72px]`}
              value={q.prompt}
              disabled={disabled}
              placeholder={
                q.kind === 'MCQ'
                  ? 'Select the correct option…'
                  : 'Ask an open question…'
              }
              onChange={(e) => updateQuestion(qi, { prompt: e.target.value })}
            />
          </div>

          {q.kind === 'TEXT' ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={q.required !== false}
                  disabled={disabled}
                  onChange={(e) => updateQuestion(qi, { required: e.target.checked })}
                />
                Required
              </label>
              <div>
                <label className={labelClass}>Max length</label>
                <input
                  type="number"
                  min={50}
                  max={5000}
                  className={fieldClass}
                  value={q.maxLength ?? 1000}
                  disabled={disabled}
                  onChange={(e) =>
                    updateQuestion(qi, {
                      maxLength: Math.max(50, Math.min(5000, Number(e.target.value) || 1000)),
                    })
                  }
                />
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className={labelClass}>Options (mark the correct answer)</label>
                <div className="space-y-2">
                  {q.options.map((opt, oi) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${q.id}`}
                        checked={q.correctOptionId === opt.id}
                        disabled={disabled}
                        onChange={() => updateQuestion(qi, { correctOptionId: opt.id })}
                        title="Correct answer"
                      />
                      <input
                        className={fieldClass}
                        value={opt.text}
                        disabled={disabled}
                        onChange={(e) => updateOption(qi, oi, e.target.value)}
                      />
                      {q.options.length > 2 ? (
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => removeOption(qi, oi)}
                          className="text-slate-400 hover:text-rose-500 p-1"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => addOption(qi)}
                  className="mt-2 text-xs text-violet-600 font-medium hover:underline"
                >
                  + Add option
                </button>
              </div>
              <div>
                <label className={labelClass}>Correct answer</label>
                <select
                  className={fieldClass}
                  value={q.correctOptionId}
                  disabled={disabled}
                  onChange={(e) => updateQuestion(qi, { correctOptionId: e.target.value })}
                >
                  {q.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.text || 'Option'}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export function AssessmentEditorPanel({
  draft,
  onChange,
  onSave,
  onCancel,
  saving,
  disabled,
  jobTitle = '',
  skills = [],
  jobDescription = '',
}: {
  draft: AssessmentDraft;
  onChange: (draft: AssessmentDraft) => void;
  onSave: () => void;
  onCancel?: () => void;
  saving?: boolean;
  disabled?: boolean;
  jobTitle?: string;
  skills?: string[];
  jobDescription?: string;
}) {
  const [mcqAiBusy, setMcqAiBusy] = useState(false);
  const [codingAiBusy, setCodingAiBusy] = useState(false);
  const patchDraft = (p: Partial<AssessmentDraft>) => onChange({ ...draft, ...p });
  const patchConfig = (config: AssessmentConfig) => onChange({ ...draft, config });
  const saveDisabled = Boolean(
    disabled || saving || (draft.type === 'MCQ' && mcqAiBusy) || (draft.type === 'CODING' && codingAiBusy),
  );

  const typeLabel =
    draft.type === 'MCQ'
      ? 'MCQ test'
      : draft.type === 'QUESTIONNAIRE'
        ? 'Questionnaire'
        : draft.type === 'CODING'
          ? 'Coding test'
          : draft.type === 'ESSAY'
            ? 'Essay test'
            : 'Video test';

  return (
    <div className="rounded-xl border border-violet-200 bg-white p-4 space-y-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <p className="text-sm font-bold text-slate-900">{typeLabel}</p>
        <div className="flex gap-2">
          {onCancel ? (
            <button
              type="button"
              disabled={saving || disabled}
              onClick={onCancel}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            disabled={saveDisabled || !draft.title.trim()}
            onClick={onSave}
            title={mcqAiBusy || codingAiBusy ? 'Wait for AI to finish generating questions' : undefined}
            className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Save assessment
          </button>
        </div>
      </div>

      <div>
        <label className={labelClass}>Assessment name</label>
        <input
          className={fieldClass}
          value={draft.title}
          disabled={disabled}
          placeholder="Frontend Developer Screening"
          onChange={(e) => patchDraft({ title: e.target.value })}
        />
      </div>

      {draft.type === 'MCQ' ? (
        <McqEditor
          config={draft.config as McqAssessmentConfig}
          disabled={disabled}
          jobTitle={jobTitle}
          skills={skills}
          jobDescription={jobDescription}
          onAssessmentMetaChange={(meta) => patchDraft(meta)}
          onAiBusyChange={setMcqAiBusy}
          onChange={(c) => patchConfig(c)}
        />
      ) : null}

      {draft.type === 'QUESTIONNAIRE' ? (
        <QuestionnaireEditor
          config={draft.config as QuestionnaireAssessmentConfig}
          disabled={disabled}
          onChange={(c) => {
            const mcqTotal = countQuestionnaireMcqQuestions(c);
            const passCorrect = resolveQuestionnairePassCorrectCount(c, draft.passScorePercent);
            patchDraft({
              config: {
                ...c,
                passCorrectCount: mcqTotal > 0 ? passCorrect : 0,
              },
              passScorePercent:
                mcqTotal > 0
                  ? questionnairePassPercentFromCount(passCorrect, mcqTotal)
                  : draft.passScorePercent,
            });
          }}
        />
      ) : null}

      {draft.type === 'CODING' ? (
        <CodingEditor
          config={draft.config as CodingAssessmentConfig}
          disabled={disabled}
          jobTitle={jobTitle}
          skills={skills}
          jobDescription={jobDescription}
          onAssessmentMetaChange={(meta) => patchDraft(meta)}
          onAiBusyChange={setCodingAiBusy}
          onChange={(c) => patchConfig(c)}
        />
      ) : null}

      {draft.type === 'ESSAY' ? (
        <EssayEditor
          config={draft.config as EssayAssessmentConfig}
          disabled={disabled}
          onChange={(c) => patchConfig(c)}
        />
      ) : null}

      {draft.type === 'VIDEO' ? (
        <VideoEditor
          config={draft.config as VideoAssessmentConfig}
          disabled={disabled}
          onChange={(c) => patchConfig(c)}
        />
      ) : null}

      <SettingsRow
        passScorePercent={draft.passScorePercent}
        durationMinutes={draft.durationMinutes}
        disabled={disabled}
        showGrading={draft.type !== 'QUESTIONNAIRE'}
        questionnairePass={
          draft.type === 'QUESTIONNAIRE'
            ? {
                mcqTotal: countQuestionnaireMcqQuestions(
                  draft.config as QuestionnaireAssessmentConfig,
                ),
                passCorrectCount: resolveQuestionnairePassCorrectCount(
                  draft.config as QuestionnaireAssessmentConfig,
                  draft.passScorePercent,
                ),
                onPassCorrectChange: (count) => {
                  const cfg = draft.config as QuestionnaireAssessmentConfig;
                  const mcqTotal = countQuestionnaireMcqQuestions(cfg);
                  const next = Math.max(1, Math.min(mcqTotal, count));
                  patchDraft({
                    config: { ...cfg, passCorrectCount: next },
                    passScorePercent: questionnairePassPercentFromCount(next, mcqTotal),
                  });
                },
              }
            : null
        }
        onPassChange={(v) => patchDraft({ passScorePercent: v })}
        onDurationChange={(v) => patchDraft({ durationMinutes: v })}
      />

      <AssessmentAntiCheatPanel
        value={draft.config.antiCheat}
        disabled={disabled}
        showCodingOptions={draft.type === 'CODING'}
        showVideoOptions={draft.type === 'VIDEO'}
        onChange={(antiCheat) =>
          patchConfig({ ...draft.config, antiCheat } as AssessmentConfig)
        }
      />
    </div>
  );
}
