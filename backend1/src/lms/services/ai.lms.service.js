const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const MistralClient = require('@mistralai/mistralai');
const { OPENAI_CHAT_MODEL } = require('../../config/openaiModel');

const MISTRAL_CHAT_MODEL = process.env.MISTRAL_CHAT_MODEL || 'mistral-small-latest';

function applyEnvOpenAiModel(client) {
  if (!client?.chat?.completions?.create) return client;
  const originalCreate = client.chat.completions.create.bind(client.chat.completions);
  client.chat.completions.create = (body = {}, ...args) =>
    originalCreate({ ...body, model: OPENAI_CHAT_MODEL }, ...args);
  return client;
}

/**
 * Returns an instance of OpenAI Client
 */
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return applyEnvOpenAiModel(new OpenAI({ apiKey }));
}

/**
 * Returns an instance of Anthropic Client
 */
function getAnthropicClient() {
  // Disabled as per user request to use ONLY OpenAI
  return null;
}

/**
 * Returns an instance of Google Gemini Client
 */
function getGeminiClient() {
  return null;
}

/**
 * Returns an instance of Mistral Client (disabled in current setup)
 */
function getMistralClient() {
  return null;
}

/**
 * Helper to extract JSON from markdown fences
 */
function extractJson(raw) {
  if (!raw) return null;
  // Clean up common markdown markers
  let cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
  
  // Try to find the first '{' or '[' and its corresponding last '}' or ']'
  const objStart = cleaned.indexOf('{');
  const objEnd = cleaned.lastIndexOf('}');
  const arrStart = cleaned.indexOf('[');
  const arrEnd = cleaned.lastIndexOf(']');

  // Use the outermost structure (prefer object if both exist, based on start index)
  let start = -1;
  let end = -1;

  if (objStart !== -1 && (arrStart === -1 || objStart < arrStart)) {
    start = objStart;
    end = objEnd;
  } else if (arrStart !== -1) {
    start = arrStart;
    end = arrEnd;
  }

  if (start === -1 || end === -1) {
    throw new Error('AI did not return valid JSON');
  }

  const jsonStr = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('JSON Parse failed for:', jsonStr);
    return null; // Return null instead of throwing, let callers handle fallback
  }
}

const STATIC_GOAL_RECOMMENDATIONS = [
  'Software Engineer',
  'Full Stack Developer',
  'Frontend Developer',
  'Backend Developer',
  'Mobile App Developer',
  'DevOps Engineer',
  'Cloud Engineer',
  'Site Reliability Engineer',
  'Data Analyst',
  'Data Scientist',
  'Business Analyst',
  'Machine Learning Engineer',
  'AI Engineer',
  'Cybersecurity Analyst',
  'QA Engineer',
  'Automation Test Engineer',
  'UI/UX Designer',
  'Product Designer',
  'Product Manager',
  'Project Manager',
  'Solutions Architect',
  'Technical Support Engineer',
  'Sales Executive',
  'Digital Marketing Specialist',
  'Content Strategist',
  'Finance Analyst',
  'Operations Manager',
  'HR Executive',
  'Recruiter',
  'Customer Success Manager'
];

const STATIC_LOCATION_RECOMMENDATIONS = [
  'Bangalore, India',
  'Bengaluru, India',
  'Hyderabad, India',
  'Pune, India',
  'Chennai, India',
  'Mumbai, India',
  'Delhi NCR, India',
  'Gurugram, India',
  'Noida, India',
  'Kolkata, India',
  'Ahmedabad, India',
  'Kochi, India',
  'Singapore',
  'Dubai, UAE',
  'London, UK',
  'Berlin, Germany',
  'Amsterdam, Netherlands',
  'Toronto, Canada',
  'Vancouver, Canada',
  'New York, USA',
  'Remote',
  'Seattle, USA',
  'San Francisco, USA',
  'Austin, USA',
  'Boston, USA',
  'Sydney, Australia'
];

function normalizeSearchValue(value = '') {
  return String(value).trim().toLowerCase();
}

function scoreSuggestion(query, suggestion) {
  const normalizedQuery = normalizeSearchValue(query);
  const normalizedSuggestion = normalizeSearchValue(suggestion);

  if (!normalizedQuery || !normalizedSuggestion) return 0;
  if (normalizedSuggestion === normalizedQuery) return 120;
  if (normalizedSuggestion.startsWith(normalizedQuery)) return 100;

  const suggestionWords = normalizedSuggestion.split(/[\s,/()-]+/).filter(Boolean);
  if (suggestionWords.some(word => word.startsWith(normalizedQuery))) return 80;
  if (normalizedSuggestion.includes(normalizedQuery)) return 60;

  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (queryTokens.length && queryTokens.every(token => normalizedSuggestion.includes(token))) {
    return 40;
  }

  return 0;
}

function getStaticRecommendations(query, suggestions, limit) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return [];

  return suggestions
    .map(value => ({ value, score: scoreSuggestion(normalizedQuery, value) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.value.localeCompare(b.value))
    .slice(0, limit)
    .map(entry => entry.value);
}

// ---------------------------------------------------------
// LMS AI FUNCTIONS WITH MULTI-PROVIDER FALLBACK
// ---------------------------------------------------------

async function generateDashboardInsight(userState, profileContext = {}) {
  const prompt = `You are a personalized LMS coaching assistant for SAASA B2E. 
Analyze the user's current LMS activity and their professional background to provide one high-impact insight.

User LMS State (Courses, Quizzes, Strengths):
${JSON.stringify(userState, null, 2)}

User Profile Context (Skills, Experience, Target Roles):
${JSON.stringify(profileContext, null, 2)}

Return ONLY valid JSON with no markdown in this format:
{
  "primaryInsight": "A single sentence insight that references their profile/CV naturally.",
  "reason": "Brief reason why this matters for their career goal.",
  "ctaRoute": "/lms/courses",
  "badge": "AI PRIORITY"
}`;

  // Try Mistral first (Primary)
  try {
    const mistral = getMistralClient();
    if (mistral) {
      const response = await mistral.chat.complete({
        model: MISTRAL_CHAT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      });
      return extractJson(response.choices[0].message.content);
    }
  } catch (e) {
    console.warn('Mistral failed for insight, trying Gemini...', e.message);
  }

  // Try Gemini
  try {
    const gemini = getGeminiClient();
    if (gemini) {
      const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      return extractJson(result.response.text());
    }
  } catch (e) {
    console.warn('Gemini failed for insight, trying OpenAI...', e.message);
  }

  // Fallback to OpenAI (last resort due to quota issues)
  try {
    const openai = getOpenAIClient();
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: OPENAI_CHAT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      });
      return extractJson(completion.choices[0].message.content);
    }
  } catch (e) {
    console.error('All AI providers failed for insight:', e.message);
  }

  return {
    primaryInsight: "Based on your profile, focusing on your core technical skills will accelerate your job search.",
    reason: "Your background suggests strong potential in current market-demand roles.",
    ctaRoute: "/lms/career-path",
    badge: "AI RECOMMENDATION"
  };
}

async function generatePersonalizedRecommendations(profileContext) {
  const prompt = `Based on the following candidate profile and CV analysis, suggest 3 high-impact learning modules (courses/prep) available in our LMS.

Candidate Profile:
${JSON.stringify(profileContext, null, 2)}

Return ONLY a JSON array of 3 objects in this format:
[
  {
    "id": "rec-1",
    "title": "Module Title",
    "description": "Short explanation of why this matches their CV/Gap.",
    "tag": "Beginner | Intermediate | Advanced",
    "href": "/lms/courses/c1",
    "type": "course | prep | quiz"
  }
]`;

  // Try Mistral
  try {
    const mistral = getMistralClient();
    if (mistral) {
      const response = await mistral.chat.complete({
        model: MISTRAL_CHAT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
      });
      const result = extractJson(response.choices[0].message.content);
      if (result) return result;
    }
  } catch (e) {
    console.warn('Mistral failed for recommendations, trying Gemini...', e.message);
  }

  // Try Gemini
  try {
    const gemini = getGeminiClient();
    if (gemini) {
      const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      const res = extractJson(result.response.text());
      if (res) return res;
    }
  } catch (e) {
    console.warn('Gemini failed for recommendations, trying OpenAI...', e.message);
  }

  try {
    const openai = getOpenAIClient();
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: OPENAI_CHAT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
      });
      const result = extractJson(completion.choices[0].message.content);
      if (result) return result;
    }
  } catch (e) {
    console.error('AI Recommendations failed across all providers:', e.message);
  }

  return [
    {
      id: 'default-1',
      title: 'Core Professional Skills',
      description: 'Strengthen the foundational skills identified in your profile analysis.',
      tag: 'Intermediate',
      href: '/lms/courses',
      type: 'course'
    }
  ];
}

async function generateAIRoadmap(profileContext) {
  const prompt = `You are a professional career coach. Generate a step-by-step career roadmap for the following candidate.

Candidate Profile:
${JSON.stringify(profileContext, null, 2)}

Return ONLY a JSON array of roadmap objects.
The roadmap should have 4 phases: 'foundation', 'core', 'mastery', 'job-ready'.
Each object should have:
- id: e.g. "fp-1", "cp-1"
- title: Brief task title
- label: same as title
- phase: one of the 4 phases
- status: "planned"
- targetType: "course" | "quiz" | "event" | "resume" | "interview"
- targetRoute: one of ["/lms/courses", "/lms/quizzes", "/lms/resume-builder", "/lms/interview-prep"]
- reason: Why this step is important.

Generate 6-8 total steps.
Return ONLY valid JSON.`;

  // Try Gemini first (Good for long structured lists)
  try {
    const gemini = getGeminiClient();
    if (gemini) {
      const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      const res = extractJson(result.response.text());
      if (res) return res;
    }
  } catch (e) {
    console.warn('Gemini failed for roadmap, trying Mistral...', e.message);
  }

  // Try Mistral
  try {
    const mistral = getMistralClient();
    if (mistral) {
      const response = await mistral.chat.complete({
        model: MISTRAL_CHAT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
      });
      const result = extractJson(response.choices[0].message.content);
      if (result) return result;
    }
  } catch (e) {
    console.warn('Mistral failed for roadmap, trying OpenAI...', e.message);
  }

  try {
    const openai = getOpenAIClient();
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: OPENAI_CHAT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4
      });
      const result = extractJson(completion.choices[0].message.content);
      if (result) return result;
    }
  } catch (e) {
    console.error('AI Roadmap failed across all providers:', e.message);
    return [
      { id: 'f-1', title: 'Complete Professional Profile', phase: 'foundation', status: 'planned', targetType: 'career', targetRoute: '/lms/profile', reason: 'Foundational step for all career tracking.' },
      { id: 'f-2', title: 'Resume Strength Check', phase: 'foundation', status: 'planned', targetType: 'resume', targetRoute: '/lms/resume-builder', reason: 'Ensure your resume is ATS-ready.' }
    ];
  }
}

async function generateDailyMomentum(userState, profileContext) {
  try {
    const prompt = `
      As a career coach AI, generate 3 specific "Today's focus" items for this candidate.
      Candidate Profile: ${JSON.stringify(profileContext)}
      Usage State: ${JSON.stringify(userState)}
      
      Requirements:
      - 3 actionable items (must include types: quiz, topic, session, note, or career).
      - Items should be short (e.g., "Complete 1 JavaScript Quiz").
      - One item should be optional.
      
      Return JSON: { items: [{ id: string, text: string, type: string, optional: boolean }] }
    `;

    // Try Mistral
    try {
      const mistral = getMistralClient();
      if (mistral) {
        const response = await mistral.chat.complete({
          model: MISTRAL_CHAT_MODEL,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.5,
        });
        const result = extractJson(response.choices[0].message.content);
        if (result) return { title: "Today's focus", items: result.items || [] };
      }
    } catch (e) {
      console.warn('Mistral failed for DailyMomentum, trying Gemini...', e.message);
    }

    // Try Gemini
    try {
      const gemini = getGeminiClient();
      if (gemini) {
        const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(prompt);
        const res = extractJson(result.response.text());
        if (res) return { title: "Today's focus", items: res.items || [] };
      }
    } catch (e) {
      console.warn('Gemini failed for DailyMomentum, trying OpenAI...', e.message);
    }

    const openai = getOpenAIClient();
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: OPENAI_CHAT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
      });
      const response = extractJson(completion.choices[0].message.content);
      return {
        title: "Today's focus",
        items: response?.items || []
      };
    }
  } catch (error) {
    console.error('AI generateDailyMomentum error:', error);
  }
  return {
    title: "Today's focus",
    items: [
      { id: 'quiz', text: 'Complete 1 quiz', type: 'quiz', optional: false },
      { id: 'weak', text: 'Review 1 weak topic', type: 'topic', optional: false },
      { id: 'session', text: 'Attend 1 session', type: 'session', optional: true }
    ]
  };
}

async function generateSharedIntelligence(userState, profileContext) {
  try {
    const prompt = `
      Generate a short "Connected Intelligence" pulse for the LMS dashboard.
      This shows how the AI is connecting different areas of the platform (Notes, Quizzes, Resume, Career Path).
      Candidate Profile: ${JSON.stringify(profileContext)}
      Usage State: ${JSON.stringify(userState)}
      
      Return JSON: { summary: string, flowLabel: string }
      Example summary: "Reviewing your notes on React Hooks has triggered a quiz recommendation for tomorrow."
      Example flowLabel: "Notes → Quiz → Skill Boost"
    `;

    // Try Mistral
    try {
      const mistral = getMistralClient();
      if (mistral) {
        const response = await mistral.chat.complete({
          model: MISTRAL_CHAT_MODEL,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.5,
        });
        const result = extractJson(response.choices[0].message.content);
        if (result) return result;
      }
    } catch (e) {
      console.warn('Mistral failed for SharedIntelligence, trying Gemini...', e.message);
    }

    const openai = getOpenAIClient();
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: OPENAI_CHAT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
      });
      return extractJson(completion.choices[0].message.content);
    }
  } catch (error) {
    console.error('AI generateSharedIntelligence error:', error);
  }
  return {
    summary: "Your recent activities are being aggregated to refine your career roadmap.",
    flowLabel: "Intelligence Sync Active"
  };
}

async function generateInterviewQuestions(topic, role, count, difficulty) {
  const prompt = `Generate ${count} ${difficulty} level interview questions.
Topic: ${topic}
Target Role: ${role}

Return ONLY a JSON array of objects with this shape:
[
  { "id": "q1", "text": "Question text here..." }
]`;

  // Try OpenAI first for question generation (usually more uniform JSON)
  try {
    const openai = getOpenAIClient();
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: OPENAI_CHAT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
      });
      return extractJson(completion.choices[0].message.content);
    }
  } catch (e) {
    console.warn('OpenAI failed for questions, trying Anthropic...', e.message);
  }

  // Fallback to Anthropic
  try {
    const anthropic = getAnthropicClient();
    if (anthropic) {
      const message = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        temperature: 0.4,
        messages: [{ role: 'user', content: prompt }]
      });
      return extractJson(message.content[0].text);
    }
  } catch (e) {
    console.error('Anthropic also failed:', e.message);
  }

  return [{ id: 'error-q1', text: `Could not generate questions for ${topic} at this time.` }];
}

async function scoreInterviewAnswer(question, answer) {
  const prompt = `Evaluate the following interview answer.
Question: ${question}
User Answer: ${answer}

Provide feedback and return ONLY a JSON object with this shape:
{
  "strengthsArray": ["strength 1", "strength 2"],
  "improvementsArray": ["improvement 1", "improvement 2"],
  "rewrittenAnswer": "A strong, professional way to answer this question.",
  "score": 8.5
}`;

  try {
    const openai = getOpenAIClient();
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: OPENAI_CHAT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      });
      return extractJson(completion.choices[0].message.content);
    }
  } catch (error) {
    console.error('scoreInterviewAnswer error:', error);
  }

  return {
    strengthsArray: ['Answer recorded.'],
    improvementsArray: ['AI scoring temporarily unavailable.'],
    rewrittenAnswer: answer,
    score: 5
  };
}

async function scoreAllSessionAnswers(questionsWithAnswers) {
  const prompt = `Evaluate an entire mock interview session.
Session details:
${JSON.stringify(questionsWithAnswers, null, 2)}

Return ONLY a JSON object with this shape:
{
  "overallScore": 8.0,
  "feedback": {
    "question_id_here": {
      "strengthsArray": [],
      "improvementsArray": [],
      "rewrittenAnswer": "",
      "score": 8
    }
  }
}`;

  try {
    const openai = getOpenAIClient();
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: OPENAI_CHAT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      });
      return extractJson(completion.choices[0].message.content);
    }
  } catch (error) {
    console.error('scoreAllSessionAnswers error:', error);
  }

  const fallbackFeedback = {};
  questionsWithAnswers.forEach(q => {
    fallbackFeedback[q.id] = {
      strengthsArray: ['Recorded'],
      improvementsArray: ['Unavailable'],
      rewrittenAnswer: q.userAnswer || '',
      score: 5
    };
  });
  return { overallScore: 5, feedback: fallbackFeedback };
}

async function generateNoteAction(noteBody, action) {
  const prompt = `Perform the following action on the provided note text.
Action: ${action}
Note Text:
${noteBody}

Return ONLY the output string in plain text (or markdown).`;

  try {
    const anthropic = getAnthropicClient();
    if (anthropic) {
      const message = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 800,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }]
      });
      return message.content[0].text.trim();
    }
  } catch (e) {
    console.warn('Anthropic failed for note action, trying OpenAI...', e.message);
  }

  try {
    const openai = getOpenAIClient();
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: OPENAI_CHAT_MODEL,
        messages: [{ role: 'user', content: prompt }],
      });
      return completion.choices[0].message.content.trim();
    }
  } catch (e) {
    console.error('OpenAI also failed for note action:', e.message);
  }

  return "AI generation failed. Please try again later.";
}

async function improveResumeSection(section, content, targetRole) {
  const prompt = `Improve this resume section.
Section: ${section}
Target Role: ${targetRole}
Current Content: ${content}

Return ONLY the improved content in plain text.`;

  try {
    const openai = getOpenAIClient();
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: OPENAI_CHAT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
      });
      return completion.choices[0].message.content.trim();
    }
  } catch (error) {
    console.error('improveResumeSection error:', error);
  }
  return content;
}

function stripPriorTailorSummaryBlocks(summary) {
  let text = String(summary || '').replace(/\s+/g, ' ').trim();
  const patterns = [
    /Role alignment:[^.]*\./gi,
    /Seeking to contribute as[^.]*\./gi,
    /Seeking the [^.]* opportunity at[^.]*\./gi,
    /Targeting\s+[^.]+\s+at\s+[^.]+\./gi,
    /Core strengths:[^.]*\./gi,
    /Building alignment with[^.]*\./gi,
    /Building depth in[^.]*\./gi,
    /Proven expertise in[^.]*\./gi,
    /Experience aligned with[^.]*\./gi,
    /Highlights include[^.]*\./gi,
    /Aligned with [^.]* requirements\./gi,
  ];
  for (const pattern of patterns) {
    text = text.replace(pattern, '');
  }
  const match = text.match(/^(.{8,90}?\s+with\s+[\d–\-+]+\s*(?:yrs?|years?))\s+/i);
  if (match?.[1]) {
    const prefix = match[1].trim();
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`^(?:${escaped}\\s*)+`, 'i'), `${prefix} `);
  }
  return text.replace(/\s+/g, ' ').replace(/\.{2,}/g, '.').trim();
}

async function tailorResumeSummaryForJob({
  existingSummary = '',
  jobTitle = '',
  company = '',
  experienceLevel = '',
  matchedSkills = [],
  missingSkills = [],
  experienceContext = '',
}) {
  const role = String(jobTitle || 'this role').trim();
  const org = String(company || 'the company').trim();
  const cleaned = stripPriorTailorSummaryBlocks(existingSummary);
  const matched = (Array.isArray(matchedSkills) ? matchedSkills : []).slice(0, 6).join(', ');
  const missing = (Array.isArray(missingSkills) ? missingSkills : []).slice(0, 4).join(', ');

  const prompt = `You are an expert resume writer. Rewrite ONE professional summary tailored for a job application.

Target role: ${role}
Company: ${org}
Experience level: ${experienceLevel || 'not specified'}
JD-matched skills: ${matched || 'not specified'}
Growth areas from JD: ${missing || 'none'}
${experienceContext ? `Recent experience context: ${experienceContext}` : ''}
Current summary (may contain outdated duplicate tailoring — ignore repeated phrases):
${cleaned || 'No existing summary — write from the role and skills above.'}

Requirements:
1. Return ONE cohesive paragraph of 3–4 sentences (maximum 110 words).
2. Professional, confident, ATS-friendly tone.
3. Naturally weave matched skills; mention growth areas only briefly if relevant.
4. End with clear interest in the ${role} role at ${org}.
5. Do NOT use section labels such as "Role alignment:", "Core strengths:", or "Seeking to contribute as".
6. Do NOT repeat the job title or years-of-experience phrase more than once.
7. Return ONLY the summary text — no quotes, markdown, or commentary.`;

  try {
    const openai = getOpenAIClient();
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: OPENAI_CHAT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.55,
        max_tokens: 220,
      });
      const text = completion.choices[0].message.content.trim();
      if (text) return stripPriorTailorSummaryBlocks(text);
    }
  } catch (error) {
    console.warn('tailorResumeSummaryForJob OpenAI failed:', error.message);
  }

  try {
    const anthropic = getAnthropicClient();
    if (anthropic) {
      const message = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 280,
        temperature: 0.55,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = message.content[0].text.trim();
      if (text) return stripPriorTailorSummaryBlocks(text);
    }
  } catch (error) {
    console.error('tailorResumeSummaryForJob final error:', error);
  }

  throw new Error('Failed to tailor summary with AI');
}

async function generateResumeSummary(headline, experienceContext = '') {
  const prompt = `You are a professional resume writer for high-end roles. Generate a compelling, 3-5 line professional summary for a candidate.
Candidate Headline: ${headline}
${experienceContext ? `Key Experience Context: ${experienceContext}` : ''}

CRITICAL INSTRUCTIONS:
1. Start with a strong role identification.
2. Highlight core strengths and quantifiable impact.
3. Keep it professional, sharp, and ATS-friendly.
4. Maximum 200 words.
5. Return ONLY the summary text, no conversational filler.

Return ONLY the summary text directly.`;

  try {
    const openai = getOpenAIClient();
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: OPENAI_CHAT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });
      return completion.choices[0].message.content.trim();
    }
  } catch (error) {
    console.warn('OpenAI failed for summary, trying Anthropic...', error.message);
  }

  // Fallback to Anthropic
  try {
    const anthropic = getAnthropicClient();
    if (anthropic) {
      const message = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 300,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }]
      });
      return message.content[0].text.trim();
    }
    
    throw new Error('AI providers not configured (OPENAI_API_KEY/ANTHROPIC_API_KEY missing)');
  } catch (error) {
    console.error('generateResumeSummary final error:', error);
    throw new Error('Failed to generate summary with AI: ' + error.message);
  }
}

async function checkResumeATS(resumeData, jobDescription) {
  const prompt = `Act as an ATS (Applicant Tracking System). Compare this resume to the job description.
Job Description:
${jobDescription}
Resume:
${JSON.stringify(resumeData, null, 2)}

Return ONLY a JSON object with this shape:
{
  "matchScore": 85,
  "missingKeywords": [],
  "suggestions": []
}`;

  try {
    const openai = getOpenAIClient();
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: OPENAI_CHAT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      });
      return extractJson(completion.choices[0].message.content);
    }
  } catch (error) {
    console.error('checkResumeATS error:', error);
  }
  return { matchScore: 0, missingKeywords: [], suggestions: ["ATS checking unavailable at this time."] };
}

async function getCompanyResearchData(companyName) {
  const prompt = `Provide research data for the company: ${companyName}.
Return ONLY a JSON object with this shape:
{
  "name": "${companyName}",
  "overview": "...",
  "culture": "...",
  "commonInterviewTopics": [],
  "suggestedQuestions": []
}`;

  try {
    const anthropic = getAnthropicClient();
    if (anthropic) {
      const message = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 600,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }]
      });
      return extractJson(message.content[0].text);
    }
  } catch (e) {
    console.warn('Anthropic failed for research, trying OpenAI...', e.message);
  }

  try {
    const openai = getOpenAIClient();
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: OPENAI_CHAT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      });
      return extractJson(completion.choices[0].message.content);
    }
  } catch (e) {
    console.error('OpenAI also failed for research:', e.message);
  }

  return {
    name: companyName,
    overview: 'Data temporarily unavailable.',
    culture: 'Unknown',
    commonInterviewTopics: [],
    suggestedQuestions: []
  };
}

module.exports = {
  generateDashboardInsight,
  generateInterviewQuestions,
  scoreInterviewAnswer,
  scoreAllSessionAnswers,
  generateNoteAction,
  improveResumeSection,
  generateResumeSummary,
  tailorResumeSummaryForJob,
  checkResumeATS,
  getCompanyResearchData,
  generatePersonalizedRecommendations,
  generateAIRoadmap,
  generateDailyMomentum,
  generateSharedIntelligence,
  generateOrchestrationPlan,
  generateGoalRecommendations,
  generateLocationRecommendations
};

async function generateGoalRecommendations(query) {
  const prompt = `Suggest 5 professional job roles or company industries matching the partial search query: "${query}".
  Return ONLY a JSON array of strings. Example: ["Software Engineer", "Frontend Developer"]`;

  try {
    const openai = getOpenAIClient();
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: OPENAI_CHAT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.3,
      });
      const result = extractJson(completion.choices[0].message.content);
      if (Array.isArray(result) && result.length > 0) return result;
    }
  } catch (error) {
    console.warn('AI Goal Recs failed, falling back to static list.', error.message);
  }
  return getStaticRecommendations(query, STATIC_GOAL_RECOMMENDATIONS, 5);
}

async function generateLocationRecommendations(query) {
  const prompt = `Suggest 5 global cities or regions matching the partial search query: "${query}".
  Return ONLY a JSON array of strings. Example: ["New York, USA", "London, UK"]`;

  try {
    const openai = getOpenAIClient();
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: OPENAI_CHAT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.3,
      });
      const result = extractJson(completion.choices[0].message.content);
      if (Array.isArray(result) && result.length > 0) return result;
    }
  } catch (error) {
    console.warn('AI Location Recs failed, falling back to static list.', error.message);
  }
  return getStaticRecommendations(query, STATIC_LOCATION_RECOMMENDATIONS, 12);
}
async function generateOrchestrationPlan(targetRole) {
  const prompt = `You are an LMS Architect. Generate a personalized learning plan for a candidate wanting to become a "${targetRole}".
  
  Return ONLY valid JSON with this structure:
  {
    "courses": [
      { "title": "Course Title", "description": "Short desc", "category": "Core", "level": "Intermediate", "hours": 10, "lessons": ["Title 1", "Title 2"] }
    ],
    "quizzes": [
      { "title": "Quiz Title", "description": "Short desc", "category": "Technical", "skills": ["Skill A"], "minutes": 15, "questions": [{ "q": "Question?", "options": ["A", "B"], "correct": 0 }] }
    ],
    "events": [
      { "title": "Event Title", "description": "Short desc", "type": "WEBINAR", "daysFromNow": 3 }
    ],
    "interviewQuestions": [
      { "id": "q1", "text": "Question?", "context": "Experience" }
    ]
  }
  
  Generate 2 courses, 1 quiz, and 1 event. All themed around "${targetRole}".`;

  try {
    const openai = getOpenAIClient();
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: OPENAI_CHAT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
      });
      const result = extractJson(completion.choices[0].message.content);
      if (result) return result;
    }
  } catch (error) {
    if (!error.message?.includes('401')) console.error('generateOrchestrationPlan OpenAI failed:', error.message);
  }

  // Final fallback to Gemini
  try {
    const gemini = getGeminiClient();
    if (gemini) {
        const model = gemini.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const json = extractJson(text);
        if (json) return json;
    }
  } catch (error) {
     if (!error.message?.includes('401')) console.error('generateOrchestrationPlan Gemini failed:', error.message);
  }

  return null;
}
