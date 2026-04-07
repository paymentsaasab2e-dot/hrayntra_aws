const { prisma } = require('../lib/prisma');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Mistral } = require('@mistralai/mistralai');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

// Initialize AI services
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const mistral = MISTRAL_API_KEY ? new Mistral({ apiKey: MISTRAL_API_KEY }) : null;
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

/**
 * Get resume HTML for CV editor
 * GET /api/cveditor/resume/:candidateId
 */
async function getResumeHTML(req, res) {
  try {
    const { candidateId } = req.params;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    // Get resume from database
    const resume = await prisma.resume.findUnique({
      where: { candidateId },
    });

    // If no resume exists, return default HTML
    if (!resume) {
      const defaultHtml = '<div class="resume-container"><h1>Your Resume</h1><p>Start editing your resume...</p></div>';
      return res.json({
        success: true,
        data: {
          resume_html: defaultHtml,
          template_id: 'default',
          updated_at: new Date(),
        },
      });
    }

    // If resume_html exists, return it (convert markdown to HTML)
    if (resume.resumeHtml) {
      const convertedHtml = convertMarkdownToHTML(resume.resumeHtml);
      return res.json({
        success: true,
        data: {
          resume_html: convertedHtml,
          template_id: resume.templateId || 'default',
          updated_at: resume.updatedAt,
        },
      });
    }

    // If no resume_html, try to extract from resumeJson first, then from file
    let defaultHtml = '<div class="resume-container"><h1>Your Resume</h1><p>Start editing your resume...</p></div>';
    
    // First, try to extract projects from resumeJson if available
    let extractedProjects = [];
    if (resume.resumeJson && typeof resume.resumeJson === 'object') {
      const resumeData = resume.resumeJson;
      // Check if there's raw text in resumeJson that we can extract projects from
      if (resumeData.rawText || resumeData.fullText) {
        const textToExtract = resumeData.rawText || resumeData.fullText;
        extractedProjects = await extractProjectsFromText(textToExtract);
      }
    }
    
    // Try to extract text from the uploaded resume file if it exists
    if (resume.fileUrl && !resume.resumeHtml) {
      try {
        const filePath = path.join(__dirname, '../../', resume.fileUrl);
        if (fs.existsSync(filePath)) {
          const fileBuffer = fs.readFileSync(filePath);
          let extractedText = '';

          // Extract text based on file type
          if (resume.mimeType === 'application/pdf') {
            const pdfData = await pdfParse(fileBuffer);
            extractedText = pdfData.text;
          } else if (
            resume.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            resume.mimeType === 'application/msword'
          ) {
            const result = await mammoth.extractRawText({ buffer: fileBuffer });
            extractedText = result.value;
          }

          // Convert extracted text to HTML format
          if (extractedText && extractedText.trim().length > 0) {
            // Extract projects using AI
            const extractedProjects = await extractProjectsFromText(extractedText);
            
            // Convert text to HTML
            let htmlContent = convertTextToHTML(extractedText);
            
            // If projects were extracted, format them and add to HTML
            if (extractedProjects && extractedProjects.length > 0) {
              const projectsHTML = formatProjectsToHTML(extractedProjects);
              // Insert projects section before closing div
              htmlContent = htmlContent.replace('</div>', projectsHTML + '</div>');
            }
            
            defaultHtml = htmlContent;
            
            // Save the extracted HTML to database for future use
            await prisma.resume.update({
              where: { candidateId },
              data: {
                resumeHtml: defaultHtml,
                updatedAt: new Date(),
              },
            });
          }
        }
      } catch (error) {
        console.warn('Could not extract text from resume file:', error.message);
        // If extraction fails, try to generate from profile data
        defaultHtml = await generateHTMLFromProfile(candidateId);
      }
    } else if (!resume.resumeHtml) {
      // If no file, try to generate from profile data
      defaultHtml = await generateHTMLFromProfile(candidateId);
    }
    
    // If we extracted projects but they're not in the HTML yet, add them
    if (extractedProjects && extractedProjects.length > 0 && !defaultHtml.includes('<h2>Projects</h2>')) {
      const projectsHTML = formatProjectsToHTML(extractedProjects);
      defaultHtml = defaultHtml.replace('</div>', projectsHTML + '</div>');
    }

    // Convert any markdown in defaultHtml to HTML
    const convertedHtml = convertMarkdownToHTML(defaultHtml);
    
    return res.json({
      success: true,
      data: {
        resume_html: convertedHtml,
        template_id: 'default',
        updated_at: resume.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error getting resume HTML:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get resume HTML',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Save resume HTML
 * POST /api/cveditor/save
 */
async function saveResumeHTML(req, res) {
  try {
    const { candidateId, resume_html, template_id } = req.body;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    if (!resume_html) {
      return res.status(400).json({
        success: false,
        message: 'Resume HTML is required',
      });
    }

    // Get existing resume
    const existingResume = await prisma.resume.findUnique({
      where: { candidateId },
    });

    if (!existingResume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found',
      });
    }

    // Create version snapshot before updating
    await prisma.resumeVersion.create({
      data: {
        candidateId,
        resumeId: existingResume.id,
        resumeHtml: existingResume.resumeHtml || null,
        resumeJson: existingResume.resumeJson || null,
        templateId: existingResume.templateId || 'default',
      },
    });

    // Convert markdown to HTML before saving
    const convertedHtml = convertMarkdownToHTML(resume_html);
    
    // Update resume with new HTML
    const updatedResume = await prisma.resume.update({
      where: { candidateId },
      data: {
        resumeHtml: convertedHtml,
        templateId: template_id || existingResume.templateId || 'default',
        updatedAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Resume saved successfully',
      data: {
        resumeId: updatedResume.id,
        updated_at: updatedResume.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error saving resume HTML:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save resume HTML',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Improve text with AI
 * POST /api/cveditor/ai-improve
 */
async function improveTextWithAI(req, res) {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Text is required',
      });
    }

    // Check if at least one AI service is configured
    if (!mistral && !genAI && !anthropic && !openai) {
      return res.status(503).json({
        success: false,
        message: 'No AI service configured. Please set at least one API key (MISTRAL_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY) in your environment variables.',
      });
    }

    // Detect if this is a project section
    const isProjectSection = /projects?|project/i.test(text) || 
                            text.includes('Project Title') || 
                            text.includes('Technologies:') ||
                            text.includes('Date:') ||
                            text.match(/\*\*[^*]+\*\*/); // Has bold project titles

    let prompt;
    let isStructuredOutput = false;

    if (isProjectSection) {
      // Special prompt for project sections - EXACT STRUCTURE: Title -> Date -> Bullet Points
      prompt = `You are formatting a Projects section for a professional resume. Analyze the following project information and structure it EXACTLY as specified.

CRITICAL FORMATTING RULES:
1. Each project MUST follow this EXACT structure:
   - Project Title (as H3 heading with <strong> tag)
   - Date/Duration (as a paragraph)
   - Bullet Points (as an unordered list <ul> with <li> items)

2. DO NOT include "Technologies:" label - only show technologies if they're part of the bullet points
3. DO NOT use <hr> tags between projects - use spacing with <p><br></p>
4. Convert all descriptions into clear, action-oriented bullet points
5. Remove redundant or repeated information
6. Keep formatting consistent across all projects

Return the formatted projects in HTML format. Each project should be structured EXACTLY like this:

<h3><strong>E-Commerce Website</strong></h3>
<p>Jan 2023 – Apr 2023</p>
<ul>
<li>Built a full-stack e-commerce platform</li>
<li>Implemented secure authentication and payment gateway</li>
<li>Optimized performance using lazy loading</li>
</ul>

<p><br></p>

<h3><strong>AI Resume Parser</strong></h3>
<p>May 2023 – Aug 2023</p>
<ul>
<li>Developed AI system to extract resume data</li>
<li>Implemented NLP-based entity recognition</li>
<li>Built structured resume editor using TipTap</li>
</ul>

IMPORTANT:
- Title MUST be in <h3><strong>Title</strong></h3> format
- Date MUST be in <p>Date</p> format (no labels)
- Description MUST be in <ul><li>...</li></ul> format (bullet points)
- Each bullet point should be a single, clear achievement or responsibility
- Use action verbs (Built, Developed, Implemented, Optimized, etc.)

Original text:
${text}

Return only the formatted HTML without any markdown syntax or extra labels.`;
      isStructuredOutput = true;
    } else {
      // Regular prompt for other sections
      prompt = `Rewrite this resume sentence professionally and make it ATS-friendly. Return only the improved text as plain text without any markdown formatting (no asterisks, underscores, or other markdown syntax). Just return the clean, improved text. Original text: ${text}`;
    }

    let improvedText = '';
    let error = null;

    // Try OpenAI first (primary)
    if (openai) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: isProjectSection ? 2000 : 500, // More tokens for structured project output
        });
        improvedText = completion.choices[0]?.message?.content?.trim() || '';
        if (improvedText) {
          console.log('✅ Successfully used OpenAI for text improvement');
        } else {
          console.warn('⚠️ OpenAI returned empty response');
        }
      } catch (openaiError) {
        console.error('❌ OpenAI error:', openaiError.message || openaiError);
        error = openaiError;
      }
    } else {
      console.warn('⚠️ OpenAI not configured (OPENAI_API_KEY missing)');
    }

    // Fallback to Mistral if OpenAI failed/unavailable
    if (!improvedText && mistral) {
      try {
        const chatResponse = await mistral.chat.complete({
          model: 'mistral-large-latest',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          maxTokens: isProjectSection ? 2000 : 500, // More tokens for structured project output
        });
        improvedText = chatResponse.choices[0]?.message?.content?.trim() || '';
        if (improvedText) {
          console.log('✅ Successfully used Mistral AI for text improvement');
        } else {
          console.warn('⚠️ Mistral returned empty response');
        }
      } catch (mistralError) {
        console.error('❌ Mistral AI error:', mistralError.message || mistralError);
        error = mistralError;
      }
    } else if (!improvedText) {
      console.warn('⚠️ Mistral AI not configured (MISTRAL_API_KEY missing)');
    }

    // Fallback to Gemini
    if (!improvedText && genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        improvedText = response.text().trim();
        if (improvedText) {
          console.log('✅ Successfully used Google Gemini for text improvement');
        } else {
          console.warn('⚠️ Gemini returned empty response');
        }
      } catch (geminiError) {
        console.error('❌ Google Gemini error:', geminiError.message || geminiError);
        error = geminiError;
      }
    } else if (!improvedText) {
      console.warn('⚠️ Google Gemini not configured (GEMINI_API_KEY missing)');
    }

    // Fallback to Anthropic
    if (!improvedText && anthropic) {
      try {
        const message = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: isProjectSection ? 2000 : 500, // More tokens for structured project output
          messages: [{ role: 'user', content: prompt }],
        });
        improvedText = message.content[0]?.text?.trim() || '';
        if (improvedText) {
          console.log('✅ Successfully used Anthropic Claude for text improvement');
        } else {
          console.warn('⚠️ Anthropic returned empty response');
        }
      } catch (anthropicError) {
        console.error('❌ Anthropic Claude error:', anthropicError.message || anthropicError);
        error = anthropicError;
      }
    } else if (!improvedText) {
      console.warn('⚠️ Anthropic Claude not configured (ANTHROPIC_API_KEY missing)');
    }

    // OpenAI attempted first; no need to fallback here.

    if (!improvedText) {
      console.error('All AI services failed:', error);
      const errorMessage = error?.message || 'All AI services unavailable';
      return res.status(500).json({
        success: false,
        message: `Failed to improve text with AI. ${errorMessage}`,
        error: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      });
    }

    // Convert markdown to HTML before returning
    const convertedImprovedText = convertMarkdownToHTML(improvedText);

    res.json({
      success: true,
      data: {
        originalText: text,
        improvedText: convertedImprovedText,
      },
    });
  } catch (error) {
    console.error('Error improving text with AI:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to improve text with AI',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Export resume as PDF
 * POST /api/cveditor/export
 */
async function exportResumePDF(req, res) {
  try {
    const { candidateId, resume_html } = req.body;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required',
      });
    }

    if (!resume_html) {
      return res.status(400).json({
        success: false,
        message: 'Resume HTML is required',
      });
    }

    // Create full HTML document with comprehensive styling
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: Arial, Helvetica, sans-serif;
              padding: 40px;
              line-height: 1.6;
              color: #000000;
              background: #ffffff;
              font-size: 11pt;
            }
            .resume-container {
              max-width: 800px;
              margin: 0 auto;
              background: #ffffff;
            }
            h1 {
              font-size: 24px;
              font-weight: bold;
              margin-top: 0;
              margin-bottom: 10px;
              color: #000000;
              line-height: 1.2;
            }
            h2 {
              font-size: 18px;
              font-weight: bold;
              margin-top: 24px;
              margin-bottom: 12px;
              border-bottom: 2px solid #000000;
              padding-bottom: 6px;
              color: #000000;
              line-height: 1.3;
            }
            h3 {
              font-size: 16px;
              font-weight: 600;
              margin-top: 16px;
              margin-bottom: 8px;
              color: #000000;
              line-height: 1.4;
            }
            p {
              margin: 8px 0;
              color: #000000;
              line-height: 1.6;
              text-align: left;
            }
            ul {
              margin: 10px 0;
              padding-left: 24px;
              color: #000000;
            }
            li {
              margin: 4px 0;
              color: #000000;
              line-height: 1.6;
            }
            ol {
              margin: 10px 0;
              padding-left: 24px;
              color: #000000;
            }
            strong {
              font-weight: bold;
              color: #000000;
            }
            em {
              font-style: italic;
              color: #000000;
            }
            a {
              color: #2563eb;
              text-decoration: underline;
            }
            hr {
              border: none;
              border-top: 1px solid #cccccc;
              margin: 20px 0;
            }
            /* Ensure all text is black */
            span, div, section {
              color: #000000;
            }
            /* Proper spacing for sections */
            section {
              margin-bottom: 20px;
            }
            /* Table styling if any */
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 10px 0;
            }
            th, td {
              padding: 8px;
              text-align: left;
              border-bottom: 1px solid #dddddd;
              color: #000000;
            }
            /* Code blocks if any */
            code {
              background: #f5f5f5;
              padding: 2px 4px;
              border-radius: 3px;
              font-family: 'Courier New', monospace;
              color: #000000;
            }
            /* Print-specific styles */
            @media print {
              body {
                padding: 0;
              }
              .resume-container {
                max-width: 100%;
              }
            }
          </style>
        </head>
        <body>
          <div class="resume-container">
            ${resume_html}
          </div>
        </body>
      </html>
    `;

    // Launch puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    
    // Set viewport for consistent rendering
    await page.setViewport({
      width: 1200,
      height: 1600,
      deviceScaleFactor: 2,
    });
    
    await page.setContent(fullHtml, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    // Wait a bit more for any dynamic content to render
    await page.waitForTimeout(500);

    // Generate PDF with optimized settings
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
      displayHeaderFooter: false,
    });

    await browser.close();

    // Get candidate name for filename
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: { profile: true },
    });

    const fileName = `${candidate?.profile?.fullName || 'CV'}_${new Date().toISOString().split('T')[0]}.pdf`;

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error exporting PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export PDF',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * Convert extracted text to HTML format for TipTap editor
 */
// Convert markdown syntax to HTML
function convertMarkdownToHTML(html) {
  if (!html) return '';
  
  // Convert **text** to <strong>text</strong>
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Convert __text__ to <strong>text</strong>
  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
  
  // Convert *text* to <em>text</em> (only if not already part of **)
  html = html.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>');
  
  // Convert _text_ to <em>text</em> (only if not already part of __)
  html = html.replace(/(?<!_)_([^_\n]+?)_(?!_)/g, '<em>$1</em>');
  
  return html;
}

function convertTextToHTML(text) {
  if (!text || text.trim().length === 0) {
    return '<div class="resume-container"><h1>Your Resume</h1><p>Start editing your resume...</p></div>';
  }

  // Clean up the text
  let cleanedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n'); // Replace multiple newlines with double

  // Split text into lines
  const lines = cleanedText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  if (lines.length === 0) {
    return '<div class="resume-container"><h1>Your Resume</h1><p>Start editing your resume...</p></div>';
  }

  let html = '<div class="resume-container">';
  let inList = false;
  let currentParagraph = '';
  let inProjectSection = false;

  // Common section headers
  const sectionHeaders = [
    'SUMMARY', 'PROFESSIONAL SUMMARY', 'OBJECTIVE', 'PROFILE',
    'EXPERIENCE', 'WORK EXPERIENCE', 'EMPLOYMENT HISTORY', 'PROFESSIONAL EXPERIENCE',
    'EDUCATION', 'ACADEMIC QUALIFICATIONS',
    'SKILLS', 'TECHNICAL SKILLS', 'COMPETENCIES',
    'PROJECTS', 'PROJECT EXPERIENCE', 'PROJECT', 'PORTFOLIO',
    'CERTIFICATIONS', 'CERTIFICATES', 'LICENSES',
    'AWARDS', 'ACHIEVEMENTS', 'HONORS',
    'PUBLICATIONS', 'RESEARCH',
    'VOLUNTEER', 'VOLUNTEER EXPERIENCE',
    'LANGUAGES', 'LANGUAGE SKILLS'
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upperLine = line.toUpperCase();

    // Detect section headers
    const isSectionHeader = sectionHeaders.some(header => 
      upperLine === header || 
      upperLine.startsWith(header + ':') ||
      upperLine.startsWith(header + ' ') ||
      (line.length < 50 && line === line.toUpperCase() && line.length > 3 && !line.includes('@'))
    );

    // Check if we're entering Projects section
    const isProjectsSection = /^(PROJECTS|PROJECT|PORTFOLIO)/i.test(upperLine);
    
    if (isSectionHeader) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      if (currentParagraph) {
        html += `<p>${currentParagraph}</p>`;
        currentParagraph = '';
      }
      html += `<h2>${line.replace(/[:•·▪▫\-\*]/g, '').trim()}</h2>`;
      
      // Track if we're in projects section
      inProjectSection = isProjectsSection;
    }
    // Detect list items
    else if (/^[•·▪▫\-\*]\s/.test(line) || /^\d+[\.\)]\s/.test(line) || /^[a-z][\.\)]\s/.test(line)) {
      if (currentParagraph) {
        html += `<p>${currentParagraph}</p>`;
        currentParagraph = '';
      }
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      const listItem = line.replace(/^[•·▪▫\-\*]\s/, '').replace(/^\d+[\.\)]\s/, '').replace(/^[a-z][\.\)]\s/, '').trim();
      html += `<li>${listItem}</li>`;
    }
    // Detect potential subheadings (job titles, company names, degrees, project titles)
    else if (
      line.length < 100 &&
      (
        line.includes(' at ') ||
        line.includes(' - ') ||
        line.includes(' | ') ||
        /^[A-Z][a-z]+ [A-Z]/.test(line) || // Name pattern
        /^[A-Z][a-z]+ (University|College|Institute|School)/i.test(line) ||
        /^(Bachelor|Master|PhD|Doctor|Diploma|Certificate)/i.test(line) ||
        // Detect project titles (quoted names, app names, etc.)
        /^["']/.test(line) || // Starts with quote
        /^[A-Z][a-zA-Z0-9\s]+(?:App|Website|Platform|System|Tool|Project)$/i.test(line) // Ends with project-related words
      ) &&
      !line.includes('.') && // Not a sentence
      !line.includes(',') // Not a list
    ) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      if (currentParagraph) {
        html += `<p>${currentParagraph}</p>`;
        currentParagraph = '';
      }
      // Format project titles with bold when in Projects section
      if (inProjectSection || /^["']/.test(line)) {
        html += `<h3><strong>${line.replace(/["']/g, '')}</strong></h3>`;
      } else {
        html += `<h3>${line}</h3>`;
      }
    }
    // Regular text - accumulate into paragraph
    else {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      if (currentParagraph) {
        currentParagraph += ' ' + line;
      } else {
        currentParagraph = line;
      }
    }
  }

  // Close any open tags
  if (inList) {
    html += '</ul>';
  }
  if (currentParagraph) {
    html += `<p>${currentParagraph}</p>`;
  }

  html += '</div>';
  return html;
}

/**
 * Extract and structure projects from text using AI
 */
async function extractProjectsFromText(text) {
  if (!text || text.trim().length === 0) return [];
  
  const projectSection = extractSection(text, ['projects', 'project', 'portfolio', 'personal projects']);
  if (!projectSection) return [];
  
  const prompt = `You are an AI assistant specialized in extracting and structuring project information from resumes.

Extract ALL projects from the following resume text. For each project, you MUST identify:

1. **Project Title** - The name of the project (required)
2. **Date/Duration** - Start and end dates in format "Jan 2023 - Apr 2023" or just "2023" if only year is available. If no date is found, set this field to null or omit it - DO NOT use placeholder text like "Date not specified"
3. **Technologies Used** - Comma-separated list of technologies, frameworks, or tools
4. **Description/Bullet Points** - Key achievements, responsibilities, or features. Convert long descriptions into clear bullet points.

CRITICAL FORMATTING RULES:
- Each project MUST be clearly separated
- Convert paragraph descriptions into bullet points (use • or -)
- Remove redundant or repeated information
- Keep descriptions concise and action-oriented
- If dates are missing, DO NOT include a date field at all (omit it completely)
- NEVER use "Date not specified", "Duration not specified", or similar placeholder text

Return the projects in this EXACT JSON format:
{
  "projects": [
    {
      "title": "E-Commerce Website",
      "date": "Jan 2023 - Apr 2023",
      "technologies": "React, Node.js, MongoDB",
      "description": "• Built a full-stack e-commerce platform\n• Implemented secure authentication and payment gateway\n• Optimized performance using lazy loading"
    },
    {
      "title": "AI Resume Parser",
      "date": "May 2023 - Aug 2023",
      "technologies": "Python, NLP, Machine Learning",
      "description": "• Developed AI system to extract resume data\n• Implemented NLP-based entity recognition\n• Built structured resume editor using TipTap"
    }
  ]
}

If no projects found, return {"projects": []}.

Resume Text:
${projectSection}`;

  try {
    let projects = [];
    
    // Try OpenAI first (primary)
    if (openai) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 2000,
        });
        const responseText = completion.choices[0]?.message?.content?.trim() || '';
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.projects && Array.isArray(parsed.projects)) {
            projects = parsed.projects;
          }
        }
      } catch (err) {
        console.warn('OpenAI project extraction failed:', err.message);
      }
    }
    
    // Fallback to Mistral
    if (projects.length === 0 && mistral) {
      try {
        const chatResponse = await mistral.chat.complete({
          model: 'mistral-large-latest',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          maxTokens: 2000,
        });
        const responseText = chatResponse.choices[0]?.message?.content?.trim() || '';
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.projects && Array.isArray(parsed.projects)) {
            projects = parsed.projects;
          }
        }
      } catch (err) {
        console.warn('Mistral project extraction failed:', err.message);
      }
    }
    
    // Fallback to Gemini
    if (projects.length === 0 && genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const responseText = response.text().trim();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.projects && Array.isArray(parsed.projects)) {
            projects = parsed.projects;
          }
        }
      } catch (err) {
        console.warn('Gemini project extraction failed:', err.message);
      }
    }
    
    return projects;
  } catch (error) {
    console.error('Error extracting projects:', error);
    return [];
  }
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
    if (inSection && /^(experience|education|skills|summary|objective|contact|personal|work|employment)/i.test(lines[i])) {
      break;
    }
    
    if (inSection) {
      sectionLines.push(lines[i]);
    }
  }
  
  return sectionLines.length > 0 ? sectionLines.join('\n') : null;
}

/**
 * Format projects into structured HTML blocks for TipTap editor
 * Structure: Title (H3) -> Date (P) -> Bullet Points (UL)
 */
function formatProjectsToHTML(projects) {
  if (!projects || projects.length === 0) return '';
  
  let html = '<h2>Projects</h2>';
  
  projects.forEach((project, index) => {
    // Project Title (H3 with strong) - REQUIRED
    if (project.title) {
      html += `<h3><strong>${escapeHtml(project.title)}</strong></h3>`;
    } else {
      // Skip project if no title
      return;
    }
    
    // Date (Paragraph) - Only show if available and not empty/null
    if (project.date && project.date.trim() && project.date.trim().toLowerCase() !== 'date not specified' && project.date.trim().toLowerCase() !== 'duration not specified') {
      html += `<p>${escapeHtml(project.date)}</p>`;
    }
    
    // Description as bullet points - REQUIRED
    if (project.description && project.description.trim()) {
      const description = project.description.trim();
      
      // Check if already formatted as bullet points (with •, -, *, or numbered)
      const isBulletPoints = /^[•·▪▫\-\*]\s/m.test(description) || /^\d+[\.\)]\s/m.test(description);
      
      if (isBulletPoints) {
        // Already has bullet points, convert to HTML list
        const bullets = description.split(/\n/).filter(line => line.trim());
        html += '<ul>';
        bullets.forEach(bullet => {
          // Remove bullet markers and clean
          const cleanBullet = bullet
            .replace(/^[•·▪▫\-\*]\s*/, '')
            .replace(/^\d+[\.\)]\s*/, '')
            .trim();
          if (cleanBullet && cleanBullet.length > 0) {
            html += `<li>${escapeHtml(cleanBullet)}</li>`;
          }
        });
        html += '</ul>';
      } else {
        // Convert paragraph/sentences to bullet points
        // Split by newlines first (in case AI already separated them)
        const lines = description.split(/\n/).filter(line => line.trim().length > 0);
        
        if (lines.length > 1) {
          // Multiple lines - treat each as a bullet point
          html += '<ul>';
          lines.forEach(line => {
            const cleanLine = line.trim();
            if (cleanLine.length > 0) {
              html += `<li>${escapeHtml(cleanLine)}</li>`;
            }
          });
          html += '</ul>';
        } else {
          // Single paragraph - split by sentences and convert to bullets
          const sentences = description
            .split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => s.length > 10); // Only meaningful sentences
          
          if (sentences.length > 0) {
            html += '<ul>';
            sentences.forEach(sentence => {
              if (sentence.length > 0) {
                html += `<li>${escapeHtml(sentence)}</li>`;
              }
            });
            html += '</ul>';
          } else {
            // Fallback: single bullet point
            html += '<ul>';
            html += `<li>${escapeHtml(description)}</li>`;
            html += '</ul>';
          }
        }
      }
    } else {
      // No description - add empty bullet list
      html += '<ul><li>Project details not specified</li></ul>';
    }
    
    // Add spacing between projects (but not after the last one)
    if (index < projects.length - 1) {
      html += '<p><br></p>'; // TipTap-friendly spacing
    }
  });
  
  return html;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Format date to readable format
 */
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Generate a professional, recruiter-ready HTML resume from candidate profile data.
 * This is used as a high-quality fallback when no manual edits exist.
 */
async function generateHTMLFromProfile(candidateId) {
  try {
    const [profile, summary, workExperiences, educations, candidateSkills, projects] = await Promise.all([
      prisma.candidateProfile.findUnique({ where: { candidateId } }),
      prisma.candidateSummary.findUnique({ where: { candidateId } }),
      prisma.workExperience.findMany({ where: { candidateId }, orderBy: { startDate: 'desc' } }),
      prisma.education.findMany({ where: { candidateId }, orderBy: { startYear: 'desc' } }),
      prisma.candidateSkill.findMany({
        where: { candidateId },
        include: { skill: true },
      }),
      prisma.candidateProject.findMany({ where: { candidateId } }),
    ]);

    let html = '<div class="resume-container">';

    // --- HEADER / IDENTITY BLOCK ---
    const fullName = profile?.fullName || 'Candidate Name';
    const headline = profile?.employmentStatus || 'Professional';
    const email = profile?.contactEmail || '';
    const phone = profile?.phoneNumber || '';
    const location = profile?.location || '';

    html += `<h1>${fullName.toUpperCase()}</h1>`;
    html += `<p><strong>${headline}</strong></p>`;
    
    const contactLinks = [];
    if (email) contactLinks.push(email);
    if (phone) contactLinks.push(phone);
    if (location) contactLinks.push(location);
    if (contactLinks.length > 0) {
      html += `<p>${contactLinks.join(' | ')}</p>`;
    }

    // --- PROFESSIONAL SUMMARY ---
    if (summary?.summaryText) {
      html += '<h2>Professional Summary</h2>';
      html += `<p>${summary.summaryText}</p>`;
    }

    // --- WORK EXPERIENCE ---
    if (workExperiences && workExperiences.length > 0) {
      html += '<h2>Work Experience</h2>';
      workExperiences.forEach((exp, idx) => {
        const company = exp.company || 'Company';
        const role = exp.jobTitle || 'Role';
        const start = exp.startDate ? new Date(exp.startDate).getFullYear() : '';
        const end = exp.isCurrentJob ? 'Present' : (exp.endDate ? new Date(exp.endDate).getFullYear() : '');
        const duration = start ? `${start} – ${end}` : '';

        html += `<h3><strong>${company}</strong></h3>`;
        html += `<p>${role} | ${duration}</p>`;
        
        const description = exp.jobDescription || exp.responsibilities;
        if (description) {
          const sentences = description.split(/[.!?]+/).filter(s => s.trim().length > 5);
          if (sentences.length > 1) {
            html += '<ul>';
            sentences.forEach(s => html += `<li>${s.trim()}</li>`);
            html += '</ul>';
          } else {
            html += `<p>${description}</p>`;
          }
        }
        if (idx < workExperiences.length - 1) html += '<p><br></p>';
      });
    }

    // --- EDUCATION ---
    if (educations && educations.length > 0) {
      html += '<h2>Education</h2>';
      educations.forEach((edu, idx) => {
        html += `<h3><strong>${edu.institution}</strong></h3>`;
        html += `<p>${edu.degree} | ${edu.startYear} – ${edu.endYear || 'Present'}</p>`;
        if (idx < educations.length - 1) html += '<p><br></p>';
      });
    }

    // --- PROJECTS ---
    if (projects && projects.length > 0) {
      const formattedProjects = projects.map(p => ({
        title: p.projectTitle,
        date: p.startDate && p.endDate ? `${formatDate(p.startDate)} – ${formatDate(p.endDate)}` : '',
        description: p.projectDescription || p.responsibilities || '',
        technologies: p.technologies?.join(', ') || ''
      }));
      html += formatProjectsToHTML(formattedProjects);
    }

    // --- SKILLS ---
    if (candidateSkills && candidateSkills.length > 0) {
      html += '<h2>Skills</h2>';
      const skillNames = candidateSkills.map(s => s.skill?.name || s.skillId).filter(Boolean);
      html += `<p>${skillNames.join(', ')}</p>`;
    }

    html += '</div>';
    return html;
  } catch (error) {
    console.error('Error generating HTML from profile:', error);
    return '<div class="resume-container"><h1>Candidate Resume</h1><p>Internal profile data fetch failed. Start editing manually...</p></div>';
  }
}

module.exports = {
  getResumeHTML,
  saveResumeHTML,
  improveTextWithAI,
  exportResumePDF,
};
