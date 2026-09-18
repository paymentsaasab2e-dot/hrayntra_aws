const { prisma } = require('../lib/prisma');

/** Clear off-topic intents that should never hit the LLM. */
const OFF_TOPIC_PATTERNS = [
  /\b(write|create|generate|debug|fix|implement)\b[\s\S]{0,60}\b(code|program|script|function|class|algorithm)\b/i,
  /\b(python|javascript|java|c\+\+|typescript|golang|rust)\b[\s\S]{0,40}\b(program|code|script|function|loop|array)\b/i,
  /\b(sum|add|multiply|divide)\s+(two|2|three|3)\s+numbers?\b/i,
  /\b(leetcode|hackerrank|codechef|coding\s*challenge|competitive\s*programming)\b/i,
  /\b(homework|school\s*assignment|solve\s*this\s*(math|equation|integral))\b/i,
  /\b(recipe|cook(?:ing)?|weather\s*forecast|tell\s*me\s*a\s*joke|riddle)\b/i,
  /\b(who\s*won|sports\s*score|movie\s*review|celebrity\s*gossip)\b/i,
  /\b(diagnose|prescription|medical\s*advice|lawsuit|legal\s*advice)\b/i,
  /\b(crypto\s*trading\s*bot|stock\s*tips|gambling)\b/i,
  /\b(write\s*(an?\s*)?(essay|poem|story|song)\b)/i,
  /\b(translate\s+this\s+(paragraph|essay|document))\b/i,
];

/** Mentions that keep “python/skills” etc. in career scope. */
const CAREER_ALLOW_PATTERNS = [
  /\b(job|jobs|career|careers|resume|cv|interview|interviews|salary|negotiat|recruiter|recruitment)\b/i,
  /\b(profile|linkedin|ats|hiring|application|apply|offer\s*letter|notice\s*period)\b/i,
  /\b(skill|skills|role|roles|designation|promotion|upskill|reskill|portfolio)\b/i,
  /\b(hryantra|saasa|lms|course|certification|work\s*experience|fresher)\b/i,
];

const REFUSAL_MESSAGE = [
  "I'm your HRYANTRA Career Assistant, so I only help with career and job-search topics —",
  'CV/profile tips, interviews, skills for roles, job search strategy, and using HRYANTRA.',
  "I can't help with general coding, homework, or unrelated questions.",
  'Try asking something like: how to improve your CV, interview prep for your target role, or which skills to learn next.',
].join(' ');

function textHasCareerIntent(text) {
  return CAREER_ALLOW_PATTERNS.some((re) => re.test(text));
}

function textLooksOffTopic(text) {
  return OFF_TOPIC_PATTERNS.some((re) => re.test(text));
}

/**
 * Pre-filter before LLM. Returns a canned refusal string when off-topic, else null.
 */
function getCareerAssistantPrefilterRefusal(message) {
  const text = String(message || '').trim();
  if (!text) return null;
  if (!textLooksOffTopic(text)) return null;
  // e.g. "Should I learn Python for data-science jobs?" stays allowed
  if (textHasCareerIntent(text)) return null;
  return REFUSAL_MESSAGE;
}

function clip(value, max = 220) {
  const s = String(value || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * Compact candidate snapshot for personalised career answers (no secrets).
 */
async function loadCareerAssistantProfileContext(candidateId) {
  const id = String(candidateId || '').trim();
  if (!id) return '';

  try {
    const candidate = await prisma.candidate.findUnique({
      where: { id },
      select: {
        firstName: true,
        lastName: true,
        city: true,
        country: true,
        profile: {
          select: {
            fullName: true,
            city: true,
            country: true,
            employmentStatus: true,
            profileCompleteness: true,
          },
        },
        summary: { select: { summaryText: true } },
        skills: {
          take: 12,
          include: { skill: { select: { name: true } } },
        },
        workExperiences: {
          take: 3,
          orderBy: { startDate: 'desc' },
          select: {
            jobTitle: true,
            company: true,
            isCurrentJob: true,
          },
        },
        careerPreferences: {
          select: {
            preferredRoles: true,
            preferredIndustry: true,
            preferredWorkMode: true,
            preferredLocations: true,
          },
        },
        resume: {
          select: { fileName: true, atsScore: true },
        },
      },
    });

    if (!candidate) return '';

    const name =
      clip(candidate.profile?.fullName) ||
      clip([candidate.firstName, candidate.lastName].filter(Boolean).join(' ')) ||
      'Candidate';
    const location = clip(
      [candidate.profile?.city || candidate.city, candidate.profile?.country || candidate.country]
        .filter(Boolean)
        .join(', '),
    );
    const skills = (candidate.skills || [])
      .map((row) => row?.skill?.name)
      .filter(Boolean)
      .slice(0, 12);
    const roles = (candidate.workExperiences || [])
      .map((exp) =>
        [exp.jobTitle, exp.company].filter(Boolean).join(' @ ') +
        (exp.isCurrentJob ? ' (current)' : ''),
      )
      .filter(Boolean);
    const prefs = candidate.careerPreferences || {};
    const preferredRoles = Array.isArray(prefs.preferredRoles)
      ? prefs.preferredRoles.filter(Boolean).slice(0, 5)
      : [];

    const lines = [
      `Name: ${name}`,
      location ? `Location: ${location}` : null,
      candidate.profile?.employmentStatus
        ? `Employment status: ${clip(candidate.profile.employmentStatus, 40)}`
        : null,
      typeof candidate.profile?.profileCompleteness === 'number'
        ? `Profile completeness: ${Math.round(candidate.profile.profileCompleteness)}%`
        : null,
      skills.length ? `Skills: ${skills.join(', ')}` : null,
      roles.length ? `Recent roles: ${roles.join('; ')}` : null,
      preferredRoles.length ? `Preferred roles: ${preferredRoles.join(', ')}` : null,
      prefs.preferredIndustry ? `Preferred industry: ${clip(prefs.preferredIndustry, 80)}` : null,
      prefs.preferredWorkMode ? `Preferred work mode: ${clip(String(prefs.preferredWorkMode), 60)}` : null,
      candidate.resume?.fileName
        ? `Resume on file: ${clip(candidate.resume.fileName, 80)}${
            candidate.resume.atsScore != null ? ` (ATS ${candidate.resume.atsScore})` : ''
          }`
        : 'Resume on file: none',
      candidate.summary?.summaryText
        ? `Summary excerpt: ${clip(candidate.summary.summaryText, 280)}`
        : null,
    ].filter(Boolean);

    return lines.join('\n');
  } catch (err) {
    console.warn(
      '[careerAssistant] profile context load failed:',
      err?.message || err,
    );
    return '';
  }
}

function buildCareerAssistantSystemPrompt(profileContext) {
  const base = [
    'You are HRYANTRA AI Career Assistant — a scoped career coach for job seekers on the HRYANTRA candidate portal.',
    'ONLY help with: job search strategy, resume/CV and profile improvement, interview prep, career paths, skills for roles,',
    'salary/negotiation basics, applications, LinkedIn/professional branding, and how to use HRYANTRA features (profile, jobs, matches, LMS).',
    'Stay concise, practical, and professional. Prefer short actionable steps over long essays.',
    '',
    'HARD SCOPE LIMIT — refuse off-topic requests politely and briefly.',
    'Refuse and do NOT answer: general programming/coding help, homework, math, writing unrelated essays, medical/legal advice,',
    'politics, entertainment trivia, unrelated technical tutorials, or anything not connected to careers/jobs/recruitment.',
    'When refusing, say you are limited to career and job-search help on HRYANTRA, then offer 1–2 career-related alternatives',
    '(e.g. improve CV, interview tips, which skills to learn for a target role).',
    'Never invent live job listings or claim you applied for the user; guide them to Search Jobs / profile instead.',
    'When candidate context is provided below, personalise advice to that profile (roles, skills, gaps) without inventing credentials they do not have.',
  ];

  if (profileContext && String(profileContext).trim()) {
    base.push('', 'CANDIDATE CONTEXT (use for personalisation; do not dump raw fields back unless asked):', String(profileContext).trim());
  } else {
    base.push(
      '',
      'No detailed candidate profile was loaded. Give general career guidance and suggest completing their HRYANTRA profile for better advice.',
    );
  }

  return base.join('\n');
}

module.exports = {
  getCareerAssistantPrefilterRefusal,
  loadCareerAssistantProfileContext,
  buildCareerAssistantSystemPrompt,
  REFUSAL_MESSAGE,
};
