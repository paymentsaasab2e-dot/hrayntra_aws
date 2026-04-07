const { z } = require('zod');
const { sendValidationError } = require('../lms.response.helper');

const generateSetSchema = z.object({
  topic: z.string().min(1),
  role: z.string().min(1),
  count: z.number().int().min(1).max(20),
  difficulty: z.string().min(1)
});

const createSetSchema = z.object({
  title: z.string().min(1),
  sourceContext: z.string().min(1),
  questions: z.array(z.any())
});

const answerSetSchema = z.object({
  questionId: z.string().min(1),
  answer: z.string().min(1)
});

const feedbackSetSchema = z.object({
  questionId: z.string().min(1),
  answer: z.string().min(1),
  question: z.string().min(1)
});

const startMockSchema = z.object({
  category: z.string().min(1),
  questionCount: z.number().int().min(1).max(20)
});

const answerMockSchema = z.object({
  questionId: z.string().min(1),
  answer: z.string().min(1)
});

function validateGenerateSet(req, res, next) {
  const result = generateSetSchema.safeParse(req.body);
  if (!result.success) return sendValidationError(res, result.error.errors);
  next();
}

function validateCreateSet(req, res, next) {
  const result = createSetSchema.safeParse(req.body);
  if (!result.success) return sendValidationError(res, result.error.errors);
  next();
}

function validateAnswerSet(req, res, next) {
  const result = answerSetSchema.safeParse(req.body);
  if (!result.success) return sendValidationError(res, result.error.errors);
  next();
}

function validateFeedbackSet(req, res, next) {
  const result = feedbackSetSchema.safeParse(req.body);
  if (!result.success) return sendValidationError(res, result.error.errors);
  next();
}

function validateStartMock(req, res, next) {
  const result = startMockSchema.safeParse(req.body);
  if (!result.success) return sendValidationError(res, result.error.errors);
  next();
}

function validateAnswerMock(req, res, next) {
  const result = answerMockSchema.safeParse(req.body);
  if (!result.success) return sendValidationError(res, result.error.errors);
  next();
}

module.exports = {
  validateGenerateSet, validateCreateSet, validateAnswerSet,
  validateFeedbackSet, validateStartMock, validateAnswerMock
};
