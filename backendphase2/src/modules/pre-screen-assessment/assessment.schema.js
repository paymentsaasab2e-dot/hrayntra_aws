import crypto from 'crypto';

export const ASSESSMENT_TYPES = ['MCQ', 'CODING', 'ESSAY', 'VIDEO'];
export const SESSION_TIMINGS = ['AFTER_APPLY', 'BEFORE_SUBMIT'];

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

export function defaultConfigForType(type) {
  switch (String(type || '').toUpperCase()) {
    case 'ESSAY':
      return defaultEssayConfig();
    case 'CODING':
      return defaultCodingConfig();
    case 'VIDEO':
      return defaultVideoConfig();
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
  if (upper === 'CODING') {
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

export function normalizeJobAssessmentLinks(links = []) {
  if (!Array.isArray(links)) return [];
  return links
    .map((row, index) => {
      const assessmentId = String(row?.assessmentId || '').trim();
      if (!assessmentId) return null;
      const timing = SESSION_TIMINGS.includes(String(row?.timing || '').toUpperCase())
        ? String(row.timing).toUpperCase()
        : 'AFTER_APPLY';
      return {
        assessmentId,
        sortOrder: Number.isFinite(Number(row?.sortOrder)) ? Number(row.sortOrder) : index,
        required: row?.required !== false,
        timing,
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
