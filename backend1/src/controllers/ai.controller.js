const { Mistral } = require('@mistralai/mistralai');
const { z } = require('zod');
const OpenAI = require('openai');

const sectionConfig = {
  basicInformation: {
    label: 'Basic Information',
    description: 'Collect the candidate basic profile details.',
    schemaDescription: {
      firstName: 'string',
      lastName: 'string',
      email: 'string',
      phone: 'string',
      phoneCode: 'string',
      gender: 'string',
      dob: 'string',
      country: 'string',
      city: 'string',
      employment: 'string',
      passportNumber: 'string',
    },
    extractorSchema: z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      phoneCode: z.string().optional(),
      gender: z.string().optional(),
      dob: z.string().optional(),
      country: z.string().optional(),
      city: z.string().optional(),
      employment: z.string().optional(),
      passportNumber: z.string().optional(),
    }),
  },
  summary: {
    label: 'Summary',
    description: 'Collect a concise professional summary.',
    schemaDescription: { summaryText: 'string' },
    extractorSchema: z.object({
      summaryText: z.string().optional(),
    }),
  },
  education: {
    label: 'Education',
    description: 'Collect one education entry with degree, institution, field of study and years.',
    schemaDescription: {
      educationLevel: 'string',
      degreeProgram: 'string',
      institutionName: 'string',
      fieldOfStudy: 'string',
      startYear: 'string',
      endYear: 'string',
      currentlyStudying: 'boolean',
      grade: 'string',
      modeOfStudy: 'string',
      courseDuration: 'string',
    },
    extractorSchema: z.object({
      educationLevel: z.string().optional(),
      degreeProgram: z.string().optional(),
      institutionName: z.string().optional(),
      fieldOfStudy: z.string().optional(),
      startYear: z.string().optional(),
      endYear: z.string().optional(),
      currentlyStudying: z.boolean().optional(),
      grade: z.string().optional(),
      modeOfStudy: z.string().optional(),
      courseDuration: z.string().optional(),
    }),
  },
  skills: {
    label: 'Skills',
    description: 'Collect one or more skills with proficiency and category.',
    schemaDescription: {
      skills: [
        {
          name: 'string',
          proficiency: 'Beginner | Intermediate | Advanced',
          category: 'Hard Skills | Soft Skills | Tools / Technologies',
        },
      ],
      additionalNotes: 'string',
    },
    extractorSchema: z.object({
      skills: z
        .array(
          z.object({
            name: z.string(),
            proficiency: z.string().optional(),
            category: z.string().optional(),
          })
        )
        .optional(),
      additionalNotes: z.string().optional(),
    }),
  },
  languages: {
    label: 'Languages',
    description: 'Collect one or more languages and proficiency.',
    schemaDescription: {
      languages: [
        {
          name: 'string',
          proficiency: 'Beginner | Elementary | Intermediate | Advanced | Fluent / Native',
          speak: 'boolean',
          read: 'boolean',
          write: 'boolean',
        },
      ],
    },
    extractorSchema: z.object({
      languages: z
        .array(
          z.object({
            name: z.string(),
            proficiency: z.string().optional(),
            speak: z.boolean().optional(),
            read: z.boolean().optional(),
            write: z.boolean().optional(),
          })
        )
        .optional(),
    }),
  },
  projects: {
    label: 'Projects',
    description: 'Collect details for one meaningful project.',
    schemaDescription: {
      projectTitle: 'string',
      projectType: 'string',
      organizationClient: 'string',
      currentlyWorking: 'boolean',
      startDate: 'YYYY-MM-DD',
      endDate: 'YYYY-MM-DD',
      projectDescription: 'string',
      responsibilities: 'string',
      technologies: ['string'],
      projectOutcome: 'string',
      projectLink: 'string',
    },
    extractorSchema: z.object({
      projectTitle: z.string().optional(),
      projectType: z.string().optional(),
      organizationClient: z.string().optional(),
      currentlyWorking: z.boolean().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      projectDescription: z.string().optional(),
      responsibilities: z.string().optional(),
      technologies: z.array(z.string()).optional(),
      projectOutcome: z.string().optional(),
      projectLink: z.string().optional(),
    }),
  },
  portfolioLinks: {
    label: 'Portfolio Links',
    description: 'Collect at least one portfolio or professional profile link.',
    schemaDescription: {
      links: [
        {
          id: 'string',
          linkType: 'string',
          url: 'string',
          title: 'string',
          description: 'string',
        },
      ],
    },
    extractorSchema: z.object({
      links: z
        .array(
          z.object({
            id: z.string().optional(),
            linkType: z.string().optional(),
            url: z.string(),
            title: z.string().optional(),
            description: z.string().optional(),
          })
        )
        .optional(),
    }),
  },
  careerPreferences: {
    label: 'Career Preferences',
    description: 'Collect preferred roles, work setup, compensation and availability.',
    schemaDescription: {
      preferredJobTitles: ['string'],
      preferredIndustry: 'string',
      functionalArea: 'string',
      jobTypes: ['string'],
      workModes: ['string'],
      preferredLocations: ['string'],
      relocationPreference: 'string',
      salaryCurrency: 'string',
      salaryAmount: 'string',
      salaryFrequency: 'Annually | Monthly | Hourly | Daily',
      availabilityToStart: 'string',
      noticePeriod: 'string',
    },
    extractorSchema: z.object({
      preferredJobTitles: z.array(z.string()).optional(),
      preferredIndustry: z.string().optional(),
      functionalArea: z.string().optional(),
      jobTypes: z.array(z.string()).optional(),
      workModes: z.array(z.string()).optional(),
      preferredLocations: z.array(z.string()).optional(),
      relocationPreference: z.string().optional(),
      salaryCurrency: z.string().optional(),
      salaryAmount: z.string().optional(),
      salaryFrequency: z.string().optional(),
      availabilityToStart: z.string().optional(),
      noticePeriod: z.string().optional(),
    }),
  },
  visaWorkAuthorization: {
    label: 'Visa & Work Authorization',
    description: 'Collect the countries, visa sponsorship need, and any visa status details.',
    schemaDescription: {
      selectedDestination: 'string',
      visaWorkpermitRequired: 'string',
      openForAll: 'boolean',
      additionalRemarks: 'string',
      visaDetailsExpected: {
        id: 'string',
        visaType: 'string',
        visaStatus: 'string',
        itemFamilyNumber: 'string',
        visaExpiryDate: 'YYYY-MM-DD',
        documents: [],
      },
      visaEntries: [
        {
          id: 'string',
          country: 'string',
          countryName: 'string',
          visaDetails: {
            id: 'string',
            visaType: 'string',
            visaStatus: 'string',
            itemFamilyNumber: 'string',
            visaExpiryDate: 'YYYY-MM-DD',
            documents: [],
          },
        },
      ],
    },
    extractorSchema: z.object({
      selectedDestination: z.string().optional(),
      visaWorkpermitRequired: z.string().optional(),
      openForAll: z.boolean().optional(),
      additionalRemarks: z.string().optional(),
      visaDetailsExpected: z
        .object({
          id: z.string().optional(),
          visaType: z.string().optional(),
          visaStatus: z.string().optional(),
          itemFamilyNumber: z.string().optional(),
          visaExpiryDate: z.string().optional(),
          documents: z.array(z.any()).optional(),
        })
        .optional(),
      visaEntries: z
        .array(
          z.object({
            id: z.string().optional(),
            country: z.string().optional(),
            countryName: z.string().optional(),
            visaDetails: z
              .object({
                id: z.string().optional(),
                visaType: z.string().optional(),
                visaStatus: z.string().optional(),
                itemFamilyNumber: z.string().optional(),
                visaExpiryDate: z.string().optional(),
                documents: z.array(z.any()).optional(),
              })
              .optional(),
          })
        )
        .optional(),
    }),
  },
  vaccination: {
    label: 'Vaccination',
    description: 'Collect whether the candidate is vaccinated and any available details.',
    schemaDescription: {
      vaccinationStatus: 'Yes | No',
      vaccineType: 'string',
      lastVaccinationDate: 'YYYY-MM-DD',
    },
    extractorSchema: z.object({
      vaccinationStatus: z.string().optional(),
      vaccineType: z.string().optional(),
      lastVaccinationDate: z.string().optional(),
    }),
  },
  resume: {
    label: 'Resume',
    description: 'The resume section requires a file upload rather than text extraction.',
    schemaDescription: {
      uploadRequired: true,
    },
    extractorSchema: z.object({
      uploadRequired: z.literal(true).optional(),
      note: z.string().optional(),
    }),
  },
};

function getMistralClient() {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    const error = new Error('MISTRAL_API_KEY is not configured');
    error.statusCode = 500;
    throw error;
  }

  return new Mistral({ apiKey });
}

async function runMistralChat(messages, options = {}) {
  const client = getMistralClient();
  const response = await client.chat.complete({
    model: options.model || 'mistral-small-latest',
    messages,
    temperature: options.temperature ?? 0.3,
    maxTokens: options.maxTokens ?? 500,
  });

  return response?.choices?.[0]?.message?.content?.trim() || '';
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error('OPENAI_API_KEY is not configured');
    error.statusCode = 500;
    throw error;
  }

  return new OpenAI({ apiKey });
}

async function runOpenAIChat(messages, options = {}) {
  const client = getOpenAIClient();
  const completion = await client.chat.completions.create({
    model: options.model || 'gpt-4o-mini',
    messages,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 500,
  });

  return completion?.choices?.[0]?.message?.content?.trim() || '';
}

function normalizeHistory(history = []) {
  if (!Array.isArray(history)) return [];

  return history
    .filter((message) => message && typeof message.content === 'string' && typeof message.role === 'string')
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content,
    }));
}

function stripCodeFences(text = '') {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function extractJson(text = '') {
  const cleaned = stripCodeFences(text);
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI did not return valid JSON');
  }

  return JSON.parse(cleaned.slice(start, end + 1));
}

function applyDefaults(sectionKey, parsed) {
  switch (sectionKey) {
    case 'skills':
      return {
        skills: (parsed.skills || []).map((skill) => ({
          name: skill.name,
          proficiency: skill.proficiency || 'Intermediate',
          category: skill.category || 'Hard Skills',
        })),
        additionalNotes: parsed.additionalNotes || '',
      };
    case 'languages':
      return {
        languages: (parsed.languages || []).map((language) => ({
          name: language.name,
          proficiency: language.proficiency || 'Intermediate',
          speak: language.speak ?? true,
          read: language.read ?? true,
          write: language.write ?? true,
        })),
      };
    case 'portfolioLinks':
      return {
        links: (parsed.links || []).map((link, index) => ({
          id: link.id || `link-${Date.now()}-${index}`,
          linkType: link.linkType || 'Other',
          url: link.url,
          title: link.title || '',
          description: link.description || '',
        })),
      };
    case 'vaccination':
      return {
        vaccinationStatus:
          parsed.vaccinationStatus ||
          (parsed.vaccineType || parsed.lastVaccinationDate ? 'Yes' : 'No'),
        vaccineType: parsed.vaccineType,
        lastVaccinationDate: parsed.lastVaccinationDate,
      };
    case 'resume':
      return {
        uploadRequired: true,
        note: parsed.note || 'Resume upload is required.',
      };
    default:
      return parsed;
  }
}

function getFallbackQuestion(sectionKey, missingFields = []) {
  const label = sectionConfig[sectionKey]?.label || 'Profile';
  const suffix =
    missingFields.length > 0 ? ` Missing fields: ${missingFields.join(', ')}.` : '';

  const defaults = {
    basicInformation:
      'Let’s complete your basic information. What is your first name, last name, and best email address?',
    summary:
      'Please share a short professional summary about your background, strengths, and the kind of work you do.',
    education:
      'Tell me about your education. What did you study, where, and when did you start and finish?',
    skills:
      'What are your key professional skills? You can list them with levels like beginner, intermediate, or advanced.',
    languages:
      'Which languages do you know, and how comfortable are you with each one?',
    projects:
      'Tell me about one important project you worked on, including what it was, what you did, and which technologies you used.',
    portfolioLinks:
      'Do you have any portfolio, GitHub, LinkedIn, or personal website links to add?',
    careerPreferences:
      'What kinds of roles are you looking for, where would you like to work, and when could you start?',
    visaWorkAuthorization:
      'Which countries are you authorized to work in, and do you need visa sponsorship anywhere?',
    vaccination:
      'Are you vaccinated? If yes, which vaccine did you take and when was your last dose?',
    resume:
      'Please upload your latest resume to complete this section.',
  };

  return `${defaults[sectionKey] || `Let’s complete your ${label.toLowerCase()} section.`}${suffix}`;
}

async function askProfileQuestions(req, res) {
  try {
    const { currentSection, missingFields = [], conversationHistory = [], userMessage = '' } = req.body || {};

    if (!currentSection || !sectionConfig[currentSection]) {
      return res.status(400).json({
        success: false,
        message: 'A valid currentSection is required',
      });
    }

    const section = sectionConfig[currentSection];
    const systemPrompt = [
      'You are a helpful profile assistant.',
      'Your goal is to help the user complete their professional profile.',
      'Ask one brief, friendly, professional question at a time.',
      'If the user has just answered, acknowledge them warmly in one short sentence and then ask the next question for the current section.',
      `Current section: ${section.label}.`,
      `Section goal: ${section.description}`,
      `Missing fields for this section: ${Array.isArray(missingFields) && missingFields.length > 0 ? missingFields.join(', ') : 'unknown'}.`,
      'Do not ask multiple unrelated questions at once.',
      'Do not output JSON.',
    ].join(' ');

    const messages = [{ role: 'system', content: systemPrompt }, ...normalizeHistory(conversationHistory)];

    if (userMessage && !messages.some((message, index) => index === messages.length - 1 && message.role === 'user' && message.content === userMessage)) {
      messages.push({ role: 'user', content: userMessage });
    }

    let message = '';
    try {
      // OpenAI first (primary)
      if (process.env.OPENAI_API_KEY) {
        try {
          message = await runOpenAIChat(messages, {
            model: 'gpt-4o-mini',
            temperature: 0.5,
            maxTokens: 220,
          });
        } catch (openaiError) {
          console.error(
            'OpenAI question generation failed:',
            openaiError.message || openaiError,
          );
        }
      }

      // Fallback to Mistral (if OpenAI missing/failed)
      if (!message) {
        message = await runMistralChat(messages, {
          model: 'mistral-small-latest',
          temperature: 0.5,
          maxTokens: 220,
        });
      }
    } catch (error) {
      console.error('AI question generation failed:', error.message || error);
      message = getFallbackQuestion(currentSection, missingFields);
    }

    res.json({
      success: true,
      data: {
        section: currentSection,
        message: message || getFallbackQuestion(currentSection, missingFields),
      },
    });
  } catch (error) {
    console.error('Error generating profile question:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to generate profile question',
    });
  }
}

async function suggestJobTitles(req, res) {
  try {
    const { query = '', selectedTitles = [] } = req.body || {};
    const normalizedQuery = String(query || '').trim();

    if (!normalizedQuery) {
      return res.status(400).json({
        success: false,
        message: 'query is required',
      });
    }

    const selectedSet = new Set(
      Array.isArray(selectedTitles)
        ? selectedTitles
            .filter((title) => typeof title === 'string')
            .map((title) => title.trim().toLowerCase())
        : []
    );

    const systemPrompt = [
      'You are a career assistant that suggests relevant professional job titles.',
      'Given a user query, return only JSON.',
      'The JSON must have this exact shape: {"suggestions":["Job Title 1","Job Title 2"]}.',
      'Return 6 concise, realistic, industry-relevant job titles.',
      'Suggestions should match the user intent even if the query is broad, partial, misspelled, or informal.',
      'Do not include numbering, explanations, markdown, duplicate titles, or company names.',
    ].join(' ');

    const userPrompt = [
      `User query: ${normalizedQuery}`,
      `Already selected titles: ${Array.isArray(selectedTitles) ? selectedTitles.join(', ') : 'None'}`,
      'Return relevant alternative or closely matching job titles.',
    ].join('\n');

    const responseText = await runOpenAIChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        model: 'gpt-4o-mini',
        temperature: 0.4,
        maxTokens: 220,
      }
    );

    const parsed = extractJson(responseText);
    const rawSuggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];

    const suggestions = Array.from(
      new Set(
        rawSuggestions
          .filter((title) => typeof title === 'string')
          .map((title) => title.trim())
          .filter(Boolean)
      )
    )
      .filter((title) => !selectedSet.has(title.toLowerCase()))
      .slice(0, 6);

    return res.json({
      success: true,
      data: {
        suggestions,
      },
    });
  } catch (error) {
    console.error('Error suggesting job titles:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to suggest job titles',
    });
  }
}

async function extractProfileData(req, res) {
  try {
    const { currentSection, userMessage = '' } = req.body || {};

    if (!currentSection || !sectionConfig[currentSection]) {
      return res.status(400).json({
        success: false,
        message: 'A valid currentSection is required',
      });
    }

    if (!userMessage.trim()) {
      return res.status(400).json({
        success: false,
        message: 'userMessage is required',
      });
    }

    const section = sectionConfig[currentSection];

    if (currentSection === 'resume') {
      return res.json({
        success: true,
        data: {
          section: currentSection,
          data: { uploadRequired: true, note: 'Resume upload is required.' },
        },
      });
    }

    const systemPrompt = [
      'You extract structured profile data from a user message.',
      `Current section: ${section.label}.`,
      `Section description: ${section.description}.`,
      'Return only a valid JSON object and no extra text.',
      'Use these target fields exactly:',
      JSON.stringify(section.schemaDescription),
      'If a value is not present, omit it instead of guessing.',
      'Normalize dates to YYYY-MM-DD when possible.',
      'For arrays, return arrays.',
      'Do not include markdown fences.',
    ].join('\n');

    let responseText = '';
    let lastError = null;

    // OpenAI first
    if (process.env.OPENAI_API_KEY) {
      try {
        responseText = await runOpenAIChat(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          {
            model: 'gpt-4o-mini',
            temperature: 0.1,
            maxTokens: 700,
          },
        );
      } catch (openaiError) {
        console.error(
          'OpenAI profile extraction failed:',
          openaiError.message || openaiError,
        );
        lastError = openaiError;
      }
    }

    // Fallback to Mistral
    if (!responseText) {
      try {
        responseText = await runMistralChat(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          {
            model: 'mistral-small-latest',
            temperature: 0.1,
            maxTokens: 700,
          }
        );
      } catch (mistralError) {
        console.error(
          'Mistral profile extraction failed:',
          mistralError.message || mistralError,
        );
        lastError = mistralError;
      }
    }

    if (!responseText) {
      throw (
        lastError ||
        new Error('No AI service configured (need OPENAI_API_KEY or MISTRAL_API_KEY)')
      );
    }

    const parsed = extractJson(responseText);
    const validated = section.extractorSchema.parse(parsed);
    const data = applyDefaults(currentSection, validated);

    res.json({
      success: true,
      data: {
        section: currentSection,
        data,
      },
    });
  } catch (error) {
    console.error('Error extracting profile data:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to extract profile data',
    });
  }
}

async function generalChat(req, res) {
  try {
    const { message, candidateId, history = [] } = req.body || {};

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }

    const systemPrompt = [
      'You are a helpful and professional career assistant for SAASA B2E, an AI-powered recruitment platform.',
      'Your goal is to help candidates with their career journey, job search, and profile optimization.',
      'Be encouraging, providing actionable advice and clear answers.',
      'If the user asks about jobs, you can mention that SAASA uses AI to match them with the best opportunities.',
      'Keep your responses concise and professional.',
    ].join(' ');

    const messages = [
      { role: 'system', content: systemPrompt },
      ...normalizeHistory(history),
      { role: 'user', content: message }
    ];

    let response = '';
    if (process.env.OPENAI_API_KEY) {
      response = await runOpenAIChat(messages, {
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 500,
      });
    } else if (process.env.MISTRAL_API_KEY) {
      response = await runMistralChat(messages, {
        model: 'mistral-small-latest',
        temperature: 0.7,
        maxTokens: 500,
      });
    }

    if (!response) {
      return res.status(500).json({
        success: false,
        message: 'AI service unavailable',
      });
    }

    res.json({
      success: true,
      data: {
        message: response,
      },
    });
  } catch (error) {
    console.error('Error in general chat:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process chat message',
    });
  }
}

module.exports = {
  askProfileQuestions,
  suggestJobTitles,
  extractProfileData,
  generalChat,
};
