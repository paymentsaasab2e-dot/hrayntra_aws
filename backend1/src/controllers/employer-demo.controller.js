const { prisma, retryQuery } = require('../lib/prisma');
const { generateOTP, getOTPExpiration, isOTPExpired } = require('../utils/otp.util');
const { sendOTPEmail } = require('../services/email.service');
const { OtpStatus } = require('@prisma/client');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validateDemoPayload(body) {
  const {
    email,
    fullName,
    countryCode,
    dialCode,
    phoneNumber,
    companySize,
    organizationName,
  } = body;

  const normalizedEmail = normalizeEmail(email);
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return { error: 'Please enter a valid email address' };
  }
  if (!String(fullName || '').trim()) {
    return { error: 'Full name is required' };
  }
  if (!String(countryCode || '').trim()) {
    return { error: 'Country is required' };
  }
  if (!String(dialCode || '').trim()) {
    return { error: 'Phone country code is required' };
  }
  const cleanPhone = String(phoneNumber || '').replace(/\D/g, '');
  if (cleanPhone.length < 6) {
    return { error: 'Please enter a valid phone number' };
  }
  if (!String(companySize || '').trim()) {
    return { error: 'Company size is required' };
  }
  if (!String(organizationName || '').trim()) {
    return { error: 'Organization name is required' };
  }

  return {
    normalizedEmail,
    payload: {
      email: normalizedEmail,
      fullName: String(fullName).trim(),
      countryCode: String(countryCode).trim(),
      dialCode: String(dialCode).trim(),
      phoneNumber: cleanPhone,
      companySize: String(companySize).trim(),
      organizationName: String(organizationName).trim(),
      outcome: String(body.outcome || '').trim() || null,
      requestKind: String(body.requestKind || 'demo').trim().toLowerCase() === 'trial' ? 'trial' : 'demo',
    },
  };
}

async function expirePendingDemoOtps(email) {
  await retryQuery(async () =>
    prisma.employerDemoRequest.updateMany({
      where: { email, otpStatus: OtpStatus.PENDING },
      data: { otpStatus: OtpStatus.EXPIRED },
    }),
  );
}

async function sendDemoRequestOtp(req, res) {
  try {
    const validated = validateDemoPayload(req.body);
    if (validated.error) {
      return res.status(400).json({ success: false, message: validated.error });
    }

    const { normalizedEmail, payload } = validated;
    const otp = generateOTP();
    const expiresAt = getOTPExpiration();

    await expirePendingDemoOtps(normalizedEmail);

    const record = await retryQuery(async () =>
      prisma.employerDemoRequest.create({
        data: {
          ...payload,
          otp,
          otpStatus: OtpStatus.PENDING,
          otpExpiresAt: expiresAt,
        },
      }),
    );

    const phoneDisplay = `${payload.dialCode}${payload.phoneNumber}`;
    const emailResult = await sendOTPEmail(otp, normalizedEmail, phoneDisplay);
    const allowOtpFallback = process.env.ALLOW_OTP_FALLBACK !== 'false';
    const showOTP =
      process.env.NODE_ENV === 'development' || (!emailResult.success && allowOtpFallback);

    return res.json({
      success: true,
      message: emailResult.success
        ? 'Verification code sent to your email'
        : 'Verification code generated. Use the fallback code if email delivery failed.',
      data: {
        requestId: record.id,
        email: normalizedEmail,
        ...(showOTP ? { otp } : {}),
      },
    });
  } catch (error) {
    console.error('sendDemoRequestOtp error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send verification code',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function resendDemoRequestOtp(req, res) {
  try {
    const { requestId, email } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!requestId || !normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: 'Request id and email are required',
      });
    }

    const existing = await retryQuery(async () =>
      prisma.employerDemoRequest.findFirst({
        where: {
          id: requestId,
          email: normalizedEmail,
          otpStatus: OtpStatus.PENDING,
        },
      }),
    );

    if (!existing) {
      return res.status(400).json({
        success: false,
        message: 'No pending demo request found. Please submit the form again.',
      });
    }

    const otp = generateOTP();
    const expiresAt = getOTPExpiration();

    await expirePendingDemoOtps(normalizedEmail);

    const record = await retryQuery(async () =>
      prisma.employerDemoRequest.update({
        where: { id: existing.id },
        data: {
          otp,
          otpStatus: OtpStatus.PENDING,
          otpExpiresAt: expiresAt,
        },
      }),
    );

    const phoneDisplay = `${record.dialCode}${record.phoneNumber}`;
    const emailResult = await sendOTPEmail(otp, normalizedEmail, phoneDisplay);
    const allowOtpFallback = process.env.ALLOW_OTP_FALLBACK !== 'false';
    const showOTP =
      process.env.NODE_ENV === 'development' || (!emailResult.success && allowOtpFallback);

    return res.json({
      success: true,
      message: emailResult.success
        ? 'A new verification code was sent to your email'
        : 'Verification code regenerated. Use the fallback code if email delivery failed.',
      data: {
        requestId: record.id,
        email: normalizedEmail,
        ...(showOTP ? { otp } : {}),
      },
    });
  } catch (error) {
    console.error('resendDemoRequestOtp error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to resend verification code',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function syncEmployerTrialToPhase2(verified) {
  const base =
    process.env.PHASE2_INTERNAL_API_URL ||
    process.env.PHASE2_API_URL ||
    process.env.PHASE2_BASE_URL ||
    'http://localhost:5001';
  const secret =
    process.env.PHASE2_PORTAL_SYNC_SECRET || 'phase2-portal-sync-2026-shared-secret';

  try {
    const response = await fetch(`${base}/api/v1/internal/provision-employer-trial`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-phase2-portal-sync-secret': secret,
      },
      body: JSON.stringify({
        requestId: verified.id,
        fullName: verified.fullName,
        email: verified.email,
        countryCode: verified.countryCode,
        dialCode: verified.dialCode,
        phoneNumber: verified.phoneNumber,
        companySize: verified.companySize,
        organizationName: verified.organizationName,
        outcome: verified.outcome || '',
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.warn('[EmployerTrial] Phase2 provision failed:', payload?.message || response.statusText);
      return null;
    }
    return payload?.data || null;
  } catch (error) {
    console.warn('[EmployerTrial] Phase2 provision error:', error?.message || error);
    return null;
  }
}

async function syncEmployerDemoToHq(verified) {
  const base =
    process.env.PHASE2_INTERNAL_API_URL ||
    process.env.PHASE2_API_URL ||
    process.env.PHASE2_BASE_URL ||
    'http://localhost:5001';
  const secret =
    process.env.PHASE2_PORTAL_SYNC_SECRET || 'phase2-portal-sync-2026-shared-secret';

  try {
    const response = await fetch(`${base}/api/v1/internal/sync-employer-demo-verified`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-phase2-portal-sync-secret': secret,
      },
      body: JSON.stringify({
        requestId: verified.id,
        fullName: verified.fullName,
        email: verified.email,
        countryCode: verified.countryCode,
        dialCode: verified.dialCode,
        phoneNumber: verified.phoneNumber,
        companySize: verified.companySize,
        organizationName: verified.organizationName,
        outcome: verified.outcome || '',
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      console.warn(
        '[EmployerDemo] HQ lead sync failed:',
        payload?.message || response.statusText,
      );
    }
  } catch (error) {
    console.warn('[EmployerDemo] HQ lead sync error:', error?.message || error);
  }
}

async function verifyDemoRequestOtp(req, res) {
  try {
    const { requestId, email, otp } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const code = String(otp || '').trim();

    if (!requestId || !normalizedEmail || code.length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'Request id, email, and a valid 6-digit code are required',
      });
    }

    const pending = await retryQuery(async () =>
      prisma.employerDemoRequest.findFirst({
        where: {
          id: requestId,
          email: normalizedEmail,
          otpStatus: OtpStatus.PENDING,
        },
      }),
    );

    if (!pending) {
      return res.status(400).json({
        success: false,
        message: 'No pending verification found. Please request a new code.',
      });
    }

    if (isOTPExpired(pending.otpExpiresAt)) {
      await retryQuery(async () =>
        prisma.employerDemoRequest.update({
          where: { id: pending.id },
          data: { otpStatus: OtpStatus.EXPIRED },
        }),
      );
      return res.status(400).json({
        success: false,
        message: 'Verification code expired. Please request a new one.',
      });
    }

    if (pending.otp !== code) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code. Please try again.',
      });
    }

    const verified = await retryQuery(async () =>
      prisma.employerDemoRequest.update({
        where: { id: pending.id },
        data: {
          otpStatus: OtpStatus.VERIFIED,
          emailVerifiedAt: new Date(),
        },
      }),
    );

    const isTrial = String(verified.requestKind || '').toLowerCase() === 'trial';
    let trialProvision = null;
    if (isTrial) {
      trialProvision = await syncEmployerTrialToPhase2(verified);
      if (!trialProvision) {
        return res.status(502).json({
          success: false,
          message: 'Email verified, but we could not start your trial workspace. Please contact support.',
        });
      }
      await retryQuery(async () =>
        prisma.employerDemoRequest.update({
          where: { id: verified.id },
          data: {
            trialProvisioned: true,
            trialTenantDbName: trialProvision.tenantDbName || null,
            trialLoginId: trialProvision.loginId || null,
            trialStartsAt: trialProvision.subscriptionPlan?.planStartDate || null,
            trialEndsAt: trialProvision.trialEndsAt || null,
            trialLoginUrl: trialProvision.loginUrl || null,
          },
        }),
      );
    } else {
      await syncEmployerDemoToHq(verified);
    }

    return res.json({
      success: true,
      message: isTrial
        ? 'Email verified. Your 5-day trial workspace is ready.'
        : 'Email verified. Your demo request has been submitted.',
      data: {
        requestId: verified.id,
        email: verified.email,
        requestKind: verified.requestKind || 'demo',
        ...(isTrial && trialProvision
          ? {
              loginUrl: trialProvision.loginUrl,
              loginId: trialProvision.loginId,
              trialEndsAt: trialProvision.trialEndsAt,
              tenantDbName: trialProvision.tenantDbName,
              credentialEmailSent: trialProvision.credentialEmailSent,
              ...(trialProvision.devPassword ? { devPassword: trialProvision.devPassword } : {}),
            }
          : {}),
      },
    });
  } catch (error) {
    console.error('verifyDemoRequestOtp error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify code',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

module.exports = {
  sendDemoRequestOtp,
  resendDemoRequestOtp,
  verifyDemoRequestOtp,
};
