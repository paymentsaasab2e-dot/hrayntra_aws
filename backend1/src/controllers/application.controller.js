const { prisma } = require('../lib/prisma');

function splitFullName(fullName) {
  const value = String(fullName || '').trim();
  if (!value) return { firstName: null, lastName: null };

  const parts = value.split(/\s+/);
  return {
    firstName: parts[0] || null,
    lastName: parts.slice(1).join(' ') || null,
  };
}

function calculateExperienceYears(workExperiences) {
  if (!Array.isArray(workExperiences) || workExperiences.length === 0) return null;

  const totalMs = workExperiences.reduce((sum, item) => {
    const start = item?.startDate ? new Date(item.startDate).getTime() : null;
    const end = item?.isCurrentJob ? Date.now() : item?.endDate ? new Date(item.endDate).getTime() : Date.now();
    if (!start || Number.isNaN(start) || Number.isNaN(end) || end < start) return sum;
    return sum + (end - start);
  }, 0);

  if (!totalMs) return null;
  return Math.max(0, Math.round(totalMs / (1000 * 60 * 60 * 24 * 365)));
}

function splitResponsibilities(value) {
  const text = String(value || '').trim();
  if (!text) return [];

  return text
    .split(/\r?\n|[.;]\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePortfolioLinks(links) {
  if (!Array.isArray(links)) return [];

  return links
    .map((item) => {
      if (typeof item === 'string') {
        const url = item.trim();
        return url ? { type: 'Link', url } : null;
      }

      if (!item || typeof item !== 'object') return null;
      const url = String(item.url || item.link || '').trim();
      if (!url) return null;

      return {
        type: String(item.type || item.label || 'Link').trim() || 'Link',
        url,
      };
    })
    .filter(Boolean);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeResumeSkills(skills) {
  return asArray(skills)
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (!item || typeof item !== 'object') return '';
      return String(item.name || item.skill || item.title || item.languageName || '').trim();
    })
    .filter(Boolean);
}

function normalizeResumeLanguages(languages) {
  return asArray(languages)
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (!item || typeof item !== 'object') return '';
      return String(item.name || item.language || item.languageName || '').trim();
    })
    .filter(Boolean);
}

function normalizeResumeEducationEntries(entries) {
  return asArray(entries)
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      return {
        degree: String(item.degree || item.educationLevel || item.title || '').trim() || null,
        institution: String(item.institution || item.school || item.college || '').trim() || null,
        startYear: item.startYear || item.start_date || item.from || null,
        endYear: item.endYear || item.end_date || item.to || null,
      };
    })
    .filter(Boolean);
}

function normalizeResumeWorkEntries(entries) {
  return asArray(entries)
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      return {
        title: String(item.title || item.jobTitle || item.role || '').trim() || null,
        company: String(item.company || item.organization || '').trim() || null,
        location: String(item.location || item.workLocation || '').trim() || null,
        startDate: String(item.startDate || item.start_date || item.from || '').trim() || null,
        endDate: String(item.endDate || item.end_date || item.to || '').trim() || null,
        responsibilities: splitResponsibilities(
          Array.isArray(item.responsibilities) ? item.responsibilities.join('. ') : item.responsibilities || item.description || ''
        ),
      };
    })
    .filter(Boolean);
}

async function syncApplicationToRecruiterView(candidateId, job) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      profile: true,
      resume: true,
      summary: true,
      portfolioLinks: true,
      educations: {
        orderBy: [{ endYear: 'desc' }, { startYear: 'desc' }],
        take: 3,
      },
      skills: {
        include: {
          skill: {
            select: { name: true },
          },
        },
      },
      languages: true,
      workExperiences: {
        orderBy: { startDate: 'desc' },
      },
      careerPreferences: true,
    },
  });

  if (!candidate) return;

  const resumeJson =
    candidate.resume?.resumeJson && typeof candidate.resume.resumeJson === 'object'
      ? candidate.resume.resumeJson
      : {};
  const { firstName, lastName } = splitFullName(candidate.profile?.fullName);
  const latestWork = candidate.workExperiences?.[0];
  const educationSummary = candidate.educations?.[0]
    ? [candidate.educations[0].degree, candidate.educations[0].specialization].filter(Boolean).join(' - ')
    : null;
  const recruiterSkills = (candidate.skills || []).map((item) => item.skill?.name).filter(Boolean);
  const recruiterLanguages = (candidate.languages || []).map((item) => item.name).filter(Boolean);
  const resumeSkills = normalizeResumeSkills(resumeJson.skills);
  const resumeLanguages = normalizeResumeLanguages(resumeJson.languages);
  const assignedJobs = Array.from(new Set([...(candidate.assignedJobs || []), job.id]));
  const cvEducationEntries = (candidate.educations || []).map((item) => ({
    degree: item.degree || null,
    institution: item.institution || null,
    startYear: item.startYear || null,
    endYear: item.endYear || (item.isOngoing ? 'Present' : null),
  }));
  const cvWorkExperienceEntries = (candidate.workExperiences || []).map((item) => ({
    title: item.jobTitle || null,
    company: item.company || null,
    location: item.workLocation || null,
    startDate: item.startDate ? new Date(item.startDate).toISOString().split('T')[0] : null,
    endDate: item.isCurrentJob ? 'Present' : item.endDate ? new Date(item.endDate).toISOString().split('T')[0] : null,
    responsibilities: splitResponsibilities(item.responsibilities),
  }));
  const cvPortfolioLinks = normalizePortfolioLinks(candidate.portfolioLinks?.links);
  const fallbackEducationEntries = normalizeResumeEducationEntries(resumeJson.education);
  const fallbackWorkEntries = normalizeResumeWorkEntries(
    resumeJson.workExperience || resumeJson.experience
  );
  const resumePersonalInfo = resumeJson.personalInformation || resumeJson.personalInfo || {};
  const resumeSummary = String(resumeJson.summary || '').trim() || null;
  const resumeCertifications = asArray(resumeJson.certifications)
    .map((item) => (typeof item === 'string' ? item.trim() : String(item?.name || item?.title || '').trim()))
    .filter(Boolean);

  await prisma.candidate.update({
    where: { id: candidateId },
    data: {
      firstName: firstName || resumePersonalInfo.fullName?.split?.(' ')?.[0] || candidate.firstName || null,
      lastName:
        lastName ||
        (typeof resumePersonalInfo.fullName === 'string'
          ? resumePersonalInfo.fullName.split(' ').slice(1).join(' ') || null
          : null) ||
        candidate.lastName ||
        null,
      email: candidate.profile?.email || candidate.email || resumePersonalInfo.email || null,
      phone: candidate.profile?.phoneNumber || candidate.whatsappNumber || candidate.phone || resumePersonalInfo.phoneNumber || null,
      linkedIn: candidate.profile?.linkedinUrl || candidate.linkedIn || resumePersonalInfo.linkedinUrl || null,
      resumeUrl: candidate.resume?.fileUrl || candidate.resumeUrl || null,
      recruiterSkills: recruiterSkills.length ? recruiterSkills : resumeSkills,
      experienceYears: calculateExperienceYears(candidate.workExperiences),
      currentTitle: latestWork?.jobTitle || candidate.currentTitle || null,
      currentCompany: latestWork?.company || candidate.currentCompany || null,
      location: latestWork?.workLocation || candidate.location || candidate.profile?.city || resumePersonalInfo.city || null,
      addressLine: candidate.profile?.address || candidate.addressLine || resumePersonalInfo.address || null,
      city: candidate.profile?.city || candidate.city || resumePersonalInfo.city || null,
      country: candidate.profile?.country || candidate.country || resumePersonalInfo.country || null,
      recruiterStatus: 'ACTIVE',
      source: candidate.source || 'Job Portal Application',
      availability: candidate.careerPreferences?.availabilityToStart || candidate.availability || null,
      noticePeriod: candidate.careerPreferences?.noticePeriod || candidate.noticePeriod || null,
      avatar: candidate.profile?.profilePhotoUrl || candidate.avatar || null,
      designation: latestWork?.jobTitle || candidate.designation || null,
      expectedSalary: candidate.careerPreferences?.preferredSalary || candidate.expectedSalary || null,
      currentSalary: candidate.careerPreferences?.currentSalary || candidate.currentSalary || null,
      recruiterEducation: educationSummary || candidate.recruiterEducation || fallbackEducationEntries[0]?.degree || null,
      recruiterLanguages: recruiterLanguages.length ? recruiterLanguages : resumeLanguages,
      certificationsList: resumeCertifications,
      cvSummary: candidate.summary?.summaryText || candidate.cvSummary || resumeSummary,
      cvEducationEntries: cvEducationEntries.length ? cvEducationEntries : fallbackEducationEntries,
      cvWorkExperienceEntries: cvWorkExperienceEntries.length ? cvWorkExperienceEntries : fallbackWorkEntries,
      cvPortfolioLinks,
      preferredLocation:
        candidate.careerPreferences?.preferredLocations?.[0] ||
        candidate.profile?.city ||
        candidate.profile?.country ||
        candidate.preferredLocation ||
        null,
      assignedJobs,
      stage: 'Applied',
      lastActivity: new Date(),
    },
  });

  const existingMatch = await prisma.match.findFirst({
    where: { candidateId, jobId: job.id },
    select: { id: true },
  });

  if (!existingMatch) {
    await prisma.match.create({
      data: {
        candidateId,
        jobId: job.id,
        score: 75,
        status: 'REVIEWED',
        notes: 'Applied from candidate portal',
        createdById: job.createdById || job.assignedToId || undefined,
      },
    });
  }

  const firstStage = await prisma.pipelineStage.findFirst({
    where: { jobId: job.id },
    orderBy: { order: 'asc' },
    select: { id: true },
  });

  if (!firstStage) return;

  const existingPipelineEntry = await prisma.pipelineEntry.findFirst({
    where: { candidateId, jobId: job.id },
    select: { id: true },
  });

  if (!existingPipelineEntry) {
    await prisma.pipelineEntry.create({
      data: {
        candidateId,
        jobId: job.id,
        stageId: firstStage.id,
        movedById: job.createdById || job.assignedToId || undefined,
        notes: 'Applied from candidate portal',
      },
    });
  }
}

/**
 * Create a new job application
 * POST /api/applications
 */
async function createApplication(req, res) {
  try {
    const { candidateId, jobId, screeningAnswers } = req.body;

    if (!candidateId || !jobId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID and Job ID are required',
      });
    }

    // Verify IDs are valid ObjectIds (24-char hex)
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    if (!objectIdRegex.test(candidateId) || !objectIdRegex.test(jobId)) {
      console.warn(`[Application] Invalid ID format: candidateId=${candidateId}, jobId=${jobId}`);
      return res.status(400).json({
        success: false,
        message: candidateId === 'guest' ? 'Please log in to apply for jobs' : 'Invalid ID format provided',
      });
    }

    // Check if application already exists
    const existingApplication = await prisma.application.findUnique({
      where: {
        candidateId_jobId: {
          candidateId,
          jobId,
        },
      },
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: 'You have already applied to this job',
      });
    }

    // Verify job exists
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { company: true },
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    // Create application
    const application = await prisma.application.create({
      data: {
        candidateId,
        jobId,
        status: 'SUBMITTED',
        screeningAnswers: screeningAnswers || {},
      },
      include: {
        job: {
          include: {
            company: true,
          },
        },
      },
    });

    // Create timeline entry
    await prisma.applicationTimeline.create({
      data: {
        applicationId: application.id,
        status: 'SUBMITTED',
        title: 'Application Submitted',
        description: 'Your application has been successfully submitted',
      },
    });

    console.log(`✅ Application created: ${application.id} for job ${jobId} by candidate ${candidateId}`);

    await syncApplicationToRecruiterView(candidateId, job);

    res.json({
      success: true,
      message: 'Application submitted successfully',
      data: {
        applicationId: application.id,
        status: application.status,
        appliedAt: application.appliedAt,
      },
    });
  } catch (error) {
    console.error('Error creating application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit application',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Get all applications for a candidate
 * GET /api/applications/:candidateId
 */
async function getApplications(req, res) {
  try {
    const { candidateId } = req.params;
    const startedAt = Date.now();

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    console.log(`📥 DB fetch requested: applications | candidateId=${candidateId}`);
    const applications = await prisma.application.findMany({
      where: { candidateId },
      include: {
        job: {
          include: {
            company: true,
            client: true,
          },
        },
      },
      orderBy: {
        appliedAt: 'desc',
      },
    });

    // Transform applications to match frontend format
    const transformedApplications = applications.map((app) => {
      const job = app.job;
      const company = job.company;

      // Format salary
      let salary = 'Not specified';
      if (job.salaryMin && job.salaryMax) {
        const currency = job.salaryCurrency || 'USD';
        const salaryType = job.salaryType === 'ANNUAL' ? '/year' : job.salaryType === 'MONTHLY' ? '/month' : '';
        salary = `${currency === 'USD' ? '$' : currency}${job.salaryMin.toLocaleString()} - ${currency === 'USD' ? '$' : currency}${job.salaryMax.toLocaleString()}${salaryType}`;
      }

      // Format status
      const statusMap = {
        SUBMITTED: 'Submitted',
        UNDER_REVIEW: 'Under Review',
        SHORTLISTED: 'Shortlisted',
        ASSESSMENT: 'Assessment',
        INTERVIEW: 'Interview',
        FINAL_DECISION: 'Final Decision',
        SELECTED: 'Selected',
        REJECTED: 'Rejected',
      };

      return {
        id: app.id,
        jobId: job.id,
        jobTitle: job.title,
        company: company?.name || job.client?.companyName || 'Unknown Company',
        status: statusMap[app.status] || app.status,
        appliedDate: app.appliedAt.toISOString().split('T')[0],
        matchScore: app.matchScore || 0,
        salary,
        location: job.location || 'Not specified',
        employmentType: job.employmentType || 'Full-time',
        workMode: job.workMode || 'On-site',
      };
    });

    console.log(
      `📦 DB fetch result: applications | candidateId=${candidateId} | count=${applications.length} | elapsedMs=${Date.now() - startedAt}`
    );

    res.json({
      success: true,
      data: transformedApplications,
    });
  } catch (error) {
    const message = String(error?.message || '');
    const isDbUnavailable =
      error?.code === 'P2010' ||
      message.includes('Server selection timeout') ||
      message.includes('No such host is known') ||
      message.includes('forcibly closed by the remote host') ||
      message.includes('connection');

    if (isDbUnavailable) {
      console.warn('DB unavailable - getApplications');
      return res.status(503).json({
        success: false,
        message: 'Database unavailable',
      });
    }

    console.error('Error fetching applications:', message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch applications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Check if candidate has applied to a job
 * GET /api/applications/check/:candidateId/:jobId
 */
async function checkApplication(req, res) {
  try {
    const { candidateId, jobId } = req.params;
    const startedAt = Date.now();

    if (!candidateId || !jobId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID and Job ID are required',
      });
    }

    console.log(`📥 DB fetch requested: check-application | candidateId=${candidateId} | jobId=${jobId}`);
    const application = await prisma.application.findUnique({
      where: {
        candidateId_jobId: {
          candidateId,
          jobId,
        },
      },
    });

    console.log(
      `📦 DB fetch result: check-application | candidateId=${candidateId} | jobId=${jobId} | hasApplied=${!!application} | elapsedMs=${Date.now() - startedAt}`
    );

    res.json({
      success: true,
      data: {
        hasApplied: !!application,
        status: application?.status || null,
      },
    });
  } catch (error) {
    const message = String(error?.message || '');
    const isDbUnavailable =
      error?.code === 'P2010' ||
      message.includes('Server selection timeout') ||
      message.includes('No such host is known') ||
      message.includes('forcibly closed by the remote host') ||
      message.includes('connection');

    if (isDbUnavailable) {
      console.warn('DB unavailable - checkApplication');
      return res.status(503).json({
        success: false,
        message: 'Database unavailable',
      });
    }

    console.error('Error checking application:', message);
    res.status(500).json({
      success: false,
      message: 'Failed to check application status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

module.exports = {
  createApplication,
  getApplications,
  checkApplication,
};
