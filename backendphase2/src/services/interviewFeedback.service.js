import OpenAI from 'openai';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { INTERVIEW_ACTIVITY_ACTIONS, logActivity } from '../utils/activityLogger.js';

const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

const averageScore = (payload) =>
  Number(
    (
      (payload.technicalScore +
        payload.communicationScore +
        payload.problemSolvingScore +
        payload.cultureFitScore +
        payload.experienceMatchScore) /
      5
    ).toFixed(2)
  );

export const interviewFeedbackService = {
  async create(interviewId, payload, user) {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        candidate: true,
        job: true,
      },
    });

    if (!interview) {
      throw new Error('Interview not found');
    }

    const feedback = await prisma.interviewFeedback.create({
      data: {
        interviewId,
        interviewerId: user.id,
        technicalScore: payload.technicalScore,
        communicationScore: payload.communicationScore,
        problemSolvingScore: payload.problemSolvingScore,
        cultureFitScore: payload.cultureFitScore,
        experienceMatchScore: payload.experienceMatchScore,
        overallScore: payload.overallScore ?? averageScore(payload),
        strengths: payload.strengths || null,
        weakness: payload.weakness || null,
        comments: payload.comments || null,
        recommendation: payload.recommendation,
        salaryFit: payload.salaryFit,
        availableToJoin: payload.availableToJoin,
        status: 'SUBMITTED',
      },
      include: {
        interviewer: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
            department: true,
          },
        },
      },
    });

    await prisma.interview.update({
      where: { id: interviewId },
      data: {
        status: 'FEEDBACK_SUBMITTED',
      },
    });

    await logActivity(prisma, {
      interviewId,
      action: INTERVIEW_ACTIVITY_ACTIONS.FEEDBACK_SUBMITTED,
      userId: user.id,
      metadata: {
        recommendation: payload.recommendation,
        overallScore: payload.overallScore ?? averageScore(payload),
      },
    });

    return feedback;
  },

  async list(interviewId) {
    return prisma.interviewFeedback.findMany({
      where: { interviewId },
      include: {
        interviewer: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
            department: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async generateAiSummary(interviewId, feedbackId) {
    const feedback = await prisma.interviewFeedback.findUnique({
      where: { id: feedbackId },
      include: {
        interview: {
          include: {
            candidate: true,
            job: true,
          },
        },
        interviewer: true,
      },
    });

    if (!feedback || feedback.interviewId !== interviewId) {
      throw new Error('Feedback not found');
    }

    const fallbackSummary = `${feedback.interview.candidate.firstName} ${feedback.interview.candidate.lastName} interviewed for ${feedback.interview.job.title}. Interview feedback indicates strong areas in communication and problem solving, with an overall recommendation of ${feedback.recommendation.toLowerCase()}. ${
      feedback.weakness ? `Key concern raised: ${feedback.weakness}. ` : ''
    }This summary was generated from interviewer scores and comments.`;

    let summary = fallbackSummary;

    if (openai) {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: `Summarize this interview feedback for ${feedback.interview.candidate.firstName} ${feedback.interview.candidate.lastName} applying for ${feedback.interview.job.title}.
Scores: Technical: ${feedback.technicalScore}, Communication: ${feedback.communicationScore}, Problem Solving: ${feedback.problemSolvingScore}, Culture Fit: ${feedback.cultureFitScore}, Experience Match: ${feedback.experienceMatchScore}.
Strengths: ${feedback.strengths || 'N/A'}.
Weaknesses: ${feedback.weakness || 'N/A'}.
Comments: ${feedback.comments || 'N/A'}.
Provide a 3-4 sentence professional summary and final hiring recommendation.`,
          },
        ],
      });

      summary = response.choices?.[0]?.message?.content?.trim() || fallbackSummary;
    }

    await prisma.interviewFeedback.update({
      where: { id: feedbackId },
      data: { aiSummary: summary },
    });

    return { summary };
  },
};
