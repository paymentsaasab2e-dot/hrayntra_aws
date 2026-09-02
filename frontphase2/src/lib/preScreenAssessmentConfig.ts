import type { PreScreenAssessmentType } from './preScreenAssessmentTypes';

export interface AntiCheatSettings {
  detectTabSwitch: boolean;
  maxTabSwitches: number;
  detectCopyPaste: boolean;
  disableCopyPaste: boolean;
  disableRightClick: boolean;
  fullScreenRequired: boolean;
  recordScreen: boolean;
  webcamMonitoring: boolean;
}

export interface McqOption {
  id: string;
  text: string;
}

export interface McqQuestion {
  id: string;
  prompt: string;
  options: McqOption[];
  correctOptionId: string;
  marks: number;
}

export interface McqAssessmentConfig {
  questions: McqQuestion[];
  antiCheat: AntiCheatSettings;
}

export interface CodingTestCase {
  id: string;
  input: string;
  expected: string;
}

export interface CodingQuestion {
  id: string;
  title: string;
  prompt: string;
  sampleInput?: string;
  sampleOutput?: string;
  /** Reference solution — hidden from candidates, shown to recruiters. */
  expectedAnswer?: string;
  testCases: CodingTestCase[];
  marks?: number;
}

export interface CodingAssessmentConfig {
  language: string;
  /** Legacy single-problem prompt (used when `questions` is empty). */
  prompt: string;
  testCases: CodingTestCase[];
  /** Multi-question coding assessment (5 questions when AI-generated). */
  questions?: CodingQuestion[];
  allowedAttempts: number;
  /** Total marks for manual grading (default 100). */
  totalMarks?: number;
  antiCheat: AntiCheatSettings;
}

export interface EssayAssessmentConfig {
  prompt: string;
  minWords: number;
  maxWords: number;
  /** Total marks for manual grading (default 100). */
  totalMarks?: number;
  antiCheat: AntiCheatSettings;
}

export interface VideoAssessmentConfig {
  prompt: string;
  maxDurationSeconds: number;
  maxRetakes: number;
  cameraRequired: boolean;
  microphoneRequired: boolean;
  /** Total marks for manual grading (default 100). */
  totalMarks?: number;
  antiCheat: AntiCheatSettings;
}

export type QuestionnaireQuestionKind = 'TEXT' | 'MCQ';

export interface QuestionnaireTextQuestion {
  id: string;
  kind: 'TEXT';
  prompt: string;
  required?: boolean;
  maxLength?: number;
}

export interface QuestionnaireMcqQuestion {
  id: string;
  kind: 'MCQ';
  prompt: string;
  options: McqOption[];
  correctOptionId: string;
  /** @deprecated Questionnaire uses equal weight (1 each); kept for legacy payloads. */
  marks?: number;
}

export type QuestionnaireQuestion = QuestionnaireTextQuestion | QuestionnaireMcqQuestion;

export interface QuestionnaireAssessmentConfig {
  questions: QuestionnaireQuestion[];
  /**
   * How many MCQ answers must be correct to pass (e.g. 4 of 5).
   * Text questions are not auto-scored.
   */
  passCorrectCount?: number;
  antiCheat: AntiCheatSettings;
}

export type AssessmentConfig =
  | McqAssessmentConfig
  | CodingAssessmentConfig
  | EssayAssessmentConfig
  | VideoAssessmentConfig
  | QuestionnaireAssessmentConfig;

export const CODING_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'cpp', label: 'C++' },
] as const;

export function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function defaultAntiCheat(overrides: Partial<AntiCheatSettings> = {}): AntiCheatSettings {
  return {
    detectTabSwitch: true,
    maxTabSwitches: 3,
    detectCopyPaste: true,
    disableCopyPaste: false,
    disableRightClick: true,
    fullScreenRequired: false,
    recordScreen: false,
    webcamMonitoring: false,
    ...overrides,
  };
}

export function defaultMcqConfig(): McqAssessmentConfig {
  const o1 = newId('o');
  const o2 = newId('o');
  const o3 = newId('o');
  const o4 = newId('o');
  return {
    questions: [
      {
        id: newId('q'),
        prompt: 'What is React?',
        options: [
          { id: o1, text: 'Library' },
          { id: o2, text: 'Framework' },
          { id: o3, text: 'Database' },
          { id: o4, text: 'Language' },
        ],
        correctOptionId: o1,
        marks: 5,
      },
    ],
    antiCheat: defaultAntiCheat(),
  };
}

export function defaultCodingConfig(): CodingAssessmentConfig {
  return {
    language: 'javascript',
    prompt: 'Write a function to reverse a string.',
    testCases: [{ id: newId('tc'), input: '"hello"', expected: '"olleh"' }],
    allowedAttempts: 1,
    totalMarks: 100,
    antiCheat: defaultAntiCheat({
      disableCopyPaste: true,
      detectTabSwitch: true,
      fullScreenRequired: true,
    }),
  };
}

export function defaultEssayConfig(): EssayAssessmentConfig {
  return {
    prompt: 'Explain your experience with AI projects.',
    minWords: 200,
    maxWords: 500,
    totalMarks: 100,
    antiCheat: defaultAntiCheat(),
  };
}

export function defaultVideoConfig(): VideoAssessmentConfig {
  return {
    prompt: 'Introduce yourself in 2 minutes.',
    maxDurationSeconds: 120,
    maxRetakes: 1,
    cameraRequired: true,
    microphoneRequired: true,
    totalMarks: 100,
    antiCheat: defaultAntiCheat({ webcamMonitoring: true }),
  };
}

export function defaultQuestionnaireConfig(): QuestionnaireAssessmentConfig {
  const o1 = newId('o');
  const o2 = newId('o');
  const o3 = newId('o');
  const o4 = newId('o');
  return {
    passCorrectCount: 1,
    questions: [
      {
        id: newId('q'),
        kind: 'TEXT',
        prompt: 'Briefly describe your relevant experience for this role.',
        required: true,
        maxLength: 1000,
      },
      {
        id: newId('q'),
        kind: 'MCQ',
        prompt: 'How many years of experience do you have in this field?',
        options: [
          { id: o1, text: 'Less than 1 year' },
          { id: o2, text: '1–3 years' },
          { id: o3, text: '3–5 years' },
          { id: o4, text: '5+ years' },
        ],
        correctOptionId: o3,
      },
    ],
    antiCheat: defaultAntiCheat({
      detectTabSwitch: false,
      detectCopyPaste: false,
      disableRightClick: false,
    }),
  };
}

/** Number of auto-scored MCQ items in a questionnaire. */
export function countQuestionnaireMcqQuestions(config: QuestionnaireAssessmentConfig): number {
  return (config.questions || []).filter((q) => q.kind === 'MCQ').length;
}

/**
 * Resolve how many correct MCQ answers are required to pass.
 * Falls back from legacy passScorePercent when passCorrectCount is missing.
 */
export function resolveQuestionnairePassCorrectCount(
  config: QuestionnaireAssessmentConfig,
  passScorePercentFallback = 70,
): number {
  const total = countQuestionnaireMcqQuestions(config);
  if (total <= 0) return 0;
  if (config.passCorrectCount != null && Number.isFinite(Number(config.passCorrectCount))) {
    return Math.max(1, Math.min(total, Math.round(Number(config.passCorrectCount))));
  }
  const pct = Math.max(0, Math.min(100, Number(passScorePercentFallback) || 70));
  return Math.max(1, Math.min(total, Math.ceil((pct / 100) * total)));
}

/** Mirror count-based pass rule into passScorePercent for legacy API fields. */
export function questionnairePassPercentFromCount(passCorrectCount: number, mcqTotal: number): number {
  const total = Math.max(1, mcqTotal);
  const need = Math.max(1, Math.min(total, Math.round(passCorrectCount) || 1));
  return Math.max(0, Math.min(100, Math.round((need / total) * 100)));
}

export function defaultConfigForType(type: PreScreenAssessmentType): AssessmentConfig {
  switch (type) {
    case 'CODING':
      return defaultCodingConfig();
    case 'ESSAY':
      return defaultEssayConfig();
    case 'VIDEO':
      return defaultVideoConfig();
    case 'QUESTIONNAIRE':
      return defaultQuestionnaireConfig();
    case 'MCQ':
    default:
      return defaultMcqConfig();
  }
}

export function defaultDurationForType(type: PreScreenAssessmentType): number {
  switch (type) {
    case 'CODING':
      return 60;
    case 'ESSAY':
      return 20;
    case 'VIDEO':
      return 5;
    case 'QUESTIONNAIRE':
      return 20;
    case 'MCQ':
    default:
      return 30;
  }
}

export function defaultPassScoreForType(type: PreScreenAssessmentType): number {
  if (type === 'MCQ' || type === 'QUESTIONNAIRE') return 70;
  return 60;
}

export function defaultTotalMarksForType(_type: PreScreenAssessmentType): number {
  return 100;
}

export function sumMcqQuestionMarks(questions: McqQuestion[]): number {
  if (!Array.isArray(questions) || !questions.length) return 0;
  return questions.reduce((sum, q) => sum + Math.max(1, Number(q.marks) || 1), 0);
}

export function sumCodingQuestionMarks(questions: CodingQuestion[]): number {
  if (!Array.isArray(questions) || !questions.length) return 0;
  return questions.reduce((sum, q) => sum + Math.max(1, Number(q.marks) || 1), 0);
}

export function computeAssessmentTotalMarks(
  type: PreScreenAssessmentType,
  config: AssessmentConfig,
): number {
  if (type === 'MCQ') {
    const sum = sumMcqQuestionMarks((config as McqAssessmentConfig).questions || []);
    return Math.max(1, sum || defaultTotalMarksForType(type));
  }
  if (type === 'QUESTIONNAIRE') {
    const qs = (config as QuestionnaireAssessmentConfig).questions || [];
    return Math.max(1, qs.filter((q) => q.kind === 'MCQ').length || 1);
  }
  if (type === 'CODING') {
    const coding = config as CodingAssessmentConfig;
    const qSum = sumCodingQuestionMarks(coding.questions || []);
    if (qSum > 0) return qSum;
  }
  const raw = Number((config as { totalMarks?: number }).totalMarks);
  return Math.max(1, Number.isFinite(raw) && raw > 0 ? raw : defaultTotalMarksForType(type));
}

export function passingMarksFromPercent(totalMarks: number, passScorePercent: number): number {
  const total = Math.max(1, totalMarks);
  const percent = Math.max(0, Math.min(100, passScorePercent));
  return Math.min(total, Math.max(0, Math.round((total * percent) / 100)));
}

export function passPercentFromMarks(totalMarks: number, passingMarks: number): number {
  const total = Math.max(1, totalMarks);
  const marks = Math.min(total, Math.max(0, passingMarks));
  return Math.max(0, Math.min(100, Math.round((marks / total) * 100)));
}

export function defaultTitleForType(type: PreScreenAssessmentType, jobTitle?: string): string {
  const role = String(jobTitle || '').trim();
  switch (type) {
    case 'MCQ':
      return role ? `${role} Screening` : 'MCQ Screening';
    case 'CODING':
      return role ? `${role} Coding Assessment` : 'Coding Assessment';
    case 'ESSAY':
      return role ? `${role} Essay Assessment` : 'Essay Assessment';
    case 'VIDEO':
      return role ? `${role} Video Introduction` : 'Video Introduction';
    case 'QUESTIONNAIRE':
      return role ? `${role} Screening Questionnaire` : 'Screening Questionnaire';
    default:
      return role ? `${role} Assessment` : 'Pre-screen Assessment';
  }
}

function parseAntiCheat(raw: unknown): AntiCheatSettings {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return defaultAntiCheat({
    detectTabSwitch: o.detectTabSwitch !== false,
    maxTabSwitches: Math.max(1, Number(o.maxTabSwitches) || 3),
    detectCopyPaste: o.detectCopyPaste !== false,
    disableCopyPaste: !!o.disableCopyPaste,
    disableRightClick: o.disableRightClick !== false,
    fullScreenRequired: !!o.fullScreenRequired,
    recordScreen: !!o.recordScreen,
    webcamMonitoring: !!o.webcamMonitoring,
  });
}

export function parseAssessmentConfig(
  type: PreScreenAssessmentType,
  raw: unknown
): AssessmentConfig {
  const c = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const antiCheat = parseAntiCheat(c.antiCheat);

  if (type === 'MCQ') {
    const questions = Array.isArray(c.questions) ? c.questions : [];
    return {
      antiCheat,
      questions: questions.map((q, qi) => {
        const row = q && typeof q === 'object' ? (q as Record<string, unknown>) : {};
        const options = Array.isArray(row.options) ? row.options : [];
        const parsedOptions = options.map((opt, oi) => {
          const o = opt && typeof opt === 'object' ? (opt as Record<string, unknown>) : {};
          return {
            id: String(o.id || newId('o')),
            text: String(o.text || `Option ${oi + 1}`),
          };
        });
        const correctOptionId = String(row.correctOptionId || parsedOptions[0]?.id || '');
        return {
          id: String(row.id || newId('q')),
          prompt: String(row.prompt || `Question ${qi + 1}`),
          options: parsedOptions.length
            ? parsedOptions
            : [
                { id: newId('o'), text: 'Option A' },
                { id: newId('o'), text: 'Option B' },
              ],
          correctOptionId,
          marks: Math.max(1, Number(row.marks) || 5),
        };
      }),
    };
  }

  if (type === 'QUESTIONNAIRE') {
    const questions = Array.isArray(c.questions) ? c.questions : [];
    const parsed: QuestionnaireQuestion[] = questions.map((q, qi) => {
      const row = q && typeof q === 'object' ? (q as Record<string, unknown>) : {};
      const kind = String(row.kind || '').toUpperCase() === 'MCQ' ? 'MCQ' : 'TEXT';
      if (kind === 'MCQ') {
        const options = Array.isArray(row.options) ? row.options : [];
        const parsedOptions = options.map((opt, oi) => {
          const o = opt && typeof opt === 'object' ? (opt as Record<string, unknown>) : {};
          return {
            id: String(o.id || newId('o')),
            text: String(o.text || `Option ${oi + 1}`),
          };
        });
        const safeOptions = parsedOptions.length
          ? parsedOptions
          : [
              { id: newId('o'), text: 'Option A' },
              { id: newId('o'), text: 'Option B' },
            ];
        return {
          id: String(row.id || newId('q')),
          kind: 'MCQ' as const,
          prompt: String(row.prompt || `Question ${qi + 1}`),
          options: safeOptions,
          correctOptionId: String(row.correctOptionId || safeOptions[0]?.id || ''),
        };
      }
      return {
        id: String(row.id || newId('q')),
        kind: 'TEXT' as const,
        prompt: String(row.prompt || `Question ${qi + 1}`),
        required: row.required !== false,
        maxLength: Math.max(50, Math.min(5000, Number(row.maxLength) || 1000)),
      };
    });
    const base = {
      antiCheat,
      questions: parsed.length ? parsed : defaultQuestionnaireConfig().questions,
    } as QuestionnaireAssessmentConfig;
    const mcqTotal = countQuestionnaireMcqQuestions(base);
    const rawPass =
      c.passCorrectCount != null ? Number(c.passCorrectCount) : NaN;
    base.passCorrectCount =
      mcqTotal > 0
        ? Number.isFinite(rawPass) && rawPass > 0
          ? Math.max(1, Math.min(mcqTotal, Math.round(rawPass)))
          : Math.max(1, Math.min(mcqTotal, Math.ceil(0.7 * mcqTotal)))
        : 0;
    return base;
  }

  if (type === 'CODING') {
    const testCases = Array.isArray(c.testCases) ? c.testCases : [];
    const languages = Array.isArray(c.languages) ? c.languages : [];
    const questions = Array.isArray(c.questions) ? c.questions : [];
    const parsedTestCases = testCases.map((tc, ti) => {
      const row = tc && typeof tc === 'object' ? (tc as Record<string, unknown>) : {};
      return {
        id: String(row.id || newId('tc')),
        input: String(row.input ?? ''),
        expected: String(row.expected ?? ''),
      };
    });
    const parsedQuestions: CodingQuestion[] = questions.map((q, qi) => {
      const row = q && typeof q === 'object' ? (q as Record<string, unknown>) : {};
      const qTestCases = Array.isArray(row.testCases) ? row.testCases : [];
      return {
        id: String(row.id || newId('cq')),
        title: String(row.title || `Question ${qi + 1}`),
        prompt: String(row.prompt || ''),
        sampleInput: String(row.sampleInput ?? ''),
        sampleOutput: String(row.sampleOutput ?? ''),
        expectedAnswer: String(row.expectedAnswer ?? ''),
        marks: Math.max(1, Number(row.marks) || 20),
        testCases: qTestCases.map((tc, ti) => {
          const t = tc && typeof tc === 'object' ? (tc as Record<string, unknown>) : {};
          return {
            id: String(t.id || newId('tc')),
            input: String(t.input ?? ''),
            expected: String(t.expected ?? ''),
          };
        }),
      };
    });
    return {
      language: String(c.language || languages[0] || 'javascript'),
      prompt: String(c.prompt || ''),
      allowedAttempts: Math.max(1, Number(c.allowedAttempts) || 1),
      totalMarks: Math.max(1, Number(c.totalMarks) || defaultTotalMarksForType('CODING')),
      testCases: parsedTestCases,
      questions: parsedQuestions.length ? parsedQuestions : undefined,
      antiCheat: parseAntiCheat({ ...antiCheat, ...(c.antiCheat as object) }),
    };
  }

  if (type === 'ESSAY') {
    return {
      prompt: String(c.prompt || ''),
      minWords: Math.max(0, Number(c.minWords) || 200),
      maxWords: Math.max(1, Number(c.maxWords) || 500),
      totalMarks: Math.max(1, Number(c.totalMarks) || defaultTotalMarksForType('ESSAY')),
      antiCheat,
    };
  }

  return {
    prompt: String(c.prompt || ''),
    maxDurationSeconds: Math.max(30, Number(c.maxDurationSeconds) || 120),
    maxRetakes: Math.max(1, Number(c.maxRetakes) || 1),
    cameraRequired: c.cameraRequired !== false,
    microphoneRequired: c.microphoneRequired !== false,
    totalMarks: Math.max(1, Number(c.totalMarks) || defaultTotalMarksForType('VIDEO')),
    antiCheat,
  };
}

export function isAntiCheatActive(config: AssessmentConfig): boolean {
  const ac = config.antiCheat;
  return (
    ac.detectTabSwitch ||
    ac.detectCopyPaste ||
    ac.disableCopyPaste ||
    ac.disableRightClick ||
    ac.fullScreenRequired ||
    ac.recordScreen ||
    ac.webcamMonitoring
  );
}
