const { prisma } = require('../lib/prisma');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Mistral } = require('@mistralai/mistralai');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');

// Initialize AI services
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const mistral = MISTRAL_API_KEY ? new Mistral({ apiKey: MISTRAL_API_KEY }) : null;
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

/**
 * Get resume JSON for editing
 * GET /api/resume-editor/:candidateId
 */
async function getResumeJSON(req, res) {
  try {
    const { candidateId } = req.params;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    console.log(`📄 Fetching resume JSON for candidate: ${candidateId}`);

    // Get resume from database
    const resume = await prisma.resume.findUnique({
      where: { candidateId },
    });

    if (!resume) {
      console.log(`⚠️ Resume not found for candidate: ${candidateId}`);
      return res.status(404).json({
        success: false,
        message: 'Resume not found',
      });
    }

    // If resume_json exists, transform it to AI CV editor format if needed
    if (resume.resumeJson) {
      console.log('✅ Found resumeJson in database');
      
      // Check if it's in CV upload format (has personalInformation) or AI CV editor format
      const resumeData = resume.resumeJson;
      let transformedResumeJson = resumeData;

      // Transform from CV upload format to AI CV editor format
      if (resumeData.personalInformation && !resumeData.name) {
        console.log('🔄 Transforming CV upload format to AI CV editor format');
        
        // Transform personalInformation to name/title
        const personalInfo = resumeData.personalInformation || {};
        transformedResumeJson = {
          name: personalInfo.fullName || '',
          title: personalInfo.jobTitle || personalInfo.title || '',
          summary: resumeData.summary || resumeData.professionalSummary || '',
          experience: (resumeData.workExperience || []).map(exp => ({
            company: exp.company || '',
            position: exp.jobTitle || exp.position || '',
            startDate: exp.startDate || '',
            endDate: exp.endDate || exp.currentlyWorking ? 'Present' : '',
            description: exp.responsibilities || exp.description || '',
            location: exp.workLocation || exp.location || '',
          })),
          education: (resumeData.education || []).map(edu => ({
            institution: edu.institution || '',
            degree: edu.degree || '',
            field: edu.specialization || edu.field || '',
            startYear: edu.startYear || null,
            endYear: edu.endYear || null,
            description: edu.description || '',
          })),
          skills: (resumeData.skills || []).map(skill => {
            // Handle both string and object formats
            if (typeof skill === 'string') {
              return skill;
            }
            return skill.languageName || skill.name || skill.skill || String(skill);
          }),
          projects: resumeData.projects || [],
          certifications: resumeData.certifications || [],
          custom_sections: resumeData.custom_sections || [],
        };
        
        console.log('✅ Resume data transformed successfully');
      } else {
        console.log('✅ Resume data already in AI CV editor format');
      }

      // Ensure all required fields exist
      transformedResumeJson = {
        name: transformedResumeJson.name || '',
        title: transformedResumeJson.title || '',
        summary: transformedResumeJson.summary || '',
        experience: transformedResumeJson.experience || [],
        education: transformedResumeJson.education || [],
        skills: transformedResumeJson.skills || [],
        projects: transformedResumeJson.projects || [],
        certifications: transformedResumeJson.certifications || [],
        custom_sections: transformedResumeJson.custom_sections || [],
      };

      return res.json({
        success: true,
        data: {
          resumeJson: transformedResumeJson,
          templateId: resume.templateId || 'default',
          fileName: resume.fileName,
          fileUrl: resume.fileUrl,
        },
      });
    }

    // If no resume_json, try to generate from profile data
    console.log('⚠️ No resumeJson found, generating from profile data...');
    const profileData = await getProfileDataForResume(candidateId);
    
    // Generate default resume JSON structure
    const defaultResumeJson = generateDefaultResumeJSON(profileData);

    return res.json({
      success: true,
      data: {
        resumeJson: defaultResumeJson,
        templateId: 'default',
        fileName: resume.fileName,
        fileUrl: resume.fileUrl,
      },
    });
  } catch (error) {
    console.error('❌ Error getting resume JSON:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get resume JSON',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Update resume JSON
 * POST /api/resume-editor/:candidateId
 */
async function updateResumeJSON(req, res) {
  try {
    const { candidateId } = req.params;
    const { resumeJson, templateId } = req.body;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    // Validate resumeJson - allow empty object but not null/undefined
    if (resumeJson === null || resumeJson === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Resume JSON is required',
      });
    }

    // Ensure resumeJson is an object
    const resumeData = typeof resumeJson === 'object' ? resumeJson : {};

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

    // Get existing resume or create if it doesn't exist
    let existingResume = await prisma.resume.findUnique({
      where: { candidateId },
    });

    // If resume doesn't exist, create it
    if (!existingResume) {
      console.log(`📝 Creating new resume for candidate: ${candidateId}`);
      existingResume = await prisma.resume.create({
        data: {
          candidateId,
          resumeJson: resumeData,
          templateId: templateId || 'default',
          fileName: null,
          fileUrl: null,
        },
      });

      return res.json({
        success: true,
        message: 'Resume created successfully',
        data: {
          resumeId: existingResume.id,
          templateId: existingResume.templateId,
        },
      });
    }

    // Create version snapshot before updating (only if there's existing data)
    if (existingResume.resumeJson && Object.keys(existingResume.resumeJson).length > 0) {
      try {
    await prisma.resumeVersion.create({
      data: {
        candidateId,
        resumeId: existingResume.id,
            resumeJson: existingResume.resumeJson,
        templateId: existingResume.templateId || 'default',
      },
    });
      } catch (versionError) {
        // Log but don't fail if version creation fails
        console.warn('⚠️ Failed to create resume version:', versionError.message);
      }
    }

    // Update resume with new JSON
    const updatedResume = await prisma.resume.update({
      where: { candidateId },
      data: {
        resumeJson: resumeData,
        templateId: templateId || existingResume.templateId || 'default',
        updatedAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Resume updated successfully',
      data: {
        resumeId: updatedResume.id,
        templateId: updatedResume.templateId,
      },
    });
  } catch (error) {
    console.error('Error updating resume JSON:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update resume JSON',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Improve text with AI
 * POST /api/resume-editor/improve-text
 */
async function improveTextWithAI(req, res) {
  try {
    const { text, context } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Text is required',
      });
    }

    // Specialized prompt for summary, otherwise general improvement
    let prompt = '';
    if (context === 'summary' || context?.toLowerCase().includes('summary')) {
      prompt = `You are a professional resume writer. Improve the following professional summary to make it more compelling, concise, and ATS-friendly. 

Requirements:
- Keep it professional and impactful
- Use action verbs and quantifiable achievements where possible
- Maximum 4-5 sentences or 150-200 words
- Remove any redundancy or filler words
- Make it specific to the candidate's experience and skills

Original summary:
${text}

Return ONLY the improved summary text without any additional explanation, formatting, or markdown. Do not include phrases like "Here is the improved summary" or "Improved version:". Just return the improved text directly.`;
    } else {
      prompt = `Improve the following resume text professionally while keeping it concise and ATS-friendly. Context: ${context || 'General resume content'}. 

Original text: ${text}

Return only the improved text without any additional explanation or formatting. Do not include phrases like "Here is the improved text" or "Improved version:". Just return the improved text directly.`;
    }

    let improvedText = '';
    let lastError = null;

    // Try Mistral first (especially for summary)
    if (mistral) {
      try {
        console.log('🔄 Attempting to improve text with Mistral AI...');
        const chatResponse = await mistral.chat.complete({
          model: 'mistral-medium-latest', // Using mistral-medium-latest for better results
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          maxTokens: context === 'summary' ? 300 : 500,
        });
        
        improvedText = chatResponse.choices[0]?.message?.content?.trim() || '';
        
        if (improvedText) {
          console.log('✅ Successfully used Mistral AI for text improvement');
          // Clean up any unwanted prefixes/suffixes
          improvedText = improvedText
            .replace(/^(Here is|Here's|Improved|Enhanced|Revised)[\s:]*/i, '')
            .replace(/^(Summary|Text)[\s:]*/i, '')
            .trim();
        } else {
          console.warn('⚠️ Mistral returned empty response');
          lastError = new Error('Mistral returned empty response');
        }
      } catch (mistralError) {
        console.error('❌ Mistral AI error:', mistralError.message || mistralError);
        lastError = mistralError;
      }
    } else {
      console.warn('⚠️ Mistral AI not initialized');
      lastError = new Error('Mistral AI not configured');
    }

    // Fallback to Gemini only if Mistral failed
    if (!improvedText && genAI) {
      try {
        console.log('🔄 Falling back to Google Gemini...');
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        improvedText = response.text().trim();
        if (improvedText) {
          console.log('✅ Successfully used Google Gemini for text improvement');
          // Clean up any unwanted prefixes/suffixes
          improvedText = improvedText
            .replace(/^(Here is|Here's|Improved|Enhanced|Revised)[\s:]*/i, '')
            .replace(/^(Summary|Text)[\s:]*/i, '')
            .trim();
        }
      } catch (geminiError) {
        console.error('❌ Gemini error:', geminiError.message || geminiError);
        if (!lastError) lastError = geminiError;
      }
    }

    // Fallback to Anthropic
    if (!improvedText && anthropic) {
      try {
        console.log('🔄 Falling back to Anthropic Claude...');
        const message = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: context === 'summary' ? 300 : 500,
          messages: [{ role: 'user', content: prompt }],
        });
        improvedText = message.content[0]?.text?.trim() || '';
        if (improvedText) {
          console.log('✅ Successfully used Anthropic Claude for text improvement');
          // Clean up any unwanted prefixes/suffixes
          improvedText = improvedText
            .replace(/^(Here is|Here's|Improved|Enhanced|Revised)[\s:]*/i, '')
            .replace(/^(Summary|Text)[\s:]*/i, '')
            .trim();
        }
      } catch (anthropicError) {
        console.error('❌ Anthropic error:', anthropicError.message || anthropicError);
        if (!lastError) lastError = anthropicError;
      }
    }

    // Fallback to OpenAI
    if (!improvedText && openai) {
      try {
        console.log('🔄 Falling back to OpenAI...');
        const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: context === 'summary' ? 300 : 500,
        });
        improvedText = completion.choices[0]?.message?.content?.trim() || '';
        if (improvedText) {
          console.log('✅ Successfully used OpenAI for text improvement');
          // Clean up any unwanted prefixes/suffixes
          improvedText = improvedText
            .replace(/^(Here is|Here's|Improved|Enhanced|Revised)[\s:]*/i, '')
            .replace(/^(Summary|Text)[\s:]*/i, '')
            .trim();
        }
      } catch (openaiError) {
        console.error('❌ OpenAI error:', openaiError.message || openaiError);
        if (!lastError) lastError = openaiError;
      }
    }

    if (!improvedText) {
      const errorMessage = lastError?.message || 'Unknown error';
      console.error('❌ All AI services failed. Last error:', errorMessage);
      return res.status(500).json({
        success: false,
        message: `Failed to improve text with AI. ${lastError ? `Error: ${errorMessage}` : 'All services unavailable.'}`,
        error: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      });
    }

    res.json({
      success: true,
      data: {
        originalText: text,
        improvedText: improvedText,
      },
    });
  } catch (error) {
    console.error('❌ Error improving text with AI:', error);
    res.status(500).json({
      success: false,
      message: `Failed to improve text with AI: ${error.message || 'Unknown error'}`,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Get resume versions
 * GET /api/resume-editor/versions/:candidateId
 */
async function getResumeVersions(req, res) {
  try {
    const { candidateId } = req.params;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    const versions = await prisma.resumeVersion.findMany({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
      take: 10, // Limit to last 10 versions
    });

    res.json({
      success: true,
      data: versions.map(v => ({
        id: v.id,
        createdAt: v.createdAt,
        templateId: v.templateId,
      })),
    });
  } catch (error) {
    console.error('Error getting resume versions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get resume versions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Restore resume version
 * POST /api/resume-editor/restore-version/:versionId
 */
async function restoreResumeVersion(req, res) {
  try {
    const { versionId } = req.params;

    if (!versionId) {
      return res.status(400).json({
        success: false,
        message: 'Version ID is required',
      });
    }

    // Get version
    const version = await prisma.resumeVersion.findUnique({
      where: { id: versionId },
    });

    if (!version) {
      return res.status(404).json({
        success: false,
        message: 'Version not found',
      });
    }

    // Get existing resume
    const existingResume = await prisma.resume.findUnique({
      where: { candidateId: version.candidateId },
    });

    if (!existingResume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found',
      });
    }

    // Create version snapshot before restoring
    await prisma.resumeVersion.create({
      data: {
        candidateId: version.candidateId,
        resumeId: existingResume.id,
        resumeJson: existingResume.resumeJson || {},
        templateId: existingResume.templateId || 'default',
      },
    });

    // Restore version
    await prisma.resume.update({
      where: { candidateId: version.candidateId },
      data: {
        resumeJson: version.resumeJson,
        templateId: version.templateId || 'default',
        updatedAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Resume version restored successfully',
    });
  } catch (error) {
    console.error('Error restoring resume version:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restore resume version',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Helper: Get profile data for resume generation
 */
async function getProfileDataForResume(candidateId) {
  const [profile, summary, workExperiences, educations, skills, languages, certifications, projects] = await Promise.all([
    prisma.candidateProfile.findUnique({ where: { candidateId } }),
    prisma.candidateSummary.findUnique({ where: { candidateId } }),
    prisma.workExperience.findMany({ where: { candidateId }, orderBy: { startDate: 'desc' } }),
    prisma.education.findMany({ where: { candidateId }, orderBy: { startYear: 'desc' } }),
    prisma.candidateSkill.findMany({
      where: { candidateId },
      include: { skill: true },
    }),
    prisma.candidateLanguage.findMany({ where: { candidateId } }),
    prisma.candidateCertification.findMany({ where: { candidateId } }),
    prisma.candidateProject.findUnique({ where: { candidateId } }),
  ]);

  return {
    profile,
    summary,
    workExperiences,
    educations,
    skills,
    languages,
    certifications,
    projects,
  };
}

/**
 * Helper: Generate default resume JSON from profile data
 */
function generateDefaultResumeJSON(profileData) {
  const { profile, summary, workExperiences, educations, skills, languages, certifications, projects } = profileData;

  return {
    name: profile?.fullName || '',
    title: profile?.employmentStatus || '',
    summary: summary?.summaryText || '',
    experience: (workExperiences || []).map(exp => ({
      role: exp.jobTitle,
      company: exp.company,
      start_date: exp.startDate ? (typeof exp.startDate === 'string' ? exp.startDate : new Date(exp.startDate).getFullYear().toString()) : '',
      end_date: exp.endDate ? (typeof exp.endDate === 'string' ? exp.endDate : new Date(exp.endDate).getFullYear().toString()) : (exp.isCurrentJob ? 'Present' : ''),
      description: exp.jobDescription || exp.responsibilities || '',
      location: exp.workLocation || '',
    })),
    education: (educations || []).map(edu => ({
      degree: edu.degree,
      institution: edu.institution,
      start_year: edu.startYear?.toString() || '',
      end_year: edu.endYear?.toString() || (edu.isOngoing ? 'Present' : ''),
      specialization: edu.specialization || '',
      grade: edu.grade || '',
    })),
    skills: (skills || []).map(s => s.skill?.name || s.skillId).filter(Boolean),
    languages: (languages || []).map(lang => ({
      name: lang.name,
      proficiency: lang.proficiency,
    })),
    certifications: (certifications || []).map(cert => ({
      name: cert.certificationName,
      organization: cert.issuingOrganization,
      issue_date: cert.issueDate,
      expiry_date: cert.expiryDate || '',
      credential_id: cert.credentialId || '',
      credential_url: cert.credentialUrl || '',
    })),
    projects: projects ? [{
      title: projects.projectTitle,
      description: projects.projectDescription || '',
      link: projects.projectLink || '',
      technologies: projects.technologies || [],
    }] : [],
    custom_sections: [],
  };
}

module.exports = {
  getResumeJSON,
  updateResumeJSON,
  improveTextWithAI,
  getResumeVersions,
  restoreResumeVersion,
};
