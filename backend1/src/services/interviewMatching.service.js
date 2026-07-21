const { prisma, retryQuery } = require('../lib/prisma');

function parseExperienceRange(value) {
  const text = String(value || '').trim();
  if (!text) return { min: 0, max: 99 };
  if (text.includes('+')) {
    const min = Number.parseInt(text, 10);
    return { min: Number.isFinite(min) ? min : 0, max: 99 };
  }
  const match = text.match(/(\d+)\s*-\s*(\d+)/);
  if (match) {
    const min = Number.parseInt(match[1], 10);
    const max = Number.parseInt(match[2], 10);
    return { min: Number.isFinite(min) ? min : 0, max: Number.isFinite(max) ? max : 99 };
  }
  const single = Number.parseInt(text, 10);
  if (Number.isFinite(single)) return { min: single, max: single };
  return { min: 0, max: 99 };
}

function scoreInterviewer(request, profile) {
  let score = 0;
  const requestCategory = String(request.category || '').toLowerCase();
  const requestType = String(request.interviewType || '').toLowerCase();
  const requestLanguage = String(request.language || '').toLowerCase();
  const requestTech = Array.isArray(request.techStack)
    ? request.techStack.map((s) => String(s).toLowerCase())
    : [];
  const expertise = Array.isArray(profile.expertiseAreas)
    ? profile.expertiseAreas.map((s) => String(s).toLowerCase())
    : [];
  const interviewTypes = Array.isArray(profile.interviewTypes)
    ? profile.interviewTypes.map((s) => String(s).toLowerCase())
    : [];
  const languages = Array.isArray(profile.languages)
    ? profile.languages.map((s) => String(s).toLowerCase())
    : [];

  if (expertise.some((item) => item.includes(requestCategory) || requestCategory.includes(item))) {
    score += 30;
  }

  const overlapCount = requestTech.filter((tech) => expertise.includes(tech)).length;
  if (requestTech.length > 0) {
    score += Math.round((overlapCount / requestTech.length) * 30);
  }

  if (interviewTypes.some((item) => item.includes(requestType) || requestType.includes(item))) {
    score += 10;
  }

  if (languages.some((item) => item.includes(requestLanguage) || requestLanguage.includes(item))) {
    score += 10;
  }

  const reqExp = parseExperienceRange(request.experience);
  const interviewerExp = Number(profile.yearsOfExperience || 0);
  if (interviewerExp >= reqExp.min) score += 10;

  const rating = Number(profile.ratingAverage || 0);
  if (rating > 0) {
    score += Math.round((Math.min(5, rating) / 5) * 10);
  }

  return score;
}

async function matchInterviewRequestById(requestId) {
  const request = await retryQuery(async () =>
    prisma.interviewRequest.findUnique({
      where: { id: requestId },
    })
  );
  if (!request) return null;
  if (request.status === 'CANCELLED' || request.status === 'COMPLETED') return request;

  await retryQuery(async () =>
    prisma.interviewRequest.update({
      where: { id: request.id },
      data: { status: 'MATCHING' },
    })
  );

  const availableInterviewers = await retryQuery(async () =>
    prisma.interviewerProfile.findMany({
      where: { status: 'AVAILABLE' },
      orderBy: [{ ratingAverage: 'desc' }, { totalInterviews: 'desc' }],
      take: 200,
    })
  );

  const eligible = availableInterviewers.filter(
    (profile) => String(profile.candidateId) !== String(request.candidateId)
  );

  if (!eligible.length) {
    return retryQuery(async () =>
      prisma.interviewRequest.update({
        where: { id: request.id },
        data: { status: 'FINDING_INTERVIEWER', interviewerId: null, matchingScore: null },
      })
    );
  }

  const ranked = eligible
    .map((profile) => ({ profile, score: scoreInterviewer(request, profile) }))
    .sort((a, b) => b.score - a.score);

  const winner = ranked[0];
  if (!winner || winner.score <= 0) {
    return retryQuery(async () =>
      prisma.interviewRequest.update({
        where: { id: request.id },
        data: { status: 'FINDING_INTERVIEWER', interviewerId: null, matchingScore: null },
      })
    );
  }

  const updated = await retryQuery(async () =>
    prisma.interviewRequest.update({
      where: { id: request.id },
      data: {
        interviewerId: winner.profile.candidateId,
        matchingScore: winner.score,
        matchedAt: new Date(),
        status: 'WAITING_FOR_ACCEPTANCE',
      },
    })
  );

  await retryQuery(async () =>
    prisma.notification.create({
      data: {
        candidateId: winner.profile.candidateId,
        type: 'interview',
        title: 'New interview request',
        description: `Request ${request.requestId} is waiting for your response.`,
        actionButton: 'Review request',
        actionPath: '/lms/interview-prep/become-interviewer',
        metadata: {
          requestId: request.requestId,
          interviewRequestId: request.id,
          status: 'WAITING_FOR_ACCEPTANCE',
        },
      },
    })
  ).catch(() => {});

  return updated;
}

module.exports = {
  matchInterviewRequestById,
};
