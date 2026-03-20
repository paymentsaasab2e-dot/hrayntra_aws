const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Extract text from PDF file
 */
async function extractTextFromPDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

/**
 * Extract text from DOCX file
 */
async function extractTextFromDOCX(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('Error extracting text from DOCX:', error);
    throw new Error('Failed to extract text from DOCX');
  }
}

/**
 * Extract text from file based on mime type
 */
async function extractTextFromFile(buffer, mimeType) {
  if (mimeType === 'application/pdf') {
    return await extractTextFromPDF(buffer);
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    return await extractTextFromDOCX(buffer);
  } else {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }
}

/**
 * Extract email from text
 */
function extractEmail(text) {
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
  const matches = text.match(emailRegex);
  return matches ? matches[0] : null;
}

/**
 * Extract phone number from text
 */
function extractPhoneNumber(text) {
  const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+?\d{10,15}/g;
  const matches = text.match(phoneRegex);
  return matches ? matches[0].replace(/[-.\s()]/g, '') : null;
}

/**
 * Extract LinkedIn URL from text
 */
function extractLinkedIn(text) {
  const linkedinRegex = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in|profile)\/[\w-]+/gi;
  const matches = text.match(linkedinRegex);
  return matches ? matches[0] : null;
}

/**
 * Extract name from CV (usually first line or after "Name:" label)
 */
function extractName(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Look for "Name:" pattern
  const namePattern = /(?:name|full name|fullname)[\s:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i;
  const nameMatch = text.match(namePattern);
  if (nameMatch) {
    return nameMatch[1].trim();
  }
  
  // If no pattern found, use first substantial line (usually name)
  if (lines.length > 0 && lines[0].length > 3 && lines[0].length < 50) {
    const firstLine = lines[0];
    // Check if it looks like a name (has capital letters, no special chars)
    if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$/.test(firstLine)) {
      return firstLine;
    }
  }
  
  return null;
}

/**
 * Extract address from text
 */
function extractAddress(text) {
  const addressPatterns = [
    /(?:address|location)[\s:]+([^\n]+)/i,
    /(\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Boulevard|Blvd|Way|Circle|Ct)[^\n]*)/i,
  ];
  
  for (const pattern of addressPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return null;
}

/**
 * Extract education entries
 */
function extractEducation(text) {
  const education = [];
  const educationSection = extractSection(text, ['education', 'academic', 'qualification', 'degree']);
  
  if (!educationSection) return education;
  
  // Split by common separators
  const entries = educationSection.split(/\n{2,}|\d+\./).filter(entry => entry.trim().length > 10);
  
  for (const entry of entries) {
    const edu = {};
    
    // Extract degree
    const degreePattern = /(?:Bachelor|Master|PhD|Doctorate|Diploma|Certificate|B\.?S\.?|B\.?A\.?|M\.?S\.?|M\.?A\.?|M\.?B\.?A\.?|B\.?Tech|M\.?Tech)[^\n]*/i;
    const degreeMatch = entry.match(degreePattern);
    if (degreeMatch) {
      edu.degree = degreeMatch[0].trim();
    }
    
    // Extract institution
    const institutionPattern = /(?:at|from|in|,)\s+([A-Z][A-Za-z\s&]+(?:University|College|Institute|School|Academy))/i;
    const institutionMatch = entry.match(institutionPattern);
    if (institutionMatch) {
      edu.institution = institutionMatch[1].trim();
    }
    
    // Extract years
    const yearPattern = /(\d{4})\s*[-–—]\s*(\d{4}|Present|Current|Ongoing)/i;
    const yearMatch = entry.match(yearPattern);
    if (yearMatch) {
      edu.startYear = parseInt(yearMatch[1]);
      if (yearMatch[2] && !isNaN(parseInt(yearMatch[2]))) {
        edu.endYear = parseInt(yearMatch[2]);
        edu.isOngoing = false;
      } else {
        edu.isOngoing = true;
        edu.endYear = null;
      }
    } else {
      // Try single year
      const singleYear = entry.match(/\b(19|20)\d{2}\b/);
      if (singleYear) {
        edu.startYear = parseInt(singleYear[0]);
        edu.endYear = null;
        edu.isOngoing = false;
      }
    }
    
    // Extract specialization
    const specializationPattern = /(?:in|specialization|major|field)[\s:]+([A-Za-z\s&]+)/i;
    const specMatch = entry.match(specializationPattern);
    if (specMatch) {
      edu.specialization = specMatch[1].trim();
    }
    
    // Extract grade/GPA
    const gradePattern = /(?:GPA|CGPA|Grade|Score)[\s:]+([\d.]+(?:\s*\/\s*[\d.]+)?)/i;
    const gradeMatch = entry.match(gradePattern);
    if (gradeMatch) {
      edu.grade = gradeMatch[1].trim();
    }
    
    if (edu.degree || edu.institution) {
      education.push({
        degree: edu.degree || 'Not specified',
        institution: edu.institution || 'Not specified',
        specialization: edu.specialization || null,
        startYear: edu.startYear || new Date().getFullYear() - 4,
        endYear: edu.endYear || null,
        isOngoing: edu.isOngoing || false,
        grade: edu.grade || null,
        description: entry.trim() || null,
      });
    }
  }
  
  return education;
}

/**
 * Extract work experience entries
 */
function extractWorkExperience(text) {
  const experiences = [];
  const experienceSection = extractSection(text, ['experience', 'employment', 'work', 'career', 'professional']);
  
  if (!experienceSection) return experiences;
  
  // Split by job entries (usually separated by double newlines or dates)
  const entries = experienceSection.split(/\n{2,}|\d{4}\s*[-–—]/).filter(entry => entry.trim().length > 20);
  
  for (const entry of entries) {
    const exp = {};
    
    // Extract job title
    const titlePattern = /^([A-Z][A-Za-z\s&]+(?:Engineer|Developer|Manager|Analyst|Designer|Specialist|Consultant|Lead|Senior|Junior|Associate|Director|Executive|Officer|Coordinator|Assistant|Intern)[^\n]*)/i;
    const titleMatch = entry.match(titlePattern);
    if (titleMatch) {
      exp.jobTitle = titleMatch[1].trim();
    } else {
      // Try first line as title
      const firstLine = entry.split('\n')[0].trim();
      if (firstLine.length > 5 && firstLine.length < 100) {
        exp.jobTitle = firstLine;
      }
    }
    
    // Extract company
    const companyPattern = /(?:at|with|,)\s+([A-Z][A-Za-z\s&.,-]+(?:Inc|LLC|Ltd|Corp|Corporation|Company|Co|Technologies|Tech|Systems|Solutions)?)/i;
    const companyMatch = entry.match(companyPattern);
    if (companyMatch) {
      exp.company = companyMatch[1].trim().replace(/[.,]$/, '');
    }
    
    // Extract location
    const locationPattern = /(?:in|at|location)[\s:]+([A-Za-z\s,]+(?:City|State|Country|USA|UK|India)?)/i;
    const locationMatch = entry.match(locationPattern);
    if (locationMatch) {
      exp.workLocation = locationMatch[1].trim();
    }
    
    // Extract dates
    const datePattern = /(\w+\s+\d{4}|\d{1,2}\/\d{4}|\d{4})\s*[-–—]\s*(\w+\s+\d{4}|\d{1,2}\/\d{4}|\d{4}|Present|Current|Ongoing)/i;
    const dateMatch = entry.match(datePattern);
    if (dateMatch) {
      exp.startDate = parseDate(dateMatch[1]);
      if (dateMatch[2] && !/present|current|ongoing/i.test(dateMatch[2])) {
        exp.endDate = parseDate(dateMatch[2]);
        exp.isCurrentJob = false;
      } else {
        exp.isCurrentJob = true;
        exp.endDate = null;
      }
    } else {
      // Try single date
      const singleDate = entry.match(/(\w+\s+\d{4}|\d{1,2}\/\d{4}|\d{4})/);
      if (singleDate) {
        exp.startDate = parseDate(singleDate[1]);
        exp.isCurrentJob = true;
        exp.endDate = null;
      }
    }
    
    // Extract work mode
    if (/remote|work from home|wfh/i.test(entry)) {
      exp.workMode = 'REMOTE';
    } else if (/hybrid/i.test(entry)) {
      exp.workMode = 'HYBRID';
    } else {
      exp.workMode = 'ON_SITE';
    }
    
    // Extract responsibilities (bullet points or paragraphs)
    const responsibilities = [];
    const lines = entry.split('\n');
    let inResponsibilities = false;
    
    for (const line of lines) {
      if (/responsibilities|duties|achievements|key|accomplishments/i.test(line)) {
        inResponsibilities = true;
        continue;
      }
      if (inResponsibilities && (line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().match(/^\d+\./))) {
        responsibilities.push(line.trim().replace(/^[•\-\d+\.]\s*/, ''));
      }
    }
    
    if (responsibilities.length > 0) {
      exp.responsibilities = responsibilities.join('\n');
    } else {
      // Use remaining text as responsibilities
      const remainingText = entry.split('\n').slice(3).join('\n').trim();
      if (remainingText.length > 20) {
        exp.responsibilities = remainingText;
      }
    }
    
    // Extract industry
    const industryPattern = /(?:industry|sector)[\s:]+([A-Za-z\s]+)/i;
    const industryMatch = entry.match(industryPattern);
    if (industryMatch) {
      exp.industry = industryMatch[1].trim();
    }
    
    if (exp.jobTitle || exp.company) {
      experiences.push({
        jobTitle: exp.jobTitle || 'Not specified',
        company: exp.company || 'Not specified',
        workLocation: exp.workLocation || null,
        workMode: exp.workMode || null,
        startDate: exp.startDate || new Date().toISOString().split('T')[0],
        endDate: exp.endDate || null,
        isCurrentJob: exp.isCurrentJob || false,
        responsibilities: exp.responsibilities || null,
        industry: exp.industry || null,
      });
    }
  }
  
  return experiences;
}

/**
 * Extract skills from text
 */
function extractSkills(text) {
  const skills = [];
  const skillsSection = extractSection(text, ['skills', 'technical skills', 'competencies', 'expertise', 'proficiencies']);
  
  if (!skillsSection) {
    // Try to find skills in the entire text
    const commonSkills = [
      'JavaScript', 'Python', 'Java', 'C++', 'C#', 'React', 'Node.js', 'Angular', 'Vue.js',
      'SQL', 'MongoDB', 'PostgreSQL', 'MySQL', 'AWS', 'Azure', 'Docker', 'Kubernetes',
      'Git', 'Agile', 'Scrum', 'Machine Learning', 'AI', 'Data Science', 'HTML', 'CSS',
      'TypeScript', 'Express', 'Django', 'Flask', 'Spring', 'Laravel', 'PHP', 'Ruby',
      'Go', 'Rust', 'Swift', 'Kotlin', 'Android', 'iOS', 'React Native', 'Flutter',
    ];
    
    for (const skill of commonSkills) {
      const regex = new RegExp(`\\b${skill}\\b`, 'i');
      if (regex.test(text)) {
        skills.push({
          name: skill,
          category: categorizeSkill(skill),
          proficiency: 'INTERMEDIATE',
          yearsOfExp: null,
        });
      }
    }
    return skills;
  }
  
  // Extract skills from section
  const lines = skillsSection.split('\n');
  for (const line of lines) {
    // Remove bullet points and separators
    const cleanLine = line.replace(/^[•\-\d+\.]\s*/, '').trim();
    if (cleanLine.length < 2) continue;
    
    // Split by common separators
    const skillNames = cleanLine.split(/[,;|]/).map(s => s.trim()).filter(s => s.length > 1);
    
    for (const skillName of skillNames) {
      if (skillName.length > 1 && skillName.length < 50) {
        skills.push({
          name: skillName,
          category: categorizeSkill(skillName),
          proficiency: 'INTERMEDIATE',
          yearsOfExp: null,
        });
      }
    }
  }
  
  return skills;
}

/**
 * Categorize skill
 */
function categorizeSkill(skillName) {
  const name = skillName.toLowerCase();
  
  if (/javascript|typescript|python|java|c\+\+|c#|ruby|go|rust|php|swift|kotlin|scala|perl/i.test(name)) {
    return 'Programming Languages';
  }
  if (/react|angular|vue|node|express|django|flask|spring|laravel|rails/i.test(name)) {
    return 'Frameworks & Libraries';
  }
  if (/sql|mysql|postgresql|mongodb|cassandra|redis|oracle|database|db/i.test(name)) {
    return 'Databases';
  }
  if (/aws|azure|gcp|cloud|docker|kubernetes|jenkins|ci\/cd|devops/i.test(name)) {
    return 'Cloud & DevOps';
  }
  if (/html|css|sass|less|bootstrap|tailwind|ui|ux|design/i.test(name)) {
    return 'Frontend';
  }
  if (/machine learning|ml|ai|data science|deep learning|tensorflow|pytorch/i.test(name)) {
    return 'AI/ML';
  }
  if (/git|svn|jira|agile|scrum|kanban|project management/i.test(name)) {
    return 'Tools & Methodologies';
  }
  
  return 'General';
}

/**
 * Extract languages from text
 */
function extractLanguages(text) {
  const languages = [];
  const languagesSection = extractSection(text, ['languages', 'language']);
  
  if (!languagesSection) return languages;
  
  const commonLanguages = ['English', 'Spanish', 'French', 'German', 'Chinese', 'Japanese', 'Hindi', 'Arabic', 'Portuguese', 'Russian'];
  const lines = languagesSection.split('\n');
  
  for (const line of lines) {
    for (const lang of commonLanguages) {
      if (new RegExp(`\\b${lang}\\b`, 'i').test(line)) {
        const proficiency = extractProficiency(line);
        languages.push({
          name: lang,
          proficiency: proficiency,
          canSpeak: true,
          canRead: true,
          canWrite: true,
        });
      }
    }
  }
  
  return languages;
}

/**
 * Extract proficiency level from text
 */
function extractProficiency(text) {
  if (/native|fluent|expert|advanced/i.test(text)) {
    return 'NATIVE';
  } else if (/intermediate|moderate|good/i.test(text)) {
    return 'INTERMEDIATE';
  } else if (/beginner|basic|elementary/i.test(text)) {
    return 'BEGINNER';
  }
  return 'INTERMEDIATE';
}

/**
 * Extract a section from text by keywords
 */
function extractSection(text, keywords) {
  const lines = text.split('\n');
  let inSection = false;
  let sectionLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    
    // Check if this line starts a section
    if (keywords.some(keyword => line.includes(keyword.toLowerCase()))) {
      inSection = true;
      sectionLines = [];
      continue;
    }
    
    // Check if we hit another major section
    if (inSection && /^(experience|education|skills|projects|summary|objective|contact|personal)/i.test(lines[i])) {
      break;
    }
    
    if (inSection) {
      sectionLines.push(lines[i]);
    }
  }
  
  return sectionLines.length > 0 ? sectionLines.join('\n') : null;
}

/**
 * Parse date string to ISO format
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  // Try different date formats
  const formats = [
    /(\w+)\s+(\d{4})/, // "January 2020"
    /(\d{1,2})\/(\d{4})/, // "01/2020"
    /(\d{4})/, // "2020"
  ];
  
  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      if (match[3]) {
        // Year only
        return `${match[3]}-01-01`;
      } else if (match[2]) {
        // Month and year or month/year
        const month = match[1];
        const year = match[2];
        const monthNum = getMonthNumber(month);
        return `${year}-${monthNum}-01`;
      }
    }
  }
  
  return new Date().toISOString().split('T')[0];
}

/**
 * Get month number from month name
 */
function getMonthNumber(month) {
  const months = {
    'january': '01', 'jan': '01',
    'february': '02', 'feb': '02',
    'march': '03', 'mar': '03',
    'april': '04', 'apr': '04',
    'may': '05',
    'june': '06', 'jun': '06',
    'july': '07', 'jul': '07',
    'august': '08', 'aug': '08',
    'september': '09', 'sep': '09', 'sept': '09',
    'october': '10', 'oct': '10',
    'november': '11', 'nov': '11',
    'december': '12', 'dec': '12',
  };
  
  return months[month.toLowerCase()] || '01';
}

/**
 * Extract summary/objective from text
 */
function extractSummary(text) {
  const summarySection = extractSection(text, ['summary', 'objective', 'profile', 'about', 'overview']);
  return summarySection || null;
}

/**
 * Main function to parse CV data
 */
async function parseCVData(buffer, mimeType) {
  // Extract text from file
  const cvText = await extractTextFromFile(buffer, mimeType);
  
  // Extract all data
  const cvData = {
    personalInfo: {
      fullName: extractName(cvText),
      email: extractEmail(cvText),
      phoneNumber: extractPhoneNumber(cvText),
      address: extractAddress(cvText),
      city: null,
      country: null,
      linkedinUrl: extractLinkedIn(cvText),
      dateOfBirth: null,
      gender: null,
      nationality: null,
    },
    education: extractEducation(cvText),
    workExperience: extractWorkExperience(cvText),
    skills: extractSkills(cvText),
    languages: extractLanguages(cvText),
    summary: extractSummary(cvText),
    certifications: [],
  };
  
  // Extract city and country from address if available
  if (cvData.personalInfo.address) {
    const addressParts = cvData.personalInfo.address.split(',');
    if (addressParts.length >= 2) {
      cvData.personalInfo.city = addressParts[addressParts.length - 2].trim();
      cvData.personalInfo.country = addressParts[addressParts.length - 1].trim();
    }
  }
  
  return cvData;
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
  if (cvData.personalInfo) {
    const p = cvData.personalInfo;
    latex += '\\section*{Personal Information}\n';
    if (p.fullName) latex += `\\textbf{Name:} ${escapeLaTeX(p.fullName)}\\\\\n`;
    if (p.email) latex += `\\textbf{Email:} ${escapeLaTeX(p.email)}\\\\\n`;
    if (p.phoneNumber) latex += `\\textbf{Phone:} ${escapeLaTeX(p.phoneNumber)}\\\\\n`;
    if (p.address) latex += `\\textbf{Address:} ${escapeLaTeX(p.address)}\\\\\n`;
    if (p.city) latex += `\\textbf{City:} ${escapeLaTeX(p.city)}\\\\\n`;
    if (p.country) latex += `\\textbf{Country:} ${escapeLaTeX(p.country)}\\\\\n`;
    if (p.linkedinUrl) latex += `\\textbf{LinkedIn:} ${escapeLaTeX(p.linkedinUrl)}\\\\\n`;
    latex += '\\vspace{0.5cm}\n\n';
  }

  // Summary
  if (cvData.summary) {
    latex += '\\section*{Summary}\n';
    latex += escapeLaTeX(cvData.summary) + '\n\n';
  }

  // Education
  if (cvData.education && cvData.education.length > 0) {
    latex += '\\section*{Education}\n';
    latex += '\\begin{itemize}\n';
    cvData.education.forEach(edu => {
      latex += '\\item ';
      latex += `\\textbf{${escapeLaTeX(edu.degree)}}`;
      if (edu.specialization) latex += ` - ${escapeLaTeX(edu.specialization)}`;
      latex += `, ${escapeLaTeX(edu.institution)}`;
      if (edu.startYear) {
        latex += ` (${edu.startYear}`;
        if (edu.endYear) latex += ` - ${edu.endYear}`;
        else if (edu.isOngoing) latex += ' - Present';
        latex += ')';
      }
      if (edu.grade) latex += `, Grade: ${escapeLaTeX(edu.grade)}`;
      latex += '\n';
    });
    latex += '\\end{itemize}\n\n';
  }

  // Work Experience
  if (cvData.workExperience && cvData.workExperience.length > 0) {
    latex += '\\section*{Work Experience}\n';
    cvData.workExperience.forEach(exp => {
      latex += '\\subsection*{';
      latex += escapeLaTeX(exp.jobTitle);
      latex += ` at ${escapeLaTeX(exp.company)}`;
      if (exp.workLocation) latex += `, ${escapeLaTeX(exp.workLocation)}`;
      latex += '}\n';
      if (exp.startDate) {
        latex += `\\textbf{Period:} ${exp.startDate}`;
        if (exp.endDate) latex += ` - ${exp.endDate}`;
        else if (exp.isCurrentJob) latex += ' - Present';
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
    const skillsByCategory = {};
    cvData.skills.forEach(skill => {
      const category = skill.category || 'General';
      if (!skillsByCategory[category]) {
        skillsByCategory[category] = [];
      }
      skillsByCategory[category].push(skill);
    });

    Object.keys(skillsByCategory).forEach(category => {
      latex += `\\subsection*{${escapeLaTeX(category)}}\n`;
      latex += '\\begin{itemize}\n';
      skillsByCategory[category].forEach(skill => {
        latex += `\\item ${escapeLaTeX(skill.name)}`;
        if (skill.proficiency) latex += ` (${skill.proficiency})`;
        if (skill.yearsOfExp) latex += ` - ${skill.yearsOfExp} years`;
        latex += '\n';
      });
      latex += '\\end{itemize}\n';
    });
    latex += '\n';
  }

  // Languages
  if (cvData.languages && cvData.languages.length > 0) {
    latex += '\\section*{Languages}\n';
    latex += '\\begin{itemize}\n';
    cvData.languages.forEach(lang => {
      latex += `\\item ${escapeLaTeX(lang.name)} - ${lang.proficiency}`;
      const abilities = [];
      if (lang.canSpeak) abilities.push('Speak');
      if (lang.canRead) abilities.push('Read');
      if (lang.canWrite) abilities.push('Write');
      if (abilities.length > 0) latex += ` (${abilities.join(', ')})`;
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
    .replace(/~/g, '\\textasciitilde{}');
}

module.exports = {
  extractTextFromFile,
  parseCVData,
  convertToLaTeX,
};
