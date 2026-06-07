/**
 * Generates Sample_Full_Profile_CV.pdf for testing the OpenAI extraction pipeline.
 * Run: node scripts/generate-test-cv.js
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const OUTPUT_DIR = path.join(__dirname, '..', 'test-data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'Sample_Full_Profile_CV.pdf');

const resumeHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; font-size: 11pt; color: #111; margin: 36px 42px; line-height: 1.35; }
    h1 { font-size: 22pt; margin: 0 0 4px; letter-spacing: 1px; }
    .contact { font-size: 10pt; color: #333; margin-bottom: 14px; }
    h2 { font-size: 12pt; text-transform: uppercase; border-bottom: 1px solid #333; margin: 16px 0 8px; padding-bottom: 2px; }
    .entry { margin-bottom: 10px; }
    .meta { font-style: italic; color: #444; }
    ul { margin: 4px 0 0 18px; padding: 0; }
    li { margin-bottom: 3px; }
  </style>
</head>
<body>
  <h1>ARJUN VIKRAM MEHTA</h1>
  <div class="contact">
    Email: arjun.mehta.test@example.com &nbsp;|&nbsp; Phone: +91 9876543210 &nbsp;|&nbsp; Alt: +91 9123456789<br/>
    Address: Flat 12B, Sunrise Apartments, Hinjewadi Phase 2, Pune, Maharashtra 411057, India<br/>
    LinkedIn: https://linkedin.com/in/arjunvikrammehta &nbsp;|&nbsp; GitHub: https://github.com/arjunvikrammehta<br/>
    Portfolio: https://arjunmehta.dev &nbsp;|&nbsp; Gender: Male &nbsp;|&nbsp; DOB: 15/08/1998<br/>
    Nationality: Indian &nbsp;|&nbsp; Passport: P1234567 &nbsp;|&nbsp; Marital Status: Single
  </div>

  <h2>Professional Summary</h2>
  <p>Full-stack software engineer with 4+ years building scalable web applications in Node.js, React, and cloud-native environments. Strong background in API design, PostgreSQL/MongoDB, and CI/CD. Seeking senior engineering roles in product-led technology companies.</p>

  <h2>Work Experience</h2>
  <div class="entry">
    <strong>Senior Software Engineer</strong> — Infosys Limited, Pune, India<br/>
    <span class="meta">Full-time | Technology | Hybrid | Jun 2022 – Present | Reports to: Engineering Manager (team of 4)</span>
    <ul>
      <li>Led migration of legacy monolith to microservices (Node.js, Docker, AWS ECS).</li>
      <li>Reduced API latency by 38% through query optimization and Redis caching.</li>
      <li>Skills used: Node.js, TypeScript, React, PostgreSQL, AWS, Docker, Kubernetes.</li>
    </ul>
    <p><strong>Achievements:</strong> Spot Award Q3 2024 for delivery excellence. Promoted from Software Engineer in 2023.</p>
  </div>
  <div class="entry">
    <strong>Software Engineer</strong> — TCS Digital, Bangalore, India<br/>
    <span class="meta">Full-time | IT Services | On-site | Jul 2020 – May 2022</span>
    <ul>
      <li>Built REST APIs and React dashboards for banking clients.</li>
      <li>Implemented JWT auth and role-based access control.</li>
    </ul>
  </div>

  <h2>Internships</h2>
  <div class="entry">
    <strong>Software Development Intern</strong> — Zoho Corporation, Chennai<br/>
    <span class="meta">Summer Internship | Engineering | Remote | May 2019 – Jul 2019</span>
    <p>Developed internal tooling in Python and Flask. Learned agile practices and code review workflows.</p>
  </div>

  <h2>Education</h2>
  <div class="entry">
    <strong>B.E. Computer Engineering</strong> — Vishwakarma Institute of Technology, Pune<br/>
    <span class="meta">Bachelor's | Full-time | Aug 2016 – May 2020 | GPA: 8.4/10 | Duration: 4 years</span>
    <p>Field of Study: Computer Science. Location: Pune, Maharashtra, India.</p>
  </div>
  <div class="entry">
    <strong>HSC (12th)</strong> — Fergusson College, Pune<br/>
    <span class="meta">High School | 2014 – 2016 | Percentage: 86%</span>
  </div>
  <div class="entry">
    <strong>SSC (10th)</strong> — St. Mary's School, Pune<br/>
    <span class="meta">High School | 2012 – 2014 | Percentage: 92%</span>
  </div>

  <h2>Projects</h2>
  <div class="entry">
    <strong>Smart Inventory Tracker</strong> — Personal Project<br/>
    <span class="meta">Web Application | Jan 2023 – Mar 2023</span>
    <p>Real-time inventory dashboard with alerts. Built with React, Node.js, MongoDB. Outcome: deployed demo used by 50+ beta users.</p>
    <p>Link: https://github.com/arjunvikrammehta/inventory-tracker</p>
  </div>

  <h2>Technical Skills</h2>
  <p><strong>Hard Skills:</strong> JavaScript, TypeScript, Python, SQL, Data Structures, System Design (Intermediate–Advanced)</p>
  <p><strong>Tools / Technologies:</strong> React, Node.js, Express, PostgreSQL, MongoDB, Redis, Docker, AWS, Git, Jenkins (Intermediate)</p>
  <p><strong>Soft Skills:</strong> Communication, Team Leadership, Problem Solving (Advanced)</p>

  <h2>Languages</h2>
  <ul>
    <li>English — Fluent (Speak, Read, Write)</li>
    <li>Hindi — Fluent (Speak, Read, Write)</li>
    <li>Marathi — Intermediate (Speak, Read)</li>
  </ul>

  <h2>Certifications</h2>
  <div class="entry">
    <strong>AWS Certified Developer – Associate</strong> — Amazon Web Services | Issued: 2023-11-20 | Credential ID: AWS-DEV-88421<br/>
    Verify: https://aws.amazon.com/verification/example
  </div>
  <div class="entry">
    <strong>Meta Front-End Developer Professional Certificate</strong> — Coursera | Issued: 2022-06-15 | Does not expire
  </div>

  <h2>Academic Achievements</h2>
  <div class="entry">
    <strong>University Rank 3 — Computer Engineering Batch 2020</strong> — VIT Pune | 2020 | Academic Excellence
  </div>

  <h2>Competitive Exams</h2>
  <div class="entry">
    <strong>GATE Computer Science</strong> — 2020 | Qualified | Score: 612/1000 | Valid until 2023-06-30
  </div>

  <h2>Accomplishments</h2>
  <div class="entry">
    <strong>Hackathon Winner — Pune Tech Fest 2021</strong> — Pune University | 2021 | Built AI-powered resume parser prototype.
  </div>

  <h2>Career Preferences</h2>
  <p>Current CTC: INR 18,00,000 per annum. Current location: Pune, India. Benefits: Medical insurance, food allowance.<br/>
  Preferred roles: Senior Software Engineer, Full Stack Developer. Preferred locations: Pune, Bangalore, Remote (Hybrid).<br/>
  Notice period: 60 days. Open to relocation. Expected salary: INR 22–25 LPA.</p>

  <h2>Career Gap</h2>
  <p>Academic gap: Jan 2020 – Jun 2020 (6 months) — GATE exam preparation. Continued skills: Python, DSA. Completed online ML bootcamp.</p>
</body>
</html>`;

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const chromePaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);

  let browser;
  let lastLaunchError;
  for (const executablePath of chromePaths) {
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        executablePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      break;
    } catch (err) {
      lastLaunchError = err;
    }
  }
  if (!browser) throw lastLaunchError || new Error('Could not launch Chrome for PDF generation');
  try {
    const page = await browser.newPage();
    await page.setContent(resumeHtml, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
    });
    fs.writeFileSync(OUTPUT_FILE, pdf);
    console.log('Created:', OUTPUT_FILE);
    console.log('Size:', (pdf.length / 1024).toFixed(1), 'KB');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
