import crypto from 'crypto';

export const ASSESSMENT_TYPES = ['MCQ', 'CODING', 'ESSAY', 'VIDEO', 'QUESTIONNAIRE'];
/** Pre-screen assessments always run before the candidate applies. */
export const SESSION_TIMINGS = ['BEFORE_SUBMIT'];

export function generateAssessmentId(prefix = 'a') {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

export function generateSessionToken() {
  return crypto.randomBytes(24).toString('hex');
}

export function defaultAntiCheat(overrides = {}) {
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

export function defaultMcqConfig() {
  const o1 = 'o1';
  const o2 = 'o2';
  const o3 = 'o3';
  const o4 = 'o4';
  return {
    questions: [
      {
        id: generateAssessmentId('q'),
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

export function defaultEssayConfig() {
  return {
    prompt: 'Explain your experience with AI projects.',
    minWords: 200,
    maxWords: 500,
    antiCheat: defaultAntiCheat(),
  };
}

export function defaultCodingConfig() {
  return {
    language: 'javascript',
    prompt: 'Write a function to reverse a string.',
    languages: ['javascript'],
    starterCode: { javascript: '// Your code here\n' },
    testCases: [{ id: generateAssessmentId('tc'), input: '"hello"', expected: '"olleh"' }],
    allowedAttempts: 1,
    antiCheat: defaultAntiCheat({
      disableCopyPaste: true,
      detectTabSwitch: true,
      fullScreenRequired: true,
    }),
  };
}

export function defaultVideoConfig() {
  return {
    prompt: 'Introduce yourself in 2 minutes.',
    maxDurationSeconds: 120,
    maxRetakes: 1,
    cameraRequired: true,
    microphoneRequired: true,
    antiCheat: defaultAntiCheat({ webcamMonitoring: true }),
  };
}

export function defaultQuestionnaireConfig() {
  const o1 = 'o1';
  const o2 = 'o2';
  const o3 = 'o3';
  const o4 = 'o4';
  return {
    passCorrectCount: 1,
    questions: [
      {
        id: generateAssessmentId('q'),
        kind: 'TEXT',
        prompt: 'Briefly describe your relevant experience for this role.',
        required: true,
        maxLength: 1000,
      },
      {
        id: generateAssessmentId('q'),
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

export function defaultConfigForType(type) {
  switch (String(type || '').toUpperCase()) {
    case 'ESSAY':
      return defaultEssayConfig();
    case 'CODING':
      return defaultCodingConfig();
    case 'VIDEO':
      return defaultVideoConfig();
    case 'QUESTIONNAIRE':
      return defaultQuestionnaireConfig();
    case 'MCQ':
    default:
      return defaultMcqConfig();
  }
}

export function normalizeAssessmentPayload(data = {}) {
  const type = ASSESSMENT_TYPES.includes(String(data.type || '').toUpperCase())
    ? String(data.type).toUpperCase()
    : 'MCQ';
  const title = String(data.title || '').trim() || 'Untitled assessment';
  const durationMinutes = Math.max(1, Math.min(180, Number(data.durationMinutes) || 15));
  const passScorePercent =
    data.passScorePercent == null
      ? 60
      : Math.max(0, Math.min(100, Number(data.passScorePercent) || 0));
  const baseConfig =
    data.config && typeof data.config === 'object'
      ? data.config
      : defaultConfigForType(type);
  const config = {
    ...defaultConfigForType(type),
    ...baseConfig,
    antiCheat: {
      ...defaultAntiCheat(),
      ...(baseConfig.antiCheat && typeof baseConfig.antiCheat === 'object' ? baseConfig.antiCheat : {}),
    },
  };
  const antiCheat = config.antiCheat || defaultAntiCheat();
  const antiCheatEnabled =
    data.antiCheatEnabled === false
      ? false
      : Boolean(
          antiCheat.detectTabSwitch ||
            antiCheat.detectCopyPaste ||
            antiCheat.disableCopyPaste ||
            antiCheat.disableRightClick ||
            antiCheat.fullScreenRequired ||
            antiCheat.recordScreen ||
            antiCheat.webcamMonitoring
        );
  return {
    title,
    type,
    description: data.description ? String(data.description).trim() : null,
    durationMinutes,
    passScorePercent,
    antiCheatEnabled,
    config,
  };
}

/** Strip correct answers / hidden grading metadata for candidate-facing payloads */
export function sanitizeConfigForCandidate(type, config) {
  const c = config && typeof config === 'object' ? { ...config } : {};
  const upper = String(type).toUpperCase();
  if (upper === 'MCQ') {
    const questions = Array.isArray(c.questions) ? c.questions : [];
    return {
      ...c,
      questions: questions.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        marks: q.marks,
        options: Array.isArray(q.options)
          ? q.options.map((o) => ({ id: o.id, text: o.text }))
          : [],
      })),
    };
  }
  if (upper === 'QUESTIONNAIRE') {
    const questions = Array.isArray(c.questions) ? c.questions : [];
    return {
      ...c,
      passCorrectCount: c.passCorrectCount != null ? Number(c.passCorrectCount) : undefined,
      questions: questions.map((q) => {
        const kind = String(q?.kind || '').toUpperCase() === 'MCQ' ? 'MCQ' : 'TEXT';
        if (kind === 'MCQ') {
          return {
            id: q.id,
            kind: 'MCQ',
            prompt: q.prompt,
            options: Array.isArray(q.options)
              ? q.options.map((o) => ({ id: o.id, text: o.text }))
              : [],
          };
        }
        return {
          id: q.id,
          kind: 'TEXT',
          prompt: q.prompt,
          required: q.required !== false,
          maxLength: q.maxLength ?? 1000,
        };
      }),
    };
  }
  if (upper === 'CODING') {
    const questions = Array.isArray(c.questions) ? c.questions : [];
    if (questions.length) {
      return {
        language: c.language,
        allowedAttempts: c.allowedAttempts,
        antiCheat: c.antiCheat,
        questions: questions.map((q) => ({
          id: q.id,
          title: q.title,
          prompt: q.prompt,
          sampleInput: q.sampleInput,
          sampleOutput: q.sampleOutput,
          marks: q.marks,
          testCases: (Array.isArray(q.testCases) ? q.testCases : []).map((tc) => ({
            id: tc.id,
            input: tc.input,
          })),
        })),
      };
    }
    const testCases = Array.isArray(c.testCases) ? c.testCases : [];
    return {
      ...c,
      testCases: testCases.map((tc) => ({ id: tc.id, input: tc.input })),
    };
  }
  return c;
}

export function gradeMcqSession(config, answers) {
  const questions = Array.isArray(config?.questions) ? config.questions : [];
  if (!questions.length) return { scorePercent: 0, graded: true };
  let earned = 0;
  let totalMarks = 0;
  let correct = 0;
  for (const q of questions) {
    const marks = Math.max(1, Number(q.marks) || 1);
    totalMarks += marks;
    const picked = answers?.[q.id];
    if (picked && picked === q.correctOptionId) {
      correct += 1;
      earned += marks;
    }
  }
  const scorePercent = totalMarks ? Math.round((earned / totalMarks) * 100) : 0;
  return { scorePercent, graded: true, correct, total: questions.length, earned, totalMarks };
}

/** Grade questionnaire: each MCQ is worth 1 (no marks weighting). */
export function gradeQuestionnaireSession(config, answers) {
  const questions = Array.isArray(config?.questions) ? config.questions : [];
  const mcqQuestions = questions.filter((q) => String(q?.kind || '').toUpperCase() === 'MCQ');
  if (!mcqQuestions.length) return { scorePercent: null, graded: false, correct: 0, total: 0 };
  let correct = 0;
  for (const q of mcqQuestions) {
    const picked = answers?.[q.id];
    if (picked && picked === q.correctOptionId) correct += 1;
  }
  const total = mcqQuestions.length;
  const scorePercent = total ? Math.round((correct / total) * 100) : 0;
  return { scorePercent, graded: true, correct, total, earned: correct, totalMarks: total };
}

export function resolveQuestionnairePassCorrectCount(config, passScorePercentFallback = 70) {
  const questions = Array.isArray(config?.questions) ? config.questions : [];
  const total = questions.filter((q) => String(q?.kind || '').toUpperCase() === 'MCQ').length;
  if (total <= 0) return 0;
  if (config?.passCorrectCount != null && Number.isFinite(Number(config.passCorrectCount))) {
    return Math.max(1, Math.min(total, Math.round(Number(config.passCorrectCount))));
  }
  const pct = Math.max(0, Math.min(100, Number(passScorePercentFallback) || 70));
  return Math.max(1, Math.min(total, Math.ceil((pct / 100) * total)));
}

export function normalizeJobAssessmentLinks(links = []) {
  if (!Array.isArray(links)) return [];
  return links
    .map((row, index) => {
      const assessmentId = String(row?.assessmentId || '').trim();
      if (!assessmentId) return null;
      return {
        assessmentId,
        sortOrder: Number.isFinite(Number(row?.sortOrder)) ? Number(row.sortOrder) : index,
        required: row?.required !== false,
        timing: 'BEFORE_SUBMIT',
        durationOverrideMinutes:
          row?.durationOverrideMinutes != null
            ? Math.max(1, Math.min(180, Number(row.durationOverrideMinutes)))
            : null,
        passScoreOverridePercent:
          row?.passScoreOverridePercent != null
            ? Math.max(0, Math.min(100, Number(row.passScoreOverridePercent)))
            : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
