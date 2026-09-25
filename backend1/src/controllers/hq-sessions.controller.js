const { prisma, retryQuery } = require('../lib/prisma');
const { buildSessionEngagementStats } = require('../utils/session-engagement.util');
const { requireJwtSecret } = require('../config/secrets');
const {
  buildSessionTrackingFields,
} = require('../utils/session-tracking.util');
const jwt = require('jsonwebtoken');

function serializeSession(row) {
  return {
    id: row.id,
    candidateId: row.candidateId,
    loginAt: row.loginAt,
    logoutAt: row.logoutAt,
    durationMs: row.durationMs,
    ipAddress: row.ipAddress,
    deviceType: row.deviceType,
    browser: row.browser,
    operatingSystem: row.operatingSystem,
    country: row.country,
    state: row.state,
    city: row.city,
    timezone: row.timezone,
    isActive: row.isActive !== false && !row.logoutAt,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
  };
}

function issueCandidateToken(candidate) {
  return jwt.sign(
    {
      candidateId: candidate.id,
      whatsappNumber: candidate.whatsappNumber,
      isVerified: true,
      hqImpersonation: true,
    },
    requireJwtSecret(),
    { expiresIn: '2h' },
  );
}

function phase1FrontendBase() {
  return String(
    process.env.PHASE1_FRONTEND_URL ||
      process.env.JOB_PORTAL_FRONTEND_URL ||
      process.env.FRONTEND_URL ||
      process.env.CLIENT_URL ||
      'http://localhost:3000',
  )
    .trim()
    .replace(/\/+$/, '');
}

async function createImpersonationSession(req, candidateId, token) {
  try {
    const tracking = buildSessionTrackingFields(req, req.body || {});
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    await prisma.session.create({
      data: {
        candidateId,
        token,
        expiresAt,
        ...tracking,
      },
    });
  } catch (err) {
    console.warn('[hq-impersonate] session create failed:', err?.message || err);
  }
}

function findCandidateSelect() {
  return {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    whatsappNumber: true,
    passwordHash: true,
    isVerified: true,
    status: true,
    updatedAt: true,
    createdAt: true,
  };
}

function displayNameFromEmail(email) {
  const local = String(email || '')
    .split('@')[0]
    .replace(/[._+-]+/g, ' ')
    .trim();
  if (!local) return null;
  return local
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function splitDisplayName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

async function assessPortalCandidateHealth(candidate) {
  const resume = await retryQuery(async () =>
    prisma.resume.findUnique({
      where: { candidateId: candidate.id },
      select: {
        fileUrl: true,
        fileName: true,
        aiAnalyzed: true,
        resumeJson: true,
      },
    }),
  ).catch(() => null);

  const json =
    resume?.resumeJson && typeof resume.resumeJson === 'object' ? resume.resumeJson : {};
  const parseStatus = json.parseStatus || (resume?.aiAnalyzed ? 'completed' : null);
  const hasName = Boolean(
    String(candidate.firstName || '').trim() || String(candidate.lastName || '').trim(),
  );
  const hasResumeFile = Boolean(String(resume?.fileUrl || '').trim());
  const parseComplete = parseStatus === 'completed' || resume?.aiAnalyzed === true;
  const incompleteShell = !hasName && !hasResumeFile;
  const stuckParse =
    hasResumeFile &&
    !parseComplete &&
    (parseStatus == null ||
      parseStatus === 'queued' ||
      parseStatus === 'processing' ||
      parseStatus === 'failed');

  let onboardingState = 'ok';
  if (incompleteShell) onboardingState = 'needs_cv_upload';
  else if (stuckParse) onboardingState = 'needs_parse_repair';
  else if (!hasName && hasResumeFile) onboardingState = 'needs_profile_hydrate';
  else if (!candidate.passwordHash) onboardingState = 'needs_password';
  else if (!candidate.isVerified) onboardingState = 'needs_verification';

  return {
    hasName,
    hasResumeFile,
    parseStatus: parseStatus || null,
    parseError: json.parseError || null,
    parseAttempts: Number(json.parseAttempts) || 0,
    resumeFileName: resume?.fileName || null,
    resumeFileUrl: resume?.fileUrl || null,
    aiAnalyzed: Boolean(resume?.aiAnalyzed),
    incompleteShell,
    stuckParse,
    onboardingState,
  };
}

/** Same email resolution as /auth/login — do not filter isDeleted (Phase 1 Candidate has no such field). */
async function findPortalCandidateByEmailOrId({ email, candidateId }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const id = String(candidateId || '').trim();

  if (id) {
    const byId = await retryQuery(async () =>
      prisma.candidate.findFirst({
        where: { id },
        select: findCandidateSelect(),
      }),
    );
    if (byId) return byId;
  }

  if (!normalizedEmail) return null;

  let candidate = await retryQuery(async () =>
    prisma.candidate.findFirst({
      where: { email: normalizedEmail },
      select: findCandidateSelect(),
    }),
  );
  if (candidate) return candidate;

  // Profile email fallback (some accounts store login email only on profile)
  try {
    const byProfile = await retryQuery(async () =>
      prisma.candidate.findFirst({
        where: {
          profile: { email: normalizedEmail },
        },
        select: findCandidateSelect(),
      }),
    );
    if (byProfile) return byProfile;
  } catch {
    // profile relation / email field may be unavailable on older clients
  }

  return null;
}

/**
 * POST /api/hq/impersonate-candidate
 * Body: { email? , candidateId? }
 * Issues a short-lived job-portal JWT so HQ can open the candidate account.
 */
async function impersonateCandidate(req, res) {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const candidateId = String(req.body?.candidateId || req.body?.id || '').trim();
    if (!email && !candidateId) {
      return res.status(400).json({
        success: false,
        message: 'email or candidateId is required',
      });
    }

    const candidate = await findPortalCandidateByEmailOrId({ email, candidateId });

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Job portal candidate not found',
      });
    }

    const token = issueCandidateToken(candidate);
    await createImpersonationSession(req, candidate.id, token);

    const name =
      [candidate.firstName, candidate.lastName].filter(Boolean).join(' ').trim() ||
      candidate.email ||
      'Candidate';
    const frontendBase = phase1FrontendBase();
    const loginUrl = `${frontendBase}/candidate-dashboard#hqCandidateLogin=${encodeURIComponent(token)}`;

    return res.json({
      success: true,
      data: {
        token,
        candidateId: candidate.id,
        email: candidate.email || email || null,
        name,
        hasPassword: Boolean(candidate.passwordHash),
        isVerified: Boolean(candidate.isVerified),
        loginUrl,
        expiresIn: '2h',
      },
    });
  } catch (error) {
    console.error('hq impersonateCandidate:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create candidate login session',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * POST /api/hq/candidate-lookup
 * Body: { email? , candidateId? }
 * Soft status for HQ Account Support (no login session created).
 */
async function lookupCandidate(req, res) {
  try {
    const email = String(req.body?.email || req.query?.email || '')
      .trim()
      .toLowerCase();
    const candidateId = String(
      req.body?.candidateId || req.body?.id || req.query?.candidateId || '',
    ).trim();
    if (!email && !candidateId) {
      return res.status(400).json({
        success: false,
        message: 'email or candidateId is required',
      });
    }

    const candidate = await findPortalCandidateByEmailOrId({ email, candidateId });

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Job portal candidate not found',
      });
    }

    let lastLoginAt = null;
    try {
      const session = await prisma.session.findFirst({
        where: { candidateId: candidate.id },
        orderBy: { loginAt: 'desc' },
        select: { loginAt: true },
      });
      lastLoginAt = session?.loginAt ? new Date(session.loginAt).toISOString() : null;
    } catch {
      lastLoginAt = null;
    }

    const name =
      [candidate.firstName, candidate.lastName].filter(Boolean).join(' ').trim() ||
      candidate.email ||
      'Candidate';

    const health = await assessPortalCandidateHealth(candidate);

    return res.json({
      success: true,
      data: {
        exists: true,
        candidateId: candidate.id,
        email: candidate.email || email || null,
        name,
        status: candidate.status || null,
        isVerified: Boolean(candidate.isVerified),
        passwordGenerated: Boolean(candidate.passwordHash),
        hasLoggedInToPortal: Boolean(lastLoginAt),
        lastLoginAt,
        createdAt: candidate.createdAt
          ? new Date(candidate.createdAt).toISOString()
          : null,
        ...health,
      },
    });
  } catch (error) {
    console.error('hq lookupCandidate:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to look up candidate',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * POST /api/hq/repair-incomplete-candidate
 * Fallback for connectivity drop mid-CV-upload shells:
 * - hydrate display name from email when empty
 * - requeue durable CV parse when file exists but parse stuck/failed
 * - report needs_cv_upload when no file was ever stored
 */
async function repairIncompleteCandidate(req, res) {
  try {
    const email = String(req.body?.email || req.query?.email || '')
      .trim()
      .toLowerCase();
    const candidateId = String(
      req.body?.candidateId || req.body?.id || req.query?.candidateId || '',
    ).trim();
    if (!email && !candidateId) {
      return res.status(400).json({
        success: false,
        message: 'email or candidateId is required',
      });
    }

    const candidate = await findPortalCandidateByEmailOrId({ email, candidateId });
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Job portal candidate not found',
      });
    }

    const actions = [];
    let health = await assessPortalCandidateHealth(candidate);
    let updated = candidate;

    // 1) Temporary display name so HQ / CRM stop showing "—" while CV is pending
    if (!health.hasName && candidate.email) {
      const guessed = displayNameFromEmail(candidate.email);
      const { firstName, lastName } = splitDisplayName(guessed);
      if (firstName) {
        updated = await retryQuery(async () =>
          prisma.candidate.update({
            where: { id: candidate.id },
            data: {
              firstName,
              ...(lastName ? { lastName } : {}),
            },
            select: findCandidateSelect(),
          }),
        );
        actions.push('hydrated_name_from_email');
      }
    }

    // 2) Requeue durable parse when resume file exists but profile never finished
    if (health.hasResumeFile && health.stuckParse) {
      const {
        STATUSES,
        patchPersistedJob,
        setJob,
      } = require('../services/cv-parse-job.service');
      await patchPersistedJob(candidate.id, {
        parseStatus: STATUSES.QUEUED,
        parseStage: 'hq_repair_requeue',
        parseError: null,
        parseAttempts: 0,
        parseLockedBy: null,
        parseLockedAt: null,
        parseQueuedAt: new Date().toISOString(),
      });
      setJob(candidate.id, {
        status: STATUSES.QUEUED,
        stage: 'hq_repair_requeue',
        error: null,
        attempts: 0,
      });
      const { resumeCvParseJobs } = require('./cv.controller');
      setImmediate(() => {
        void resumeCvParseJobs({
          candidateId: candidate.id,
          fileUrl: health.resumeFileUrl,
          fileName: health.resumeFileName,
          mimeType: null,
          parseJobId: candidate.id,
        });
      });
      actions.push('requeued_cv_parse');
    } else if (health.hasResumeFile && !health.hasName) {
      // Parse already completed (or stuck in terminal completed) but name empty — hydrate from resumeJson
      try {
        const resume = await retryQuery(async () =>
          prisma.resume.findUnique({
            where: { candidateId: candidate.id },
            select: { resumeJson: true },
          }),
        );
        const pi =
          resume?.resumeJson && typeof resume.resumeJson === 'object'
            ? resume.resumeJson.personalInformation || resume.resumeJson.personalInfo || null
            : null;
        const full =
          String(pi?.fullName || '').trim() ||
          [pi?.firstName, pi?.lastName].filter(Boolean).join(' ').trim();
        const { firstName, lastName } = splitDisplayName(full);
        if (firstName) {
          updated = await retryQuery(async () =>
            prisma.candidate.update({
              where: { id: candidate.id },
              data: {
                firstName,
                ...(lastName ? { lastName } : {}),
                ...(pi?.email && !candidate.email ? { email: String(pi.email).trim().toLowerCase() } : {}),
              },
              select: findCandidateSelect(),
            }),
          );
          actions.push('hydrated_name_from_resume_json');
        }
      } catch (hydrateErr) {
        console.warn('[hq-repair] resume hydrate failed:', hydrateErr?.message || hydrateErr);
      }
    }

    // 3) Ask user to re-upload when account exists but file never landed
    if (!health.hasResumeFile) {
      actions.push('needs_cv_reupload');
    }

    // Refresh health after mutations
    health = await assessPortalCandidateHealth(updated);
    const name =
      [updated.firstName, updated.lastName].filter(Boolean).join(' ').trim() ||
      updated.email ||
      'Candidate';

    try {
      const { scheduleCandidateCommonSync } = require('../services/candidateCommonSync.service');
      scheduleCandidateCommonSync(candidate.id, { forceVerified: true });
    } catch {
      /* ignore */
    }

    return res.json({
      success: true,
      message:
        actions.length > 0
          ? `Repair applied: ${actions.join(', ')}`
          : 'No repair needed — profile looks complete',
      data: {
        candidateId: updated.id,
        email: updated.email || email || null,
        name,
        actions,
        ...health,
        uploadHintUrl: `${phase1FrontendBase()}/uploadcv`,
      },
    });
  } catch (error) {
    console.error('hq repairIncompleteCandidate:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to repair incomplete candidate',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

function isReusableIncompleteShell(health, candidate) {
  if (!health) return false;
  if (health.incompleteShell) return true;
  if (health.stuckParse) return true;
  if (health.onboardingState === 'needs_cv_upload') return true;
  if (health.onboardingState === 'needs_parse_repair') return true;
  if (health.onboardingState === 'needs_profile_hydrate') return true;
  // Half-parsed: email exists but almost no profile signal
  const bare =
    !health.hasName &&
    !health.hasResumeFile &&
    !candidate?.passwordHash;
  return bare;
}

/**
 * POST /api/hq/provision-or-reuse-candidate
 * Complete Account-support path when lookup misses or shell is incomplete:
 * 1) If complete account exists → return it (no duplicate)
 * 2) If incomplete / half-parsed shell matches email → reuse same ID (override incomplete)
 * 3) Else create a fresh candidate ID and (optionally) set temp password
 * Always returns uploadHintUrl so support can ask the user to re-upload CV when needed.
 */
async function provisionOrReuseCandidate(req, res) {
  try {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'A valid email is required to create or reuse a portal account',
      });
    }

    const forceOverrideIncomplete = req.body?.forceOverrideIncomplete !== false;
    const sendPasswordEmail = req.body?.sendPasswordEmail !== false;
    const requestedName = String(req.body?.name || '').trim();
    const phone = String(req.body?.phone || '').trim() || null;

    let existing = await findPortalCandidateByEmailOrId({ email });
    const actions = [];
    let mode = 'created';
    let tempPassword = null;

    if (existing) {
      const health = await assessPortalCandidateHealth(existing);
      const reusable = isReusableIncompleteShell(health, existing);

      if (!reusable) {
        return res.json({
          success: true,
          message: 'Portal account already exists and looks complete — reuse this ID',
          data: {
            mode: 'already_exists',
            candidateId: existing.id,
            email: existing.email || email,
            name:
              [existing.firstName, existing.lastName].filter(Boolean).join(' ').trim() ||
              existing.email ||
              email,
            actions: ['already_exists'],
            ...health,
            uploadHintUrl: `${phase1FrontendBase()}/uploadcv`,
            askUserToReuploadCv: !health.hasResumeFile || health.stuckParse,
          },
        });
      }

      // Override incomplete / half-parsed shell — keep same candidateId
      mode = 'reused_incomplete';
      actions.push('reused_incomplete_shell');

      const nameParts = splitDisplayName(requestedName || displayNameFromEmail(email));
      const updateData = {
        email,
        isVerified: true,
        source: 'hq_account_support_reuse',
        ...(nameParts.firstName ? { firstName: nameParts.firstName } : {}),
        ...(nameParts.lastName ? { lastName: nameParts.lastName } : {}),
        ...(phone ? { phone } : {}),
        updatedAt: new Date(),
      };

      if (forceOverrideIncomplete && !health.hasResumeFile) {
        // Clear stale half-parsed CRM mirror fields so a fresh CV can own the profile
        updateData.cvWorkExperienceEntries = null;
        updateData.cvEducationEntries = null;
        updateData.cvSummary = null;
        updateData.currentTitle = null;
        updateData.currentCompany = null;
        actions.push('cleared_incomplete_profile_fields');
      }

      if (!existing.passwordHash) {
        const bcrypt = require('bcryptjs');
        const { generateTempPassword } = (() => {
          try {
            return require('../utils/credentialGenerator');
          } catch {
            return {
              generateTempPassword: () =>
                `Hy${Math.random().toString(36).slice(2, 8)}!${Date.now().toString(36).slice(-3)}`,
            };
          }
        })();
        tempPassword = generateTempPassword();
        updateData.passwordHash = await bcrypt.hash(tempPassword, 10);
        actions.push('password_generated');
      }

      existing = await retryQuery(async () =>
        prisma.candidate.update({
          where: { id: existing.id },
          data: updateData,
          select: findCandidateSelect(),
        }),
      );

      if (health.hasResumeFile && health.stuckParse) {
        // Kick repair parse path without forcing a new ID
        try {
          const {
            STATUSES,
            patchPersistedJob,
            setJob,
          } = require('../services/cv-parse-job.service');
          await patchPersistedJob(existing.id, {
            parseStatus: STATUSES.QUEUED,
            parseStage: 'hq_provision_requeue',
            parseError: null,
            parseAttempts: 0,
            parseLockedBy: null,
            parseLockedAt: null,
          });
          setJob(existing.id, {
            status: STATUSES.QUEUED,
            stage: 'hq_provision_requeue',
            error: null,
            attempts: 0,
          });
          const { resumeCvParseJobs } = require('./cv.controller');
          setImmediate(() => {
            void resumeCvParseJobs({
              candidateId: existing.id,
              fileUrl: health.resumeFileUrl,
              fileName: health.resumeFileName,
              parseJobId: existing.id,
            });
          });
          actions.push('requeued_cv_parse');
        } catch (requeueErr) {
          console.warn('[hq-provision] requeue failed:', requeueErr?.message || requeueErr);
          actions.push('needs_cv_reupload');
        }
      } else if (!health.hasResumeFile) {
        actions.push('needs_cv_reupload');
      }
    } else {
      // Brand-new portal ID
      mode = 'created';
      const bcrypt = require('bcryptjs');
      let generateTempPassword;
      try {
        ({ generateTempPassword } = require('../utils/credentialGenerator'));
      } catch {
        generateTempPassword = () =>
          `Hy${Math.random().toString(36).slice(2, 8)}!${Date.now().toString(36).slice(-3)}`;
      }
      tempPassword = generateTempPassword();
      const nameParts = splitDisplayName(requestedName || displayNameFromEmail(email));
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      existing = await retryQuery(async () =>
        prisma.candidate.create({
          data: {
            email,
            firstName: nameParts.firstName || null,
            lastName: nameParts.lastName || null,
            phone,
            isVerified: true,
            passwordHash,
            source: 'hq_account_support_create',
            stage: 'New',
          },
          select: findCandidateSelect(),
        }),
      );
      actions.push('created_new_candidate', 'password_generated', 'needs_cv_reupload');
    }

    // Optional credential email (best-effort)
    let credentialEmailSent = false;
    let credentialEmailError = null;
    if (tempPassword && sendPasswordEmail) {
      try {
        const { Resend } = require('resend');
        const { getEmailFromForTrigger } = require('../config/emailFromAddresses');
        if (!process.env.RESEND_API_KEY) {
          credentialEmailError = 'Email service not configured';
        } else {
          const resend = new Resend(process.env.RESEND_API_KEY);
          const loginUrl = `${phase1FrontendBase()}/en/login`;
          const uploadUrl = `${phase1FrontendBase()}/uploadcv`;
          const { data, error } = await resend.emails.send({
            from: getEmailFromForTrigger('auth.otp_verification'),
            to: email,
            subject: 'Your HRYantra job-portal account',
            text: [
              `Your HRYantra candidate account is ready.`,
              ``,
              `Email: ${email}`,
              `Temporary password: ${tempPassword}`,
              `Sign in: ${loginUrl}`,
              `Upload / re-upload CV: ${uploadUrl}`,
              ``,
              `If you already started a profile that got stuck, this account reuses that ID so nothing is duplicated.`,
            ].join('\n'),
          });
          if (error) {
            credentialEmailError = error.message || 'Failed to send email';
          } else {
            credentialEmailSent = Boolean(data?.id);
            actions.push('password_email_sent');
          }
        }
      } catch (mailErr) {
        credentialEmailError = mailErr?.message || 'Failed to send email';
      }
    }

    try {
      const { scheduleCandidateCommonSync } = require('../services/candidateCommonSync.service');
      // Allow shell into common only after repair path; still skip pure empty unless forceShell
      scheduleCandidateCommonSync(existing.id, {
        forceVerified: true,
        forceShell: actions.includes('needs_cv_reupload') ? false : true,
      });
    } catch {
      /* ignore */
    }

    const health = await assessPortalCandidateHealth(existing);
    const name =
      [existing.firstName, existing.lastName].filter(Boolean).join(' ').trim() ||
      existing.email ||
      email;

    return res.json({
      success: true,
      message:
        mode === 'created'
          ? 'Created new portal candidate ID — ask user to upload CV'
          : mode === 'reused_incomplete'
            ? 'Reused incomplete portal ID (overrode half-parsed shell) — ask user to re-upload CV if needed'
            : 'Portal account ready',
      data: {
        mode,
        candidateId: existing.id,
        email: existing.email || email,
        name,
        actions,
        ...health,
        uploadHintUrl: `${phase1FrontendBase()}/uploadcv`,
        loginHintUrl: `${phase1FrontendBase()}/en/login`,
        askUserToReuploadCv: actions.includes('needs_cv_reupload') || health.stuckParse,
        credentialEmailSent,
        credentialEmailError,
        // Only returned to HQ — never log to client portals
        tempPassword: tempPassword || null,
      },
    });
  } catch (error) {
    console.error('hq provisionOrReuseCandidate:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create or reuse portal candidate',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * GET /api/hq/sessions/:candidateId
 * Login sessions + duration / location / best alert send window.
 */
async function getCandidateSessions(req, res) {
  try {
    const candidateId = String(req.params.candidateId || '').trim();
    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'candidateId is required' });
    }
    const limit = Math.min(100, Math.max(1, Number(req.query?.limit) || 40));

    const sessionsRaw = await retryQuery(async () =>
      prisma.session.findMany({
        where: { candidateId },
        orderBy: { loginAt: 'desc' },
        take: limit,
        select: {
          id: true,
          candidateId: true,
          loginAt: true,
          logoutAt: true,
          durationMs: true,
          ipAddress: true,
          deviceType: true,
          browser: true,
          operatingSystem: true,
          country: true,
          state: true,
          city: true,
          timezone: true,
          isActive: true,
          createdAt: true,
          lastUsedAt: true,
        },
      }),
    );

    const sessions = sessionsRaw.map(serializeSession);
    const engagement = buildSessionEngagementStats(sessions);

    return res.json({
      success: true,
      data: {
        candidateId,
        sessions,
        engagement,
        alertTiming: engagement.alertTiming,
        locations: engagement.locations,
      },
    });
  } catch (error) {
    console.error('hq getCandidateSessions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load sessions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * GET /api/hq/sessions?limit=50
 * Recent login sessions across candidates (simple HQ feed).
 */
async function listRecentSessions(req, res) {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query?.limit) || 50));
    const sessionsRaw = await retryQuery(async () =>
      prisma.session.findMany({
        orderBy: { loginAt: 'desc' },
        take: limit,
        select: {
          id: true,
          candidateId: true,
          loginAt: true,
          logoutAt: true,
          durationMs: true,
          ipAddress: true,
          deviceType: true,
          browser: true,
          operatingSystem: true,
          country: true,
          state: true,
          city: true,
          timezone: true,
          isActive: true,
          createdAt: true,
          lastUsedAt: true,
        },
      }),
    );

    const sessions = sessionsRaw.map(serializeSession);
    const byCandidate = new Map();
    for (const s of sessions) {
      const id = s.candidateId;
      if (!id) continue;
      const bucket = byCandidate.get(id) || [];
      bucket.push(s);
      byCandidate.set(id, bucket);
    }

    const users = [...byCandidate.entries()].map(([candidateId, rows]) => {
      const engagement = buildSessionEngagementStats(rows);
      return {
        candidateId,
        sessionCount: engagement.sessionCount,
        alertTiming: engagement.alertTiming,
        topLocation: engagement.locations[0] || null,
        avgDurationMs: engagement.avgDurationMs,
        lastLoginAt: rows[0]?.loginAt || rows[0]?.createdAt || null,
      };
    });

    return res.json({
      success: true,
      data: {
        count: sessions.length,
        users,
        sessions,
      },
    });
  } catch (error) {
    console.error('hq listRecentSessions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to list sessions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

module.exports = {
  getCandidateSessions,
  listRecentSessions,
  impersonateCandidate,
  lookupCandidate,
  repairIncompleteCandidate,
  provisionOrReuseCandidate,
};
