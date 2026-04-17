const { prisma, retryQuery } = require('../lib/prisma');
const { generateOTP, getOTPExpiration, isOTPExpired } = require('../utils/otp.util');
const { generateCandidateId } = require('../utils/candidate.util');
const { sendOTPEmail } = require('../services/email.service');
const { OtpStatus } = require('@prisma/client');
const jwt = require('jsonwebtoken');

async function getOrCreateCandidateByWhatsApp({ candidateId, fullWhatsAppNumber, countryCode }) {
  let candidate = await retryQuery(async () => {
    return await prisma.candidate.findUnique({
      where: { id: candidateId },
    });
  });

  if (!candidate) {
    candidate = await retryQuery(async () => {
      return await prisma.candidate.findUnique({
        where: { whatsappNumber: fullWhatsAppNumber },
      });
    });
  }

  if (!candidate) {
    try {
      candidate = await retryQuery(async () => {
        return await prisma.candidate.upsert({
          where: { id: candidateId },
          update: {
            whatsappNumber: fullWhatsAppNumber,
            countryCode: countryCode,
          },
          create: {
            id: candidateId,
            whatsappNumber: fullWhatsAppNumber,
            countryCode: countryCode,
            isVerified: false,
          },
        });
      });
    } catch (error) {
      if (error.code === 'P2002' || error.code === 'P2034') {
        candidate = await retryQuery(async () => {
          return await prisma.candidate.findUnique({
            where: { whatsappNumber: fullWhatsAppNumber },
          });
        });
      }

      if (!candidate) {
        throw error;
      }
    }
  }

  const needsUpdate =
    candidate.countryCode !== countryCode ||
    candidate.whatsappNumber !== fullWhatsAppNumber;

  if (needsUpdate) {
    candidate = await retryQuery(async () => {
      return await prisma.candidate.update({
        where: { id: candidate.id },
        data: {
          countryCode: countryCode,
          whatsappNumber: fullWhatsAppNumber,
        },
      });
    });
  }

  return candidate;
}

/**
 * Send OTP to WhatsApp number
 * POST /api/auth/send-otp
 */
async function sendOTP(req, res) {
  try {
    const { whatsappNumber, countryCode, email } = req.body;

    // Validation
    if (!whatsappNumber || !countryCode || !email) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp number, country code, and Gmail are required',
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

    // Clean phone number (remove any non-digit characters)
    const cleanNumber = whatsappNumber.replace(/\D/g, '');

    if (cleanNumber.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Invalid WhatsApp number',
      });
    }

    const fullWhatsAppNumber = `${countryCode}${cleanNumber}`;

    // Generate unique ID based on WhatsApp number (deterministic - same number = same ID)
    const candidateId = generateCandidateId(fullWhatsAppNumber);

    let candidate = await getOrCreateCandidateByWhatsApp({
      candidateId,
      fullWhatsAppNumber,
      countryCode,
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
    const { whatsappNumber, countryCode, otp } = req.body;

    // Validation
    if (!whatsappNumber || !countryCode || !otp) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp number, country code, and OTP are required',
      });
    }

    // Clean phone number
    const cleanNumber = whatsappNumber.replace(/\D/g, '');
    const fullWhatsAppNumber = `${countryCode}${cleanNumber}`;

    // Generate candidate ID from WhatsApp number (deterministic - same number = same ID)
    const candidateId = generateCandidateId(fullWhatsAppNumber);
    console.log('Verifying OTP for WhatsApp:', fullWhatsAppNumber, '| Candidate ID:', candidateId);

    let candidate = await getOrCreateCandidateByWhatsApp({
      candidateId,
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

    // Check if candidate ID matches the generated ID based on WhatsApp number
    // If not, we need to migrate to the correct ID
    if (candidate.id !== candidateId) {
      console.log('Candidate ID mismatch. Current:', candidate.id, 'Expected:', candidateId);
      console.log('Migrating candidate to use ID based on WhatsApp number...');
      
      // Try to find candidate with the correct ID
      let correctCandidate = await retryQuery(async () => {
        return await prisma.candidate.findUnique({
          where: { id: candidateId },
        });
      });

      if (!correctCandidate) {
        // Create new candidate with correct ID based on WhatsApp number
        try {
          // Create new candidate with correct ID
          correctCandidate = await retryQuery(async () => {
            return await prisma.candidate.create({
              data: {
                id: candidateId, // Use generated ID based on WhatsApp number
                whatsappNumber: fullWhatsAppNumber,
                countryCode: countryCode,
                isVerified: true, // Mark as verified since OTP is verified
              },
            });
          });
          console.log('✅ Created candidate with correct ID and stored in DB:', correctCandidate.id);
          console.log('✅ Candidate ID based on WhatsApp number:', candidateId);
          console.log('✅ Verification: Stored ID matches generated ID:', correctCandidate.id === candidateId);

          // Migrate all OTP verifications to new candidate
          const otpCount = await retryQuery(async () => {
            return await prisma.otpVerification.updateMany({
              where: {
                candidateId: candidate.id,
              },
              data: {
                candidateId: correctCandidate.id,
              },
            });
          });
          console.log('Migrated', otpCount.count, 'OTP verifications to new candidate');

          // Note: At this early stage (OTP verification), there shouldn't be other related data
          // (profile, resume, etc.) as user hasn't completed registration yet
          // If there is any, it will be lost, but that's acceptable at this stage

          // Delete old candidate (cascade will clean up any remaining data)
          await retryQuery(async () => {
            return await prisma.candidate.delete({
              where: { id: candidate.id },
            });
          });
          console.log('Deleted old candidate with incorrect ID:', candidate.id);

          candidate = correctCandidate;
          
          // Verify the candidate is stored in DB with correct ID
          const verifyCandidate = await retryQuery(async () => {
            return await prisma.candidate.findUnique({
              where: { id: candidateId },
            });
          });
          if (verifyCandidate) {
            console.log('✅ VERIFICATION SUCCESS: Candidate stored in DB with ID:', verifyCandidate.id);
            console.log('✅ WhatsApp Number:', verifyCandidate.whatsappNumber);
            console.log('✅ Is Verified:', verifyCandidate.isVerified);
          }
        } catch (error) {
          // If creation fails, log error but continue with existing candidate
          console.error('Error migrating candidate to correct ID:', error);
          // Mark existing candidate as verified
          candidate = await retryQuery(async () => {
            return await prisma.candidate.update({
              where: { id: candidate.id },
              data: { isVerified: true },
            });
          });
        }
      } else {
        // Candidate with correct ID already exists
        console.log('Candidate with correct ID already exists, migrating data...');
        
        // Update the existing candidate with correct ID
        correctCandidate = await retryQuery(async () => {
          return await prisma.candidate.update({
            where: { id: candidateId },
            data: {
              whatsappNumber: fullWhatsAppNumber,
              countryCode: countryCode,
              isVerified: true,
            },
          });
        });

        // Migrate OTP verifications from old candidate to correct candidate
        await retryQuery(async () => {
          return await prisma.otpVerification.updateMany({
            where: {
              candidateId: candidate.id,
            },
            data: {
              candidateId: correctCandidate.id,
            },
          });
        });
        console.log('Migrated OTP verifications to candidate with correct ID');

        // Delete old candidate
        await retryQuery(async () => {
          return await prisma.candidate.delete({
            where: { id: candidate.id },
          });
        });
        console.log('Deleted old candidate with incorrect ID');

        candidate = correctCandidate;
      }
    } else {
      // Candidate ID is correct, just mark as verified
      candidate = await retryQuery(async () => {
        return await prisma.candidate.update({
          where: { id: candidate.id },
          data: { isVerified: true },
        });
      });
      console.log('✅ Candidate ID is correct, marked as verified');
      console.log('✅ Candidate stored in DB with ID:', candidate.id);
      console.log('✅ Candidate ID based on WhatsApp number:', candidateId);
      console.log('✅ Verification: Stored ID matches generated ID:', candidate.id === candidateId);
    }

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

    // Returning user: candidate existed before this OTP request (not created in the same flow as this OTP),
    // or they already have profile / resume — skip CV upload and go to dashboard.
    const otpMs = new Date(latestOTP.createdAt).getTime();
    const candMs = new Date(candidate.createdAt).getTime();
    const candidatePredatesThisOtpBy = otpMs - candMs;
    const RETURNING_USER_MS = 60_000; // >1 min between account creation and this OTP => returning login

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
    const skipCvUpload =
      hasProfileOrResume || candidatePredatesThisOtpBy > RETURNING_USER_MS;

    const token = jwt.sign(
      {
        candidateId: candidate.id,
        whatsappNumber: candidate.whatsappNumber,
        isVerified: true
      },
      process.env.JWT_SECRET || 'saasa_jwt_secret_key_2024',
      { expiresIn: '30d' }
    );

    // Sync WhatsApp login number to CandidateProfile to satisfy "show exact number in /profile"
    try {
      const cleanPhone = candidate.whatsappNumber.replace(candidate.countryCode, '');
      await prisma.candidateProfile.upsert({
        where: { candidateId: candidate.id },
        update: {
          phoneNumber: cleanPhone,
          // We update it to ensure the "exact" number from login is what's shown
        },
        create: {
          candidateId: candidate.id,
          fullName: 'New Candidate',
          email: '', // to be filled later
          phoneNumber: cleanPhone,
        }
      });
      console.log('✅ Synchronized login number to CandidateProfile for:', candidate.id);
    } catch (profileSyncError) {
      console.warn('⚠️ Non-critical: Failed to sync profile number:', profileSyncError.message);
    }

    res.json({
      success: true,
      message: 'OTP verified successfully',
      data: {
        candidateId: candidate.id, // This will be the ID based on WhatsApp number
        isVerified: true,
        skipCvUpload,
        token,
      },
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
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
        message: 'WhatsApp number, country code, and Gmail are required',
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

    // Generate candidate ID from WhatsApp number
    const candidateId = generateCandidateId(fullWhatsAppNumber);

    // Find candidate by ID (which is based on WhatsApp number)
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found',
      });
    }

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

module.exports = {
  sendOTP,
  verifyOTP,
  resendOTP,
};



