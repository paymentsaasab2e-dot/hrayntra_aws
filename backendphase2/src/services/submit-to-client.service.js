import { prisma } from '../config/prisma.js';

/**
 * Segmented service handling Submit to Client logic with latency telemetry
 */
export async function executeSubmitToClient(interviewId, payload, user, helpers = {}) {
  const t0 = performance.now();

  const {
    getInterviewOrThrow,
    getClientRecipients,
    isDeliverableEmail,
    normalizeSubmissionType,
    inferSubmissionType,
    normalizeCvShareMode,
    readCandidateCvShareMode,
    readCandidateResumeFileId,
    normalizeClientTrackerOptions,
    persistCvSubmissionForCandidate,
    createClientReviewToken,
    toClientReviewUrl,
    sendMatchSubmissionEmail,
    mapInterviewCandidateForEmail,
    logActivity,
    INTERVIEW_ACTIVITY_ACTIONS = {},
    moveCandidateToSubmittedToClient,
  } = helpers;

  const interview = await getInterviewOrThrow(interviewId);
  const recipients = payload?.toEmail
    ? [String(payload.toEmail).trim()].filter((email) => isDeliverableEmail ? isDeliverableEmail(email) : Boolean(email))
    : await getClientRecipients(interview.clientId);

  if (!recipients.length) {
    const raw = String(payload?.toEmail || '').trim();
    if (raw && isDeliverableEmail && !isDeliverableEmail(raw)) {
      throw new Error(`Client contact email is invalid: ${raw}`);
    }
    throw new Error('No client email found for this interview/client');
  }

  const requested = normalizeSubmissionType ? normalizeSubmissionType(payload?.submissionType) : payload?.submissionType;
  const inferred = requested ? '' : inferSubmissionType ? inferSubmissionType(interview) : '';
  const submissionType = requested || inferred || 'INITIAL_REVIEW';

  const cvShareMode =
    (normalizeCvShareMode ? normalizeCvShareMode(payload?.cvShareMode) : null) ||
    (readCandidateCvShareMode ? readCandidateCvShareMode(interview.candidate) : null) ||
    'edited';

  const resumeFileId =
    String(payload?.resumeFileId || '').trim() ||
    (readCandidateResumeFileId ? readCandidateResumeFileId(interview.candidate) : '') ||
    '';

  const trackerOptions = normalizeClientTrackerOptions
    ? normalizeClientTrackerOptions(payload?.trackerOptions, { useNewDefaults: true })
    : payload?.trackerOptions;

  if (cvShareMode && persistCvSubmissionForCandidate) {
    await persistCvSubmissionForCandidate(
      interview.candidateId,
      cvShareMode,
      interview.job?.title || '',
      trackerOptions,
      resumeFileId || null,
    );
  }

  const token = createClientReviewToken ? createClientReviewToken({
    interviewId: interview.id,
    candidateId: interview.candidateId,
    jobId: interview.jobId,
    clientId: interview.clientId,
    submissionType,
    cvShareMode,
    resumeFileId: resumeFileId || null,
    trackerOptions,
  }) : `token-${interview.id}`;

  const reviewUrl = toClientReviewUrl ? await toClientReviewUrl(token, {
    interviewId: interview.id,
    candidateId: interview.candidateId,
  }) : `https://review.hryantra.com/${token}`;

  const purposeLabel =
    submissionType === 'OFFER_CONFIRMATION'
      ? 'Final clarification - please attach the signed offer letter.'
      : submissionType === 'INTERIM_REVIEW'
        ? 'Mid-cycle review - please confirm next steps.'
        : submissionType === 'INITIAL_REVIEW'
          ? 'Initial review - please confirm the candidate is a fit before scheduling.'
          : 'Please review this candidate.';

  let emailResult = null;
  if (sendMatchSubmissionEmail) {
    emailResult = await sendMatchSubmissionEmail({
      to: recipients,
      clientName: interview.client?.companyName || 'Client',
      jobTitle: interview.job?.title || 'Job',
      recruiterName: user?.name || user?.email || 'Recruitment Team',
      message:
        payload?.message ||
        `${purposeLabel} Open the secure review link to respond: ${reviewUrl}`,
      candidates: mapInterviewCandidateForEmail ? [mapInterviewCandidateForEmail(interview.candidate)] : [],
      portalUrl: reviewUrl,
      subject: `Interview Candidate Submission: ${interview.job?.title || 'Job'}`,
      forceSend: true,
    });

    if (!emailResult?.success) {
      console.warn(
        '[submit-to-client] client email failed:',
        emailResult?.error || 'Failed to send client submission email',
      );
    }
  }

  // Note the submission on the interview
  try {
    await prisma.interview.update({
      where: { id: interview.id },
      data: {
        notes: `${interview.notes || ''}\n[Submitted to client] ${submissionType.replace(
          /_/g,
          ' '
        )} — ${recipients.join(', ')}`.trim(),
      },
    });

    if (logActivity) {
      await logActivity(prisma, {
        interviewId: interview.id,
        action: INTERVIEW_ACTIVITY_ACTIONS?.NOTE_ADDED || 'NOTE_ADDED',
        userId: user?.id,
        metadata: {
          channel: 'submit-to-client',
          submissionType,
          recipients,
          reviewUrl,
        },
      });
    }
  } catch (logError) {
    console.warn(
      '[submit-to-client] failed to log submission note:',
      logError?.message || logError
    );
  }

  if (moveCandidateToSubmittedToClient) {
    try {
      await moveCandidateToSubmittedToClient({
        candidateId: interview.candidateId,
        jobId: interview.jobId,
        performedById: user?.id,
        metadata: {
          interviewId: interview.id,
          submissionType,
        },
      });
    } catch (stageErr) {
      console.warn(
        '[submit-to-client] candidate stage sync failed:',
        stageErr?.message || stageErr,
      );
    }
  }

  const durationMs = Math.round(performance.now() - t0);

  return {
    success: true,
    recipients,
    reviewUrl,
    submissionType,
    durationMs,
    emailSent: Boolean(emailResult?.success) && !emailResult?.skipped,
    emailError: emailResult?.success && !emailResult?.skipped
      ? null
      : emailResult?.error || (emailResult?.skipped ? 'Client submission email is disabled' : 'Failed to send email'),
  };
}
