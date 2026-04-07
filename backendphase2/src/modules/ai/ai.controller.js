import OpenAI from 'openai';
import { sendResponse, sendError } from '../../utils/response.js';
import { env } from '../../config/env.js';
import { runAssistantChat } from './assistantChat.service.js';
import {
  deleteAssistantHistory,
  getAssistantHistory,
  upsertAssistantHistory,
} from './assistantHistory.service.js';

const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;
const jobDescriptionJsonSchema = {
  name: 'job_description_payload',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      jobType: { type: 'string' },
      minExperience: { type: 'integer' },
      maxExperience: { type: 'integer' },
      educationalQualification: { type: 'string' },
      educationalSpecialization: { type: 'string' },
      skills: {
        type: 'array',
        items: { type: 'string' },
      },
      screeningQuestions: {
        type: 'array',
        items: { type: 'string' },
      },
      html: { type: 'string' },
    },
    required: [
      'title',
      'jobType',
      'minExperience',
      'maxExperience',
      'educationalQualification',
      'educationalSpecialization',
      'skills',
      'screeningQuestions',
      'html',
    ],
  },
  strict: true,
};

const leadDetailsJsonSchema = {
  name: 'lead_details_payload',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      companyName: { type: 'string' },
      contactPerson: { type: 'string' },
      designation: { type: 'string' },
      email: { type: 'string' },
      phone: { type: 'string' },
      type: { type: 'string' },
      source: { type: 'string' },
      status: { type: 'string' },
      priority: { type: 'string' },
      interestedNeeds: { type: 'string' },
      notes: { type: 'string' },
      industry: { type: 'string' },
      companySize: { type: 'string' },
      website: { type: 'string' },
      linkedIn: { type: 'string' },
      location: { type: 'string' },
      country: { type: 'string' },
      city: { type: 'string' },
      campaignName: { type: 'string' },
      campaignLink: { type: 'string' },
      referralName: { type: 'string' },
      sourceWebsiteUrl: { type: 'string' },
      sourceLinkedInUrl: { type: 'string' },
      sourceEmail: { type: 'string' },
      otherDetails: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            label: { type: 'string' },
            value: { type: 'string' },
          },
          required: ['label', 'value'],
        },
      },
      lastFollowUp: { type: 'string' },
      nextFollowUp: { type: 'string' },
      assignedToId: { type: 'string' },
    },
    required: [
      'companyName',
      'contactPerson',
      'designation',
      'email',
      'phone',
      'type',
      'source',
      'status',
      'priority',
      'interestedNeeds',
      'notes',
      'industry',
      'companySize',
      'website',
      'linkedIn',
      'location',
      'country',
      'city',
      'campaignName',
      'campaignLink',
      'referralName',
      'sourceWebsiteUrl',
      'sourceLinkedInUrl',
      'sourceEmail',
      'otherDetails',
      'lastFollowUp',
      'nextFollowUp',
      'assignedToId',
    ],
  },
  strict: true,
};

export const aiController = {
  async assistantChat(req, res) {
    try {
      const { messages, pageKey, pathname } = req.body || {};
      const normalizedPageKey = String(pageKey || 'global').trim() || 'global';
      const existingHistory = await getAssistantHistory(req.user.id, normalizedPageKey);
      const result = await runAssistantChat(messages, req.user, {
        pageKey: normalizedPageKey,
        pathname: pathname || existingHistory.pathname || null,
        history: existingHistory,
      });

      const nextMessages = [
        ...(Array.isArray(messages) ? messages : []),
        { id: `assistant-${Date.now()}`, role: 'assistant', content: result.reply },
      ];

      const updatedHistory = await upsertAssistantHistory(req.user.id, normalizedPageKey, {
        pathname: pathname || existingHistory.pathname || null,
        messages: nextMessages,
        conversationMemory: {
          ...(existingHistory.conversationMemory || {}),
          ...(result.structured?.memory_update
            ? {
                userIntent: result.structured.memory_update.userIntent,
                lastActions: result.structured.memory_update.lastActions,
                currentPageContext: result.structured.memory_update.currentPageContext,
                userPreferences: result.structured.memory_update.userPreferences,
                frequentlyUsedActions: result.structured.memory_update.frequentlyUsedActions,
                updatedAt: new Date().toISOString(),
              }
            : {}),
        },
        taskMemory: result.structured?.memory_update?.taskMemory || existingHistory.taskMemory,
        actionLog: [
          ...((existingHistory.actionLog || []).slice(-20)),
          ...((result.structured?.memory_update?.actionLog || []).slice(-10)),
        ].slice(-30),
      });

      return sendResponse(res, 200, 'OK', {
        message: result.reply,
        structured: result.structured,
        history: updatedHistory,
      });
    } catch (error) {
      if (error.code === 'AI_NOT_CONFIGURED') {
        return sendError(res, 503, error.message);
      }
      if (error.code === 'VALIDATION') {
        return sendError(res, 400, error.message);
      }
      if (error.code === 'TOOL_LIMIT') {
        return sendError(res, 429, error.message);
      }
      console.error('[assistantChat]', error);
      return sendError(res, 500, error.message || 'Assistant request failed', error);
    }
  },

  async getAssistantHistory(req, res) {
    try {
      const result = await getAssistantHistory(req.user.id, req.params.pageKey);
      return sendResponse(res, 200, 'Assistant history loaded', result);
    } catch (error) {
      if (error.code === 'VALIDATION') {
        return sendError(res, 400, error.message);
      }
      console.error('[getAssistantHistory]', error);
      return sendError(res, 500, error.message || 'Failed to load assistant history', error);
    }
  },

  async saveAssistantHistory(req, res) {
    try {
      const result = await upsertAssistantHistory(req.user.id, req.params.pageKey, req.body || {});
      return sendResponse(res, 200, 'Assistant history saved', result);
    } catch (error) {
      if (error.code === 'VALIDATION') {
        return sendError(res, 400, error.message);
      }
      console.error('[saveAssistantHistory]', error);
      return sendError(res, 500, error.message || 'Failed to save assistant history', error);
    }
  },

  async deleteAssistantHistory(req, res) {
    try {
      const result = await deleteAssistantHistory(req.user.id, req.params.pageKey);
      return sendResponse(res, 200, 'Assistant history cleared', result);
    } catch (error) {
      if (error.code === 'VALIDATION') {
        return sendError(res, 400, error.message);
      }
      console.error('[deleteAssistantHistory]', error);
      return sendError(res, 500, error.message || 'Failed to clear assistant history', error);
    }
  },

  async generateJobDescription(req, res) {
    try {
      const {
        jobTitle,
        company,
        jobType,
        jobCategory,
        locationType,
        experience,
        skills,
        customPrompt,
      } = req.body || {};

      if (!jobTitle || !String(jobTitle).trim()) {
        return sendError(res, 400, 'Job title is required');
      }

      if (!openai) {
        return sendError(res, 503, 'AI job description generator is not configured');
      }

      const promptParts = [
        `Create a polished HTML job description for the role "${String(jobTitle).trim()}".`,
        company ? `Company: ${String(company).trim()}.` : null,
        jobType ? `Employment type: ${String(jobType).trim()}.` : null,
        jobCategory ? `Job category: ${String(jobCategory).trim()}.` : null,
        locationType ? `Workplace type: ${String(locationType).trim()}.` : null,
        experience ? `Experience expectation: ${String(experience).trim()}.` : null,
        Array.isArray(skills) && skills.length
          ? `Important skills: ${skills.filter(Boolean).join(', ')}.`
          : null,
        customPrompt ? `Additional instructions: ${String(customPrompt).trim()}.` : null,
        'Return only HTML, no markdown fences.',
        'Use a concise intro paragraph followed by sections titled Overview, Key Responsibilities, Requirements, Preferred Qualifications, and Benefits.',
        'Use semantic tags like h3, p, ul, and li.',
        'Also return normalized structured data for title, jobType, minExperience, maxExperience, educationalQualification, educationalSpecialization, 5-10 core skills, and 3-5 screening questions for the job application form.',
        'Job type must be one of: Full Time, Part Time, Contract, Internship.',
        'Educational qualification should be one of: Bachelor of Engineering, Master of Engineering, Bachelor of Science, Master of Science, MBA, Diploma.',
      ]
        .filter(Boolean)
        .join(' ');

      const completion = await openai.chat.completions.create({
        model: env.OPENAI_ASSISTANT_MODEL || 'gpt-4o-mini',
        temperature: 0.4,
        max_tokens: 1800,
        response_format: {
          type: 'json_schema',
          json_schema: jobDescriptionJsonSchema,
        },
        messages: [
          {
            role: 'system',
            content:
              'You write professional, realistic recruitment copy for ATS software. Keep the output practical, skimmable, and ready to paste into a job description editor. Always return valid JSON matching the schema.',
          },
          {
            role: 'user',
            content: promptParts,
          },
        ],
      });

      const raw = completion.choices?.[0]?.message?.content?.trim();
      const parsed = raw ? JSON.parse(raw) : null;
      const html = parsed?.html?.trim();

      if (!html) {
        return sendError(res, 500, 'AI returned an empty job description');
      }

      return sendResponse(res, 200, 'Job description generated successfully', {
        title: parsed?.title || String(jobTitle).trim(),
        jobType: parsed?.jobType || jobType || 'Full Time',
        minExperience: Number.isFinite(parsed?.minExperience) ? parsed.minExperience : 0,
        maxExperience: Number.isFinite(parsed?.maxExperience) ? parsed.maxExperience : 0,
        educationalQualification: parsed?.educationalQualification || '',
        educationalSpecialization: parsed?.educationalSpecialization || '',
        skills: Array.isArray(parsed?.skills) ? parsed.skills.filter(Boolean) : [],
        screeningQuestions: Array.isArray(parsed?.screeningQuestions)
          ? parsed.screeningQuestions.filter(Boolean)
          : [],
        html,
      });
    } catch (error) {
      console.error('[generateJobDescription]', error);
      sendError(res, 500, error.message, error);
    }
  },

  async generateLeadDetails(req, res) {
    try {
      const { prompt, currentForm } = req.body || {};

      if (!String(prompt || '').trim() && !currentForm) {
        return sendError(res, 400, 'Lead prompt is required');
      }

      if (!openai) {
        return sendError(res, 503, 'AI lead generator is not configured');
      }

      const completion = await openai.chat.completions.create({
        model: env.OPENAI_ASSISTANT_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 1600,
        response_format: {
          type: 'json_schema',
          json_schema: leadDetailsJsonSchema,
        },
        messages: [
          {
            role: 'system',
            content:
              'You are an ATS lead creation assistant. Analyze all user-provided lead information and optimize it into a clean structured lead payload for a recruitment CRM. Do not ask follow-up questions. Infer sensible defaults when data is missing. Keep required business fields populated with realistic values. Allowed enums: type => Company|Individual|Referral. source => Website|LinkedIn|Email|Referral|Campaign. status => New|Contacted|Qualified|Converted|Lost. priority => High|Medium|Low. Dates must be YYYY-MM-DD or empty string. If a field is unknown, return empty string. Preserve any assignedToId passed from the form unless the prompt clearly overrides it.',
          },
          {
            role: 'user',
            content: [
              'Optimize this lead for our Add Lead drawer and return only valid JSON matching the schema.',
              `User input:\n${String(prompt || '').trim()}`,
              `Current form values:\n${JSON.stringify(currentForm || {}, null, 2)}`,
              'Map hiring requirements or requested services into interestedNeeds.',
              'Map business context or expected value notes into notes.',
              'If website, linkedin, email source, or campaign links are mentioned, place them in the most relevant URL fields.',
              'Any useful prompt data that does not fit our standard lead fields must go into otherDetails as label/value pairs.',
              'Do not return markdown.',
            ].join('\n\n'),
          },
        ],
      });

      const raw = completion.choices?.[0]?.message?.content?.trim();
      const parsed = raw ? JSON.parse(raw) : null;

      if (!parsed?.companyName && !parsed?.contactPerson && !parsed?.email) {
        return sendError(res, 500, 'AI returned an empty lead payload');
      }

      return sendResponse(res, 200, 'Lead details generated successfully', parsed);
    } catch (error) {
      console.error('[generateLeadDetails]', error);
      return sendError(res, 500, error.message || 'Failed to generate lead details', error);
    }
  },
};
