const { prisma, retryQuery } = require('../lib/prisma');
const { scheduleCandidateCommonSync } = require('../services/candidateCommonSync.service');
const { generateOTP, getOTPExpiration, isOTPExpired } = require('../utils/otp.util');
const { generateCandidateIdFromEmail } = require('../utils/candidate.util');
const { sendOTPEmail } = require('../services/email.service');
const { OtpStatus } = require('@prisma/client');
const { isPortalPlaceholderFullName } = require('../utils/portal-profile-placeholder.util');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

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

async function createCandidateSession(req, candidateId, token) {
  try {
    await prisma.session.create({
      data: {
        candidateId,
        token,
        userAgent: req.headers['user-agent'] || 'unknown',
        ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  } catch (sessionError) {
    console.error('⚠️ Failed to create session record:', sessionError.message);
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
  await retryQuery(async () => {
    return await prisma.candidate.update({
      where: { id: candidate.id },
      data: patch,
    });
  });
}

async function updateCandidateLoginFields(candidate, { normalizedEmail, fullWhatsAppNumber, countryCode }) {
  const needsUpdate =
    (candidate.email || '').toLowerCase() !== normalizedEmail ||
    candidate.countryCode !== countryCode ||
    candidate.whatsappNumber !== fullWhatsAppNumber;

  if (!needsUpdate) {
    return candidate;
  }

  return retryQuery(async () => {
    return await prisma.candidate.update({
      where: { id: candidate.id },
      data: {
        email: normalizedEmail,
        countryCode,
        whatsappNumber: fullWhatsAppNumber,
      },
    });
  });
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
    retryQuery(async () =>
      prisma.candidate.findUnique({
        where: { whatsappNumber: fullWhatsAppNumber },
      }),
    ),
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

  // Prefer the WhatsApp-linked row (unique phone), then email-id row, then email match.
  const primary = byWhatsApp || byId || byEmail;
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

    if (intent === 'login') {
      // Password-or-OTP sign-in: resolve account by phone (email optional / already resolved)
      if (!existingAccount) {
        existingAccount = await retryQuery(async () => {
          return await prisma.candidate.findUnique({
            where: { whatsappNumber: fullWhatsAppNumber },
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
    // Invalidate all previous pending OTPs for this candidate
    await retryQuery(async () => {
      return await prisma.otpVerification.updateMany({
        where: {
          candidateId: candidate.id,
          status: OtpStatus.PENDING,
        },
        data: {
          status: OtpStatus.EXPIRED,
        },
      });
    });

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = getOTPExpiration();

    // Save OTP to database
    const otpVerification = await retryQuery(async () => {
      return await prisma.otpVerification.create({
        data: {
          candidateId: candidate.id,
          otp: otp,
          status: OtpStatus.PENDING,
          expiresAt: expiresAt,
        },
      });
    });

    // Send OTP via email using Resend
    const emailResult = await sendOTPEmail(otp, normalizedEmail, fullWhatsAppNumber);
    
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
    const { whatsappNumber, countryCode, otp, email } = req.body;

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
    const fullWhatsAppNumber = `${countryCode}${cleanNumber}`;

    const candidateId = generateCandidateIdFromEmail(normalizedEmail);
    console.log(
      'Verifying OTP for email:',
      normalizedEmail,
      '| WhatsApp:',
      fullWhatsAppNumber,
      '| Candidate ID:',
      candidateId,
    );

    let candidate = await getOrCreateCandidateForOtp({
      candidateId,
      normalizedEmail,
      fullWhatsAppNumber,
      countryCode,
    });
    console.log('Candidate found:', candidate.id);
    // Now find the latest pending OTP for this candidate
    console.log('Looking for pending OTP for candidate:', candidate.id);
    let latestOTP = await retryQuery(async () => {
      return await prisma.otpVerification.findFirst({
        where: {
          candidateId: candidate.id,
          status: OtpStatus.PENDING,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    // If no OTP found for this candidate, try to find any pending OTP for this WhatsApp number
    // (in case OTP was created with a different candidate ID)
    if (!latestOTP) {
      console.log('No OTP found for candidate, searching by WhatsApp number...');
      const otpWithCandidate = await retryQuery(async () => {
        return await prisma.otpVerification.findFirst({
          where: {
            status: OtpStatus.PENDING,
            candidate: {
              whatsappNumber: fullWhatsAppNumber,
            },
          },
          include: {
            candidate: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });
      });

      if (otpWithCandidate) {
        console.log('Found OTP with different candidate, using that candidate:', otpWithCandidate.candidate.id);
        // Update candidate reference to use the one that has the OTP
        candidate = otpWithCandidate.candidate;
        latestOTP = otpWithCandidate;
      }
    }

    if (latestOTP) {
      console.log('Found pending OTP, expires at:', latestOTP.expiresAt);
    } else {
      console.log('No pending OTP found');
      return res.status(400).json({
        success: false,
        message: 'No pending OTP found. Please request a new OTP.',
      });
    }

    // Check if OTP is expired
    if (isOTPExpired(latestOTP.expiresAt)) {
      await retryQuery(async () => {
        return await prisma.otpVerification.update({
          where: { id: latestOTP.id },
          data: { status: OtpStatus.EXPIRED },
        });
      });

      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new OTP.',
      });
    }

    // Verify OTP
    if (latestOTP.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP. Please try again.',
      });
    }

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
          countryCode,
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
    const fullWhatsAppNumber = `${countryCode}${cleanNumber}`;

    const candidateId = generateCandidateIdFromEmail(normalizedEmail);

    const candidate = await getOrCreateCandidateForOtp({
      candidateId,
      normalizedEmail,
      fullWhatsAppNumber,
      countryCode,
    });

    // Invalidate all previous pending OTPs
    await prisma.otpVerification.updateMany({
      where: {
        candidateId: candidate.id,
        status: OtpStatus.PENDING,
      },
      data: {
        status: OtpStatus.EXPIRED,
      },
    });

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = getOTPExpiration();

    // Save OTP to database
    await prisma.otpVerification.create({
      data: {
        candidateId: candidate.id,
        otp: otp,
        status: OtpStatus.PENDING,
        expiresAt: expiresAt,
      },
    });

    // Send OTP via email using Resend
    const emailResult = await sendOTPEmail(otp, normalizedEmail, fullWhatsAppNumber);
    
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
    const hasPhone = Boolean(whatsappNumber && countryCode);

    if (!password || (!hasEmail && !hasPhone)) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_FIELDS',
        message: 'Password and either WhatsApp number or email are required',
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
      const cleanNumber = String(whatsappNumber).replace(/\D/g, '');
      if (cleanNumber.length < 6) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_NUMBER',
          message: 'Invalid WhatsApp number',
        });
      }

      const fullWhatsAppNumber = `${countryCode}${cleanNumber}`;
      candidate = await retryQuery(async () => {
        return await prisma.candidate.findUnique({
          where: { whatsappNumber: fullWhatsAppNumber },
        });
      });
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

module.exports = {
  sendOTP,
  verifyOTP,
  resendOTP,
  loginWithPassword,
  setPassword,
};



