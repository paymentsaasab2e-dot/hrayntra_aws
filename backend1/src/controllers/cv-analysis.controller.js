const { prisma } = require('../lib/prisma');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');

// Initialize AI
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Industry keywords for keyword optimization
const INDUSTRY_KEYWORDS = [
  // Technical Skills
  'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java', 'C++', 'C#', 'SQL', 'MongoDB',
  'PostgreSQL', 'AWS', 'Docker', 'Kubernetes', 'Git', 'CI/CD', 'REST API', 'GraphQL', 'Microservices',
  'Agile', 'Scrum', 'DevOps', 'Machine Learning', 'Data Science', 'AI', 'Cloud Computing',
  // Soft Skills
  'Leadership', 'Communication', 'Problem Solving', 'Teamwork', 'Project Management', 'Time Management',
  'Analytical', 'Creative', 'Adaptable', 'Detail-oriented', 'Self-motivated',
  // Business Skills
  'Business Analysis', 'Stakeholder Management', 'Budget Management', 'Strategic Planning',
  'Customer Service', 'Sales', 'Marketing', 'Finance', 'Operations'
];

/**
 * Analyze CV and generate comprehensive score
 * POST /api/cv-analysis/analyze
 */
async function analyzeCV(req, res) {
  try {
    const { candidateId } = req.body;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    // Get candidate's resume and profile data
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        resume: true,
        profile: true,
        summary: true,
        skills: {
          include: { skill: true }
        },
        workExperiences: true,
        educations: true,
        project: true,
        certifications: true,
      },
    });

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found',
      });
    }

    if (!candidate.resume) {
      return res.status(400).json({
        success: false,
        message: 'No resume found. Please upload a resume first.',
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 CV ANALYSIS STARTED');
    console.log('='.repeat(80));
    console.log('Candidate ID:', candidateId);

    // Extract resume text if file exists
    let resumeText = '';
    if (candidate.resume.fileUrl) {
      try {
        const filePath = path.join(__dirname, '../../', candidate.resume.fileUrl);
        if (fs.existsSync(filePath)) {
          const fileBuffer = fs.readFileSync(filePath);
          if (candidate.resume.mimeType === 'application/pdf') {
            const pdfData = await pdfParse(fileBuffer);
            resumeText = pdfData.text;
          } else {
            // For other formats, try to extract text (basic implementation)
            resumeText = candidate.resume.resumeJson ? JSON.stringify(candidate.resume.resumeJson) : '';
          }
        }
      } catch (error) {
        console.error('Error reading resume file:', error.message);
      }
    }

    // Build resume text from database if file not available
    if (!resumeText) {
      resumeText = buildResumeTextFromData(candidate);
    }

    // Run all analyzers
    const [sectionAnalysis, grammarAnalysis, atsAnalysis, keywordAnalysis, bulletAnalysis] = await Promise.all([
      analyzeSectionCompleteness(candidate),
      analyzeGrammar(resumeText),
      analyzeATSCompatibility(candidate, resumeText),
      analyzeKeywordOptimization(resumeText, candidate.skills),
      analyzeBulletPointQuality(candidate.workExperiences, resumeText),
    ]);

    // Calculate weighted final score
    const cvScore = Math.round(
      sectionAnalysis.score * 0.25 +
      atsAnalysis.score * 0.25 +
      keywordAnalysis.score * 0.20 +
      grammarAnalysis.score * 0.15 +
      bulletAnalysis.score * 0.15
    );

    // Determine levels for Skills, Experience, Education
    const skillsLevel = determineLevel(sectionAnalysis.skillsScore || 0);
    const experienceLevel = determineLevel(sectionAnalysis.experienceScore || 0);
    const educationLevel = determineLevel(sectionAnalysis.educationScore || 0);

    // Combine suggestions and mistakes
    const suggestions = [
      ...sectionAnalysis.suggestions,
      ...atsAnalysis.suggestions,
      ...keywordAnalysis.suggestions,
      ...grammarAnalysis.suggestions,
      ...bulletAnalysis.suggestions,
    ];

    const mistakes = [
      ...grammarAnalysis.mistakes,
      ...bulletAnalysis.mistakes,
    ];

    // Save or update CV analysis
    const cvAnalysis = await prisma.cvAnalysis.upsert({
      where: { candidateId: candidateId },
      update: {
        resumeId: candidate.resume.id,
        cvScore: cvScore,
        sectionScore: sectionAnalysis.score,
        atsScore: atsAnalysis.score,
        keywordScore: keywordAnalysis.score,
        grammarScore: grammarAnalysis.score,
        bulletScore: bulletAnalysis.score,
        sectionDetails: sectionAnalysis.details,
        atsDetails: atsAnalysis.details,
        keywordDetails: keywordAnalysis.details,
        grammarDetails: grammarAnalysis.details,
        bulletDetails: bulletAnalysis.details,
        suggestions: suggestions,
        mistakes: mistakes,
        skillsLevel: skillsLevel,
        experienceLevel: experienceLevel,
        educationLevel: educationLevel,
        updatedAt: new Date(),
      },
      create: {
        candidateId: candidateId,
        resumeId: candidate.resume.id,
        cvScore: cvScore,
        sectionScore: sectionAnalysis.score,
        atsScore: atsAnalysis.score,
        keywordScore: keywordAnalysis.score,
        grammarScore: grammarAnalysis.score,
        bulletScore: bulletAnalysis.score,
        sectionDetails: sectionAnalysis.details,
        atsDetails: atsAnalysis.details,
        keywordDetails: keywordAnalysis.details,
        grammarDetails: grammarAnalysis.details,
        bulletDetails: bulletAnalysis.details,
        suggestions: suggestions,
        mistakes: mistakes,
        skillsLevel: skillsLevel,
        experienceLevel: experienceLevel,
        educationLevel: educationLevel,
      },
    });

    // Update DashboardStats
    await prisma.dashboardStats.upsert({
      where: { candidateId: candidateId },
      update: {
        cvScore: cvScore,
        lastUpdated: new Date(),
      },
      create: {
        candidateId: candidateId,
        cvScore: cvScore,
      },
    });

    console.log('✅ CV Analysis completed');
    console.log('Final CV Score:', cvScore);

    // AI Job Matching Preview (Terminal Only)
    try {
      const activeJobs = await prisma.job.findMany({
        where: { isActive: true },
        include: { 
          company: { select: { name: true } },
          client: { select: { companyName: true } }
        },
        take: 50
      });

      const candidateSkills = candidate.skills.map(ks => ks.skill.name.toLowerCase());
      const candidateTitles = candidate.workExperiences.map(we => we.jobTitle.toLowerCase());
      
      const matched = activeJobs.map(job => {
        const jobSkills = (job.skills || []).map(s => typeof s === 'string' ? s.toLowerCase() : '');
        const overlap = candidateSkills.filter(s => jobSkills.includes(s));
        
        const skillArrayLength = Math.max(jobSkills.filter(Boolean).length, 1);
        let score = (overlap.length / skillArrayLength) * 100;
        const titleMatch = candidateTitles.some(t => job.title.toLowerCase().includes(t));
        if (titleMatch) score += 30;
        
        return {
          title: job.title,
          company: job.company?.name || job.client?.companyName || 'Unknown',
          score: Math.min(Math.round(score), 99),
          criteria: titleMatch ? `Title Match + ${overlap.length} Skills` : `${overlap.length} Skills Match`
        };
      })
      .filter(m => m.score > 30)
      .sort((a, b) => b.score - a.score);

      console.log('\n' + '-'.repeat(40));
      console.log(`🎯 PERSONALIZED JOB MATCHES FOUND: ${matched.length}`);
      console.log('-'.repeat(40));
      
      if (matched.length > 0) {
        matched.slice(0, 10).forEach((m, i) => {
          console.log(`${i+1}. found job: ${m.title} (${m.company}) - matches score: ${m.score}% - according to extracted data: ${m.criteria}`);
        });
      } else {
        console.log('No relevant job matches found for this CV profile.');
      }
      console.log('-'.repeat(40) + '\n');
    } catch (matchError) {
      console.log('Could not generate job match preview in terminal:', matchError.message);
    }

    console.log('='.repeat(80) + '\n');

    res.json({
      success: true,
      message: 'CV analysis completed successfully',
      data: {
        cv_score: cvScore,
        ats_score: atsAnalysis.score,
        grammar_score: grammarAnalysis.score,
        keyword_score: keywordAnalysis.score,
        bullet_score: bulletAnalysis.score,
        section_score: sectionAnalysis.score,
        skills_level: skillsLevel,
        experience_level: experienceLevel,
        education_level: educationLevel,
        suggestions: suggestions,
        mistakes: mistakes,
        details: {
          section: sectionAnalysis.details,
          ats: atsAnalysis.details,
          keyword: keywordAnalysis.details,
          grammar: grammarAnalysis.details,
          bullet: bulletAnalysis.details,
        },
      },
    });
  } catch (error) {
    console.error('Error analyzing CV:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze CV',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * 1. Section Completeness Analyzer
 */
async function analyzeSectionCompleteness(candidate) {
  const sections = {
    summary: !!candidate.summary?.summaryText,
    skills: candidate.skills && candidate.skills.length > 0,
    experience: candidate.workExperiences && candidate.workExperiences.length > 0,
    education: candidate.educations && candidate.educations.length > 0,
    projects: !!candidate.project,
    certifications: candidate.certifications && candidate.certifications.length > 0,
  };

  const totalSections = 6;
  const presentSections = Object.values(sections).filter(Boolean).length;
  const score = Math.round((presentSections / totalSections) * 100);

  // Calculate individual section scores
  const skillsScore = sections.skills ? 100 : 0;
  const experienceScore = sections.experience ? 100 : 0;
  const educationScore = sections.education ? 100 : 0;

  const suggestions = [];
  if (!sections.summary) suggestions.push('Add a professional summary section');
  if (!sections.skills) suggestions.push('Add a skills section with relevant technical and soft skills');
  if (!sections.experience) suggestions.push('Add work experience entries');
  if (!sections.education) suggestions.push('Add education details');
  if (!sections.projects) suggestions.push('Add project details to showcase your work');
  if (!sections.certifications) suggestions.push('Add certifications to enhance your profile');

  return {
    score,
    skillsScore,
    experienceScore,
    educationScore,
    details: sections,
    suggestions,
  };
}

/**
 * 2. Grammar Analysis using AI
 */
async function analyzeGrammar(resumeText) {
  if (!genAI || !resumeText) {
    return {
      score: 85, // Default score if AI not available
      details: { message: 'Grammar analysis skipped - AI service unavailable' },
      suggestions: [],
      mistakes: [],
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Analyze the following resume text for grammar mistakes, spelling errors, and writing quality. 
    Return a JSON object with:
    {
      "score": <number between 0-100>,
      "mistakes": [<array of grammar/spelling mistakes found>],
      "suggestions": [<array of improvement suggestions>]
    }
    
    Resume Text:
    ${resumeText.substring(0, 8000)}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Try to extract JSON from response
    let analysis;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      // Fallback: estimate score based on text length and basic checks
      const score = Math.min(90, Math.max(70, 85 + (resumeText.length > 500 ? 5 : 0)));
      return {
        score,
        details: { message: 'Could not parse AI response, using estimated score' },
        suggestions: ['Review your resume for grammar and spelling errors'],
        mistakes: [],
      };
    }

    return {
      score: Math.max(0, Math.min(100, analysis.score || 85)),
      details: analysis,
      suggestions: analysis.suggestions || [],
      mistakes: analysis.mistakes || [],
    };
  } catch (error) {
    console.error('Error in grammar analysis:', error.message);
    return {
      score: 85,
      details: { error: error.message },
      suggestions: ['Review your resume for grammar and spelling errors'],
      mistakes: [],
    };
  }
}

/**
 * 3. ATS Compatibility Analyzer
 */
async function analyzeATSCompatibility(candidate, resumeText) {
  const checks = {
    clearSectionHeaders: /(SUMMARY|EXPERIENCE|EDUCATION|SKILLS|PROJECTS|CERTIFICATIONS)/i.test(resumeText) ||
                         (candidate.summary && candidate.workExperiences && candidate.educations),
    bulletPointsUsed: /[•\-\*]\s/.test(resumeText) || 
                      candidate.workExperiences?.some(exp => exp.responsibilities?.includes('•') || exp.responsibilities?.includes('-')),
    simpleFormatting: true, // Assume simple if parsed successfully
    structuredExperience: candidate.workExperiences && candidate.workExperiences.length > 0 &&
                          candidate.workExperiences.every(exp => exp.jobTitle && exp.company && exp.startDate),
  };

  const totalChecks = 4;
  const passedChecks = Object.values(checks).filter(Boolean).length;
  const score = Math.round((passedChecks / totalChecks) * 100);

  const suggestions = [];
  if (!checks.clearSectionHeaders) {
    suggestions.push('Use clear section headers (Summary, Experience, Education, Skills)');
  }
  if (!checks.bulletPointsUsed) {
    suggestions.push('Use bullet points to list responsibilities and achievements');
  }
  if (!checks.structuredExperience) {
    suggestions.push('Ensure all work experience entries have job title, company, and dates');
  }

  return {
    score,
    details: checks,
    suggestions,
  };
}

/**
 * 4. Keyword Optimization Analyzer
 */
async function analyzeKeywordOptimization(resumeText, candidateSkills) {
  // Extract keywords from resume text
  const resumeKeywords = resumeText.toLowerCase().split(/\s+/);
  
  // Get candidate's skills as keywords
  const candidateSkillNames = candidateSkills?.map(cs => cs.skill.name.toLowerCase()) || [];
  
  // Combine all keywords
  const allResumeKeywords = [...new Set([...resumeKeywords, ...candidateSkillNames])];
  
  // Find matches with industry keywords
  const industryKeywordsLower = INDUSTRY_KEYWORDS.map(k => k.toLowerCase());
  const matchedKeywords = industryKeywordsLower.filter(keyword => 
    allResumeKeywords.some(resumeKw => resumeKw.includes(keyword) || keyword.includes(resumeKw))
  );
  
  // Calculate score based on match percentage (aim for at least 30% match)
  const matchPercentage = (matchedKeywords.length / INDUSTRY_KEYWORDS.length) * 100;
  const score = Math.min(100, Math.round(matchPercentage * 2)); // Scale to 0-100, max at 50% match
  
  const suggestions = [];
  if (score < 70) {
    suggestions.push(`Add more industry-relevant keywords. Currently matched ${matchedKeywords.length} out of ${INDUSTRY_KEYWORDS.length} common keywords`);
  }
  
  const missingKeywords = industryKeywordsLower
    .filter(kw => !matchedKeywords.includes(kw))
    .slice(0, 10); // Top 10 missing

  return {
    score,
    details: {
      matchedKeywords: matchedKeywords,
      missingKeywords: missingKeywords,
      matchCount: matchedKeywords.length,
      totalIndustryKeywords: INDUSTRY_KEYWORDS.length,
    },
    suggestions,
  };
}

/**
 * 5. Bullet Point Quality Analyzer using AI
 */
async function analyzeBulletPointQuality(workExperiences, resumeText) {
  if (!workExperiences || workExperiences.length === 0) {
    return {
      score: 0,
      details: { message: 'No work experience found' },
      suggestions: ['Add work experience with detailed bullet points'],
      mistakes: [],
    };
  }

  // Extract bullet points from work experiences
  const bulletPoints = workExperiences
    .map(exp => exp.responsibilities || exp.achievements || '')
    .join('\n')
    .split(/[•\-\*]\s*/)
    .filter(bp => bp.trim().length > 10);

  if (bulletPoints.length === 0) {
    return {
      score: 30,
      details: { message: 'No bullet points found in work experience' },
      suggestions: ['Add bullet points with action verbs and measurable achievements'],
      mistakes: ['Work experience lacks bullet points'],
    };
  }

  // Analyze bullet points
  const analysis = {
    hasActionVerbs: 0,
    hasMetrics: 0,
    hasAchievements: 0,
    totalBullets: bulletPoints.length,
  };

  const actionVerbs = ['developed', 'created', 'implemented', 'managed', 'led', 'improved', 'increased', 'reduced', 'designed', 'built', 'achieved', 'delivered', 'optimized', 'launched', 'established'];
  
  bulletPoints.forEach(bullet => {
    const bulletLower = bullet.toLowerCase();
    if (actionVerbs.some(verb => bulletLower.includes(verb))) {
      analysis.hasActionVerbs++;
    }
    if (/\d+%|\d+\s*(percent|users|customers|revenue|sales|projects|team|members|years|months)/i.test(bullet)) {
      analysis.hasMetrics++;
    }
    if (/(achieved|accomplished|successfully|improved|increased|reduced|delivered)/i.test(bullet)) {
      analysis.hasAchievements++;
    }
  });

  // Calculate score
  const actionVerbScore = (analysis.hasActionVerbs / analysis.totalBullets) * 100;
  const metricsScore = (analysis.hasMetrics / analysis.totalBullets) * 100;
  const achievementsScore = (analysis.hasAchievements / analysis.totalBullets) * 100;
  
  const score = Math.round((actionVerbScore * 0.4 + metricsScore * 0.4 + achievementsScore * 0.2));

  const suggestions = [];
  const mistakes = [];
  
  if (analysis.hasActionVerbs < analysis.totalBullets * 0.7) {
    suggestions.push('Start more bullet points with action verbs (e.g., "Developed", "Managed", "Improved")');
  }
  if (analysis.hasMetrics < analysis.totalBullets * 0.5) {
    suggestions.push('Include metrics and numbers in your bullet points (e.g., "Increased sales by 30%")');
    mistakes.push('Many bullet points lack measurable metrics');
  }
  if (analysis.hasAchievements < analysis.totalBullets * 0.5) {
    suggestions.push('Highlight achievements and results in your bullet points');
  }

  return {
    score,
    details: analysis,
    suggestions,
    mistakes,
  };
}

/**
 * Helper: Build resume text from database
 */
function buildResumeTextFromData(candidate) {
  let text = '';
  
  if (candidate.profile) {
    text += `Name: ${candidate.profile.fullName}\n`;
    text += `Email: ${candidate.profile.email}\n`;
  }
  
  if (candidate.summary) {
    text += `Summary: ${candidate.summary.summaryText}\n`;
  }
  
  if (candidate.workExperiences && candidate.workExperiences.length > 0) {
    text += 'Experience:\n';
    candidate.workExperiences.forEach(exp => {
      text += `${exp.jobTitle} at ${exp.company}\n`;
      if (exp.responsibilities) text += `${exp.responsibilities}\n`;
    });
  }
  
  if (candidate.educations && candidate.educations.length > 0) {
    text += 'Education:\n';
    candidate.educations.forEach(edu => {
      text += `${edu.degree} from ${edu.institution}\n`;
    });
  }
  
  if (candidate.skills && candidate.skills.length > 0) {
    text += 'Skills:\n';
    candidate.skills.forEach(cs => {
      text += `${cs.skill.name}\n`;
    });
  }
  
  return text;
}

/**
 * Helper: Determine level based on score
 */
function determineLevel(score) {
  if (score >= 80) return 'High';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Avg';
  return 'Low';
}

/**
 * Get CV Analysis for a candidate
 * GET /api/cv-analysis/:candidateId
 */
async function getCvAnalysis(req, res) {
  try {
    const { candidateId } = req.params;

    const analysis = await prisma.cvAnalysis.findUnique({
      where: { candidateId: candidateId },
    });

    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: 'CV analysis not found. Please run analysis first.',
      });
    }

    res.json({
      success: true,
      data: {
        cv_score: analysis.cvScore,
        ats_score: analysis.atsScore,
        grammar_score: analysis.grammarScore,
        keyword_score: analysis.keywordScore,
        bullet_score: analysis.bulletScore,
        section_score: analysis.sectionScore,
        skills_level: analysis.skillsLevel,
        experience_level: analysis.experienceLevel,
        education_level: analysis.educationLevel,
        suggestions: analysis.suggestions,
        mistakes: analysis.mistakes,
        details: {
          section: analysis.sectionDetails,
          ats: analysis.atsDetails,
          keyword: analysis.keywordDetails,
          grammar: analysis.grammarDetails,
          bullet: analysis.bulletDetails,
        },
      },
    });
  } catch (error) {
    console.error('Error getting CV analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get CV analysis',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

module.exports = {
  analyzeCV,
  getCvAnalysis,
};
