const { prisma } = require('../lib/prisma');

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
      whatsappNumber: candidate.whatsappNumber,
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
 * Delete candidate by ID
 * DELETE /api/candidates/:id
 */
async function deleteCandidate(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    // Check if candidate exists
    const candidate = await prisma.candidate.findUnique({
      where: { id: id },
    });

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found',
      });
    }

    // Delete candidate (cascade will handle related records)
    await prisma.candidate.delete({
      where: { id: id },
    });

    res.json({
      success: true,
      message: 'Candidate deleted successfully',
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

module.exports = {
  getAllCandidates,
  getCandidateById,
  deleteCandidate,
};
