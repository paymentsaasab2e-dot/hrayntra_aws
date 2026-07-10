const { prisma } = require('../lib/prisma');
const { createCandidateNotification } = require('./notification.service');
const { sendJobRecommendationEmail } = require('./email.service');
const {
  scoreCandidateAgainstJob,
  resolveCandidateResumeText,
} = require('./job-matching-pipeline-phase1.service');

const MATCH_THRESHOLD = Number(process.env.JOB_MATCH_ALERT_THRESHOLD || 80);
const MAX_CANDIDATES = Math.min(
  500,
  Math.max(20, Number(process.env.JOB_MATCH_ALERT_MAX_CANDIDATES || 200) || 200),
);

const CANDIDATE_INCLUDE = {
  resume: true,
  summary: true,
  profile: true,
  skills: { include: { skill: true } },
  workExperiences: true,
  careerPreferences: true,
  educations: true,
  project: true,
  internship: true,
  certifications: true,
  gapExplanation: true,
  visaWorkAuthorization: true,
  settings: true,
};

function candidateDisplayName(candidate) {
  const profileName = String(candidate?.profile?.fullName || '').trim();
  if (profileName) return profileName;
  const parts = [candidate?.firstName, candidate?.lastName].filter(Boolean).join(' ').trim();
  return parts || 'there';
}

function jobCompanyName(job) {
  return (
    job?.client?.companyName ||
    job?.company?.name ||
    job?.hiringManager ||
    'Hiring company'
  );
}

async function isJobOpenForAlerts(jobId, job) {
  if (!job) return false;
  if (job.isActive === false) return false;

  try {
    const raw = await prisma.$runCommandRaw({
      find: 'jobs',
      filter: { _id: { $oid: String(jobId) } },
      projection: { status: 1, isActive: 1, isDeleted: 1 },
      limit: 1,
    });
    const doc = raw?.cursor?.firstBatch?.[0];
    if (!doc) return false;
    if (doc.isDeleted === true) return false;
    if (doc.isActive === false) return false;
    const status = String(doc.status || '').toUpperCase();
    if (status && !['OPEN', 'ACTIVE'].includes(status)) return false;
    return true;
  } catch (error) {
    console.warn('[job-match-alert] raw status lookup failed:', error?.message || error);
    return job.isActive !== false;
  }
}

function buildJobExploreUrl(jobId) {
  const base = String(process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/en/explore-jobs?jobId=${encodeURIComponent(jobId)}`;
}

async function hasExistingJobRecommendation(candidateId, jobId) {
  const recent = await prisma.notification.findMany({
    where: {
      candidateId,
      type: 'job',
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    select: { metadata: true },
    take: 50,
    orderBy: { createdAt: 'desc' },
  });

  return recent.some((row) => String(row?.metadata?.jobId || '') === String(jobId));
}

async function notifyHighFitCandidatesForJob(jobId) {
  const id = String(jobId || '').trim();
  if (!id) {
    return { jobId: id, scanned: 0, notified: 0, skipped: 'missing_job_id' };
  }

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      client: { select: { companyName: true } },
      company: { select: { name: true } },
    },
  });

  if (!job) {
    return { jobId: id, scanned: 0, notified: 0, skipped: 'job_not_found' };
  }

  if (!(await isJobOpenForAlerts(id, job))) {
    return { jobId: id, scanned: 0, notified: 0, skipped: 'job_not_open' };
  }

  const candidates = await prisma.candidate.findMany({
    take: MAX_CANDIDATES,
    orderBy: { updatedAt: 'desc' },
    include: CANDIDATE_INCLUDE,
  });

  let notified = 0;
  let scanned = 0;
  const companyName = jobCompanyName(job);
  const jobUrl = buildJobExploreUrl(job.id);

  for (const candidate of candidates) {
    scanned += 1;

    const settings = candidate.settings;
    if (settings && settings.jobAlerts === false) continue;

    const email = String(candidate.email || candidate.profile?.email || '').trim();
    if (!email) continue;

    const existingApplication = await prisma.application.findFirst({
      where: { candidateId: candidate.id, jobId: job.id },
      select: { id: true },
    });
    if (existingApplication) continue;

    if (await hasExistingJobRecommendation(candidate.id, job.id)) continue;

    const cleanedResumeText = resolveCandidateResumeText(candidate);
    const score = await scoreCandidateAgainstJob({
      candidate,
      cleanedResumeText,
      job,
    });

    if (!score || score.matchScore <= MATCH_THRESHOLD) continue;

    const title = `Recommended job: ${job.title}`;
    const description = `${companyName} — ${score.matchScore}% CV fit. We recommend you apply for this best-fitted role.`;

    await createCandidateNotification(candidate.id, {
      type: 'job',
      title,
      description,
      actionButton: 'View job',
      actionPath: `/en/explore-jobs?jobId=${job.id}`,
      metadata: {
        jobId: job.id,
        jobTitle: job.title,
        companyName,
        matchScore: score.matchScore,
        kind: 'job_recommendation',
      },
    });

    if (!settings || settings.emailNotifications !== false) {
      await sendJobRecommendationEmail({
        toEmail: email,
        candidateName: candidateDisplayName(candidate),
        jobTitle: job.title,
        companyName,
        matchScore: score.matchScore,
        jobUrl,
      });
    }

    notified += 1;
  }

  console.log(
    `[job-match-alert] job=${id} scanned=${scanned} notified=${notified} threshold>${MATCH_THRESHOLD}`,
  );

  return { jobId: id, scanned, notified, threshold: MATCH_THRESHOLD };
}

function queueHighFitCandidateAlerts(jobId) {
  setImmediate(() => {
    notifyHighFitCandidatesForJob(jobId).catch((error) => {
      console.warn('[job-match-alert] async run failed:', error?.message || error);
    });
  });
}

module.exports = {
  MATCH_THRESHOLD,
  notifyHighFitCandidatesForJob,
  queueHighFitCandidateAlerts,
};
