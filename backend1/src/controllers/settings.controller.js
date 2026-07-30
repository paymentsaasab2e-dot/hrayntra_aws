const { prisma } = require('../lib/prisma');
const { buildSessionClosePatch } = require('../utils/session-tracking.util');

/**
 * Get user settings
 * GET /api/settings/:candidateId
 */
async function getSettings(req, res) {
  try {
    const { candidateId } = req.params;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    // Get candidate with profile
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        profile: true,
        careerPreferences: true,
        resume: true,
      },
    });

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found',
      });
    }

    // Debug log to check candidate data
    console.log('Settings - Candidate:', candidate);
    console.log('Settings - Profile:', candidate.profile);

    // Get or create settings
    let settings = await prisma.settings.findUnique({
      where: { candidateId },
    });

    if (!settings) {
      // Create default settings
      settings = await prisma.settings.create({
        data: {
          candidateId,
          emailNotifications: true,
          smsNotifications: false,
          whatsappNotifications: false,
          jobAlerts: true,
          profileVisibility: 'Recruiters only',
          dataSharing: false,
          language: 'English',
          timezone: 'Asia/Kolkata (UTC+05:30)',
          theme: 'System',
        },
      });
    }

    // Get active sessions count (handle if Session model doesn't exist)
    let sessions = 0;
    try {
      sessions = await prisma.session?.count?.({
        where: {
          candidateId,
          expiresAt: { gt: new Date() },
        },
      }) || 0;
    } catch (e) {
      sessions = 0;
    }

    // Build settings response - email/phone come from profile
    const settingsData = {
      account: {
        email: candidate.profile?.email || candidate.email || '',
        phone: candidate.profile?.phoneNumber || candidate.profile?.alternatePhone || candidate.whatsappNumber || '',
        countryCode: '+91',
        accountStatus: candidate.status || 'Active',
        lastPasswordChange: candidate.updatedAt,
      },
      notifications: {
        emailNotifications: settings.emailNotifications,
        smsNotifications: settings.smsNotifications,
        whatsappNotifications: settings.whatsappNotifications || false,
        jobAlerts: settings.jobAlerts,
      },
      privacy: {
        profileVisibility: settings.profileVisibility,
        dataSharing: settings.dataSharing,
        activeSessions: sessions,
      },
      preferences: {
        language: settings.language,
        timezone: settings.timezone,
        theme: settings.theme,
      },
      application: {
        defaultResume: candidate.resume?.fileUrl ? candidate.resume.fileUrl.split('/').pop() : 'No resume uploaded',
        jobPreferenceDefaults: candidate.careerPreferences?.preferredJobTitle || 'Not set',
      },
    };

    res.json({
      success: true,
      data: settingsData,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Update account settings
 * PUT /api/settings/account/:candidateId
 */
async function updateAccountSettings(req, res) {
  try {
    const { candidateId } = req.params;
    const { email, phone, countryCode } = req.body;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    // Update candidate email
    if (email) {
      await prisma.candidate.update({
        where: { id: candidateId },
        data: { email },
      });
    }

    // Update profile phone
    if (phone || countryCode) {
      await prisma.profile.update({
        where: { candidateId },
        data: {
          ...(phone && { whatsappNumber: phone }),
          ...(countryCode && { countryCode }),
        },
      });
    }

    res.json({
      success: true,
      message: 'Account settings updated successfully',
    });
  } catch (error) {
    console.error('Error updating account settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update account settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Update notification settings
 * PUT /api/settings/notifications/:candidateId
 */
async function updateNotificationSettings(req, res) {
  try {
    const { candidateId } = req.params;
    const { emailNotifications, smsNotifications, whatsappNotifications, jobAlerts } = req.body;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    await prisma.settings.upsert({
      where: { candidateId },
      create: {
        candidateId,
        emailNotifications: emailNotifications ?? true,
        smsNotifications: smsNotifications ?? false,
        whatsappNotifications: whatsappNotifications ?? false,
        jobAlerts: jobAlerts ?? true,
      },
      update: {
        ...(emailNotifications !== undefined && { emailNotifications }),
        ...(smsNotifications !== undefined && { smsNotifications }),
        ...(whatsappNotifications !== undefined && { whatsappNotifications }),
        ...(jobAlerts !== undefined && { jobAlerts }),
      },
    });

    res.json({
      success: true,
      message: 'Notification settings updated successfully',
    });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Update privacy settings
 * PUT /api/settings/privacy/:candidateId
 */
async function updatePrivacySettings(req, res) {
  try {
    const { candidateId } = req.params;
    const { profileVisibility, dataSharing } = req.body;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    await prisma.settings.upsert({
      where: { candidateId },
      create: {
        candidateId,
        profileVisibility: profileVisibility || 'Recruiters only',
        dataSharing: dataSharing ?? false,
      },
      update: {
        ...(profileVisibility && { profileVisibility }),
        ...(dataSharing !== undefined && { dataSharing }),
      },
    });

    res.json({
      success: true,
      message: 'Privacy settings updated successfully',
    });
  } catch (error) {
    console.error('Error updating privacy settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update privacy settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Update preferences
 * PUT /api/settings/preferences/:candidateId
 */
async function updatePreferences(req, res) {
  try {
    const { candidateId } = req.params;
    const { language, timezone, theme } = req.body;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    await prisma.settings.upsert({
      where: { candidateId },
      create: {
        candidateId,
        language: language || 'English',
        timezone: timezone || 'Asia/Kolkata (UTC+05:30)',
        theme: theme || 'System',
      },
      update: {
        ...(language && { language }),
        ...(timezone && { timezone }),
        ...(theme && { theme }),
      },
    });

    res.json({
      success: true,
      message: 'Preferences updated successfully',
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update preferences',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Update application settings
 * PUT /api/settings/application/:candidateId
 */
async function updateApplicationSettings(req, res) {
  try {
    const { candidateId } = req.params;
    const { jobPreferenceDefaults } = req.body;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    if (jobPreferenceDefaults) {
      await prisma.careerPreferences.upsert({
        where: { candidateId },
        create: {
          candidateId,
          preferredJobTitle: jobPreferenceDefaults,
        },
        update: {
          preferredJobTitle: jobPreferenceDefaults,
        },
      });
    }

    res.json({
      success: true,
      message: 'Application settings updated successfully',
    });
  } catch (error) {
    console.error('Error updating application settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update application settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Logout from all sessions
 * POST /api/settings/logout-all/:candidateId
 */
async function logoutAllSessions(req, res) {
  try {
    const { candidateId } = req.params;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    const now = new Date();
    const sessions = await prisma.session.findMany({
      where: {
        candidateId,
        OR: [{ isActive: true }, { isActive: { isSet: false } }, { isActive: null }],
      },
    });

    // Soft-close so HQ can still report login/logout/duration/device/geo history.
    await Promise.all(
      sessions.map((session) =>
        prisma.session.update({
          where: { id: session.id },
          data: {
            ...buildSessionClosePatch(session, now),
            token: `revoked_${session.id}_${now.getTime()}`,
          },
        })
      )
    );

    res.json({
      success: true,
      message: 'Logged out from all sessions',
    });
  } catch (error) {
    console.error('Error logging out:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to logout',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Delete account
 * DELETE /api/settings/account/:candidateId
 */
async function deleteAccount(req, res) {
  try {
    const { candidateId } = req.params;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    // Delete candidate (cascade will handle related records)
    await prisma.candidate.delete({
      where: { id: candidateId },
    });

    res.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

module.exports = {
  getSettings,
  updateAccountSettings,
  updateNotificationSettings,
  updatePrivacySettings,
  updatePreferences,
  updateApplicationSettings,
  logoutAllSessions,
  deleteAccount,
};
