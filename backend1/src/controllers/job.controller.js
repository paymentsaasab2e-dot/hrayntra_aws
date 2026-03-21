const { prisma } = require('../lib/prisma');

/**
 * Get all active jobs
 * GET /api/jobs
 */
async function getAllJobs(req, res) {
  try {
    const { page = 1, limit = 10, location, industry, workMode, employmentType } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const startedAt = Date.now();

    // Build where clause
    const where = {
      isActive: true,
    };

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
        salaryMin,
        salaryMax,
        salaryCurrency,
        salaryType,
        experienceLevel: job.experienceLevel,
        employmentType: job.type || job.employmentType,
        type: job.type ?? undefined,
        workMode: job.workMode,
        industry: job.industry ?? job.department ?? job.jobCategory ?? null,
        aboutRole: job.aboutRole ?? job.overview ?? job.description ?? null,
        responsibilities: responsibilitiesText,
        keyResponsibilities: responsibilitiesArray,
        visaSponsorship: job.visaSponsorship ?? false,
        postedAt: job.postedAt,
        skills: Array.isArray(job.skills) ? job.skills : [],
        salary: job.salary ?? undefined,
        matchScore: matchScore,
      };
    });

    console.log(
      `📦 DB fetch result: jobs-list | page=${page} | limit=${limit} | returned=${jobs.length} | total=${total} | elapsedMs=${Date.now() - startedAt}`
    );

    res.json({
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
    });
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
      salaryMin,
      salaryMax,
      salaryCurrency,
      salaryType,
      experienceLevel: job.experienceLevel,
      employmentType: job.type || job.employmentType,
      type: job.type ?? undefined,
      workMode: job.workMode,
      industry: job.industry ?? job.department ?? job.jobCategory ?? null,
      aboutRole: job.aboutRole ?? job.overview ?? job.description ?? null,
      responsibilities: responsibilitiesText,
      keyResponsibilities: responsibilitiesArray,
      visaSponsorship: job.visaSponsorship ?? false,
      postedAt: job.postedAt,
      skills: Array.isArray(job.skills) ? job.skills : [],
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

module.exports = {
  getAllJobs,
  getJobById,
  seedSampleJobs,
};
