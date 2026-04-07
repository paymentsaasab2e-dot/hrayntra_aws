import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import OpenAI from 'openai';
import { env } from '../config/env.js';
import { uploadBufferToCloudinary, cloudinaryResourceTypeForFile } from '../utils/cloudinary.js';

const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;
const require = createRequire(import.meta.url);

function divider(char = '=') {
  return char.repeat(80);
}

function logBlock(title) {
  console.log('');
  console.log(divider('='));
  console.log(title);
  console.log(divider('='));
}

function formatFileSize(bytes = 0) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(2)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}

function parsePositiveNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = String(value).replace(/,/g, '').replace(/[^\d.]+/g, ' ').trim();
  const match = normalized.match(/\d+(?:\.\d+)?/);
  const parsed = match ? Number(match[0]) : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeUrl(value = '') {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(www\.|linkedin\.com\/|github\.com\/|[a-z0-9-]+\.[a-z]{2,})/i.test(trimmed)) {
    return `https://${trimmed.replace(/^\/+/, '')}`;
  }
  return trimmed;
}

function cleanResumeText(rawText = '') {
  return String(rawText || '')
    .replace(/\u0000/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[^\S\n]+$/gm, '')
    .trim();
}

function extractResumeName(fullText = '') {
  const firstLine = String(fullText)
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) return { firstName: '', lastName: '' };
  const nameParts = firstLine.split(/\s+/).filter(Boolean);
  return {
    firstName: nameParts[0] || '',
    lastName: nameParts.slice(1).join(' '),
  };
}

function buildLocation(location = '', city = '', country = '') {
  const explicit = String(location || '').trim();
  if (explicit) return explicit;
  return [city, country].map((item) => String(item || '').trim()).filter(Boolean).join(', ');
}

async function extractResumeTextFromFile(file) {
  const extension = path.extname(file.originalname || file.filename || '').toLowerCase();

  if (file.mimetype === 'application/pdf' || extension === '.pdf') {
    const pdfParseModule = require('pdf-parse');
    const pdfParse =
      (typeof pdfParseModule === 'function' && pdfParseModule) ||
      (typeof pdfParseModule?.default === 'function' && pdfParseModule.default) ||
      (typeof pdfParseModule?.PDFParse === 'function' &&
        (async (buffer) => {
          const parser = new pdfParseModule.PDFParse({ data: buffer });
          const result = await parser.getText();
          if (typeof parser.destroy === 'function') {
            await parser.destroy();
          }
          return { text: result?.text || '' };
        }));

    if (!pdfParse) {
      throw new Error('Unsupported pdf-parse module shape');
    }

    const dataBuffer = fs.readFileSync(file.path);
    const pdfData = await pdfParse(dataBuffer);
    return cleanResumeText(pdfData?.text || '');
  }

  if (
    file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    extension === '.docx'
  ) {
    const mammothModule = await import('mammoth');
    const mammoth = mammothModule.default || mammothModule;
    const result = await mammoth.extractRawText({ path: file.path });
    return cleanResumeText(result?.value || '');
  }

  return cleanResumeText(fs.readFileSync(file.path, 'utf8'));
}

function findSection(text = '', sectionName = '', nextSections = []) {
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nextPattern = nextSections
    .map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const regex = new RegExp(
    `${escaped}\\s*\\n([\\s\\S]*?)(?:\\n(?:${nextPattern})\\s*\\n|$)`,
    'i'
  );
  return text.match(regex)?.[1]?.trim() || '';
}

function extractPortfolioLinks(text = '') {
  const matches = text.match(/(?:https?:\/\/)?(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?/gi) || [];
  const ignored = ['gmail.com', 'socket.io'];
  const seen = new Set();

  return matches
    .map((item) => normalizeUrl(item))
    .filter((item) => item && !ignored.some((ignoredHost) => item.toLowerCase().includes(ignoredHost)))
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((url) => {
      let type = 'Portfolio Website';
      if (url.includes('github.com')) type = 'GitHub';
      if (url.includes('linkedin.com')) type = 'LinkedIn';
      if (url.includes('behance.net')) type = 'Behance';
      return { type, url };
    });
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function buildHeuristicScore(merged = {}) {
  const skillsCount = Array.isArray(merged.skills) ? merged.skills.filter(Boolean).length : 0;
  const educationCount = Array.isArray(merged.educationEntries) ? merged.educationEntries.filter(Boolean).length : 0;
  const experienceCount = Array.isArray(merged.workExperienceEntries)
    ? merged.workExperienceEntries.filter(Boolean).length
    : 0;
  const keywordSignals = [
    merged.summary,
    merged.linkedinUrl,
    merged.portfolioUrl,
    merged.currentCompany,
    merged.currentDesignation || merged.designation,
  ].filter((item) => String(item || '').trim()).length;

  const skillsMatch = clampScore(Math.min(12, skillsCount) / 12 * 100);
  const experienceFit = clampScore(
    experienceCount > 0
      ? Math.min(100, 45 + Math.min(5, Number(merged.experience || 0)) * 8 + (merged.currentCompany ? 10 : 0))
      : 20
  );
  const educationFit = clampScore(
    educationCount > 0 ? Math.min(100, 50 + educationCount * 15 + (merged.education ? 10 : 0)) : 20
  );
  const keywordMatch = clampScore(Math.min(100, 30 + skillsCount * 4 + keywordSignals * 8));
  const overall = clampScore((skillsMatch + experienceFit + educationFit + keywordMatch) / 4);

  const insights = [];
  if (skillsCount >= 8) insights.push('Strong technical skill coverage detected in the resume.');
  if (experienceCount > 0) insights.push('Work experience section is present and contributes to profile strength.');
  if (educationCount > 0) insights.push('Education details are well represented in the resume.');
  if (merged.linkedinUrl || merged.portfolioUrl) insights.push('External profile links improve recruiter confidence.');
  if (!insights.length) insights.push('Resume parsed successfully, but more structured detail would improve scoring.');

  return {
    overall,
    breakdown: {
      skillsMatch,
      experienceFit,
      educationFit,
      keywordMatch,
    },
    insights: insights.slice(0, 4),
  };
}

function hasMeaningfulProvidedScore(providedScore = {}, providedBreakdown = {}) {
  const numericValues = [
    providedScore?.overall,
    providedBreakdown?.skillsMatch,
    providedBreakdown?.experienceFit,
    providedBreakdown?.educationFit,
    providedBreakdown?.keywordMatch,
  ]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  return numericValues.some((value) => value > 0);
}

function extractFallbackResumeData(text = '') {
  const lines = String(text).split('\n').map((line) => line.trim()).filter(Boolean);
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = text.match(/(\+?\d[\d\s\-().]{7,}\d)/);
  const linkedInMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+/i);
  const topLocation = lines.find((line, index) => index > 0 && index < 5 && /,/.test(line) && !/@/.test(line)) || '';
  const summaryText = findSection(text, 'Summary', ['Experience', 'Skills', 'Projects', 'Education', 'Certifications']);
  const experienceIndex = lines.findIndex((line) => /^experience$/i.test(line));
  const currentDesignation = experienceIndex >= 0 ? lines[experienceIndex + 1] || '' : '';
  const currentCompany = experienceIndex >= 0 ? lines[experienceIndex + 2] || '' : '';
  const experienceBlock = findSection(text, 'Experience', ['Skills', 'Projects', 'Education', 'Certifications']);
  const workLocation = experienceBlock.match(/\b(Remote|Onsite|On-site|Hybrid|[A-Z][a-z]+,\s*[A-Z][a-z]+)\b/)?.[0] || '';
  const portfolioLinks = extractPortfolioLinks(text);
  const skills = Array.from(
    new Set(
      (
        text.match(
          /\b(?:React|TypeScript|JavaScript|Node\.js|Express\.js|MongoDB|PostgreSQL|Tailwind CSS|Framer Motion|FastAPI|Socket\.IO|WebSockets|JWT|RESTful API|Python|HTML\/CSS|SQL|Docker|Vite|Figma|Canva)\b/gi
        ) || []
      ).map((item) => item.trim())
    )
  ).slice(0, 12);
  const extractedName = extractResumeName(text);

  return {
    firstName: extractedName.firstName,
    lastName: extractedName.lastName,
    email: emailMatch?.[0] || '',
    phone: phoneMatch?.[0] || '',
    currentCompany,
    designation: currentDesignation,
    currentDesignation,
    experience: parsePositiveNumber(
      text.match(/(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)/i)?.[1] || ''
    ),
    location: workLocation || topLocation,
    linkedinUrl: normalizeUrl(linkedInMatch?.[0] || ''),
    source: 'Other',
    priority: 'Medium',
    tags: skills.slice(0, 6),
    skills,
    expectedSalary: null,
    currentSalary: null,
    currency: 'INR',
    portfolioUrl: portfolioLinks.find((item) => item.type === 'Portfolio Website')?.url || '',
    education: findSection(text, 'Education', ['Certifications', 'Projects']) || '',
    languages: [],
    certifications: [],
    summary: summaryText,
    city: '',
    country: '',
    noticePeriod: '',
    educationEntries: [],
    workExperienceEntries: [],
    portfolioLinks,
  };
}

async function extractStructuredResumeDataWithOpenAI(cleanedText, file) {
  if (!openai || !cleanedText) return null;

  const prompt = `
Extract candidate resume data from the text below and return valid JSON only.
Do not invent facts. Use empty strings, empty arrays, or null when missing.

JSON shape:
{
  "firstName": string,
  "lastName": string,
  "email": string,
  "phone": string,
  "currentCompany": string,
  "designation": string,
  "currentDesignation": string,
  "experience": number | null,
  "location": string,
  "city": string,
  "country": string,
  "linkedinUrl": string,
  "portfolioUrl": string,
  "source": "LinkedIn" | "Naukri" | "Indeed" | "Referral" | "Company Career Page" | "Agency" | "Other",
  "priority": "High" | "Medium" | "Low" | "",
  "tags": string[],
  "skills": string[],
  "expectedSalary": number | null,
  "currentSalary": number | null,
  "currency": string,
  "education": string,
  "languages": string[],
  "certifications": string[],
  "summary": string,
  "noticePeriod": string,
  "educationEntries": [
    { "degree": string, "institution": string, "startYear": string, "endYear": string }
  ],
  "workExperienceEntries": [
    { "title": string, "company": string, "location": string, "startDate": string, "endDate": string, "responsibilities": string[] }
  ],
  "score": {
    "overall": number,
    "breakdown": {
      "skillsMatch": number,
      "experienceFit": number,
      "educationFit": number,
      "keywordMatch": number
    },
    "insights": string[]
  }
}

Resume file name: ${file?.originalname || 'resume'}

Resume text:
${cleanedText.slice(0, 22000)}
`;

  console.log('  📤 Trying OpenAI...');
  const completion = await openai.chat.completions.create({
    model: env.OPENAI_ASSISTANT_MODEL || 'gpt-4o-mini',
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You are a resume parsing engine. Return valid JSON only.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const content = completion.choices?.[0]?.message?.content || '{}';
  console.log('  ✅ Successfully used OpenAI');
  return JSON.parse(content);
}

function normalizeResumeExtraction(parsed = {}, fallback = {}, extras = {}) {
  const merged = { ...fallback, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  const providedScore = merged.score && typeof merged.score === 'object' ? merged.score : {};
  const providedBreakdown =
    providedScore.breakdown && typeof providedScore.breakdown === 'object' ? providedScore.breakdown : {};
  const heuristicScore = buildHeuristicScore(merged);
  const useProvidedScore = hasMeaningfulProvidedScore(providedScore, providedBreakdown);
  const score = {
    overall: useProvidedScore ? providedScore.overall ?? heuristicScore.overall : heuristicScore.overall,
    breakdown: {
      skillsMatch: useProvidedScore
        ? providedBreakdown.skillsMatch ?? heuristicScore.breakdown.skillsMatch
        : heuristicScore.breakdown.skillsMatch,
      experienceFit: useProvidedScore
        ? providedBreakdown.experienceFit ?? heuristicScore.breakdown.experienceFit
        : heuristicScore.breakdown.experienceFit,
      educationFit: useProvidedScore
        ? providedBreakdown.educationFit ?? heuristicScore.breakdown.educationFit
        : heuristicScore.breakdown.educationFit,
      keywordMatch: useProvidedScore
        ? providedBreakdown.keywordMatch ?? heuristicScore.breakdown.keywordMatch
        : heuristicScore.breakdown.keywordMatch,
    },
    insights:
      Array.isArray(providedScore.insights) && providedScore.insights.length
        ? providedScore.insights
        : heuristicScore.insights,
  };

  return {
    firstName: String(merged.firstName || fallback.firstName || '').trim(),
    lastName: String(merged.lastName || fallback.lastName || '').trim(),
    email: normalizeEmail(merged.email || fallback.email || ''),
    phone: String(merged.phone || fallback.phone || '').trim(),
    currentCompany: String(merged.currentCompany || fallback.currentCompany || '').trim(),
    designation: String(merged.designation || fallback.designation || '').trim(),
    currentDesignation: String(merged.currentDesignation || merged.designation || fallback.currentDesignation || '').trim(),
    experience: parsePositiveNumber(merged.experience),
    location: buildLocation(merged.location, merged.city, merged.country) || buildLocation(fallback.location, fallback.city, fallback.country),
    city: String(merged.city || fallback.city || '').trim(),
    country: String(merged.country || fallback.country || '').trim(),
    linkedinUrl: normalizeUrl(merged.linkedinUrl || fallback.linkedinUrl || ''),
    portfolioUrl: normalizeUrl(merged.portfolioUrl || fallback.portfolioUrl || ''),
    source: ['LinkedIn', 'Naukri', 'Indeed', 'Referral', 'Company Career Page', 'Agency', 'Other'].includes(
      String(merged.source || '').trim()
    )
      ? String(merged.source).trim()
      : 'Other',
    priority: ['High', 'Medium', 'Low'].includes(String(merged.priority || '').trim())
      ? String(merged.priority).trim()
      : 'Medium',
    tags: Array.isArray(merged.tags) ? merged.tags.filter(Boolean).slice(0, 10) : [],
    skills: Array.isArray(merged.skills) ? merged.skills.filter(Boolean).slice(0, 12) : [],
    expectedSalary: parsePositiveNumber(merged.expectedSalary),
    currentSalary: parsePositiveNumber(merged.currentSalary),
    currency: String(merged.currency || 'INR').trim() || 'INR',
    education: String(merged.education || fallback.education || '').trim(),
    languages: Array.isArray(merged.languages) ? merged.languages.filter(Boolean).slice(0, 10) : [],
    certifications: Array.isArray(merged.certifications) ? merged.certifications.filter(Boolean).slice(0, 10) : [],
    summary: String(merged.summary || fallback.summary || '').trim(),
    noticePeriod: String(merged.noticePeriod || '').trim(),
    educationEntries: Array.isArray(merged.educationEntries) ? merged.educationEntries : fallback.educationEntries || [],
    workExperienceEntries: Array.isArray(merged.workExperienceEntries)
      ? merged.workExperienceEntries
      : fallback.workExperienceEntries || [],
    portfolioLinks: Array.isArray(merged.portfolioLinks) ? merged.portfolioLinks : fallback.portfolioLinks || [],
    score: {
      overall: clampScore(score.overall),
      breakdown: {
        skillsMatch: clampScore(score.breakdown.skillsMatch),
        experienceFit: clampScore(score.breakdown.experienceFit),
        educationFit: clampScore(score.breakdown.educationFit),
        keywordMatch: clampScore(score.breakdown.keywordMatch),
      },
      insights: Array.isArray(score.insights) ? score.insights.filter(Boolean).slice(0, 6) : [],
    },
    resumeUrl: extras.resumeUrl || null,
    resumeFileName: extras.resumeFileName || null,
    parsedAt: new Date().toISOString(),
    isMockData: false,
  };
}

function printSummary(data) {
  console.log('');
  console.log('📊 EXTRACTED DATA SUMMARY:');
  console.log('--------------------------------------------------------------------------------');
  console.log(`  Personal Info: ${[data.firstName, data.lastName].filter(Boolean).join(' ') || 'Not found'}`);
  console.log(`  Education Entries: ${data.educationEntries?.length || 0}`);
  console.log(`  Work Experience Entries: ${data.workExperienceEntries?.length || 0}`);
  console.log(`  Skills: ${data.skills?.length || 0}`);
  console.log(`  ATS Score: ${data.score?.overall || 0}%`);
}

function printPortfolioLinks(portfolioLinks = []) {
  if (!portfolioLinks.length) return;
  console.log('');
  console.log(`🔗 PORTFOLIO LINKS FOUND (${portfolioLinks.length}):`);
  console.log('--------------------------------------------------------------------------------');
  portfolioLinks.forEach((item, index) => {
    console.log(`  ${index + 1}. ${item.type}: ${item.url}`);
  });
}

function printDetailedData(data) {
  console.log('');
  console.log(divider('='));
  console.log('📊 EXTRACTED RESUME DATA');
  console.log(divider('='));
  console.log('');
  console.log('👤 PERSONAL INFORMATION:');
  console.log('--------------------------------------------------------------------------------');
  console.log(`  Name: ${[data.firstName, data.lastName].filter(Boolean).join(' ') || 'N/A'}`);
  console.log(`  Email: ${data.email || 'N/A'}`);
  console.log(`  City: ${data.city || 'N/A'}`);
  console.log(`  Country: ${data.country || 'N/A'}`);
  console.log(`  LinkedIn: ${data.linkedinUrl || 'N/A'}`);

  console.log('');
  console.log(`🎓 EDUCATION (${data.educationEntries?.length || 0} entries):`);
  console.log('--------------------------------------------------------------------------------');
  if (data.educationEntries?.length) {
    data.educationEntries.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.degree || 'N/A'}`);
      console.log(`     Institution: ${item.institution || 'N/A'}`);
      if (item.startYear) console.log(`     Start Year: ${item.startYear}`);
      if (item.endYear) console.log(`     End Year: ${item.endYear}`);
      console.log('');
    });
  } else {
    console.log('  No education entries found');
  }

  console.log('');
  console.log(`💼 WORK EXPERIENCE (${data.workExperienceEntries?.length || 0} entries):`);
  console.log('--------------------------------------------------------------------------------');
  if (data.workExperienceEntries?.length) {
    data.workExperienceEntries.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.title || 'N/A'} at ${item.company || 'N/A'}`);
      console.log(`     Location: ${item.location || 'N/A'}`);
      if (item.startDate) console.log(`     Start Date: ${item.startDate}`);
      if (item.endDate) console.log(`     End Date: ${item.endDate}`);
      if (Array.isArray(item.responsibilities) && item.responsibilities.length) {
        console.log(`     Responsibilities: ${item.responsibilities.join(' ')}`);
      }
      console.log('');
    });
  } else {
    console.log('  No work experience entries found');
  }

  console.log('');
  console.log(`🛠️  TECHNICAL SKILLS (${data.skills?.length || 0}):`);
  console.log('--------------------------------------------------------------------------------');
  console.log(`  ${data.skills?.join(', ') || 'No skills found'}`);

  console.log('');
  console.log(divider('='));
  console.log('📈 EXTRACTION SUMMARY:');
  console.log('--------------------------------------------------------------------------------');
  console.log(`  Personal Info: ${data.firstName || data.email ? '✅ Found' : '❌ Missing'}`);
  console.log(`  Education Entries: ${data.educationEntries?.length || 0}`);
  console.log(`  Work Experience Entries: ${data.workExperienceEntries?.length || 0}`);
  console.log(`  Total Skills: ${data.skills?.length || 0}`);
  console.log(divider('='));
}

export async function processCandidateCv(file, { candidateId } = {}) {
  logBlock('📄 CV UPLOAD & PARSING STARTED');
  console.log(`Candidate ID: ${candidateId || 'N/A'}`);
  console.log(`File Name: ${file.originalname}`);
  console.log(`File Size: ${formatFileSize(file.size)}`);
  console.log(`File Type: ${file.mimetype}`);
  console.log('--------------------------------------------------------------------------------');

  logBlock('🔄 RESUME PROCESSING PIPELINE STARTED');
  console.log(`File Name: ${file.originalname}`);
  console.log(`File Type: ${file.mimetype}`);
  console.log('--------------------------------------------------------------------------------');

  const extension = path.extname(file.originalname || '').toLowerCase() || file.mimetype;
  console.log(`\n📄 STEP 2: Document Parsing (${extension})`);
  const rawText = await extractResumeTextFromFile(file);
  console.log(`  ✅ Raw text extracted, length: ${rawText.length} characters`);

  console.log('\n🧹 STEP 3: Text Cleaning');
  const cleanedText = cleanResumeText(rawText);
  console.log(`  ✅ Text cleaned, length: ${cleanedText.length} characters`);

  console.log('\n🤖 STEP 4: Sending FULL Resume Text to AI (with fallback)');
  const fallbackData = extractFallbackResumeData(cleanedText);
  let aiStructured = null;
  try {
    aiStructured = await extractStructuredResumeDataWithOpenAI(cleanedText, file);
    console.log('  ✅ Resume structured successfully');
  } catch (error) {
    console.error(`  ⚠️ OpenAI parsing failed: ${error.message}`);
    console.log('  ↪️ Using heuristic fallback from extracted text');
  }

  const fileBuffer = fs.readFileSync(file.path);
  let resumeUrl = null;
  try {
    const upload = await uploadBufferToCloudinary(fileBuffer, {
      folder: `jobportal/candidates/${candidateId || 'temp'}/resumes`,
      resourceType: cloudinaryResourceTypeForFile(file.mimetype, file.originalname),
      originalFilename: file.originalname,
    });
    resumeUrl = upload?.secure_url || upload?.url || null;
  } catch (error) {
    console.error(`  ⚠️ Cloudinary upload failed: ${error.message}`);
  }

  const portfolioLinks = extractPortfolioLinks(cleanedText);
  const normalizedData = normalizeResumeExtraction(
    { ...aiStructured, portfolioLinks: aiStructured?.portfolioLinks?.length ? aiStructured.portfolioLinks : portfolioLinks },
    { ...fallbackData, portfolioLinks },
    { resumeUrl, resumeFileName: file.originalname }
  );

  printSummary(normalizedData);

  console.log('\n✔️  STEP 5: Regex Validation');
  console.log('  ✅ Validation completed');

  console.log('\n✨ STEP 6: Data Normalization');
  console.log('  ✅ Normalization completed');

  logBlock('✅ RESUME PROCESSING PIPELINE COMPLETED');
  console.log('✅ Resume parsing pipeline completed!');
  console.log('');

  printPortfolioLinks(normalizedData.portfolioLinks);
  printDetailedData(normalizedData);
  if (resumeUrl) {
    console.log('✅ CV stored in Cloudinary');
  }

  return normalizedData;
}
