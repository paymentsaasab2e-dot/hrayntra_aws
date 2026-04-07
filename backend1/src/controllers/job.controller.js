const { prisma } = require('../lib/prisma');
const matchingService = require('../services/matching.service');

// simple in-memory cache
const cache = {
  jobs: null,
  lastFetched: 0,
  TTL: 300000, // 5 minutes
};

/**
 * Get all active jobs
 * GET /api/jobs
 */
async function getAllJobs(req, res) {
  try {
    const { page = 1, limit = 10, location, industry, workMode, employmentType, includeInactive } = req.query;
    
    // Check cache for default query (page 1, limit 10, no filters)
    const isDefaultQuery = page == 1 && limit == 10 && !location && !industry && !workMode && !employmentType;
    if (isDefaultQuery && cache.jobs && (Date.now() - cache.lastFetched < cache.TTL)) {
      console.log('⚡ Serving jobs list from cache');
      return res.json(cache.jobs);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const startedAt = Date.now();

    // Build where clause
    const where = {};

    // Phase 2 superadmin jobs are written into the same MongoDB collection.
    // Some of those records may not carry backend1's legacy `isActive` flag,
    // so we avoid filtering them out from the candidate-facing listing.

    if (location) {
      where.location = {
        contains: location,
      };
    }

    if (industry) {
      where.industry = {
        contains: industry,
      };
    }

    if (workMode) {
      where.workMode = workMode;
    }

    if (employmentType) {
      where.employmentType = employmentType;
    }

    console.log(
      `📥 DB fetch requested: jobs-list | page=${page} | limit=${limit} | location=${location || '-'} | industry=${industry || '-'} | workMode=${workMode || '-'} | employmentType=${employmentType || '-'}`
    );

    // Fetch jobs with company information
    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          company: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
            },
          },
          client: {
            select: {
              id: true,
              companyName: true,
              logo: true,
            },
          },
        },
        orderBy: {
          postedAt: 'desc',
        },
        skip,
        take: parseInt(limit),
      }),
      prisma.job.count({ where }),
    ]);

    // Format jobs for frontend
    const formattedJobs = jobs.map((job) => {
      // Calculate a mock match score (75-95) for demo purposes
      // In production, this would be calculated based on candidate profile and job requirements
      const matchScore = Math.floor(Math.random() * 21) + 75;

      const salaryJson = job.salary || undefined;
      const salaryMin = job.salaryMin ?? salaryJson?.min ?? null;
      const salaryMax = job.salaryMax ?? salaryJson?.max ?? null;
      const salaryCurrency = job.salaryCurrency ?? salaryJson?.currency ?? null;
      const salaryType = job.salaryType ?? salaryJson?.type ?? null;

      const responsibilitiesArray = Array.isArray(job.keyResponsibilities)
        ? job.keyResponsibilities.filter(Boolean)
        : [];
      const responsibilitiesText =
        job.responsibilities ||
        (responsibilitiesArray.length ? responsibilitiesArray.join(' ') : undefined);
      
      return {
        id: job.id,
        title: job.title,
        company: job.company?.name || job.client?.companyName || null,
        companyId: job.company?.id || job.client?.id || null,
        companyLogo: job.company?.logoUrl || job.client?.logo || null,
        location: job.location,
        openings: job.openings ?? 1,
        salaryMin,
        salaryMax,
        salaryCurrency,
        salaryType,
        experienceLevel: job.experienceRequired ?? job.experienceLevel,
        employmentType: job.type || job.employmentType,
        type: job.type ?? undefined,
        workMode: job.workMode ?? job.jobLocationType ?? null,
        industry: job.industry ?? job.department ?? job.jobCategory ?? null,
        aboutRole: job.aboutRole ?? job.overview ?? job.description ?? null,
        overview: job.overview ?? null,
        description: job.description ?? null,
        responsibilities: responsibilitiesText,
        keyResponsibilities: responsibilitiesArray,
        education: job.education ?? null,
        benefits: Array.isArray(job.benefits) ? job.benefits : [],
        hiringManager: job.hiringManager ?? null,
        assignedRecruiter: null,
        priority: job.priority ?? null,
        visaSponsorship: job.visaSponsorship ?? false,
        postedAt: job.postedAt ?? job.updatedAt ?? null,
        skills: Array.isArray(job.skills) ? job.skills : [],
        preferredSkills: Array.isArray(job.preferredSkills) ? job.preferredSkills : [],
        salary: job.salary ?? undefined,
        matchScore: matchScore,
      };
    });

    console.log(
      `📦 DB fetch result: jobs-list | page=${page} | limit=${limit} | returned=${jobs.length} | total=${total} | elapsedMs=${Date.now() - startedAt}`
    );

    const responsePayload = {
      success: true,
      data: {
        jobs: formattedJobs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    };

    if (isDefaultQuery) {
      cache.jobs = responsePayload;
      cache.lastFetched = Date.now();
    }

    res.json(responsePayload);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch jobs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Get job by ID
 * GET /api/jobs/:jobId
 */
async function getJobById(req, res) {
  try {
    const { jobId } = req.params;
    const startedAt = Date.now();

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: 'Job ID is required',
      });
    }

    console.log(`📥 DB fetch requested: job-by-id | jobId=${jobId}`);
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        company: true,
        client: true,
      },
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    console.log(
      `📦 DB fetch result: job-by-id | jobId=${jobId} | found=true | elapsedMs=${Date.now() - startedAt}`
    );

    // Format job for frontend
    const salaryJson = job.salary || undefined;
    const salaryMin = job.salaryMin ?? salaryJson?.min ?? null;
    const salaryMax = job.salaryMax ?? salaryJson?.max ?? null;
    const salaryCurrency = job.salaryCurrency ?? salaryJson?.currency ?? null;
    const salaryType = job.salaryType ?? salaryJson?.type ?? null;

    const responsibilitiesArray = Array.isArray(job.keyResponsibilities)
      ? job.keyResponsibilities.filter(Boolean)
      : [];
    const responsibilitiesText =
      job.responsibilities ||
      (responsibilitiesArray.length ? responsibilitiesArray.join(' ') : undefined);

    const formattedJob = {
      id: job.id,
      title: job.title,
      company: job.company?.name || job.client?.companyName || null,
      companyId: job.company?.id || job.client?.id || null,
      companyLogo: job.company?.logoUrl || job.client?.logo || null,
      location: job.location,
      openings: job.openings ?? 1,
      salaryMin,
      salaryMax,
      salaryCurrency,
      salaryType,
      experienceLevel: job.experienceRequired ?? job.experienceLevel,
      employmentType: job.type || job.employmentType,
      type: job.type ?? undefined,
      workMode: job.workMode ?? job.jobLocationType ?? null,
      industry: job.industry ?? job.department ?? job.jobCategory ?? null,
      aboutRole: job.aboutRole ?? job.overview ?? job.description ?? null,
      overview: job.overview ?? null,
      description: job.description ?? null,
      responsibilities: responsibilitiesText,
      keyResponsibilities: responsibilitiesArray,
      education: job.education ?? null,
      benefits: Array.isArray(job.benefits) ? job.benefits : [],
      hiringManager: job.hiringManager ?? null,
      assignedRecruiter: null,
      priority: job.priority ?? null,
      visaSponsorship: job.visaSponsorship ?? false,
      postedAt: job.postedAt ?? job.updatedAt ?? null,
      skills: Array.isArray(job.skills) ? job.skills : [],
      preferredSkills: Array.isArray(job.preferredSkills) ? job.preferredSkills : [],
      salary: job.salary ?? undefined,
    };

    res.json({
      success: true,
      data: formattedJob,
    });
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Seed sample jobs for testing
 * POST /api/jobs/seed
 */
async function seedSampleJobs(req, res) {
  try {
    // Check if companies exist, if not create them
    let company1 = await prisma.company.findFirst({
      where: { name: 'Tech Solutions Inc' },
    });

    if (!company1) {
      company1 = await prisma.company.create({
        data: {
          name: 'Tech Solutions Inc',
          industry: 'Technology',
          location: 'San Francisco, CA',
          overview: 'Leading technology solutions provider',
        },
      });
    }

    let company2 = await prisma.company.findFirst({
      where: { name: 'Digital Innovations Ltd' },
    });

    if (!company2) {
      company2 = await prisma.company.create({
        data: {
          name: 'Digital Innovations Ltd',
          industry: 'Software',
          location: 'New York, NY',
          overview: 'Innovative software development company',
        },
      });
    }

    let company3 = await prisma.company.findFirst({
      where: { name: 'Global Systems Corp' },
    });

    if (!company3) {
      company3 = await prisma.company.create({
        data: {
          name: 'Global Systems Corp',
          industry: 'IT Services',
          location: 'Austin, TX',
          overview: 'Global IT services and consulting',
        },
      });
    }

    // Create sample jobs
    const sampleJobs = [
      {
        companyId: company1.id,
        title: 'Senior Software Engineer',
        location: 'San Francisco, CA',
        salaryMin: 120000,
        salaryMax: 180000,
        salaryCurrency: 'USD',
        salaryType: 'ANNUAL',
        experienceLevel: '5+ Years',
        employmentType: 'FULL_TIME',
        workMode: 'HYBRID',
        industry: 'Technology',
        aboutRole: 'We are looking for an experienced software engineer to join our team.',
        responsibilities: 'Design and develop scalable web applications. Lead technical initiatives.',
        visaSponsorship: true,
        isActive: true,
      },
      {
        companyId: company2.id,
        title: 'Full Stack Developer',
        location: 'New York, NY',
        salaryMin: 100000,
        salaryMax: 150000,
        salaryCurrency: 'USD',
        salaryType: 'ANNUAL',
        experienceLevel: '3-5 Years',
        employmentType: 'FULL_TIME',
        workMode: 'REMOTE',
        industry: 'Software',
        aboutRole: 'Join our dynamic team to build cutting-edge applications.',
        responsibilities: 'Develop frontend and backend features. Collaborate with cross-functional teams.',
        visaSponsorship: false,
        isActive: true,
      },
      {
        companyId: company3.id,
        title: 'DevOps Engineer',
        location: 'Austin, TX',
        salaryMin: 110000,
        salaryMax: 160000,
        salaryCurrency: 'USD',
        salaryType: 'ANNUAL',
        experienceLevel: '3+ Years',
        employmentType: 'FULL_TIME',
        workMode: 'ON_SITE',
        industry: 'IT Services',
        aboutRole: 'Help us build and maintain our cloud infrastructure.',
        responsibilities: 'Manage CI/CD pipelines. Monitor and optimize system performance.',
        visaSponsorship: true,
        isActive: true,
      },
      {
        companyId: company1.id,
        title: 'React Developer',
        location: 'San Francisco, CA',
        salaryMin: 90000,
        salaryMax: 130000,
        salaryCurrency: 'USD',
        salaryType: 'ANNUAL',
        experienceLevel: '2-4 Years',
        employmentType: 'FULL_TIME',
        workMode: 'REMOTE',
        industry: 'Technology',
        aboutRole: 'Build beautiful and responsive user interfaces.',
        responsibilities: 'Develop React components. Implement responsive designs.',
        visaSponsorship: false,
        isActive: true,
      },
      {
        companyId: company2.id,
        title: 'Backend Developer',
        location: 'New York, NY',
        salaryMin: 105000,
        salaryMax: 155000,
        salaryCurrency: 'USD',
        salaryType: 'ANNUAL',
        experienceLevel: '3-5 Years',
        employmentType: 'FULL_TIME',
        workMode: 'HYBRID',
        industry: 'Software',
        aboutRole: 'Design and implement robust backend systems.',
        responsibilities: 'Develop RESTful APIs. Optimize database queries.',
        visaSponsorship: true,
        isActive: true,
      },
      {
        companyId: company1.id,
        title: 'Senior Financial Analyst',
        location: 'New York, NY',
        salaryMin: 95000,
        salaryMax: 140000,
        salaryCurrency: 'USD',
        salaryType: 'ANNUAL',
        experienceLevel: '4+ Years',
        employmentType: 'FULL_TIME',
        workMode: 'HYBRID',
        industry: 'Finance',
        aboutRole: 'Strategic financial planning and analysis role in a high-growth fintech.',
        responsibilities: 'Manage financial modeling. Drive annual budgeting process.',
        visaSponsorship: false,
        isActive: true,
      },
      {
        companyId: company2.id,
        title: 'Investment Banking Associate',
        location: 'London, UK',
        salaryMin: 130000,
        salaryMax: 190000,
        salaryCurrency: 'USD',
        salaryType: 'ANNUAL',
        experienceLevel: '3-5 Years',
        employmentType: 'FULL_TIME',
        workMode: 'ON_SITE',
        industry: 'Banking',
        aboutRole: 'Join our M&A team for high-value transactional work.',
        responsibilities: 'Build pitch decks. Analyze market trends.',
        visaSponsorship: true,
        isActive: true,
      },
    ];

    // Check if jobs already exist for these titles
    const existingTitles = await prisma.job.findMany({
      where: {
        title: { in: sampleJobs.map(j => j.title) },
      },
      select: { title: true },
    });

    const existingTitlesSet = new Set(existingTitles.map(j => j.title));

    // Filter out jobs that already exist
    const jobsToCreate = sampleJobs.filter(job => !existingTitlesSet.has(job.title));

    if (jobsToCreate.length === 0) {
      // All jobs exist, return existing ones
      const allJobs = await prisma.job.findMany({
        where: { isActive: true },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
            },
          },
        },
        orderBy: { postedAt: 'desc' },
        take: 10,
      });

      return res.json({
        success: true,
        message: 'Sample jobs already exist',
        data: {
          existingCount: allJobs.length,
          jobs: allJobs,
        },
      });
    }

    // Create new jobs
    const createdJobs = await Promise.all(
      jobsToCreate.map((job) => prisma.job.create({ data: job }))
    );

    res.json({
      success: true,
      message: 'Sample jobs created successfully',
      data: {
        count: createdJobs.length,
        jobs: createdJobs,
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
      console.warn('DB unavailable - seedSampleJobs skipped');
      return res.status(503).json({
        success: false,
        message: 'Database unavailable',
      });
    }

    console.error('Error seeding jobs:', message);
    res.status(500).json({
      success: false,
      message: 'Failed to seed jobs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Recommend jobs based on search query (for autocomplete)
 * GET /api/jobs/recommend?q=...
 */
async function recommendJobs(req, res) {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json({ success: true, data: [] });
    }

    const startedAt = Date.now();
    const { generateGoalRecommendations } = require('../lms/services/ai.lms.service');
    
    // Fetch DB jobs and AI recommendations in parallel
    const [jobs, aiSuggestions] = await Promise.all([
      prisma.job.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { skills: { hasSome: [q] } },
            { industry: { contains: q, mode: 'insensitive' } },
          ],
        },
        include: {
          company: { select: { id: true, name: true, logoUrl: true } },
          client: { select: { companyName: true, logo: true } },
        },
        take: 4,
        orderBy: { postedAt: 'desc' },
      }),
      generateGoalRecommendations(q)
    ]);

    console.log(
      `📦 Hybrid Search result: jobs=${jobs.length} | ai=${aiSuggestions.length} | elapsedMs=${Date.now() - startedAt}`
    );

    // Format DB results
    const dbFormatted = jobs.map(job => ({
      id: job.id,
      title: job.title,
      company: job.company?.name || job.client?.companyName || 'Hiring Partner',
      location: job.location,
      type: job.type || job.employmentType || 'Full-time',
      logo: job.company?.logoUrl || job.client?.logo || '',
      matchScore: Math.floor(Math.random() * 10) + 88,
    }));

    // Format AI results (avoiding duplicates)
    const dbTitles = new Set(dbFormatted.map(j => j.title.toLowerCase()));
    const aiFormatted = aiSuggestions
      .filter(title => !dbTitles.has(title.toLowerCase()))
      .slice(0, 3)
      .map((title, i) => ({
        id: `ai-suggest-${i}`,
        title: title,
        company: 'AI Predicted Role',
        location: 'Global / Remote',
        type: 'Suggested',
        logo: '',
        matchScore: 99,
        isAiSuggestion: true
      }));

    res.json({
      success: true,
      data: [...dbFormatted, ...aiFormatted]
    });
  } catch (error) {
    console.error('Error recommending jobs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to recommend jobs',
    });
  }
}

/**
 * Recommend locations (cities/countries) based on search query
 * GET /api/jobs/location-recommend?q=...
 */
async function recommendLocations(req, res) {
  try {
    const { q } = req.query;
    if (!q || q.length < 1) {
      return res.json({ success: true, data: [] });
    }

    const globalHubs = [
      'New York, USA', 'London, UK', 'San Francisco, USA', 'Berlin, Germany', 
      'Singapore', 'Bangalore, India', 'Remote', 'Austin, USA', 
      'Toronto, Canada', 'Sydney, Australia', 'Dubai, UAE', 'Tokyo, Japan',
      'Paris, France', 'Mumbai, India', 'Delhi, India', 'Pune, India'
    ];

    const filteredHubs = globalHubs
      .filter(h => h.toLowerCase().includes(q.toLowerCase()));

    // CALL OPENAI for infinite global suggestions
    let aiSuggestions = [];
    try {
      const { generateLocationRecommendations } = require('../lms/services/ai.lms.service');
      aiSuggestions = await generateLocationRecommendations(q);
    } catch (e) {
      console.warn('AI Location Recs failed, skipping OpenAI stage.', e.message);
    }

    // Also check if we have specific locations in the jobs database
    const dbLocations = await prisma.job.findMany({
      where: {
        location: { contains: q, mode: 'insensitive' }
      },
      select: { location: true },
      distinct: ['location'],
      take: 8
    });

    // Combine all sources
    const allRaw = [
      ...dbLocations.map(l => l.location),
      ...aiSuggestions,
      ...filteredHubs,
    ];

    // Deduplicate and format
    const seen = new Set();
    const final = [];

    allRaw.forEach(loc => {
      const normalized = loc.toLowerCase().trim();
      if (!seen.has(normalized) && final.length < 15) {
        seen.add(normalized);
        final.push({
          name: loc,
          isAi: aiSuggestions.includes(loc),
          isDb: dbLocations.some(db => db.location === loc)
        });
      }
    });

    res.json({
      success: true,
      data: final
    });
  } catch (error) {
    console.error('Error recommending locations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to recommend locations',
    });
  }
}

/**
 * Get personalized job recommendations for a specific candidate
 * Uses an advanced 3-Step tiered ranking pipeline:
 * Rule-based (Top 40) -> Embeddings (Top 10) -> GPT Analysis (Top 5)
 */
async function getPersonalizedJobs(req, res) {
  try {
    const { candidateId } = req.query;
    if (!candidateId) return res.status(400).json({ success: false, message: 'Candidate ID is required' });

    // 1. Fetch Candidate Context
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        resume: true,
        summary: true,
        profile: true,
        skills: { include: { skill: true } },
        workExperiences: true,
        careerPreferences: true,
        educations: true,
        project: true,
        internship: true,
        certifications: true,
        gapExplanation: true,
        visaWorkAuthorization: true
      }
    });

    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });
    const candidateSnapshot = matchingService.summarizeCandidate(candidate);

    // 2. Fetch Active Jobs
    const activeJobs = await prisma.job.findMany({
      where: {},
      include: {
        company: { select: { name: true, logoUrl: true } },
        client: { select: { companyName: true, logo: true } }
      },
      take: 500 // Fetch a deeper pool of jobs for matching
    });

    console.log(`🤖 AI Pipeline: Initial Rule Scan for ${activeJobs.length} roles...`);

    console.log('\n' + '='.repeat(90));
    console.log('PERSONALIZED JOB MATCHING STARTED');
    console.log('='.repeat(90));
    console.log(`Candidate ID: ${candidateId}`);
    console.log(`Total jobs fetched from database for scan: ${activeJobs.length}`);
    console.log('Extracted Candidate Data:', JSON.stringify({
      id: candidateSnapshot.id,
      name: candidateSnapshot.name,
      email: candidateSnapshot.email,
      currentTitle: candidateSnapshot.currentTitle,
      currentLocation: candidateSnapshot.currentLocation,
      candidateExperience: candidateSnapshot.candidateExperience,
      preferredRoles: candidateSnapshot.preferredRoles,
      preferredLocations: candidateSnapshot.preferredLocations,
      preferredIndustry: candidateSnapshot.preferredIndustry,
      preferredWorkMode: candidateSnapshot.preferredWorkMode,
      currentSalary: candidateSnapshot.currentSalary,
      expectedSalary: candidateSnapshot.expectedSalary,
      availabilityToStart: candidateSnapshot.availabilityToStart,
      openToRelocation: candidateSnapshot.openToRelocation,
      workTitles: candidateSnapshot.workTitles,
      skillsCount: candidateSnapshot.normalizedSkills.length,
      skills: candidateSnapshot.normalizedSkills,
      keywordsCount: candidateSnapshot.keywords.length,
      summaryText: candidateSnapshot.summaryText,
    }, null, 2));
    console.log('AI Pipeline: Initial Rule Scan started...');

    // --- STEP 1: RULE-BASED FAST SCAN (TOP 40) ---
    const ruleMatches = await Promise.all(
      activeJobs.map(async job => {
        const ruleData = await matchingService.getRuleScore(candidate, job);
        const behaviorBoost = await matchingService.getBehaviorScore(candidateId, job.id);
        return {
          ...job,
          ruleScore: ruleData.score,
          behaviorBoost,
          matchedSkills: ruleData.matchedSkills,
          missingSkills: ruleData.missingSkills,
          penalties: ruleData.penalties,
          candidateSummary: ruleData.candidateSummary,
          jobSummary: ruleData.jobSummary,
          keywordScore: ruleData.keywordScore,
          preferenceScore: ruleData.preferenceScore,
          locationScore: ruleData.locationScore,
          experienceScore: ruleData.experienceScore,
          titleMatch: ruleData.titleMatch,
          preferenceSignals: ruleData.preferenceSignals
        };
      })
    );

    const step1Top = ruleMatches
      .sort((a, b) => b.ruleScore - a.ruleScore)
      .slice(0, 100);

    // --- STEP 2: EMBEDDING PASS (EXTENDED) ---
    // Process all Step 1 candidates through the semantic reranker
    const embeddingMatches = await Promise.all(
      ruleMatches.map(async job => {
        const eScore = await matchingService.getEmbeddingScore(candidate, job);
        return { ...job, embeddingScore: eScore };
      })
    );

    const step2Top = embeddingMatches
      .sort((a, b) => b.embeddingScore - a.embeddingScore);

    console.log(`✨ AI Pipeline: GPT Analysis for the Elite Tier...`);

    // --- STEP 3: GPT DEEP ANALYSIS (TOP 15 FOR REAL-TIME COST CONTROL) ---
    const finalResults = await Promise.all(
      step2Top.map(async (job, index) => {
        if (index < 15) {
          const gptData = await matchingService.getGptAnalysis(candidate, job);
          return { ...job, gptScore: gptData.fitScore, insights: gptData };
        }
        // Fallback for standard matches (Score 60-70 based on Step 1 & 2 performance)
        const ruleWeight = job.ruleScore / 100;
        return { ...job, gptScore: Math.round(60 + (ruleWeight * 10)), insights: { reasoning: 'Standard Match Profile analyzed.' } };
      })
    );

    // --- FINAL BLENDING & NORMALIZATION ---
    let maxRawScore = 0;
    const scoredResults = finalResults.map(job => {
      // Balanced Scoring Formula:
      // Final = (Rule * 0.35) + (Embedding * 0.30) + (LLM * 0.25) + (Behavior * 0.10)
      const rawScore = (
        (job.ruleScore * 0.35) + 
        (job.embeddingScore * 0.30) + 
        (job.gptScore * 0.25) + 
        (job.behaviorBoost * 10) // Weight behavior appropriately
      );
      if (rawScore > maxRawScore) maxRawScore = rawScore;
      return { ...job, rawScore };
    });

    const normalized = scoredResults.map(job => {
      const normalizedScore = maxRawScore > 0 ? Math.round((job.rawScore / maxRawScore) * 100) : job.rawScore;
      const salaryJson = job.salary || undefined;
      const salaryMin = job.salaryMin ?? salaryJson?.min ?? null;
      const salaryMax = job.salaryMax ?? salaryJson?.max ?? null;
      const salaryCurrency = job.salaryCurrency ?? salaryJson?.currency ?? null;
      const salaryType = job.salaryType ?? salaryJson?.type ?? null;
      const responsibilitiesArray = Array.isArray(job.keyResponsibilities)
        ? job.keyResponsibilities.filter(Boolean)
        : [];
      
      // Confidence Tag logic based on Normalized Score
      let confidenceTag = 'Partial Match';
      if (normalizedScore >= 90) confidenceTag = 'Excellent Match';
      else if (normalizedScore >= 75) confidenceTag = 'Strong Match';
      else if (normalizedScore >= 60) confidenceTag = 'Good Match';

      return {
        jobId: job.id,
        id: job.id,
        jobTitle: job.title,
        title: job.title,
        company: job.company?.name || job.client?.companyName || 'Multiple Hiring partners',
        companyLogo: job.company?.logoUrl || job.client?.logo || '',
        location: job.location,
        type: job.type || job.employmentType || 'Full-time',
        workMode: job.workMode ?? job.jobLocationType ?? null,
        logo: job.company?.logoUrl || job.client?.logo || '',
        openings: job.openings ?? 1,
        salary: job.salary ?? undefined,
        salaryMin,
        salaryMax,
        salaryCurrency,
        salaryType,
        overview: job.overview ?? job.aboutRole ?? job.description ?? null,
        description: job.description ?? null,
        responsibilities: job.responsibilities ?? null,
        keyResponsibilities: responsibilitiesArray,
        requiredSkills: Array.isArray(job.requirements) ? job.requirements : [],
        skills: Array.isArray(job.skills) ? job.skills : [],
        preferredSkills: Array.isArray(job.preferredSkills) ? job.preferredSkills : [],
        education: job.education ?? null,
        experienceRequired: job.experienceRequired ?? job.experienceLevel ?? null,
        benefits: Array.isArray(job.benefits) ? job.benefits : [],
        priority: job.priority ?? null,
        postedDate: job.postedDate ?? job.postedAt ?? job.createdAt ?? null,
        hiringManager: job.hiringManager ?? null,
        assignedRecruiter: null,
        visaSponsorship: job.visaSponsorship ?? false,
        matchScore: Math.min(100, Math.round(job.rawScore)), // The actual blend
        normalizedScore: normalizedScore, // Relative rank
        confidenceTag,
        matchedSkills: job.matchedSkills,
        missingSkills: job.missingSkills,
        penaltiesApplied: job.penalties > 0,
        reasoning: job.insights?.reasoning || 'Experience and Skills analyzed',
        totalJobsScanned: activeJobs.length,
        ruleScore: job.ruleScore,
        embeddingScore: job.embeddingScore,
        gptScore: job.gptScore,
        keywordScore: job.keywordScore,
        titleMatch: job.titleMatch,
        directSkillMatchCount: job.directSkillMatchCount || 0,
        domainMatch: job.domainMatch,
        candidateSummary: job.candidateSummary,
        jobSummary: job.jobSummary,
        insights: {
          shouldShow: job.insights?.shouldShow ?? true,
          domainAlignment: job.insights?.domainAlignment || null,
          reasoning: job.insights?.reasoning || 'Experience and Skills analyzed',
          strengths: job.insights?.strengths || job.matchedSkills,
          gaps: job.insights?.gaps || job.missingSkills,
          improvementSuggestions: job.insights?.improvementSuggestions || []
        },
        breakdown: {
          ruleScore: Math.round(job.ruleScore),
          embeddingScore: Math.round(job.embeddingScore),
          llmScore: Math.round(job.gptScore),
          keywordScore: Math.round(job.keywordScore || 0),
          preferenceScore: Math.round(job.preferenceScore || 0),
          locationScore: Math.round(job.locationScore || 0),
          experienceScore: Math.round(job.experienceScore || 0),
          behaviorBoost: Math.round(job.behaviorBoost || 0)
        },
        extractedJobSnapshot: job.jobSummary
      };
    });

    console.log(`\n----------------------------------------`);
    console.log(`🎯 PERSONALIZED AI MATCHES IDENTIFIED: ${normalized.length}`);
    console.log(`----------------------------------------`);
    const sortedNormalized = normalized.sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return (b.normalizedScore || 0) - (a.normalizedScore || 0);
    });
    const filteredMatches = sortedNormalized.filter((job) => matchingService.qualifiesForPersonalizedMatch(job));
    const totalJobsScanned = activeJobs.length;
    const totalQualifiedMatches = filteredMatches.length;
    console.log(`TOTAL JOBS FOUND IN DATABASE: ${totalJobsScanned}`);
    console.log(`TOTAL MATCH JOBS FOUND FOR CANDIDATE: ${totalQualifiedMatches}`);
    console.log(`TOTAL SCORED JOBS RETURNED: ${filteredMatches.length}`);

    filteredMatches.slice(0, 20).forEach((job, i) => {
      console.log(
        `${i + 1}. ${job.jobTitle} | company=${job.company} | aiFitScore=${job.matchScore}% | normalized=${job.normalizedScore}% | confidence=${job.confidenceTag} | matchedSkills=${(job.matchedSkills || []).join(', ') || '-'} | missingSkills=${(job.missingSkills || []).join(', ') || '-'}`
      );
    });
    if (filteredMatches.length > 0) {
      console.log('Top matched job extracted data:', JSON.stringify(filteredMatches[0].extractedJobSnapshot, null, 2));
    } else {
      console.log('No scored jobs returned by the matching pipeline.');
    }
    console.log(`----------------------------------------\n`);
    console.log('='.repeat(90) + '\n');

    res.json({
      success: true,
      totalMatches: totalQualifiedMatches,
      totalJobsScanned,
      candidateProfile: {
        id: candidateSnapshot.id,
        name: candidateSnapshot.name,
        email: candidateSnapshot.email,
        currentTitle: candidateSnapshot.currentTitle,
        currentLocation: candidateSnapshot.currentLocation,
        candidateExperience: candidateSnapshot.candidateExperience,
        preferredRoles: candidateSnapshot.preferredRoles,
        preferredLocations: candidateSnapshot.preferredLocations,
        preferredIndustry: candidateSnapshot.preferredIndustry,
        preferredWorkMode: candidateSnapshot.preferredWorkMode,
        skills: candidateSnapshot.normalizedSkills,
        summaryText: candidateSnapshot.summaryText,
      },
      data: filteredMatches
    });

  } catch (error) {
    console.error('Tiered Matching Engine Failed:', error);
    res.status(500).json({ success: false, message: 'AI Orchestration Failure' });
  }
}

async function deleteJob(req, res) {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: 'Job ID is required',
      });
    }

    const existingJob = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, title: true },
    });

    if (!existingJob) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    const applicationIds = (
      await prisma.application.findMany({
        where: { jobId },
        select: { id: true },
      })
    ).map((application) => application.id);

    await prisma.$transaction(async (tx) => {
      if (applicationIds.length > 0) {
        await tx.applicationTimeline.deleteMany({
          where: { applicationId: { in: applicationIds } },
        });

        await tx.applicationCommunication.deleteMany({
          where: { applicationId: { in: applicationIds } },
        });
      }

      await tx.application.deleteMany({
        where: { jobId },
      });

      await tx.savedJob.deleteMany({
        where: { jobId },
      });

      await tx.aiJobMatch.deleteMany({
        where: { jobId },
      });

      await tx.jobSkill.deleteMany({
        where: { jobId },
      });

      await tx.job.delete({
        where: { id: jobId },
      });
    });

    return res.json({
      success: true,
      message: 'Job deleted successfully',
      data: existingJob,
    });
  } catch (error) {
    console.error('Error deleting job:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete job',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function bulkDeleteJobs(req, res) {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(Boolean) : [];

    if (ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one job ID is required',
      });
    }

    const existingJobs = await prisma.job.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true },
    });

    if (existingJobs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No matching jobs found',
      });
    }

    const jobIds = existingJobs.map((job) => job.id);
    const applicationIds = (
      await prisma.application.findMany({
        where: { jobId: { in: jobIds } },
        select: { id: true },
      })
    ).map((application) => application.id);

    await prisma.$transaction(async (tx) => {
      if (applicationIds.length > 0) {
        await tx.applicationTimeline.deleteMany({
          where: { applicationId: { in: applicationIds } },
        });

        await tx.applicationCommunication.deleteMany({
          where: { applicationId: { in: applicationIds } },
        });
      }

      await tx.application.deleteMany({
        where: { jobId: { in: jobIds } },
      });

      await tx.savedJob.deleteMany({
        where: { jobId: { in: jobIds } },
      });

      await tx.aiJobMatch.deleteMany({
        where: { jobId: { in: jobIds } },
      });

      await tx.jobSkill.deleteMany({
        where: { jobId: { in: jobIds } },
      });

      await tx.job.deleteMany({
        where: { id: { in: jobIds } },
      });
    });

    return res.json({
      success: true,
      message: `${jobIds.length} job(s) deleted successfully`,
      data: {
        count: jobIds.length,
        jobs: existingJobs,
      },
    });
  } catch (error) {
    console.error('Error bulk deleting jobs:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete jobs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

module.exports = {
  getAllJobs,
  getJobById,
  seedSampleJobs,
  recommendJobs,
  recommendLocations,
  getPersonalizedJobs,
  deleteJob,
  bulkDeleteJobs,
};
