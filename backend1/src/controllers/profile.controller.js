const { prisma, retryQuery } = require('../lib/prisma');
const { getMissingProfileSections } = require('../utils/profile-completeness.util');
const { uploadBufferToCloudinary, destroyByCloudinaryUrl } = require('../lib/cloudinary');

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

    // Get email - use actual email from resume if profile email is temporary
    let displayEmail = candidate.profile?.email || '';
    if (displayEmail && displayEmail.includes('@temp.local')) {
      // Try to get actual email from resumeJson
      if (candidate.resume?.resumeJson && typeof candidate.resume.resumeJson === 'object') {
        const resumeData = candidate.resume.resumeJson;
        if (resumeData.personalInformation && resumeData.personalInformation.email) {
          displayEmail = resumeData.personalInformation.email;
          console.log(`📧 Using actual email from resume: ${displayEmail}`);
        }
      }
    }

    // Format data for frontend
    const profileData = {
      personalInfo: candidate.profile ? {
        firstName: candidate.profile.fullName?.split(' ')[0] || '',
        middleName: candidate.profile.fullName?.split(' ').slice(1, -1).join(' ') || '',
        lastName: candidate.profile.fullName?.split(' ').slice(-1)[0] || '',
        email: displayEmail,
        profilePhotoUrl: candidate.profile.profilePhotoUrl || '',
        phone: candidate.profile.phoneNumber || (candidate.whatsappNumber ? candidate.whatsappNumber.replace(candidate.countryCode, '') : ''),
        phoneCode: mapPhoneCode(candidate.countryCode),
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
      gapExplanation: candidate.gapExplanation ? {
        gapCategory: candidate.gapExplanation.gapCategory || '',
        reasonForGap: candidate.gapExplanation.reasonForGap || '',
        gapDuration: candidate.gapExplanation.gapDuration || '',
        selectedSkills: candidate.gapExplanation.selectedSkills || [],
        coursesText: candidate.gapExplanation.coursesText || '',
        preferredSupport: candidate.gapExplanation.preferredSupport || {
          flexibleRole: false,
          hybridRemote: false,
          midLevelReEntry: false,
          skillRefresher: false,
        },
      } : null,
      internship: candidate.internship ? {
        internshipTitle: candidate.internship.internshipTitle || '',
        companyName: candidate.internship.companyName || '',
        internshipType: candidate.internship.internshipType || '',
        domainDepartment: candidate.internship.domainDepartment || '',
        startDate: candidate.internship.startDate ? new Date(candidate.internship.startDate).toISOString().split('T')[0] : '',
        endDate: candidate.internship.endDate ? new Date(candidate.internship.endDate).toISOString().split('T')[0] : '',
        currentlyWorking: candidate.internship.currentlyWorking || false,
        location: candidate.internship.location || '',
        workMode: candidate.internship.workMode || '',
        responsibilities: candidate.internship.responsibilities || '',
        learnings: candidate.internship.learnings || '',
        skills: candidate.internship.skills || [],
        documents: candidate.internship.documents || [],
      } : null,
      portfolioLinks: candidate.portfolioLinks ? {
        links: Array.isArray(candidate.portfolioLinks.links) ? candidate.portfolioLinks.links : [],
      } : null,
      education: candidate.educations.map(edu => ({
        id: edu.id,
        educationLevel: edu.educationLevel || '',
        degreeProgram: edu.degree || '',
        institutionName: edu.institution || '',
        fieldOfStudy: edu.specialization || '',
        startYear: edu.startYear?.toString() || '',
        endYear: edu.endYear?.toString() || '',
        currentlyStudying: edu.isOngoing || false,
        grade: edu.grade || '',
        modeOfStudy: edu.modeOfStudy || '',
        courseDuration: edu.courseDuration || '',
        documents: Array.isArray(edu.documents) ? edu.documents : [],
      })),
      workExperience: candidate.workExperiences.map(exp => ({
        id: exp.id,
        jobTitle: exp.jobTitle || '',
        companyName: exp.company || '',
        employmentType: exp.employmentType || '',
        industryDomain: exp.industry || '',
        numberOfReportees: exp.numberOfReportees || '',
        startDate: exp.startDate ? new Date(exp.startDate).toISOString().split('T')[0] : '',
        endDate: exp.endDate ? new Date(exp.endDate).toISOString().split('T')[0] : '',
        currentlyWorkHere: exp.isCurrentJob || false,
        workLocation: exp.workLocation || '',
        workMode: exp.workMode || '',
        companyProfile: exp.companyProfile || '',
        companyTurnover: exp.companyTurnover || '',
        keyResponsibilities: exp.responsibilities || '',
        achievements: exp.achievements || '',
        workSkills: exp.workSkills || [],
        documents: exp.documents || [],
      })),
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
        // Preferred Job Titles / Roles
        preferredJobTitles: candidate.careerPreferences.preferredRoles || [],
        preferredRoles: candidate.careerPreferences.preferredRoles || [],
        preferredIndustry: candidate.careerPreferences.preferredIndustry || '',
        functionalArea: candidate.careerPreferences.functionalArea || '',
        jobTypes: candidate.careerPreferences.jobTypes || [],
        // Work Mode
        workModes: candidate.careerPreferences.preferredWorkMode ? 
          [candidate.careerPreferences.preferredWorkMode === 'REMOTE' ? 'Remote' :
           candidate.careerPreferences.preferredWorkMode === 'ON_SITE' ? 'On-site' :
           candidate.careerPreferences.preferredWorkMode === 'HYBRID' ? 'Hybrid' : ''] : [],
        preferredWorkMode: candidate.careerPreferences.preferredWorkMode || '',
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
        // Passport Numbers
        passportNumbersByLocation: candidate.careerPreferences.passportNumbersByLocation || null,
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
      project: candidate.project ? {
        id: candidate.project.id,
        projectTitle: candidate.project.projectTitle || '',
        projectType: candidate.project.projectType || '',
        organizationClient: candidate.project.organizationClient || '',
        currentlyWorking: candidate.project.currentlyWorking || false,
        startDate: candidate.project.startDate ? new Date(candidate.project.startDate).toISOString().split('T')[0] : '',
        endDate: candidate.project.endDate ? new Date(candidate.project.endDate).toISOString().split('T')[0] : '',
        projectDescription: candidate.project.projectDescription || '',
        responsibilities: candidate.project.responsibilities || '',
        technologies: candidate.project.technologies || [],
        projectOutcome: candidate.project.projectOutcome || '',
        projectLink: candidate.project.projectLink || '',
        documents: Array.isArray(candidate.project.documents) ? candidate.project.documents : [],
      } : null,
      academicAchievement: candidate.academicAchievement ? {
        id: candidate.academicAchievement.id,
        achievementTitle: candidate.academicAchievement.achievementTitle || '',
        awardedBy: candidate.academicAchievement.awardedBy || '',
        yearReceived: candidate.academicAchievement.yearReceived || '',
        categoryType: candidate.academicAchievement.categoryType || '',
        description: candidate.academicAchievement.description || '',
        documents: Array.isArray(candidate.academicAchievement.documents) ? candidate.academicAchievement.documents : [],
      } : null,
      competitiveExam: candidate.competitiveExam ? {
        id: candidate.competitiveExam.id,
        examName: candidate.competitiveExam.examName || '',
        yearTaken: candidate.competitiveExam.yearTaken || '',
        resultStatus: candidate.competitiveExam.resultStatus || '',
        scoreMarks: candidate.competitiveExam.scoreMarks || '',
        scoreType: candidate.competitiveExam.scoreType || '',
        validUntil: candidate.competitiveExam.validUntil || '',
        additionalNotes: candidate.competitiveExam.additionalNotes || '',
        documents: Array.isArray(candidate.competitiveExam.documents) ? candidate.competitiveExam.documents : [],
      } : null,
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
        certificate: candidate.vaccination.certificate || undefined,
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
    const personalInfo = req.body;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    // Combine firstName, middleName, lastName into fullName
    const nameParts = [
      personalInfo.firstName,
      personalInfo.middleName,
      personalInfo.lastName,
    ].filter(Boolean);
    const fullName = nameParts.join(' ') || '';

    // Format date of birth
    let dateOfBirth = null;
    if (personalInfo.dob) {
      dateOfBirth = parseDateString(personalInfo.dob);
    }

    // Map employment status
    let employmentStatus = null;
    if (personalInfo.employment) {
      const employmentMap = {
        'Employed': 'EMPLOYED',
        'Unemployed': 'UNEMPLOYED',
        'Freelancing': 'FREELANCING',
        'Student': 'STUDENT',
        'Other': 'OTHER',
      };
      employmentStatus = employmentMap[personalInfo.employment] || null;
    }

    // Map gender
    let gender = null;
    if (personalInfo.gender) {
      const genderMap = {
        'Male': 'MALE',
        'Female': 'FEMALE',
        'Other': 'OTHER',
      };
      gender = genderMap[personalInfo.gender] || null;
    }

    const normalizedEmail = String(personalInfo.email || '').trim().toLowerCase();
    const existingProfile = await prisma.candidateProfile.findUnique({
      where: { candidateId },
      select: { email: true },
    });
    let emailToPersist = normalizedEmail;
    if (normalizedEmail) {
      const emailOwner = await prisma.candidateProfile.findFirst({
        where: { email: normalizedEmail },
        select: { candidateId: true },
      });
      const isOwnedByDifferentCandidate =
        Boolean(emailOwner?.candidateId) && emailOwner.candidateId !== candidateId;
      if (isOwnedByDifferentCandidate) {
        emailToPersist = existingProfile?.email || `${candidateId}@temp.local`;
      }
    }

    // Upsert candidate profile
    await prisma.candidateProfile.upsert({
      where: { candidateId },
      update: {
        fullName,
        email: emailToPersist || '',
        phoneNumber: personalInfo.phone || null,
        gender: gender || undefined,
        dateOfBirth: dateOfBirth || undefined,
        country: personalInfo.country || null,
        city: personalInfo.city || null,
        address: personalInfo.address || null,
        nationality: personalInfo.nationality || null,
        passportNumber: personalInfo.passportNumber || null,
        linkedinUrl: personalInfo.linkedinUrl || null,
        employmentStatus: employmentStatus || undefined,
      },
      create: {
        candidateId,
        fullName,
        email: emailToPersist || '',
        phoneNumber: personalInfo.phone || null,
        gender: gender || undefined,
        dateOfBirth: dateOfBirth || undefined,
        country: personalInfo.country || null,
        city: personalInfo.city || null,
        address: personalInfo.address || null,
        nationality: personalInfo.nationality || null,
        passportNumber: personalInfo.passportNumber || null,
        linkedinUrl: personalInfo.linkedinUrl || null,
        employmentStatus: employmentStatus || undefined,
      },
    });

    // Mirror countryCode back to Candidate model for derived UI mapping
    if (personalInfo.phoneCode) {
      const dialCode = personalInfo.phoneCode.split(' ')[0];
      try {
        await prisma.candidate.update({
          where: { id: candidateId },
          data: { countryCode: dialCode },
        });
      } catch (e) {
        console.warn('Silent fail: candidate countryCode mirror update failed', e.message);
      }
    }

    // Prepare log data (only show actual saved values, not duplicates)
    const logData = {
      name: {
        first: personalInfo.firstName || '',
        middle: personalInfo.middleName || '',
        last: personalInfo.lastName || '',
        full: fullName,
      },
      contact: {
        email: personalInfo.email || '',
        phone: personalInfo.phone || null,
        phoneCode: personalInfo.phoneCode || null,
      },
      personal: {
        gender: gender || null,
        dateOfBirth: dateOfBirth ? dateOfBirth.toISOString().split('T')[0] : null,
        employmentStatus: employmentStatus || null,
      },
      location: {
        country: personalInfo.country || null,
        city: personalInfo.city || null,
        address: personalInfo.address || null,
        nationality: personalInfo.nationality || null,
      },
      additional: {
        passportNumber: personalInfo.passportNumber || null,
        linkedinUrl: personalInfo.linkedinUrl || null,
      },
    };
    
    logProfileSave('Personal Information', 'upserted', candidateId, logData);

    res.json({
      success: true,
      message: 'Personal information updated successfully',
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
      endYear: education.endYear ? parseInt(education.endYear) : null,
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
      endYear: educationData.endYear || null,
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

    // Map workMode to enum if provided (handle various formats)
    let workMode = null;
    if (experience.workMode) {
      const workModeValue = String(experience.workMode).trim().toLowerCase();
      const workModeMap = {
        // Frontend lowercase values (from select options)
        'remote': 'REMOTE',
        'hybrid': 'HYBRID',
        'onsite': 'ON_SITE',
        'on-site': 'ON_SITE',
        'on site': 'ON_SITE',
        // Backend enum values (already correct, normalized to lowercase)
        'on_site': 'ON_SITE',
      };
      workMode = workModeMap[workModeValue] || null;
      if (!workMode) {
        console.warn(`Unknown workMode value: "${experience.workMode}" (normalized: "${workModeValue}")`);
      }
    }

    // Map employmentType to enum if provided (handle various formats)
    let employmentType = null;
    if (experience.employmentType) {
      const employmentTypeValue = String(experience.employmentType).trim();
      const employmentTypeMap = {
        // Frontend lowercase values (from select options)
        'full-time': 'FULL_TIME',
        'part-time': 'PART_TIME',
        'contract': 'CONTRACT',
        'internship': 'INTERNSHIP',
        'freelance': 'FREELANCE',
        // Frontend capitalized values
        'Full-time': 'FULL_TIME',
        'Full time': 'FULL_TIME',
        'Part-time': 'PART_TIME',
        'Part time': 'PART_TIME',
        'Contract': 'CONTRACT',
        'Internship': 'INTERNSHIP',
        'Freelance': 'FREELANCE',
        // Backend enum values (already correct)
        'FULL_TIME': 'FULL_TIME',
        'PART_TIME': 'PART_TIME',
        'CONTRACT': 'CONTRACT',
        'INTERNSHIP': 'INTERNSHIP',
        'FREELANCE': 'FREELANCE',
      };
      employmentType = employmentTypeMap[employmentTypeValue] || null;
      if (!employmentType) {
        console.warn(`Unknown employmentType value: "${employmentTypeValue}"`);
      }
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
      workMode: workMode || undefined,
      startDate: new Date(experience.startDate),
      endDate: experience.endDate ? new Date(experience.endDate) : null,
      isCurrentJob: experience.currentlyWorkHere || false,
      responsibilities: experience.keyResponsibilities?.trim() || null,
      industry: experience.industryDomain?.trim() || null,
      employmentType: employmentType || undefined,
      numberOfReportees: experience.numberOfReportees?.trim() || null,
      companyProfile: experience.companyProfile?.trim() || null,
      companyTurnover: experience.companyTurnover?.trim() || null,
      achievements: experience.achievements?.trim() || null,
      workSkills: Array.isArray(experience.workSkills) ? experience.workSkills.filter(skill => skill && skill.trim()) : [],
      documents: Array.isArray(experience.documents) 
        ? experience.documents.map(doc => typeof doc === 'string' ? doc : doc.url || doc.name).filter(Boolean)
        : [],
    };

    // Debug log to see what we're receiving and mapping
    console.log('📥 Received work experience data:', {
      employmentType: experience.employmentType,
      mappedEmploymentType: employmentType,
      workMode: experience.workMode,
      mappedWorkMode: workMode,
    });

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
        data: {
          id: created.id,
          ...created,
        },
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

    // Map work mode - take first selected work mode
    let preferredWorkMode = null;
    if (preferences.workModes && preferences.workModes.length > 0) {
      const workModeMap = {
        'Remote': 'REMOTE',
        'On-site': 'ON_SITE',
        'Hybrid': 'HYBRID',
      };
      preferredWorkMode = workModeMap[preferences.workModes[0]] || null;
    }

    // Map salary type
    let preferredSalaryType = null;
    if (preferences.salaryFrequency) {
      const salaryTypeMap = {
        'Annually': 'ANNUAL',
        'Monthly': 'MONTHLY',
        'Hourly': 'HOURLY',
        'Daily': 'DAILY',
      };
      preferredSalaryType = salaryTypeMap[preferences.salaryFrequency] || null;
    }

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

    await prisma.careerPreferences.upsert({
      where: { candidateId },
      update: {
        // Role & Domain
        preferredRoles: preferences.preferredJobTitles || [],
        preferredIndustry: preferences.preferredIndustry || null,
        functionalArea: preferences.functionalArea || null,
        
        // Job Type & Work Mode
        jobTypes: preferences.jobTypes || [],
        preferredWorkMode: preferredWorkMode || undefined,
        
        // Location
        preferredLocations: preferences.preferredLocations || [],
        relocationPreference: preferences.relocationPreference || null,
        
        // Salary
        preferredSalary: preferences.salaryAmount ? parseFloat(preferences.salaryAmount) : null,
        preferredSalaryType: preferredSalaryType || undefined,
        preferredCurrency: preferences.salaryCurrency || 'USD',
        
        // Availability
        availabilityToStart: preferences.availabilityToStart || null,
        noticePeriod: preferences.noticePeriod || null,
        noticePeriodDays: noticePeriodDays,
        openToRelocation: preferences.relocationPreference === 'Open to Relocate' || preferences.relocationPreference === 'Open to Remote Only',
        
        // Passport numbers by location
        ...(preferences.passportNumbersByLocation !== undefined && { passportNumbersByLocation: preferences.passportNumbersByLocation }),
      },
      create: {
        candidateId,
        // Role & Domain
        preferredRoles: preferences.preferredJobTitles || [],
        preferredIndustry: preferences.preferredIndustry || null,
        functionalArea: preferences.functionalArea || null,
        
        // Job Type & Work Mode
        jobTypes: preferences.jobTypes || [],
        preferredWorkMode: preferredWorkMode || undefined,
        
        // Location
        preferredLocations: preferences.preferredLocations || [],
        relocationPreference: preferences.relocationPreference || null,
        
        // Salary
        preferredSalary: preferences.salaryAmount ? parseFloat(preferences.salaryAmount) : null,
        preferredSalaryType: preferredSalaryType || undefined,
        preferredCurrency: preferences.salaryCurrency || 'USD',
        
        // Availability
        availabilityToStart: preferences.availabilityToStart || null,
        noticePeriod: preferences.noticePeriod || null,
        noticePeriodDays: noticePeriodDays,
        openToRelocation: preferences.relocationPreference === 'Open to Relocate' || preferences.relocationPreference === 'Open to Remote Only',
        
        // Passport numbers by location
        ...(preferences.passportNumbersByLocation !== undefined && { passportNumbersByLocation: preferences.passportNumbersByLocation }),
      },
    });

    // Prepare detailed log data
    const logData = {
      // Role & Domain
      preferredRoles: preferences.preferredJobTitles || [],
      preferredRolesCount: Array.isArray(preferences.preferredJobTitles) ? preferences.preferredJobTitles.length : 0,
      preferredIndustry: preferences.preferredIndustry || null,
      functionalArea: preferences.functionalArea || null,
      
      // Job Type & Work Mode
      jobTypes: preferences.jobTypes || [],
      jobTypesCount: Array.isArray(preferences.jobTypes) ? preferences.jobTypes.length : 0,
      preferredWorkMode: preferredWorkMode || null,
      
      // Location
      preferredLocations: preferences.preferredLocations || [],
      preferredLocationsCount: Array.isArray(preferences.preferredLocations) ? preferences.preferredLocations.length : 0,
      relocationPreference: preferences.relocationPreference || null,
      
      // Salary
      preferredSalary: preferences.salaryAmount ? parseFloat(preferences.salaryAmount) : null,
      preferredSalaryType: preferredSalaryType || null,
      preferredCurrency: preferences.salaryCurrency || 'USD',
      
      // Availability
      availabilityToStart: preferences.availabilityToStart || null,
      noticePeriod: preferences.noticePeriod || null,
      noticePeriodDays: noticePeriodDays,
      openToRelocation: preferences.relocationPreference === 'Open to Relocate' || preferences.relocationPreference === 'Open to Remote Only',
    };

    logProfileSave('Career Preferences', 'upserted', candidateId, logData);

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

    // Generate summary using OpenAI first, fallback to Mistral
    const { Mistral } = require('@mistralai/mistralai');
    const OpenAI = require('openai');
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
    
    if (!OPENAI_API_KEY && !MISTRAL_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'AI service not configured',
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

      // OpenAI first
      if (OPENAI_API_KEY) {
        try {
          const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 200,
            temperature: 0.7,
          });
          generatedSummary =
            completion?.choices?.[0]?.message?.content?.trim() || '';
        } catch (openaiError) {
          console.error('❌ OpenAI AI error:', openaiError.message || openaiError);
        }
      }

      // Fallback to Mistral
      if (!generatedSummary && MISTRAL_API_KEY) {
        const mistral = new Mistral({ apiKey: MISTRAL_API_KEY });
        const chatResponse = await mistral.chat.complete({
          model: 'mistral-medium-latest',
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          maxTokens: 200,
          temperature: 0.7,
        });

        if (chatResponse && chatResponse.choices && chatResponse.choices.length > 0) {
          generatedSummary = chatResponse.choices[0].message?.content?.trim() || '';
        }
        
        // Fallback: try to get content from response directly
        if (!generatedSummary && chatResponse) {
          if (typeof chatResponse === 'string') {
            generatedSummary = chatResponse.trim();
          } else if (chatResponse.content) {
            generatedSummary = chatResponse.content.trim();
          }
        }
      }
      
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

    await prisma.candidateGapExplanation.upsert({
      where: { candidateId },
      update: {
        gapCategory: data.gapCategory || '',
        reasonForGap: data.reasonForGap || '',
        gapDuration: data.gapDuration || '',
        selectedSkills: Array.isArray(data.selectedSkills) ? data.selectedSkills : [],
        coursesText: data.coursesText || null,
        preferredSupport: sanitizeJsonValue(data.preferredSupport),
      },
      create: {
        candidateId,
        gapCategory: data.gapCategory || '',
        reasonForGap: data.reasonForGap || '',
        gapDuration: data.gapDuration || '',
        selectedSkills: Array.isArray(data.selectedSkills) ? data.selectedSkills : [],
        coursesText: data.coursesText || null,
        preferredSupport: sanitizeJsonValue(data.preferredSupport),
      },
    });

    // Prepare detailed log data
    const logData = {
      gapCategory: data.gapCategory || '',
      reasonForGap: data.reasonForGap || '',
      gapDuration: data.gapDuration || '',
      selectedSkills: Array.isArray(data.selectedSkills) ? data.selectedSkills : [],
      selectedSkillsCount: Array.isArray(data.selectedSkills) ? data.selectedSkills.length : 0,
      coursesText: data.coursesText ? (data.coursesText.length > 100 ? data.coursesText.substring(0, 100) + '...' : data.coursesText) : null,
      preferredSupport: data.preferredSupport ? {
        flexibleRole: data.preferredSupport.flexibleRole || false,
        hybridRemote: data.preferredSupport.hybridRemote || false,
        midLevelReEntry: data.preferredSupport.midLevelReEntry || false,
        skillRefresher: data.preferredSupport.skillRefresher || false,
      } : null,
    };

    logProfileSave('Gap Explanation', 'upserted', candidateId, logData);
    res.json({ success: true, message: 'Gap explanation saved successfully' });
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

    // Delete the gap explanation
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

    await prisma.candidateInternship.upsert({
      where: { candidateId },
      update: {
        internshipTitle: data.internshipTitle || '',
        companyName: data.companyName || '',
        internshipType: data.internshipType || null,
        domainDepartment: data.domainDepartment || null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        currentlyWorking: data.currentlyWorking || false,
        location: data.location || null,
        workMode: data.workMode || null,
        responsibilities: data.responsibilities || null,
        learnings: data.learnings || null,
        skills: Array.isArray(data.skills) ? data.skills : [],
        documents: Array.isArray(data.documents) ? data.documents : [],
      },
      create: {
        candidateId,
        internshipTitle: data.internshipTitle || '',
        companyName: data.companyName || '',
        internshipType: data.internshipType || null,
        domainDepartment: data.domainDepartment || null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        currentlyWorking: data.currentlyWorking || false,
        location: data.location || null,
        workMode: data.workMode || null,
        responsibilities: data.responsibilities || null,
        learnings: data.learnings || null,
        skills: Array.isArray(data.skills) ? data.skills : [],
        documents: Array.isArray(data.documents) ? data.documents : [],
      },
    });

    // Prepare detailed log data
    const logData = {
      internshipTitle: data.internshipTitle || '',
      companyName: data.companyName || '',
      internshipType: data.internshipType || null,
      domainDepartment: data.domainDepartment || null,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      currentlyWorking: data.currentlyWorking || false,
      location: data.location || null,
      workMode: data.workMode || null,
      responsibilities: data.responsibilities ? (data.responsibilities.length > 100 ? data.responsibilities.substring(0, 100) + '...' : data.responsibilities) : null,
      learnings: data.learnings ? (data.learnings.length > 100 ? data.learnings.substring(0, 100) + '...' : data.learnings) : null,
      skills: Array.isArray(data.skills) ? data.skills : [],
      skillsCount: Array.isArray(data.skills) ? data.skills.length : 0,
      documents: Array.isArray(data.documents) ? data.documents : [],
      documentsCount: Array.isArray(data.documents) ? data.documents.length : 0,
    };

    logProfileSave('Internship', 'upserted', candidateId, logData);
    res.json({ success: true, message: 'Internship saved successfully' });
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

    // Delete the internship
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
    const linksArray = Array.isArray(links) ? links : [];

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

    await prisma.candidateProject.upsert({
      where: { candidateId },
      update: {
        projectTitle: project.projectTitle || '',
        projectType: project.projectType || '',
        organizationClient: project.organizationClient || null,
        currentlyWorking: project.currentlyWorking || false,
        startDate: project.startDate ? new Date(project.startDate) : null,
        endDate: project.endDate ? new Date(project.endDate) : null,
        projectDescription: project.projectDescription || null,
        responsibilities: project.responsibilities || null,
        technologies: Array.isArray(project.technologies) ? project.technologies : [],
        projectOutcome: project.projectOutcome || null,
        projectLink: project.projectLink || null,
        documents: Array.isArray(project.documents) 
          ? project.documents.map(doc => typeof doc === 'string' ? doc : doc.url || doc.name).filter(Boolean)
          : [],
      },
      create: {
        candidateId,
        projectTitle: project.projectTitle || '',
        projectType: project.projectType || '',
        organizationClient: project.organizationClient || null,
        currentlyWorking: project.currentlyWorking || false,
        startDate: project.startDate ? new Date(project.startDate) : null,
        endDate: project.endDate ? new Date(project.endDate) : null,
        projectDescription: project.projectDescription || null,
        responsibilities: project.responsibilities || null,
        technologies: Array.isArray(project.technologies) ? project.technologies : [],
        projectOutcome: project.projectOutcome || null,
        projectLink: project.projectLink || null,
        documents: Array.isArray(project.documents) 
          ? project.documents.map(doc => typeof doc === 'string' ? doc : doc.url || doc.name).filter(Boolean)
          : [],
      },
    });

    // Prepare detailed log data
    const technologiesArray = Array.isArray(project.technologies) ? project.technologies : [];
    const logData = {
      projectTitle: project.projectTitle || '',
      projectType: project.projectType || '',
      organizationClient: project.organizationClient || null,
      currentlyWorking: project.currentlyWorking || false,
      startDate: project.startDate || null,
      endDate: project.endDate || null,
      projectDescription: project.projectDescription ? (project.projectDescription.length > 100 ? project.projectDescription.substring(0, 100) + '...' : project.projectDescription) : null,
      responsibilities: project.responsibilities ? (project.responsibilities.length > 100 ? project.responsibilities.substring(0, 100) + '...' : project.responsibilities) : null,
      technologies: technologiesArray,
      technologiesCount: technologiesArray.length,
      projectOutcome: project.projectOutcome ? (project.projectOutcome.length > 100 ? project.projectOutcome.substring(0, 100) + '...' : project.projectOutcome) : null,
      projectLink: project.projectLink || null,
      documentsCount: Array.isArray(project.documents) ? project.documents.length : 0,
    };
    
    // Log technologies separately for debugging
    console.log('📦 Technologies received:', JSON.stringify(technologiesArray, null, 2));

    logProfileSave('Project', 'upserted', candidateId, logData);

    res.json({ success: true, message: 'Project saved successfully' });
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

    await prisma.candidateAcademicAchievement.upsert({
      where: { candidateId },
      update: {
        achievementTitle: achievement.achievementTitle || '',
        awardedBy: achievement.awardedBy || '',
        yearReceived: achievement.yearReceived || '',
        categoryType: achievement.categoryType || null,
        description: achievement.description || null,
        documents: Array.isArray(achievement.documents) 
          ? achievement.documents.map(doc => typeof doc === 'string' ? doc : doc.url || doc.name).filter(Boolean)
          : [],
      },
      create: {
        candidateId,
        achievementTitle: achievement.achievementTitle || '',
        awardedBy: achievement.awardedBy || '',
        yearReceived: achievement.yearReceived || '',
        categoryType: achievement.categoryType || null,
        description: achievement.description || null,
        documents: Array.isArray(achievement.documents) 
          ? achievement.documents.map(doc => typeof doc === 'string' ? doc : doc.url || doc.name).filter(Boolean)
          : [],
      },
    });

    // Prepare detailed log data
    const logData = {
      achievementTitle: achievement.achievementTitle || '',
      awardedBy: achievement.awardedBy || '',
      yearReceived: achievement.yearReceived || '',
      categoryType: achievement.categoryType || null,
      description: achievement.description ? (achievement.description.length > 100 ? achievement.description.substring(0, 100) + '...' : achievement.description) : null,
      documentsCount: Array.isArray(achievement.documents) ? achievement.documents.length : 0,
    };

    logProfileSave('Academic Achievement', 'upserted', candidateId, logData);

    res.json({ success: true, message: 'Academic achievement saved successfully' });
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

    await prisma.candidateCompetitiveExam.upsert({
      where: { candidateId },
      update: {
        examName: exam.examName || '',
        yearTaken: exam.yearTaken || '',
        resultStatus: exam.resultStatus || '',
        scoreMarks: exam.scoreMarks || null,
        scoreType: exam.scoreType || null,
        validUntil: exam.validUntil || null,
        additionalNotes: exam.additionalNotes || null,
        documents: Array.isArray(exam.documents) 
          ? exam.documents.map(doc => typeof doc === 'string' ? doc : doc.url || doc.name).filter(Boolean)
          : [],
      },
      create: {
        candidateId,
        examName: exam.examName || '',
        yearTaken: exam.yearTaken || '',
        resultStatus: exam.resultStatus || '',
        scoreMarks: exam.scoreMarks || null,
        scoreType: exam.scoreType || null,
        validUntil: exam.validUntil || null,
        additionalNotes: exam.additionalNotes || null,
        documents: Array.isArray(exam.documents) 
          ? exam.documents.map(doc => typeof doc === 'string' ? doc : doc.url || doc.name).filter(Boolean)
          : [],
      },
    });

    // Prepare detailed log data
    const logData = {
      examName: exam.examName || '',
      yearTaken: exam.yearTaken || '',
      resultStatus: exam.resultStatus || '',
      scoreMarks: exam.scoreMarks || null,
      scoreType: exam.scoreType || null,
      validUntil: exam.validUntil || null,
      additionalNotes: exam.additionalNotes ? (exam.additionalNotes.length > 100 ? exam.additionalNotes.substring(0, 100) + '...' : exam.additionalNotes) : null,
      documentsCount: Array.isArray(exam.documents) ? exam.documents.length : 0,
    };

    logProfileSave('Competitive Exam', 'upserted', candidateId, logData);

    res.json({ success: true, message: 'Competitive exam saved successfully' });
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

    // Process visaDetailsExpected documents - convert File objects to URLs if needed
    let processedVisaDetailsExpected = visa.visaDetailsExpected;
    if (processedVisaDetailsExpected && processedVisaDetailsExpected.documents) {
      processedVisaDetailsExpected = {
        ...processedVisaDetailsExpected,
        documents: processedVisaDetailsExpected.documents.map((doc) => {
          // If it's already a URL string, keep it; otherwise it should be a URL from upload
          if (typeof doc === 'string') {
            return doc;
          }
          return doc.url || doc.file || doc;
        }),
      };
    }

    // Process visaEntries documents
    let processedVisaEntries = visa.visaEntries;
    if (Array.isArray(processedVisaEntries)) {
      processedVisaEntries = processedVisaEntries.map((entry) => {
        if (entry.visaDetails && entry.visaDetails.documents) {
          return {
            ...entry,
            visaDetails: {
              ...entry.visaDetails,
              documents: entry.visaDetails.documents.map((doc) => {
                if (typeof doc === 'string') {
                  return doc;
                }
                return doc.url || doc.file || doc;
              }),
            },
          };
        }
        return entry;
      });
    }

    await prisma.candidateVisaWorkAuthorization.upsert({
      where: { candidateId },
      update: {
        selectedDestination: visa.selectedDestination || null,
        visaDetailsInitial: sanitizeJsonValue(visa.visaDetailsInitial),
        visaDetailsExpected: sanitizeJsonValue(processedVisaDetailsExpected),
        visaWorkpermitRequired: visa.visaWorkpermitRequired || null,
        openForAll: visa.openForAll || false,
        additionalRemarks: visa.additionalRemarks || null,
        visaEntries: sanitizeJsonValue(processedVisaEntries || []),
      },
      create: {
        candidateId,
        selectedDestination: visa.selectedDestination || null,
        visaDetailsInitial: sanitizeJsonValue(visa.visaDetailsInitial),
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

    // Process certificate - convert File object to URL if needed
    let certificateUrl = null;
    if (vaccination.certificate) {
      if (typeof vaccination.certificate === 'string') {
        certificateUrl = vaccination.certificate;
      } else if (vaccination.certificate.url) {
        certificateUrl = vaccination.certificate.url;
      } else if (vaccination.certificate instanceof File || vaccination.certificate.name) {
        // This should have been uploaded already, but handle it gracefully
        certificateUrl = typeof vaccination.certificate === 'string' ? vaccination.certificate : null;
      }
    }

    await prisma.candidateVaccination.upsert({
      where: { candidateId },
      update: {
        vaccinationStatus: vaccination.vaccinationStatus || '',
        vaccineType: vaccination.vaccineType || null,
        lastVaccinationDate: vaccination.lastVaccinationDate || null,
        certificate: certificateUrl,
      },
      create: {
        candidateId,
        vaccinationStatus: vaccination.vaccinationStatus || '',
        vaccineType: vaccination.vaccineType || null,
        lastVaccinationDate: vaccination.lastVaccinationDate || null,
        certificate: certificateUrl,
      },
    });

    // Prepare detailed log data
    const logData = {
      vaccinationStatus: vaccination.vaccinationStatus || '',
      vaccineType: vaccination.vaccineType || null,
      lastVaccinationDate: vaccination.lastVaccinationDate || null,
      hasCertificate: !!certificateUrl,
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
    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'Candidate ID is required' });
    }
    const existing = await prisma.candidateProject.findUnique({ where: { candidateId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Project not found' });
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
    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'Candidate ID is required' });
    }
    const existing = await prisma.candidateAcademicAchievement.findUnique({ where: { candidateId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Academic achievement not found' });
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
    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'Candidate ID is required' });
    }
    const existing = await prisma.candidateCompetitiveExam.findUnique({ where: { candidateId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Competitive exam not found' });
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
    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'Candidate ID is required' });
    }
    const existing = await prisma.candidateVisaWorkAuthorization.findUnique({ where: { candidateId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Visa work authorization not found' });
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
    if (!candidateId) {
      return res.status(400).json({ success: false, message: 'Candidate ID is required' });
    }
    const existing = await prisma.candidatePortfolioLinks.findUnique({ where: { candidateId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Portfolio links not found' });
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

module.exports = {
  getProfileData,
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
};
