const { prisma } = require('../../lib/prisma');
const {
  improveResumeSection,
  checkResumeATS,
  generateResumeSummary,
  tailorResumeSummaryForJob,
} = require('./ai.lms.service');
const { OPENAI_CHAT_MODEL } = require('../../config/openaiModel');

function calculateStrengthScore(draft) {
  let score = 0;
  
  // Basics complete (30 points)
  if (draft.basics) {
    const b = draft.basics;
    if (b.name && b.email && b.phone) score += 30;
  }

  // Skills count > 3 (20 points)
  if (Array.isArray(draft.skills) && draft.skills.length > 3) {
    score += 20;
  }

  // At least 1 experience (25 points)
  if (Array.isArray(draft.experience) && draft.experience.length > 0) {
    score += 25;
  }

  // Summary length > 50 (15 points)
  if (draft.basics && draft.basics.summary && draft.basics.summary.length > 50) {
    score += 15;
  }

  // At least 1 education entry (10 points)
  if (Array.isArray(draft.education) && draft.education.length > 0) {
    score += 10;
  }

  return score;
}

async function fetchDraft(userId) {
  const [draft, profile, candidate, summary, experiences, educations, candidateSkills] = await Promise.all([
    prisma.lmsResumeDraft.findUnique({ where: { userId } }),
    prisma.candidateProfile.findUnique({ where: { candidateId: userId } }),
    prisma.candidate.findUnique({ where: { id: userId } }),
    prisma.candidateSummary.findUnique({ where: { candidateId: userId } }),
    prisma.workExperience.findMany({ where: { candidateId: userId }, orderBy: { startDate: 'desc' } }),
    prisma.education.findMany({ where: { candidateId: userId }, orderBy: { startYear: 'desc' } }),
    prisma.candidateSkill.findMany({
      where: { candidateId: userId },
      include: { skill: true },
    }),
  ]);

  const latestExperience = experiences[0];
  const profileBasics = {
    name: profile?.fullName || '',
    headline: latestExperience?.jobTitle || profile?.employmentStatus || '',
    email: profile?.email || '',
    phone: profile?.phoneNumber && candidate?.whatsappNumber && profile.phoneNumber !== candidate.whatsappNumber 
      ? `${profile.phoneNumber} / ${candidate.whatsappNumber}` 
      : (profile?.phoneNumber || candidate?.whatsappNumber || ''),
    location: profile ? `${profile.city || ''}${profile.city && profile.country ? ', ' : ''}${profile.country || ''}` : '',
    summary: summary?.summaryText || ''
  };

  if (draft) {
    // Merge strategy: If draft basics are empty for key fields, fill from profile
    const b = draft.basics || {};
    draft.basics = {
      name: b.name || profileBasics.name,
      headline: b.headline || profileBasics.headline,
      email: b.email || profileBasics.email,
      phone: b.phone || profileBasics.phone,
      location: b.location || profileBasics.location,
      summary: b.summary || profileBasics.summary
    };

    // Populate empty lists if needed
    if (!draft.skills?.length && candidateSkills.length) {
      draft.skills = candidateSkills.map(s => s.skill?.name || s.skillId).filter(Boolean);
    }
    if (!draft.experience?.length && experiences.length) {
      draft.experience = experiences.map(exp => ({
        id: exp.id,
        company: exp.company || '',
        role: exp.jobTitle || '',
        duration: exp.startDate ? `${new Date(exp.startDate).getFullYear()} - ${exp.endDate ? new Date(exp.endDate).getFullYear() : 'Present'}` : '',
        bullets: exp.jobDescription || exp.responsibilities || ''
      }));
    }
    if (!draft.education?.length && educations.length) {
      draft.education = educations.map(edu => ({
        id: edu.id,
        institution: edu.institution || '',
        degree: edu.degree || '',
        duration: edu.startYear ? `${edu.startYear} - ${edu.endYear || 'Present'}` : ''
      }));
    }
    
    return draft;
  }

  // FALLBACK: If no draft exists, generate one from the candidate's primary profile
  if (!profile && !experiences.length) return null;

  return {
    userId,
    basics: profileBasics,
    skills: candidateSkills.map(s => s.skill?.name || s.skillId).filter(Boolean),
    experience: experiences.map(exp => ({
      id: exp.id,
      company: exp.company || '',
      role: exp.jobTitle || '',
      duration: exp.startDate ? `${new Date(exp.startDate).getFullYear()} - ${exp.endDate ? new Date(exp.endDate).getFullYear() : 'Present'}` : '',
      bullets: exp.jobDescription || exp.responsibilities || ''
    })),
    education: educations.map(edu => ({
      id: edu.id,
      institution: edu.institution || '',
      degree: edu.degree || '',
      duration: edu.startYear ? `${edu.startYear} - ${edu.endYear || 'Present'}` : ''
    })),
    templateId: 'modern-minimal',
    strengthScore: 50,
    lastSavedAt: new Date()
  };
}

async function upsertDraft(userId, payload) {
  // Frontend might wrap sections in 'content'
  const content = payload.content || payload;
  const { basics, skills, experience, education, certifications, layoutMatrix, templateId, summary, jobTailorJobId } =
    content;
  
  // Merge summary into basics if it's passed separately (as in the frontend state)
  const finalBasics = {
    ...(basics || {}),
    summary: summary || basics?.summary || ''
  };

  const draftData = {
    userId,
    basics: finalBasics,
    skills: Array.isArray(skills) ? skills : (typeof skills === 'string' ? skills.split(',').map(s => s.trim()).filter(Boolean) : []),
    experience: experience || [],
    education: education || [],
    certifications: certifications || [],
    layoutMatrix: layoutMatrix || payload.layoutMatrix || 'default',
    templateId: templateId || payload.templateId || 'modern-minimal'
  };

  const strengthScore = calculateStrengthScore(draftData);

  // Use upsert to handle race conditions and avoid "record not found" errors
  const draft = await prisma.lmsResumeDraft.upsert({
    where: { userId },
    update: {
      ...draftData,
      strengthScore,
      lastSavedAt: new Date(),
      syncedToCareerPath: false // user made a change, desync
    },
    create: {
      ...draftData,
      strengthScore,
      lastSavedAt: new Date(),
      syncedToCareerPath: false
    }
  });

  const jobTitle = payload.jobTitle || content.jobTitle || null;
  const company = payload.company || content.company || null;
  const resumeHtml = payload.resumeHtml || content.resumeHtml || null;

  try {
    await upsertRoleVersion(userId, draft, {
      jobTailorJobId,
      jobTitle,
      company,
      resumeHtml,
      draftData,
    });
  } catch (versionError) {
    console.warn(
      `[resume.service] role version save failed | userId=${userId}`,
      versionError?.message || versionError,
    );
  }

  if (jobTailorJobId) {
    console.log(
      `[resume.service] JD tailor save | userId=${userId} | jobId=${jobTailorJobId} | headline=${finalBasics.headline || 'n/a'} | skills=${draftData.skills.length}`,
    );
  }

  return draft;
}

function buildRoleVersionLabel(jobTitle, jobTailorJobId) {
  const role = String(jobTitle || '').trim();
  if (role) return `${role} CV`;
  if (jobTailorJobId) return 'Role-tailored CV';
  return 'Studio CV';
}

async function upsertRoleVersion(userId, draft, meta = {}) {
  const { jobTailorJobId, jobTitle, company, resumeHtml, draftData } = meta;
  const label = buildRoleVersionLabel(jobTitle, jobTailorJobId);
  const versionType = jobTailorJobId ? 'role-tailored' : 'general';
  const snapshot = {
    basics: draft.basics,
    skills: draft.skills,
    experience: draft.experience,
    education: draft.education,
    certifications: draft.certifications,
    templateId: draft.templateId || draftData?.templateId || 'modern-minimal',
    strengthScore: draft.strengthScore,
    summary: draft.basics?.summary || draftData?.basics?.summary || '',
  };

  const versionPayload = {
    label,
    versionType,
    jobTitle: jobTitle || null,
    company: company || null,
    templateId: snapshot.templateId,
    draftSnapshot: snapshot,
    resumeHtml: resumeHtml || null,
    updatedAt: new Date(),
  };

  if (jobTailorJobId) {
    const existing = await prisma.lmsResumeRoleVersion.findFirst({
      where: { userId, jobId: String(jobTailorJobId) },
    });
    if (existing) {
      return prisma.lmsResumeRoleVersion.update({
        where: { id: existing.id },
        data: versionPayload,
      });
    }
    return prisma.lmsResumeRoleVersion.create({
      data: {
        userId,
        jobId: String(jobTailorJobId),
        ...versionPayload,
      },
    });
  }

  const existingGeneral = await prisma.lmsResumeRoleVersion.findFirst({
    where: { userId, versionType: 'general', jobId: null },
    orderBy: { updatedAt: 'desc' },
  });
  if (existingGeneral) {
    return prisma.lmsResumeRoleVersion.update({
      where: { id: existingGeneral.id },
      data: versionPayload,
    });
  }
  return prisma.lmsResumeRoleVersion.create({
    data: {
      userId,
      jobId: null,
      ...versionPayload,
    },
  });
}

async function listRoleVersions(userId) {
  const [uploadedResume, roleVersions] = await Promise.all([
    prisma.resume.findUnique({ where: { candidateId: userId } }),
    prisma.lmsResumeRoleVersion.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        label: true,
        versionType: true,
        jobId: true,
        jobTitle: true,
        company: true,
        templateId: true,
        fileUrl: true,
        fileName: true,
        resumeHtml: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const original = uploadedResume
    ? {
        id: uploadedResume.id,
        label: 'Original CV',
        versionType: 'original',
        fileName: uploadedResume.fileName,
        fileUrl: uploadedResume.fileUrl,
        fileSize: uploadedResume.fileSize,
        mimeType: uploadedResume.mimeType,
        atsScore: uploadedResume.atsScore,
        uploadedAt: uploadedResume.uploadedAt,
        updatedAt: uploadedResume.updatedAt,
      }
    : null;

  return {
    original,
    versions: roleVersions.map(({ resumeHtml, ...rest }) => ({
      ...rest,
      hasResumeHtml: Boolean(String(resumeHtml || '').trim().length > 80),
    })),
  };
}

async function getRoleVersionById(userId, versionId) {
  const version = await prisma.lmsResumeRoleVersion.findFirst({
    where: { id: String(versionId || '').trim(), userId },
    select: {
      id: true,
      label: true,
      versionType: true,
      jobId: true,
      jobTitle: true,
      company: true,
      templateId: true,
      fileUrl: true,
      fileName: true,
      resumeHtml: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!version) {
    throw new Error('CV version not found');
  }
  return {
    ...version,
    hasResumeHtml: Boolean(String(version.resumeHtml || '').trim().length > 80),
  };
}

async function syncToCareerPath(userId) {
  const draft = await fetchDraft(userId);
  if (!draft) throw new Error('No draft found to sync');

  await prisma.lmsResumeDraft.update({
    where: { userId },
    data: { syncedToCareerPath: true }
  });

  const status = draft.strengthScore > 70 ? 'completed' : 'in-progress';

  let careerPath = await prisma.lmsCareerPath.findUnique({ where: { userId } });
  
  if (!careerPath) {
    careerPath = await prisma.lmsCareerPath.create({
      data: { userId, roadmapItems: [] }
    });
  }

  const roadmapItems = careerPath.roadmapItems || [];
  const existingIndex = roadmapItems.findIndex(i => i.targetType === 'resume');

  let updatedItems = [...roadmapItems];

  if (existingIndex > -1) {
    updatedItems[existingIndex] = {
      ...updatedItems[existingIndex],
      status,
      ...(status === 'completed' && { completedAt: new Date().toISOString() })
    };
  } else {
    updatedItems.push({
      id: `rt_${Date.now()}`,
      title: 'Build Strong Resume',
      phase: careerPath.currentPhase,
      status,
      targetType: 'resume',
      targetId: draft.id,
      targetRoute: '/lms/resume-builder',
      reason: 'Resume draft synchronized.',
      ...(status === 'completed' && { completedAt: new Date().toISOString() })
    });
  }

  await prisma.lmsCareerPath.update({
    where: { userId },
    data: { roadmapItems: updatedItems }
  });

  return { careerPathUpdated: true };
}

async function improveAi(section, content, targetRole) {
  return improveResumeSection(section, content, targetRole);
}

async function generateSummary(userId, headline) {
  const draft = await fetchDraft(userId);
  let experienceContext = '';
  
  if (draft && draft.experience?.length) {
    // Collect some bullet points to give context for more accurate summary
    experienceContext = draft.experience.slice(0, 2).map(exp => `${exp.role} at ${exp.company}`).join(', ');
  }

  return generateResumeSummary(headline, experienceContext);
}

async function tailorSummaryForJob(userId, payload = {}) {
  const draft = await fetchDraft(userId);
  let experienceContext = '';
  if (draft?.experience?.length) {
    experienceContext = draft.experience
      .slice(0, 2)
      .map((exp) => `${exp.role} at ${exp.company}`)
      .join(', ');
  }

  return tailorResumeSummaryForJob({
    existingSummary: payload.existingSummary || draft?.summary || '',
    jobTitle: payload.jobTitle || draft?.basics?.headline || '',
    company: payload.company || '',
    experienceLevel: payload.experienceLevel || '',
    matchedSkills: payload.matchedSkills || [],
    missingSkills: payload.missingSkills || [],
    experienceContext,
  });
}

async function analyzeDraft(userId) {
  const draft = await fetchDraft(userId);
  if (!draft) throw new Error('No resume draft found');

  const resumeData = {
    basics: draft.basics,
    summary: draft.summary,
    skills: draft.skills,
    experience: draft.experience,
    education: draft.education
  };

  const targetRole = draft.basics?.headline || 'Professional';
  
  const prompt = `Analyze this resume for a recruiter. 
Target Role: ${targetRole}
Resume: ${JSON.stringify(resumeData, null, 2)}

Return ONLY a JSON object with this shape:
{
  "readinessScore": 85,
  "recruiterView": "What a recruiter thinks in 3 seconds.",
  "strengths": ["Strength 1", "Strength 2"],
  "gaps": ["Gap 1", "Gap 2"],
  "nextSteps": ["Action 1", "Action 2"]
}`;

  try {
    const { improveResumeSection } = require('./ai.lms.service'); // Using a general helper or adding a new specialized AI function
    const openai = require('./ai.lms.service').getOpenAIClient();
    
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: OPENAI_CHAT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      });
      
      const cleaned = completion.choices[0].message.content
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
        
      return JSON.parse(cleaned);
    }
    
    // Fallback or error
    throw new Error('AI analysis unavailable');
  } catch (error) {
    console.error('analyzeDraft error:', error);
    return {
      readinessScore: 50,
      recruiterView: "AI analysis encountered an error. Please try again.",
      strengths: [],
      gaps: ["Analysis failed"],
      nextSteps: ["Retry analysis"]
    };
  }
}

async function checkAtsMatch(userId, jobDescription) {
  const draft = await fetchDraft(userId);
  if (!draft) throw new Error('No resume draft found');

  return checkResumeATS(draft, jobDescription);
}

module.exports = {
  fetchDraft,
  upsertDraft,
  syncToCareerPath,
  improveAi,
  generateSummary,
  tailorSummaryForJob,
  analyzeDraft,
  checkAtsMatch,
  listRoleVersions,
  getRoleVersionById,
};
