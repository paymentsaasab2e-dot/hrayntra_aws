const { prisma } = require('../lib/prisma');
const { parseResumeFromBuffer } = require('../services/resume-parser.service');
const { convertToLaTeX } = require('../services/cv-parser.service');
const { Proficiency } = require('@prisma/client');
const { uploadBufferToCloudinary } = require('../lib/cloudinary');

function normalizeGender(value) {
  if (!value) return null;
  const key = String(value).trim().toUpperCase();
  const map = {
    MALE: 'MALE',
    FEMALE: 'FEMALE',
    OTHER: 'OTHER',
    M: 'MALE',
    F: 'FEMALE',
  };
  return map[key] || null;
}

function normalizeMaritalStatus(value) {
  if (!value) return null;
  const key = String(value).trim().toUpperCase();
  const map = {
    SINGLE: 'SINGLE',
    UNMARRIED: 'SINGLE',
    MARRIED: 'MARRIED',
    DIVORCED: 'DIVORCED',
    WIDOWED: 'WIDOWED',
  };
  return map[key] || null;
}

/**
 * Upload and process CV
 * POST /api/cv/upload
 */
async function uploadCV(req, res) {
  try {
    const { candidateId } = req.body;
    const file = req.file;

    // Validation
    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'CV file is required',
      });
    }

    // Validate file type
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/jpg',
      'image/png',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only PDF, DOC, DOCX, JPG, and PNG files are allowed.',
      });
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: 'File size exceeds 5MB limit',
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

    console.log('\n' + '='.repeat(80));
    console.log('📄 CV UPLOAD & PARSING STARTED');
    console.log('='.repeat(80));
    console.log('Candidate ID:', candidateId);
    console.log('File Name:', file.originalname);
    console.log('File Size:', (file.size / 1024).toFixed(2), 'KB');
    console.log('File Type:', file.mimetype);
    console.log('-'.repeat(80));

    // Complete Resume Parsing Pipeline (Steps 1-10)
    const parsedData = await parseResumeFromBuffer(file.buffer, file.mimetype, file.originalname);
    console.log('✅ Resume parsing pipeline completed!\n');
    
    // Extract portfolio URLs from resume text (PDF only here to avoid parser crashes on DOC/DOCX/images)
    let resumeText = '';
    if (file.mimetype === 'application/pdf') {
      try {
        const pdfParse = require('pdf-parse');
        const pdfData = await pdfParse(file.buffer);
        resumeText = pdfData.text || '';
      } catch (pdfError) {
        console.warn('⚠️ Could not parse PDF text for portfolio URL extraction:', pdfError.message);
      }
    }
    
    // Import extractPortfolioUrls function
    const { extractPortfolioUrls } = require('../services/resume-parser.service');
    const portfolioUrls = resumeText ? extractPortfolioUrls(resumeText) : [];
    
    if (portfolioUrls.length > 0) {
      console.log('\n🔗 PORTFOLIO LINKS FOUND (' + portfolioUrls.length + '):');
      console.log('-'.repeat(80));
      portfolioUrls.forEach((link, index) => {
        console.log(`  ${index + 1}. ${link.linkType}: ${link.url}`);
      });
      
      // Store portfolio links in database
      const linksWithIds = portfolioUrls.map((link, index) => ({
        id: `link-${Date.now()}-${index}`,
        linkType: link.linkType,
        url: link.url,
        title: link.title,
        description: link.description,
      }));
      
      await prisma.candidatePortfolioLinks.upsert({
        where: { candidateId: candidateId },
        update: {
          links: linksWithIds,
          updatedAt: new Date(),
        },
        create: {
          candidateId: candidateId,
          links: linksWithIds,
        },
      });
      console.log('✅ Portfolio links stored in database');
    }
    
    // Display extracted data in terminal
    console.log('='.repeat(80));
    console.log('📊 EXTRACTED RESUME DATA');
    console.log('='.repeat(80));
    
    // Personal Information
    if (parsedData.personalInformation) {
      console.log('\n👤 PERSONAL INFORMATION:');
      console.log('-'.repeat(80));
      const pi = parsedData.personalInformation;
      if (pi.fullName) console.log('  Name:', pi.fullName);
      if (pi.email) console.log('  Email:', pi.email);
      if (pi.phoneNumber) console.log('  Phone:', pi.phoneNumber);
      if (pi.alternatePhoneNumber) console.log('  Alternate Phone:', pi.alternatePhoneNumber);
      if (pi.address) console.log('  Address:', pi.address);
      if (pi.city) console.log('  City:', pi.city);
      if (pi.country) console.log('  Country:', pi.country);
      if (pi.linkedinProfile) console.log('  LinkedIn:', pi.linkedinProfile);
      if (pi.gender) console.log('  Gender:', pi.gender);
      if (pi.dateOfBirth) console.log('  Date of Birth:', pi.dateOfBirth);
      if (pi.nationality) console.log('  Nationality:', pi.nationality);
    }
    
    // Education
    if (parsedData.education && parsedData.education.length > 0) {
      console.log('\n🎓 EDUCATION (' + parsedData.education.length + ' entries):');
      console.log('-'.repeat(80));
      parsedData.education.forEach((edu, index) => {
        console.log(`  ${index + 1}. ${edu.degree || 'N/A'}`);
        if (edu.institution) console.log('     Institution:', edu.institution);
        if (edu.specialization) console.log('     Specialization:', edu.specialization);
        if (edu.startYear) console.log('     Start Year:', edu.startYear);
        if (edu.endYear) console.log('     End Year:', edu.endYear);
        console.log('');
      });
    }
    
    // Work Experience
    if (parsedData.workExperience && parsedData.workExperience.length > 0) {
      console.log('\n💼 WORK EXPERIENCE (' + parsedData.workExperience.length + ' entries):');
      console.log('-'.repeat(80));
      parsedData.workExperience.forEach((exp, index) => {
        console.log(`  ${index + 1}. ${exp.jobTitle || 'N/A'} at ${exp.company || 'N/A'}`);
        if (exp.workLocation) console.log('     Location:', exp.workLocation);
        if (exp.startDate) console.log('     Start Date:', exp.startDate);
        if (exp.endDate) {
          console.log('     End Date:', exp.endDate);
        } else if (exp.currentlyWorking) {
          console.log('     End Date: Present (Currently Working)');
        }
        if (exp.responsibilities) {
          const responsibilities = exp.responsibilities.substring(0, 200);
          console.log('     Responsibilities:', responsibilities + (exp.responsibilities.length > 200 ? '...' : ''));
        }
        console.log('');
      });
    }
    
    // Skills
    if (parsedData.skills && parsedData.skills.length > 0) {
      const technicalSkills = parsedData.skills.filter(s => {
        const langNames = ['English', 'Spanish', 'French', 'German', 'Hindi', 'Chinese', 'Japanese', 'Arabic'];
        return !langNames.includes(s.languageName);
      });
      const languages = parsedData.skills.filter(s => {
        const langNames = ['English', 'Spanish', 'French', 'German', 'Hindi', 'Chinese', 'Japanese', 'Arabic'];
        return langNames.includes(s.languageName);
      });
      
      if (technicalSkills.length > 0) {
        console.log('\n🛠️  TECHNICAL SKILLS (' + technicalSkills.length + '):');
        console.log('-'.repeat(80));
        const skillNames = technicalSkills.map(s => s.languageName).join(', ');
        console.log('  ' + skillNames);
      }
      
      if (languages.length > 0) {
        console.log('\n🌐 LANGUAGES (' + languages.length + '):');
        console.log('-'.repeat(80));
        languages.forEach((lang, index) => {
          console.log(`  ${index + 1}. ${lang.languageName} - ${lang.proficiency}`);
          const abilities = [];
          if (lang.speak) abilities.push('Speak');
          if (lang.read) abilities.push('Read');
          if (lang.write) abilities.push('Write');
          if (abilities.length > 0) console.log('     Abilities:', abilities.join(', '));
        });
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📈 EXTRACTION SUMMARY:');
    console.log('-'.repeat(80));
    console.log('  Personal Info:', parsedData.personalInformation ? '✅ Found' : '❌ Not found');
    console.log('  Education Entries:', parsedData.education?.length || 0);
    console.log('  Work Experience Entries:', parsedData.workExperience?.length || 0);
    console.log('  Total Skills:', parsedData.skills?.length || 0);
    console.log('='.repeat(80) + '\n');
    
    // Separate technical skills from languages (used for both LaTeX and database storage)
    const langNames = ['English', 'Spanish', 'French', 'German', 'Hindi', 'Chinese', 'Japanese', 'Arabic', 'Portuguese', 'Russian'];
    const technicalSkills = parsedData.skills ? parsedData.skills.filter(skill => {
      return !langNames.includes(skill.languageName);
    }) : [];
    
    const languages = parsedData.skills ? parsedData.skills.filter(skill => {
      return langNames.includes(skill.languageName);
    }) : [];
    
    // Transform to cvData format for LaTeX conversion
    const cvData = {
      personalInfo: parsedData.personalInformation,
      education: parsedData.education,
      workExperience: parsedData.workExperience,
      skills: technicalSkills.map(s => ({
        name: s.languageName,
        category: null,
        proficiency: s.proficiency,
        yearsOfExp: null,
      })),
      languages: languages,
      summary: parsedData.summary || null,
    };

    // Convert to LaTeX
    const latexContent = convertToLaTeX(cvData);
    console.log('LaTeX conversion completed');

    const timestamp = Date.now();
    const sanitizedOriginalName = String(file.originalname || 'cv').replace(/[^a-zA-Z0-9._-]/g, '_');
    const cvUpload = await uploadBufferToCloudinary({
      buffer: file.buffer,
      folder: 'jobportal/cv-files',
      resourceType: 'raw',
      publicId: `${candidateId}_${timestamp}_${sanitizedOriginalName}`,
      originalFilename: file.originalname,
    });

    // Save generated LaTeX in cloud storage too
    const latexUpload = await uploadBufferToCloudinary({
      buffer: Buffer.from(latexContent, 'utf8'),
      folder: 'jobportal/cv-latex',
      resourceType: 'raw',
      publicId: `${candidateId}_${timestamp}_cv_tex`,
      originalFilename: `${candidateId}_cv.tex`,
    });

    // Store or update Resume record
    // Store the parsed data including actual email in resumeJson
    const resumeJsonData = {
      personalInformation: parsedData.personalInformation || null,
      education: parsedData.education || [],
      workExperience: parsedData.workExperience || [],
      skills: parsedData.skills || [],
      languages: parsedData.languages || [],
      extractedAt: new Date().toISOString(),
    };

    const resume = await prisma.resume.upsert({
      where: { candidateId: candidateId },
      update: {
        fileName: file.originalname,
        fileUrl: cvUpload.secure_url,
        fileSize: file.size,
        mimeType: file.mimetype,
        aiAnalyzed: true,
        resumeJson: resumeJsonData,
        updatedAt: new Date(),
      },
      create: {
        candidateId: candidateId,
        fileName: file.originalname,
        fileUrl: cvUpload.secure_url,
        fileSize: file.size,
        mimeType: file.mimetype,
        aiAnalyzed: true,
        resumeJson: resumeJsonData,
      },
    });

    // Store or update Candidate Profile
    if (parsedData.personalInformation) {
      const personalInfo = parsedData.personalInformation;
      const genderEnum = normalizeGender(personalInfo.gender);
      const maritalStatusEnum = normalizeMaritalStatus(personalInfo.maritalStatus);
      
      try {
        // Check if profile already exists for this candidate
        const existingProfile = await prisma.candidateProfile.findUnique({
          where: { candidateId: candidateId },
        });

        if (existingProfile) {
          // Update existing profile
          // Only update email if it's different and doesn't conflict with another candidate
          let emailToUpdate = personalInfo.email || existingProfile.email;
          if (personalInfo.email && personalInfo.email !== existingProfile.email) {
            // Check if email exists for another candidate
            const emailExists = await prisma.candidateProfile.findUnique({
              where: { email: personalInfo.email },
            });
            if (emailExists && emailExists.candidateId !== candidateId) {
              // Email belongs to another candidate, keep existing email
              emailToUpdate = existingProfile.email;
              console.log(`⚠️ Email ${personalInfo.email} already exists for another candidate. Keeping existing email.`);
            }
          }

          await prisma.candidateProfile.update({
            where: { candidateId: candidateId },
            data: {
              fullName: personalInfo.fullName || existingProfile.fullName,
              email: emailToUpdate,
              phoneNumber: personalInfo.phoneNumber ?? existingProfile.phoneNumber,
              alternatePhone: personalInfo.alternatePhoneNumber ?? existingProfile.alternatePhone,
              address: personalInfo.address ?? existingProfile.address,
              city: personalInfo.city ?? existingProfile.city,
              country: personalInfo.country ?? existingProfile.country,
              linkedinUrl: personalInfo.linkedinProfile ?? existingProfile.linkedinUrl,
              dateOfBirth: personalInfo.dateOfBirth ? new Date(personalInfo.dateOfBirth) : existingProfile.dateOfBirth,
              gender: genderEnum ?? existingProfile.gender,
              maritalStatus: maritalStatusEnum ?? existingProfile.maritalStatus,
              nationality: personalInfo.nationality ?? existingProfile.nationality,
              passportNumber: personalInfo.passportNumber ?? existingProfile.passportNumber,
              updatedAt: new Date(),
            },
          });
        } else {
          // Create new profile
          // Check if email already exists
          let emailToUse = personalInfo.email || '';
          let profileUpdated = false;
          
          if (emailToUse) {
            const emailExists = await prisma.candidateProfile.findUnique({
              where: { email: emailToUse },
            });
            
            if (emailExists) {
              // Email exists - check if it's for the same candidate (shouldn't happen, but handle it)
              if (emailExists.candidateId === candidateId) {
                // Same candidate, just update
                await prisma.candidateProfile.update({
                  where: { candidateId: candidateId },
                  data: {
                    fullName: personalInfo.fullName || emailExists.fullName,
                    phoneNumber: personalInfo.phoneNumber ?? emailExists.phoneNumber,
                    alternatePhone: personalInfo.alternatePhoneNumber ?? emailExists.alternatePhone,
                    address: personalInfo.address ?? emailExists.address,
                    city: personalInfo.city ?? emailExists.city,
                    country: personalInfo.country ?? emailExists.country,
                    linkedinUrl: personalInfo.linkedinProfile ?? emailExists.linkedinUrl,
                    dateOfBirth: personalInfo.dateOfBirth ? new Date(personalInfo.dateOfBirth) : emailExists.dateOfBirth,
                    gender: genderEnum ?? emailExists.gender,
                    maritalStatus: maritalStatusEnum ?? emailExists.maritalStatus,
                    nationality: personalInfo.nationality ?? emailExists.nationality,
                    passportNumber: personalInfo.passportNumber ?? emailExists.passportNumber,
                    updatedAt: new Date(),
                  },
                });
                profileUpdated = true;
              } else {
                // Email belongs to another candidate, use temporary email
                console.log(`⚠️ Email ${emailToUse} already exists for another candidate. Using temporary email.`);
                emailToUse = `${candidateId}@temp.local`;
              }
            }
          } else {
            // No email provided, use temporary email
            emailToUse = `${candidateId}@temp.local`;
          }

          // Only create if we haven't updated above
          if (!profileUpdated) {
            await prisma.candidateProfile.create({
              data: {
                candidateId: candidateId,
                fullName: personalInfo.fullName || '',
                email: emailToUse,
                phoneNumber: personalInfo.phoneNumber || null,
                alternatePhone: personalInfo.alternatePhoneNumber || null,
                address: personalInfo.address || null,
                city: personalInfo.city || null,
                country: personalInfo.country || null,
                linkedinUrl: personalInfo.linkedinProfile || null,
                dateOfBirth: personalInfo.dateOfBirth ? new Date(personalInfo.dateOfBirth) : null,
                gender: genderEnum,
                maritalStatus: maritalStatusEnum,
                nationality: personalInfo.nationality || null,
                passportNumber: personalInfo.passportNumber || null,
              },
            });
          }
        }
      } catch (error) {
        // If there's still a unique constraint error, try to find and update existing profile
        if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
          console.log(`⚠️ Email constraint error. Attempting to find existing profile by email...`);
          try {
            const profileByEmail = await prisma.candidateProfile.findUnique({
              where: { email: personalInfo.email },
            });
            
            if (profileByEmail && profileByEmail.candidateId === candidateId) {
              // Profile exists for this candidate, just update it
              await prisma.candidateProfile.update({
                where: { candidateId: candidateId },
                data: {
                  fullName: personalInfo.fullName || profileByEmail.fullName,
                  phoneNumber: personalInfo.phoneNumber ?? profileByEmail.phoneNumber,
                  alternatePhone: personalInfo.alternatePhoneNumber ?? profileByEmail.alternatePhone,
                  address: personalInfo.address ?? profileByEmail.address,
                  city: personalInfo.city ?? profileByEmail.city,
                  country: personalInfo.country ?? profileByEmail.country,
                  linkedinUrl: personalInfo.linkedinProfile ?? profileByEmail.linkedinUrl,
                  dateOfBirth: personalInfo.dateOfBirth ? new Date(personalInfo.dateOfBirth) : profileByEmail.dateOfBirth,
                  gender: genderEnum ?? profileByEmail.gender,
                  maritalStatus: maritalStatusEnum ?? profileByEmail.maritalStatus,
                  nationality: personalInfo.nationality ?? profileByEmail.nationality,
                  passportNumber: personalInfo.passportNumber ?? profileByEmail.passportNumber,
                  updatedAt: new Date(),
                },
              });
              console.log(`✅ Profile updated successfully after handling email constraint.`);
            } else {
              console.error(`❌ Email ${personalInfo.email} belongs to a different candidate. Profile not updated.`);
            }
          } catch (retryError) {
            console.error('Error retrying profile update:', retryError);
            throw retryError;
          }
        } else {
          throw error;
        }
      }
    }

    // Store Education entries
    if (parsedData.education && parsedData.education.length > 0) {
      // Delete existing education entries
      await prisma.education.deleteMany({
        where: { candidateId: candidateId },
      });

      // Create new education entries
      for (const edu of parsedData.education) {
        await prisma.education.create({
          data: {
            candidateId: candidateId,
            degree: edu.degree || 'Not specified',
            institution: edu.institution || 'Not specified',
            specialization: edu.specialization || null,
            startYear: edu.startYear || new Date().getFullYear() - 4,
            endYear: edu.endYear || null,
            isOngoing: !edu.endYear,
            grade: null,
            description: null,
          },
        });
      }
    }

    // Store Work Experience entries
    if (parsedData.workExperience && parsedData.workExperience.length > 0) {
      // Delete existing work experiences
      await prisma.workExperience.deleteMany({
        where: { candidateId: candidateId },
      });

      // Create new work experience entries
      for (const exp of parsedData.workExperience) {
        await prisma.workExperience.create({
          data: {
            candidateId: candidateId,
            jobTitle: exp.jobTitle || 'Not specified',
            company: exp.company || 'Not specified',
            workLocation: exp.workLocation || null,
            workMode: null, // Will be extracted if available
            startDate: exp.startDate ? new Date(exp.startDate) : new Date(),
            endDate: exp.endDate ? new Date(exp.endDate) : null,
            isCurrentJob: exp.currentlyWorking || false,
            responsibilities: exp.responsibilities || null,
            industry: null,
          },
        });
      }
    }

    // Store Skills (from skills array, excluding languages)
    // technicalSkills and languages are already declared above

    if (technicalSkills.length > 0) {
      // Delete existing candidate skills
      await prisma.candidateSkill.deleteMany({
        where: { candidateId: candidateId },
      });

      for (const skillData of technicalSkills) {
        // Find or create skill
        let skill = await prisma.skill.findUnique({
          where: { name: skillData.languageName },
        });

        if (!skill) {
          skill = await prisma.skill.create({
            data: {
              name: skillData.languageName,
              category: null,
            },
          });
        }

        // Create candidate skill relationship
        await prisma.candidateSkill.create({
          data: {
            candidateId: candidateId,
            skillId: skill.id,
            proficiency: mapProficiency(skillData.proficiency) || Proficiency.INTERMEDIATE,
            yearsOfExp: null,
            isAiSuggested: true,
          },
        });
      }
    }

    // Store Languages (filter languages from skills)
    // languages is already declared above

    if (languages.length > 0) {
      // Delete existing languages
      await prisma.candidateLanguage.deleteMany({
        where: { candidateId: candidateId },
      });

      for (const langData of languages) {
        await prisma.candidateLanguage.create({
          data: {
            candidateId: candidateId,
            name: langData.languageName,
            proficiency: mapProficiency(langData.proficiency) || Proficiency.INTERMEDIATE,
            canSpeak: langData.speak || false,
            canRead: langData.read || false,
            canWrite: langData.write || false,
          },
        });
      }
    }

    console.log('CV data stored successfully in database');

    // Trigger CV analysis asynchronously (don't wait for it)
    setImmediate(async () => {
      try {
        const { analyzeCV } = require('./cv-analysis.controller');
        // Create mock req/res objects for the analysis function
        const mockReq = { body: { candidateId } };
        const mockRes = {
          json: (data) => {
            if (data.success) {
              console.log('✅ CV Analysis completed after upload. Score:', data.data?.cv_score);
            } else {
              console.log('⚠️ CV Analysis failed:', data.message);
            }
          },
          status: (code) => ({
            json: (data) => {
              console.log('⚠️ CV Analysis failed with status', code, ':', data.message);
            },
          }),
        };
        await analyzeCV(mockReq, mockRes);
      } catch (err) {
        console.error('Error triggering CV analysis:', err.message);
      }
    });

    res.json({
      success: true,
      message: 'CV uploaded and processed successfully',
      data: {
        resumeId: resume.id,
        fileName: file.originalname,
        fileUrl: cvUpload.secure_url,
        latexFileUrl: latexUpload.secure_url,
        extractedData: {
          hasPersonalInfo: !!cvData.personalInfo,
          educationCount: cvData.education?.length || 0,
          workExperienceCount: cvData.workExperience?.length || 0,
          skillsCount: cvData.skills?.length || 0,
          languagesCount: cvData.languages?.length || 0,
        },
      },
    });
  } catch (error) {
    console.error('Error uploading CV:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload and process CV',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Map proficiency string to Prisma enum
 */
function mapProficiency(proficiency) {
  if (!proficiency) return Proficiency.INTERMEDIATE;
  
  const upper = proficiency.toUpperCase();
  if (upper === 'NATIVE' || upper === 'FLUENT' || upper === 'EXPERT' || upper === 'ADVANCED') {
    return Proficiency.ADVANCED;
  } else if (upper === 'BEGINNER' || upper === 'BASIC' || upper === 'ELEMENTARY') {
    return Proficiency.BEGINNER;
  }
  return Proficiency.INTERMEDIATE;
}

/**
 * Check CV processing status
 * GET /api/cv/status/:candidateId
 */
async function getCVStatus(req, res) {
  try {
    const { candidateId } = req.params;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
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
        processed: false,
      });
    }

    // Check if resume exists and is processed
    const resume = await prisma.resume.findUnique({
      where: { candidateId: candidateId },
    });

    const processed = resume && resume.aiAnalyzed === true;

    res.json({
      success: true,
      processed: processed,
      hasResume: !!resume,
      aiAnalyzed: resume?.aiAnalyzed || false,
    });
  } catch (error) {
    console.error('Error checking CV status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check CV status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Get candidate profile data
 * GET /api/candidate/profile/:candidateId
 */
async function getCandidateProfile(req, res) {
  try {
    const { candidateId } = req.params;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    // Fetch candidate with all related data
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        profile: true,
        resume: true,
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
      },
    });

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found',
      });
    }

    // Format the response
    console.log('📊 Fetching profile for candidate:', candidateId);
    console.log('📊 Candidate skills count:', candidate.skills?.length || 0);
    
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
    
    // Get WhatsApp number (the number used for OTP)
    // whatsappNumber in DB already includes country code (e.g., "+919876543210")
    const whatsappNumber = candidate.whatsappNumber || '';
    const countryCode = candidate.countryCode || '';

    const profileData = {
      personalInformation: {
        fullName: candidate.profile?.fullName || '',
        email: displayEmail,
        phoneNumber: whatsappNumber || candidate.profile?.phoneNumber || '',
        whatsappNumber: whatsappNumber,
        countryCode: countryCode,
        alternatePhoneNumber: candidate.profile?.alternatePhone || '',
        gender: candidate.profile?.gender || '',
        dateOfBirth: candidate.profile?.dateOfBirth ? candidate.profile.dateOfBirth.toISOString().split('T')[0] : '',
        maritalStatus: candidate.profile?.maritalStatus || '',
        address: candidate.profile?.address || '',
        city: candidate.profile?.city || '',
        country: candidate.profile?.country || '',
        nationality: candidate.profile?.nationality || '',
        passportNumber: candidate.profile?.passportNumber || '',
        linkedinProfile: candidate.profile?.linkedinUrl || '',
        profilePhotoUrl: candidate.profile?.profilePhotoUrl || '',
      },
      education: candidate.educations.map((edu) => ({
        id: edu.id,
        degree: edu.degree || '',
        institution: edu.institution || '',
        specialization: edu.specialization || '',
        startYear: edu.startYear?.toString() || '',
        endYear: edu.endYear?.toString() || '',
        isOngoing: edu.isOngoing || false,
      })),
      workExperience: candidate.workExperiences.map((exp) => ({
        id: exp.id,
        jobTitle: exp.jobTitle || '',
        company: exp.company || '',
        workLocation: exp.workLocation || '',
        startDate: exp.startDate ? exp.startDate.toISOString().split('T')[0] : '',
        endDate: exp.endDate ? exp.endDate.toISOString().split('T')[0] : '',
        currentlyWorking: exp.isCurrentJob || false,
        responsibilities: exp.responsibilities || '',
      })),
      skills: candidate.skills.map((cs) => {
        const skillName = cs.skill?.name || '';
        console.log('🔍 Skill from DB:', {
          id: cs.id,
          skillName: skillName,
          proficiency: cs.proficiency,
          isAiSuggested: cs.isAiSuggested,
          hasSkillRelation: !!cs.skill,
        });
        return {
          id: cs.id,
          name: skillName,
          proficiency: cs.proficiency || 'INTERMEDIATE',
          isAiSuggested: cs.isAiSuggested || false,
        };
      }).filter((skill) => skill.name && skill.name.trim() !== ''),
      languages: candidate.languages.map((lang) => ({
        id: lang.id,
        name: lang.name || '',
        proficiency: lang.proficiency || 'INTERMEDIATE',
        speak: lang.canSpeak || false,
        read: lang.canRead || false,
        write: lang.canWrite || false,
      })),
      portfolioLinks: candidate.portfolioLinks && candidate.portfolioLinks.links 
        ? (Array.isArray(candidate.portfolioLinks.links) 
            ? candidate.portfolioLinks.links 
            : []) 
        : [],
    };

    console.log('📊 Profile data prepared:', {
      skillsCount: profileData.skills.length,
      skills: profileData.skills.map(s => s.name),
      languagesCount: profileData.languages.length,
      educationCount: profileData.education.length,
      workExperienceCount: profileData.workExperience.length,
    });

    res.json({
      success: true,
      data: profileData,
    });
  } catch (error) {
    console.error('Error fetching candidate profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch candidate profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Update candidate profile
 * PUT /api/cv/profile/:candidateId
 */
async function updateCandidateProfile(req, res) {
  try {
    const { candidateId } = req.params;
    const {
      personalInformation,
      education,
      workExperience,
      skills,
      languages,
      careerPreferences,
    } = req.body;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    // Verify candidate exists
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found',
      });
    }

    console.log('📝 Updating profile for candidate:', candidateId);

    // Update Personal Information
    if (personalInformation) {
      // Map gender from frontend format to enum
      let genderEnum = null;
      if (personalInformation.gender !== undefined && personalInformation.gender !== '') {
        const genderMap = {
          'Male': 'MALE',
          'Female': 'FEMALE',
          'Other': 'OTHER',
          'MALE': 'MALE',
          'FEMALE': 'FEMALE',
          'OTHER': 'OTHER',
        };
        genderEnum = genderMap[personalInformation.gender] || null;
      }

      // Map marital status from frontend format to enum
      let maritalStatusEnum = null;
      if (personalInformation.maritalStatus !== undefined && personalInformation.maritalStatus !== '') {
        const maritalStatusMap = {
          'Single': 'SINGLE',
          'Married': 'MARRIED',
          'Divorced': 'DIVORCED',
          'Widowed': 'WIDOWED',
          'SINGLE': 'SINGLE',
          'MARRIED': 'MARRIED',
          'DIVORCED': 'DIVORCED',
          'WIDOWED': 'WIDOWED',
        };
        maritalStatusEnum = maritalStatusMap[personalInformation.maritalStatus] || null;
      }

      const profileData = {
        ...(personalInformation.fullName !== undefined && { fullName: personalInformation.fullName }),
        ...(personalInformation.email !== undefined && { email: personalInformation.email }),
        ...(personalInformation.phoneNumber !== undefined && { phoneNumber: personalInformation.phoneNumber }),
        ...(personalInformation.alternatePhoneNumber !== undefined && { alternatePhone: personalInformation.alternatePhoneNumber }),
        ...(genderEnum && { gender: genderEnum }),
        ...(personalInformation.dateOfBirth !== undefined && personalInformation.dateOfBirth !== '' && { dateOfBirth: new Date(personalInformation.dateOfBirth) }),
        ...(maritalStatusEnum && { maritalStatus: maritalStatusEnum }),
        ...(personalInformation.address !== undefined && { address: personalInformation.address }),
        ...(personalInformation.city !== undefined && { city: personalInformation.city }),
        ...(personalInformation.country !== undefined && { country: personalInformation.country }),
        ...(personalInformation.nationality !== undefined && { nationality: personalInformation.nationality }),
        ...(personalInformation.passportNumber !== undefined && { passportNumber: personalInformation.passportNumber }),
        ...(personalInformation.linkedinProfile !== undefined && { linkedinUrl: personalInformation.linkedinProfile }),
        ...(personalInformation.profilePhotoUrl !== undefined && { profilePhotoUrl: personalInformation.profilePhotoUrl }),
      };

      await prisma.candidateProfile.upsert({
        where: { candidateId: candidateId },
        update: profileData,
        create: {
          candidateId: candidateId,
          ...profileData,
        },
      });
      console.log('✅ Personal information updated');
    }

    // Update Education
    if (education && Array.isArray(education)) {
      // Delete existing education entries
      await prisma.education.deleteMany({
        where: { candidateId: candidateId },
      });

      // Create new education entries
      for (const edu of education) {
        if (edu.degree || edu.institution) {
          const startYear = edu.startYear ? parseInt(edu.startYear.split('-')[0]) : null;
          const endYear = edu.endYear ? parseInt(edu.endYear.split('-')[0]) : null;
          
          await prisma.education.create({
            data: {
              candidateId: candidateId,
              degree: edu.degree || '',
              institution: edu.institution || '',
              specialization: edu.specialization || null,
              startYear: startYear || new Date().getFullYear(),
              endYear: endYear || null,
              isOngoing: !endYear || edu.isOngoing || false,
            },
          });
        }
      }
      console.log(`✅ Education updated: ${education.length} entries`);
    }

    // Update Work Experience
    if (workExperience && Array.isArray(workExperience)) {
      // Delete existing work experiences
      await prisma.workExperience.deleteMany({
        where: { candidateId: candidateId },
      });

      // Create new work experience entries
      for (const exp of workExperience) {
        if (exp.jobTitle || exp.company) {
          await prisma.workExperience.create({
            data: {
              candidateId: candidateId,
              jobTitle: exp.jobTitle || '',
              company: exp.company || '',
              workLocation: exp.workLocation || null,
              startDate: exp.startDate ? new Date(exp.startDate) : new Date(),
              endDate: exp.endDate ? new Date(exp.endDate) : null,
              isCurrentJob: exp.currentlyWorking || false,
              responsibilities: exp.responsibilities || null,
            },
          });
        }
      }
      console.log(`✅ Work experience updated: ${workExperience.length} entries`);
    }

    // Update Skills
    if (skills && Array.isArray(skills)) {
      // Delete existing candidate skills
      await prisma.candidateSkill.deleteMany({
        where: { candidateId: candidateId },
      });

      // Create new skills
      for (const skillName of skills) {
        if (skillName && skillName.trim() !== '') {
          // Find or create skill
          let skill = await prisma.skill.findUnique({
            where: { name: skillName.trim() },
          });

          if (!skill) {
            skill = await prisma.skill.create({
              data: {
                name: skillName.trim(),
                category: null,
              },
            });
          }

          // Create candidate skill relationship
          await prisma.candidateSkill.create({
            data: {
              candidateId: candidateId,
              skillId: skill.id,
              proficiency: Proficiency.INTERMEDIATE,
              isAiSuggested: false, // User-added skills are not AI suggested
            },
          });
        }
      }
      console.log(`✅ Skills updated: ${skills.length} skills`);
    }

    // Update Languages
    if (languages && Array.isArray(languages)) {
      // Delete existing languages
      await prisma.candidateLanguage.deleteMany({
        where: { candidateId: candidateId },
      });

      // Create new language entries
      for (const lang of languages) {
        if (lang.name && lang.name.trim() !== '') {
          const proficiencyMap = {
            'Basic': Proficiency.BEGINNER,
            'Conversational': Proficiency.INTERMEDIATE,
            'Professional': Proficiency.ADVANCED,
            'Fluent': Proficiency.NATIVE,
            'BEGINNER': Proficiency.BEGINNER,
            'INTERMEDIATE': Proficiency.INTERMEDIATE,
            'ADVANCED': Proficiency.ADVANCED,
            'NATIVE': Proficiency.NATIVE,
          };

          await prisma.candidateLanguage.create({
            data: {
              candidateId: candidateId,
              name: lang.name.trim(),
              proficiency: proficiencyMap[lang.proficiency] || Proficiency.INTERMEDIATE,
              canSpeak: lang.speak || false,
              canRead: lang.read || false,
              canWrite: lang.write || false,
            },
          });
        }
      }
      console.log(`✅ Languages updated: ${languages.length} entries`);
    }

    // Update Career Preferences
    if (careerPreferences) {
      // Map salary type from frontend format to enum
      let currentSalaryTypeEnum = null;
      if (careerPreferences.currentSalaryType !== undefined && careerPreferences.currentSalaryType !== '') {
        const salaryTypeMap = {
          'Annual': 'ANNUAL',
          'Monthly': 'MONTHLY',
          'Hourly': 'HOURLY',
          'Daily': 'DAILY',
          'ANNUAL': 'ANNUAL',
          'MONTHLY': 'MONTHLY',
          'HOURLY': 'HOURLY',
          'DAILY': 'DAILY',
        };
        currentSalaryTypeEnum = salaryTypeMap[careerPreferences.currentSalaryType] || null;
      }

      let preferredSalaryTypeEnum = null;
      if (careerPreferences.preferredSalaryType !== undefined && careerPreferences.preferredSalaryType !== '') {
        const salaryTypeMap = {
          'Annual': 'ANNUAL',
          'Monthly': 'MONTHLY',
          'Hourly': 'HOURLY',
          'Daily': 'DAILY',
          'ANNUAL': 'ANNUAL',
          'MONTHLY': 'MONTHLY',
          'HOURLY': 'HOURLY',
          'DAILY': 'DAILY',
        };
        preferredSalaryTypeEnum = salaryTypeMap[careerPreferences.preferredSalaryType] || null;
      }

      // Map work mode from frontend format to enum
      let preferredWorkModeEnum = null;
      if (careerPreferences.preferredWorkMode !== undefined && careerPreferences.preferredWorkMode !== '') {
        const workModeMap = {
          'Remote': 'REMOTE',
          'On-site': 'ON_SITE',
          'Hybrid': 'HYBRID',
          'REMOTE': 'REMOTE',
          'ON_SITE': 'ON_SITE',
          'HYBRID': 'HYBRID',
        };
        preferredWorkModeEnum = workModeMap[careerPreferences.preferredWorkMode] || null;
      }

      const prefData = {
        ...(careerPreferences.currentCurrency !== undefined && { currentCurrency: careerPreferences.currentCurrency }),
        ...(currentSalaryTypeEnum && { currentSalaryType: currentSalaryTypeEnum }),
        ...(careerPreferences.currentSalary !== undefined && careerPreferences.currentSalary !== '' && { currentSalary: parseFloat(careerPreferences.currentSalary) }),
        ...(careerPreferences.currentLocation !== undefined && { currentLocation: careerPreferences.currentLocation }),
        ...(careerPreferences.currentBenefits !== undefined && Array.isArray(careerPreferences.currentBenefits) && { currentBenefits: careerPreferences.currentBenefits }),
        ...(careerPreferences.preferredCurrency !== undefined && { preferredCurrency: careerPreferences.preferredCurrency }),
        ...(preferredSalaryTypeEnum && { preferredSalaryType: preferredSalaryTypeEnum }),
        ...(careerPreferences.preferredSalary !== undefined && careerPreferences.preferredSalary !== '' && { preferredSalary: parseFloat(careerPreferences.preferredSalary) }),
        ...(careerPreferences.preferredLocations !== undefined && Array.isArray(careerPreferences.preferredLocations) && { preferredLocations: careerPreferences.preferredLocations }),
        ...(careerPreferences.preferredRoles !== undefined && Array.isArray(careerPreferences.preferredRoles) && { preferredRoles: careerPreferences.preferredRoles }),
        ...(preferredWorkModeEnum && { preferredWorkMode: preferredWorkModeEnum }),
        ...(careerPreferences.preferredBenefits !== undefined && Array.isArray(careerPreferences.preferredBenefits) && { preferredBenefits: careerPreferences.preferredBenefits }),
        ...(careerPreferences.noticePeriodDays !== undefined && careerPreferences.noticePeriodDays !== '' && { noticePeriodDays: parseInt(careerPreferences.noticePeriodDays) }),
        ...(careerPreferences.openToRelocation !== undefined && { openToRelocation: careerPreferences.openToRelocation }),
        ...(careerPreferences.passportNumbersByLocation !== undefined && { passportNumbersByLocation: careerPreferences.passportNumbersByLocation }),
      };

      await prisma.careerPreferences.upsert({
        where: { candidateId: candidateId },
        update: prefData,
        create: {
          candidateId: candidateId,
          ...prefData,
        },
      });
      console.log('✅ Career preferences updated');
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    console.error('Error updating candidate profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update candidate profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Get candidate dashboard data
 * GET /api/cv/dashboard/:candidateId
 */
async function getCandidateDashboard(req, res) {
  try {
    const { candidateId } = req.params;
    const startedAt = Date.now();

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    console.log(`📥 DB fetch requested: dashboard | candidateId=${candidateId}`);
    // Fetch candidate with all related data
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        profile: true,
        applications: {
          include: {
            job: {
              include: {
                company: true,
              },
            },
          },
          orderBy: { appliedAt: 'desc' },
        },
        notifications: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        dashboardStats: true,
        skills: {
          include: {
            skill: true,
          },
          take: 10,
        },
        savedJobs: {
          include: {
            job: {
              include: {
                company: true,
              },
            },
          },
          take: 5,
        },
      },
    });

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found',
      });
    }

    console.log(
      `📦 DB fetch result: dashboard | candidateId=${candidateId} | applications=${candidate.applications.length} | notifications=${candidate.notifications.length} | savedJobs=${candidate.savedJobs.length} | elapsedMs=${Date.now() - startedAt}`
    );

    // Calculate application status counts
    const applicationStatusCounts = {
      SUBMITTED: 0,
      UNDER_REVIEW: 0,
      SHORTLISTED: 0,
      ASSESSMENT: 0,
      INTERVIEW: 0,
      FINAL_DECISION: 0,
      SELECTED: 0,
      REJECTED: 0,
    };

    candidate.applications.forEach((app) => {
      if (applicationStatusCounts.hasOwnProperty(app.status)) {
        applicationStatusCounts[app.status]++;
      }
    });

    // Format application status for frontend
    const applicationStatus = [
      { label: 'Applied', value: applicationStatusCounts.SUBMITTED, color: '#22C55E' },
      { label: 'Under Review', value: applicationStatusCounts.UNDER_REVIEW, color: '#FACC15' },
      { label: 'Shortlisted', value: applicationStatusCounts.SHORTLISTED, color: '#14B8A6' },
      { label: 'Assessment', value: applicationStatusCounts.ASSESSMENT, color: '#0EA5E9' },
      { label: 'Interview', value: applicationStatusCounts.INTERVIEW, color: '#F97373' },
      { label: 'Final Decision', value: applicationStatusCounts.FINAL_DECISION, color: '#6366F1' },
    ].filter((item) => item.value > 0); // Only include statuses with applications

    // Format notifications
    const notifications = candidate.notifications.map((notif) => ({
      id: notif.id,
      text: notif.message,
      time: formatTimeAgo(notif.createdAt),
      type: notif.type,
    }));

    // Format dashboard data
    const dashboardData = {
      profile: {
        fullName: candidate.profile?.fullName || 'User',
        email: candidate.profile?.email || '',
        profilePhotoUrl: candidate.profile?.profilePhotoUrl || null,
        profileCompleteness: candidate.profile?.profileCompleteness || 0,
        // Helpful when profile row is not created yet (OTP-only candidate)
        whatsappNumber: candidate.whatsappNumber || '',
        countryCode: candidate.countryCode || '',
      },
      stats: {
        totalApplications: candidate.applications.length,
        activeApplications: candidate.applications.filter((app) => 
          ['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'ASSESSMENT', 'INTERVIEW'].includes(app.status)
        ).length,
        interviews: applicationStatusCounts.INTERVIEW,
        savedJobs: candidate.savedJobs.length,
        profileCompleteness: candidate.profile?.profileCompleteness || 0,
        cvScore: candidate.dashboardStats?.cvScore || 0,
        marketFit: candidate.dashboardStats?.marketFit || 0,
        offersReceived: applicationStatusCounts.SELECTED,
        rejected: applicationStatusCounts.REJECTED,
      },
      // Full counts for dashboard charts / tiles (Prisma enums)
      applicationCounts: applicationStatusCounts,
      applicationStatus,
      notifications,
      /** All job IDs the candidate has already applied to (for filtering “open matches” on the client). */
      appliedJobIds: candidate.applications.map((app) => app.jobId),
      recentApplications: candidate.applications.slice(0, 5).map((app) => ({
        id: app.id,
        jobId: app.jobId,
        jobTitle: app.job.title,
        company: app.job.company.name,
        status: app.status,
        appliedAt: app.appliedAt,
        matchScore: app.matchScore,
      })),
      topSkills: candidate.skills.slice(0, 10).map((cs) => ({
        name: cs.skill.name,
        proficiency: cs.proficiency,
      })),
      savedJobs: candidate.savedJobs.map((sj) => ({
        id: sj.job.id,
        title: sj.job.title,
        company: sj.job.company.name,
        location: sj.job.location,
        savedAt: sj.savedAt,
      })),
    };

    res.json({
      success: true,
      data: dashboardData,
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
      console.warn('DB unavailable - getCandidateDashboard');
      return res.status(503).json({
        success: false,
        message: 'Database unavailable',
      });
    }

    console.error('Error fetching candidate dashboard:', message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

// Helper function to format time ago
function formatTimeAgo(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - new Date(date)) / 1000);

  if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`;
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}d ago`;
  }
}

/**
 * Get all profile data with AI-assisted field matching
 * GET /api/cv/profile-all/:candidateId
 */
async function getAllProfileData(req, res) {
  try {
    const { candidateId } = req.params;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    // Fetch all candidate data
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        profile: true,
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
        resume: true,
        careerPreferences: true,
      },
    });

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found',
      });
    }

    // Prepare database data
    const dbProfileData = {
      profile: candidate.profile,
      educations: candidate.educations,
      workExperiences: candidate.workExperiences,
      skills: candidate.skills,
      languages: candidate.languages,
      resume: candidate.resume,
      careerPreferences: candidate.careerPreferences,
    };

    // Use AI-assisted field matching service
    const fieldMatchingService = require('../services/field-matching.service');
    const matchedData = await fieldMatchingService.matchProfileDataToModals(dbProfileData);

    console.log('📊 AI-matched profile data:', {
      hasBasicInfo: !!matchedData.basicInfo,
      educationCount: matchedData.education?.length || 0,
      workExperienceCount: matchedData.workExperience?.workExperiences?.length || 0,
      skillsCount: matchedData.skills?.skills?.length || 0,
      languagesCount: matchedData.languages?.languages?.length || 0,
    });

    res.json({
      success: true,
      data: matchedData,
      rawData: dbProfileData, // Include raw data for reference
    });
  } catch (error) {
    console.error('Error fetching all profile data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

module.exports = {
  uploadCV,
  getCVStatus,
  getCandidateProfile,
  updateCandidateProfile,
  getCandidateDashboard,
  getAllProfileData,
};
