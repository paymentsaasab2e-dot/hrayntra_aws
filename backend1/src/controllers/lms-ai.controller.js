const OpenAI = require('openai');
const { prisma } = require('../lib/prisma');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================================
// DOMAIN DETECTION ENGINE
// ============================================================

const DOMAIN_MAP = [
  {
    domain: 'IT / Software',
    questionFocus: 'technical architecture, coding problems, system design, debugging, APIs, cloud infrastructure, and DevOps scenarios',
    questionTypes: ['Coding', 'System Design', 'Debugging', 'Architecture Review'],
    keywords: [
      'developer', 'engineer', 'software', 'frontend', 'backend', 'fullstack', 'full stack', 'devops',
      'cloud', 'react', 'node', 'python', 'java', 'typescript', 'angular', 'vue', 'docker', 'kubernetes', 'aws', 'azure',
      'gcp', 'sre', 'site reliability', 'database', 'dba', 'mongodb', 'postgresql', 'microservices',
      'api', 'cybersecurity', 'infosec', 'penetration testing', 'qa engineer', 'test automation',
      'mobile developer', 'ios', 'android', 'flutter', 'embedded systems', 'firmware',
      'blockchain', 'web3', 'solidity', 'devops', 'ci/cd', 'scrum master', 'agile', 'product manager tech',
    ],
  },
  {
    domain: 'Data Science & Analysis',
    questionFocus: 'data cleaning, exploratory data analysis (EDA), statistical modeling, hypothesis testing, machine learning algorithms, data visualization, and insights communication',
    questionTypes: ['Statistical Analysis', 'EDA Scenario', 'ML Model Design', 'Data Viz Case'],
    keywords: [
      'data analyst', 'data scientist', 'data science', 'business analyst', 'bi developer',
      'tableau', 'powerbi', 'sql', 'pandas', 'numpy', 'scipy', 'scikit-learn', 'tensorflow',
      'pytorch', 'r programming', 'statistics', 'quantitative', 'big data', 'hadoop', 'spark',
      'data warehouse', 'etl', 'data mining', 'predictive modeling', 'regression', 'clustering',
      'bigquery', 'big query', 'looker', 'data studio', 'snowflake', 'databricks',
    ],
  },
  {
    domain: 'Finance',
    questionFocus: 'financial case studies, investment decisions, financial modeling, market analysis, risk assessment, regulatory compliance, and portfolio management',
    questionTypes: ['Case Study', 'Financial Modeling', 'Market Analysis', 'Risk Assessment'],
    keywords: [
      'finance', 'financial analyst', 'investment banker', 'equity', 'hedge fund', 'asset manager',
      'portfolio manager', 'risk analyst', 'actuary', 'accountant', 'cpa', 'cfa', 'auditor',
      'tax consultant', 'chartered accountant', 'treasury', 'forex', 'trading', 'broker',
      'wealth manager', 'credit analyst', 'loan officer', 'insurance', 'underwriter', 'budget analyst',
      'financial planner', 'controller', 'cfo', 'quantitative analyst', 'quant',
    ],
  },
  {
    domain: 'Healthcare / Medical',
    questionFocus: 'clinical scenarios, patient safety, diagnostic reasoning, treatment protocols, ethical medical decisions, evidence-based practice, and interdisciplinary care',
    questionTypes: ['Clinical Scenario', 'Patient Safety', 'Ethical Decision', 'Diagnostic Reasoning'],
    keywords: [
      'doctor', 'physician', 'surgeon', 'nurse', 'nursing', 'paramedic', 'emt', 'radiologist',
      'cardiologist', 'oncologist', 'pediatrician', 'general practitioner', 'gp', 'psychiatrist',
      'psychologist', 'therapist', 'dental', 'dentist', 'optometrist', 'medical officer',
      'medical assistant', 'healthcare', 'hospital', 'clinical', 'patient care', 'ward',
      'icu', 'emergency', 'anesthesiologist', 'pathologist', 'lab technician', 'medical imaging',
    ],
  },
  {
    domain: 'Pharmacy',
    questionFocus: 'drug interactions, pharmacokinetics, dosage calculations, patient counseling, dispensing accuracy, regulatory compliance, and clinical pharmacy scenarios',
    questionTypes: ['Drug Interaction', 'Clinical Pharmacy', 'Patient Counseling', 'Regulatory'],
    keywords: [
      'pharmacist', 'pharmacy', 'pharmaceutical', 'drug', 'dispensing', 'compounding',
      'clinical pharmacist', 'hospital pharmacist', 'retail pharmacist', 'pharma',
      'pharmaceuticals', 'pharmacokinetics', 'drug interaction', 'medication',
    ],
  },
  {
    domain: 'Marketing',
    questionFocus: 'campaign strategy, brand management, digital marketing, growth hacking, audience segmentation, analytics interpretation, and ROI optimization',
    questionTypes: ['Campaign Strategy', 'Brand Analysis', 'Growth Hacking', 'Analytics'],
    keywords: [
      'marketing', 'brand manager', 'digital marketing', 'seo', 'sem', 'ppc', 'social media',
      'content marketing', 'growth hacker', 'product marketing', 'demand generation',
      'marketing analyst', 'email marketing', 'campaign manager', 'advertising', 'media buyer',
      'influencer', 'pr manager', 'communications', 'market research', 'consumer insights',
    ],
  },
  {
    domain: 'Engineering',
    questionFocus: 'engineering design, technical problem-solving, manufacturing processes, quality control, project execution, safety regulations, and applied physics/mechanics',
    questionTypes: ['Design Problem', 'Technical Analysis', 'Project Planning', 'Safety Review'],
    keywords: [
      'mechanical engineer', 'civil engineer', 'electrical engineer', 'structural engineer',
      'chemical engineer', 'aerospace', 'manufacturing', 'process engineer', 'industrial engineer',
      'environmental engineer', 'geotechnical', 'petroleum engineer', 'materials engineer',
      'quality engineer', 'production engineer', 'robotics', 'automation engineer', 'cad', 'solidworks',
      'construction', 'site engineer', 'project engineer', 'maintenance engineer',
    ],
  },
  {
    domain: 'Legal',
    questionFocus: 'legal case analysis, statutory interpretation, contract law, litigation strategy, compliance, and professional ethics',
    questionTypes: ['Case Analysis', 'Legal Reasoning', 'Compliance', 'Contract Review'],
    keywords: [
      'lawyer', 'attorney', 'solicitor', 'barrister', 'paralegal', 'legal counsel', 'corporate lawyer',
      'litigation', 'compliance officer', 'legal advisor', 'intellectual property', 'ip law',
      'criminal law', 'civil law', 'family law', 'corporate law', 'legal analyst',
    ],
  },
  {
    domain: 'Education',
    questionFocus: 'pedagogy, curriculum design, student assessment, classroom management, learning outcomes, and educational technology',
    questionTypes: ['Pedagogy', 'Curriculum Design', 'Student Assessment', 'Classroom Scenario'],
    keywords: [
      'teacher', 'professor', 'lecturer', 'educator', 'tutor', 'teaching', 'curriculum',
      'school', 'university', 'college', 'education', 'instructional designer', 'e-learning',
      'principal', 'academic', 'training and development', 'learning and development', 'l&d',
    ],
  },
  {
    domain: 'Human Resources',
    questionFocus: 'talent acquisition, employee relations, performance management, L&D strategy, HR compliance, compensation, and organizational development',
    questionTypes: ['Behavioral', 'HR Policy', 'Conflict Resolution', 'Talent Strategy'],
    keywords: [
      'hr', 'human resources', 'talent acquisition', 'recruiter', 'recruitment',
      'people operations', 'hrbp', 'hr business partner', 'compensation', 'benefits',
      'payroll', 'employee relations', 'organizational development', 'workforce planning',
      'diversity', 'inclusion', 'dei',
    ],
  },
  {
    domain: 'Hospitality & Tourism',
    questionFocus: 'guest experience, service quality, hotel operations, event management, crisis handling, and revenue optimization',
    questionTypes: ['Guest Scenario', 'Operational Problem', 'Service Recovery', 'Revenue Strategy'],
    keywords: [
      'hotel', 'hospitality', 'tourism', 'restaurant', 'chef', 'front desk', 'concierge',
      'travel agent', 'event manager', 'catering', 'resort', 'housekeeping', 'food service',
      'airline', 'cabin crew', 'flight attendant', 'cruise',
    ],
  },
  {
    domain: 'Sales',
    questionFocus: 'sales pipeline management, objection handling, client relationship building, negotiation, quota achievement, and CRM strategy',
    questionTypes: ['Sales Scenario', 'Objection Handling', 'Negotiation', 'Pipeline Review'],
    keywords: [
      'sales', 'account executive', 'business development', 'bd', 'sales manager', 'bdr', 'sdr',
      'account manager', 'key account', 'enterprise sales', 'inside sales', 'crm', 'salesforce',
      'revenue', 'quota', 'closing', 'b2b sales', 'b2c sales',
    ],
  },
];

// ============================================================
// DOMAIN DEPTH SCALING (difficulty context per experience)
// ============================================================
const DOMAIN_DEPTH = {
  'IT / Software': {
    Senior: 'distributed systems, microservices tradeoffs, system design at scale, security architecture, tech debt leadership',
  },
  'Data Science & Analysis': {
    Junior: 'basic SQL queries, cleaning messy datasets, creating simple bar/line charts, understanding mean/median/mode',
    Mid: 'advanced SQL window functions, building regression models, feature engineering, statistical significance testing (p-values), dashboard design best practices',
    Senior: 'architecting data lakes, deploying production ML pipelines, hyperparameter optimization, causal inference, driving board-level decisions with data-driven narratives',
  },
  'Finance': {
    Junior: 'basic accounting principles, reading financial statements, understanding GAAP',
    Mid: 'financial modeling, DCF valuation, ratio analysis, portfolio rebalancing strategies',
    Senior: 'derivatives pricing, risk-weighted asset modeling, macroeconomic stress testing, regulatory capital management',
  },
  'Healthcare / Medical': {
    Junior: 'anatomy basics, standard triage protocols, documentation and patient intake',
    Mid: 'differential diagnosis, medication management, interdisciplinary care coordination',
    Senior: 'critical care decision-making under uncertainty, hospital resource allocation ethics, complex case management',
  },
  'Pharmacy': {
    Junior: 'basic dispensing accuracy, OTC recommendations, dosage reading',
    Mid: 'drug-drug interactions, pharmacokinetics, antibiotic stewardship',
    Senior: 'clinical pharmacy consulting, formulary management, critical patient counseling on high-risk medications',
  },
  'Marketing': {
    Junior: 'social media scheduling, basic campaign setup, email open rate optimization',
    Mid: 'multi-channel funnel design, A/B testing setup, audience segmentation strategies',
    Senior: 'brand positioning for global markets, growth hacking at scale, revenue attribution, media mix modeling',
  },
  'Engineering': {
    Junior: 'reading engineering drawings, basic materials selection, safety checklist compliance',
    Mid: 'component design, FEA/FEM problem-solving, project timeline estimation',
    Senior: 'system-level design tradeoffs, failure mode analysis (FMEA), cross-discipline project leadership',
  },
  'Legal': {
    Junior: 'basic contract reading, legal research skills, court filing procedure',
    Mid: 'contract drafting and negotiation, regulatory compliance review, case strategy',
    Senior: 'complex litigation management, M&A due diligence, board-level legal advisory',
  },
  'Education': {
    Junior: 'lesson plan structure, classroom routine management, student engagement basics',
    Mid: 'differentiated instruction, formative assessment design, parent-teacher communication',
    Senior: 'curriculum architecture, school improvement leadership, policy-level education reform',
  },
  'Human Resources': {
    Junior: 'onboarding logistics, basic job description writing, HRIS data entry',
    Mid: 'performance review facilitation, conflict resolution, compensation benchmarking',
    Senior: 'org design, strategic workforce planning, culture transformation, CHRO advisory',
  },
  'Hospitality & Tourism': {
    Junior: 'guest check-in/out procedures, basic complaint handling, restaurant POS basics',
    Mid: 'revenue management strategies, F&B cost control, event coordination logistics',
    Senior: 'property P&L management, brand standards enforcement, crisis comms during high-occupancy events',
  },
  'Sales': {
    Junior: 'cold outreach sequencing, CRM data hygiene, basic objection handling',
    Mid: 'full sales cycle management, discovery call frameworks, negotiation tactics',
    Senior: 'enterprise deal strategy, territory planning, team quota setting, C-suite relationship management',
  },
};

function getDomainDepth(domain, experienceHint) {
  const depthMap = DOMAIN_DEPTH[domain];
  if (!depthMap) return '';
  const level = experienceHint || 'Mid';
  return depthMap[level] || depthMap['Mid'] || '';
}

// ============================================================
// MULTI-DOMAIN DETECTION WITH CONFIDENCE SCORING
// ============================================================

/**
 * Detects ALL matching domains from prompt using keyword hit density.
 * Returns: { domains[], primaryDomain, confidence(0-100), isMultiDomain }
 */
function detectDomains(prompt) {
  const normalized = prompt.toLowerCase();
  const hits = [];

  for (const entry of DOMAIN_MAP) {
    let matchCount = 0;
    for (const keyword of entry.keywords) {
      if (normalized.includes(keyword)) matchCount++;
    }
    if (matchCount > 0) hits.push({ ...entry, matchCount });
  }

  if (hits.length === 0) {
    return {
      domains: [{
        domain: 'General Professional',
        questionFocus: 'behavioral competencies, situational judgment, problem-solving, communication, and professional ethics',
        questionTypes: ['Behavioral', 'Situational', 'Problem-Solving', 'Competency-Based'],
        matchCount: 0,
      }],
      primaryDomain: 'General Professional',
      confidence: 0,
      isMultiDomain: false,
    };
  }

  hits.sort((a, b) => b.matchCount - a.matchCount);
  const totalHits = hits.reduce((s, h) => s + h.matchCount, 0);
  const confidence = Math.min(100, Math.round((hits[0].matchCount / Math.max(totalHits, 1)) * 100));

  return {
    domains: hits,
    primaryDomain: hits[0].domain,
    confidence,
    isMultiDomain: hits.length > 1,
  };
}

/**
 * OpenAI fallback: classify domain when keyword confidence is low (< 40).
 */
async function classifyDomainWithAI(prompt) {
  try {
    const domainNames = DOMAIN_MAP.map(d => d.domain).concat(['General Professional']);
    const result = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 60,
      messages: [{
        role: 'user',
        content: `Classify the job/interview request into the most relevant domain from: ${domainNames.join(', ')}\n\nRequest: "${prompt}"\n\nReturn ONLY the exact domain name. No explanation.`
      }]
    });
    const aiDomain = result.choices[0].message.content.trim();
    const matched = DOMAIN_MAP.find(d => d.domain.toLowerCase() === aiDomain.toLowerCase());
    return matched || {
      domain: aiDomain || 'General Professional',
      questionFocus: 'behavioral competencies, situational judgment, and problem-solving',
      questionTypes: ['Behavioral', 'Situational', 'Problem-Solving'],
    };
  } catch {
    return {
      domain: 'General Professional',
      questionFocus: 'behavioral competencies, situational judgment, and problem-solving',
      questionTypes: ['Behavioral', 'Situational', 'Problem-Solving'],
    };
  }
}

// ============================================================
// IN-MEMORY ANALYTICS + CACHE
// ============================================================
const domainStats = new Map(); // tracks request counts per domain
const promptCache = new Map();
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

const generateQuestions = async (req, res) => {
  try {
    const { prompt, candidateId, companyType, industryLevel, experienceHint } = req.body;
    
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return res.status(400).json({ error: 'Valid prompt is required.' });
    }

    // ── STEP 1: Cache check (includes company + level context in key) ──
    const cacheKey = `${prompt.trim().toLowerCase()}_${candidateId || 'guest'}_${companyType || ''}_${industryLevel || ''}`;
    if (promptCache.has(cacheKey)) {
      const cached = promptCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return res.status(200).json(cached.data);
      } else {
        promptCache.delete(cacheKey);
      }
    }

    // ── STEP 2: Hybrid Domain Detection ──
    console.log(`\n[LMS-AI] Starting Question Generation for: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`);
    let { domains, primaryDomain, confidence, isMultiDomain } = detectDomains(prompt);

    // AI fallback when keyword confidence is low
    if (confidence < 40) {
      console.log(`[LMS-AI] Low confidence (${confidence}%). Triggering AI domain classification.`);
      const aiFallback = await classifyDomainWithAI(prompt);
      primaryDomain = aiFallback.domain;
      domains = [{ ...aiFallback, matchCount: 0 }, ...domains];
      confidence = 55; // Boosted: AI-assisted
    }

    const primaryEntry = DOMAIN_MAP.find(d => d.domain === primaryDomain) || domains[0];
    const { questionFocus, questionTypes } = primaryEntry;
    const domain = primaryDomain;

    // Domain depth scaling
    const depthContext = getDomainDepth(domain, experienceHint);

    // Multi-domain blend label
    const multiDomainLabel = isMultiDomain && domains.length > 1
      ? `HYBRID MODE: Blend questions from both ${domains.slice(0, 2).map(d => d.domain).join(' + ')} domains.`
      : '';

    // Company context injection
    const companyContext = (companyType || industryLevel)
      ? `\n\nCompany Context:\n- Company Type: ${companyType || 'Not specified'} — adjust scenario realism accordingly.\n- Industry Level: ${industryLevel || 'standard'} — scale question complexity from basic to advanced.`
      : '';

    // Analytics tracking
    domainStats.set(domain, (domainStats.get(domain) || 0) + 1);
    const totalDomainRequests = Array.from(domainStats.values()).reduce((a, b) => a + b, 0);
    const domainHits = domainStats.get(domain) || 1;
    const percentileRank = Math.round((domainHits / totalDomainRequests) * 100);

    console.log(`[LMS-AI] Domain: ${domain} | Confidence: ${confidence}% | Multi: ${isMultiDomain} | Depth: ${depthContext.substring(0, 40)}...`);

    // ── STEP 3: Personalization ──
    let candidateContext = '';
    if (candidateId) {
      try {
        const profile = await prisma.candidateProfile.findUnique({ where: { candidateId } });
        if (profile) {
          candidateContext = `\n\nCandidate Context:\n- Employment Status: ${profile.employmentStatus || 'Unknown'}\n- Skills/Notes: ${profile.skillsAdditionalNotes || 'General'}\nTailor scenarios to align with this candidate's background.`;
        }
      } catch (err) {
        console.warn('Failed to fetch candidate profile:', err.message);
      }
    }

    // ── STEP 4: Domain-Aware System Prompt ──
    const systemInstructions = `You are a world-class senior interviewer with deep expertise across ALL global industries.
Generate an elite, domain-specific interview question set.

==============================
DOMAIN: ${domain}${isMultiDomain ? ' [HYBRID]' : ''}
CONFIDENCE: ${confidence}%
${multiDomainLabel}
==============================

1. PROMPT-CENTRIC ROLE EXTRACTION (MOST IMPORTANT):
   - Analyze the entire prompt: "${prompt}"
   - If the user provides a specific tool, degree, or skill (e.g. "BigQuery", "B.Pharmacy", "React"), set the 'role' to that exactly (e.g. "BigQuery Specialist", "B.Pharmacy Student/Pharmacist").
   - DO NOT fallback to "Professional" if the prompt contains any noun related to a career or tool.
   - The 'role' field in your response MUST be a specific, professional title derived from the user's prompt.

2. DOMAIN CONTEXT:
   - Use the primary domain "${domain}" only as a general context for your knowledge base.
   - If the user's specific prompt ("${prompt}") falls slightly outside this domain's strict rules, prioritize the PROMPT.
   - Example: For "B.Pharmacy", focus on the academic and pharmaceutical science aspects.

3. Question Design:
   - Inferred experience level: Junior | Mid | Senior (derived from context of "${prompt}", fallback: "Mid")
   - Inferred question count: 1–20 (fallback: 5)
   - Extract any skills mentioned in "${prompt}"

2. Domain Engineering (CRITICAL):
   - ALL questions MUST be rooted in the "${domain}" industry
   - Focus: ${questionFocus}
   - Question styles: ${questionTypes.join(', ')}
   - Depth for this level: ${depthContext || 'standard professional scenarios'}
   - NO cross-domain contamination (e.g., no coding for non-IT, no medical for finance)
   ${multiDomainLabel ? '- ' + multiDomainLabel : ''}
   ${companyContext ? '- Company context: ' + companyContext.replace(/\n/g, ' ') : ''}

3. Quality Rules:
   - NO generic definition questions. Scenario-based ONLY.
   - EXACT ROLE MATCH: If the prompt specifies a role (like "Data Analyst"), the questions MUST be tailored specifically to that role, not just the general domain.
   - Ensure at least 1 question per mentioned skill
   - Difficulty: Junior(70% easy, 30% med) | Mid(60% med, 40% hard) | Senior(70% hard, 30% med)
   - Every question must have: followUp, expectedAnswer, evaluationCriteria

4. Output schema (STRICT JSON — no markdown):
{
  "role": "string (the specific job role detected, e.g. Data Analyst)",
  "domain": "${domain}",
  "experienceLevel": "Junior | Mid | Senior",
  "questionType": "string",
  "totalQuestions": number,
  "questions": [
    {
      "question": "string",
      "followUp": "string",
      "expectedAnswer": "string",
      "evaluationCriteria": "string",
      "type": "string",
      "difficulty": "easy | medium | hard",
      "skillTag": "string",
      "domainTag": "${domain}"
    }
  ]
}`;

    const userPrompt = `Generate a high-quality interview set for the ${domain} domain:\n"${prompt}"${candidateContext}${companyContext}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemInstructions },
        { role: 'user', content: userPrompt }
      ]
    });

    let rawResponse = completion.choices[0].message.content.trim();
    if (rawResponse.startsWith('\`\`\`json')) {
      rawResponse = rawResponse.replace(/^\`\`\`json\n/, '').replace(/\n\`\`\`$/, '');
    } else if (rawResponse.startsWith('\`\`\`')) {
      rawResponse = rawResponse.replace(/^\`\`\`\n/, '').replace(/\n\`\`\`$/, '');
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(rawResponse);
    } catch (parseError) {
      console.error('LMS Question Gen JSON Parse Error:', parseError);
      return res.status(500).json({ error: 'AI returned invalid formatting.' });
    }

    if (!parsedResponse.questions || !Array.isArray(parsedResponse.questions)) {
      parsedResponse.questions = [];
    }

    // ── STEP 5: Deduplication + field normalization ──
    const uniqueMap = new Map();
    const finalQuestions = [];
    for (const q of parsedResponse.questions) {
      if (!q.question) continue;
      const key = q.question.toLowerCase().trim();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, true);
        finalQuestions.push({
          question: q.question,
          followUp: q.followUp || 'Can you walk me through a real example of this?',
          expectedAnswer: q.expectedAnswer || 'Looking for depth of domain-specific understanding.',
          evaluationCriteria: q.evaluationCriteria || 'Domain accuracy, clarity, and practical relevance.',
          type: q.type || parsedResponse.questionType || 'scenario',
          difficulty: q.difficulty || (parsedResponse.experienceLevel === 'Senior' ? 'hard' : 'medium'),
          skillTag: q.skillTag || parsedResponse.role || 'General',
          domainTag: q.domainTag || domain,
        });
      }
    }

    // ── STEP 6: Enrich response root ──
    parsedResponse.questions = finalQuestions.slice(0, 20);
    parsedResponse.totalQuestions = parsedResponse.questions.length;
    parsedResponse.domain = domain;
    parsedResponse.confidence = confidence;
    parsedResponse.isMultiDomain = isMultiDomain;
    parsedResponse.detectedDomains = domains.slice(0, 3).map(d => d.domain);
    parsedResponse.domainPerformance = {
      domain,
      totalRequestsForDomain: domainHits,
      percentileRank: `${percentileRank}%`,
    };

    // ── STEP 7: Persistence ──
    if (candidateId) {
      try {
        await prisma.lmsInterviewSet.create({
          data: {
            userId: candidateId,
            title: `[${domain}${isMultiDomain ? ' HYBRID' : ''}] ${parsedResponse.role || 'Practice'} Set`,
            sourceContext: prompt,
            questions: parsedResponse.questions,
            savedAnswers: {}
          }
        });
      } catch (dbErr) {
        console.error('Failed to persist LMS Interview Set:', dbErr.message);
      }
    }

    promptCache.set(cacheKey, { data: parsedResponse, timestamp: Date.now() });

    // Terminal Audit Log
    console.log('\n===================================');
    console.log('      [LMS-AI] GENERATION AUDIT      ');
    console.log('===================================');
    console.log(`- User Prompt   : "${prompt}"`);
    console.log(`- Internal Domain: ${domain} (${confidence}% confidence)`);
    console.log(`- Finalized Role : ${parsedResponse.role}`);
    console.log(`- Complexity     : ${parsedResponse.experienceLevel}`);
    console.log(`- Set Item Count : ${parsedResponse.totalQuestions} questions`);
    console.log('-----------------------------------');
    parsedResponse.questions.forEach((q, i) => {
      console.log(`${i+1}. [${q.difficulty.toUpperCase()}] ${q.question}`);
      console.log(`   └─ Focus Tag: ${q.skillTag}`);
    });
    console.log('===================================\n');

    return res.status(200).json(parsedResponse);

  } catch (error) {
    console.error('LMS Question Gen Error:', error);
    return res.status(500).json({ error: 'Failed to generate questions.' });
  }
};

// ============================================================
// DOMAIN EVALUATION CRITERIA MAP
// ============================================================
const DOMAIN_EVAL_CRITERIA = {
  'IT / Software':       'Focus on logic, code correctness, optimization, scalability, and system design tradeoffs.',
  'Finance':             'Focus on analytical accuracy, financial reasoning, calculation correctness, and regulatory awareness.',
  'Healthcare / Medical':'Focus on clinical accuracy, patient safety, ethical decision-making, and evidence-based reasoning.',
  'Pharmacy':            'Focus on drug accuracy, interaction identification, dosage precision, and patient counseling quality.',
  'Marketing':           'Focus on strategic thinking, data-driven justification, creativity, and campaign feasibility.',
  'Engineering':         'Focus on design accuracy, adherence to safety standards, practical problem-solving, and material/process knowledge.',
  'Legal':               'Focus on legal accuracy, statutory interpretation, logical argumentation, and professional ethics.',
  'Education':           'Focus on pedagogical soundness, student-centered reasoning, curriculum alignment, and assessment design.',
  'Human Resources':     'Focus on policy knowledge, empathy, organizational alignment, and conflict resolution quality.',
  'Hospitality & Tourism':'Focus on guest experience orientation, operational accuracy, service recovery, and brand standards.',
  'Sales':               'Focus on persuasion technique, objection handling quality, pipeline awareness, and customer empathy.',
  'Data Science & Analysis': 'Focus on statistical rigor, data handling proficiency, insight accuracy, and clarity in explaining complex findings.',
  'General Professional':'Focus on clarity, critical thinking, problem-solving approach, and professional communication.',
};

const DIFFICULTY_STRICTNESS = {
  easy:   'Be lenient. Give generous credit for partial knowledge and reasonable attempts.',
  medium: 'Be balanced. Reward clear understanding. Penalize significant gaps or vagueness.',
  hard:   'Be strict. Only reward answers with depth, precision, and domain-specific mastery.',
};

// ============================================================
// AI ANSWER EVALUATION ENGINE
// ============================================================
const evaluateAnswer = async (req, res) => {
  try {
    const { 
      question, 
      candidateAnswer, 
      expectedAnswer, 
      domain, 
      difficulty, 
      skillTag, 
      candidateId, 
      timeTaken, // in seconds
      sessionContext // { prevQuestions: [], prevScores: [] }
    } = req.body;

    // Input validation
    if (!question || !candidateAnswer || !domain) {
      return res.status(400).json({ error: 'question, candidateAnswer, and domain are required.' });
    }

    const domainCriteria = DOMAIN_EVAL_CRITERIA[domain] || DOMAIN_EVAL_CRITERIA['General Professional'];
    const strictness    = DIFFICULTY_STRICTNESS[difficulty] || DIFFICULTY_STRICTNESS['medium'];

    const systemPrompt = `You are a world-class Intelligent Interview Evaluation Engine.
Domain: ${domain}
Context: ${JSON.stringify(sessionContext || {})}
Criteria: ${domainCriteria}
Strictness: ${strictness}

AUTHENTICITY DETECTION:
You must detect if the answer is AI-generated, copied, or overly robotic.
Look for: excessive structure, lack of personal specific details, generic career-advice style phrasing.

Return ONLY valid JSON. No markdown.`;

    const userPrompt = `Evaluate this answer:
Question: ${question}
Candidate Answer: ${candidateAnswer}
Timing: ${timeTaken ? timeTaken + 's' : 'Unspecified'}

Return JSON conforming to:
{
  "rawScore": <number 0-100>,
  "authenticityScore": <number 0.0-1.0, 1.0 being human>,
  "strengths": [],
  "weaknesses": [],
  "suggestions": [],
  "confidence": <number 0.0-1.0>
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', 
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
    });

    let raw = completion.choices[0].message.content.trim();
    // Strip markdown code fences if present
    if (raw.startsWith('```json')) raw = raw.replace(/^```json\n/, '').replace(/\n```$/, '');
    else if (raw.startsWith('```')) raw = raw.replace(/^```\n/, '').replace(/\n```$/, '');

    // ── Parse + validate ──
    let evaluation;
    try {
      evaluation = JSON.parse(raw);
    } catch {
      // Fallback if JSON is malformed
      evaluation = {
        score: 50,
        strengths: ['Some relevant points were mentioned.'],
        weaknesses: ['Could not fully evaluate the response.'],
        suggestions: ['Please provide a more structured answer.'],
        confidence: 0.4,
      };
    }

    // ── SCORING NORMALIZATION & TIME ADJUSTMENT ──
    let finalScore = Math.max(0, Math.min(100, Number(evaluation.rawScore) || 50));
    const authScore = Math.max(0, Math.min(1, Number(evaluation.authenticityScore) || 0.8));

    // Time-based adjustment
    if (timeTaken > 0) {
      if (timeTaken < 30 && finalScore > 80) finalScore = Math.min(100, finalScore + 5); // Fast + accurate boost
      if (timeTaken > 180 && finalScore < 60) finalScore = Math.max(0, finalScore - 10); // Slow + weak penalty
    }

    // Trend calculation (pseudo-trend for context)
    const trend = (sessionContext?.prevScores?.length) 
      ? (finalScore > sessionContext.prevScores[sessionContext.prevScores.length-1] ? 'up' : 'down') 
      : 'stable';

    // ── Persist to DB ──
    if (candidateId) {
      try {
        await prisma.lmsAnswerEvaluation.create({
          data: {
            candidateId,
            questionText:    question,
            candidateAnswer,
            domain,
            difficulty:      difficulty || 'medium',
            skillTag:        skillTag   || null,
            score:           finalScore,
            rawAiScore:      Number(evaluation.rawScore) || 50,
            authenticityScore: authScore,
            timeTaken:       timeTaken || 0,
            confidence:      evaluation.confidence || 0.5,
            strengths:       evaluation.strengths || [],
            weaknesses:      evaluation.weaknesses || [],
            suggestions:     evaluation.suggestions || [],
            contextData:     sessionContext || {},
          },
        });
      } catch (dbErr) {
        console.error('[LMS-AI] Evaluation persist failed:', dbErr.message);
      }
    }

    return res.status(200).json({
      score: finalScore,
      rawAiScore: evaluation.rawScore,
      authenticityScore: authScore,
      strengths: evaluation.strengths,
      weaknesses: evaluation.weaknesses,
      suggestions: evaluation.suggestions,
      trend,
      confidence: evaluation.confidence
    });


  } catch (error) {
    console.error('[LMS-AI] evaluateAnswer Error:', error);
    return res.status(500).json({
      score: 0,
      strengths: [],
      weaknesses: ['Evaluation service temporarily unavailable.'],
      suggestions: ['Please try again.'],
      confidence: 0,
    });
  }
};

// ============================================================
// SKILL-LEVEL ANALYTICS AGGREGATOR
// ============================================================
const getSkillAnalytics = async (req, res) => {
  try {
    const { candidateId } = req.params;
    const evals = await prisma.lmsAnswerEvaluation.findMany({
      where: { candidateId },
      orderBy: { evaluatedAt: 'desc' },
    });

    if (!evals.length) return res.status(200).json({ message: 'No data', stats: {} });

    // Overall Average
    const overallAvg = evals.reduce((sum, e) => sum + e.score, 0) / evals.length;

    // Trend (Last 5 vs historical)
    const latest5 = evals.slice(0, 5);
    const latestAvg = latest5.reduce((sum, e) => sum + e.score, 0) / latest5.length;
    const improvementTrend = latestAvg > overallAvg ? 'up' : (latestAvg < overallAvg ? 'down' : 'stable');

    // Skill & Domain mapping
    const skillMap = {};
    evals.forEach(e => {
      const key = e.skillTag || 'General';
      if (!skillMap[key]) skillMap[key] = { total: 0, count: 0 };
      skillMap[key].total += e.score;
      skillMap[key].count++;
    });

    const bySkill = Object.entries(skillMap).map(([skill, s]) => ({
      skill, avg: Math.round(s.total/s.count), count: s.count
    })).sort((a, b) => b.avg - a.avg);

    return res.status(200).json({
      overallAvg: Math.round(overallAvg),
      improvementTrend,
      bySkill,
      topSkill: bySkill[0]?.skill,
      weakestSkill: bySkill[bySkill.length-1]?.skill,
      totalEvaluations: evals.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Analytics failed' });
  }
};

const generateInterviewReport = async (req, res) => {
  try {
    const { candidateId, domain } = req.body;

    const evals = await prisma.lmsAnswerEvaluation.findMany({
      where: { candidateId, domain },
      orderBy: { evaluatedAt: 'desc' }
    });

    if (!evals.length) return res.status(404).json({ error: 'No interview data for this domain' });

    const avgScore = evals.reduce((s, e) => s + e.score, 0) / evals.length;
    const authAvg = evals.reduce((s, e) => s + e.authenticityScore, 0) / evals.length;

    // Mock percentile logic (usually would query system-wide averages)
    const percentile = Math.min(99, Math.round((avgScore / 100) * 100)); 

    const reportData = {
      overallScore: Math.round(avgScore),
      domainPerformance: { 
        domain, 
        percentile: `${percentile}%`, 
        status: avgScore > 70 ? 'Excellent' : (avgScore > 50 ? 'Strong' : 'Improvement Recommended')
      },
      authenticityAvg: Number(authAvg.toFixed(2)),
      strongestSkills: [], // derived from evals
      weakestSkills: [],
      recommendation: avgScore > 65 ? "Highly Recommended" : "Requires Further Training"
    };

    return res.status(200).json(reportData);
  } catch (err) {
    res.status(500).json({ error: 'Report generation failed' });
  }
};

module.exports = {
  generateQuestions,
  evaluateAnswer,
  getSkillAnalytics,
  generateInterviewReport
};
