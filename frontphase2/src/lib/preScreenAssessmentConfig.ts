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

export type AssessmentConfig =
  | McqAssessmentConfig
  | CodingAssessmentConfig
  | EssayAssessmentConfig
  | VideoAssessmentConfig;

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

export function defaultConfigForType(type: PreScreenAssessmentType): AssessmentConfig {
  switch (type) {
    case 'CODING':
      return defaultCodingConfig();
    case 'ESSAY':
      return defaultEssayConfig();
    case 'VIDEO':
      return defaultVideoConfig();
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
    case 'MCQ':
    default:
      return 30;
  }
}

export function defaultPassScoreForType(type: PreScreenAssessmentType): number {
  return type === 'MCQ' ? 70 : 60;
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

export function defaultTitleForType(type: PreScreenAssessmentType): string {
  switch (type) {
    case 'MCQ':
      return 'Frontend Developer Screening';
    case 'CODING':
      return 'Coding Assessment';
    case 'ESSAY':
      return 'Essay Assessment';
    case 'VIDEO':
      return 'Video Introduction';
    default:
      return 'Pre-screen Assessment';
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
