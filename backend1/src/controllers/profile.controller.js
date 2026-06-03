const { prisma, retryQuery } = require('../lib/prisma');
const { getMissingProfileSections } = require('../utils/profile-completeness.util');
const { resolveCandidateLocalPhone } = require('../utils/phone.util');
const {
  mapEmploymentTypeToDb,
  mapWorkModeToDb,
  mapWorkExperienceForClient,
} = require('../utils/workExperienceEnums');
const { uploadBufferToCloudinary, destroyByCloudinaryUrl } = require('../lib/s3');
const { randomUUID } = require('crypto');
const {
  scheduleCandidateCommonSync,
  scheduleCandidateCommonSyncDebounced,
  syncCandidateCommonFromDashboard,
} = require('../services/candidateCommonSync.service');
const { filterPortfolioLinks } = require('../utils/portfolioLinkFilter.util');

function isPlaceholderProfileEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  return !value || value.includes('@temp.local');
}

function resolveProfileDisplayEmail(candidate) {
  const profileEmail = String(candidate?.profile?.email || '').trim();
  const candidateEmail = String(candidate?.email || '').trim();

  if (profileEmail && !isPlaceholderProfileEmail(profileEmail)) return profileEmail;
  if (candidateEmail && !isPlaceholderProfileEmail(candidateEmail)) return candidateEmail;

  const resumeJson = candidate?.resume?.resumeJson;
  if (resumeJson && typeof resumeJson === 'object') {
    const resumeEmail = resumeJson?.personalInformation?.email;
    if (resumeEmail && String(resumeEmail).trim()) {
      return String(resumeEmail).trim();
    }
  }

  return profileEmail || candidateEmail || '';
}

function normalizeCandidateIdForDb(candidateId) {
  return String(candidateId || '').trim();
}

function normalizeHumanName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function candidateNamesLikelyMatch(leftName, rightName) {
  const left = normalizeHumanName(leftName);
  const right = normalizeHumanName(rightName);
  if (!left || !right) return true;

  const ignored = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'cv', 'resume', 'profile']);
  const toTokens = (value) =>
    value
      .split(/\s+/)
      .filter((token) => token.length > 1 && !ignored.has(token));

  const leftTokens = toTokens(left);
  const rightTokens = toTokens(right);
  if (!leftTokens.length || !rightTokens.length) return true;

  const leftCompact = leftTokens.join('');
  const rightCompact = rightTokens.join('');
  if (leftCompact === rightCompact) return true;

  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  const commonCount = leftTokens.filter((token) => rightSet.has(token)).length;
  if (commonCount >= Math.min(2, leftTokens.length, rightTokens.length)) return true;

  const leftFirst = leftTokens[0];
  const leftLast = leftTokens[leftTokens.length - 1];
  const rightFirst = rightTokens[0];
  const rightLast = rightTokens[rightTokens.length - 1];

  return (
    (leftSet.has(rightFirst) && leftSet.has(rightLast)) ||
    (rightSet.has(leftFirst) && rightSet.has(leftLast))
  );
}

async function syncResumeJsonEmail(candidateId, email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || isPlaceholderProfileEmail(normalized)) return;

  const resume = await prisma.resume.findUnique({
    where: { candidateId },
    select: { id: true, resumeJson: true },
  });
  if (!resume) return;

  const resumeJson =
    resume.resumeJson && typeof resume.resumeJson === 'object' && !Array.isArray(resume.resumeJson)
      ? { ...resume.resumeJson }
      : {};
  const personalInformation =
    resumeJson.personalInformation &&
    typeof resumeJson.personalInformation === 'object' &&
    !Array.isArray(resumeJson.personalInformation)
      ? { ...resumeJson.personalInformation }
      : {};
  personalInformation.email = normalized;
  resumeJson.personalInformation = personalInformation;

  await prisma.resume.update({
    where: { id: resume.id },
    data: { resumeJson },
  });
}

async function uploadDocumentsToCloudinary(files, { candidateId, folder }) {
  const uploadedFiles = [];

  for (const file of files) {
    const timestamp = Date.now();
    const safeOriginal = String(file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    const uploaded = await uploadBufferToCloudinary({
      buffer: file.buffer,
      folder: `jobportal/${folder}`,
      resourceType: 'auto',
      publicId: `${candidateId}_${timestamp}_${safeOriginal}`,
      originalFilename: file.originalname,
      candidateId,
    });

    uploadedFiles.push({
      name: file.originalname,
      url: uploaded.secure_url,
      size: file.size,
    });
  }

  return uploadedFiles;
}

/**
 * Get all profile data for a candidate
 * GET /api/profile/:candidateId
 */
async function getProfileData(req, res) {
  try {
    const { candidateId } = req.params;
    const startedAt = Date.now();

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    console.log(`📋 Fetching profile data for candidate: ${candidateId}`);

    console.log(`📥 DB fetch requested: profile-data | candidateId=${candidateId}`);
    // Fetch all candidate data with retry logic
    let candidate;
    try {
      candidate = await retryQuery(async () => {
        return await prisma.candidate.findUnique({
      where: { id: candidateId },
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
      },
    });
      });
    } catch (dbError) {
      console.error('❌ Database connection error:', dbError);
      
      // Extract error message from Prisma error structure
      let errorMessage = '';
      if (dbError.meta && dbError.meta.message) {
        errorMessage = dbError.meta.message;
      } else if (dbError.message) {
        errorMessage = dbError.message;
      } else {
        errorMessage = String(dbError);
      }
      
      const isConnectionError = 
        errorMessage.includes('Server selection timeout') || 
        errorMessage.includes('No available servers') ||
        errorMessage.includes('fatal alert: InternalError') ||
        errorMessage.includes('connection') ||
        dbError.code === 'P2010';
      
      if (isConnectionError) {
        console.error('⚠️  MongoDB Atlas connection issue detected. Possible causes:');
        console.error('   1. MongoDB Atlas cluster is paused (free tier auto-pauses after inactivity)');
        console.error('   2. Network connectivity issues');
        console.error('   3. IP whitelist restrictions (check MongoDB Atlas Network Access)');
        console.error('   4. Connection string issues (verify DATABASE_URL in .env)');
        console.error('   5. Cluster might be restarting or unavailable');
        
        return res.status(503).json({
          success: false,
          message: 'Database connection failed. Please check MongoDB Atlas cluster status. The cluster may be paused or unreachable.',
          error: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
          troubleshooting: process.env.NODE_ENV === 'development' ? {
            step1: 'Check MongoDB Atlas dashboard - ensure cluster is running (not paused)',
            step2: 'Verify IP whitelist allows your IP or 0.0.0.0/0',
            step3: 'Check DATABASE_URL in .env file',
            step4: 'Try resuming the cluster if it\'s paused',
          } : undefined,
        });
      }
      
      // Re-throw other errors to be handled by error middleware
      throw dbError;
    }

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found',
      });
    }

    const displayEmail = resolveProfileDisplayEmail(candidate);

    const fullNameParts = String(candidate.profile?.fullName || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const fallbackFirstName = fullNameParts[0] || '';
    const fallbackMiddleName =
      fullNameParts.length > 2 ? fullNameParts.slice(1, -1).join(' ') : '';
    const fallbackLastName =
      fullNameParts.length > 1 ? fullNameParts[fullNameParts.length - 1] : '';

    const gapExplanations = extractGapEntries(candidate.gapExplanation);
    const latestGapExplanation = gapExplanations.length > 0
      ? gapExplanations[gapExplanations.length - 1]
      : null;
    const internships = extractInternshipEntries(candidate.internship);
    const latestInternship = internships.length > 0
      ? internships[internships.length - 1]
      : null;
    const academicAchievements = extractAcademicAchievementEntries(candidate.academicAchievement);
    const latestAcademicAchievement = academicAchievements.length > 0
      ? academicAchievements[academicAchievements.length - 1]
      : null;
    const projects = extractProjectEntries(candidate.project);
    const latestProject = projects.length > 0
      ? projects[projects.length - 1]
      : null;
    const competitiveExams = extractCompetitiveExamEntries(candidate.competitiveExam);
    const latestCompetitiveExam = competitiveExams.length > 0
      ? competitiveExams[competitiveExams.length - 1]
      : null;
    const derivedCurrentRole = String(
      candidate.currentTitle
      || candidate.designation
      || candidate.workExperiences.find((exp) => exp.isCurrentJob)?.jobTitle
      || candidate.workExperiences[0]?.jobTitle
      || '',
    ).trim();

    // Format data for frontend
    const profileData = {
      // Used by AuthContext / headers — was missing so WhatsApp + display name never hydrated from /profile alone
      candidateId: candidate.id,
      whatsappNumber: candidate.whatsappNumber || '',
      countryCode: candidate.countryCode || '+91',
      personalInfo: candidate.profile ? {
        // Prefer Candidate model firstName/lastName (updated by user), fallback to split fullName
        firstName: candidate.firstName || fallbackFirstName,
        middleName: candidate.middleName || fallbackMiddleName,
        lastName: candidate.lastName ?? (fallbackLastName || null),
        email: displayEmail,
        profilePhotoUrl: candidate.profile.profilePhotoUrl || '',
        phone: resolveCandidateLocalPhone(candidate),
        phoneCode: mapPhoneCode(candidate.countryCode),
        countryCode: candidate.countryCode || '+91',
        whatsappNumber: candidate.whatsappNumber || '',
        gender: mapGenderLabel(candidate.profile.gender),
        dob: candidate.profile.dateOfBirth ? new Date(candidate.profile.dateOfBirth).toISOString().split('T')[0] : '',
        country: candidate.profile.country || '',
        city: candidate.profile.city || '',
        employment: mapEmploymentLabel(candidate.profile.employmentStatus),
        address: candidate.profile.address || '',
        nationality: candidate.profile.nationality || '',
        passportNumber: candidate.profile.passportNumber || '',
        linkedinUrl: candidate.profile.linkedinUrl || '',
      } : null,
      summaryText: candidate.summary?.summaryText || '',
      gapExplanation: latestGapExplanation,
      gapExplanations,
      internship: latestInternship,
      internships,
      portfolioLinks: candidate.portfolioLinks
        ? {
            links: filterPortfolioLinks(
              Array.isArray(candidate.portfolioLinks.links) ? candidate.portfolioLinks.links : [],
            ),
          }
        : null,
      education: candidate.educations.map(edu => ({
        id: edu.id,
        educationLevel: edu.educationLevel || '',
        degreeProgram: edu.degree || '',
        institutionName: edu.institution || '',
        fieldOfStudy: edu.specialization || '',
        startYear: edu.startYear?.toString() || '',
        startMonth: edu.startMonth?.toString() || '',
        endYear: edu.endYear?.toString() || '',
        endMonth: edu.endMonth?.toString() || '',
        currentlyStudying: edu.isOngoing || false,
        grade: edu.grade || '',
        modeOfStudy: edu.modeOfStudy || '',
        courseDuration: edu.courseDuration || '',
        documents: Array.isArray(edu.documents) ? edu.documents : [],
      })),
      workExperience: candidate.workExperiences.map((exp) =>
        mapWorkExperienceForClient(exp)
      ),
      skills: candidate.skills.map(cs => ({
        id: cs.id,
        name: cs.skill?.name || '',
        proficiency: mapProficiency(cs.proficiency),
        category: cs.skill?.category || 'Hard Skills',
      })),
      skillsAdditionalNotes: candidate.profile?.skillsAdditionalNotes || '',
      languages: candidate.languages.map(lang => ({
        id: lang.id,
        name: lang.name || '',
        proficiency: mapProficiency(lang.proficiency),
        speak: lang.canSpeak || false,
        read: lang.canRead || false,
        write: lang.canWrite || false,
        documents: Array.isArray(lang.documents) ? lang.documents : [],
      })),
      careerPreferences: candidate.careerPreferences ? {
        currentRole: derivedCurrentRole || '',
        // Preferred Job Titles / Roles
        preferredJobTitles: candidate.careerPreferences.preferredRoles || [],
        preferredRoles: candidate.careerPreferences.preferredRoles || [],
        preferredIndustry: candidate.careerPreferences.preferredIndustry || '',
        functionalArea: candidate.careerPreferences.functionalArea || '',
        jobTypes: candidate.careerPreferences.jobTypes || [],
        // Work Mode (multi-select stored in passportNumbersByLocation.__workModes for backward compatibility)
        workModes: (() => {
          const fallbackMode =
            candidate.careerPreferences.preferredWorkMode === 'REMOTE'
              ? 'Remote'
              : candidate.careerPreferences.preferredWorkMode === 'ON_SITE'
                ? 'On-site'
                : candidate.careerPreferences.preferredWorkMode === 'HYBRID'
                  ? 'Hybrid'
                  : '';
          const rawMeta = candidate.careerPreferences.passportNumbersByLocation;
          const rawModes =
            rawMeta && typeof rawMeta === 'object' && Array.isArray(rawMeta.__workModes)
              ? rawMeta.__workModes
              : [];
          const normalized = [...new Set(rawModes.map((m) => String(m || '').trim()).filter(Boolean))];
          if (normalized.length > 0) return normalized;
          return fallbackMode ? [fallbackMode] : [];
        })(),
        preferredWorkMode: (() => {
          const rawMeta = candidate.careerPreferences.passportNumbersByLocation;
          const rawModes =
            rawMeta && typeof rawMeta === 'object' && Array.isArray(rawMeta.__workModes)
              ? rawMeta.__workModes
              : [];
          const normalized = [...new Set(rawModes.map((m) => String(m || '').trim()).filter(Boolean))];
          if (normalized.length > 0) return normalized[0];
          return candidate.careerPreferences.preferredWorkMode === 'REMOTE'
            ? 'Remote'
            : candidate.careerPreferences.preferredWorkMode === 'ON_SITE'
              ? 'On-site'
              : candidate.careerPreferences.preferredWorkMode === 'HYBRID'
                ? 'Hybrid'
                : '';
        })(),
        // Location
        preferredLocations: candidate.careerPreferences.preferredLocations || [],
        relocationPreference: candidate.careerPreferences.relocationPreference || 
          (candidate.careerPreferences.openToRelocation ? 'Open to Relocate' : 'Not Open to Relocate'),
        // Current Salary
        currentCurrency: candidate.careerPreferences.currentCurrency || '',
        currentSalaryType: candidate.careerPreferences.currentSalaryType === 'ANNUAL' ? 'Annual' :
                          candidate.careerPreferences.currentSalaryType === 'MONTHLY' ? 'Monthly' :
                          candidate.careerPreferences.currentSalaryType === 'HOURLY' ? 'Hourly' :
                          candidate.careerPreferences.currentSalaryType === 'DAILY' ? 'Daily' : '',
        currentSalary: candidate.careerPreferences.currentSalary?.toString() || '',
        currentLocation: candidate.careerPreferences.currentLocation || '',
        currentBenefits: candidate.careerPreferences.currentBenefits || [],
        // Preferred Salary
        salaryCurrency: candidate.careerPreferences.preferredCurrency || 'USD',
        preferredCurrency: candidate.careerPreferences.preferredCurrency || 'USD',
        salaryAmount: candidate.careerPreferences.preferredSalary?.toString() || '',
        preferredSalary: candidate.careerPreferences.preferredSalary?.toString() || '',
        salaryFrequency: candidate.careerPreferences.preferredSalaryType === 'ANNUAL' ? 'Annually' :
                         candidate.careerPreferences.preferredSalaryType === 'MONTHLY' ? 'Monthly' :
                         candidate.careerPreferences.preferredSalaryType === 'HOURLY' ? 'Hourly' :
                         candidate.careerPreferences.preferredSalaryType === 'DAILY' ? 'Daily' : '',
        preferredSalaryType: candidate.careerPreferences.preferredSalaryType === 'ANNUAL' ? 'Annual' :
                            candidate.careerPreferences.preferredSalaryType === 'MONTHLY' ? 'Monthly' :
                            candidate.careerPreferences.preferredSalaryType === 'HOURLY' ? 'Hourly' :
                            candidate.careerPreferences.preferredSalaryType === 'DAILY' ? 'Daily' : '',
        preferredBenefits: candidate.careerPreferences.preferredBenefits || [],
        // Availability
        availabilityToStart: candidate.careerPreferences.availabilityToStart || '',
        noticePeriod: candidate.careerPreferences.noticePeriod || 
          (candidate.careerPreferences.noticePeriodDays ? `${candidate.careerPreferences.noticePeriodDays} days` : ''),
        // Passport Numbers (hide internal __workModes metadata from clients)
        passportNumbersByLocation:
          candidate.careerPreferences.passportNumbersByLocation &&
          typeof candidate.careerPreferences.passportNumbersByLocation === 'object'
            ? Object.fromEntries(
                Object.entries(candidate.careerPreferences.passportNumbersByLocation).filter(
                  ([key]) => key !== '__workModes',
                ),
              )
            : null,
      } : null,
      resume: candidate.resume ? {
        fileName: candidate.resume.fileName || '',
        fileUrl: candidate.resume.fileUrl || '',
        fileSize: candidate.resume.fileSize || null,
        mimeType: candidate.resume.mimeType || null,
        atsScore: candidate.resume.atsScore || null,
        aiAnalyzed: candidate.resume.aiAnalyzed || false,
        uploadedDate: candidate.resume.uploadedAt ? new Date(candidate.resume.uploadedAt).toISOString() : '',
      } : null,
      project: latestProject,
      projects,
      academicAchievement: latestAcademicAchievement,
      academicAchievements,
      competitiveExam: latestCompetitiveExam,
      competitiveExams,
      certifications: {
        certifications: candidate.certifications.map((cert) => ({
          id: cert.id,
          certificationName: cert.certificationName || '',
          issuingOrganization: cert.issuingOrganization || '',
          issueDate: cert.issueDate || '',
          expiryDate: cert.expiryDate || undefined,
          doesNotExpire: cert.doesNotExpire || false,
          credentialId: cert.credentialId || undefined,
          credentialUrl: cert.credentialUrl || undefined,
          certificateFile: cert.certificateFile || undefined,
          documents: Array.isArray(cert.documents) ? cert.documents : [],
          description: cert.description || undefined,
        })),
      },
      accomplishments: {
        accomplishments: candidate.accomplishments.map((acc) => ({
          id: acc.id,
          title: acc.title || '',
          category: acc.category || '',
          organization: acc.organization || undefined,
          achievementDate: acc.achievementDate || '',
          description: acc.description || undefined,
          supportingDocument: acc.supportingDocument || undefined,
          documents: Array.isArray(acc.documents) ? acc.documents : [],
        })),
      },
      visaWorkAuthorization: candidate.visaWorkAuthorization ? {
        selectedDestination: candidate.visaWorkAuthorization.selectedDestination || '',
        visaDetailsInitial: candidate.visaWorkAuthorization.visaDetailsInitial || undefined,
        visaDetailsExpected: candidate.visaWorkAuthorization.visaDetailsExpected || undefined,
        visaWorkpermitRequired: candidate.visaWorkAuthorization.visaWorkpermitRequired || '',
        openForAll: candidate.visaWorkAuthorization.openForAll || false,
        additionalRemarks: candidate.visaWorkAuthorization.additionalRemarks || '',
        visaEntries: candidate.visaWorkAuthorization.visaEntries || [],
      } : null,
      vaccination: candidate.vaccination ? {
        vaccinationStatus: candidate.vaccination.vaccinationStatus || '',
        vaccineType: candidate.vaccination.vaccineType || undefined,
        lastVaccinationDate: candidate.vaccination.lastVaccinationDate || undefined,
        validityMonth: candidate.vaccination.validityMonth || undefined,
        validityYear: candidate.vaccination.validityYear || undefined,
        certificate: candidate.vaccination.certificate || undefined,
        documents: (() => {
          const docs = Array.isArray(candidate.vaccination.documents)
            ? candidate.vaccination.documents.filter(Boolean)
            : [];
          if (docs.length > 0) return docs;
          return candidate.vaccination.certificate ? [candidate.vaccination.certificate] : [];
        })(),
      } : null,
    };

    console.log(
      `📦 DB fetch result: profile-data | candidateId=${candidateId} | educations=${candidate.educations?.length || 0} | workExperiences=${candidate.workExperiences?.length || 0} | skills=${candidate.skills?.length || 0} | elapsedMs=${Date.now() - startedAt}`
    );
    console.log(`✅ Successfully fetched profile data for candidate: ${candidateId}`);
    res.json({
      success: true,
      data: profileData,
    });
  } catch (error) {
    console.error('❌ Error fetching profile data:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}

/**
 * Get profile completeness details for a candidate
 * GET /api/profile/completeness/:candidateId
 */
async function getProfileCompleteness(req, res) {
  try {
    const { candidateId } = req.params;
    const startedAt = Date.now();

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    console.log(`📥 DB fetch requested: profile-completeness | candidateId=${candidateId}`);
    const completeness = await getMissingProfileSections(candidateId, { persist: true });
    console.log(
      `📦 DB fetch result: profile-completeness | candidateId=${candidateId} | percentage=${completeness?.percentage ?? 0} | completedSections=${completeness?.completedSections?.length || 0} | missingSections=${completeness?.missingSections?.length || 0} | elapsedMs=${Date.now() - startedAt}`
    );

    res.json({
      success: true,
      data: completeness,
    });
  } catch (error) {
    console.error('Error fetching profile completeness:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to fetch profile completeness',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Update personal information
 * PUT /api/profile/personal-info/:candidateId
 */
async function updatePersonalInfo(req, res) {
  try {
    const { candidateId } = req.params;
    const sessionCandidateId = normalizeCandidateIdForDb(req.user?.candidateId);
    const targetCandidateId = normalizeCandidateIdForDb(candidateId);
    const personalInfo = req.body || {};
    const normalizeNullableText = (value) => {
      if (value === undefined || value === null) return null;
      const normalized = String(value).trim();
      return normalized || null;
    };
    const normalizeRequiredText = (value) => {
      if (value === undefined || value === null) return '';
      return String(value).trim();
    };
    const normalizedInfo = {
      firstName: normalizeNullableText(personalInfo.firstName),
      middleName: normalizeNullableText(personalInfo.middleName),
      lastName: normalizeNullableText(personalInfo.lastName),
      email: normalizeRequiredText(personalInfo.email).toLowerCase(),
      phone: normalizeNullableText(personalInfo.phone),
      phoneCode: normalizeNullableText(personalInfo.phoneCode),
      gender: normalizeNullableText(personalInfo.gender),
      dob: normalizeNullableText(personalInfo.dob),
      country: normalizeNullableText(personalInfo.country),
      city: normalizeNullableText(personalInfo.city),
      address: normalizeNullableText(personalInfo.address),
      nationality: normalizeNullableText(personalInfo.nationality),
      passportNumber: normalizeNullableText(personalInfo.passportNumber),
      linkedinUrl: normalizeNullableText(personalInfo.linkedinUrl),
      employment: normalizeNullableText(personalInfo.employment),
    };

    // JWT is authoritative (storage URL param can be stale after re-login / email-based ids).
    const effectiveCandidateId = sessionCandidateId || targetCandidateId;

    if (!effectiveCandidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    if (
      sessionCandidateId &&
      targetCandidateId &&
      sessionCandidateId !== targetCandidateId
    ) {
      console.warn(
        `[profile] personal-info id mismatch — using JWT candidate ${sessionCandidateId} (param was ${targetCandidateId})`
      );
    }

    const saveCandidateId = effectiveCandidateId;

    // Combine firstName, middleName, lastName into fullName
    const nameParts = [
      normalizedInfo.firstName,
      normalizedInfo.middleName,
      normalizedInfo.lastName,
    ].filter(Boolean);
    const fullName = nameParts.join(' ') || '';

    // Format date of birth
    let dateOfBirth = null;
    if (normalizedInfo.dob) {
      dateOfBirth = parseDateString(normalizedInfo.dob);
      const today = new Date();
      const minimumAdultDob = new Date(today);
      minimumAdultDob.setFullYear(today.getFullYear() - 18);
      if (dateOfBirth > minimumAdultDob) {
        return res.status(400).json({
          success: false,
          message: 'Candidate must be at least 18 years old',
        });
      }
    }

    // Map employment status
    let employmentStatus = null;
    if (normalizedInfo.employment) {
      const employmentMap = {
        'Employed': 'EMPLOYED',
        'Unemployed': 'UNEMPLOYED',
        'Freelancing': 'FREELANCING',
        'Student': 'STUDENT',
        'Other': 'OTHER',
      };
      employmentStatus = employmentMap[normalizedInfo.employment] || null;
    }

    // Map gender
    let gender = null;
    if (normalizedInfo.gender) {
      const genderMap = {
        'Male': 'MALE',
        'Female': 'FEMALE',
        'Other': 'OTHER',
      };
      gender = genderMap[normalizedInfo.gender] || null;
    }

    const normalizedEmail = normalizedInfo.email;
    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    const emailToPersist = normalizedEmail;

    // Upsert candidate profile (duplicate emails across candidates are allowed)
    await prisma.candidateProfile.upsert({
      where: { candidateId: saveCandidateId },
      update: {
        fullName,
        email: emailToPersist || '',
        phoneNumber: normalizedInfo.phone,
        gender: gender || undefined,
        dateOfBirth: dateOfBirth || undefined,
        country: normalizedInfo.country,
        city: normalizedInfo.city,
        address: normalizedInfo.address,
        nationality: normalizedInfo.nationality,
        passportNumber: normalizedInfo.passportNumber,
        linkedinUrl: normalizedInfo.linkedinUrl,
        employmentStatus: employmentStatus || undefined,
      },
      create: {
        candidateId: saveCandidateId,
        fullName,
        email: emailToPersist || '',
        phoneNumber: normalizedInfo.phone,
        gender: gender || undefined,
        dateOfBirth: dateOfBirth || undefined,
        country: normalizedInfo.country,
        city: normalizedInfo.city,
        address: normalizedInfo.address,
        nationality: normalizedInfo.nationality,
        passportNumber: normalizedInfo.passportNumber,
        linkedinUrl: normalizedInfo.linkedinUrl,
        employmentStatus: employmentStatus || undefined,
      },
    });

    // Mirror contact + name on Candidate (used by auth, OTP login, and common sync)
    try {
      const candidateUpdate = {
        email: emailToPersist,
        firstName: normalizedInfo.firstName,
        lastName: normalizedInfo.lastName,
      };
      if (normalizedInfo.phoneCode) {
        candidateUpdate.countryCode = normalizedInfo.phoneCode.split(' ')[0];
      }
      if (normalizedInfo.phone) {
        candidateUpdate.phone = normalizedInfo.phone;
      }
      await prisma.candidate.update({
        where: { id: saveCandidateId },
        data: candidateUpdate,
      });
    } catch (e) {
      console.warn('Candidate mirror update failed:', e.message);
    }

    try {
      await syncResumeJsonEmail(saveCandidateId, emailToPersist);
    } catch (e) {
      console.warn('Resume JSON email sync failed:', e.message);
    }

    // Prepare log data (only show actual saved values, not duplicates)
    const logData = {
      name: {
        first: normalizedInfo.firstName || '',
        middle: normalizedInfo.middleName || '',
        last: normalizedInfo.lastName || '',
        full: fullName,
      },
      contact: {
        email: emailToPersist,
        phone: normalizedInfo.phone,
        phoneCode: normalizedInfo.phoneCode,
      },
      personal: {
        gender: gender || null,
        dateOfBirth: dateOfBirth ? dateOfBirth.toISOString().split('T')[0] : null,
        employmentStatus: employmentStatus || null,
      },
      location: {
        country: normalizedInfo.country,
        city: normalizedInfo.city,
        address: normalizedInfo.address,
        nationality: normalizedInfo.nationality,
      },
      additional: {
        passportNumber: normalizedInfo.passportNumber,
        linkedinUrl: normalizedInfo.linkedinUrl,
      },
    };
    
    logProfileSave('Personal Information', 'upserted', saveCandidateId, logData);

    scheduleCandidateCommonSync(saveCandidateId, { forceVerified: true });

    res.json({
      success: true,
      message: 'Personal information updated successfully',
      data: {
        candidateId: saveCandidateId,
        personalInfo: {
          firstName: normalizedInfo.firstName || '',
          middleName: normalizedInfo.middleName || '',
          lastName: normalizedInfo.lastName || '',
          email: emailToPersist,
          phone: normalizedInfo.phone,
          phoneCode: normalizedInfo.phoneCode,
          gender: normalizedInfo.gender,
          dob: normalizedInfo.dob,
          country: normalizedInfo.country,
          city: normalizedInfo.city,
          employment: normalizedInfo.employment,
          passportNumber: normalizedInfo.passportNumber,
        },
      },
    });
  } catch (error) {
    console.error('Error updating personal info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update personal information',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Create or update education
 * POST /api/profile/education/:candidateId
 * PUT /api/profile/education/:educationId
 */
async function saveEducation(req, res) {
  try {
    const { candidateId, educationId } = req.params;
    const education = req.body;

    if (!candidateId && !educationId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID or Education ID is required',
      });
    }

    const educationData = {
      educationLevel: education.educationLevel?.trim() || null,
      degree: education.degreeProgram?.trim() || '',
      institution: education.institutionName?.trim() || '',
      specialization: education.fieldOfStudy?.trim() || null,
      startYear: parseInt(education.startYear) || new Date().getFullYear(),
      startMonth: education.startMonth ? parseInt(education.startMonth) : null,
      endYear: education.endYear ? parseInt(education.endYear) : null,
      endMonth: education.endMonth ? parseInt(education.endMonth) : null,
      isOngoing: education.currentlyStudying || false,
      grade: education.grade?.trim() || null,
      modeOfStudy: education.modeOfStudy?.trim() || null,
      courseDuration: education.courseDuration?.trim() || null,
      description: education.description?.trim() || null,
      documents: Array.isArray(education.documents) 
        ? education.documents.map(doc => typeof doc === 'string' ? doc : doc.url || doc.name).filter(Boolean)
        : [],
    };

    // Prepare detailed log data
    const logData = {
      educationLevel: educationData.educationLevel || null,
      degree: educationData.degree,
      institution: educationData.institution,
      specialization: educationData.specialization || null,
      startYear: educationData.startYear,
      startMonth: educationData.startMonth || null,
      endYear: educationData.endYear || null,
      endMonth: educationData.endMonth || null,
      isOngoing: educationData.isOngoing,
      grade: educationData.grade || null,
      modeOfStudy: educationData.modeOfStudy || null,
      courseDuration: educationData.courseDuration || null,
      documentsCount: educationData.documents.length,
      description: educationData.description ? 'Present' : null,
    };

    if (educationId) {
      // Update existing education
      await prisma.education.update({
        where: { id: educationId },
        data: educationData,
      });
      logProfileSave('Education', 'updated', educationId, logData);
      res.json({
        success: true,
        message: 'Education updated successfully',
      });
    } else {
      // Create new education
      const created = await prisma.education.create({
        data: {
          candidateId,
          ...educationData,
        },
      });
      logProfileSave('Education', 'created', candidateId, logData);
      res.json({
        success: true,
        message: 'Education added successfully',
        data: {
          id: created.id,
          ...created,
        },
      });
    }
  } catch (error) {
    console.error('Error saving education:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save education',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Delete education
 * DELETE /api/profile/education/:educationId
 */
async function deleteEducation(req, res) {
  try {
    const { educationId } = req.params;

    await prisma.education.delete({
      where: { id: educationId },
    });

    logProfileSave('Education', 'deleted', educationId, {});

    res.json({
      success: true,
      message: 'Education deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting education:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete education',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Create or update work experience
 * POST /api/profile/work-experience/:candidateId
 * PUT /api/profile/work-experience/:experienceId
 */
async function saveWorkExperience(req, res) {
  try {
    const { candidateId, experienceId } = req.params;
    const experience = req.body;

    if (!candidateId && !experienceId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID or Experience ID is required',
      });
    }

    const employmentType = mapEmploymentTypeToDb(experience.employmentType);
    const workMode = mapWorkModeToDb(experience.workMode);

    if (experience.employmentType && !employmentType) {
      return res.status(400).json({
        success: false,
        message: `Invalid employment type: ${experience.employmentType}`,
      });
    }

    if (experience.workMode && !workMode) {
      return res.status(400).json({
        success: false,
        message: `Invalid work mode: ${experience.workMode}`,
      });
    }

    // Validate required fields
    if (!experience.jobTitle || !experience.companyName) {
      return res.status(400).json({
        success: false,
        message: 'Job title and company name are required',
      });
    }

    // Validate start date
    if (!experience.startDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date is required',
      });
    }

    const experienceData = {
      jobTitle: experience.jobTitle.trim(),
      company: experience.companyName.trim(),
      workLocation: experience.workLocation?.trim() || null,
      workMode,
      startDate: new Date(experience.startDate),
      endDate: experience.endDate ? new Date(experience.endDate) : null,
      isCurrentJob: experience.currentlyWorkHere || false,
      responsibilities: experience.keyResponsibilities?.trim() || null,
      industry: experience.industryDomain?.trim() || null,
      employmentType,
      numberOfReportees: experience.numberOfReportees?.trim() || null,
      companyProfile: experience.companyProfile?.trim() || null,
      companyTurnover: experience.companyTurnover?.trim() || null,
      achievements: experience.achievements?.trim() || null,
      workSkills: Array.isArray(experience.workSkills) ? experience.workSkills.filter(skill => skill && skill.trim()) : [],
      documents: Array.isArray(experience.documents) 
        ? experience.documents.map(doc => typeof doc === 'string' ? doc : doc.url || doc.name).filter(Boolean)
        : [],
    };

    if (experienceId) {
      // Update existing work experience
      await prisma.workExperience.update({
        where: { id: experienceId },
        data: experienceData,
      });
      logProfileSave('Work Experience', 'updated', experienceId, {
        candidateId,
        jobTitle: experienceData.jobTitle,
        company: experienceData.company,
        employmentType: experienceData.employmentType || null,
        industry: experienceData.industry || null,
        workLocation: experienceData.workLocation || null,
        workMode: experienceData.workMode || null,
        numberOfReportees: experienceData.numberOfReportees || null,
        startDate: experienceData.startDate,
        endDate: experienceData.endDate || null,
        isCurrentJob: experienceData.isCurrentJob,
        companyProfile: experienceData.companyProfile || null,
        companyTurnover: experienceData.companyTurnover || null,
        achievements: experienceData.achievements || null,
        workSkills: experienceData.workSkills || [],
        documents: experienceData.documents || [],
        responsibilities: experienceData.responsibilities ? 'Present' : null,
      });
      res.json({
        success: true,
        message: 'Work experience updated successfully',
      });
    } else {
      // Create new work experience
      const created = await prisma.workExperience.create({
        data: {
          candidateId,
          ...experienceData,
        },
      });
      logProfileSave('Work Experience', 'created', candidateId, {
        jobTitle: experienceData.jobTitle,
        company: experienceData.company,
        employmentType: experienceData.employmentType || null,
        industry: experienceData.industry || null,
        workLocation: experienceData.workLocation || null,
        workMode: experienceData.workMode || null,
        numberOfReportees: experienceData.numberOfReportees || null,
        startDate: experienceData.startDate,
        endDate: experienceData.endDate || null,
        isCurrentJob: experienceData.isCurrentJob,
        companyProfile: experienceData.companyProfile || null,
        companyTurnover: experienceData.companyTurnover || null,
        achievements: experienceData.achievements || null,
        workSkills: experienceData.workSkills || [],
        documents: experienceData.documents || [],
        responsibilities: experienceData.responsibilities ? 'Present' : null,
      });
      res.json({
        success: true,
        message: 'Work experience added successfully',
        data: mapWorkExperienceForClient(created),
      });
    }
  } catch (error) {
    console.error('Error saving work experience:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
    });
    res.status(500).json({
      success: false,
      message: 'Failed to save work experience',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      details: process.env.NODE_ENV === 'development' ? {
        code: error.code,
        meta: error.meta,
      } : undefined,
    });
  }
}

/**
 * Upload work experience documents
 * POST /api/profile/work-experience/documents/:candidateId
 */
async function uploadWorkExperienceDocuments(req, res) {
  try {
    const { candidateId } = req.params;
    const files = req.files;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded',
      });
    }

    const uploadedFiles = await uploadDocumentsToCloudinary(files, {
      candidateId,
      folder: 'work-experience',
    });

    console.log(`📎 Uploaded ${uploadedFiles.length} work experience document(s) for candidate: ${candidateId}`);

    res.json({
      success: true,
      message: 'Documents uploaded successfully',
      data: {
        documents: uploadedFiles,
      },
    });
  } catch (error) {
    console.error('Error uploading work experience documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload documents',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Upload education documents
 * POST /api/profile/education/documents/:candidateId
 */
async function uploadEducationDocuments(req, res) {
  try {
    const { candidateId } = req.params;
    const files = req.files;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded',
      });
    }

    const uploadedFiles = await uploadDocumentsToCloudinary(files, {
      candidateId,
      folder: 'education',
    });

    console.log(`📎 Uploaded ${uploadedFiles.length} education document(s) for candidate: ${candidateId}`);

    res.json({
      success: true,
      message: 'Documents uploaded successfully',
      data: {
        documents: uploadedFiles,
      },
    });
  } catch (error) {
    console.error('Error uploading education documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload documents',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Upload academic achievement documents
 * POST /api/profile/academic-achievement/documents/:candidateId
 */
async function uploadAcademicAchievementDocuments(req, res) {
  try {
    const { candidateId } = req.params;
    const files = req.files;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded',
      });
    }

    const uploadedFiles = await uploadDocumentsToCloudinary(files, {
      candidateId,
      folder: 'academic-achievement',
    });

    console.log(`📎 Uploaded ${uploadedFiles.length} academic achievement document(s) for candidate: ${candidateId}`);

    res.json({
      success: true,
      message: 'Documents uploaded successfully',
      data: {
        documents: uploadedFiles,
      },
    });
  } catch (error) {
    console.error('Error uploading academic achievement documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload documents',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function uploadInternshipDocuments(req, res) {
  try {
    const { candidateId } = req.params;
    const files = req.files;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded',
      });
    }

    const uploadedFiles = await uploadDocumentsToCloudinary(files, {
      candidateId,
      folder: 'internship',
    });

    console.log(`📎 Uploaded ${uploadedFiles.length} internship document(s) for candidate: ${candidateId}`);

    res.json({
      success: true,
      message: 'Documents uploaded successfully',
      data: {
        documents: uploadedFiles,
      },
    });
  } catch (error) {
    console.error('Error uploading internship documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload documents',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Delete work experience
 * DELETE /api/profile/work-experience/:experienceId
 */
async function deleteWorkExperience(req, res) {
  try {
    const { experienceId } = req.params;

    await prisma.workExperience.delete({
      where: { id: experienceId },
    });

    logProfileSave('Work Experience', 'deleted', experienceId, {});

    res.json({
      success: true,
      message: 'Work experience deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting work experience:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete work experience',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Save skills
 * POST /api/profile/skills/:candidateId
 */
async function saveSkills(req, res) {
  try {
    const { candidateId } = req.params;
    const { skills, additionalNotes } = req.body;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    // Delete existing skills
    await prisma.candidateSkill.deleteMany({
      where: { candidateId },
    });

    // Create new skills
    for (const skillData of skills) {
      // Find or create skill
      let skill = await prisma.skill.findUnique({
        where: { name: skillData.name },
      });

      if (!skill) {
        skill = await prisma.skill.create({
          data: {
            name: skillData.name,
            category: skillData.category || null,
          },
        });
      }

      // Map proficiency
      const proficiencyMap = {
        'Beginner': 'BEGINNER',
        'Intermediate': 'INTERMEDIATE',
        'Advanced': 'ADVANCED',
      };

      // Create candidate skill
      await prisma.candidateSkill.create({
        data: {
          candidateId,
          skillId: skill.id,
          proficiency: proficiencyMap[skillData.proficiency] || 'INTERMEDIATE',
        },
      });
    }

    // Update or create candidate profile with additional notes
    await prisma.candidateProfile.upsert({
      where: { candidateId },
      update: {
        skillsAdditionalNotes: additionalNotes || null,
      },
      create: {
        candidateId,
        fullName: '', // Required field, will be updated later
        email: '', // Required field, will be updated later
        skillsAdditionalNotes: additionalNotes || null,
      },
    });

    logProfileSave('Skills', 'saved', candidateId, {
      totalSkills: skills.length,
      skillNames: skills.map((skill) => skill.name),
      additionalNotes: additionalNotes ? (additionalNotes.length > 100 ? additionalNotes.substring(0, 100) + '...' : additionalNotes) : null,
    });

    res.json({
      success: true,
      message: 'Skills saved successfully',
    });
  } catch (error) {
    console.error('Error saving skills:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save skills',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Delete all skills
 * DELETE /api/profile/skills/:candidateId
 */
async function deleteSkills(req, res) {
  try {
    const { candidateId } = req.params;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    // Delete all candidate skills
    await prisma.candidateSkill.deleteMany({
      where: { candidateId },
    });

    // Clear additional notes
    await prisma.candidateProfile.updateMany({
      where: { candidateId },
      data: {
        skillsAdditionalNotes: null,
      },
    });

    logProfileSave('Skills', 'deleted', candidateId, {
      message: 'All skills deleted',
    });

    res.json({
      success: true,
      message: 'Skills deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting skills:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete skills',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Upload language documents
 * POST /api/profile/languages/documents/:candidateId
 */
async function uploadLanguageDocuments(req, res) {
  try {
    const { candidateId } = req.params;
    const files = req.files;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded',
      });
    }

    const uploadedFilesData = await uploadDocumentsToCloudinary(files, {
      candidateId,
      folder: 'languages',
    });
    const uploadedFiles = uploadedFilesData.map((item) => item.url);

    res.json({
      success: true,
      message: 'Files uploaded successfully',
      files: uploadedFiles,
    });
  } catch (error) {
    console.error('Error uploading language documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload files',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Save languages
 * POST /api/profile/languages/:candidateId
 */
async function saveLanguages(req, res) {
  try {
    const { candidateId } = req.params;
    const { languages } = req.body;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    // Delete existing languages
    await prisma.candidateLanguage.deleteMany({
      where: { candidateId },
    });

    // Create new languages
    for (const langData of languages) {
      // Map proficiency
      const proficiencyMap = {
        'Beginner': 'BEGINNER',
        'Elementary': 'INTERMEDIATE',
        'Intermediate': 'INTERMEDIATE',
        'Advanced': 'ADVANCED',
        'Fluent / Native': 'NATIVE',
      };

      await prisma.candidateLanguage.create({
        data: {
          candidateId,
          name: langData.name,
          proficiency: proficiencyMap[langData.proficiency] || 'INTERMEDIATE',
          canSpeak: langData.speak || false,
          canRead: langData.read || false,
          canWrite: langData.write || false,
          documents: Array.isArray(langData.documents) 
            ? langData.documents.map(doc => typeof doc === 'string' ? doc : doc.url || doc.name).filter(Boolean)
            : [],
        },
      });
    }

    logProfileSave('Languages', 'saved', candidateId, {
      totalLanguages: languages.length,
      languageNames: languages.map((language) => language.name),
    });

    res.json({
      success: true,
      message: 'Languages saved successfully',
    });
  } catch (error) {
    console.error('Error saving languages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save languages',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Delete all languages
 * DELETE /api/profile/languages/:candidateId
 */
async function deleteLanguages(req, res) {
  try {
    const { candidateId } = req.params;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    // Delete all candidate languages
    await prisma.candidateLanguage.deleteMany({
      where: { candidateId },
    });

    logProfileSave('Languages', 'deleted', candidateId, {
      message: 'All languages deleted',
    });

    res.json({
      success: true,
      message: 'Languages deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting languages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete languages',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Update career preferences
 * PUT /api/profile/career-preferences/:candidateId
 */
async function updateCareerPreferences(req, res) {
  try {
    const { candidateId } = req.params;
    const preferences = req.body;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    const normalizeStringArray = (value) => (
      Array.isArray(value)
        ? value.map((item) => String(item || '').trim()).filter(Boolean)
        : []
    );

    const salaryTypeMap = {
      ANNUAL: 'ANNUAL',
      ANNUALLY: 'ANNUAL',
      Annual: 'ANNUAL',
      Annually: 'ANNUAL',
      MONTHLY: 'MONTHLY',
      Monthly: 'MONTHLY',
      HOURLY: 'HOURLY',
      Hourly: 'HOURLY',
      DAILY: 'DAILY',
      Daily: 'DAILY',
    };

    const workModeMap = {
      REMOTE: 'REMOTE',
      Remote: 'REMOTE',
      HYBRID: 'HYBRID',
      Hybrid: 'HYBRID',
      ON_SITE: 'ON_SITE',
      ONSITE: 'ON_SITE',
      'On-site': 'ON_SITE',
      'On Site': 'ON_SITE',
    };

    const parseNullableFloat = (value) => {
      if (value === undefined || value === null || value === '') return null;
      const parsed = parseFloat(String(value));
      return Number.isFinite(parsed) ? parsed : null;
    };

    const preferredRoles = normalizeStringArray(
      Array.isArray(preferences.preferredJobTitles) && preferences.preferredJobTitles.length > 0
        ? preferences.preferredJobTitles
        : preferences.preferredRoles,
    );
    const jobTypes = normalizeStringArray(preferences.jobTypes);
    const preferredLocations = normalizeStringArray(preferences.preferredLocations);
    const currentBenefits = normalizeStringArray(preferences.currentBenefits);
    const preferredBenefits = normalizeStringArray(preferences.preferredBenefits);

    const preferredIndustry = preferences.preferredIndustry
      || (Array.isArray(preferences.preferredIndustries) && preferences.preferredIndustries.length > 0
        ? preferences.preferredIndustries.join('; ')
        : null);
    const functionalArea = preferences.functionalArea
      || (Array.isArray(preferences.functionalAreas) && preferences.functionalAreas.length > 0
        ? preferences.functionalAreas.join('; ')
        : null);

    const selectedWorkModes = normalizeStringArray(
      Array.isArray(preferences.workModes) && preferences.workModes.length > 0
        ? preferences.workModes
        : preferences.preferredWorkMode
          ? [preferences.preferredWorkMode]
          : [],
    );
    const preferredWorkModeInput = selectedWorkModes[0] || null;
    const preferredWorkMode = preferredWorkModeInput
      ? workModeMap[String(preferredWorkModeInput).trim()] || null
      : null;
    const workModesForMeta = selectedWorkModes
      .map((mode) => String(mode || '').trim())
      .filter(Boolean)
      .map((mode) => (mode === 'On Site' ? 'On-site' : mode));

    const currentSalaryTypeInput = preferences.currentSalaryType;
    const currentSalaryType = currentSalaryTypeInput
      ? salaryTypeMap[String(currentSalaryTypeInput).trim()] || null
      : null;

    const preferredSalaryTypeInput = preferences.preferredSalaryType || preferences.salaryFrequency;
    const preferredSalaryType = preferredSalaryTypeInput
      ? salaryTypeMap[String(preferredSalaryTypeInput).trim()] || null
      : null;

    const currentSalary = parseNullableFloat(preferences.currentSalary);
    const preferredSalary = parseNullableFloat(
      preferences.preferredSalary !== undefined ? preferences.preferredSalary : preferences.salaryAmount,
    );
    const currentRole = typeof preferences.currentRole === 'string'
      ? preferences.currentRole.trim()
      : '';

    // Parse notice period days from string (e.g., "60 days" -> 60)
    let noticePeriodDays = null;
    if (preferences.noticePeriod) {
      const noticePeriodStr = preferences.noticePeriod.toString();
      const daysMatch = noticePeriodStr.match(/(\d+)/);
      if (daysMatch) {
        noticePeriodDays = parseInt(daysMatch[1]);
      } else if (noticePeriodStr.toLowerCase() === 'negotiable') {
        noticePeriodDays = null; // Keep as null for negotiable
      }
    }

    const existingCareerPreferences = await prisma.careerPreferences.findUnique({
      where: { candidateId },
      select: { passportNumbersByLocation: true },
    });
    const existingPassportMeta =
      existingCareerPreferences?.passportNumbersByLocation &&
      typeof existingCareerPreferences.passportNumbersByLocation === 'object'
        ? existingCareerPreferences.passportNumbersByLocation
        : {};
    const incomingPassportMap =
      preferences.passportNumbersByLocation && typeof preferences.passportNumbersByLocation === 'object'
        ? preferences.passportNumbersByLocation
        : {};
    const passportNumbersByLocation = {
      ...existingPassportMeta,
      ...incomingPassportMap,
      __workModes: workModesForMeta,
    };

    await prisma.careerPreferences.upsert({
      where: { candidateId },
      update: {
        // Role & Domain
        preferredRoles,
        preferredIndustry,
        functionalArea,

        // Current package
        currentCurrency: preferences.currentCurrency || 'USD',
        currentSalaryType: currentSalaryType || undefined,
        currentSalary,
        currentLocation: preferences.currentLocation || null,
        currentBenefits,
        
        // Job Type & Work Mode
        jobTypes,
        preferredWorkMode: preferredWorkMode || undefined,
        
        // Location
        preferredLocations,
        relocationPreference: preferences.relocationPreference || null,
        
        // Salary
        preferredSalary,
        preferredSalaryType: preferredSalaryType || undefined,
        preferredCurrency: preferences.preferredCurrency || preferences.salaryCurrency || 'USD',
        preferredBenefits,
        
        // Availability
        availabilityToStart: preferences.availabilityToStart || null,
        noticePeriod: preferences.noticePeriod || null,
        noticePeriodDays: noticePeriodDays,
        openToRelocation: preferences.relocationPreference === 'Open to Relocate' || preferences.relocationPreference === 'Open to Remote Only',
        
        // Passport numbers by location + internal work mode metadata
        passportNumbersByLocation,
      },
      create: {
        candidateId,
        // Role & Domain
        preferredRoles,
        preferredIndustry,
        functionalArea,

        // Current package
        currentCurrency: preferences.currentCurrency || 'USD',
        currentSalaryType: currentSalaryType || undefined,
        currentSalary,
        currentLocation: preferences.currentLocation || null,
        currentBenefits,
        
        // Job Type & Work Mode
        jobTypes,
        preferredWorkMode: preferredWorkMode || undefined,
        
        // Location
        preferredLocations,
        relocationPreference: preferences.relocationPreference || null,
        
        // Salary
        preferredSalary,
        preferredSalaryType: preferredSalaryType || undefined,
        preferredCurrency: preferences.preferredCurrency || preferences.salaryCurrency || 'USD',
        preferredBenefits,
        
        // Availability
        availabilityToStart: preferences.availabilityToStart || null,
        noticePeriod: preferences.noticePeriod || null,
        noticePeriodDays: noticePeriodDays,
        openToRelocation: preferences.relocationPreference === 'Open to Relocate' || preferences.relocationPreference === 'Open to Remote Only',
        
        // Passport numbers by location + internal work mode metadata
        passportNumbersByLocation,
      },
    });

    // Prepare detailed log data
    const logData = {
      // Role & Domain
      preferredRoles,
      preferredRolesCount: preferredRoles.length,
      preferredIndustry,
      functionalArea,

      currentCurrency: preferences.currentCurrency || 'USD',
      currentRole: currentRole || null,
      currentSalaryType: currentSalaryType || null,
      currentSalary,
      currentLocation: preferences.currentLocation || null,
      currentBenefits,
      
      // Job Type & Work Mode
      jobTypes,
      jobTypesCount: jobTypes.length,
      preferredWorkMode: preferredWorkMode || null,
      workModes: workModesForMeta,
      
      // Location
      preferredLocations,
      preferredLocationsCount: preferredLocations.length,
      relocationPreference: preferences.relocationPreference || null,
      
      // Salary
      preferredSalary,
      preferredSalaryType: preferredSalaryType || null,
      preferredCurrency: preferences.preferredCurrency || preferences.salaryCurrency || 'USD',
      preferredBenefits,
      
      // Availability
      availabilityToStart: preferences.availabilityToStart || null,
      noticePeriod: preferences.noticePeriod || null,
      noticePeriodDays: noticePeriodDays,
      openToRelocation: preferences.relocationPreference === 'Open to Relocate' || preferences.relocationPreference === 'Open to Remote Only',
    };

    logProfileSave('Career Preferences', 'upserted', candidateId, logData);

    // Mirror the candidate-facing values onto the Candidate row itself so that
    // recruiter-side views (frontphase2 candidate drawer) can read them directly
    // without joining career_preferences. We only update fields that exist on
    // the Candidate model; salary fields are stored as Float.
    try {
      const firstPreferredLocation = preferredLocations.length
        ? String(preferredLocations[0]).trim() || null
        : null;

      await prisma.candidate.update({
        where: { id: candidateId },
        data: {
          noticePeriod: preferences.noticePeriod || null,
          availability: preferences.availabilityToStart || null,
          expectedSalary: preferredSalary,
          currentSalary,
          preferredLocation: firstPreferredLocation,
          location: preferences.currentLocation || null,
          currentTitle: currentRole || null,
          designation: currentRole || null,
        },
      });
    } catch (mirrorErr) {
      // Do not fail the request if mirror update fails (e.g. candidate row missing fields).
      console.warn('[profile] failed to mirror career preferences to candidate row:', mirrorErr?.message || mirrorErr);
    }

    res.json({
      success: true,
      message: 'Career preferences updated successfully',
    });
  } catch (error) {
    console.error('Error updating career preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update career preferences',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function saveSummary(req, res) {
  try {
    const { candidateId } = req.params;
    const { summaryText } = req.body;

    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'Candidate ID is required' });
    }

    await prisma.candidateSummary.upsert({
      where: { candidateId },
      update: { summaryText: summaryText || '' },
      create: { candidateId, summaryText: summaryText || '' },
    });

    logProfileSave('Summary', 'upserted', candidateId, { summaryText: summaryText || '' });
    res.json({ success: true, message: 'Summary saved successfully' });
  } catch (error) {
    console.error('Error saving summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Generate professional summary using AI
 * POST /api/profile/generate-summary/:candidateId
 */
async function generateSummaryWithAI(req, res) {
  try {
    const { candidateId } = req.params;

    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'Candidate ID is required' });
    }

    // Fetch candidate profile data to generate summary from
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        profile: true,
        workExperiences: {
          orderBy: { startDate: 'desc' },
          take: 5,
        },
        educations: {
          orderBy: { startYear: 'desc' },
          take: 3,
        },
        skills: {
          include: {
            skill: true,
          },
          take: 10,
        },
        languages: {
          take: 5,
        },
        project: true,
      },
    });

    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    // Build profile context for AI
    const profileContext = {
      name: candidate.profile?.fullName || '',
      email: candidate.profile?.email || '',
      workExperiences: candidate.workExperiences?.map(exp => ({
        jobTitle: exp.jobTitle || '',
        company: exp.companyName || '',
        duration: exp.startDate && exp.endDate ? `${exp.startDate} to ${exp.endDate}` : '',
        responsibilities: exp.keyResponsibilities || '',
      })) || [],
      educations: candidate.educations?.map(edu => ({
        degree: edu.degreeProgram || '',
        institution: edu.institutionName || '',
        specialization: edu.specialization || '',
        year: edu.endYear || '',
      })) || [],
      skills: candidate.skills?.map(s => s.skill?.name || s.skillName || '').filter(Boolean) || [],
      languages: candidate.languages?.map(lang => lang.name || '').filter(Boolean) || [],
      projects: (() => {
        try {
          if (!candidate.project) return [];
          
          // Handle both JSON string and array formats
          let projectsArray = [];
          if (typeof candidate.project.projects === 'string') {
            projectsArray = JSON.parse(candidate.project.projects || '[]');
          } else if (Array.isArray(candidate.project.projects)) {
            projectsArray = candidate.project.projects;
          }
          
          return projectsArray.slice(0, 3).map(p => ({
            title: p.title || '',
            description: p.description || '',
          }));
        } catch (e) {
          console.error('Error parsing projects:', e);
          return [];
        }
      })(),
    };

    const OpenAI = require('openai');
    const { OPENAI_CHAT_MODEL } = require('../config/openaiModel');
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'OPENAI_API_KEY is required for AI summary generation',
      });
    }

    try {
      const prompt = `Generate a professional summary for a candidate based on the following profile information. The summary should be compelling, concise (maximum 500 characters), and highlight their experience, skills, and career achievements.

Profile Information:
- Name: ${profileContext.name || 'Candidate'}
- Work Experience: ${JSON.stringify(profileContext.workExperiences)}
- Education: ${JSON.stringify(profileContext.educations)}
- Skills: ${profileContext.skills.join(', ') || 'Not specified'}
- Languages: ${profileContext.languages.join(', ') || 'Not specified'}
- Projects: ${JSON.stringify(profileContext.projects)}

Requirements:
1. Write in first person (use "I", "my", "me")
2. Keep it professional and engaging
3. Highlight key achievements and experience
4. Mention relevant skills
5. Maximum 500 characters
6. Do not include markdown formatting
7. Return only the summary text, nothing else

Generate the professional summary:`;
      
      let generatedSummary = '';

      const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: OPENAI_CHAT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.7,
      });
      generatedSummary = completion?.choices?.[0]?.message?.content?.trim() || '';

      if (!generatedSummary) {
        throw new Error('AI returned empty response');
      }
      
      console.log('✅ Summary generated successfully');

      // Remove any markdown formatting if present
      const cleanSummary = generatedSummary
        .replace(/```/g, '')
        .replace(/markdown/g, '')
        .replace(/^\*\*/g, '')
        .replace(/\*\*$/g, '')
        .replace(/^["']|["']$/g, '') // Remove surrounding quotes
        .trim();

      res.json({
        success: true,
        data: {
          summary: cleanSummary,
        },
      });
    } catch (aiError) {
      console.error('Error in AI generation:', aiError);
      throw aiError;
    }
  } catch (error) {
    console.error('Error generating summary with AI:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      candidateId: req.params.candidateId,
    });
    
    // Provide more specific error messages
    let errorMessage = 'Failed to generate summary with AI';
    if (error.message && error.message.includes('API key')) {
      errorMessage = 'AI service configuration error. Please contact support.';
    } else if (error.message && (error.message.includes('quota') || error.message.includes('rate limit'))) {
      errorMessage = 'AI service is temporarily unavailable. Please try again later.';
    } else if (error.message && error.message.includes('model')) {
      errorMessage = 'AI model error. Please try again.';
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function saveGapExplanation(req, res) {
  try {
    const { candidateId } = req.params;
    const data = req.body;

    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'Candidate ID is required' });
    }

    const existingGap = await prisma.candidateGapExplanation.findUnique({
      where: { candidateId },
    });

    const existingEntries = extractGapEntries(existingGap);
    const requestedId = typeof data.id === 'string' && data.id.trim() ? data.id.trim() : null;
    const incomingEntry = buildGapEntryFromPayload(data, requestedId || randomUUID());

    let updatedEntries;
    if (requestedId) {
      const existingIndex = existingEntries.findIndex((entry) => entry.id === requestedId);
      if (existingIndex >= 0) {
        updatedEntries = existingEntries.map((entry, index) =>
          index === existingIndex ? incomingEntry : entry
        );
      } else {
        updatedEntries = [...existingEntries, incomingEntry];
      }
    } else {
      updatedEntries = [...existingEntries, incomingEntry];
    }

    const latestEntry = updatedEntries[updatedEntries.length - 1];
    const preferredSupportToStore = {
      ...normalizePreferredSupport(latestEntry.preferredSupport),
      entries: sanitizeJsonValue(updatedEntries),
    };

    await prisma.candidateGapExplanation.upsert({
      where: { candidateId },
      update: {
        gapCategory: latestEntry.gapCategory,
        reasonForGap: latestEntry.reasonForGap,
        gapDuration: latestEntry.gapDuration,
        selectedSkills: latestEntry.selectedSkills,
        coursesText: latestEntry.coursesText || null,
        preferredSupport: sanitizeJsonValue(preferredSupportToStore),
      },
      create: {
        candidateId,
        gapCategory: latestEntry.gapCategory,
        reasonForGap: latestEntry.reasonForGap,
        gapDuration: latestEntry.gapDuration,
        selectedSkills: latestEntry.selectedSkills,
        coursesText: latestEntry.coursesText || null,
        preferredSupport: sanitizeJsonValue(preferredSupportToStore),
      },
    });

    // Prepare detailed log data
    const logData = {
      id: latestEntry.id,
      gapCategory: latestEntry.gapCategory,
      reasonForGap: latestEntry.reasonForGap,
      gapDuration: latestEntry.gapDuration,
      selectedSkills: latestEntry.selectedSkills,
      selectedSkillsCount: latestEntry.selectedSkills.length,
      coursesText: latestEntry.coursesText
        ? (latestEntry.coursesText.length > 100
            ? `${latestEntry.coursesText.substring(0, 100)}...`
            : latestEntry.coursesText)
        : null,
      preferredSupport: normalizePreferredSupport(latestEntry.preferredSupport),
      totalGapEntries: updatedEntries.length,
    };

    logProfileSave('Gap Explanation', requestedId ? 'updated' : 'added', candidateId, logData);
    res.json({
      success: true,
      message: requestedId ? 'Gap explanation updated successfully' : 'Gap explanation added successfully',
      data: {
        gapExplanation: latestEntry,
        gapExplanations: updatedEntries,
      },
    });
  } catch (error) {
    console.error('Error saving gap explanation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save gap explanation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Delete gap explanation
 * DELETE /api/profile/gap-explanation/:candidateId
 */
async function deleteGapExplanation(req, res) {
  try {
    const { candidateId } = req.params;
    const entryId = typeof req.query.entryId === 'string' ? req.query.entryId.trim() : '';

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    // Check if gap explanation exists
    const existingGap = await prisma.candidateGapExplanation.findUnique({
      where: { candidateId },
    });

    if (!existingGap) {
      return res.status(404).json({
        success: false,
        message: 'Gap explanation not found',
      });
    }

    const existingEntries = extractGapEntries(existingGap);

    if (entryId) {
      if (existingEntries.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Gap explanation entry not found',
        });
      }

      const remainingEntries = existingEntries.filter((entry) => entry.id !== entryId);
      if (remainingEntries.length === existingEntries.length) {
        return res.status(404).json({
          success: false,
          message: 'Gap explanation entry not found',
        });
      }

      if (remainingEntries.length === 0) {
        await prisma.candidateGapExplanation.delete({
          where: { candidateId },
        });
      } else {
        const latestEntry = remainingEntries[remainingEntries.length - 1];
        const preferredSupportToStore = {
          ...normalizePreferredSupport(latestEntry.preferredSupport),
          entries: sanitizeJsonValue(remainingEntries),
        };

        await prisma.candidateGapExplanation.update({
          where: { candidateId },
          data: {
            gapCategory: latestEntry.gapCategory,
            reasonForGap: latestEntry.reasonForGap,
            gapDuration: latestEntry.gapDuration,
            selectedSkills: latestEntry.selectedSkills,
            coursesText: latestEntry.coursesText || null,
            preferredSupport: sanitizeJsonValue(preferredSupportToStore),
          },
        });
      }

      logProfileSave('Gap Explanation', 'entry deleted', candidateId, {
        entryId,
        remainingEntries: Math.max(existingEntries.length - 1, 0),
      });

      return res.json({
        success: true,
        message: 'Gap explanation deleted successfully',
      });
    }

    await prisma.candidateGapExplanation.delete({
      where: { candidateId },
    });

    logProfileSave('Gap Explanation', 'deleted', candidateId, {
      gapCategory: existingGap.gapCategory || '',
      gapDuration: existingGap.gapDuration || '',
    });

    res.json({
      success: true,
      message: 'Gap explanation deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting gap explanation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete gap explanation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function saveInternship(req, res) {
  try {
    const { candidateId } = req.params;
    const data = req.body;

    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'Candidate ID is required' });
    }

    const existingInternship = await prisma.candidateInternship.findUnique({
      where: { candidateId },
    });

    const existingEntries = extractInternshipEntries(existingInternship);
    const requestedId = typeof data.id === 'string' && data.id.trim() ? data.id.trim() : null;
    const incomingEntry = buildInternshipEntryFromPayload(data, requestedId || randomUUID());

    let updatedEntries;
    if (requestedId) {
      const existingIndex = existingEntries.findIndex((entry) => entry.id === requestedId);
      if (existingIndex >= 0) {
        updatedEntries = existingEntries.map((entry, index) =>
          index === existingIndex ? incomingEntry : entry
        );
      } else {
        updatedEntries = [...existingEntries, incomingEntry];
      }
    } else {
      updatedEntries = [...existingEntries, incomingEntry];
    }

    const latestEntry = updatedEntries[updatedEntries.length - 1];
    const documentsToStore = buildInternshipDocumentsForStorage(latestEntry.documents, updatedEntries);

    await prisma.candidateInternship.upsert({
      where: { candidateId },
      update: {
        internshipTitle: latestEntry.internshipTitle || '',
        companyName: latestEntry.companyName || '',
        internshipType: latestEntry.internshipType || null,
        domainDepartment: latestEntry.domainDepartment || null,
        startDate: latestEntry.startDate ? new Date(latestEntry.startDate) : null,
        endDate: latestEntry.endDate ? new Date(latestEntry.endDate) : null,
        currentlyWorking: latestEntry.currentlyWorking || false,
        location: latestEntry.location || null,
        workMode: latestEntry.workMode || null,
        responsibilities: latestEntry.responsibilities || null,
        learnings: latestEntry.learnings || null,
        skills: Array.isArray(latestEntry.skills) ? latestEntry.skills : [],
        documents: documentsToStore,
      },
      create: {
        candidateId,
        internshipTitle: latestEntry.internshipTitle || '',
        companyName: latestEntry.companyName || '',
        internshipType: latestEntry.internshipType || null,
        domainDepartment: latestEntry.domainDepartment || null,
        startDate: latestEntry.startDate ? new Date(latestEntry.startDate) : null,
        endDate: latestEntry.endDate ? new Date(latestEntry.endDate) : null,
        currentlyWorking: latestEntry.currentlyWorking || false,
        location: latestEntry.location || null,
        workMode: latestEntry.workMode || null,
        responsibilities: latestEntry.responsibilities || null,
        learnings: latestEntry.learnings || null,
        skills: Array.isArray(latestEntry.skills) ? latestEntry.skills : [],
        documents: documentsToStore,
      },
    });

    // Prepare detailed log data
    const logData = {
      id: latestEntry.id,
      internshipTitle: latestEntry.internshipTitle || '',
      companyName: latestEntry.companyName || '',
      internshipType: latestEntry.internshipType || null,
      domainDepartment: latestEntry.domainDepartment || null,
      startDate: latestEntry.startDate || null,
      endDate: latestEntry.endDate || null,
      currentlyWorking: latestEntry.currentlyWorking || false,
      location: latestEntry.location || null,
      workMode: latestEntry.workMode || null,
      responsibilities: latestEntry.responsibilities ? (latestEntry.responsibilities.length > 100 ? latestEntry.responsibilities.substring(0, 100) + '...' : latestEntry.responsibilities) : null,
      learnings: latestEntry.learnings ? (latestEntry.learnings.length > 100 ? latestEntry.learnings.substring(0, 100) + '...' : latestEntry.learnings) : null,
      skills: Array.isArray(latestEntry.skills) ? latestEntry.skills : [],
      skillsCount: Array.isArray(latestEntry.skills) ? latestEntry.skills.length : 0,
      documents: Array.isArray(latestEntry.documents) ? latestEntry.documents : [],
      documentsCount: Array.isArray(latestEntry.documents) ? latestEntry.documents.length : 0,
      totalInternshipEntries: updatedEntries.length,
    };

    logProfileSave('Internship', requestedId ? 'updated' : 'added', candidateId, logData);
    res.json({
      success: true,
      message: requestedId ? 'Internship updated successfully' : 'Internship added successfully',
      data: {
        internship: latestEntry,
        internships: updatedEntries,
      },
    });
  } catch (error) {
    console.error('Error saving internship:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save internship',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Delete internship
 * DELETE /api/profile/internship/:candidateId
 */
async function deleteInternship(req, res) {
  try {
    const { candidateId } = req.params;
    const entryId = typeof req.query.entryId === 'string' ? req.query.entryId.trim() : '';

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    // Check if internship exists
    const existingInternship = await prisma.candidateInternship.findUnique({
      where: { candidateId },
    });

    if (!existingInternship) {
      return res.status(404).json({
        success: false,
        message: 'Internship not found',
      });
    }

    const existingEntries = extractInternshipEntries(existingInternship);

    if (entryId) {
      if (existingEntries.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Internship entry not found',
        });
      }

      const remainingEntries = existingEntries.filter((entry) => entry.id !== entryId);
      if (remainingEntries.length === existingEntries.length) {
        return res.status(404).json({
          success: false,
          message: 'Internship entry not found',
        });
      }

      if (remainingEntries.length === 0) {
        await prisma.candidateInternship.delete({
          where: { candidateId },
        });
      } else {
        const latestEntry = remainingEntries[remainingEntries.length - 1];
        const documentsToStore = buildInternshipDocumentsForStorage(latestEntry.documents, remainingEntries);

        await prisma.candidateInternship.update({
          where: { candidateId },
          data: {
            internshipTitle: latestEntry.internshipTitle || '',
            companyName: latestEntry.companyName || '',
            internshipType: latestEntry.internshipType || null,
            domainDepartment: latestEntry.domainDepartment || null,
            startDate: latestEntry.startDate ? new Date(latestEntry.startDate) : null,
            endDate: latestEntry.endDate ? new Date(latestEntry.endDate) : null,
            currentlyWorking: latestEntry.currentlyWorking || false,
            location: latestEntry.location || null,
            workMode: latestEntry.workMode || null,
            responsibilities: latestEntry.responsibilities || null,
            learnings: latestEntry.learnings || null,
            skills: Array.isArray(latestEntry.skills) ? latestEntry.skills : [],
            documents: documentsToStore,
          },
        });
      }

      logProfileSave('Internship', 'entry deleted', candidateId, {
        entryId,
        remainingEntries: Math.max(existingEntries.length - 1, 0),
      });

      return res.json({
        success: true,
        message: 'Internship deleted successfully',
      });
    }

    await prisma.candidateInternship.delete({
      where: { candidateId },
    });

    logProfileSave('Internship', 'deleted', candidateId, {
      internshipTitle: existingInternship.internshipTitle || '',
      companyName: existingInternship.companyName || '',
    });

    res.json({
      success: true,
      message: 'Internship deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting internship:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete internship',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function savePortfolioLinks(req, res) {
  try {
    const { candidateId } = req.params;
    const portfolioLinksData = req.body;
    const links = portfolioLinksData?.links || [];

    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'Candidate ID is required' });
    }

    // Ensure links is an array
    const linksArray = filterPortfolioLinks(Array.isArray(links) ? links : []);

    await prisma.candidatePortfolioLinks.upsert({
      where: { candidateId },
      update: {
        links: sanitizeJsonValue(linksArray),
      },
      create: {
        candidateId,
        links: sanitizeJsonValue(linksArray),
      },
    });

    // Prepare detailed log data
    const logData = {
      totalLinks: linksArray.length,
      links: linksArray.map((link) => ({
        linkType: link.linkType || '',
        url: link.url || '',
        title: link.title || null,
        description: link.description ? (link.description.length > 100 ? link.description.substring(0, 100) + '...' : link.description) : null,
      })),
    };

    logProfileSave('Portfolio Links', 'upserted', candidateId, logData);
    res.json({ success: true, message: 'Portfolio links saved successfully' });
  } catch (error) {
    console.error('Error saving portfolio links:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save portfolio links',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Inspect resume file and compare extracted candidate name with profile name
 * POST /api/profile/resume/inspect/:candidateId
 */
async function inspectResumeFile(req, res) {
  try {
    const { candidateId } = req.params;
    const file = req.file;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'Resume file is required',
      });
    }

    const { parseResumeFromBuffer } = require('../services/resume-parser.service');

    const [profile, parsedData] = await Promise.all([
      prisma.candidateProfile.findUnique({
        where: { candidateId },
        select: { fullName: true },
      }),
      parseResumeFromBuffer(file.buffer, file.mimetype, file.originalname),
    ]);

    const profileCandidateName = String(profile?.fullName || '').trim();
    const resumeCandidateName = String(parsedData?.personalInformation?.fullName || '').trim();
    const namesMatch = candidateNamesLikelyMatch(resumeCandidateName, profileCandidateName);

    return res.json({
      success: true,
      message: 'Resume inspected successfully',
      data: {
        profileCandidateName,
        resumeCandidateName,
        namesMatch,
        personalInformation: parsedData?.personalInformation || null,
      },
    });
  } catch (error) {
    console.error('Error inspecting resume:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to inspect resume',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Upload resume file
 * POST /api/profile/resume/upload/:candidateId
 */
async function uploadResumeFile(req, res) {
  try {
    console.log('🔄 Redirecting resume upload to full AI extraction pipeline...');
    const { uploadCV } = require('./cv.controller');
    return await uploadCV(req, res);
  } catch (error) {
    console.error('Error uploading resume:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload resume via extraction pipeline',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Save resume (metadata only, file should be uploaded separately)
 * POST /api/profile/resume/:candidateId
 */
async function saveResume(req, res) {
  try {
    const { candidateId } = req.params;
    const data = req.body;

    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'Candidate ID is required' });
    }

    // If fileUrl is provided, update the resume record
    if (data.fileUrl) {
      await prisma.resume.upsert({
        where: { candidateId },
        update: {
          fileName: data.fileName || undefined,
          fileUrl: data.fileUrl,
          fileSize: data.fileSize || undefined,
          mimeType: data.mimeType || undefined,
          uploadedAt: data.uploadedDate ? new Date(data.uploadedDate) : new Date(),
        },
        create: {
          candidateId,
          fileName: data.fileName || 'resume.pdf',
          fileUrl: data.fileUrl,
          fileSize: data.fileSize || null,
          mimeType: data.mimeType || null,
          uploadedAt: data.uploadedDate ? new Date(data.uploadedDate) : new Date(),
        },
      });
    } else {
      // If no fileUrl, just return success (file should be uploaded via uploadResumeFile)
      return res.json({ success: true, message: 'Resume metadata saved successfully' });
    }

    // Prepare detailed log data
    const logData = {
      fileName: data.fileName || '',
      fileUrl: data.fileUrl || '',
      uploadedAt: data.uploadedDate ? new Date(data.uploadedDate).toISOString() : new Date().toISOString(),
    };

    logProfileSave('Resume', 'upserted', candidateId, logData);
    res.json({ success: true, message: 'Resume saved successfully' });
  } catch (error) {
    console.error('Error saving resume:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save resume',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Save project
 * POST /api/profile/project/:candidateId
 */
async function saveProject(req, res) {
  try {
    const { candidateId } = req.params;
    const project = req.body;

    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'Candidate ID is required' });
    }

    const existingProject = await prisma.candidateProject.findUnique({
      where: { candidateId },
    });

    const existingEntries = extractProjectEntries(existingProject);
    const requestedId = typeof project.id === 'string' && project.id.trim() ? project.id.trim() : null;
    const incomingEntry = buildProjectEntryFromPayload(project, requestedId || randomUUID());

    let updatedEntries;
    if (requestedId) {
      const existingIndex = existingEntries.findIndex((entry) => entry.id === requestedId);
      if (existingIndex >= 0) {
        updatedEntries = existingEntries.map((entry, index) =>
          index === existingIndex ? incomingEntry : entry
        );
      } else {
        updatedEntries = [...existingEntries, incomingEntry];
      }
    } else {
      updatedEntries = [...existingEntries, incomingEntry];
    }

    const latestEntry = updatedEntries[updatedEntries.length - 1];
    const documentsToStore = buildProjectDocumentsForStorage(
      latestEntry.documents,
      updatedEntries
    );

    await prisma.candidateProject.upsert({
      where: { candidateId },
      update: {
        projectTitle: latestEntry.projectTitle || '',
        projectType: latestEntry.projectType || '',
        organizationClient: latestEntry.organizationClient || null,
        currentlyWorking: latestEntry.currentlyWorking || false,
        startDate: latestEntry.startDate ? new Date(latestEntry.startDate) : null,
        endDate: latestEntry.endDate ? new Date(latestEntry.endDate) : null,
        projectDescription: latestEntry.projectDescription || null,
        responsibilities: latestEntry.responsibilities || null,
        technologies: Array.isArray(latestEntry.technologies) ? latestEntry.technologies : [],
        projectOutcome: latestEntry.projectOutcome || null,
        projectLink: latestEntry.projectLink || null,
        documents: documentsToStore,
      },
      create: {
        candidateId,
        projectTitle: latestEntry.projectTitle || '',
        projectType: latestEntry.projectType || '',
        organizationClient: latestEntry.organizationClient || null,
        currentlyWorking: latestEntry.currentlyWorking || false,
        startDate: latestEntry.startDate ? new Date(latestEntry.startDate) : null,
        endDate: latestEntry.endDate ? new Date(latestEntry.endDate) : null,
        projectDescription: latestEntry.projectDescription || null,
        responsibilities: latestEntry.responsibilities || null,
        technologies: Array.isArray(latestEntry.technologies) ? latestEntry.technologies : [],
        projectOutcome: latestEntry.projectOutcome || null,
        projectLink: latestEntry.projectLink || null,
        documents: documentsToStore,
      },
    });

    // Prepare detailed log data
    const technologiesArray = Array.isArray(latestEntry.technologies) ? latestEntry.technologies : [];
    const logData = {
      id: latestEntry.id,
      projectTitle: latestEntry.projectTitle || '',
      projectType: latestEntry.projectType || '',
      organizationClient: latestEntry.organizationClient || null,
      currentlyWorking: latestEntry.currentlyWorking || false,
      startDate: latestEntry.startDate || null,
      endDate: latestEntry.endDate || null,
      projectDescription: latestEntry.projectDescription ? (latestEntry.projectDescription.length > 100 ? latestEntry.projectDescription.substring(0, 100) + '...' : latestEntry.projectDescription) : null,
      responsibilities: latestEntry.responsibilities ? (latestEntry.responsibilities.length > 100 ? latestEntry.responsibilities.substring(0, 100) + '...' : latestEntry.responsibilities) : null,
      technologies: technologiesArray,
      technologiesCount: technologiesArray.length,
      projectOutcome: latestEntry.projectOutcome ? (latestEntry.projectOutcome.length > 100 ? latestEntry.projectOutcome.substring(0, 100) + '...' : latestEntry.projectOutcome) : null,
      projectLink: latestEntry.projectLink || null,
      documentsCount: Array.isArray(latestEntry.documents) ? latestEntry.documents.length : 0,
      totalProjectEntries: updatedEntries.length,
    };
    
    // Log technologies separately for debugging
    console.log('📦 Technologies received:', JSON.stringify(technologiesArray, null, 2));

    logProfileSave('Project', requestedId ? 'updated' : 'added', candidateId, logData);

    res.json({
      success: true,
      message: requestedId ? 'Project updated successfully' : 'Project added successfully',
      data: {
        project: latestEntry,
        projects: updatedEntries,
      },
    });
  } catch (error) {
    console.error('Error saving project:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save project',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Upload project documents
 * POST /api/profile/project/documents/:candidateId
 */
async function uploadProjectDocuments(req, res) {
  try {
    const { candidateId } = req.params;
    const files = req.files;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded',
      });
    }

    const uploadedFilesData = await uploadDocumentsToCloudinary(files, {
      candidateId,
      folder: 'project',
    });
    const uploadedFiles = uploadedFilesData.map((item) => item.url);

    res.json({
      success: true,
      message: 'Files uploaded successfully',
      files: uploadedFiles,
    });
  } catch (error) {
    console.error('Error uploading project documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload files',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Save academic achievement
 * POST /api/profile/academic-achievement/:candidateId
 */
async function saveAcademicAchievement(req, res) {
  try {
    const { candidateId } = req.params;
    const achievement = req.body;

    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'Candidate ID is required' });
    }

    const existingAchievement = await prisma.candidateAcademicAchievement.findUnique({
      where: { candidateId },
    });

    const existingEntries = extractAcademicAchievementEntries(existingAchievement);
    const requestedId = typeof achievement.id === 'string' && achievement.id.trim() ? achievement.id.trim() : null;
    const incomingEntry = buildAcademicAchievementEntryFromPayload(
      achievement,
      requestedId || randomUUID()
    );

    let updatedEntries;
    if (requestedId) {
      const existingIndex = existingEntries.findIndex((entry) => entry.id === requestedId);
      if (existingIndex >= 0) {
        updatedEntries = existingEntries.map((entry, index) =>
          index === existingIndex ? incomingEntry : entry
        );
      } else {
        updatedEntries = [...existingEntries, incomingEntry];
      }
    } else {
      updatedEntries = [...existingEntries, incomingEntry];
    }

    const latestEntry = updatedEntries[updatedEntries.length - 1];
    const documentsToStore = buildAcademicAchievementDocumentsForStorage(
      latestEntry.documents,
      updatedEntries
    );

    await prisma.candidateAcademicAchievement.upsert({
      where: { candidateId },
      update: {
        achievementTitle: latestEntry.achievementTitle || '',
        awardedBy: latestEntry.awardedBy || '',
        yearReceived: latestEntry.yearReceived || '',
        categoryType: latestEntry.categoryType || null,
        description: latestEntry.description || null,
        documents: documentsToStore,
      },
      create: {
        candidateId,
        achievementTitle: latestEntry.achievementTitle || '',
        awardedBy: latestEntry.awardedBy || '',
        yearReceived: latestEntry.yearReceived || '',
        categoryType: latestEntry.categoryType || null,
        description: latestEntry.description || null,
        documents: documentsToStore,
      },
    });

    // Prepare detailed log data
    const logData = {
      id: latestEntry.id,
      achievementTitle: latestEntry.achievementTitle || '',
      awardedBy: latestEntry.awardedBy || '',
      yearReceived: latestEntry.yearReceived || '',
      categoryType: latestEntry.categoryType || null,
      description: latestEntry.description
        ? (latestEntry.description.length > 100
            ? `${latestEntry.description.substring(0, 100)}...`
            : latestEntry.description)
        : null,
      documentsCount: Array.isArray(latestEntry.documents) ? latestEntry.documents.length : 0,
      totalAcademicAchievementEntries: updatedEntries.length,
    };

    logProfileSave('Academic Achievement', requestedId ? 'updated' : 'added', candidateId, logData);

    res.json({
      success: true,
      message: requestedId ? 'Academic achievement updated successfully' : 'Academic achievement added successfully',
      data: {
        academicAchievement: latestEntry,
        academicAchievements: updatedEntries,
      },
    });
  } catch (error) {
    console.error('Error saving academic achievement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save academic achievement',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Upload competitive exam documents
 * POST /api/profile/competitive-exam/documents/:candidateId
 */
async function uploadCompetitiveExamDocuments(req, res) {
  try {
    const { candidateId } = req.params;
    const files = req.files;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded',
      });
    }

    const uploadedFilesData = await uploadDocumentsToCloudinary(files, {
      candidateId,
      folder: 'competitive-exam',
    });
    const uploadedFiles = uploadedFilesData.map((item) => item.url);

    res.json({
      success: true,
      message: 'Files uploaded successfully',
      files: uploadedFiles,
    });
  } catch (error) {
    console.error('Error uploading competitive exam documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload files',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Upload accomplishment documents
 * POST /api/profile/accomplishment/documents/:candidateId
 */
async function uploadAccomplishmentDocuments(req, res) {
  try {
    const { candidateId } = req.params;
    const files = req.files;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded',
      });
    }

    const uploadedFiles = await uploadDocumentsToCloudinary(files, {
      candidateId,
      folder: 'accomplishment',
    });

    console.log(`📎 Uploaded ${uploadedFiles.length} accomplishment document(s) for candidate: ${candidateId}`);

    res.json({
      success: true,
      message: 'Documents uploaded successfully',
      data: {
        documents: uploadedFiles,
      },
    });
  } catch (error) {
    console.error('Error uploading accomplishment documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload documents',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Upload certification documents
 * POST /api/profile/certification/documents/:candidateId
 */
async function uploadCertificationDocuments(req, res) {
  try {
    const { candidateId } = req.params;
    const files = req.files;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded',
      });
    }

    const uploadedFiles = await uploadDocumentsToCloudinary(files, {
      candidateId,
      folder: 'certification',
    });

    console.log(`📎 Uploaded ${uploadedFiles.length} certification document(s) for candidate: ${candidateId}`);

    res.json({
      success: true,
      message: 'Documents uploaded successfully',
      data: {
        documents: uploadedFiles,
      },
    });
  } catch (error) {
    console.error('Error uploading certification documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload documents',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Save competitive exam
 * POST /api/profile/competitive-exam/:candidateId
 */
async function saveCompetitiveExam(req, res) {
  try {
    const { candidateId } = req.params;
    const exam = req.body;

    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'Candidate ID is required' });
    }

    const existingCompetitiveExam = await prisma.candidateCompetitiveExam.findUnique({
      where: { candidateId },
    });

    const existingEntries = extractCompetitiveExamEntries(existingCompetitiveExam);
    const requestedId = typeof exam.id === 'string' && exam.id.trim() ? exam.id.trim() : null;
    const incomingEntry = buildCompetitiveExamEntryFromPayload(
      exam,
      requestedId || randomUUID()
    );

    let updatedEntries;
    if (requestedId) {
      const existingIndex = existingEntries.findIndex((entry) => entry.id === requestedId);
      if (existingIndex >= 0) {
        updatedEntries = existingEntries.map((entry, index) =>
          index === existingIndex ? incomingEntry : entry
        );
      } else {
        updatedEntries = [...existingEntries, incomingEntry];
      }
    } else {
      updatedEntries = [...existingEntries, incomingEntry];
    }

    const latestEntry = updatedEntries[updatedEntries.length - 1];
    const documentsToStore = buildCompetitiveExamDocumentsForStorage(
      latestEntry.documents,
      updatedEntries
    );

    await prisma.candidateCompetitiveExam.upsert({
      where: { candidateId },
      update: {
        examName: latestEntry.examName || '',
        yearTaken: latestEntry.yearTaken || '',
        resultStatus: latestEntry.resultStatus || '',
        scoreMarks: latestEntry.scoreMarks || null,
        scoreType: latestEntry.scoreType || null,
        validUntil: latestEntry.validUntil || null,
        additionalNotes: latestEntry.additionalNotes || null,
        documents: documentsToStore,
      },
      create: {
        candidateId,
        examName: latestEntry.examName || '',
        yearTaken: latestEntry.yearTaken || '',
        resultStatus: latestEntry.resultStatus || '',
        scoreMarks: latestEntry.scoreMarks || null,
        scoreType: latestEntry.scoreType || null,
        validUntil: latestEntry.validUntil || null,
        additionalNotes: latestEntry.additionalNotes || null,
        documents: documentsToStore,
      },
    });

    // Prepare detailed log data
    const logData = {
      id: latestEntry.id,
      examName: latestEntry.examName || '',
      yearTaken: latestEntry.yearTaken || '',
      resultStatus: latestEntry.resultStatus || '',
      scoreMarks: latestEntry.scoreMarks || null,
      scoreType: latestEntry.scoreType || null,
      validUntil: latestEntry.validUntil || null,
      additionalNotes: latestEntry.additionalNotes
        ? (latestEntry.additionalNotes.length > 100
            ? `${latestEntry.additionalNotes.substring(0, 100)}...`
            : latestEntry.additionalNotes)
        : null,
      documentsCount: Array.isArray(latestEntry.documents) ? latestEntry.documents.length : 0,
      totalCompetitiveExamEntries: updatedEntries.length,
    };

    logProfileSave('Competitive Exam', requestedId ? 'updated' : 'added', candidateId, logData);

    res.json({
      success: true,
      message: requestedId ? 'Competitive exam updated successfully' : 'Competitive exam added successfully',
      data: {
        competitiveExam: latestEntry,
        competitiveExams: updatedEntries,
      },
    });
  } catch (error) {
    console.error('Error saving competitive exam:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save competitive exam',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Save certifications
 * POST /api/profile/certifications/:candidateId
 */
async function saveCertifications(req, res) {
  try {
    const { candidateId } = req.params;
    const certifications = req.body?.certifications || [];

    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'Candidate ID is required' });
    }

    await prisma.candidateCertification.deleteMany({ where: { candidateId } });

    for (const cert of certifications) {
      // Handle documents - can be array of URLs or single file
      let documents = [];
      if (Array.isArray(cert.documents)) {
        documents = cert.documents.map(doc => typeof doc === 'string' ? doc : doc.url || doc);
      } else if (cert.documents) {
        documents = [typeof cert.documents === 'string' ? cert.documents : cert.documents.url || cert.documents];
      }

      await prisma.candidateCertification.create({
        data: {
          candidateId,
          certificationName: cert.certificationName || '',
          issuingOrganization: cert.issuingOrganization || '',
          issueDate: cert.issueDate || '',
          expiryDate: cert.expiryDate || null,
          doesNotExpire: cert.doesNotExpire || false,
          credentialId: cert.credentialId || null,
          credentialUrl: cert.credentialUrl || null,
          certificateFile: serializeFileField(cert.certificateFile),
          documents: documents,
          description: cert.description || null,
        },
      });
    }

    // Prepare detailed log data
    const logData = {
      totalCertifications: certifications.length,
      certifications: certifications.map((cert) => ({
        certificationName: cert.certificationName || '',
        issuingOrganization: cert.issuingOrganization || '',
        issueDate: cert.issueDate || '',
        expiryDate: cert.expiryDate || null,
        doesNotExpire: cert.doesNotExpire || false,
        credentialId: cert.credentialId || null,
        credentialUrl: cert.credentialUrl || null,
        documents: cert.documents || [],
        description: cert.description || null,
      })),
    };

    logProfileSave('Certifications', 'saved', candidateId, logData);

    res.json({ success: true, message: 'Certifications saved successfully' });
  } catch (error) {
    console.error('Error saving certifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save certifications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Save accomplishments
 * POST /api/profile/accomplishments/:candidateId
 */
async function saveAccomplishments(req, res) {
  try {
    const { candidateId } = req.params;
    const accomplishments = req.body?.accomplishments || [];

    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'Candidate ID is required' });
    }

    await prisma.candidateAccomplishment.deleteMany({ where: { candidateId } });

    for (const acc of accomplishments) {
      // Handle documents - can be array of URLs or single file
      let documents = [];
      if (Array.isArray(acc.documents)) {
        documents = acc.documents.map(doc => typeof doc === 'string' ? doc : doc.url || doc);
      } else if (acc.documents) {
        documents = [typeof acc.documents === 'string' ? acc.documents : acc.documents.url || acc.documents];
      }

      await prisma.candidateAccomplishment.create({
        data: {
          candidateId,
          title: acc.title || '',
          category: acc.category || '',
          organization: acc.organization || null,
          achievementDate: acc.achievementDate || '',
          description: acc.description || null,
          supportingDocument: serializeFileField(acc.supportingDocument),
          documents: documents,
        },
      });
    }

    // Prepare detailed log data
    const logData = {
      totalAccomplishments: accomplishments.length,
      accomplishments: accomplishments.map((acc) => ({
        title: acc.title || '',
        category: acc.category || '',
        organization: acc.organization || null,
        achievementDate: acc.achievementDate || '',
        description: acc.description ? (acc.description.length > 100 ? acc.description.substring(0, 100) + '...' : acc.description) : null,
        documents: acc.documents || [],
      })),
    };

    logProfileSave('Accomplishments', 'saved', candidateId, logData);

    res.json({ success: true, message: 'Accomplishments saved successfully' });
  } catch (error) {
    console.error('Error saving accomplishments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save accomplishments',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Upload visa documents
 * POST /api/profile/visa-work-authorization/documents/:candidateId
 */
async function uploadVisaDocuments(req, res) {
  try {
    const { candidateId } = req.params;
    const files = req.files;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded',
      });
    }

    const uploadedFilesData = await uploadDocumentsToCloudinary(files, {
      candidateId,
      folder: 'visa-work-authorization',
    });
    const uploadedFiles = uploadedFilesData.map((item) => item.url);

    res.json({
      success: true,
      message: 'Files uploaded successfully',
      files: uploadedFiles,
    });
  } catch (error) {
    console.error('Error uploading visa documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload files',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

function normalizeVisaDocumentRef(doc) {
  if (typeof doc === 'string') {
    const trimmed = doc.trim();
    if (!trimmed || trimmed === '[object Object]') return null;
    return trimmed;
  }
  if (doc && typeof doc === 'object') {
    if (typeof doc.url === 'string' && doc.url.trim()) return doc.url.trim();
    if (typeof doc.file === 'string') {
      const file = doc.file.trim();
      if (/^https?:\/\//i.test(file)) return file;
    }
  }
  return null;
}

function normalizeVisaDocumentsList(documents) {
  if (!Array.isArray(documents)) return [];
  return documents.map(normalizeVisaDocumentRef).filter(Boolean);
}

function normalizeVisaDetailsSection(section) {
  if (!section || typeof section !== 'object') return section;
  if (!Array.isArray(section.documents)) return section;
  return {
    ...section,
    documents: normalizeVisaDocumentsList(section.documents),
  };
}

/**
 * Save visa work authorization
 * POST /api/profile/visa-work-authorization/:candidateId
 */
async function saveVisaWorkAuthorization(req, res) {
  try {
    const { candidateId } = req.params;
    const visa = req.body;

    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'Candidate ID is required' });
    }

    const processedVisaDetailsExpected = normalizeVisaDetailsSection(visa.visaDetailsExpected);
    const processedVisaDetailsInitial = normalizeVisaDetailsSection(visa.visaDetailsInitial);

    let processedVisaEntries = visa.visaEntries;
    if (Array.isArray(processedVisaEntries)) {
      processedVisaEntries = processedVisaEntries.map((entry) => {
        if (entry?.visaDetails) {
          return {
            ...entry,
            visaDetails: normalizeVisaDetailsSection(entry.visaDetails),
          };
        }
        return entry;
      });
    }

    await prisma.candidateVisaWorkAuthorization.upsert({
      where: { candidateId },
      update: {
        selectedDestination: visa.selectedDestination || null,
        visaDetailsInitial: sanitizeJsonValue(processedVisaDetailsInitial),
        visaDetailsExpected: sanitizeJsonValue(processedVisaDetailsExpected),
        visaWorkpermitRequired: visa.visaWorkpermitRequired || null,
        openForAll: visa.openForAll || false,
        additionalRemarks: visa.additionalRemarks || null,
        visaEntries: sanitizeJsonValue(processedVisaEntries || []),
      },
      create: {
        candidateId,
        selectedDestination: visa.selectedDestination || null,
        visaDetailsInitial: sanitizeJsonValue(processedVisaDetailsInitial),
        visaDetailsExpected: sanitizeJsonValue(processedVisaDetailsExpected),
        visaWorkpermitRequired: visa.visaWorkpermitRequired || null,
        openForAll: visa.openForAll || false,
        additionalRemarks: visa.additionalRemarks || null,
        visaEntries: sanitizeJsonValue(processedVisaEntries || []),
      },
    });

    // Prepare detailed log data
    const logData = {
      selectedDestination: visa.selectedDestination || null,
      visaWorkpermitRequired: visa.visaWorkpermitRequired || null,
      openForAll: visa.openForAll || false,
      visaEntriesCount: Array.isArray(processedVisaEntries) ? processedVisaEntries.length : 0,
      additionalRemarks: visa.additionalRemarks ? (visa.additionalRemarks.length > 100 ? visa.additionalRemarks.substring(0, 100) + '...' : visa.additionalRemarks) : null,
    };

    logProfileSave('Visa Work Authorization', 'upserted', candidateId, logData);

    res.json({ success: true, message: 'Visa work authorization saved successfully' });
  } catch (error) {
    console.error('Error saving visa work authorization:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save visa work authorization',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Upload vaccination certificate
 * POST /api/profile/vaccination/documents/:candidateId
 */
async function uploadVaccinationDocuments(req, res) {
  try {
    const { candidateId } = req.params;
    const files = req.files;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded',
      });
    }

    const uploadedFilesData = await uploadDocumentsToCloudinary(files, {
      candidateId,
      folder: 'vaccination',
    });
    const uploadedFiles = uploadedFilesData.map((item) => item.url);

    res.json({
      success: true,
      message: 'Files uploaded successfully',
      files: uploadedFiles,
    });
  } catch (error) {
    console.error('Error uploading vaccination documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload files',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Save vaccination
 * POST /api/profile/vaccination/:candidateId
 */
async function saveVaccination(req, res) {
  try {
    const { candidateId } = req.params;
    const vaccination = req.body;

    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'Candidate ID is required' });
    }

    const documentUrls = Array.isArray(vaccination.documents)
      ? vaccination.documents.filter((u) => typeof u === 'string' && u.trim())
      : [];

    let certificateUrl = documentUrls[0] || null;
    if (!certificateUrl && vaccination.certificate) {
      if (typeof vaccination.certificate === 'string') {
        certificateUrl = vaccination.certificate;
      } else if (vaccination.certificate?.url) {
        certificateUrl = vaccination.certificate.url;
      }
    }

    const allDocuments =
      documentUrls.length > 0
        ? documentUrls
        : certificateUrl
          ? [certificateUrl]
          : [];

    await prisma.candidateVaccination.upsert({
      where: { candidateId },
      update: {
        vaccinationStatus: vaccination.vaccinationStatus || '',
        vaccineType: vaccination.vaccineType || null,
        lastVaccinationDate: vaccination.lastVaccinationDate || null,
        validityMonth: vaccination.validityMonth || null,
        validityYear: vaccination.validityYear || null,
        certificate: allDocuments[0] || null,
        documents: allDocuments,
      },
      create: {
        candidateId,
        vaccinationStatus: vaccination.vaccinationStatus || '',
        vaccineType: vaccination.vaccineType || null,
        lastVaccinationDate: vaccination.lastVaccinationDate || null,
        validityMonth: vaccination.validityMonth || null,
        validityYear: vaccination.validityYear || null,
        certificate: allDocuments[0] || null,
        documents: allDocuments,
      },
    });

    // Prepare detailed log data
    const logData = {
      vaccinationStatus: vaccination.vaccinationStatus || '',
      vaccineType: vaccination.vaccineType || null,
      lastVaccinationDate: vaccination.lastVaccinationDate || null,
      validityMonth: vaccination.validityMonth || null,
      validityYear: vaccination.validityYear || null,
      hasCertificate: allDocuments.length > 0,
      documentCount: allDocuments.length,
    };

    logProfileSave('Vaccination', 'upserted', candidateId, logData);

    res.json({ success: true, message: 'Vaccination saved successfully' });
  } catch (error) {
    console.error('Error saving vaccination:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save vaccination',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

// Helper functions
function serializeFileField(file) {
  if (!file) return null;
  if (typeof file === 'string') return file;
  if (typeof file === 'object' && file.name) return file.name;
  return null;
}

function mapGenderLabel(gender) {
  const map = {
    MALE: 'Male',
    FEMALE: 'Female',
    OTHER: 'Other',
  };
  return map[gender] || '';
}

function mapEmploymentLabel(status) {
  const map = {
    EMPLOYED: 'Employed',
    UNEMPLOYED: 'Unemployed',
    FREELANCING: 'Freelancing',
    STUDENT: 'Student',
    OTHER: 'Other',
  };
  return map[status] || '';
}

function mapPhoneCode(countryCode) {
  const map = {
    '+237': '+237 (Cameroon)',
    '+1': '+1 (USA)',
    '+44': '+44 (UK)',
    '+91': '+91 (India)',
  };
  return map[countryCode] || countryCode || '+237 (Cameroon)';
}

function logProfileSave(section, action, identifier, details) {
  console.log('\n============================================================');
  console.log(`📝 PROFILE ${section.toUpperCase()} ${action.toUpperCase()}`);
  console.log('============================================================');
  console.log('Identifier:', identifier);
  console.log('Saved Data:', JSON.stringify(details, null, 2));
  console.log('Saved At:', new Date().toISOString());
  console.log('============================================================\n');

  const candidateId = normalizeCandidateIdForDb(identifier);
  if (candidateId && /^[a-f0-9]{24}$/i.test(candidateId)) {
    scheduleCandidateCommonSyncDebounced(candidateId, { forceVerified: true });
  }
}

/**
 * POST /api/profile/sync-common-dashboard/:candidateId
 * Full profile → candidatecommon sync when candidate opens /candidate-dashboard.
 */
async function syncCommonDashboard(req, res) {
  try {
    const candidateId = normalizeCandidateIdForDb(req.params.candidateId);
    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'Candidate ID is required' });
    }

    const authCandidateId = normalizeCandidateIdForDb(req.user?.id);
    if (authCandidateId && authCandidateId !== candidateId && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not allowed to sync this profile' });
    }

    const row = await syncCandidateCommonFromDashboard(candidateId);
    if (!row) {
      return res.status(503).json({
        success: false,
        message: 'Candidate common database sync is unavailable',
      });
    }

    return res.json({
      success: true,
      message: 'Profile synced to common pool',
      data: { candidateId, syncedAt: row.syncedAt },
    });
  } catch (error) {
    console.error('[profile] sync-common-dashboard failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to sync profile to common database',
    });
  }
}

const DEFAULT_GAP_SUPPORT = {
  flexibleRole: false,
  hybridRemote: false,
  midLevelReEntry: false,
  skillRefresher: false,
};
const INTERNSHIP_ENTRIES_PREFIX = '__INTERNSHIP_ENTRIES__:';
const ACADEMIC_ACHIEVEMENT_ENTRIES_PREFIX = '__ACADEMIC_ACHIEVEMENT_ENTRIES__:';
const COMPETITIVE_EXAM_ENTRIES_PREFIX = '__COMPETITIVE_EXAM_ENTRIES__:';
const PROJECT_ENTRIES_PREFIX = '__PROJECT_ENTRIES__:';

function normalizePreferredSupport(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    flexibleRole: Boolean(source.flexibleRole),
    hybridRemote: Boolean(source.hybridRemote),
    midLevelReEntry: Boolean(source.midLevelReEntry),
    skillRefresher: Boolean(source.skillRefresher),
  };
}

function buildGapEntryFromPayload(data = {}, fallbackId = randomUUID()) {
  return {
    id: typeof data.id === 'string' && data.id.trim() ? data.id.trim() : fallbackId,
    gapCategory: typeof data.gapCategory === 'string' ? data.gapCategory : '',
    reasonForGap: typeof data.reasonForGap === 'string' ? data.reasonForGap : '',
    gapDuration: typeof data.gapDuration === 'string' ? data.gapDuration : '',
    selectedSkills: Array.isArray(data.selectedSkills) ? data.selectedSkills : [],
    coursesText: typeof data.coursesText === 'string' ? data.coursesText : '',
    preferredSupport: normalizePreferredSupport(data.preferredSupport),
  };
}

function extractGapEntries(gapExplanationRecord) {
  if (!gapExplanationRecord) return [];

  const preferredSupportObj =
    gapExplanationRecord.preferredSupport &&
    typeof gapExplanationRecord.preferredSupport === 'object'
      ? gapExplanationRecord.preferredSupport
      : {};

  if (Array.isArray(preferredSupportObj.entries)) {
    return preferredSupportObj.entries.map((entry) =>
      buildGapEntryFromPayload(entry, randomUUID())
    );
  }

  const legacySupport = normalizePreferredSupport(gapExplanationRecord.preferredSupport);

  const hasLegacyGapData = Boolean(
    gapExplanationRecord.gapCategory ||
    gapExplanationRecord.reasonForGap ||
    gapExplanationRecord.gapDuration ||
    (Array.isArray(gapExplanationRecord.selectedSkills) && gapExplanationRecord.selectedSkills.length > 0) ||
    gapExplanationRecord.coursesText ||
    legacySupport.flexibleRole ||
    legacySupport.hybridRemote ||
    legacySupport.midLevelReEntry ||
    legacySupport.skillRefresher
  );

  if (!hasLegacyGapData) {
    return [];
  }

  return [
    {
      id: randomUUID(),
      gapCategory: gapExplanationRecord.gapCategory || '',
      reasonForGap: gapExplanationRecord.reasonForGap || '',
      gapDuration: gapExplanationRecord.gapDuration || '',
      selectedSkills: Array.isArray(gapExplanationRecord.selectedSkills)
        ? gapExplanationRecord.selectedSkills
        : [],
      coursesText: gapExplanationRecord.coursesText || '',
      preferredSupport: legacySupport || DEFAULT_GAP_SUPPORT,
    },
  ];
}

function stripInternshipMetadataDocuments(documents = []) {
  return documents.filter(
    (doc) =>
      typeof doc === 'string' &&
      doc.trim() &&
      !doc.startsWith(INTERNSHIP_ENTRIES_PREFIX)
  );
}

function encodeInternshipEntries(entries) {
  try {
    return `${INTERNSHIP_ENTRIES_PREFIX}${Buffer.from(
      JSON.stringify(entries),
      'utf8'
    ).toString('base64')}`;
  } catch (_error) {
    return null;
  }
}

function decodeInternshipEntriesFromDocuments(documents = []) {
  const encodedEntry = documents.find(
    (doc) =>
      typeof doc === 'string' && doc.startsWith(INTERNSHIP_ENTRIES_PREFIX)
  );
  if (!encodedEntry) return [];

  try {
    const encodedPayload = encodedEntry.slice(INTERNSHIP_ENTRIES_PREFIX.length);
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, 'base64').toString('utf8')
    );
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => buildInternshipEntryFromPayload(entry, randomUUID()));
  } catch (_error) {
    return [];
  }
}

function buildInternshipEntryFromPayload(data = {}, fallbackId = randomUUID()) {
  const normalizedDocuments = Array.isArray(data.documents)
    ? data.documents.filter(
        (doc) =>
          typeof doc === 'string' &&
          doc.trim() &&
          !doc.startsWith(INTERNSHIP_ENTRIES_PREFIX)
      )
    : [];

  return {
    id: typeof data.id === 'string' && data.id.trim() ? data.id.trim() : fallbackId,
    internshipTitle: typeof data.internshipTitle === 'string' ? data.internshipTitle : '',
    companyName: typeof data.companyName === 'string' ? data.companyName : '',
    internshipType: typeof data.internshipType === 'string' ? data.internshipType : '',
    domainDepartment: typeof data.domainDepartment === 'string' ? data.domainDepartment : '',
    startDate: typeof data.startDate === 'string' ? data.startDate : '',
    endDate: typeof data.endDate === 'string' ? data.endDate : '',
    currentlyWorking: Boolean(data.currentlyWorking),
    location: typeof data.location === 'string' ? data.location : '',
    workMode: typeof data.workMode === 'string' ? data.workMode : '',
    responsibilities: typeof data.responsibilities === 'string' ? data.responsibilities : '',
    learnings: typeof data.learnings === 'string' ? data.learnings : '',
    skills: Array.isArray(data.skills) ? data.skills : [],
    documents: normalizedDocuments,
  };
}

function extractInternshipEntries(internshipRecord) {
  if (!internshipRecord) return [];

  const documents = Array.isArray(internshipRecord.documents)
    ? internshipRecord.documents
    : [];
  const extractedFromMetadata = decodeInternshipEntriesFromDocuments(documents);
  if (extractedFromMetadata.length > 0) {
    return extractedFromMetadata;
  }

  const plainDocuments = stripInternshipMetadataDocuments(documents);
  const hasLegacyData = Boolean(
    internshipRecord.internshipTitle ||
      internshipRecord.companyName ||
      internshipRecord.internshipType ||
      internshipRecord.domainDepartment ||
      internshipRecord.startDate ||
      internshipRecord.endDate ||
      internshipRecord.currentlyWorking ||
      internshipRecord.location ||
      internshipRecord.workMode ||
      internshipRecord.responsibilities ||
      internshipRecord.learnings ||
      (Array.isArray(internshipRecord.skills) && internshipRecord.skills.length > 0) ||
      plainDocuments.length > 0
  );

  if (!hasLegacyData) return [];

  return [
    {
      id: randomUUID(),
      internshipTitle: internshipRecord.internshipTitle || '',
      companyName: internshipRecord.companyName || '',
      internshipType: internshipRecord.internshipType || '',
      domainDepartment: internshipRecord.domainDepartment || '',
      startDate: internshipRecord.startDate ? new Date(internshipRecord.startDate).toISOString().split('T')[0] : '',
      endDate: internshipRecord.endDate ? new Date(internshipRecord.endDate).toISOString().split('T')[0] : '',
      currentlyWorking: internshipRecord.currentlyWorking || false,
      location: internshipRecord.location || '',
      workMode: internshipRecord.workMode || '',
      responsibilities: internshipRecord.responsibilities || '',
      learnings: internshipRecord.learnings || '',
      skills: Array.isArray(internshipRecord.skills) ? internshipRecord.skills : [],
      documents: plainDocuments,
    },
  ];
}

function buildInternshipDocumentsForStorage(latestDocuments, allEntries) {
  const plainDocuments = stripInternshipMetadataDocuments(
    Array.isArray(latestDocuments) ? latestDocuments : []
  );
  const encodedEntries = encodeInternshipEntries(
    Array.isArray(allEntries) ? allEntries : []
  );

  if (!encodedEntries) {
    return plainDocuments;
  }
  return [...plainDocuments, encodedEntries];
}

function stripAcademicAchievementMetadataDocuments(documents = []) {
  return documents.filter(
    (doc) =>
      typeof doc === 'string' &&
      doc.trim() &&
      !doc.startsWith(ACADEMIC_ACHIEVEMENT_ENTRIES_PREFIX)
  );
}

function encodeAcademicAchievementEntries(entries) {
  try {
    return `${ACADEMIC_ACHIEVEMENT_ENTRIES_PREFIX}${Buffer.from(
      JSON.stringify(entries),
      'utf8'
    ).toString('base64')}`;
  } catch (_error) {
    return null;
  }
}

function decodeAcademicAchievementEntriesFromDocuments(documents = []) {
  const encodedEntry = documents.find(
    (doc) =>
      typeof doc === 'string' && doc.startsWith(ACADEMIC_ACHIEVEMENT_ENTRIES_PREFIX)
  );
  if (!encodedEntry) return [];

  try {
    const encodedPayload = encodedEntry.slice(ACADEMIC_ACHIEVEMENT_ENTRIES_PREFIX.length);
    const parsed = JSON.parse(Buffer.from(encodedPayload, 'base64').toString('utf8'));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) =>
      buildAcademicAchievementEntryFromPayload(entry, randomUUID())
    );
  } catch (_error) {
    return [];
  }
}

function buildAcademicAchievementEntryFromPayload(data = {}, fallbackId = randomUUID()) {
  const normalizedDocuments = Array.isArray(data.documents)
    ? data.documents
        .map((doc) => (typeof doc === 'string' ? doc : doc?.url || doc?.name))
        .filter(
          (doc) =>
            typeof doc === 'string' &&
            doc.trim() &&
            !doc.startsWith(ACADEMIC_ACHIEVEMENT_ENTRIES_PREFIX)
        )
    : [];

  return {
    id: typeof data.id === 'string' && data.id.trim() ? data.id.trim() : fallbackId,
    achievementTitle: typeof data.achievementTitle === 'string' ? data.achievementTitle : '',
    awardedBy: typeof data.awardedBy === 'string' ? data.awardedBy : '',
    yearReceived: typeof data.yearReceived === 'string' ? data.yearReceived : '',
    categoryType: typeof data.categoryType === 'string' ? data.categoryType : '',
    description: typeof data.description === 'string' ? data.description : '',
    documents: normalizedDocuments,
  };
}

function extractAcademicAchievementEntries(academicAchievementRecord) {
  if (!academicAchievementRecord) return [];

  const documents = Array.isArray(academicAchievementRecord.documents)
    ? academicAchievementRecord.documents
    : [];
  const extractedFromMetadata =
    decodeAcademicAchievementEntriesFromDocuments(documents);
  if (extractedFromMetadata.length > 0) {
    return extractedFromMetadata;
  }

  const plainDocuments = stripAcademicAchievementMetadataDocuments(documents);
  const hasLegacyData = Boolean(
    academicAchievementRecord.achievementTitle ||
      academicAchievementRecord.awardedBy ||
      academicAchievementRecord.yearReceived ||
      academicAchievementRecord.categoryType ||
      academicAchievementRecord.description ||
      plainDocuments.length > 0
  );

  if (!hasLegacyData) return [];

  return [
    {
      id: randomUUID(),
      achievementTitle: academicAchievementRecord.achievementTitle || '',
      awardedBy: academicAchievementRecord.awardedBy || '',
      yearReceived: academicAchievementRecord.yearReceived || '',
      categoryType: academicAchievementRecord.categoryType || '',
      description: academicAchievementRecord.description || '',
      documents: plainDocuments,
    },
  ];
}

function buildAcademicAchievementDocumentsForStorage(latestDocuments, allEntries) {
  const plainDocuments = stripAcademicAchievementMetadataDocuments(
    Array.isArray(latestDocuments) ? latestDocuments : []
  );
  const encodedEntries = encodeAcademicAchievementEntries(
    Array.isArray(allEntries) ? allEntries : []
  );

  if (!encodedEntries) {
    return plainDocuments;
  }
  return [...plainDocuments, encodedEntries];
}

function stripCompetitiveExamMetadataDocuments(documents = []) {
  return documents.filter(
    (doc) =>
      typeof doc === 'string' &&
      doc.trim() &&
      !doc.startsWith(COMPETITIVE_EXAM_ENTRIES_PREFIX)
  );
}

function encodeCompetitiveExamEntries(entries) {
  try {
    return `${COMPETITIVE_EXAM_ENTRIES_PREFIX}${Buffer.from(
      JSON.stringify(entries),
      'utf8'
    ).toString('base64')}`;
  } catch (_error) {
    return null;
  }
}

function decodeCompetitiveExamEntriesFromDocuments(documents = []) {
  const encodedEntry = documents.find(
    (doc) =>
      typeof doc === 'string' && doc.startsWith(COMPETITIVE_EXAM_ENTRIES_PREFIX)
  );
  if (!encodedEntry) return [];

  try {
    const encodedPayload = encodedEntry.slice(COMPETITIVE_EXAM_ENTRIES_PREFIX.length);
    const parsed = JSON.parse(Buffer.from(encodedPayload, 'base64').toString('utf8'));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) =>
      buildCompetitiveExamEntryFromPayload(entry, randomUUID())
    );
  } catch (_error) {
    return [];
  }
}

function buildCompetitiveExamEntryFromPayload(data = {}, fallbackId = randomUUID()) {
  const normalizedDocuments = Array.isArray(data.documents)
    ? data.documents
        .map((doc) => (typeof doc === 'string' ? doc : doc?.url || doc?.name))
        .filter(
          (doc) =>
            typeof doc === 'string' &&
            doc.trim() &&
            !doc.startsWith(COMPETITIVE_EXAM_ENTRIES_PREFIX)
        )
    : [];

  return {
    id: typeof data.id === 'string' && data.id.trim() ? data.id.trim() : fallbackId,
    examName: typeof data.examName === 'string' ? data.examName : '',
    yearTaken: typeof data.yearTaken === 'string' ? data.yearTaken : '',
    resultStatus: typeof data.resultStatus === 'string' ? data.resultStatus : '',
    scoreMarks: typeof data.scoreMarks === 'string' ? data.scoreMarks : '',
    scoreType: typeof data.scoreType === 'string' ? data.scoreType : '',
    validUntil: typeof data.validUntil === 'string' ? data.validUntil : '',
    additionalNotes: typeof data.additionalNotes === 'string' ? data.additionalNotes : '',
    documents: normalizedDocuments,
  };
}

function extractCompetitiveExamEntries(competitiveExamRecord) {
  if (!competitiveExamRecord) return [];

  const documents = Array.isArray(competitiveExamRecord.documents)
    ? competitiveExamRecord.documents
    : [];
  const extractedFromMetadata = decodeCompetitiveExamEntriesFromDocuments(documents);
  if (extractedFromMetadata.length > 0) {
    return extractedFromMetadata;
  }

  const plainDocuments = stripCompetitiveExamMetadataDocuments(documents);
  const hasLegacyData = Boolean(
    competitiveExamRecord.examName ||
      competitiveExamRecord.yearTaken ||
      competitiveExamRecord.resultStatus ||
      competitiveExamRecord.scoreMarks ||
      competitiveExamRecord.scoreType ||
      competitiveExamRecord.validUntil ||
      competitiveExamRecord.additionalNotes ||
      plainDocuments.length > 0
  );

  if (!hasLegacyData) return [];

  return [
    {
      id:
        typeof competitiveExamRecord.id === 'string' && competitiveExamRecord.id.trim()
          ? competitiveExamRecord.id
          : randomUUID(),
      examName: competitiveExamRecord.examName || '',
      yearTaken: competitiveExamRecord.yearTaken || '',
      resultStatus: competitiveExamRecord.resultStatus || '',
      scoreMarks: competitiveExamRecord.scoreMarks || '',
      scoreType: competitiveExamRecord.scoreType || '',
      validUntil: competitiveExamRecord.validUntil || '',
      additionalNotes: competitiveExamRecord.additionalNotes || '',
      documents: plainDocuments,
    },
  ];
}

function buildCompetitiveExamDocumentsForStorage(latestDocuments, allEntries) {
  const plainDocuments = stripCompetitiveExamMetadataDocuments(
    Array.isArray(latestDocuments) ? latestDocuments : []
  );
  const encodedEntries = encodeCompetitiveExamEntries(
    Array.isArray(allEntries) ? allEntries : []
  );

  if (!encodedEntries) {
    return plainDocuments;
  }
  return [...plainDocuments, encodedEntries];
}

function stripProjectMetadataDocuments(documents = []) {
  return documents.filter(
    (doc) =>
      typeof doc === 'string' &&
      doc.trim() &&
      !doc.startsWith(PROJECT_ENTRIES_PREFIX)
  );
}

function encodeProjectEntries(entries) {
  try {
    return `${PROJECT_ENTRIES_PREFIX}${Buffer.from(
      JSON.stringify(entries),
      'utf8'
    ).toString('base64')}`;
  } catch (_error) {
    return null;
  }
}

function decodeProjectEntriesFromDocuments(documents = []) {
  const encodedEntry = documents.find(
    (doc) => typeof doc === 'string' && doc.startsWith(PROJECT_ENTRIES_PREFIX)
  );
  if (!encodedEntry) return [];

  try {
    const encodedPayload = encodedEntry.slice(PROJECT_ENTRIES_PREFIX.length);
    const parsed = JSON.parse(Buffer.from(encodedPayload, 'base64').toString('utf8'));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => buildProjectEntryFromPayload(entry, randomUUID()));
  } catch (_error) {
    return [];
  }
}

function buildProjectEntryFromPayload(data = {}, fallbackId = randomUUID()) {
  const normalizedDocuments = Array.isArray(data.documents)
    ? data.documents
        .map((doc) => (typeof doc === 'string' ? doc : doc?.url || doc?.name))
        .filter(
          (doc) =>
            typeof doc === 'string' &&
            doc.trim() &&
            !doc.startsWith(PROJECT_ENTRIES_PREFIX)
        )
    : [];

  return {
    id: typeof data.id === 'string' && data.id.trim() ? data.id.trim() : fallbackId,
    projectTitle: typeof data.projectTitle === 'string' ? data.projectTitle : '',
    projectType: typeof data.projectType === 'string' ? data.projectType : '',
    organizationClient: typeof data.organizationClient === 'string' ? data.organizationClient : '',
    currentlyWorking: Boolean(data.currentlyWorking),
    startDate: typeof data.startDate === 'string' ? data.startDate : '',
    endDate: typeof data.endDate === 'string' ? data.endDate : '',
    projectDescription: typeof data.projectDescription === 'string' ? data.projectDescription : '',
    responsibilities: typeof data.responsibilities === 'string' ? data.responsibilities : '',
    technologies: Array.isArray(data.technologies) ? data.technologies : [],
    projectOutcome: typeof data.projectOutcome === 'string' ? data.projectOutcome : '',
    projectLink: typeof data.projectLink === 'string' ? data.projectLink : '',
    documents: normalizedDocuments,
  };
}

function extractProjectEntries(projectRecord) {
  if (!projectRecord) return [];

  const documents = Array.isArray(projectRecord.documents) ? projectRecord.documents : [];
  const extractedFromMetadata = decodeProjectEntriesFromDocuments(documents);
  if (extractedFromMetadata.length > 0) {
    return extractedFromMetadata;
  }

  const plainDocuments = stripProjectMetadataDocuments(documents);
  const hasLegacyData = Boolean(
    projectRecord.projectTitle ||
      projectRecord.projectType ||
      projectRecord.organizationClient ||
      projectRecord.currentlyWorking ||
      projectRecord.startDate ||
      projectRecord.endDate ||
      projectRecord.projectDescription ||
      projectRecord.responsibilities ||
      (Array.isArray(projectRecord.technologies) && projectRecord.technologies.length > 0) ||
      projectRecord.projectOutcome ||
      projectRecord.projectLink ||
      plainDocuments.length > 0
  );

  if (!hasLegacyData) return [];

  return [
    {
      id: typeof projectRecord.id === 'string' && projectRecord.id.trim() ? projectRecord.id : randomUUID(),
      projectTitle: projectRecord.projectTitle || '',
      projectType: projectRecord.projectType || '',
      organizationClient: projectRecord.organizationClient || '',
      currentlyWorking: projectRecord.currentlyWorking || false,
      startDate: projectRecord.startDate ? new Date(projectRecord.startDate).toISOString().split('T')[0] : '',
      endDate: projectRecord.endDate ? new Date(projectRecord.endDate).toISOString().split('T')[0] : '',
      projectDescription: projectRecord.projectDescription || '',
      responsibilities: projectRecord.responsibilities || '',
      technologies: Array.isArray(projectRecord.technologies) ? projectRecord.technologies : [],
      projectOutcome: projectRecord.projectOutcome || '',
      projectLink: projectRecord.projectLink || '',
      documents: plainDocuments,
    },
  ];
}

function buildProjectDocumentsForStorage(latestDocuments, allEntries) {
  const plainDocuments = stripProjectMetadataDocuments(
    Array.isArray(latestDocuments) ? latestDocuments : []
  );
  const encodedEntries = encodeProjectEntries(Array.isArray(allEntries) ? allEntries : []);

  if (!encodedEntries) {
    return plainDocuments;
  }
  return [...plainDocuments, encodedEntries];
}

function sanitizeJsonValue(value) {
  if (value === undefined || value === null) return null;
  return JSON.parse(JSON.stringify(value, (key, currentValue) => {
    if (currentValue && typeof currentValue === 'object' && currentValue.name && currentValue.size !== undefined) {
      return {
        name: currentValue.name,
        size: currentValue.size,
      };
    }
    return currentValue;
  }));
}

function formatDateForDisplay(date) {
  if (!date) return '';
  const d = new Date(date);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                 'July', 'August', 'September', 'October', 'November', 'December'];
  const day = d.getDate();
  const suffix = day === 1 || day === 21 || day === 31 ? 'st' : 
                day === 2 || day === 22 ? 'nd' : 
                day === 3 || day === 23 ? 'rd' : 'th';
  return `${months[d.getMonth()]} ${day}${suffix}, ${d.getFullYear()}`;
}

function parseDateString(dateString) {
  if (!dateString) return null;
  // Try to parse various date formats
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;
  return date;
}

function mapProficiency(proficiency) {
  const proficiencyMap = {
    'BEGINNER': 'Beginner',
    'INTERMEDIATE': 'Intermediate',
    'ADVANCED': 'Advanced',
    'NATIVE': 'Fluent / Native',
  };
  return proficiencyMap[proficiency] || 'Intermediate';
}

// Delete functions for all modals
async function deleteProject(req, res) {
  try {
    const { candidateId } = req.params;
    const entryId = typeof req.query.entryId === 'string' ? req.query.entryId.trim() : '';
    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'Candidate ID is required' });
    }
    const existing = await prisma.candidateProject.findUnique({ where: { candidateId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const existingEntries = extractProjectEntries(existing);

    if (entryId) {
      if (existingEntries.length === 0) {
        return res.status(404).json({ success: false, message: 'Project entry not found' });
      }

      const remainingEntries = existingEntries.filter((entry) => entry.id !== entryId);
      if (remainingEntries.length === existingEntries.length) {
        return res.status(404).json({ success: false, message: 'Project entry not found' });
      }

      if (remainingEntries.length === 0) {
        await prisma.candidateProject.delete({ where: { candidateId } });
      } else {
        const latestEntry = remainingEntries[remainingEntries.length - 1];
        const documentsToStore = buildProjectDocumentsForStorage(
          latestEntry.documents,
          remainingEntries
        );

        await prisma.candidateProject.update({
          where: { candidateId },
          data: {
            projectTitle: latestEntry.projectTitle || '',
            projectType: latestEntry.projectType || '',
            organizationClient: latestEntry.organizationClient || null,
            currentlyWorking: latestEntry.currentlyWorking || false,
            startDate: latestEntry.startDate ? new Date(latestEntry.startDate) : null,
            endDate: latestEntry.endDate ? new Date(latestEntry.endDate) : null,
            projectDescription: latestEntry.projectDescription || null,
            responsibilities: latestEntry.responsibilities || null,
            technologies: Array.isArray(latestEntry.technologies) ? latestEntry.technologies : [],
            projectOutcome: latestEntry.projectOutcome || null,
            projectLink: latestEntry.projectLink || null,
            documents: documentsToStore,
          },
        });
      }

      logProfileSave('Project', 'entry deleted', candidateId, {
        entryId,
        remainingEntries: Math.max(existingEntries.length - 1, 0),
      });
      return res.json({ success: true, message: 'Project deleted successfully' });
    }

    await prisma.candidateProject.delete({ where: { candidateId } });
    logProfileSave('Project', 'deleted', candidateId, { projectTitle: existing.projectTitle || '' });
    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ success: false, message: 'Failed to delete project', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
}

async function deleteAcademicAchievement(req, res) {
  try {
    const { candidateId } = req.params;
    const entryId = typeof req.query.entryId === 'string' ? req.query.entryId.trim() : '';
    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'Candidate ID is required' });
    }
    const existing = await prisma.candidateAcademicAchievement.findUnique({ where: { candidateId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Academic achievement not found' });
    }

    const existingEntries = extractAcademicAchievementEntries(existing);

    if (entryId) {
      if (existingEntries.length === 0) {
        return res.status(404).json({ success: false, message: 'Academic achievement entry not found' });
      }

      const remainingEntries = existingEntries.filter((entry) => entry.id !== entryId);
      if (remainingEntries.length === existingEntries.length) {
        return res.status(404).json({ success: false, message: 'Academic achievement entry not found' });
      }

      if (remainingEntries.length === 0) {
        await prisma.candidateAcademicAchievement.delete({ where: { candidateId } });
      } else {
        const latestEntry = remainingEntries[remainingEntries.length - 1];
        const documentsToStore = buildAcademicAchievementDocumentsForStorage(
          latestEntry.documents,
          remainingEntries
        );

        await prisma.candidateAcademicAchievement.update({
          where: { candidateId },
          data: {
            achievementTitle: latestEntry.achievementTitle || '',
            awardedBy: latestEntry.awardedBy || '',
            yearReceived: latestEntry.yearReceived || '',
            categoryType: latestEntry.categoryType || null,
            description: latestEntry.description || null,
            documents: documentsToStore,
          },
        });
      }

      logProfileSave('Academic Achievement', 'entry deleted', candidateId, {
        entryId,
        remainingEntries: Math.max(existingEntries.length - 1, 0),
      });
      return res.json({ success: true, message: 'Academic achievement deleted successfully' });
    }

    await prisma.candidateAcademicAchievement.delete({ where: { candidateId } });
    logProfileSave('Academic Achievement', 'deleted', candidateId, { achievementTitle: existing.achievementTitle || '' });
    res.json({ success: true, message: 'Academic achievement deleted successfully' });
  } catch (error) {
    console.error('Error deleting academic achievement:', error);
    res.status(500).json({ success: false, message: 'Failed to delete academic achievement', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
}

async function deleteCompetitiveExam(req, res) {
  try {
    const { candidateId } = req.params;
    const entryId = typeof req.query.entryId === 'string' ? req.query.entryId.trim() : '';
    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'Candidate ID is required' });
    }
    const existing = await prisma.candidateCompetitiveExam.findUnique({ where: { candidateId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Competitive exam not found' });
    }

    const existingEntries = extractCompetitiveExamEntries(existing);

    if (entryId) {
      if (existingEntries.length === 0) {
        return res.status(404).json({ success: false, message: 'Competitive exam entry not found' });
      }

      const remainingEntries = existingEntries.filter((entry) => entry.id !== entryId);
      if (remainingEntries.length === existingEntries.length) {
        return res.status(404).json({ success: false, message: 'Competitive exam entry not found' });
      }

      if (remainingEntries.length === 0) {
        await prisma.candidateCompetitiveExam.delete({ where: { candidateId } });
      } else {
        const latestEntry = remainingEntries[remainingEntries.length - 1];
        const documentsToStore = buildCompetitiveExamDocumentsForStorage(
          latestEntry.documents,
          remainingEntries
        );

        await prisma.candidateCompetitiveExam.update({
          where: { candidateId },
          data: {
            examName: latestEntry.examName || '',
            yearTaken: latestEntry.yearTaken || '',
            resultStatus: latestEntry.resultStatus || '',
            scoreMarks: latestEntry.scoreMarks || null,
            scoreType: latestEntry.scoreType || null,
            validUntil: latestEntry.validUntil || null,
            additionalNotes: latestEntry.additionalNotes || null,
            documents: documentsToStore,
          },
        });
      }

      logProfileSave('Competitive Exam', 'entry deleted', candidateId, {
        entryId,
        remainingEntries: Math.max(existingEntries.length - 1, 0),
      });
      return res.json({ success: true, message: 'Competitive exam deleted successfully' });
    }

    await prisma.candidateCompetitiveExam.delete({ where: { candidateId } });
    logProfileSave('Competitive Exam', 'deleted', candidateId, { examName: existing.examName || '' });
    res.json({ success: true, message: 'Competitive exam deleted successfully' });
  } catch (error) {
    console.error('Error deleting competitive exam:', error);
    res.status(500).json({ success: false, message: 'Failed to delete competitive exam', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
}

async function deleteCertification(req, res) {
  try {
    const { certificationId } = req.params;
    if (!certificationId) {
      return res.status(400).json({ success: false, message: 'Certification ID is required' });
    }
    const existing = await prisma.candidateCertification.findUnique({ where: { id: certificationId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Certification not found' });
    }
    await prisma.candidateCertification.delete({ where: { id: certificationId } });
    logProfileSave('Certification', 'deleted', existing.candidateId, { certificationName: existing.certificationName || '' });
    res.json({ success: true, message: 'Certification deleted successfully' });
  } catch (error) {
    console.error('Error deleting certification:', error);
    res.status(500).json({ success: false, message: 'Failed to delete certification', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
}

async function deleteAccomplishment(req, res) {
  try {
    const { accomplishmentId } = req.params;
    if (!accomplishmentId) {
      return res.status(400).json({ success: false, message: 'Accomplishment ID is required' });
    }
    const existing = await prisma.candidateAccomplishment.findUnique({ where: { id: accomplishmentId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Accomplishment not found' });
    }
    await prisma.candidateAccomplishment.delete({ where: { id: accomplishmentId } });
    logProfileSave('Accomplishment', 'deleted', existing.candidateId, { title: existing.title || '' });
    res.json({ success: true, message: 'Accomplishment deleted successfully' });
  } catch (error) {
    console.error('Error deleting accomplishment:', error);
    res.status(500).json({ success: false, message: 'Failed to delete accomplishment', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
}

async function deleteVisaWorkAuthorization(req, res) {
  try {
    const { candidateId } = req.params;
    const { entryId } = req.query;
    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'Candidate ID is required' });
    }
    const existing = await prisma.candidateVisaWorkAuthorization.findUnique({ where: { candidateId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Visa work authorization not found' });
    }

    if (entryId) {
      if (entryId === 'top-level') {
        // Clear top-level data, keep visaEntries
        const hasVisaEntries = Array.isArray(existing.visaEntries) && existing.visaEntries.length > 0;
        if (!hasVisaEntries) {
          await prisma.candidateVisaWorkAuthorization.delete({ where: { candidateId } });
        } else {
          await prisma.candidateVisaWorkAuthorization.update({
            where: { candidateId },
            data: {
              selectedDestination: null,
              visaDetailsExpected: Prisma.DbNull,
              visaDetailsInitial: Prisma.DbNull,
              visaWorkpermitRequired: null,
              openForAll: false,
              additionalRemarks: null,
            }
          });
        }
      } else {
        // Filter out the specific entry from visaEntries
        const updatedEntries = (existing.visaEntries || []).filter(entry => entry.id !== entryId);
        
        // If there's no top-level data and no visaEntries left, delete the record entirely
        const hasTopLevelData = !!existing.selectedDestination;
        if (updatedEntries.length === 0 && !hasTopLevelData) {
          await prisma.candidateVisaWorkAuthorization.delete({ where: { candidateId } });
        } else {
          await prisma.candidateVisaWorkAuthorization.update({
            where: { candidateId },
            data: { visaEntries: updatedEntries }
          });
        }
      }
      logProfileSave('Visa Work Authorization', 'deleted_single', candidateId, { entryId });
      return res.json({ success: true, message: 'Visa entry deleted successfully' });
    }

    await prisma.candidateVisaWorkAuthorization.delete({ where: { candidateId } });
    logProfileSave('Visa Work Authorization', 'deleted', candidateId, { selectedDestination: existing.selectedDestination || '' });
    res.json({ success: true, message: 'Visa work authorization deleted successfully' });
  } catch (error) {
    console.error('Error deleting visa work authorization:', error);
    res.status(500).json({ success: false, message: 'Failed to delete visa work authorization', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
}

async function deleteVaccination(req, res) {
  try {
    const { candidateId } = req.params;
    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'Candidate ID is required' });
    }
    const existing = await prisma.candidateVaccination.findUnique({ where: { candidateId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Vaccination not found' });
    }
    await prisma.candidateVaccination.delete({ where: { candidateId } });
    logProfileSave('Vaccination', 'deleted', candidateId, { vaccinationStatus: existing.vaccinationStatus || '' });
    res.json({ success: true, message: 'Vaccination deleted successfully' });
  } catch (error) {
    console.error('Error deleting vaccination:', error);
    res.status(500).json({ success: false, message: 'Failed to delete vaccination', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
}

async function deleteResume(req, res) {
  try {
    const { candidateId } = req.params;
    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'Candidate ID is required' });
    }
    const existing = await prisma.resume.findUnique({ where: { candidateId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }
    await prisma.resume.delete({ where: { candidateId } });
    logProfileSave('Resume', 'deleted', candidateId, { fileName: existing.fileName || '' });
    res.json({ success: true, message: 'Resume deleted successfully' });
  } catch (error) {
    console.error('Error deleting resume:', error);
    res.status(500).json({ success: false, message: 'Failed to delete resume', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
}

async function deletePortfolioLinks(req, res) {
  try {
    const { candidateId } = req.params;
    const { entryId } = req.query;
    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'Candidate ID is required' });
    }
    const existing = await prisma.candidatePortfolioLinks.findUnique({ where: { candidateId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Portfolio links not found' });
    }

    if (entryId) {
      const updatedLinks = (existing.links || []).filter(link => link.id !== entryId);
      if (updatedLinks.length === 0) {
        await prisma.candidatePortfolioLinks.delete({ where: { candidateId } });
      } else {
        await prisma.candidatePortfolioLinks.update({
          where: { candidateId },
          data: { links: updatedLinks }
        });
      }
      logProfileSave('Portfolio Links', 'deleted_single', candidateId, { entryId });
      return res.json({ success: true, message: 'Portfolio link deleted successfully' });
    }

    await prisma.candidatePortfolioLinks.delete({ where: { candidateId } });
    logProfileSave('Portfolio Links', 'deleted', candidateId, { totalLinks: Array.isArray(existing.links) ? existing.links.length : 0 });
    res.json({ success: true, message: 'Portfolio links deleted successfully' });
  } catch (error) {
    console.error('Error deleting portfolio links:', error);
    res.status(500).json({ success: false, message: 'Failed to delete portfolio links', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
}

async function deleteCareerPreferences(req, res) {
  try {
    const { candidateId } = req.params;
    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'Candidate ID is required' });
    }
    const existing = await prisma.careerPreferences.findUnique({ where: { candidateId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Career preferences not found' });
    }
    await prisma.careerPreferences.delete({ where: { candidateId } });
    logProfileSave('Career Preferences', 'deleted', candidateId, { preferredRolesCount: Array.isArray(existing.preferredRoles) ? existing.preferredRoles.length : 0 });
    res.json({ success: true, message: 'Career preferences deleted successfully' });
  } catch (error) {
    console.error('Error deleting career preferences:', error);
    res.status(500).json({ success: false, message: 'Failed to delete career preferences', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
}

/**
 * Upload profile photo
 * POST /api/profile/photo/:candidateId
 */
async function uploadProfilePhoto(req, res) {
  try {
    const { candidateId } = req.params;
    const file = req.file;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'Profile photo file is required',
      });
    }

    // Validate file type (only images)
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only JPG, PNG, and WEBP images are allowed.',
      });
    }

    // Validate file size (2MB max for profile photos)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: 'File size exceeds 2MB limit',
      });
    }

    // Check if candidate exists
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found',
      });
    }

    // Delete old profile photo if exists
    const existingProfile = await prisma.candidateProfile.findUnique({
      where: { candidateId: candidateId },
      select: { profilePhotoUrl: true },
    });

    if (existingProfile?.profilePhotoUrl) {
      await destroyByCloudinaryUrl(existingProfile.profilePhotoUrl, 'image');
    }

    // Upload new profile photo
    const timestamp = Date.now();
    const fileExtension = (String(file.originalname || '').split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '');
    const uploadedPhoto = await uploadBufferToCloudinary({
      buffer: file.buffer,
      folder: 'jobportal/profile-photos',
      resourceType: 'image',
      publicId: `profile_${candidateId}_${timestamp}.${fileExtension}`,
      originalFilename: file.originalname,
      candidateId,
    });
    const fileUrl = uploadedPhoto.secure_url;

    // Update profile with new photo URL
    await prisma.candidateProfile.upsert({
      where: { candidateId: candidateId },
      update: {
        profilePhotoUrl: fileUrl,
        updatedAt: new Date(),
      },
      create: {
        candidateId: candidateId,
        fullName: candidate.email || 'User',
        email: candidate.email || '',
        profilePhotoUrl: fileUrl,
      },
    });

    console.log(`✅ DB updated with profilePhotoUrl for candidate: ${candidateId}`);
    console.log(`✅ Profile photo uploaded for candidate: ${candidateId}`);
    console.log(`☁️ Cloudinary profile photo URL: ${fileUrl}`);

    res.json({
      success: true,
      message: 'Profile photo uploaded successfully',
      data: {
        profilePhotoUrl: fileUrl,
      },
    });
  } catch (error) {
    console.error('Error uploading profile photo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload profile photo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Delete profile photo
 * DELETE /api/profile/photo/:candidateId
 */
async function deleteProfilePhoto(req, res) {
  try {
    const { candidateId } = req.params;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found',
      });
    }

    const existingProfile = await prisma.candidateProfile.findUnique({
      where: { candidateId },
      select: { profilePhotoUrl: true },
    });

    if (!existingProfile?.profilePhotoUrl) {
      return res.json({
        success: true,
        message: 'No profile photo to delete',
        data: { profilePhotoUrl: null },
      });
    }

    await destroyByCloudinaryUrl(existingProfile.profilePhotoUrl, 'image');

    await prisma.candidateProfile.update({
      where: { candidateId },
      data: {
        profilePhotoUrl: null,
        updatedAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Profile photo removed successfully',
      data: { profilePhotoUrl: null },
    });
  } catch (error) {
    console.error('Error deleting profile photo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete profile photo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

module.exports = {
  getProfileData,
  syncCommonDashboard,
  getProfileCompleteness,
  updatePersonalInfo,
  saveEducation,
  deleteEducation,
  saveWorkExperience,
  deleteWorkExperience,
  uploadWorkExperienceDocuments,
  uploadEducationDocuments,
  uploadAcademicAchievementDocuments,
  uploadCompetitiveExamDocuments,
  uploadCertificationDocuments,
  uploadAccomplishmentDocuments,
  uploadInternshipDocuments,
  uploadLanguageDocuments,
  uploadProjectDocuments,
  uploadVisaDocuments,
  saveSkills,
  deleteSkills,
  saveLanguages,
  deleteLanguages,
  updateCareerPreferences,
  saveSummary,
  generateSummaryWithAI,
  saveGapExplanation,
  deleteGapExplanation,
  saveInternship,
  deleteInternship,
  savePortfolioLinks,
  saveResume,
  inspectResumeFile,
  uploadResumeFile,
  saveProject,
  saveAcademicAchievement,
  saveCompetitiveExam,
  saveCertifications,
  saveAccomplishments,
  saveVisaWorkAuthorization,
  uploadVisaDocuments,
  saveVaccination,
  uploadVaccinationDocuments,
  deleteProject,
  deleteAcademicAchievement,
  deleteCompetitiveExam,
  deleteCertification,
  deleteAccomplishment,
  deleteVisaWorkAuthorization,
  deleteVaccination,
  deleteResume,
  deletePortfolioLinks,
  deleteCareerPreferences,
  uploadProfilePhoto,
  deleteProfilePhoto,
};
