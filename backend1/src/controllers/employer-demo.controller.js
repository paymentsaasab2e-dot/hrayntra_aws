const { prisma, retryQuery } = require('../lib/prisma');
const { generateOTP, getOTPExpiration, isOTPExpired } = require('../utils/otp.util');
const { sendOTPEmail } = require('../services/email.service');
const { postPhase2Internal } = require('../utils/phase2InternalApi.util');
const { OtpStatus } = require('@prisma/client');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function persistEmployerDemoProvision(requestId, patch = {}) {
  const id = String(requestId || '').trim();
  if (!id) return;

  const set = {
    trialProvisioned: true,
    updatedAt: new Date(),
  };
  if (patch.tenantDbName) set.trialTenantDbName = String(patch.tenantDbName);
  if (patch.loginId) set.trialLoginId = String(patch.loginId);
  if (patch.loginUrl) set.trialLoginUrl = String(patch.loginUrl);
  if (patch.planStartDate) set.trialStartsAt = String(patch.planStartDate);
  if (patch.planEndDate) set.trialEndsAt = String(patch.planEndDate);

  try {
    await retryQuery(() =>
      prisma.employerDemoRequest.update({
        where: { id },
        data: set,
      }),
    );
  } catch (err) {
    const message = String(err?.message || err || '');
    if (!message.includes('Unknown argument')) {
      throw err;
    }
    // Stale Prisma client in a long-running dev server — write via Mongo command instead.
    await retryQuery(() =>
      prisma.$runCommandRaw({
        update: 'employer_demo_requests',
        updates: [
          {
            q: { _id: { $oid: id } },
            u: { $set: set },
          },
        ],
      }),
    );
  }
}

function buildProvisionResponse(requestId, email, provision) {
  return {
    requestId,
    email,
    loginUrl: provision?.loginUrl,
    loginId: provision?.loginId,
    tenantDbName: provision?.tenantDbName,
    subscriptionPlan: provision?.subscriptionPlan,
    credentialEmailSent: provision?.credentialEmailSent,
    credentialEmailError: provision?.credentialEmailError,
    ...(provision?.devPassword ? { devPassword: provision.devPassword } : {}),
  };
}

function encodePurchaseOutcome(packageSlug, billingCycle, userOutcome) {
  const slug = String(packageSlug || 'starter').trim().toLowerCase();
  const cycle = String(billingCycle || 'monthly').trim().toLowerCase() === 'annual' ? 'annual' : 'monthly';
  const prefix = `[package:${slug};cycle:${cycle}]`;
  const note = String(userOutcome || '').trim();
  return note ? `${prefix}\n${note}` : prefix;
}

function parsePurchaseOutcome(outcome) {
  const match = String(outcome || '').match(/\[package:([^;\]]+);cycle:([^\]]+)\]/i);
  if (!match) return null;
  return {
    packageSlug: String(match[1] || 'starter').trim().toLowerCase(),
    billingCycle: String(match[2] || 'monthly').trim().toLowerCase() === 'annual' ? 'annual' : 'monthly',
  };
}

function normalizeOrganizationType(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'standalone') return 'standalone';
  if (raw === 'agency') return 'agency';
  return null;
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

  const organizationType = normalizeOrganizationType(body.organizationType);
  if (!organizationType) {
    return { error: 'Please choose Agency or Standalone workspace type' };
  }

  const requestKindRaw = String(body.requestKind || 'demo').trim().toLowerCase();
  let requestKind = 'demo';
  if (requestKindRaw === 'trial') requestKind = 'trial';
  else if (requestKindRaw === 'purchase') requestKind = 'purchase';

  let outcome = String(body.outcome || '').trim() || null;
  if (requestKind === 'purchase') {
    outcome = encodePurchaseOutcome(body.packageSlug, body.billingCycle, outcome);
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
      organizationType,
      outcome,
      requestKind,
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

    let record;
    try {
      record = await retryQuery(async () =>
        prisma.employerDemoRequest.create({
          data: {
            ...payload,
            otp,
            otpStatus: OtpStatus.PENDING,
            otpExpiresAt: expiresAt,
          },
        }),
      );
    } catch (createErr) {
      const message = String(createErr?.message || createErr || '');
      if (!message.includes('Unknown argument')) {
        throw createErr;
      }
      const { ObjectId } = require('mongodb');
      const id = new ObjectId();
      const now = new Date();
      await retryQuery(() =>
        prisma.$runCommandRaw({
          insert: 'employer_demo_requests',
          documents: [
            {
              _id: { $oid: id.toString() },
              ...payload,
              otp,
              otpStatus: OtpStatus.PENDING,
              otpExpiresAt: { $date: expiresAt.toISOString() },
              trialProvisioned: false,
              createdAt: { $date: now.toISOString() },
              updatedAt: { $date: now.toISOString() },
            },
          ],
        }),
      );
      record = { id: id.toString() };
    }

    const phoneDisplay = `${payload.dialCode}${payload.phoneNumber}`;
    const emailResult = await sendOTPEmail(otp, normalizedEmail, phoneDisplay);
    const allowOtpFallback = process.env.ALLOW_OTP_FALLBACK !== 'false';
    const showOTP =
      process.env.NODE_ENV === 'development' || (!emailResult.success && allowOtpFallback);

    // Push into HQ CRM leads as soon as the demo form is submitted (before OTP verify).
    void syncEmployerDemoToHq({
      id: record.id,
      ...payload,
      otpStatus: OtpStatus.PENDING,
    }).catch((err) => {
      console.warn('[EmployerDemo] HQ lead sync on submit failed', err?.message || err);
    });

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

function logPhase2SyncFailure(label, result) {
  console.warn(`[${label}] Phase2 call failed`, {
    url: result?.url,
    status: result?.status,
    message: result?.data?.message,
    networkError: result?.networkError || false,
  });
}

async function syncEmployerTrialToPhase2(verified) {
  const result = await postPhase2Internal('provision-employer-trial', {
    requestId: verified.id,
    fullName: verified.fullName,
    email: verified.email,
    countryCode: verified.countryCode,
    dialCode: verified.dialCode,
    phoneNumber: verified.phoneNumber,
    companySize: verified.companySize,
    organizationName: verified.organizationName,
    organizationType: verified.organizationType || 'agency',
    outcome: verified.outcome || '',
  });

  if (!result.ok) {
    logPhase2SyncFailure('EmployerTrial', result);
    return null;
  }
  return result.data?.data || null;
}

async function syncEmployerPaidToPhase2(verified, paymentReference) {
  const purchaseMeta = parsePurchaseOutcome(verified.outcome);
  const result = await postPhase2Internal('provision-employer-paid', {
    requestId: verified.id,
    fullName: verified.fullName,
    email: verified.email,
    countryCode: verified.countryCode,
    dialCode: verified.dialCode,
    phoneNumber: verified.phoneNumber,
    companySize: verified.companySize,
    organizationName: verified.organizationName,
    organizationType: verified.organizationType || 'agency',
    outcome: verified.outcome || '',
    requestKind: verified.requestKind || 'purchase',
    paymentReference,
    packageSlug: purchaseMeta?.packageSlug,
    billingCycle: purchaseMeta?.billingCycle,
  });

  if (!result.ok) {
    logPhase2SyncFailure('EmployerPurchase', result);
    return { error: result.data?.message || 'Workspace provisioning failed', phase2Status: result.status };
  }
  return result.data?.data || null;
}

async function syncEmployerDemoToHq(verified) {
  const result = await postPhase2Internal('sync-employer-demo-verified', {
    requestId: verified.id,
    fullName: verified.fullName,
    email: verified.email,
    countryCode: verified.countryCode,
    dialCode: verified.dialCode,
    phoneNumber: verified.phoneNumber,
    companySize: verified.companySize,
    organizationName: verified.organizationName,
    organizationType: verified.organizationType || 'agency',
    outcome: verified.outcome || '',
    requestKind: verified.requestKind || 'demo',
    emailVerified:
      Boolean(verified.emailVerifiedAt) ||
      String(verified.otpStatus || '').toUpperCase() === 'VERIFIED',
  });

  if (!result.ok) {
    logPhase2SyncFailure('EmployerDemo', result);
    return null;
  }
  return result.data?.data || null;
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
    const isPurchase = String(verified.requestKind || '').toLowerCase() === 'purchase';
    let trialProvision = null;
    if (isTrial) {
      trialProvision = await syncEmployerTrialToPhase2(verified);
      if (!trialProvision) {
        return res.status(502).json({
          success: false,
          message: 'Email verified, but we could not start your trial workspace. Please contact support.',
        });
      }
      await persistEmployerDemoProvision(verified.id, {
        tenantDbName: trialProvision.tenantDbName,
        loginId: trialProvision.loginId,
        loginUrl: trialProvision.loginUrl,
        planStartDate: trialProvision.subscriptionPlan?.planStartDate || trialProvision.trialStartsAt,
        planEndDate: trialProvision.trialEndsAt || trialProvision.subscriptionPlan?.planEndDate,
      });
    } else if (isPurchase) {
      const purchaseMeta = parsePurchaseOutcome(verified.outcome);
      return res.json({
        success: true,
        message: 'Email verified. Continue to payment.',
        data: {
          requestId: verified.id,
          email: verified.email,
          requestKind: 'purchase',
          readyForPayment: true,
          packageSlug: purchaseMeta?.packageSlug || 'starter',
          billingCycle: purchaseMeta?.billingCycle || 'monthly',
        },
      });
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

async function completeEmployerPurchase(req, res) {
  try {
    const { requestId, email, paymentReference } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const paymentRef = String(paymentReference || '').trim();

    if (!requestId || !normalizedEmail || !paymentRef) {
      return res.status(400).json({
        success: false,
        message: 'Request id, email, and payment reference are required',
      });
    }

    const verified = await retryQuery(async () =>
      prisma.employerDemoRequest.findFirst({
        where: {
          id: requestId,
          email: normalizedEmail,
          otpStatus: OtpStatus.VERIFIED,
          requestKind: 'purchase',
        },
      }),
    );

    if (!verified) {
      return res.status(400).json({
        success: false,
        message: 'Verified purchase request not found. Please complete signup again.',
      });
    }

    if (verified.trialProvisioned) {
      const paidProvision = await syncEmployerPaidToPhase2(verified, paymentRef);
      if (paidProvision && !paidProvision.error) {
        return res.json({
          success: true,
          message: paidProvision.credentialEmailSent
            ? 'Login credentials sent to your email.'
            : 'Workspace already provisioned.',
          data: buildProvisionResponse(verified.id, verified.email, paidProvision),
        });
      }
      return res.json({
        success: true,
        message: 'Workspace already provisioned',
        data: {
          requestId: verified.id,
          email: verified.email,
          loginUrl: verified.trialLoginUrl,
          loginId: verified.trialLoginId,
          tenantDbName: verified.trialTenantDbName,
          credentialEmailSent: false,
        },
      });
    }

    const paidProvision = await syncEmployerPaidToPhase2(verified, paymentRef);
    if (!paidProvision || paidProvision.error) {
      const detail = paidProvision?.error ? String(paidProvision.error) : '';
      console.error('[EmployerPurchase] provisioning failed:', detail);
      return res.status(502).json({
        success: false,
        message: 'Payment recorded, but workspace provisioning failed. Please contact support.',
        ...(process.env.NODE_ENV === 'development' && detail ? { error: detail } : {}),
      });
    }

    await persistEmployerDemoProvision(verified.id, {
      tenantDbName: paidProvision.tenantDbName,
      loginId: paidProvision.loginId,
      loginUrl: paidProvision.loginUrl,
      planStartDate: paidProvision.subscriptionPlan?.planStartDate,
      planEndDate: paidProvision.subscriptionPlan?.planEndDate,
    });

    return res.json({
      success: true,
      message: paidProvision.credentialEmailSent
        ? 'Payment confirmed. Login credentials sent to your email.'
        : paidProvision.alreadyProvisioned
          ? 'Workspace is ready.'
          : 'Payment confirmed. Your workspace is ready.',
      data: buildProvisionResponse(verified.id, verified.email, paidProvision),
    });
  } catch (error) {
    console.error('completeEmployerPurchase error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete purchase',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

module.exports = {
  sendDemoRequestOtp,
  resendDemoRequestOtp,
  verifyDemoRequestOtp,
  completeEmployerPurchase,
};
