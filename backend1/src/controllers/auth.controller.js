const { prisma, retryQuery } = require('../lib/prisma');
const { scheduleCandidateCommonSync } = require('../services/candidateCommonSync.service');
const { generateOTP, getOTPExpiration, isOTPExpired, normalizeOtpInput, otpMatches } = require('../utils/otp.util');
const { generateCandidateIdFromEmail } = require('../utils/candidate.util');
const { sendOTPEmail } = require('../services/email.service');
const { resolveWhatsAppLogin, whatsappNumbersMatch, normalizeE164 } = require('../utils/phone.util');
const { OtpStatus } = require('@prisma/client');
const { isPortalPlaceholderFullName } = require('../utils/portal-profile-placeholder.util');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const {
  buildSessionTrackingFields,
  buildSessionClosePatch,
} = require('../utils/session-tracking.util');

const MIN_PASSWORD_LENGTH = 8;
const RETURNING_USER_MS = 60_000;

function issueCandidateToken(candidate) {
  return jwt.sign(
    {
      candidateId: candidate.id,
      whatsappNumber: candidate.whatsappNumber,
      isVerified: true,
    },
    process.env.JWT_SECRET || 'saasa_jwt_secret_key_2024',
    { expiresIn: '30d' }
  );
}

/** Persist extended session analytics even if Prisma client is stale. */
async function patchSessionAnalytics(tokenOrId, patch, byToken = true) {
  try {
    const filter = byToken ? { token: tokenOrId } : { _id: { $oid: tokenOrId } };
    await prisma.$runCommandRaw({
      update: 'sessions',
      updates: [
        {
          q: filter,
          u: { $set: patch },
        },
      ],
    });
  } catch (err) {
    console.warn('⚠️ Failed to patch session analytics:', err?.message || err);
  }
}

async function createCandidateSession(req, candidateId, token) {
  try {
    const tracking = buildSessionTrackingFields(req, req.body || {});
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    try {
      await prisma.session.create({
        data: {
          candidateId,
          token,
          expiresAt,
          ...tracking,
        },
      });
    } catch (fullCreateError) {
      // Stale Prisma client (pre-tracking fields): create core row, then raw $set analytics.
      await prisma.session.create({
        data: {
          candidateId,
          token,
          userAgent: tracking.userAgent,
          ipAddress: tracking.ipAddress,
          expiresAt,
        },
      });
      await patchSessionAnalytics(token, {
        loginAt: tracking.loginAt,
        logoutAt: null,
        durationMs: null,
        deviceType: tracking.deviceType,
        browser: tracking.browser,
        operatingSystem: tracking.operatingSystem,
        country: tracking.country,
        state: tracking.state,
        city: tracking.city,
        timezone: tracking.timezone,
        isActive: true,
      });
      console.warn(
        '⚠️ Session created with analytics patch (run prisma generate when backend is free):',
        fullCreateError.message
      );
    }
  } catch (sessionError) {
    console.error('⚠️ Failed to create session record:', sessionError.message);
  }
}

/**
 * Close the current session (or all sessions) and keep history for HQ analytics.
 * POST /api/auth/logout
 */
async function logout(req, res) {
  try {
    const candidateId = req.user?.candidateId || req.user?.id;
    if (!candidateId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const token =
      req.headers.authorization?.split(' ')[1] ||
      req.body?.token ||
      null;
    const logoutAll = Boolean(req.body?.logoutAll);
    const now = new Date();

    const closeOne = async (session) => {
      const closePatch = buildSessionClosePatch(session, now);
      const revokedToken = `revoked_${session.id}_${now.getTime()}`;
      try {
        await prisma.session.update({
          where: { id: session.id },
          data: {
            ...closePatch,
            token: revokedToken,
          },
        });
      } catch {
        await patchSessionAnalytics(
          session.token,
          {
            isActive: false,
            logoutAt: now,
            durationMs: closePatch.durationMs,
            lastUsedAt: now,
            token: revokedToken,
          },
          true
        );
      }
    };

    if (logoutAll) {
      const sessions = await prisma.session.findMany({
        where: { candidateId },
      });
      const active = sessions.filter((s) => s.isActive !== false);
      await Promise.all((active.length ? active : sessions).map((s) => closeOne(s)));
    } else if (token) {
      const session = await prisma.session.findUnique({ where: { token } });
      if (session && session.candidateId === candidateId) {
        await closeOne(session);
      }
    }

    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error logging out:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to logout',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function computeSkipCvUpload(candidate, otpCreatedAt = null) {
  const onboarding = await retryQuery(async () => {
    return await prisma.candidate.findUnique({
      where: { id: candidate.id },
      select: {
        profile: { select: { id: true } },
        resume: { select: { id: true } },
      },
    });
  });

  const hasProfileOrResume = !!(onboarding?.profile || onboarding?.resume);
  if (hasProfileOrResume) return true;

  if (otpCreatedAt && candidate.createdAt) {
    const otpMs = new Date(otpCreatedAt).getTime();
    const candMs = new Date(candidate.createdAt).getTime();
    return otpMs - candMs > RETURNING_USER_MS;
  }

  // Password login: treat verified accounts older than a minute as returning
  if (candidate.createdAt) {
    return Date.now() - new Date(candidate.createdAt).getTime() > RETURNING_USER_MS;
  }

  return false;
}

async function syncProfilePhone(candidate) {
  try {
    const cleanPhone = String(candidate.whatsappNumber || '').replace(
      candidate.countryCode || '',
      ''
    );
    const existingProfile = await prisma.candidateProfile.findUnique({
      where: { candidateId: candidate.id },
      select: { fullName: true },
    });

    const profileUpdate = { phoneNumber: cleanPhone };
    if (existingProfile && isPortalPlaceholderFullName(existingProfile.fullName)) {
      profileUpdate.fullName = '';
    }

    await prisma.candidateProfile.upsert({
      where: { candidateId: candidate.id },
      update: profileUpdate,
      create: {
        candidateId: candidate.id,
        fullName: '',
        email: String(candidate.email || '').trim(),
        phoneNumber: cleanPhone,
      },
    });
  } catch (profileSyncError) {
    console.warn('⚠️ Non-critical: Failed to sync profile number:', profileSyncError.message);
  }
}

function validatePasswordPair(password, confirmPassword) {
  const trimmed = String(password || '');
  if (trimmed.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      status: 400,
      code: 'WEAK_PASSWORD',
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    };
  }
  if (confirmPassword !== undefined && trimmed !== String(confirmPassword || '')) {
    return {
      ok: false,
      status: 400,
      code: 'PASSWORD_MISMATCH',
      message: 'Passwords do not match',
    };
  }
  return { ok: true, password: trimmed };
}

async function detachLoginIdentifiersFromCandidate(candidate, { normalizedEmail, fullWhatsAppNumber }) {
  const patch = {};
  if ((candidate.email || '').toLowerCase() === normalizedEmail) {
    patch.email = null;
  }
  if (candidate.whatsappNumber === fullWhatsAppNumber) {
    patch.whatsappNumber = null;
  }
  if (Object.keys(patch).length === 0) {
    return;
  }
  try {
    await retryQuery(async () => {
      return await prisma.candidate.update({
        where: { id: candidate.id },
        data: patch,
      });
    });
  } catch (error) {
    if (error.code === 'P2002' || error.code === 'P2034') {
      console.warn('⚠️ Non-critical: candidate identifier detach skipped:', error.message);
      return;
    }
    throw error;
  }
}

async function updateCandidateLoginFields(candidate, { normalizedEmail, fullWhatsAppNumber, countryCode }) {
  const needsUpdate =
    (candidate.email || '').toLowerCase() !== normalizedEmail ||
    candidate.countryCode !== countryCode ||
    candidate.whatsappNumber !== fullWhatsAppNumber;

  if (!needsUpdate) {
    return candidate;
  }

  try {
    return await retryQuery(async () => {
      return await prisma.candidate.update({
        where: { id: candidate.id },
        data: {
          email: normalizedEmail,
          countryCode,
          whatsappNumber: fullWhatsAppNumber,
        },
      });
    });
  } catch (error) {
    if (error.code === 'P2002' || error.code === 'P2034') {
      console.warn('⚠️ Non-critical: candidate login field merge skipped:', error.message);
      return candidate;
    }
    throw error;
  }
}

async function findCandidateByWhatsApp(fullWhatsAppNumber) {
  const normalized = normalizeE164(fullWhatsAppNumber);
  if (!normalized) return null;

  const exact = await retryQuery(async () =>
    prisma.candidate.findUnique({
      where: { whatsappNumber: normalized },
    }),
  );
  if (exact) return exact;

  const digits = normalized.slice(1);
  const legacyMatches = await retryQuery(async () =>
    prisma.candidate.findMany({
      where: {
        whatsappNumber: {
          in: [normalized, digits, `+${digits}`].filter(Boolean),
        },
      },
      take: 5,
    }),
  );

  return legacyMatches.find((row) => whatsappNumbersMatch(row.whatsappNumber, normalized)) || null;
}

async function collectLinkedCandidates({ candidateId, normalizedEmail, fullWhatsAppNumber }) {
  const [byEmail, byId, byWhatsApp] = await Promise.all([
    retryQuery(async () =>
      prisma.candidate.findFirst({
        where: { email: normalizedEmail },
      }),
    ),
    retryQuery(async () =>
      prisma.candidate.findUnique({
        where: { id: candidateId },
      }),
    ),
    findCandidateByWhatsApp(fullWhatsAppNumber),
  ]);

  const linked = new Map();
  for (const row of [byEmail, byId, byWhatsApp]) {
    if (row) linked.set(row.id, row);
  }
  return linked;
}

async function expirePendingOtpsForCandidates(candidateIds) {
  const uniqueIds = [...new Set(candidateIds.filter(Boolean))];
  if (!uniqueIds.length) return;

  await retryQuery(async () =>
    prisma.otpVerification.updateMany({
      where: {
        candidateId: { in: uniqueIds },
        status: OtpStatus.PENDING,
      },
      data: {
        status: OtpStatus.EXPIRED,
      },
    }),
  );
}

async function findLatestValidPendingOtp({ candidateIds, preferredCandidateId }) {
  const now = new Date();
  const uniqueIds = [...new Set(candidateIds.filter(Boolean))];
  if (!uniqueIds.length) {
    return null;
  }

  await retryQuery(async () =>
    prisma.otpVerification.updateMany({
      where: {
        candidateId: { in: uniqueIds },
        status: OtpStatus.PENDING,
        expiresAt: { lte: now },
      },
      data: { status: OtpStatus.EXPIRED },
    }),
  );

  if (preferredCandidateId && uniqueIds.includes(preferredCandidateId)) {
    const preferredOtp = await retryQuery(async () =>
      prisma.otpVerification.findFirst({
        where: {
          candidateId: preferredCandidateId,
          status: OtpStatus.PENDING,
          expiresAt: { gt: now },
        },
        orderBy: { createdAt: 'desc' },
        include: { candidate: true },
      }),
    );
    if (preferredOtp) return preferredOtp;
  }

  return retryQuery(async () =>
    prisma.otpVerification.findFirst({
      where: {
        candidateId: { in: uniqueIds },
        status: OtpStatus.PENDING,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
      include: { candidate: true },
    }),
  );
}

async function findMatchingValidPendingOtp({ candidateIds, submittedOtp, normalizedEmail, fullWhatsAppNumber }) {
  const now = new Date();
  const uniqueIds = [...new Set(candidateIds.filter(Boolean))];
  const normalizedSubmitted = normalizeOtpInput(submittedOtp);

  if (!normalizedSubmitted) {
    return null;
  }

  if (uniqueIds.length) {
    await retryQuery(async () =>
      prisma.otpVerification.updateMany({
        where: {
          candidateId: { in: uniqueIds },
          status: OtpStatus.PENDING,
          expiresAt: { lte: now },
        },
        data: { status: OtpStatus.EXPIRED },
      }),
    );
  }

  const validWhere = {
    status: OtpStatus.PENDING,
    expiresAt: { gt: now },
    OR: [
      ...(uniqueIds.length ? [{ candidateId: { in: uniqueIds } }] : []),
      ...(normalizedEmail ? [{ candidate: { email: normalizedEmail } }] : []),
      ...(fullWhatsAppNumber ? [{ candidate: { whatsappNumber: fullWhatsAppNumber } }] : []),
    ],
  };

  if (!validWhere.OR.length) {
    return null;
  }

  const validOtps = await retryQuery(async () =>
    prisma.otpVerification.findMany({
      where: validWhere,
      orderBy: { createdAt: 'desc' },
      include: { candidate: true },
      take: 20,
    }),
  );

  return validOtps.find((row) => otpMatches(row.otp, normalizedSubmitted)) || null;
}

async function findPendingOtpForLogin({
  candidateId,
  normalizedEmail,
  fullWhatsAppNumber,
  submittedOtp,
}) {
  const linked = await collectLinkedCandidates({
    candidateId,
    normalizedEmail,
    fullWhatsAppNumber,
  });
  const candidateIds = [...linked.keys()];

  if (submittedOtp) {
    const matchedOTP = await findMatchingValidPendingOtp({
      candidateIds,
      submittedOtp,
      normalizedEmail,
      fullWhatsAppNumber,
    });
    if (matchedOTP) {
      return {
        candidate: matchedOTP.candidate,
        latestOTP: matchedOTP,
        linkedCandidateIds: candidateIds,
      };
    }
  }

  const latestOTP = await findLatestValidPendingOtp({
    candidateIds,
    preferredCandidateId: candidateId,
  });

  if (!latestOTP) {
    const primary = linked.get(candidateId) || linked.values().next().value || null;
    return { candidate: primary, latestOTP: null, linkedCandidateIds: candidateIds };
  }

  return {
    candidate: latestOTP.candidate,
    latestOTP,
    linkedCandidateIds: candidateIds,
  };
}

/**
 * Resolve candidate for OTP login when email + WhatsApp may exist on separate legacy rows.
 * User proves both on login, so we merge onto one record instead of blocking with 409.
 */
async function getOrCreateCandidateForOtp({
  candidateId,
  normalizedEmail,
  fullWhatsAppNumber,
  countryCode,
}) {
  const [byEmail, byId, byWhatsApp] = await Promise.all([
    retryQuery(async () =>
      prisma.candidate.findFirst({
        where: { email: normalizedEmail },
      }),
    ),
    retryQuery(async () =>
      prisma.candidate.findUnique({
        where: { id: candidateId },
      }),
    ),
    findCandidateByWhatsApp(fullWhatsAppNumber),
  ]);

  const linked = new Map();
  for (const row of [byEmail, byId, byWhatsApp]) {
    if (row) linked.set(row.id, row);
  }

  if (linked.size === 0) {
    try {
      return await retryQuery(async () => {
        return await prisma.candidate.upsert({
          where: { id: candidateId },
          update: {
            email: normalizedEmail,
            whatsappNumber: fullWhatsAppNumber,
            countryCode,
          },
          create: {
            id: candidateId,
            email: normalizedEmail,
            whatsappNumber: fullWhatsAppNumber,
            countryCode,
            isVerified: false,
          },
        });
      });
    } catch (error) {
      if (error.code === 'P2002' || error.code === 'P2034') {
        const fallback = await retryQuery(async () => {
          return await prisma.candidate.findFirst({
            where: {
              OR: [{ email: normalizedEmail }, { whatsappNumber: fullWhatsAppNumber }],
            },
          });
        });
        if (fallback) {
          return getOrCreateCandidateForOtp({
            candidateId,
            normalizedEmail,
            fullWhatsAppNumber,
            countryCode,
          });
        }
      }
      throw error;
    }
  }

  // Prefer deterministic email-hash row, then WhatsApp-linked row, then email match.
  const primary = byId || byWhatsApp || byEmail;
  if (!primary) {
    throw new Error('Failed to resolve candidate for OTP login');
  }

  for (const secondary of linked.values()) {
    if (secondary.id !== primary.id) {
      await detachLoginIdentifiersFromCandidate(secondary, {
        normalizedEmail,
        fullWhatsAppNumber,
      });
    }
  }

  return updateCandidateLoginFields(primary, {
    normalizedEmail,
    fullWhatsAppNumber,
    countryCode,
  });
}

/**
 * Send OTP to WhatsApp number
 * POST /api/auth/send-otp
 * body.intent: 'signup' (default) | 'login'
 */
async function sendOTP(req, res) {
  try {
    const { whatsappNumber, countryCode, email, intent: rawIntent } = req.body;
    const intent = String(rawIntent || 'signup').toLowerCase() === 'login' ? 'login' : 'signup';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    let normalizedEmail = String(email || '').trim().toLowerCase();
    let existingAccount = null;
    let cleanNumber = String(whatsappNumber || '').replace(/\D/g, '');
    let resolvedCountryCode = countryCode;
    let fullWhatsAppNumber = resolvedCountryCode && cleanNumber
      ? `${resolvedCountryCode}${cleanNumber}`
      : '';

    // Login by email only: resolve WhatsApp from the existing account
    if (intent === 'login' && normalizedEmail && (!whatsappNumber || !countryCode)) {
      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid email address',
        });
      }

      existingAccount = await retryQuery(async () => {
        return await prisma.candidate.findFirst({
          where: { email: normalizedEmail },
          select: {
            id: true,
            email: true,
            isVerified: true,
            passwordHash: true,
            countryCode: true,
            whatsappNumber: true,
          },
        });
      });

      if (!existingAccount || !existingAccount.isVerified || !existingAccount.whatsappNumber) {
        return res.status(404).json({
          success: false,
          code: 'ACCOUNT_NOT_FOUND',
          message: 'No account found for this email. Create an account to continue.',
        });
      }

      fullWhatsAppNumber = existingAccount.whatsappNumber;
      resolvedCountryCode = existingAccount.countryCode || '+91';
      const dialDigits = String(resolvedCountryCode).replace(/\D/g, '');
      const fullDigits = String(fullWhatsAppNumber).replace(/\D/g, '');
      cleanNumber = dialDigits && fullDigits.startsWith(dialDigits)
        ? fullDigits.slice(dialDigits.length)
        : fullDigits;
    } else if (!whatsappNumber || !countryCode) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp number and country code are required',
      });
    } else {
      // Clean phone number (remove any non-digit characters)
      cleanNumber = String(whatsappNumber).replace(/\D/g, '');

      if (cleanNumber.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Invalid WhatsApp number',
        });
      }

      fullWhatsAppNumber = `${countryCode}${cleanNumber}`;
      resolvedCountryCode = countryCode;
    }

    const resolvedPhone = resolveWhatsAppLogin({
      countryCode: resolvedCountryCode,
      whatsappNumber: cleanNumber,
      existingFullNumber: fullWhatsAppNumber || undefined,
    });
    resolvedCountryCode = resolvedPhone.dialCode;
    cleanNumber = resolvedPhone.localNumber;
    fullWhatsAppNumber = resolvedPhone.fullWhatsAppNumber;

    if (intent === 'login') {
      // Password-or-OTP sign-in: resolve account by phone (email optional / already resolved)
      if (!existingAccount) {
        existingAccount = await findCandidateByWhatsApp(fullWhatsAppNumber);
        if (existingAccount) {
          existingAccount = {
            id: existingAccount.id,
            email: existingAccount.email,
            isVerified: existingAccount.isVerified,
            passwordHash: existingAccount.passwordHash,
            countryCode: existingAccount.countryCode,
            whatsappNumber: existingAccount.whatsappNumber,
          };
        }
      }

      if (!existingAccount || !existingAccount.isVerified) {
        return res.status(404).json({
          success: false,
          code: 'ACCOUNT_NOT_FOUND',
          message: 'No account found for this number. Create an account to continue.',
        });
      }

      if (!normalizedEmail) {
        normalizedEmail = String(existingAccount.email || '').trim().toLowerCase();
      }

      if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          code: 'EMAIL_REQUIRED',
          message: 'Please enter the email linked to this account',
        });
      }
    } else {
      // Create-account flow
      if (!normalizedEmail) {
        return res.status(400).json({
          success: false,
          message: 'WhatsApp number, country code, and email are required',
        });
      }

      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid email address',
        });
      }

      existingAccount = await retryQuery(async () => {
        return await prisma.candidate.findFirst({
          where: {
            OR: [{ whatsappNumber: fullWhatsAppNumber }, { email: normalizedEmail }],
            isVerified: true,
          },
          select: { id: true, passwordHash: true },
        });
      });

      if (existingAccount?.passwordHash) {
        return res.status(409).json({
          success: false,
          code: 'ACCOUNT_EXISTS',
          message: 'An account already exists for these details. Please sign in instead.',
        });
      }
    }

    // Deterministic candidate id from email (same email = same account)
    const candidateId = generateCandidateIdFromEmail(normalizedEmail);

    let candidate = await getOrCreateCandidateForOtp({
      candidateId,
      normalizedEmail,
      fullWhatsAppNumber,
      countryCode: resolvedCountryCode,
    });
    console.log('Candidate ready for OTP flow:', candidate.id);

    const linkedForOtp = await collectLinkedCandidates({
      candidateId,
      normalizedEmail,
      fullWhatsAppNumber,
    });
    await expirePendingOtpsForCandidates([...linkedForOtp.keys()]);

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = getOTPExpiration();

    // Save OTP to database
    const otpVerification = await retryQuery(async () => {
      return await prisma.otpVerification.create({
        data: {
          candidateId: candidate.id,
          otp: normalizeOtpInput(otp),
          status: OtpStatus.PENDING,
          expiresAt: expiresAt,
        },
      });
    });

    // Send OTP via email using Resend
    const emailResult = await sendOTPEmail(normalizeOtpInput(otp), normalizedEmail, fullWhatsAppNumber);
    
    if (!emailResult.success) {
      console.error('Failed to send OTP email:', emailResult.error);
      // Continue anyway - OTP is saved in database, user can still verify
    }

    // Show OTP for local/testing or when email delivery fails and fallback is enabled.
    const allowOtpFallback = process.env.ALLOW_OTP_FALLBACK !== 'false';
    const showOTP = process.env.NODE_ENV === 'development' || (!emailResult.success && allowOtpFallback);

    res.json({
      success: true,
      message: emailResult.success
        ? 'OTP sent successfully to your email'
        : 'OTP generated, but email delivery failed. Use fallback OTP for verification.',
      data: {
        candidateId: candidate.id,
        whatsappNumber: fullWhatsAppNumber,
        countryCode: resolvedCountryCode,
        email: normalizedEmail,
        emailSent: emailResult.success,
        emailMessageId: emailResult.messageId,
        // Only show OTP in development
        ...(showOTP && { otp: otp }),
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    if (error.statusCode === 409 || error.code === 'CANDIDATE_IDENTITY_CONFLICT') {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Verify OTP
 * POST /api/auth/verify-otp
 */
async function verifyOTP(req, res) {
  try {
    const { whatsappNumber, countryCode, otp, email, candidateId: requestedCandidateId } = req.body;

    if (!whatsappNumber || !countryCode || !otp || !email) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp number, country code, email, and OTP are required',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address',
      });
    }

    const cleanNumber = whatsappNumber.replace(/\D/g, '');
    const resolvedPhone = resolveWhatsAppLogin({
      countryCode,
      whatsappNumber: cleanNumber,
    });
    const fullWhatsAppNumber = resolvedPhone.fullWhatsAppNumber;
    const dialCode = resolvedPhone.dialCode;

    const candidateId = generateCandidateIdFromEmail(normalizedEmail);
    console.log(
      'Verifying OTP for email:',
      normalizedEmail,
      '| WhatsApp:',
      fullWhatsAppNumber,
      '| Candidate ID:',
      candidateId,
    );

    const normalizedSubmittedOtp = normalizeOtpInput(otp);
    if (!normalizedSubmittedOtp || normalizedSubmittedOtp.length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 6-digit OTP',
      });
    }

    let candidate = await getOrCreateCandidateForOtp({
      candidateId,
      normalizedEmail,
      fullWhatsAppNumber,
      countryCode: dialCode,
    });
    console.log('Candidate found:', candidate.id);
    console.log('Looking for matching OTP across linked candidates');

    const pendingOtpResult = await findPendingOtpForLogin({
      candidateId,
      normalizedEmail,
      fullWhatsAppNumber,
      submittedOtp: normalizedSubmittedOtp,
    });
    candidate = pendingOtpResult.candidate || candidate;
    let latestOTP = pendingOtpResult.latestOTP;

    if (!latestOTP) {
      console.log('No valid pending OTP matched submitted code');
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP. Please try again or request a new OTP.',
      });
    }

    console.log('Found matching pending OTP, expires at:', latestOTP.expiresAt);

    // Mark OTP as verified
    await retryQuery(async () => {
      return await prisma.otpVerification.update({
        where: { id: latestOTP.id },
        data: { status: OtpStatus.VERIFIED },
      });
    });

    candidate = await retryQuery(async () => {
      return await prisma.candidate.update({
        where: { id: candidate.id },
        data: {
          isVerified: true,
          email: normalizedEmail,
          whatsappNumber: fullWhatsAppNumber,
          countryCode: dialCode,
        },
      });
    });
    console.log('✅ Candidate verified:', candidate.id, '| email:', normalizedEmail);

    // Final verification: Confirm candidate is stored in DB with correct ID
    const finalCandidate = await retryQuery(async () => {
      return await prisma.candidate.findUnique({
        where: { id: candidate.id },
        select: {
          id: true,
          whatsappNumber: true,
          isVerified: true,
          countryCode: true,
        },
      });
    });

    if (finalCandidate) {
      console.log('✅ FINAL VERIFICATION: Candidate confirmed in database');
      console.log('   - ID:', finalCandidate.id);
      console.log('   - WhatsApp:', finalCandidate.whatsappNumber);
      console.log('   - Verified:', finalCandidate.isVerified);
      console.log('   - Country Code:', finalCandidate.countryCode);
    } else {
      console.error('❌ ERROR: Candidate not found in database after verification!');
    }

    console.log('OTP verified successfully. Final candidate ID stored in DB:', candidate.id);

    const withPassword = await retryQuery(async () => {
      return await prisma.candidate.findUnique({
        where: { id: candidate.id },
        select: { passwordHash: true, createdAt: true },
      });
    });
    const needsPassword = !withPassword?.passwordHash;
    const skipCvUpload = await computeSkipCvUpload(
      { id: candidate.id, createdAt: withPassword?.createdAt || candidate.createdAt },
      latestOTP.createdAt
    );

    const token = issueCandidateToken(candidate);
    await createCandidateSession(req, candidate.id, token);
    await syncProfilePhone(candidate);

    // Push full profile snapshot to candidatecommon so Phase 2 "All candidates" can list this user.
    scheduleCandidateCommonSync(candidate.id, { lastLogin: true, forceVerified: true });

    res.json({
      success: true,
      message: 'OTP verified successfully',
      data: {
        candidateId: candidate.id,
        isVerified: true,
        skipCvUpload,
        needsPassword,
        token,
      },
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    if (error.statusCode === 409 || error.code === 'CANDIDATE_IDENTITY_CONFLICT') {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to verify OTP',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Resend OTP
 * POST /api/auth/resend-otp
 */
async function resendOTP(req, res) {
  try {
    const { whatsappNumber, countryCode, email } = req.body;

    // Validation
    if (!whatsappNumber || !countryCode || !email) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp number, country code, and email are required',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address',
      });
    }

    // Clean phone number
    const cleanNumber = whatsappNumber.replace(/\D/g, '');
    const resolvedPhone = resolveWhatsAppLogin({
      countryCode,
      whatsappNumber: cleanNumber,
    });
    const fullWhatsAppNumber = resolvedPhone.fullWhatsAppNumber;
    const dialCode = resolvedPhone.dialCode;

    const candidateId = generateCandidateIdFromEmail(normalizedEmail);

    const candidate = await getOrCreateCandidateForOtp({
      candidateId,
      normalizedEmail,
      fullWhatsAppNumber,
      countryCode: dialCode,
    });

    const linkedForOtp = await collectLinkedCandidates({
      candidateId,
      normalizedEmail,
      fullWhatsAppNumber,
    });
    await expirePendingOtpsForCandidates([...linkedForOtp.keys()]);

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = getOTPExpiration();

    // Save OTP to database
    await prisma.otpVerification.create({
      data: {
        candidateId: candidate.id,
        otp: normalizeOtpInput(otp),
        status: OtpStatus.PENDING,
        expiresAt: expiresAt,
      },
    });

    // Send OTP via email using Resend
    const emailResult = await sendOTPEmail(normalizeOtpInput(otp), normalizedEmail, fullWhatsAppNumber);
    
    if (!emailResult.success) {
      console.error('Failed to resend OTP email:', emailResult.error);
      // Continue anyway - OTP is saved in database
    }

    // Show OTP for local/testing or when email delivery fails and fallback is enabled.
    const allowOtpFallback = process.env.ALLOW_OTP_FALLBACK !== 'false';
    const showOTP = process.env.NODE_ENV === 'development' || (!emailResult.success && allowOtpFallback);

    res.json({
      success: true,
      message: emailResult.success
        ? 'OTP resent successfully to your email'
        : 'OTP regenerated, but email delivery failed. Use fallback OTP for verification.',
      data: {
        candidateId: candidate.id,
        whatsappNumber: fullWhatsAppNumber,
        email: normalizedEmail,
        emailSent: emailResult.success,
        emailMessageId: emailResult.messageId,
        // Only show OTP in development
        ...(showOTP && { otp: otp }),
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error resending OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend OTP',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Sign in with WhatsApp number or email + password
 * POST /api/auth/login
 */
async function loginWithPassword(req, res) {
  try {
    const { whatsappNumber, countryCode, email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const hasEmail = Boolean(normalizedEmail);
    const rawPhone = String(whatsappNumber || '').trim();
    const hasPhone = Boolean(rawPhone);

    if (!password || (!hasEmail && !hasPhone)) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_FIELDS',
        message: 'Password and either mobile number or email are required',
      });
    }

    if (hasEmail && !emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_EMAIL',
        message: 'Please enter a valid email address',
      });
    }

    let candidate = null;

    if (hasEmail) {
      candidate = await retryQuery(async () => {
        return await prisma.candidate.findFirst({
          where: { email: normalizedEmail },
        });
      });
    } else {
      const cleanNumber = rawPhone.replace(/\D/g, '');
      if (cleanNumber.length < 6 && !rawPhone.startsWith('+')) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_NUMBER',
          message: 'Invalid mobile number',
        });
      }

      const resolvedPhone = resolveWhatsAppLogin({
        countryCode: countryCode || '+91',
        whatsappNumber: rawPhone.startsWith('+') ? rawPhone : cleanNumber,
      });
      const fullWhatsAppNumber = resolvedPhone.fullWhatsAppNumber;
      const localNumber = resolvedPhone.localNumber;

      // Primary: flexible WhatsApp match (handles +91 / 91 / legacy formats)
      candidate = await findCandidateByWhatsApp(fullWhatsAppNumber);

      // Fallback: profile / candidate local phone (Basic Info updates)
      if (!candidate && localNumber) {
        const last10 = localNumber.slice(-10);
        candidate = await retryQuery(async () => {
          return await prisma.candidate.findFirst({
            where: {
              OR: [
                { phone: localNumber },
                { phone: last10 },
                { phone: { endsWith: last10 } },
                {
                  profile: {
                    OR: [
                      { phoneNumber: localNumber },
                      { phoneNumber: last10 },
                      { phoneNumber: { endsWith: last10 } },
                    ],
                  },
                },
              ],
            },
          });
        });
      }
    }

    // Account does not exist (or never completed verification) → create account
    if (!candidate || !candidate.isVerified) {
      return res.status(404).json({
        success: false,
        code: 'ACCOUNT_NOT_FOUND',
        message: hasEmail
          ? 'No account found for this email. Create an account to continue.'
          : 'No account found for this number. Create an account to continue.',
      });
    }

    if (!candidate.passwordHash) {
      return res.status(400).json({
        success: false,
        code: 'PASSWORD_NOT_SET',
        message: 'No password is set for this account yet. Create one via Create account.',
      });
    }

    const isValid = await bcrypt.compare(String(password), candidate.passwordHash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        code: 'INVALID_CREDENTIALS',
        message: hasEmail
          ? 'That email and password do not match. Try again.'
          : 'That number and password do not match. Try again.',
      });
    }

    const skipCvUpload = await computeSkipCvUpload(candidate);
    const token = issueCandidateToken(candidate);
    await createCandidateSession(req, candidate.id, token);
    await syncProfilePhone(candidate);
    scheduleCandidateCommonSync(candidate.id, { lastLogin: true, forceVerified: true });

    res.json({
      success: true,
      message: 'Signed in successfully',
      data: {
        candidateId: candidate.id,
        isVerified: true,
        skipCvUpload,
        needsPassword: false,
        token,
      },
    });
  } catch (error) {
    console.error('Error logging in with password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sign in',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Set password after OTP verification (create-account flow)
 * POST /api/auth/set-password
 * Requires Bearer token from verify-otp
 */
async function setPassword(req, res) {
  try {
    const candidateId = req.user?.candidateId;
    if (!candidateId) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Not authorized',
      });
    }

    const check = validatePasswordPair(req.body.password, req.body.confirmPassword);
    if (!check.ok) {
      return res.status(check.status).json({
        success: false,
        code: check.code,
        message: check.message,
      });
    }

    const candidate = await retryQuery(async () => {
      return await prisma.candidate.findUnique({
        where: { id: candidateId },
        select: { id: true, isVerified: true, createdAt: true },
      });
    });

    if (!candidate || !candidate.isVerified) {
      return res.status(400).json({
        success: false,
        code: 'NOT_VERIFIED',
        message: 'Verify your email before setting a password',
      });
    }

    const passwordHash = await bcrypt.hash(check.password, 10);
    await retryQuery(async () => {
      return await prisma.candidate.update({
        where: { id: candidateId },
        data: { passwordHash },
      });
    });

    const skipCvUpload = await computeSkipCvUpload(candidate);

    res.json({
      success: true,
      message: 'Password saved successfully',
      data: {
        candidateId,
        skipCvUpload,
      },
    });
  } catch (error) {
    console.error('Error setting password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set password',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function checkCredential(req, res) {
  try {
    const {
      type: rawType,
      value,
      countryCode,
      excludeCandidateId,
      intent: rawIntent,
    } = req.body || {};
    const type = String(rawType || '').toLowerCase() === 'phone' ? 'phone' : 'email';
    const intent = String(rawIntent || 'signup').toLowerCase();

    if (type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const normalizedEmail = String(value || '').trim().toLowerCase();
      if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          available: false,
          code: 'INVALID_EMAIL',
          message: 'Please enter a valid email address',
        });
      }

      // Indexed lookup only — no full table scan
      const existing = await retryQuery(async () => {
        return await prisma.candidate.findFirst({
          where: {
            email: normalizedEmail,
            ...(excludeCandidateId ? { NOT: { id: String(excludeCandidateId) } } : {}),
          },
          select: { id: true, isVerified: true, passwordHash: true },
        });
      });

      if (existing && (existing.isVerified || existing.passwordHash || intent === 'signup')) {
        return res.json({
          success: true,
          available: false,
          takenByOther: true,
          code: 'EMAIL_TAKEN',
          message:
            intent === 'profile'
              ? 'This email is already used by another account.'
              : 'An account with this email already exists. Sign in instead.',
        });
      }

      return res.json({
        success: true,
        available: true,
        takenByOther: false,
        code: 'EMAIL_AVAILABLE',
      });
    }

    // phone
    const cleanNumber = String(value || '').replace(/\D/g, '');
    if (!cleanNumber || cleanNumber.length < 6) {
      return res.status(400).json({
        success: false,
        available: false,
        code: 'INVALID_PHONE',
        message: 'Please enter a valid mobile number',
      });
    }

    const resolvedCountryCode = countryCode || '+91';
    const fullWhatsAppNumber = `${resolvedCountryCode}${cleanNumber}`;
    const resolvedPhone = resolveWhatsAppLogin({
      countryCode: resolvedCountryCode,
      whatsappNumber: cleanNumber,
      existingFullNumber: fullWhatsAppNumber,
    });
    const normalizedFull =
      resolvedPhone?.fullNumber || fullWhatsAppNumber;

    // Prefer unique index on whatsappNumber; fallback legacy match helper
    let existing = await retryQuery(async () => {
      return await prisma.candidate.findFirst({
        where: {
          whatsappNumber: normalizedFull,
          ...(excludeCandidateId ? { NOT: { id: String(excludeCandidateId) } } : {}),
        },
        select: { id: true, isVerified: true, passwordHash: true },
      });
    });

    if (!existing) {
      existing = await findCandidateByWhatsAppFlexible(normalizedFull, excludeCandidateId);
    }

    if (existing && (existing.isVerified || existing.passwordHash || intent === 'signup')) {
      return res.json({
        success: true,
        available: false,
        takenByOther: true,
        code: 'PHONE_TAKEN',
        message:
          intent === 'profile'
            ? 'This mobile number is already used by another account.'
            : 'An account with this mobile number already exists. Sign in instead.',
      });
    }

    return res.json({
      success: true,
      available: true,
      takenByOther: false,
      code: 'PHONE_AVAILABLE',
    });
  } catch (error) {
    console.error('Error checking credential:', error);
    return res.status(500).json({
      success: false,
      available: false,
      code: 'CHECK_FAILED',
      message: 'Could not verify uniqueness right now',
    });
  }
}

/**
 * Flexible WhatsApp match using existing helpers — still candidate-scoped, not a dump of all users.
 */
async function findCandidateByWhatsAppFlexible(normalizedFull, excludeCandidateId) {
  try {
    const dialDigits = String(normalizedFull || '').replace(/\D/g, '');
    if (dialDigits.length < 6) return null;
    const last10 = dialDigits.slice(-10);
    const rows = await retryQuery(async () => {
      return await prisma.candidate.findMany({
        where: {
          whatsappNumber: { contains: last10 },
          ...(excludeCandidateId ? { NOT: { id: String(excludeCandidateId) } } : {}),
        },
        select: { id: true, isVerified: true, passwordHash: true, whatsappNumber: true },
        take: 8,
      });
    });
    return (
      rows.find((row) => whatsappNumbersMatch(row.whatsappNumber, normalizedFull)) || null
    );
  } catch {
    return null;
  }
}

/**
 * List login sessions for the authenticated candidate (device / IP / location).
 * GET /api/auth/sessions
 */
async function listSessions(req, res) {
  try {
    const candidateId = req.user?.candidateId || req.user?.id;
    if (!candidateId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const limit = Math.min(100, Math.max(1, Number(req.query?.limit) || 40));
    const sessions = await retryQuery(async () =>
      prisma.session.findMany({
        where: { candidateId },
        orderBy: { loginAt: 'desc' },
        take: limit,
        select: {
          id: true,
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
          expiresAt: true,
        },
      }),
    );

    const activeCount = sessions.filter((s) => s.isActive !== false).length;
    const uniqueIps = new Set(
      sessions.map((s) => s.ipAddress).filter((ip) => ip && ip !== 'unknown'),
    );
    const uniqueDevices = new Set(
      sessions
        .map((s) => [s.deviceType, s.browser, s.operatingSystem].filter(Boolean).join('|'))
        .filter(Boolean),
    );

    return res.json({
      success: true,
      data: {
        sessions,
        summary: {
          total: sessions.length,
          active: activeCount,
          uniqueIps: uniqueIps.size,
          uniqueDevices: uniqueDevices.size,
        },
      },
    });
  } catch (error) {
    console.error('Error listing sessions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load sessions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Request password reset OTP (verified accounts with a password only)
 * POST /api/auth/forgot-password
 */
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address',
      });
    }

    const candidate = await retryQuery(async () => {
      return await prisma.candidate.findFirst({
        where: { email: normalizedEmail },
        select: {
          id: true,
          email: true,
          isVerified: true,
          passwordHash: true,
          whatsappNumber: true,
          countryCode: true,
        },
      });
    });

    if (!candidate || !candidate.isVerified || !candidate.passwordHash) {
      return res.status(404).json({
        success: false,
        code: 'ACCOUNT_NOT_FOUND',
        message: 'No password account found for this email. Sign in with OTP or create an account.',
      });
    }

    if (!candidate.whatsappNumber) {
      return res.status(400).json({
        success: false,
        message: 'This account is missing a linked WhatsApp number. Contact support.',
      });
    }

    const fullWhatsAppNumber = candidate.whatsappNumber;
    const resolvedCountryCode = candidate.countryCode || '+91';
    const dialDigits = String(resolvedCountryCode).replace(/\D/g, '');
    const fullDigits = String(fullWhatsAppNumber).replace(/\D/g, '');
    const cleanNumber =
      dialDigits && fullDigits.startsWith(dialDigits)
        ? fullDigits.slice(dialDigits.length)
        : fullDigits;

    const candidateId = generateCandidateIdFromEmail(normalizedEmail);
    const otpCandidate = await getOrCreateCandidateForOtp({
      candidateId,
      normalizedEmail,
      fullWhatsAppNumber,
      countryCode: resolvedCountryCode,
    });

    const linkedForOtp = await collectLinkedCandidates({
      candidateId,
      normalizedEmail,
      fullWhatsAppNumber,
    });
    await expirePendingOtpsForCandidates([...linkedForOtp.keys()]);

    const otp = generateOTP();
    const expiresAt = getOTPExpiration();

    await retryQuery(async () => {
      return await prisma.otpVerification.create({
        data: {
          candidateId: otpCandidate.id,
          otp: normalizeOtpInput(otp),
          status: OtpStatus.PENDING,
          expiresAt,
        },
      });
    });

    const emailResult = await sendOTPEmail(
      normalizeOtpInput(otp),
      normalizedEmail,
      fullWhatsAppNumber,
    );

    if (!emailResult.success) {
      console.error('Failed to send password reset OTP email:', emailResult.error);
    }

    const allowOtpFallback = process.env.ALLOW_OTP_FALLBACK !== 'false';
    const showOTP =
      process.env.NODE_ENV === 'development' || (!emailResult.success && allowOtpFallback);

    return res.json({
      success: true,
      message: emailResult.success
        ? 'Password reset code sent to your email'
        : 'Reset code generated, but email delivery failed. Use the fallback code if shown.',
      data: {
        candidateId: otpCandidate.id,
        whatsappNumber: cleanNumber,
        countryCode: resolvedCountryCode,
        email: normalizedEmail,
        emailSent: emailResult.success,
        ...(showOTP && { otp }),
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error requesting password reset:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send password reset code',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Reset password with email OTP
 * POST /api/auth/reset-password
 */
async function resetPassword(req, res) {
  try {
    const { email, otp, password, confirmPassword } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address',
      });
    }

    const normalizedSubmittedOtp = normalizeOtpInput(otp);
    if (!normalizedSubmittedOtp || normalizedSubmittedOtp.length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 6-digit code',
      });
    }

    const check = validatePasswordPair(password, confirmPassword);
    if (!check.ok) {
      return res.status(check.status).json({
        success: false,
        code: check.code,
        message: check.message,
      });
    }

    const candidate = await retryQuery(async () => {
      return await prisma.candidate.findFirst({
        where: { email: normalizedEmail },
      });
    });

    if (!candidate || !candidate.isVerified) {
      return res.status(404).json({
        success: false,
        code: 'ACCOUNT_NOT_FOUND',
        message: 'No verified account found for this email.',
      });
    }

    if (!candidate.whatsappNumber) {
      return res.status(400).json({
        success: false,
        message: 'This account is missing a linked WhatsApp number. Contact support.',
      });
    }

    const fullWhatsAppNumber = candidate.whatsappNumber;
    const dialCode = candidate.countryCode || '+91';
    const candidateId = generateCandidateIdFromEmail(normalizedEmail);

    const pendingOtpResult = await findPendingOtpForLogin({
      candidateId,
      normalizedEmail,
      fullWhatsAppNumber,
      submittedOtp: normalizedSubmittedOtp,
    });

    if (!pendingOtpResult.latestOTP) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset code. Request a new one.',
      });
    }

    await retryQuery(async () => {
      return await prisma.otpVerification.update({
        where: { id: pendingOtpResult.latestOTP.id },
        data: { status: OtpStatus.VERIFIED },
      });
    });

    const passwordHash = await bcrypt.hash(check.password, 10);
    const updatedCandidate = await retryQuery(async () => {
      return await prisma.candidate.update({
        where: { id: candidate.id },
        data: { passwordHash },
      });
    });

    const token = issueCandidateToken(updatedCandidate);
    await createCandidateSession(req, updatedCandidate.id, token);
    await syncProfilePhone(updatedCandidate);
    scheduleCandidateCommonSync(updatedCandidate.id, { lastLogin: true, forceVerified: true });

    return res.json({
      success: true,
      message: 'Password reset successfully',
      data: {
        candidateId: updatedCandidate.id,
        token,
        skipCvUpload: await computeSkipCvUpload(updatedCandidate),
      },
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset password',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

module.exports = {
  sendOTP,
  verifyOTP,
  resendOTP,
  loginWithPassword,
  setPassword,
  forgotPassword,
  resetPassword,
  logout,
  checkCredential,
  listSessions,
};



