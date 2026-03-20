const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const { Mistral } = require('@mistralai/mistralai');
const pdfParse = require('pdf-parse');
const path = require('path');

// Initialize AI services
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Initialize AI clients
const mistral = MISTRAL_API_KEY ? new Mistral({ apiKey: MISTRAL_API_KEY }) : null;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

/**
 * STEP 1: PDF Upload
 * (Handled by multer middleware in controller)
 */

/**
 * STEP 2: Parse PDF
 * Extract FULL RAW TEXT from PDF using pdf-parse
 * Do NOT extract fields using regex or AI here
 */
async function parsePDF(buffer) {
  try {
    console.log('\n📄 STEP 2: PDF Parsing');
    const data = await pdfParse(buffer);
    const rawText = data.text;
    console.log(`  ✅ Raw text extracted, length: ${rawText.length} characters`);
    
    return {
      rawText: rawText
    };
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
}

/**
 * Extract portfolio URLs (GitHub, LinkedIn, Behance, Dribbble, etc.) from text
 */
function extractPortfolioUrls(text) {
  const urls = [];
  const urlPatterns = [
    // GitHub
    { pattern: /(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+(?:\/[\w-]+)?/gi, type: 'GitHub' },
    // LinkedIn (already extracted separately, but include here too)
    { pattern: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in|profile)\/[\w-]+/gi, type: 'LinkedIn' },
    // Behance
    { pattern: /(?:https?:\/\/)?(?:www\.)?behance\.net\/[\w-]+/gi, type: 'Behance' },
    // Dribbble
    { pattern: /(?:https?:\/\/)?(?:www\.)?dribbble\.com\/[\w-]+/gi, type: 'Dribbble' },
    // Medium
    { pattern: /(?:https?:\/\/)?(?:www\.)?medium\.com\/@?[\w-]+/gi, type: 'Medium' },
    // Personal Blog/Website
    { pattern: /(?:https?:\/\/)?(?:www\.)?[\w-]+\.(?:com|net|org|io|dev|me|co|website)(?:\/[\w-]+)*/gi, type: 'Portfolio Website' },
    // YouTube
    { pattern: /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:channel\/|user\/|c\/)|youtu\.be\/)[\w-]+/gi, type: 'YouTube' },
  ];

  urlPatterns.forEach(({ pattern, type }) => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        // Normalize URL
        let url = match.trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = `https://${url}`;
        }
        
        // Avoid duplicates and exclude email addresses
        if (!urls.find(u => u.url === url) && !url.includes('@')) {
          urls.push({
            url: url,
            linkType: type,
            title: type === 'GitHub' ? 'GitHub Profile' : 
                   type === 'LinkedIn' ? 'LinkedIn Profile' :
                   type === 'Behance' ? 'Behance Portfolio' :
                   type === 'Dribbble' ? 'Dribbble Portfolio' :
                   type === 'Medium' ? 'Medium Blog' :
                   type === 'YouTube' ? 'YouTube Channel' :
                   'Portfolio Website',
            description: null,
          });
        }
      });
    }
  });

  return urls;
}

/**
 * STEP 3: Text Cleaning
 * Clean the text before sending to AI
 * DO NOT extract any data here
 */
function cleanText(rawText) {
  console.log('\n🧹 STEP 3: Text Cleaning');
  
  if (!rawText) return '';
  
  let cleaned = rawText;
  
  // Remove extra spaces (multiple spaces to single space)
  cleaned = cleaned.replace(/[ \t]+/g, ' ');
  
  // Remove multiple line breaks (more than 2 consecutive newlines to double newline)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  // Normalize line endings (Windows/Mac to Unix)
  cleaned = cleaned.replace(/\r\n/g, '\n');
  cleaned = cleaned.replace(/\r/g, '\n');
  
  // Remove leading/trailing whitespace from each line
  cleaned = cleaned.split('\n').map(line => line.trim()).join('\n');
  
  // Remove page numbers and headers/footers (common patterns)
  cleaned = cleaned.replace(/Page\s+\d+\s+of\s+\d+/gi, '');
  cleaned = cleaned.replace(/^\d+$/gm, ''); // Standalone numbers (likely page numbers)
  
  // Remove unnecessary characters but keep essential formatting
  // Keep: letters, numbers, spaces, newlines, common punctuation
  // Remove: special control characters
  cleaned = cleaned.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  // Normalize encoding issues
  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF]/g, ''); // Zero-width characters
  
  // Remove empty lines at start and end
  cleaned = cleaned.trim();
  
  console.log(`  ✅ Text cleaned, length: ${cleaned.length} characters`);
  
  return cleaned;
}

/**
 * STEP 4: Send FULL Resume Text to Google Gemini
 * AI should ONLY convert the resume text into structured JSON
 * Do NOT summarize, modify content meaning, or remove sections
 */
async function structureResumeWithAI(cleanResumeText) {
  console.log('\n🤖 STEP 4: Sending FULL Resume Text to AI (with fallback)');
  
  const prompt = `You are a resume structuring AI.

You will receive RAW RESUME TEXT.
Do NOT summarize.
Do NOT modify content meaning.
Do NOT remove sections.

Your job is ONLY to convert the resume text into structured JSON.

Return data ONLY in the following JSON format:

{
  "personalInformation": {
    "fullName": "",
    "email": "",
    "phoneNumber": "",
    "alternatePhoneNumber": "",
    "gender": "",
    "dateOfBirth": "",
    "maritalStatus": "",
    "address": "",
    "city": "",
    "country": "",
    "nationality": "",
    "passportNumber": "",
    "linkedinProfile": ""
  },
  "education": [
    {
      "degree": "",
      "institution": "",
      "specialization": "",
      "startYear": 0,
      "endYear": 0
    }
  ],
  "workExperience": [
    {
      "jobTitle": "",
      "company": "",
      "workLocation": "",
      "startDate": "",
      "endDate": "",
      "currentlyWorking": false,
      "responsibilities": ""
    }
  ],
  "skills": [
    {
      "languageName": "",
      "proficiency": "BEGINNER|INTERMEDIATE|ADVANCED|NATIVE",
      "speak": true,
      "read": true,
      "write": true
    }
  ]
}

Extraction Rules:

1. Extract the candidate name from the top of the resume.
2. Extract all education entries with years as numbers.
3. Extract all work experience entries.
4. Extract all skills including technical skills and languages.
5. Convert all dates to YYYY-MM-DD format when possible.
6. If a field is missing return null.
7. If no entries exist return an empty array [].
8. Do not add extra fields.
9. Return ONLY valid JSON.

Resume Text:
${cleanResumeText}`;

  // Try AI services in order: Mistral -> Gemini -> Anthropic -> OpenAI
  let responseText = '';
  let error = null;
  
  // Try Mistral first
  if (mistral) {
    try {
      console.log('  📤 Trying Mistral AI...');
      const chatResponse = await mistral.chat.complete({
        model: 'mistral-large-latest',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 4096,
      });
      responseText = chatResponse.choices[0]?.message?.content?.trim() || '';
      if (responseText) {
        console.log('  ✅ Successfully used Mistral AI');
      } else {
        throw new Error('Empty response from Mistral');
      }
    } catch (mistralError) {
      console.log('  ⚠️  Mistral failed, trying fallback...');
      error = mistralError;
    }
  }
  
  // Fallback to Gemini
  if (!responseText && genAI) {
    try {
      console.log('  📤 Trying Google Gemini...');
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      responseText = response.text().trim();
      if (responseText) {
        console.log('  ✅ Successfully used Google Gemini');
      } else {
        throw new Error('Empty response from Gemini');
      }
    } catch (geminiError) {
      console.log('  ⚠️  Gemini failed, trying fallback...');
      error = geminiError;
    }
  }
  
  // Fallback to Anthropic
  if (!responseText && anthropic) {
    try {
      console.log('  📤 Trying Anthropic Claude...');
      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }],
      });
      responseText = message.content[0]?.text?.trim() || '';
      if (responseText) {
        console.log('  ✅ Successfully used Anthropic Claude');
      } else {
        throw new Error('Empty response from Anthropic');
      }
    } catch (anthropicError) {
      console.log('  ⚠️  Anthropic failed, trying fallback...');
      error = anthropicError;
    }
  }
  
  // Fallback to OpenAI
  if (!responseText && openai) {
    try {
      console.log('  📤 Trying OpenAI...');
      const completion = await openai.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 4096,
      });
      responseText = completion.choices[0]?.message?.content?.trim() || '';
      if (responseText) {
        console.log('  ✅ Successfully used OpenAI');
      } else {
        throw new Error('Empty response from OpenAI');
      }
    } catch (openaiError) {
      console.log('  ⚠️  OpenAI failed');
      error = openaiError;
    }
  }
  
  if (!responseText) {
    throw new Error(`All AI services failed. Last error: ${error?.message || 'No AI service available'}`);
  }
  
  try {
    // Clean JSON response - remove markdown code blocks if present
    if (responseText.startsWith('```json')) {
      responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (responseText.startsWith('```')) {
      responseText = responseText.replace(/```\n?/g, '');
    }
    
    // Parse JSON
    const structuredData = JSON.parse(responseText);
    console.log('  ✅ Resume structured successfully');
    
    // Log extracted data for debugging
    console.log('\n📊 EXTRACTED DATA SUMMARY:');
    console.log('  Personal Info:', structuredData.personalInformation?.fullName || 'Not found');
    console.log('  Education Entries:', structuredData.education?.length || 0);
    console.log('  Work Experience Entries:', structuredData.workExperience?.length || 0);
    console.log('  Skills:', structuredData.skills?.length || 0);
    
    return structuredData;
  } catch (error) {
    console.error('Error structuring resume with AI:', error);
    throw new Error(`Failed to structure resume: ${error.message}`);
  }
}

/**
 * STEP 5: Regex Validation
 * Validate fields using regex
 * If invalid → set value to null
 */
function validateData(structuredData) {
  console.log('\n✔️  STEP 5: Regex Validation');
  
  const validated = JSON.parse(JSON.stringify(structuredData)); // Deep clone
  
  // Validate email
  if (validated.personalInformation?.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(validated.personalInformation.email)) {
      console.warn('  ⚠️  Invalid email format:', validated.personalInformation.email);
      validated.personalInformation.email = null;
    }
  }
  
  // Validate phone number (allows digits, spaces, dashes, parentheses, plus sign)
  if (validated.personalInformation?.phoneNumber) {
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (!phoneRegex.test(validated.personalInformation.phoneNumber) || validated.personalInformation.phoneNumber.length < 7) {
      console.warn('  ⚠️  Invalid phone format:', validated.personalInformation.phoneNumber);
      validated.personalInformation.phoneNumber = null;
    }
  }
  
  // Validate alternate phone
  if (validated.personalInformation?.alternatePhoneNumber) {
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (!phoneRegex.test(validated.personalInformation.alternatePhoneNumber) || validated.personalInformation.alternatePhoneNumber.length < 7) {
      console.warn('  ⚠️  Invalid alternate phone format:', validated.personalInformation.alternatePhoneNumber);
      validated.personalInformation.alternatePhoneNumber = null;
    }
  }
  
  // Validate LinkedIn URL
  if (validated.personalInformation?.linkedinProfile) {
    if (!validated.personalInformation.linkedinProfile.startsWith('http')) {
      // If it's just a username or path, prepend https://
      if (validated.personalInformation.linkedinProfile.startsWith('linkedin.com') || validated.personalInformation.linkedinProfile.startsWith('/')) {
        validated.personalInformation.linkedinProfile = `https://${validated.personalInformation.linkedinProfile.replace(/^\/+/, '')}`;
      } else if (!validated.personalInformation.linkedinProfile.includes('.')) {
        validated.personalInformation.linkedinProfile = `https://linkedin.com/in/${validated.personalInformation.linkedinProfile}`;
      } else {
        validated.personalInformation.linkedinProfile = `https://${validated.personalInformation.linkedinProfile}`;
      }
    }
  }
  
  // Validate dates (YYYY-MM-DD format)
  if (validated.workExperience) {
    validated.workExperience = validated.workExperience.map(exp => {
      if (exp.startDate && !isValidDate(exp.startDate)) {
        console.warn('  ⚠️  Invalid start date:', exp.startDate);
        exp.startDate = null;
      }
      if (exp.endDate && !isValidDate(exp.endDate)) {
        console.warn('  ⚠️  Invalid end date:', exp.endDate);
        exp.endDate = null;
      }
      return exp;
    });
  }
  
  // Validate date of birth
  if (validated.personalInformation?.dateOfBirth) {
    if (!isValidDate(validated.personalInformation.dateOfBirth)) {
      console.warn('  ⚠️  Invalid date of birth:', validated.personalInformation.dateOfBirth);
      validated.personalInformation.dateOfBirth = null;
    }
  }
  
  // Validate years (should be numbers between 1950 and current year + 1)
  const currentYear = new Date().getFullYear();
  if (validated.education) {
    validated.education = validated.education.map(edu => {
      if (edu.startYear && (typeof edu.startYear !== 'number' || edu.startYear < 1950 || edu.startYear > currentYear + 1)) {
        console.warn('  ⚠️  Invalid start year:', edu.startYear);
        edu.startYear = null;
      }
      if (edu.endYear && (typeof edu.endYear !== 'number' || edu.endYear < 1950 || edu.endYear > currentYear + 1)) {
        console.warn('  ⚠️  Invalid end year:', edu.endYear);
        edu.endYear = null;
      }
      return edu;
    });
  }
  
  console.log('  ✅ Validation completed');
  
  return validated;
}

/**
 * Helper: Validate date format (YYYY-MM-DD or ISO format)
 */
function isValidDate(dateString) {
  if (!dateString) return false;
  if (typeof dateString !== 'string') return false;
  
  // Check YYYY-MM-DD format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (dateRegex.test(dateString)) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }
  
  // Check ISO format
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

/**
 * STEP 6: Normalize Data
 * Normalize before saving
 */
function normalizeData(validatedData) {
  console.log('\n✨ STEP 6: Data Normalization');
  
  const normalized = JSON.parse(JSON.stringify(validatedData)); // Deep clone
  
  // Normalize personal information
  if (normalized.personalInformation) {
    const pi = normalized.personalInformation;
    
    // Trim strings
    if (pi.fullName) pi.fullName = pi.fullName.trim();
    if (pi.email) pi.email = pi.email.trim().toLowerCase();
    if (pi.phoneNumber) pi.phoneNumber = pi.phoneNumber.trim();
    if (pi.alternatePhoneNumber) pi.alternatePhoneNumber = pi.alternatePhoneNumber.trim();
    if (pi.address) pi.address = pi.address.trim();
    if (pi.city) pi.city = pi.city.trim();
    if (pi.country) pi.country = pi.country.trim();
    if (pi.nationality) pi.nationality = pi.nationality.trim();
    if (pi.passportNumber) pi.passportNumber = pi.passportNumber.trim();
    if (pi.linkedinProfile) pi.linkedinProfile = pi.linkedinProfile.trim();
    
    // Convert empty strings to null
    Object.keys(pi).forEach(key => {
      if (pi[key] === '') {
        pi[key] = null;
      }
    });
  }
  
  // Normalize education
  if (normalized.education) {
    normalized.education = normalized.education.map(edu => {
      // Trim strings
      if (edu.degree) edu.degree = edu.degree.trim();
      if (edu.institution) edu.institution = edu.institution.trim();
      if (edu.specialization) edu.specialization = edu.specialization.trim();
      
      // Convert empty strings to null
      if (edu.degree === '') edu.degree = null;
      if (edu.institution === '') edu.institution = null;
      if (edu.specialization === '') edu.specialization = null;
      
      // Ensure years are numbers or null
      if (edu.startYear !== null && edu.startYear !== undefined) {
        edu.startYear = typeof edu.startYear === 'number' ? edu.startYear : parseInt(edu.startYear) || null;
      } else {
        edu.startYear = null;
      }
      
      if (edu.endYear !== null && edu.endYear !== undefined) {
        edu.endYear = typeof edu.endYear === 'number' ? edu.endYear : parseInt(edu.endYear) || null;
      } else {
        edu.endYear = null;
      }
      
      return edu;
    });
  }
  
  // Normalize work experience
  if (normalized.workExperience) {
    normalized.workExperience = normalized.workExperience.map(exp => {
      // Trim strings
      if (exp.jobTitle) exp.jobTitle = exp.jobTitle.trim();
      if (exp.company) exp.company = exp.company.trim();
      if (exp.workLocation) exp.workLocation = exp.workLocation.trim();
      if (exp.responsibilities) exp.responsibilities = exp.responsibilities.trim();
      
      // Convert empty strings to null
      if (exp.jobTitle === '') exp.jobTitle = null;
      if (exp.company === '') exp.company = null;
      if (exp.workLocation === '') exp.workLocation = null;
      if (exp.responsibilities === '') exp.responsibilities = null;
      
      // Ensure currentlyWorking is boolean
      exp.currentlyWorking = Boolean(exp.currentlyWorking);
      
      return exp;
    });
  }
  
  // Normalize skills
  if (normalized.skills) {
    normalized.skills = normalized.skills.map(skill => {
      // Trim strings
      if (skill.languageName) skill.languageName = skill.languageName.trim();
      
      // Convert empty strings to null
      if (skill.languageName === '') skill.languageName = null;
      
      // Ensure proficiency is valid
      const validProficiencies = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'NATIVE'];
      if (!validProficiencies.includes(skill.proficiency)) {
        skill.proficiency = 'INTERMEDIATE'; // Default
      }
      
      // Ensure boolean fields are boolean
      skill.speak = Boolean(skill.speak);
      skill.read = Boolean(skill.read);
      skill.write = Boolean(skill.write);
      
      return skill;
    });
    
    // Remove skills with null languageName
    normalized.skills = normalized.skills.filter(skill => skill.languageName !== null);
  }
  
  console.log('  ✅ Normalization completed');
  
  return normalized;
}

/**
 * MAIN FUNCTION: Complete Resume Processing Pipeline
 * 
 * Flow:
 * PDF Upload → PDF Parse → Text Cleaning → Send to Google Gemini → 
 * Regex Validation → Normalize Data → Return Structured Data
 */
async function parseResumeFromBuffer(buffer, mimeType, fileName) {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🔄 RESUME PROCESSING PIPELINE STARTED');
    console.log('='.repeat(80));
    console.log('File Name:', fileName);
    console.log('File Type:', mimeType);
    console.log('-'.repeat(80));
    
    // Validate file type (only PDF)
    const extension = path.extname(fileName).toLowerCase();
    if (extension !== '.pdf' && mimeType !== 'application/pdf') {
      throw new Error(`Unsupported file type: ${extension}. Only PDF files are supported.`);
    }
    
    // STEP 2: Parse PDF
    const { rawText } = await parsePDF(buffer);
    
    // STEP 3: Text Cleaning
    const cleanResumeText = cleanText(rawText);
    
    // STEP 4: Send FULL Resume Text to Google Gemini
    const structuredData = await structureResumeWithAI(cleanResumeText);
    
    // STEP 5: Regex Validation
    const validatedData = validateData(structuredData);
    
    // STEP 6: Normalize Data
    const normalizedData = normalizeData(validatedData);
    
    // Return final structured data
    const finalData = {
      personalInformation: normalizedData.personalInformation || {
        fullName: null,
        email: null,
        phoneNumber: null,
        alternatePhoneNumber: null,
        gender: null,
        dateOfBirth: null,
        maritalStatus: null,
        address: null,
        city: null,
        country: null,
        nationality: null,
        passportNumber: null,
        linkedinProfile: null,
      },
      education: normalizedData.education || [],
      skills: normalizedData.skills || [],
      workExperience: normalizedData.workExperience || [],
    };
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ RESUME PROCESSING PIPELINE COMPLETED');
    console.log('='.repeat(80));
    
    return finalData;
  } catch (error) {
    console.error('\n❌ Error in resume processing pipeline:', error);
    throw new Error(`Failed to process resume: ${error.message}`);
  }
}

/**
 * Convert extracted CV data to LaTeX format
 */
function convertToLaTeX(cvData) {
  let latex = '\\documentclass[11pt,a4paper]{article}\n';
  latex += '\\usepackage[utf8]{inputenc}\n';
  latex += '\\usepackage{geometry}\n';
  latex += '\\usepackage{enumitem}\n';
  latex += '\\geometry{margin=1in}\n';
  latex += '\\begin{document}\n\n';

  // Personal Information
  if (cvData.personalInformation) {
    const p = cvData.personalInformation;
    latex += '\\section*{Personal Information}\n';
    if (p.fullName) latex += `\\textbf{Name:} ${escapeLaTeX(p.fullName)}\\\\\n`;
    if (p.email) latex += `\\textbf{Email:} ${escapeLaTeX(p.email)}\\\\\n`;
    if (p.phoneNumber) latex += `\\textbf{Phone:} ${escapeLaTeX(p.phoneNumber)}\\\\\n`;
    if (p.address) latex += `\\textbf{Address:} ${escapeLaTeX(p.address)}\\\\\n`;
    if (p.city) latex += `\\textbf{City:} ${escapeLaTeX(p.city)}\\\\\n`;
    if (p.country) latex += `\\textbf{Country:} ${escapeLaTeX(p.country)}\\\\\n`;
    if (p.linkedinProfile) latex += `\\textbf{LinkedIn:} ${escapeLaTeX(p.linkedinProfile)}\\\\\n`;
    latex += '\\vspace{0.5cm}\n\n';
  }

  // Education
  if (cvData.education && cvData.education.length > 0) {
    latex += '\\section*{Education}\n';
    latex += '\\begin{itemize}\n';
    cvData.education.forEach(edu => {
      latex += '\\item ';
      latex += `\\textbf{${escapeLaTeX(edu.degree || 'N/A')}}`;
      if (edu.specialization) latex += ` - ${escapeLaTeX(edu.specialization)}`;
      latex += `, ${escapeLaTeX(edu.institution || 'N/A')}`;
      if (edu.startYear) {
        latex += ` (${edu.startYear}`;
        if (edu.endYear) latex += ` - ${edu.endYear}`;
        latex += ')';
      }
      latex += '\n';
    });
    latex += '\\end{itemize}\n\n';
  }

  // Work Experience
  if (cvData.workExperience && cvData.workExperience.length > 0) {
    latex += '\\section*{Work Experience}\n';
    cvData.workExperience.forEach(exp => {
      latex += '\\subsection*{';
      latex += escapeLaTeX(exp.jobTitle || 'N/A');
      latex += ` at ${escapeLaTeX(exp.company || 'N/A')}`;
      if (exp.workLocation) latex += `, ${escapeLaTeX(exp.workLocation)}`;
      latex += '}\n';
      if (exp.startDate) {
        latex += `\\textbf{Period:} ${exp.startDate}`;
        if (exp.endDate) latex += ` - ${exp.endDate}`;
        else if (exp.currentlyWorking) latex += ' - Present';
        latex += '\n';
      }
      if (exp.responsibilities) {
        latex += '\\begin{itemize}\n';
        const responsibilities = exp.responsibilities.split(/[•\-\n]/).filter(r => r.trim());
        responsibilities.forEach(resp => {
          if (resp.trim()) latex += `\\item ${escapeLaTeX(resp.trim())}\n`;
        });
        latex += '\\end{itemize}\n';
      }
      latex += '\n';
    });
  }

  // Skills
  if (cvData.skills && cvData.skills.length > 0) {
    latex += '\\section*{Skills}\n';
    latex += '\\begin{itemize}\n';
    cvData.skills.forEach(skill => {
      latex += `\\item ${escapeLaTeX(skill.languageName)}`;
      if (skill.proficiency) latex += ` (${skill.proficiency})`;
      latex += '\n';
    });
    latex += '\\end{itemize}\n\n';
  }

  latex += '\\end{document}';
  return latex;
}

/**
 * Escape special LaTeX characters
 */
function escapeLaTeX(text) {
  if (!text) return '';
  return String(text)
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/#/g, '\\#')
    .replace(/\$/g, '\\$')
    .replace(/%/g, '\\%')
    .replace(/&/g, '\\&')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/_/g, '\\_')
    .replace(/~//g, '\\textasciitilde{}');
}

module.exports = {
  parseResumeFromBuffer,
  extractPortfolioUrls,
};
