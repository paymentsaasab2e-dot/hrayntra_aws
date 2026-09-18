const { prisma } = require('../lib/prisma');
const { isPortalPlaceholderFullName } = require('../utils/portal-profile-placeholder.util');
const { normalizeContentLocale, translateBatch } = require('../services/contentTranslation.service');
const { localizePortalJobs } = require('../utils/localizePortalJob.util');
const { parseResumeFromBuffer } = require('../services/resume-parser.service');
const { convertToLaTeX } = require('../services/cv-parser.service');
const { persistExtractedCvProfile } = require('../services/cv-profile-persist.service');
const { generateProfileExtractPdf } = require('../services/profile-extract-pdf.service');
const { uploadBufferToCloudinary } = require('../lib/s3');

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

function splitFullName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return { firstName: null, lastName: null };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: null };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

/**
 * Upload and process CV
 * POST /api/cv/upload
 */
async function uploadCV(req, res) {
  try {
    const candidateId = req.body.candidateId || req.params.candidateId;
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

    const ext = require('path').extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
    const mimeOk = allowedMimeTypes.includes(file.mimetype);
    const extOk = allowedExtensions.includes(ext);

    if (!mimeOk && !extOk) {
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
    console.log('📄 CV UPLOAD (async parse) STARTED');
    console.log('='.repeat(80));
    console.log('Candidate ID:', candidateId);
    console.log('File Name:', file.originalname);
    console.log('File Size:', (file.size / 1024).toFixed(2), 'KB');
    console.log('File Type:', file.mimetype);
    console.log('-'.repeat(80));

    const { STATUSES, setJob } = require('../services/cv-parse-job.service');
    const jobId = candidateId;
    setJob(candidateId, { status: STATUSES.QUEUED, stage: 'uploading', error: null });

    const timestamp = Date.now();
    const sanitizedOriginalName = String(file.originalname || 'cv').replace(/[^a-zA-Z0-9._-]/g, '_');
    const cvUpload = await uploadBufferToCloudinary({
      buffer: file.buffer,
      folder: 'jobportal/cv-files',
      resourceType: 'raw',
      publicId: `${candidateId}_${timestamp}_${sanitizedOriginalName}`,
      originalFilename: file.originalname,
      candidateId,
    });

    const existingResume = await prisma.resume.findUnique({ where: { candidateId } });
    const priorJson =
      existingResume?.resumeJson && typeof existingResume.resumeJson === 'object'
        ? existingResume.resumeJson
        : {};

    const resume = await prisma.resume.upsert({
      where: { candidateId },
      update: {
        fileName: file.originalname,
        fileUrl: cvUpload.secure_url,
        fileSize: file.size,
        mimeType: file.mimetype,
        aiAnalyzed: false,
        resumeJson: {
          ...priorJson,
          parseStatus: STATUSES.QUEUED,
          parseJobId: jobId,
          parseError: null,
          parseAttempts: 0,
          parseQueuedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      },
      create: {
        candidateId,
        fileName: file.originalname,
        fileUrl: cvUpload.secure_url,
        fileSize: file.size,
        mimeType: file.mimetype,
        aiAnalyzed: false,
        resumeJson: {
          parseStatus: STATUSES.QUEUED,
          parseJobId: jobId,
          parseAttempts: 0,
          parseQueuedAt: new Date().toISOString(),
        },
      },
    });

    // Background: parse + persist + optional secondary analysis (does not block HTTP).
    const fileSnapshot = {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };
    setImmediate(() => {
      void processCvParseJob({
        candidateId,
        jobId,
        file: fileSnapshot,
        fileUrl: cvUpload.secure_url,
        candidate,
      });
    });

    let cvUploadEarn = null;
    try {
      const tokenService = require('../services/token.service');
      cvUploadEarn = await tokenService.earnOnce(
        candidateId,
        'earn.cv_upload',
        'Earned tokens for uploading CV'
      );
    } catch (earnErr) {
      console.warn('[tokens] CV upload earn skipped:', earnErr?.message || earnErr);
    }

    return res.json({
      success: true,
      message: 'CV uploaded. Parsing started in the background.',
      jobId,
      status: STATUSES.QUEUED,
      data: {
        jobId,
        status: STATUSES.QUEUED,
        resumeId: resume.id,
        fileName: file.originalname,
        fileUrl: cvUpload.secure_url,
        tokenEarn: cvUploadEarn?.granted
          ? { amount: cvUploadEarn.amount, earnKey: cvUploadEarn.earnKey }
          : null,
        tokenBalance: cvUploadEarn?.tokenBalance,
      },
    });
  } catch (error) {
    console.error('Error uploading CV:', error);
    try {
      const { STATUSES, setJob } = require('../services/cv-parse-job.service');
      if (req.body?.candidateId) {
        setJob(req.body.candidateId, {
          status: STATUSES.FAILED,
          error: error?.message || 'Upload failed',
        });
      }
    } catch {
      /* ignore */
    }
    res.status(500).json({
      success: false,
      message: 'Failed to upload CV',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Background CV parse pipeline (text extract once → AI → persist → optional analyzeCV).
 * Durable claim via Mongo parseStatus; can resume from fileUrl after restart.
 */
async function processCvParseJob({ candidateId, jobId, file, fileUrl, candidate }) {
  const {
    STATUSES,
    setJob,
    claimQueuedJob,
    markJobCompleted,
    markJobFailed,
    RETRY_DELAY_MS,
    MAX_ATTEMPTS,
  } = require('../services/cv-parse-job.service');
  const { extractPortfolioUrls } = require('../services/resume-parser.service');
  const workerId = `pid:${process.pid}:${Date.now().toString(36)}`;

  const claimed = await claimQueuedJob(candidateId, workerId);
  if (!claimed) {
    console.log(`[cv-job ${jobId}] skip — not claimable (another worker or terminal state)`);
    return;
  }

  const timing = {
    jobId,
    candidateId,
    t0: Date.now(),
    downloadMs: 0,
    extractMs: 0,
    aiMs: 0,
    portfolioMs: 0,
    persistMs: 0,
    totalMs: 0,
  };

  let buffer = file?.buffer || null;
  let mimetype = file?.mimetype || claimed.mimeType || 'application/pdf';
  let originalname = file?.originalname || claimed.fileName || 'cv.pdf';
  const resolvedUrl = fileUrl || claimed.fileUrl;

  try {
    if (!buffer && resolvedUrl) {
      setJob(candidateId, { status: STATUSES.PROCESSING, stage: 'download', error: null });
      const tDown = Date.now();
      const resp = await fetch(resolvedUrl);
      if (!resp.ok) {
        throw new Error(`Failed to download CV from storage (${resp.status})`);
      }
      buffer = Buffer.from(await resp.arrayBuffer());
      timing.downloadMs = Date.now() - tDown;
    }
    if (!buffer) {
      throw new Error('CV file buffer unavailable and no fileUrl to recover from');
    }

    setJob(candidateId, { status: STATUSES.PROCESSING, stage: 'extracting', error: null });
    const { patchPersistedJob } = require('../services/cv-parse-job.service');
    await patchPersistedJob(candidateId, {
      parseStatus: STATUSES.PROCESSING,
      parseStage: 'extracting',
      parseStartedAt: new Date().toISOString(),
    });

    console.log(`\n🔄 [cv-job ${jobId}] parsing for ${candidateId} (attempt ${claimed.attempts || 1})`);
    const tAi = Date.now();
    const parsedData = await parseResumeFromBuffer(buffer, mimetype, originalname);
    timing.aiMs = Date.now() - tAi;
    // extract+AI are coupled inside parseResumeFromBuffer; report as aiMs (includes text extract)
    timing.extractMs = timing.aiMs;

    setJob(candidateId, { status: STATUSES.PROCESSING, stage: 'persisting' });
    await patchPersistedJob(candidateId, { parseStage: 'persisting' });

    const tPort = Date.now();
    // Reuse AI-extracted portfolio links; only regex-scan when AI returned none.
    let portfolioUrls = (Array.isArray(parsedData.portfolioLinks) ? parsedData.portfolioLinks : [])
      .map((link) => ({
        url: link.url,
        linkType: link.linkType || 'Portfolio Website',
        title: link.title || link.linkType || 'Portfolio',
        description: link.description || null,
      }))
      .filter((link) => link.url);

    if (portfolioUrls.length === 0) {
      const rawText =
        typeof parsedData._rawText === 'string'
          ? parsedData._rawText
          : [
              parsedData.personalInformation?.fullName,
              parsedData.personalInformation?.email,
              parsedData.personalInformation?.linkedinProfile,
            ]
              .filter(Boolean)
              .join('\n');
      if (rawText) {
        portfolioUrls = extractPortfolioUrls(rawText) || [];
      }
    }

    portfolioUrls = portfolioUrls.filter(
      (link, index, arr) => link.url && arr.findIndex((x) => x.url === link.url) === index,
    );
    timing.portfolioMs = Date.now() - tPort;

    if (portfolioUrls.length > 0) {
      const linksWithIds = portfolioUrls.map((link, index) => ({
        id: `link-${Date.now()}-${index}`,
        linkType: link.linkType,
        url: link.url,
        title: link.title,
        description: link.description,
      }));
      await prisma.candidatePortfolioLinks.upsert({
        where: { candidateId },
        update: { links: linksWithIds, updatedAt: new Date() },
        create: { candidateId, links: linksWithIds },
      });
    }

    const tPersist = Date.now();
    const technicalSkills = Array.isArray(parsedData.skills) ? parsedData.skills : [];
    const languages = Array.isArray(parsedData.languages) ? parsedData.languages : [];
    const cvData = {
      personalInfo: parsedData.personalInformation,
      education: parsedData.education,
      workExperience: parsedData.workExperience,
      skills: technicalSkills.map((s) => ({
        name: s.name || s.languageName,
        category: s.category || null,
        proficiency: s.proficiency,
        yearsOfExp: s.yearsOfExp || null,
      })),
      languages,
      summary: parsedData.summary || null,
    };

    let latexFileUrl = null;
    try {
      const latexContent = convertToLaTeX(cvData);
      const latexUpload = await uploadBufferToCloudinary({
        buffer: Buffer.from(latexContent, 'utf8'),
        folder: 'jobportal/cv-latex',
        resourceType: 'raw',
        publicId: `${candidateId}_${Date.now()}_cv_tex`,
        originalFilename: `${candidateId}_cv.tex`,
        candidateId,
      });
      latexFileUrl = latexUpload.secure_url;
    } catch (latexErr) {
      console.warn('[cv-job] LaTeX upload skipped:', latexErr?.message || latexErr);
    }

    const resumeJsonData = {
      ...parsedData,
      extractedAt: new Date().toISOString(),
      extractionVersion: 'full-profile-v2-async-durable',
      parseStatus: STATUSES.COMPLETED,
      parseStage: 'completed',
      parseCompletedAt: new Date().toISOString(),
      parseJobId: jobId,
      parseLockedBy: null,
      parseLockedAt: null,
      latexFileUrl,
      fileUrl: resolvedUrl,
    };
    delete resumeJsonData._rawText;

    await prisma.resume.update({
      where: { candidateId },
      data: {
        aiAnalyzed: true,
        resumeJson: resumeJsonData,
        updatedAt: new Date(),
      },
    });

    const persistStats = await persistExtractedCvProfile(candidateId, parsedData, { candidate });
    console.log(`[cv-job ${jobId}] profile persist:`, persistStats);
    timing.persistMs = Date.now() - tPersist;

    try {
      const profilePdfBuffer = await generateProfileExtractPdf(parsedData);
      const pdfUpload = await uploadBufferToCloudinary({
        buffer: profilePdfBuffer,
        folder: 'jobportal/cv-extract-pdfs',
        resourceType: 'raw',
        publicId: `${candidateId}_${Date.now()}_profile_extract`,
        originalFilename: `${candidateId}_profile_extract.pdf`,
        candidateId,
      });
      await patchPersistedJob(candidateId, { profileExtractPdfUrl: pdfUpload.secure_url });
    } catch (pdfErr) {
      console.warn('[cv-job] profile extract PDF skipped:', pdfErr?.message || pdfErr);
    }

    setImmediate(async () => {
      try {
        const { analyzeCV } = require('./cv-analysis.controller');
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

    await markJobCompleted(candidateId);
    setJob(candidateId, { status: STATUSES.COMPLETED, stage: 'completed', error: null });
    timing.totalMs = Date.now() - timing.t0;
    console.log(
      `[CV_PARSE_TIMING] jobId=${jobId} downloadMs=${timing.downloadMs} extractMs=${timing.extractMs} aiMs=${timing.aiMs} portfolioMs=${timing.portfolioMs} persistMs=${timing.persistMs} totalMs=${timing.totalMs}`,
    );
    console.log(`✅ [cv-job ${jobId}] completed for ${candidateId}`);
  } catch (error) {
    timing.totalMs = Date.now() - timing.t0;
    console.log(
      `[CV_PARSE_TIMING] jobId=${jobId} failed=1 downloadMs=${timing.downloadMs} aiMs=${timing.aiMs} totalMs=${timing.totalMs}`,
    );
    console.error(`❌ [cv-job ${jobId}] failed:`, error?.message || error);
    const attempts = Number(claimed.attempts) || 1;
    const requeue = attempts < MAX_ATTEMPTS;
    await markJobFailed(candidateId, error?.message || 'Parse failed', { requeue });
    setJob(candidateId, {
      status: requeue ? STATUSES.QUEUED : STATUSES.FAILED,
      stage: requeue ? 'retry_queued' : 'failed',
      error: error?.message || 'Parse failed',
    });
    try {
      await prisma.resume.update({
        where: { candidateId },
        data: { aiAnalyzed: false },
      });
    } catch {
      /* ignore */
    }
    if (requeue) {
      console.log(`[cv-job ${jobId}] re-queue in ${RETRY_DELAY_MS}ms (attempt ${attempts}/${MAX_ATTEMPTS})`);
      setTimeout(() => {
        void processCvParseJob({
          candidateId,
          jobId,
          file: null,
          fileUrl: resolvedUrl,
          candidate,
        });
      }, RETRY_DELAY_MS);
    }
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
    const { getJob, readPersistedJob, STATUSES } = require('../services/cv-parse-job.service');

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
        status: STATUSES.FAILED,
      });
    }

    const resume = await prisma.resume.findUnique({
      where: { candidateId: candidateId },
    });

    const mem = getJob(candidateId);
    const persisted = await readPersistedJob(candidateId);
    const json =
      resume?.resumeJson && typeof resume.resumeJson === 'object' ? resume.resumeJson : {};
    // Prefer durable Mongo status so any instance can answer correctly.
    const parseStatus =
      persisted?.status ||
      mem?.status ||
      json.parseStatus ||
      (resume?.aiAnalyzed ? STATUSES.COMPLETED : resume ? STATUSES.PROCESSING : STATUSES.QUEUED);
    const processed = parseStatus === STATUSES.COMPLETED && resume?.aiAnalyzed === true;
    const failed = parseStatus === STATUSES.FAILED;

    res.json({
      success: true,
      processed,
      hasResume: !!resume,
      aiAnalyzed: resume?.aiAnalyzed || false,
      status: parseStatus,
      stage: persisted?.stage || mem?.stage || json.parseStage || null,
      error: failed
        ? persisted?.error || mem?.error || json.parseError || 'Parse failed'
        : null,
      jobId: json.parseJobId || candidateId,
      attempts: persisted?.attempts || Number(json.parseAttempts) || 0,
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

    // Map profile data to frontend BasicInfoData format
    const nameParts = (candidate.profile?.fullName || '').trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '';

    const personalInfo = {
      firstName,
      middleName,
      lastName,
      email: displayEmail,
      phone: candidate.profile?.phoneNumber || '',
      phoneCode: candidate.profile?.phoneNumber ? '' : (whatsappNumber ? '' : '+237 (Cameroon)'), // Default if nothing else
      whatsappNumber: whatsappNumber,
      alternatePhone: candidate.profile?.alternatePhone || '',
      gender: candidate.profile?.gender ? (candidate.profile.gender.charAt(0) + candidate.profile.gender.slice(1).toLowerCase()) : '',
      dob: candidate.profile?.dateOfBirth ? candidate.profile.dateOfBirth.toISOString().split('T')[0] : '',
      city: candidate.profile?.city || '',
      country: candidate.profile?.country || '',
      employment: candidate.profile?.employmentStatus ? (candidate.profile.employmentStatus.charAt(0) + candidate.profile.employmentStatus.slice(1).toLowerCase()) : '',
      passportNumber: candidate.profile?.passportNumber || '',
    };

    const profileData = {
      personalInfo,
      // Keep legacy personalInformation for backward compatibility if needed by other components
      personalInformation: {
        fullName: candidate.profile?.fullName || '',
        email: displayEmail,
        phoneNumber: candidate.profile?.phoneNumber || whatsappNumber || '',
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
    const locale = normalizeContentLocale(req.query.locale);
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

    // Sync this candidate to candidatecommon only when they open the dashboard (non-blocking).
    setImmediate(() => {
      const { persistCandidateSnapshotAndSync } = require('../services/candidateCommonSync.service');
      void persistCandidateSnapshotAndSync(candidateId, { lastLogin: true }).catch((err) => {
        console.warn('[candidateCommon] dashboard sync skipped:', err?.message || err);
      });
    });

    // Sync earn lifecycle: welcome, CV already on file (signup), completed profile sections.
    let welcomeGrant = null;
    try {
      const tokenService = require('../services/token.service');
      const lifecycleSync = await tokenService.syncLifecycleEarns(candidateId);
      const bal = await tokenService.getBalance(candidateId);
      const welcomeHit = lifecycleSync?.granted?.find((g) => g.earnKey === 'welcome');
      welcomeGrant = {
        granted: Boolean(welcomeHit),
        amount: welcomeHit?.amount,
        tokenBalance: bal.tokenBalance,
      };
    } catch (tokenErr) {
      console.warn('[tokens] lifecycle sync skipped:', tokenErr?.message || tokenErr);
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
      { label: 'Screening', value: applicationStatusCounts.UNDER_REVIEW, color: '#FACC15' },
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
        fullName: (() => {
          const raw = String(candidate.profile?.fullName || '').trim();
          if (raw && !isPortalPlaceholderFullName(raw)) return raw;
          return '';
        })(),
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
          app.status && ['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'ASSESSMENT', 'INTERVIEW'].includes(app.status)
        ).length,
        interviews: applicationStatusCounts.INTERVIEW,
        savedJobs: candidate.savedJobs.length,
        profileCompleteness: candidate.profile?.profileCompleteness || 0,
        cvScore: candidate.dashboardStats?.cvScore || 0,
        marketFit: candidate.dashboardStats?.marketFit || 0,
        reviewing: applicationStatusCounts.UNDER_REVIEW + applicationStatusCounts.SHORTLISTED + applicationStatusCounts.ASSESSMENT,
        offersReceived: applicationStatusCounts.SELECTED,
        rejected: applicationStatusCounts.REJECTED,
        tokenBalance: welcomeGrant?.tokenBalance ?? candidate.tokenBalance ?? 0,
        welcomeTokensGranted: Boolean(welcomeGrant?.granted),
        welcomeTokenAmount: welcomeGrant?.granted ? welcomeGrant.amount : undefined,
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
        jobTitle: app.job?.title || 'Unknown Role',
        company: app.job?.company?.name || 'Unknown Company',
        status: app.status,
        appliedAt: app.appliedAt,
        matchScore: app.matchScore,
      })),
      topSkills: candidate.skills.slice(0, 10).map((cs) => ({
        name: cs.skill?.name || 'Unknown Skill',
        proficiency: cs.proficiency,
      })),
      savedJobs: candidate.savedJobs.map((sj) => ({
        id: sj.job?.id || '',
        title: sj.job?.title || 'Unknown Role',
        company: sj.job?.company?.name || 'Unknown Company',
        location: sj.job?.location || null,
        savedAt: sj.savedAt,
      })),
    };

    if (locale === 'fr') {
      const skillTexts = dashboardData.topSkills
        .map((skill) => skill.name)
        .filter((name) => name && name !== 'Unknown Skill');
      const skillTranslations = await translateBatch(skillTexts, locale, 'en');
      dashboardData.topSkills = dashboardData.topSkills.map((skill) => ({
        ...skill,
        name: skillTranslations.get(skill.name) || skill.name,
      }));

      if (dashboardData.savedJobs.length) {
        const localizedSaved = await localizePortalJobs(
          dashboardData.savedJobs.map((job) => ({
            title: job.title,
            company: job.company,
            location: job.location || '',
          })),
          locale,
        );
        dashboardData.savedJobs = dashboardData.savedJobs.map((job, index) => ({
          ...job,
          title: localizedSaved[index]?.title || job.title,
          company: localizedSaved[index]?.company || job.company,
          location: localizedSaved[index]?.location || job.location,
        }));
      }

      if (dashboardData.recentApplications.length) {
        const localizedApplications = await localizePortalJobs(
          dashboardData.recentApplications.map((app) => ({
            title: app.jobTitle,
            company: app.company,
            location: '',
          })),
          locale,
        );
        dashboardData.recentApplications = dashboardData.recentApplications.map((app, index) => ({
          ...app,
          jobTitle: localizedApplications[index]?.title || app.jobTitle,
          company: localizedApplications[index]?.company || app.company,
        }));
      }
    }

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
      profile: candidate.profile ? {
        ...candidate.profile,
        whatsappNumber: candidate.whatsappNumber
      } : {
        whatsappNumber: candidate.whatsappNumber
      },
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
  /** Used by server boot recovery (P1-4). */
  resumeCvParseJobs: async function resumeCvParseJobs(job) {
    if (!job?.candidateId || !job?.fileUrl) return;
    const candidate = await prisma.candidate.findUnique({
      where: { id: job.candidateId },
    });
    await processCvParseJob({
      candidateId: job.candidateId,
      jobId: job.parseJobId || job.candidateId,
      file: null,
      fileUrl: job.fileUrl,
      candidate,
    });
  },
};
