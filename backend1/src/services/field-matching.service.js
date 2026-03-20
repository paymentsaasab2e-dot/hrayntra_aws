const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Mistral } = require('@mistralai/mistralai');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// Load modal fields structure
const modalFieldsPath = path.join(__dirname, '../../../PROFILE_MODALS_FIELDS.json');
let modalFieldsStructure = null;

try {
  const modalFieldsContent = fs.readFileSync(modalFieldsPath, 'utf8');
  modalFieldsStructure = JSON.parse(modalFieldsContent);
} catch (error) {
  console.error('Error loading modal fields structure:', error);
}

/**
 * AI-assisted field matching service
 * Maps database fields to modal fields using semantic matching
 * Uses multi-AI fallback system (Mistral -> Gemini -> Anthropic -> OpenAI)
 */
class FieldMatchingService {
  constructor() {
    // Initialize all AI clients
    const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    this.mistral = MISTRAL_API_KEY ? new Mistral({ apiKey: MISTRAL_API_KEY }) : null;
    this.genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
    this.anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;
    this.openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

    console.log('✅ Field Matching Service initialized with multi-AI fallback system');
  }

  /**
   * Normalize field names for comparison
   */
  normalizeFieldName(fieldName) {
    if (!fieldName) return '';
    return fieldName
      .toLowerCase()
      .replace(/[_\s-]/g, '')
      .replace(/number|num|no/i, '')
      .replace(/code/i, '');
  }

  /**
   * Simple semantic matching without AI (fallback)
   */
  simpleMatch(dbField, modalField) {
    const dbNormalized = this.normalizeFieldName(dbField);
    const modalNormalized = this.normalizeFieldName(modalField);

    // Direct match
    if (dbNormalized === modalNormalized) return 1.0;

    // Common field mappings
    const fieldMappings = {
      // Personal Info
      'fullname': ['firstname', 'lastname', 'name'],
      'firstname': ['fullname'],
      'lastname': ['fullname'],
      'phonenumber': ['phone', 'telephone'],
      'phone': ['phonenumber', 'telephone'],
      'alternatephone': ['alternatephonenumber', 'secondaryphone'],
      'dateofbirth': ['dob', 'birthdate'],
      'dob': ['dateofbirth', 'birthdate'],
      'employmentstatus': ['employment', 'employstatus'],
      'employment': ['employmentstatus', 'employstatus'],
      'linkedinurl': ['linkedin', 'linkedinprofile'],
      'linkedin': ['linkedinurl', 'linkedinprofile'],
      
      // Education
      'educationlevel': ['degree', 'degreeprogram'],
      'degree': ['educationlevel', 'degreeprogram'],
      'institutionname': ['institution', 'school', 'university', 'college'],
      'institution': ['institutionname', 'school', 'university', 'college'],
      'fieldofstudy': ['specialization', 'major', 'field'],
      'specialization': ['fieldofstudy', 'major', 'field'],
      'startyear': ['startdate', 'fromyear'],
      'endyear': ['enddate', 'toyear', 'graduationyear'],
      'currentlystudying': ['isongoing', 'ongoing'],
      'isongoing': ['currentlystudying', 'ongoing'],
      
      // Work Experience
      'jobtitle': ['position', 'role', 'title'],
      'companyname': ['company', 'employer', 'organization'],
      'company': ['companyname', 'employer', 'organization'],
      'employmenttype': ['jobtype', 'worktype'],
      'worklocation': ['location', 'workplace'],
      'location': ['worklocation', 'workplace'],
      'workmode': ['worktype', 'remotestatus'],
      'startdate': ['startyear', 'fromdate'],
      'enddate': ['endyear', 'todate'],
      'currentlyworkhere': ['iscurrentjob', 'currentjob'],
      'iscurrentjob': ['currentlyworkhere', 'currentjob'],
      'keyresponsibilities': ['responsibilities', 'duties', 'jobdescription'],
      'responsibilities': ['keyresponsibilities', 'duties', 'jobdescription'],
      
      // Skills
      'skillname': ['name', 'skill'],
      'proficiency': ['level', 'skilllevel'],
      
      // Languages
      'languagename': ['name', 'language'],
      'canspeak': ['speak'],
      'canread': ['read'],
      'canwrite': ['write'],
    };

    // Check if fields are related
    const dbKey = dbNormalized;
    const modalKey = modalNormalized;

    if (fieldMappings[dbKey] && fieldMappings[dbKey].includes(modalKey)) {
      return 0.9;
    }
    if (fieldMappings[modalKey] && fieldMappings[modalKey].includes(dbKey)) {
      return 0.9;
    }

    // Partial match
    if (dbNormalized.includes(modalNormalized) || modalNormalized.includes(dbNormalized)) {
      return 0.7;
    }

    return 0.0;
  }

  /**
   * AI-powered semantic matching with multi-AI fallback
   * Tries: Mistral -> Gemini -> Anthropic -> OpenAI -> Simple matching
   */
  async aiMatch(dbFields, modalFields) {
    if (!modalFieldsStructure) {
      // Fallback to simple matching
      return this.simpleMatchFields(dbFields, modalFields);
    }

    const prompt = `You are a field matching assistant. Your task is to match database fields to modal form fields based on semantic similarity.

Database Fields (with sample values):
${JSON.stringify(dbFields, null, 2)}

Modal Fields (structure):
${JSON.stringify(modalFields, null, 2)}

Rules:
1. Match fields based on semantic meaning, not just exact name matches
2. Handle variations (e.g., "phoneNumber" matches "phone", "fullName" can map to "firstName" + "lastName")
3. Return ONLY a valid JSON object with mappings
4. Format: { "modalFieldName": "dbFieldName" } or { "modalFieldName": { "source": "dbFieldName", "transform": "function" } }
5. For array fields, map each item in the array
6. If no match found, omit that field

Return ONLY the JSON mapping, no explanations:`;

    let responseText = null;
    let error = null;

    // Try Mistral AI first
    if (this.mistral) {
      try {
        console.log('  📤 Trying Mistral AI for field matching...');
        const response = await this.mistral.chat.complete({
          model: 'mistral-large-latest',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          maxTokens: 4096,
        });
        responseText = response.choices[0]?.message?.content?.trim() || '';
        if (responseText) {
          console.log('  ✅ Successfully used Mistral AI for field matching');
          return this.parseAIResponse(responseText);
        }
      } catch (mistralError) {
        console.log('  ⚠️  Mistral failed, trying fallback...');
        error = mistralError;
      }
    }

    // Fallback to Google Gemini
    if (!responseText && this.genAI) {
      try {
        console.log('  📤 Trying Google Gemini for field matching...');
        // Try different Gemini models in order
        const geminiModels = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
        
        for (const modelName of geminiModels) {
          try {
            const model = this.genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            responseText = response.text().trim();
            if (responseText) {
              console.log(`  ✅ Successfully used Google Gemini (${modelName}) for field matching`);
              return this.parseAIResponse(responseText);
            }
          } catch (geminiError) {
            // If 404, try next model
            if (geminiError.status === 404 || geminiError.message?.includes('404')) {
              continue;
            }
            throw geminiError;
          }
        }
      } catch (geminiError) {
        console.log('  ⚠️  Gemini failed, trying fallback...');
        error = geminiError;
      }
    }

    // Fallback to Anthropic Claude
    if (!responseText && this.anthropic) {
      try {
        console.log('  📤 Trying Anthropic Claude for field matching...');
        const message = await this.anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          temperature: 0.3,
          messages: [{ role: 'user', content: prompt }],
        });
        responseText = message.content[0]?.text?.trim() || '';
        if (responseText) {
          console.log('  ✅ Successfully used Anthropic Claude for field matching');
          return this.parseAIResponse(responseText);
        }
      } catch (anthropicError) {
        console.log('  ⚠️  Anthropic failed, trying fallback...');
        error = anthropicError;
      }
    }

    // Fallback to OpenAI
    if (!responseText && this.openai) {
      try {
        console.log('  📤 Trying OpenAI for field matching...');
        const completion = await this.openai.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: 'gpt-4o-mini',
          temperature: 0.3,
          max_tokens: 4096,
        });
        responseText = completion.choices[0]?.message?.content?.trim() || '';
        if (responseText) {
          console.log('  ✅ Successfully used OpenAI for field matching');
          return this.parseAIResponse(responseText);
        }
      } catch (openaiError) {
        console.log('  ⚠️  OpenAI failed, falling back to simple matching...');
        error = openaiError;
      }
    }

    // Final fallback to simple matching
    console.log('⚠️  All AI services failed, falling back to simple rule-based matching');
    return this.simpleMatchFields(dbFields, modalFields);
  }

  /**
   * Parse AI response and extract JSON mappings
   */
  parseAIResponse(responseText) {
    try {
      // Clean JSON response (remove markdown code blocks if present)
      let jsonText = responseText.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }

      const mappings = JSON.parse(jsonText);
      return mappings;
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      throw parseError;
    }
  }

  /**
   * Simple field matching (fallback)
   */
  simpleMatchFields(dbFields, modalFields) {
    const mappings = {};

    for (const modalField of modalFields) {
      let bestMatch = null;
      let bestScore = 0;

      for (const dbField in dbFields) {
        const score = this.simpleMatch(dbField, modalField.fieldName);
        if (score > bestScore && score > 0.5) {
          bestScore = score;
          bestMatch = dbField;
        }
      }

      if (bestMatch) {
        mappings[modalField.fieldName] = bestMatch;
      }
    }

    return mappings;
  }

  /**
   * Map database data to modal format
   */
  mapDataToModal(dbData, modalFields, mappings) {
    const mappedData = {};

    for (const modalField of modalFields) {
      const dbFieldName = mappings[modalField.fieldName];
      
      if (dbFieldName && dbData[dbFieldName] !== undefined && dbData[dbFieldName] !== null) {
        let value = dbData[dbFieldName];

        // Handle special transformations
        if (modalField.fieldName === 'firstName' && dbFieldName === 'fullName') {
          // Split fullName into firstName and lastName
          const nameParts = value.trim().split(/\s+/);
          mappedData.firstName = nameParts[0] || '';
          mappedData.lastName = nameParts.slice(1).join(' ') || '';
          continue;
        }

        if (modalField.fieldName === 'lastName' && dbFieldName === 'fullName') {
          // Already handled in firstName
          continue;
        }

        // Handle date transformations
        if (modalField.type === 'string' && value instanceof Date) {
          value = value.toISOString().split('T')[0];
        }

        // Handle enum to string conversions
        if (typeof value === 'object' && value.constructor.name === 'Object') {
          value = String(value);
        }

        mappedData[modalField.fieldName] = value;
      }
    }

    return mappedData;
  }

  /**
   * Match and map all profile data to modal structures
   */
  async matchProfileDataToModals(dbProfileData) {
    const matchedData = {};

    // Match Basic Information
    if (dbProfileData.profile && modalFieldsStructure?.profileModals?.PERSONAL_DETAILS?.BasicInformation) {
      const modalFields = modalFieldsStructure.profileModals.PERSONAL_DETAILS.BasicInformation.fields;
      const dbFields = dbProfileData.profile;
      
      // Convert DB object to flat structure for matching
      const flatDbFields = {};
      for (const key in dbFields) {
        if (dbFields[key] !== null && dbFields[key] !== undefined) {
          flatDbFields[key] = dbFields[key];
        }
      }

      const mappings = await this.aiMatch(flatDbFields, modalFields);
      matchedData.basicInfo = this.mapDataToModal(dbFields, modalFields, mappings);

      // Handle fullName -> firstName/lastName split
      if (dbFields.fullName && !matchedData.basicInfo.firstName) {
        const nameParts = dbFields.fullName.trim().split(/\s+/);
        matchedData.basicInfo.firstName = nameParts[0] || '';
        matchedData.basicInfo.lastName = nameParts.slice(1).join(' ') || '';
      }

      // Handle phone number and code
      if (dbFields.phoneNumber && !matchedData.basicInfo.phone) {
        matchedData.basicInfo.phone = dbFields.phoneNumber;
      }
      if (dbFields.alternatePhone && !matchedData.basicInfo.phoneCode) {
        // Extract country code if available
        matchedData.basicInfo.phoneCode = '+1 (USA)'; // Default, can be enhanced
      }

      // Handle date of birth
      if (dbFields.dateOfBirth) {
        const dob = new Date(dbFields.dateOfBirth);
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
        const day = dob.getDate();
        const suffix = day === 1 || day === 21 || day === 31 ? 'st' : 
                      day === 2 || day === 22 ? 'nd' : 
                      day === 3 || day === 23 ? 'rd' : 'th';
        matchedData.basicInfo.dob = `${months[dob.getMonth()]} ${day}${suffix}, ${dob.getFullYear()}`;
      }

      // Handle gender enum
      if (dbFields.gender) {
        matchedData.basicInfo.gender = dbFields.gender.charAt(0) + dbFields.gender.slice(1).toLowerCase();
      }

      // Handle employment status
      if (dbFields.employmentStatus) {
        matchedData.basicInfo.employment = dbFields.employmentStatus.charAt(0) + dbFields.employmentStatus.slice(1).toLowerCase();
      }
    }

    // Match Education
    if (dbProfileData.educations && Array.isArray(dbProfileData.educations) && 
        modalFieldsStructure?.profileModals?.EDUCATION?.Education) {
      const modalFields = modalFieldsStructure.profileModals.EDUCATION.Education.fields;
      matchedData.education = dbProfileData.educations.map((edu) => {
        const flatDbFields = {};
        for (const key in edu) {
          if (edu[key] !== null && edu[key] !== undefined) {
            flatDbFields[key] = edu[key];
          }
        }

        const mappings = this.simpleMatchFields(flatDbFields, modalFields);
        const mapped = this.mapDataToModal(edu, modalFields, mappings);

        // Handle specific field mappings
        mapped.educationLevel = edu.degree || '';
        mapped.degreeProgram = edu.degree || '';
        mapped.institutionName = edu.institution || '';
        mapped.fieldOfStudy = edu.specialization || '';
        mapped.startYear = edu.startYear?.toString() || '';
        mapped.endYear = edu.endYear?.toString() || '';
        mapped.currentlyStudying = edu.isOngoing || false;
        mapped.grade = edu.grade || '';

        return mapped;
      });
    }

    // Match Work Experience
    if (dbProfileData.workExperiences && Array.isArray(dbProfileData.workExperiences) &&
        modalFieldsStructure?.profileModals?.WORK_HISTORY?.WorkExperience) {
      const entryFields = modalFieldsStructure.profileModals.WORK_HISTORY.WorkExperience.fields[0].itemFields;
      matchedData.workExperience = {
        workExperiences: dbProfileData.workExperiences.map((exp) => {
          const mapped = {
            id: exp.id,
            jobTitle: exp.jobTitle || '',
            companyName: exp.company || '',
            employmentType: '', // Not in DB schema
            industryDomain: exp.industry || '',
            numberOfReportees: '', // Not in DB schema
            startDate: exp.startDate ? new Date(exp.startDate).toISOString().split('T')[0] : '',
            endDate: exp.endDate ? new Date(exp.endDate).toISOString().split('T')[0] : '',
            currentlyWorkHere: exp.isCurrentJob || false,
            workLocation: exp.workLocation || '',
            workMode: exp.workMode || '',
            companyProfile: '', // Not in DB schema
            companyTurnover: '', // Not in DB schema
            keyResponsibilities: exp.responsibilities || '',
            achievements: '', // Not in DB schema
            workSkills: [], // Not directly in DB schema
          };
          return mapped;
        }),
      };
    }

    // Match Skills
    if (dbProfileData.skills && Array.isArray(dbProfileData.skills) &&
        modalFieldsStructure?.profileModals?.SKILLS?.Skills) {
      matchedData.skills = {
        skills: dbProfileData.skills.map((cs) => {
          const proficiencyMap = {
            'BEGINNER': 'Beginner',
            'INTERMEDIATE': 'Intermediate',
            'ADVANCED': 'Advanced',
            'NATIVE': 'Advanced',
          };

          return {
            name: cs.skill?.name || '',
            proficiency: proficiencyMap[cs.proficiency] || 'Intermediate',
            category: cs.skill?.category || 'Hard Skills',
          };
        }),
        additionalNotes: '',
      };
    }

    // Match Languages
    if (dbProfileData.languages && Array.isArray(dbProfileData.languages) &&
        modalFieldsStructure?.profileModals?.SKILLS?.Languages) {
      matchedData.languages = {
        languages: dbProfileData.languages.map((lang) => {
          const proficiencyMap = {
            'BEGINNER': 'Beginner',
            'INTERMEDIATE': 'Intermediate',
            'ADVANCED': 'Advanced',
            'NATIVE': 'Fluent / Native',
          };

          return {
            name: lang.name || '',
            proficiency: proficiencyMap[lang.proficiency] || 'Intermediate',
            speak: lang.canSpeak || false,
            read: lang.canRead || false,
            write: lang.canWrite || false,
            certification: '', // Not in DB schema
          };
        }),
      };
    }

    // Match Summary (if available in profile)
    if (dbProfileData.profile) {
      // Summary might be stored elsewhere, for now leave empty
      matchedData.summary = '';
    }

    // Match Resume
    if (dbProfileData.resume) {
      matchedData.resume = {
        fileName: dbProfileData.resume.fileName || '',
        uploadedDate: dbProfileData.resume.uploadedAt ? new Date(dbProfileData.resume.uploadedAt).toISOString() : '',
      };
    }

    // Match Career Preferences
    if (dbProfileData.careerPreferences &&
        modalFieldsStructure?.profileModals?.PREFERENCES?.CareerPreferences) {
      const pref = dbProfileData.careerPreferences;
      matchedData.careerPreferences = {
        preferredJobTitles: pref.preferredRoles || [],
        preferredIndustry: '', // Not directly mapped
        functionalArea: '', // Not in DB schema
        jobTypes: [], // Not directly mapped
        workModes: pref.preferredWorkMode ? [pref.preferredWorkMode] : [],
        preferredLocations: pref.preferredLocations || [],
        relocationPreference: pref.openToRelocation ? 'Willing to relocate' : 'Not willing to relocate',
        salaryCurrency: pref.preferredCurrency || 'USD',
        salaryAmount: pref.preferredSalary?.toString() || '',
        salaryFrequency: pref.preferredSalaryType || '',
        availabilityToStart: '', // Not in DB schema
        noticePeriod: pref.noticePeriodDays?.toString() || '',
      };
    }

    return matchedData;
  }
}

module.exports = new FieldMatchingService();
