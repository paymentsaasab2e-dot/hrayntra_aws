const { launchBrowser } = require('../utils/puppeteerLaunch.util');

function esc(value) {
  if (value == null || value === '') return '—';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function section(title, rows) {
  const body = rows
    .filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0))
    .map(([label, value]) => {
      const display = Array.isArray(value) ? value.join(', ') : value;
      return `<tr><th>${esc(label)}</th><td>${esc(display)}</td></tr>`;
    })
    .join('');
  if (!body) return '';
  return `<section class="block"><h2>${esc(title)}</h2><table>${body}</table></section>`;
}

function listSection(title, items, formatter) {
  if (!Array.isArray(items) || items.length === 0) return '';
  const lis = items.map((item, i) => `<li><strong>#${i + 1}</strong> ${formatter(item)}</li>`).join('');
  return `<section class="block"><h2>${esc(title)}</h2><ul>${lis}</ul></section>`;
}

function buildProfileExtractHtml(parsedData) {
  const pi = parsedData.personalInformation || {};
  const generatedAt = new Date().toISOString();

  const personal = section('Personal Details', [
    ['First Name', pi.firstName],
    ['Middle Name', pi.middleName],
    ['Last Name', pi.lastName],
    ['Full Name', pi.fullName],
    ['Email', pi.email],
    ['Phone', pi.phoneNumber],
    ['Alternate Phone', pi.alternatePhoneNumber],
    ['Country Code', pi.countryCode],
    ['Gender', pi.gender],
    ['Date of Birth', pi.dateOfBirth],
    ['Marital Status', pi.maritalStatus],
    ['Address', pi.address],
    ['City', pi.city],
    ['Country', pi.country],
    ['Nationality', pi.nationality],
    ['Passport Number', pi.passportNumber],
    ['LinkedIn', pi.linkedinProfile],
    ['Employment Status', pi.employmentStatus],
  ]);

  const summaryBlock = parsedData.summary
    ? `<section class="block"><h2>Professional Summary</h2><p>${esc(parsedData.summary)}</p></section>`
    : '';

  const education = listSection('Education', parsedData.education, (e) =>
    [
      e.educationLevel,
      e.degree,
      e.institution,
      e.specialization,
      e.location,
      e.startYear ? `Start: ${e.startMonth || ''}/${e.startYear}` : null,
      e.endYear ? `End: ${e.endMonth || ''}/${e.endYear}` : e.isOngoing ? 'Ongoing' : null,
      e.grade ? `Grade: ${e.grade}` : null,
      e.modeOfStudy,
      e.courseDuration,
    ]
      .filter(Boolean)
      .join(' · ')
  );

  const work = listSection('Work Experience', parsedData.workExperience, (w) =>
    [
      w.jobTitle,
      w.company,
      w.employmentType,
      w.industry,
      w.workLocation,
      w.workMode,
      w.startDate && `From ${w.startDate}`,
      w.endDate ? `To ${w.endDate}` : w.currentlyWorking ? 'Present' : null,
      w.responsibilities,
      w.achievements,
      w.workSkills?.length ? `Skills: ${w.workSkills.join(', ')}` : null,
    ]
      .filter(Boolean)
      .join(' · ')
  );

  const internships = listSection('Internships', parsedData.internships, (x) =>
    [x.internshipTitle, x.companyName, x.domainDepartment, x.startDate, x.endDate, x.responsibilities]
      .filter(Boolean)
      .join(' · ')
  );

  const skills = listSection('Skills', parsedData.skills, (s) =>
    [s.name, s.category, s.proficiency].filter(Boolean).join(' — ')
  );

  const languages = listSection('Languages', parsedData.languages, (l) => {
    const abilities = [];
    if (l.speak) abilities.push('Speak');
    if (l.read) abilities.push('Read');
    if (l.write) abilities.push('Write');
    return [l.name, l.proficiency, abilities.join('/')].filter(Boolean).join(' — ');
  });

  const projects = listSection('Projects', parsedData.projects, (p) =>
    [p.projectTitle, p.projectType, p.organizationClient, p.projectDescription, p.projectLink]
      .filter(Boolean)
      .join(' · ')
  );

  const certs = listSection('Certifications', parsedData.certifications, (c) =>
    [c.certificationName, c.issuingOrganization, c.issueDate, c.credentialUrl].filter(Boolean).join(' · ')
  );

  const accomplishments = listSection('Accomplishments', parsedData.accomplishments, (a) =>
    [a.title, a.category, a.organization, a.achievementDate].filter(Boolean).join(' · ')
  );

  const academic = listSection('Academic Achievements', parsedData.academicAchievements, (a) =>
    [a.achievementTitle, a.awardedBy, a.yearReceived, a.categoryType].filter(Boolean).join(' · ')
  );

  const exams = listSection('Competitive Exams', parsedData.competitiveExams, (e) =>
    [e.examName, e.yearTaken, e.resultStatus, e.scoreMarks].filter(Boolean).join(' · ')
  );

  const gap = parsedData.gapExplanation
    ? section('Career Gap', [
        ['Category', parsedData.gapExplanation.gapCategory],
        ['Reason', parsedData.gapExplanation.reasonForGap],
        ['Duration', parsedData.gapExplanation.gapDuration],
        ['Skills During Gap', parsedData.gapExplanation.selectedSkills],
        ['Courses / Training', parsedData.gapExplanation.coursesText],
      ])
    : '';

  const cp = parsedData.careerPreferences;
  const career = cp
    ? section('Career Preferences', [
        ['Current Salary', cp.currentSalary],
        ['Current Currency', cp.currentCurrency],
        ['Current Location', cp.currentLocation],
        ['Current Benefits', cp.currentBenefits],
        ['Preferred Roles', cp.preferredRoles],
        ['Preferred Industry', cp.preferredIndustry],
        ['Preferred Work Mode', cp.preferredWorkMode],
        ['Preferred Locations', cp.preferredLocations],
        ['Notice Period', cp.noticePeriod],
      ])
    : '';

  const links = listSection('Portfolio Links', parsedData.portfolioLinks, (l) =>
    [l.linkType, l.url, l.title].filter(Boolean).join(' — ')
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Extracted Profile — ${esc(pi.fullName || 'Candidate')}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; color: #0f172a; margin: 0; padding: 32px; font-size: 11px; line-height: 1.45; }
    h1 { font-size: 20px; margin: 0 0 4px; color: #1e40af; }
    .meta { color: #64748b; font-size: 10px; margin-bottom: 24px; }
    h2 { font-size: 13px; margin: 0 0 8px; padding-bottom: 4px; border-bottom: 2px solid #dbeafe; color: #1e3a8a; }
    .block { margin-bottom: 18px; page-break-inside: avoid; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; width: 32%; padding: 5px 8px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: 600; vertical-align: top; }
    td { padding: 5px 8px; border: 1px solid #e2e8f0; vertical-align: top; }
    ul { margin: 0; padding-left: 18px; }
    li { margin-bottom: 6px; }
    p { margin: 0; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>CV Extraction — Full Profile Data</h1>
  <p class="meta">Generated ${esc(generatedAt)} · Phase 1 OpenAI pipeline</p>
  ${personal}
  ${summaryBlock}
  ${education}
  ${work}
  ${internships}
  ${skills}
  ${languages}
  ${projects}
  ${certs}
  ${accomplishments}
  ${academic}
  ${exams}
  ${gap}
  ${career}
  ${links}
</body>
</html>`;
}

async function generateProfileExtractPdf(parsedData) {
  const html = buildProfileExtractHtml(parsedData);
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', right: '14mm', bottom: '16mm', left: '14mm' },
    });
    return pdfBuffer;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = {
  buildProfileExtractHtml,
  generateProfileExtractPdf,
};
