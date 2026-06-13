const { prisma } = require('../lib/prisma');
const { getCandidateCommonPrisma } = require('../lib/candidateCommonPrisma');
const { destroyByCloudinaryUrl } = require('../lib/s3');

const CANDIDATE_DELETE_PREVIEW_INCLUDE = {
  profile: true,
  summary: true,
  gapExplanation: true,
  internship: true,
  portfolioLinks: true,
  educations: { orderBy: { startYear: 'desc' } },
  workExperiences: { orderBy: { startDate: 'desc' } },
  skills: { include: { skill: true } },
  languages: true,
  careerPreferences: true,
  resume: true,
  resumeVersions: { orderBy: { createdAt: 'desc' } },
  project: true,
  academicAchievement: true,
  competitiveExam: true,
  certifications: { orderBy: { createdAt: 'desc' } },
  accomplishments: { orderBy: { createdAt: 'desc' } },
  visaWorkAuthorization: true,
  vaccination: true,
  cvAnalysis: true,
  applications: {
    orderBy: { appliedAt: 'desc' },
    include: {
      job: { select: { id: true, title: true, company: true, location: true } },
    },
  },
  savedJobs: {
    include: { job: { select: { id: true, title: true, company: true } } },
  },
  recruiterMatches: {
    include: { job: { select: { id: true, title: true, company: true } } },
  },
  pipelineEntries: true,
  notifications: { take: 20, orderBy: { createdAt: 'desc' } },
  dashboardStats: true,
  courseEnrollments: { take: 20, orderBy: { enrolledAt: 'desc' } },
  _count: {
    select: {
      applications: true,
      savedJobs: true,
      recruiterMatches: true,
      notifications: true,
      courseEnrollments: true,
      resumeVersions: true,
      otpVerifications: true,
    },
  },
};

function jsonSafe(value) {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => {
      if (v instanceof Date) return v.toISOString();
      return v;
    })
  );
}

function buildPhase1DeletePreview(candidate) {
  const {
    profile,
    summary,
    gapExplanation,
    internship,
    portfolioLinks,
    educations,
    workExperiences,
    skills,
    languages,
    careerPreferences,
    resume,
    resumeVersions,
    project,
    academicAchievement,
    competitiveExam,
    certifications,
    accomplishments,
    visaWorkAuthorization,
    vaccination,
    cvAnalysis,
    applications,
    savedJobs,
    recruiterMatches,
    pipelineEntries,
    notifications,
    dashboardStats,
    courseEnrollments,
    _count,
    ...core
  } = candidate;

  return jsonSafe({
    core: {
      id: core.id,
      whatsappNumber: core.whatsappNumber,
      countryCode: core.countryCode,
      isVerified: core.isVerified,
      firstName: core.firstName,
      lastName: core.lastName,
      email: core.email,
      phone: core.phone,
      linkedIn: core.linkedIn,
      resumeUrl: core.resumeUrl,
      recruiterSkills: core.recruiterSkills,
      experienceYears: core.experienceYears,
      currentTitle: core.currentTitle,
      currentCompany: core.currentCompany,
      location: core.location,
      addressLine: core.addressLine,
      city: core.city,
      country: core.country,
      recruiterStatus: core.recruiterStatus,
      source: core.source,
      rating: core.rating,
      availability: core.availability,
      noticePeriod: core.noticePeriod,
      hotlist: core.hotlist,
      avatar: core.avatar,
      designation: core.designation,
      expectedSalary: core.expectedSalary,
      currentSalary: core.currentSalary,
      recruiterEducation: core.recruiterEducation,
      certificationsList: core.certificationsList,
      recruiterLanguages: core.recruiterLanguages,
      portfolio: core.portfolio,
      website: core.website,
      recruiterNotes: core.recruiterNotes,
      cvSummary: core.cvSummary,
      cvEducationEntries: core.cvEducationEntries,
      cvWorkExperienceEntries: core.cvWorkExperienceEntries,
      cvPortfolioLinks: core.cvPortfolioLinks,
      preferredLocation: core.preferredLocation,
      assignedJobs: core.assignedJobs,
      stage: core.stage,
      lastActivity: core.lastActivity,
      createdAt: core.createdAt,
      updatedAt: core.updatedAt,
    },
    profile,
    summary,
    gapExplanation,
    internship,
    portfolioLinks,
    educations,
    workExperiences,
    skills: (skills || []).map((cs) => ({
      ...cs,
      skillName: cs.skill?.name || null,
    })),
    languages,
    careerPreferences,
    resume: resume
      ? {
          fileName: resume.fileName,
          fileUrl: resume.fileUrl,
          uploadedAt: resume.uploadedAt,
          aiAnalyzed: resume.aiAnalyzed,
          resumeJson: resume.resumeJson,
        }
      : null,
    resumeVersions,
    project,
    academicAchievement,
    competitiveExam,
    certifications,
    accomplishments,
    visaWorkAuthorization,
    vaccination,
    cvAnalysis,
    applications: (applications || []).map((app) => ({
      id: app.id,
      status: app.status,
      matchScore: app.matchScore,
      appliedAt: app.appliedAt,
      job: app.job,
    })),
    savedJobs: (savedJobs || []).map((row) => ({
      id: row.id,
      savedAt: row.savedAt,
      job: row.job,
    })),
    matches: (recruiterMatches || []).map((m) => ({
      id: m.id,
      score: m.score,
      status: m.status,
      notes: m.notes,
      job: m.job,
    })),
    pipelineEntries,
    notifications,
    dashboardStats,
    courseEnrollments,
    relatedCounts: _count,
  });
}

async function fetchCandidateCommonRow(candidateId) {
  const commonPrisma = getCandidateCommonPrisma();
  if (!commonPrisma) {
    return { row: null, configured: false };
  }
  const row = await commonPrisma.candidateCommon.findUnique({
    where: { candidateId },
  });
  return { row: row ? jsonSafe(row) : null, configured: true };
}

/**
 * Get all candidates
 * GET /api/candidates
 */
async function getAllCandidates(req, res) {
  try {
    const { page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get total count
    const totalCount = await prisma.candidate.count();

    // Get candidates with pagination
    const candidates = await prisma.candidate.findMany({
      skip: skip,
      take: limitNum,
      include: {
        profile: {
          select: {
            fullName: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Format response
    const formattedCandidates = candidates.map((candidate) => ({
      id: candidate.id,
      fullName: candidate.profile?.fullName || 'N/A',
      email: candidate.profile?.email || 'N/A',
      phoneNumber: candidate.profile?.phoneNumber || 'N/A',
      whatsappNumber: candidate.whatsappNumber ?? 'N/A',
      countryCode: candidate.countryCode,
      isVerified: candidate.isVerified,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
    }));

    res.json({
      success: true,
      data: {
        candidates: formattedCandidates,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalCount / limitNum),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch candidates',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Get single candidate by ID
 * GET /api/candidates/:id
 */
async function getCandidateById(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    const candidate = await prisma.candidate.findUnique({
      where: { id: id },
      include: {
        profile: true,
        summary: true,
        gapExplanation: true,
        internship: true,
        portfolioLinks: true,
        educations: {
          orderBy: { startYear: 'desc' },
        },
        workExperiences: {
          orderBy: { startDate: 'desc' },
        },
        skills: {
          include: {
            skill: true,
          },
        },
        languages: true,
        careerPreferences: true,
        resume: true,
        project: true,
        academicAchievement: true,
        competitiveExam: true,
        certifications: {
          orderBy: { createdAt: 'desc' },
        },
        accomplishments: {
          orderBy: { createdAt: 'desc' },
        },
        visaWorkAuthorization: true,
        vaccination: true,
        cvAnalysis: true,
      },
    });

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found',
      });
    }

    // Get actual email from resume if profile email is temporary
    let displayEmail = candidate.profile?.email || '';
    if (displayEmail && displayEmail.includes('@temp.local')) {
      if (candidate.resume?.resumeJson && typeof candidate.resume.resumeJson === 'object') {
        const resumeData = candidate.resume.resumeJson;
        if (resumeData.personalInformation && resumeData.personalInformation.email) {
          displayEmail = resumeData.personalInformation.email;
        }
      }
    }

    // Format response
    const candidateData = {
      id: candidate.id,
      whatsappNumber: candidate.whatsappNumber,
      countryCode: candidate.countryCode,
      isVerified: candidate.isVerified,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
      personalInformation: candidate.profile ? {
        fullName: candidate.profile.fullName,
        email: displayEmail,
        phoneNumber: candidate.profile.phoneNumber,
        alternatePhone: candidate.profile.alternatePhone,
        profilePhotoUrl: candidate.profile.profilePhotoUrl,
        gender: candidate.profile.gender,
        dateOfBirth: candidate.profile.dateOfBirth,
        maritalStatus: candidate.profile.maritalStatus,
        address: candidate.profile.address,
        city: candidate.profile.city,
        country: candidate.profile.country,
        nationality: candidate.profile.nationality,
        passportNumber: candidate.profile.passportNumber,
        linkedinUrl: candidate.profile.linkedinUrl,
        employmentStatus: candidate.profile.employmentStatus,
        profileCompleteness: candidate.profile.profileCompleteness,
      } : null,
      summary: candidate.summary ? {
        summaryText: candidate.summary.summaryText,
      } : null,
      education: candidate.educations.map((edu) => ({
        id: edu.id,
        educationLevel: edu.educationLevel,
        degree: edu.degree,
        institution: edu.institution,
        specialization: edu.specialization,
        startYear: edu.startYear,
        endYear: edu.endYear,
        isOngoing: edu.isOngoing,
        grade: edu.grade,
        modeOfStudy: edu.modeOfStudy,
        courseDuration: edu.courseDuration,
        description: edu.description,
      })),
      workExperience: candidate.workExperiences.map((exp) => ({
        id: exp.id,
        jobTitle: exp.jobTitle,
        company: exp.company,
        workLocation: exp.workLocation,
        workMode: exp.workMode,
        startDate: exp.startDate,
        endDate: exp.endDate,
        isCurrentJob: exp.isCurrentJob,
        responsibilities: exp.responsibilities,
        industry: exp.industry,
        employmentType: exp.employmentType,
        achievements: exp.achievements,
        workSkills: exp.workSkills,
      })),
      skills: candidate.skills.map((cs) => ({
        id: cs.id,
        skillId: cs.skillId,
        skillName: cs.skill?.name || '',
        proficiency: cs.proficiency,
        yearsOfExp: cs.yearsOfExp,
        isAiSuggested: cs.isAiSuggested,
      })),
      languages: candidate.languages.map((lang) => ({
        id: lang.id,
        name: lang.name,
        proficiency: lang.proficiency,
        canSpeak: lang.canSpeak,
        canRead: lang.canRead,
        canWrite: lang.canWrite,
      })),
      careerPreferences: candidate.careerPreferences ? {
        preferredRoles: candidate.careerPreferences.preferredRoles,
        preferredIndustry: candidate.careerPreferences.preferredIndustry,
        functionalArea: candidate.careerPreferences.functionalArea,
        jobTypes: candidate.careerPreferences.jobTypes,
        preferredWorkMode: candidate.careerPreferences.preferredWorkMode,
        preferredLocations: candidate.careerPreferences.preferredLocations,
        preferredSalary: candidate.careerPreferences.preferredSalary,
        preferredCurrency: candidate.careerPreferences.preferredCurrency,
        preferredSalaryType: candidate.careerPreferences.preferredSalaryType,
      } : null,
      resume: candidate.resume ? {
        fileName: candidate.resume.fileName,
        fileUrl: candidate.resume.fileUrl,
        uploadedAt: candidate.resume.uploadedAt,
        aiAnalyzed: candidate.resume.aiAnalyzed,
      } : null,
      cvAnalysis: candidate.cvAnalysis ? {
        cvScore: candidate.cvAnalysis.cvScore,
        atsScore: candidate.cvAnalysis.atsScore,
        grammarScore: candidate.cvAnalysis.grammarScore,
        keywordScore: candidate.cvAnalysis.keywordScore,
        bulletScore: candidate.cvAnalysis.bulletScore,
        sectionScore: candidate.cvAnalysis.sectionScore,
        skillsLevel: candidate.cvAnalysis.skillsLevel,
        experienceLevel: candidate.cvAnalysis.experienceLevel,
        educationLevel: candidate.cvAnalysis.educationLevel,
        suggestions: candidate.cvAnalysis.suggestions,
        mistakes: candidate.cvAnalysis.mistakes,
      } : null,
      certifications: candidate.certifications.map((cert) => ({
        id: cert.id,
        certificationName: cert.certificationName,
        issuingOrganization: cert.issuingOrganization,
        issueDate: cert.issueDate,
        expiryDate: cert.expiryDate,
        doesNotExpire: cert.doesNotExpire,
        credentialId: cert.credentialId,
        credentialUrl: cert.credentialUrl,
      })),
    };

    res.json({
      success: true,
      data: candidateData,
    });
  } catch (error) {
    console.error('Error fetching candidate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch candidate',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Full Phase 1 + candidate common snapshot before delete (super admin).
 * GET /api/candidates/:id/delete-preview
 */
async function getCandidateDeletePreview(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    const candidate = await prisma.candidate.findUnique({
      where: { id },
      include: CANDIDATE_DELETE_PREVIEW_INCLUDE,
    });

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found',
      });
    }

    const common = await fetchCandidateCommonRow(id);

    return res.json({
      success: true,
      data: {
        candidateId: id,
        phase1: buildPhase1DeletePreview(candidate),
        common: common.row,
        commonDatabaseConfigured: common.configured,
      },
    });
  } catch (error) {
    console.error('Error fetching candidate delete preview:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch candidate delete preview',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Bulk delete preview for super admin.
 * POST /api/candidates/delete-preview  body: { ids: string[] }
 */
async function getCandidatesDeletePreview(req, res) {
  try {
    const ids = Array.isArray(req.body?.ids)
      ? [...new Set(req.body.ids.map((v) => String(v || '').trim()).filter(Boolean))]
      : [];

    if (ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one candidate ID is required',
      });
    }

    if (ids.length > 25) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 25 candidates per delete preview request',
      });
    }

    const candidates = await prisma.candidate.findMany({
      where: { id: { in: ids } },
      include: CANDIDATE_DELETE_PREVIEW_INCLUDE,
    });

    const commonPrisma = getCandidateCommonPrisma();
    const commonConfigured = Boolean(commonPrisma);
    let commonByCandidateId = new Map();

    if (commonPrisma) {
      const commonRows = await commonPrisma.candidateCommon.findMany({
        where: { candidateId: { in: ids } },
      });
      commonByCandidateId = new Map(
        commonRows.map((row) => [row.candidateId, jsonSafe(row)])
      );
    }

    const previews = candidates.map((candidate) => ({
      candidateId: candidate.id,
      label:
        candidate.profile?.fullName ||
        candidate.profile?.email ||
        candidate.email ||
        candidate.id,
      phase1: buildPhase1DeletePreview(candidate),
      common: commonByCandidateId.get(candidate.id) || null,
      commonDatabaseConfigured: commonConfigured,
    }));

    const missingIds = ids.filter((id) => !candidates.some((c) => c.id === id));

    return res.json({
      success: true,
      data: {
        previews,
        missingIds,
        commonDatabaseConfigured: commonConfigured,
      },
    });
  } catch (error) {
    console.error('Error fetching bulk candidate delete preview:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch candidate delete previews',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Hard delete: remove candidate and all related Phase 1 rows + common DB + resume files.
 */
async function purgeCandidateCommonById(id) {
  const commonPrisma = getCandidateCommonPrisma();
  if (!commonPrisma) return { removed: false, configured: false };
  const result = await commonPrisma.candidateCommon.deleteMany({ where: { candidateId: id } });
  return { removed: result.count > 0, configured: true, count: result.count };
}

async function purgeCandidateResumeFiles(id) {
  const resumes = await prisma.resume.findMany({
    where: { candidateId: id },
    select: { fileUrl: true },
  });
  const profile = await prisma.candidateProfile.findUnique({
    where: { candidateId: id },
    select: { profilePhotoUrl: true },
  });
  const urls = [
    ...resumes.map((r) => r.fileUrl).filter(Boolean),
    profile?.profilePhotoUrl,
  ].filter(Boolean);
  for (const url of urls) {
    try {
      await destroyByCloudinaryUrl(url);
    } catch {
      /* ignore missing S3 objects */
    }
  }
}

/**
 * Manual cascade delete for MongoDB/Prisma (onDelete: Cascade is not always enforced).
 */
async function purgeCandidateById(id) {
  await purgeCandidateResumeFiles(id);

  const applications = await prisma.application.findMany({
    where: { candidateId: id },
    select: { id: true },
  });
  const applicationIds = applications.map((a) => a.id);

  const globalInterviews = await prisma.globalAiInterview.findMany({
    where: { candidateId: id },
    select: { id: true },
  });
  const globalInterviewIds = globalInterviews.map((row) => row.id);

  const ops = [
    ...(globalInterviewIds.length
      ? [
          prisma.globalAiInterviewMessage.deleteMany({
            where: { interviewId: { in: globalInterviewIds } },
          }),
        ]
      : []),
    prisma.globalAiInterview.deleteMany({ where: { candidateId: id } }),

    ...(applicationIds.length
      ? [
          prisma.applicationCommunication.deleteMany({
            where: { applicationId: { in: applicationIds } },
          }),
          prisma.applicationTimeline.deleteMany({
            where: { applicationId: { in: applicationIds } },
          }),
        ]
      : []),

    prisma.application.deleteMany({ where: { candidateId: id } }),
    prisma.savedJob.deleteMany({ where: { candidateId: id } }),
    prisma.match.deleteMany({ where: { candidateId: id } }),
    prisma.pipelineEntry.deleteMany({ where: { candidateId: id } }),
    prisma.aiJobMatch.deleteMany({ where: { candidateId: id } }),
    prisma.aiProfileInsight.deleteMany({ where: { candidateId: id } }),

    prisma.notification.deleteMany({ where: { candidateId: id } }),
    prisma.courseEnrollment.deleteMany({ where: { candidateId: id } }),
    prisma.dashboardStats.deleteMany({ where: { candidateId: id } }),
    prisma.cvAnalysis.deleteMany({ where: { candidateId: id } }),

    prisma.lmsAnswerEvaluation.deleteMany({ where: { candidateId: id } }),
    prisma.lmsInterviewReport.deleteMany({ where: { candidateId: id } }),
    prisma.lmsEnrollment.deleteMany({ where: { userId: id } }),
    prisma.lmsQuizAttempt.deleteMany({ where: { userId: id } }),
    prisma.lmsNote.deleteMany({ where: { userId: id } }),
    prisma.lmsEventRegistration.deleteMany({ where: { userId: id } }),
    prisma.lmsResumeDraft.deleteMany({ where: { userId: id } }),
    prisma.lmsResumeRoleVersion.deleteMany({ where: { userId: id } }),
    prisma.lmsCareerPath.deleteMany({ where: { userId: id } }),
    prisma.lmsInterviewPrepSession.deleteMany({ where: { userId: id } }),
    prisma.lmsInterviewSet.deleteMany({ where: { userId: id } }),

    prisma.otpVerification.deleteMany({ where: { candidateId: id } }),
    prisma.settings.deleteMany({ where: { candidateId: id } }),
    prisma.session.deleteMany({ where: { candidateId: id } }),
    prisma.resumeVersion.deleteMany({ where: { candidateId: id } }),
    prisma.resume.deleteMany({ where: { candidateId: id } }),

    prisma.education.deleteMany({ where: { candidateId: id } }),
    prisma.workExperience.deleteMany({ where: { candidateId: id } }),
    prisma.candidateSkill.deleteMany({ where: { candidateId: id } }),
    prisma.candidateLanguage.deleteMany({ where: { candidateId: id } }),
    prisma.careerPreferences.deleteMany({ where: { candidateId: id } }),
    prisma.candidateSummary.deleteMany({ where: { candidateId: id } }),
    prisma.candidateGapExplanation.deleteMany({ where: { candidateId: id } }),
    prisma.candidateInternship.deleteMany({ where: { candidateId: id } }),
    prisma.candidatePortfolioLinks.deleteMany({ where: { candidateId: id } }),
    prisma.candidateProject.deleteMany({ where: { candidateId: id } }),
    prisma.candidateAcademicAchievement.deleteMany({ where: { candidateId: id } }),
    prisma.candidateCompetitiveExam.deleteMany({ where: { candidateId: id } }),
    prisma.candidateCertification.deleteMany({ where: { candidateId: id } }),
    prisma.candidateAccomplishment.deleteMany({ where: { candidateId: id } }),
    prisma.candidateVisaWorkAuthorization.deleteMany({ where: { candidateId: id } }),
    prisma.candidateVaccination.deleteMany({ where: { candidateId: id } }),
    prisma.candidateProfile.deleteMany({ where: { candidateId: id } }),
    prisma.candidate.delete({ where: { id } }),
  ];

  try {
    await prisma.$transaction(ops);
  } catch (txError) {
    for (const op of ops) {
      try {
        await op;
      } catch (opError) {
        if (String(opError?.code || '').toUpperCase() === 'P2025') break;
      }
    }
  }

  let commonPurge = { configured: false, removed: false };
  try {
    const { getCandidateCommonPrisma } = require('../lib/candidateCommonPrisma');
    const commonPrisma = getCandidateCommonPrisma();
    if (commonPrisma) {
      commonPurge.configured = true;
      const result = await commonPrisma.candidateCommon.deleteMany({ where: { candidateId: id } });
      commonPurge.removed = (result?.count ?? 0) > 0;
    }
  } catch (commonErr) {
    console.warn('[candidateCommon] purge skipped:', id, commonErr?.message || commonErr);
  }

  return { commonPurge };
}

/**
 * Delete candidate by ID
 * DELETE /api/candidates/:id
 */
async function deleteCandidate(req, res) {
  try {
    const { id } = req.params;

    if (!id || id === 'bulk-delete') {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    const candidate = await prisma.candidate.findUnique({
      where: { id },
    });

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found',
      });
    }

    const purgeResult = await purgeCandidateById(id);

    res.json({
      success: true,
      message:
        'Candidate permanently deleted from Phase 1 database' +
        (purgeResult.commonPurge?.configured
          ? purgeResult.commonPurge.removed
            ? ' and candidate common database'
            : ' (no common database row found)'
          : ''),
      data: {
        candidateId: id,
        hardDelete: true,
        commonDatabaseRemoved: Boolean(purgeResult.commonPurge?.removed),
      },
    });
  } catch (error) {
    console.error('Error deleting candidate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete candidate',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Bulk delete candidates (super admin)
 * DELETE /api/candidates/bulk-delete  body: { ids: string[] }
 */
async function bulkDeleteCandidates(req, res) {
  try {
    const ids = Array.isArray(req.body?.ids)
      ? [...new Set(req.body.ids.map((v) => String(v || '').trim()).filter(Boolean))]
      : [];

    if (ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one candidate ID is required',
      });
    }

    const existing = await prisma.candidate.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No matching candidates found',
      });
    }

    const failed = [];
    const commonRemoved = [];
    let deletedCount = 0;

    for (const row of existing) {
      try {
        const purgeResult = await purgeCandidateById(row.id);
        deletedCount += 1;
        if (purgeResult?.commonPurge?.removed) {
          commonRemoved.push(row.id);
        }
      } catch (err) {
        console.error('Error deleting candidate in bulk:', row.id, err);
        failed.push({
          id: row.id,
          message: err?.message || 'Delete failed',
        });
      }
    }

    if (deletedCount === 0) {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete candidates',
        data: { failed },
      });
    }

    return res.json({
      success: true,
      message: `${deletedCount} candidate(s) permanently deleted from Phase 1` +
        (commonRemoved.length
          ? `; ${commonRemoved.length} also removed from candidate common database`
          : ''),
      data: {
        count: deletedCount,
        hardDelete: true,
        commonDatabaseRemovedIds: commonRemoved,
        failed,
      },
    });
  } catch (error) {
    console.error('Error bulk deleting candidates:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete candidates',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

module.exports = {
  getAllCandidates,
  getCandidateById,
  getCandidateDeletePreview,
  getCandidatesDeletePreview,
  deleteCandidate,
  bulkDeleteCandidates,
};
