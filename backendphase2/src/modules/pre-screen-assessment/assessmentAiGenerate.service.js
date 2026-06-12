import { env } from '../../config/env.js';
import { chatCompletionWithFallback, hasLlmProvider } from '../../services/llmChatFallback.service.js';
import {
  defaultAntiCheat,
  defaultCodingConfig,
  defaultMcqConfig,
  generateAssessmentId,
  normalizeAssessmentPayload,
} from './assessment.schema.js';

const QUESTION_COUNT = 5;
const CODING_TEST_CASE_COUNT = 5;

const assessmentGenerateJsonSchema = {
  name: 'pre_screen_assessment_generate',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      mcq: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          questions: {
            type: 'array',
            minItems: QUESTION_COUNT,
            maxItems: QUESTION_COUNT,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                prompt: { type: 'string' },
                options: {
                  type: 'array',
                  minItems: 4,
                  maxItems: 4,
                  items: { type: 'string' },
                },
                correctIndex: { type: 'integer', minimum: 0, maximum: 3 },
                marks: { type: 'integer', minimum: 1, maximum: 20 },
              },
              required: ['prompt', 'options', 'correctIndex', 'marks'],
            },
          },
        },
        required: ['title', 'questions'],
      },
      coding: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          language: {
            type: 'string',
            enum: ['javascript', 'python', 'java', 'typescript', 'cpp'],
          },
          prompt: { type: 'string' },
          testCases: {
            type: 'array',
            minItems: CODING_TEST_CASE_COUNT,
            maxItems: CODING_TEST_CASE_COUNT,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                input: { type: 'string' },
                expected: { type: 'string' },
              },
              required: ['input', 'expected'],
            },
          },
        },
        required: ['title', 'language', 'prompt', 'testCases'],
      },
    },
    required: ['mcq', 'coding'],
  },
};

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildMcqConfig(rawMcq) {
  const base = defaultMcqConfig();
  const questions = (Array.isArray(rawMcq?.questions) ? rawMcq.questions : [])
    .slice(0, QUESTION_COUNT)
    .map((q, qi) => {
      const options = (Array.isArray(q?.options) ? q.options : [])
        .slice(0, 4)
        .map((text, oi) => ({
          id: `o${qi + 1}_${oi + 1}`,
          text: String(text || `Option ${oi + 1}`).trim() || `Option ${oi + 1}`,
        }));
      while (options.length < 4) {
        options.push({
          id: `o${qi + 1}_${options.length + 1}`,
          text: `Option ${options.length + 1}`,
        });
      }
      const correctIndex = Math.max(0, Math.min(3, Number(q?.correctIndex) || 0));
      return {
        id: generateAssessmentId('q'),
        prompt: String(q?.prompt || `Question ${qi + 1}`).trim() || `Question ${qi + 1}`,
        options,
        correctOptionId: options[correctIndex]?.id || options[0].id,
        marks: Math.max(1, Math.min(20, Number(q?.marks) || 5)),
      };
    });

  while (questions.length < QUESTION_COUNT) {
    const qi = questions.length;
    const o1 = `o${qi + 1}_1`;
    const o2 = `o${qi + 1}_2`;
    const o3 = `o${qi + 1}_3`;
    const o4 = `o${qi + 1}_4`;
    questions.push({
      id: generateAssessmentId('q'),
      prompt: `Question ${qi + 1}`,
      options: [
        { id: o1, text: 'Option A' },
        { id: o2, text: 'Option B' },
        { id: o3, text: 'Option C' },
        { id: o4, text: 'Option D' },
      ],
      correctOptionId: o1,
      marks: 5,
    });
  }

  return {
    ...base,
    questions,
    antiCheat: defaultAntiCheat(),
  };
}

function buildCodingConfig(rawCoding) {
  const base = defaultCodingConfig();
  const language = ['javascript', 'python', 'java', 'typescript', 'cpp'].includes(
    String(rawCoding?.language || '').toLowerCase()
  )
    ? String(rawCoding.language).toLowerCase()
    : 'javascript';

  const testCases = (Array.isArray(rawCoding?.testCases) ? rawCoding.testCases : [])
    .slice(0, CODING_TEST_CASE_COUNT)
    .map((tc) => ({
      id: generateAssessmentId('tc'),
      input: String(tc?.input ?? ''),
      expected: String(tc?.expected ?? ''),
    }));

  while (testCases.length < CODING_TEST_CASE_COUNT) {
    testCases.push({
      id: generateAssessmentId('tc'),
      input: '',
      expected: '',
    });
  }

  return {
    ...base,
    language,
    languages: [language],
    prompt: String(rawCoding?.prompt || 'Solve the programming challenge.').trim(),
    testCases,
    allowedAttempts: 1,
    totalMarks: 100,
    antiCheat: defaultAntiCheat({
      disableCopyPaste: true,
      detectTabSwitch: true,
      fullScreenRequired: true,
    }),
  };
}

const mcqOnlyJsonSchema = {
  name: 'pre_screen_mcq_generate',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      questions: {
        type: 'array',
        minItems: QUESTION_COUNT,
        maxItems: QUESTION_COUNT,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            prompt: { type: 'string' },
            options: {
              type: 'array',
              minItems: 4,
              maxItems: 4,
              items: { type: 'string' },
            },
            correctIndex: { type: 'integer', minimum: 0, maximum: 3 },
            marks: { type: 'integer', minimum: 1, maximum: 20 },
          },
          required: ['prompt', 'options', 'correctIndex', 'marks'],
        },
      },
    },
    required: ['title', 'questions'],
  },
};

export async function generateMcqAssessmentWithAi({
  jobTitle,
  skills = [],
  jobDescription = '',
} = {}) {
  const role = String(jobTitle || '').trim();
  if (!role) {
    throw new Error('Job title is required to generate MCQ questions');
  }
  if (!hasLlmProvider()) {
    throw new Error('AI is not configured. Set OPENAI_API_KEY on the server.');
  }

  const skillList = (Array.isArray(skills) ? skills : [])
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  const description = stripHtml(jobDescription).slice(0, 4000);

  const promptParts = [
    `Create a multiple-choice pre-screen test for the job role "${role}".`,
    skillList.length ? `Key skills: ${skillList.join(', ')}.` : null,
    description ? `Job context:\n${description}` : null,
    `Return exactly ${QUESTION_COUNT} multiple-choice questions testing role-relevant knowledge.`,
    'Each question must have exactly 4 answer options, one clearly correct answer (correctIndex 0-3), and marks between 1 and 20.',
    'Questions should be practical, fair, and appropriate for initial screening — not trick questions.',
    'Title should be concise and include the role name where helpful.',
  ]
    .filter(Boolean)
    .join('\n');

  const completion = await chatCompletionWithFallback(
    {
      model: env.OPENAI_CHAT_MODEL,
      temperature: 0.35,
      max_tokens: 2500,
      response_format: {
        type: 'json_schema',
        json_schema: mcqOnlyJsonSchema,
      },
      messages: [
        {
          role: 'system',
          content:
            'You are an expert technical recruiter creating MCQ pre-screen tests. Return only valid JSON matching the schema.',
        },
        { role: 'user', content: promptParts },
      ],
    },
    'pre-screen-mcq-generate'
  );

  const raw = completion.choices?.[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error('AI returned an empty response');
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('AI returned invalid JSON');
  }

  const title = String(parsed?.title || '').trim() || `${role} — MCQ Screening`;

  return normalizeAssessmentPayload({
    title,
    type: 'MCQ',
    durationMinutes: 30,
    passScorePercent: 70,
    config: buildMcqConfig(parsed),
  });
}

export async function generatePreScreenAssessmentsWithAi({
  jobTitle,
  skills = [],
  jobDescription = '',
} = {}) {
  const role = String(jobTitle || '').trim();
  if (!role) {
    throw new Error('Job title is required to generate assessments');
  }
  if (!hasLlmProvider()) {
    throw new Error('AI is not configured. Set OPENAI_API_KEY on the server.');
  }

  const skillList = (Array.isArray(skills) ? skills : [])
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  const description = stripHtml(jobDescription).slice(0, 4000);

  const promptParts = [
    `Create a pre-screen assessment package for the job role "${role}".`,
    skillList.length ? `Key skills: ${skillList.join(', ')}.` : null,
    description ? `Job context:\n${description}` : null,
    `Return exactly ${QUESTION_COUNT} multiple-choice questions testing role-relevant knowledge.`,
    'Each MCQ must have exactly 4 answer options, one clearly correct answer (correctIndex 0-3), and marks between 1 and 20.',
    `Return exactly 1 coding challenge with exactly ${CODING_TEST_CASE_COUNT} test cases (input and expected output as strings).`,
    'Choose the most appropriate programming language for the role.',
    'Questions should be practical, fair, and appropriate for initial screening — not trick questions.',
    'Titles should be concise and include the role name where helpful.',
  ]
    .filter(Boolean)
    .join('\n');

  const completion = await chatCompletionWithFallback(
    {
      model: env.OPENAI_CHAT_MODEL,
      temperature: 0.35,
      max_tokens: 3500,
      response_format: {
        type: 'json_schema',
        json_schema: assessmentGenerateJsonSchema,
      },
      messages: [
        {
          role: 'system',
          content:
            'You are an expert technical recruiter creating pre-screen assessments. Return only valid JSON matching the schema. Use realistic, role-specific content.',
        },
        { role: 'user', content: promptParts },
      ],
    },
    'pre-screen-assessment-generate'
  );

  const raw = completion.choices?.[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error('AI returned an empty response');
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('AI returned invalid JSON');
  }

  const mcqTitle =
    String(parsed?.mcq?.title || '').trim() || `${role} — MCQ Screening`;
  const codingTitle =
    String(parsed?.coding?.title || '').trim() || `${role} — Coding Challenge`;

  const mcqPayload = normalizeAssessmentPayload({
    title: mcqTitle,
    type: 'MCQ',
    durationMinutes: 30,
    passScorePercent: 70,
    config: buildMcqConfig(parsed?.mcq),
  });

  const codingPayload = normalizeAssessmentPayload({
    title: codingTitle,
    type: 'CODING',
    durationMinutes: 60,
    passScorePercent: 60,
    config: buildCodingConfig(parsed?.coding),
  });

  return {
    mcq: mcqPayload,
    coding: codingPayload,
    questionCount: QUESTION_COUNT,
    codingTestCaseCount: CODING_TEST_CASE_COUNT,
  };
}
