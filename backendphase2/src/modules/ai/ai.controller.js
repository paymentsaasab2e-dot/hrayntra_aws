import { sendResponse, sendError } from '../../utils/response.js';
import { env } from '../../config/env.js';
import { chatCompletionWithFallback, hasLlmProvider } from '../../services/llmChatFallback.service.js';
import { runAssistantChat } from './assistantChat.service.js';
import {
  deleteAssistantHistory,
  getAssistantHistory,
  upsertAssistantHistory,
} from './assistantHistory.service.js';
import { leadService } from '../lead/lead.service.js';
import { clientService } from '../client/client.service.js';
import { jobService } from '../job/job.service.js';
import { candidateService } from '../candidate/candidate.service.js';
import { taskService } from '../task/task.service.js';
import { placementService } from '../placement/placement.service.js';
import { undoService } from './undo.service.js';
import * as locationResolveService from '../../services/locationResolve.service.js';
import { parseSmartSearchPrompt } from '../../services/smartSearch.service.js';

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

const clientDetailsJsonSchema = {
  name: 'client_details_payload',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      companyName: { type: 'string' },
      directorName: { type: 'string' },
      directorSalutation: { type: 'string' },
      designation: { type: 'string' },
      email: { type: 'string' },
      phone: { type: 'string' },
      industry: { type: 'string' },
      companySize: { type: 'string' },
      website: { type: 'string' },
      linkedIn: { type: 'string' },
      location: { type: 'string' },
      country: { type: 'string' },
      city: { type: 'string' },
      hiringLocations: { type: 'string' },
      timezone: { type: 'string' },
      leadStatus: { type: 'string' },
      priority: { type: 'string' },
      servicesNeeded: { type: 'string' },
      expectedBusinessValue: { type: 'string' },
      sla: { type: 'string' },
      nextFollowUpDue: { type: 'string' },
      assignedToId: { type: 'string' },
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
    },
    required: [
      'companyName',
      'directorName',
      'directorSalutation',
      'designation',
      'email',
      'phone',
      'industry',
      'companySize',
      'website',
      'linkedIn',
      'location',
      'country',
      'city',
      'hiringLocations',
      'timezone',
      'leadStatus',
      'priority',
      'servicesNeeded',
      'expectedBusinessValue',
      'sla',
      'nextFollowUpDue',
      'assignedToId',
      'otherDetails',
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

      if (!hasLlmProvider()) {
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

      const completion = await chatCompletionWithFallback(
        {
          model: env.OPENAI_CHAT_MODEL,
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
        },
        'ai-job-description'
      );

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

      if (!hasLlmProvider()) {
        return sendError(res, 503, 'AI lead generator is not configured');
      }

      const completion = await chatCompletionWithFallback(
        {
          model: env.OPENAI_CHAT_MODEL,
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
                'You are an ATS lead creation assistant. Analyze all user-provided lead information and optimize it into a clean structured lead payload for a recruitment CRM Add Lead form. Do not ask follow-up questions. Infer sensible defaults when data is missing. Keep required business fields populated with realistic values. Allowed enums: type => Company|Individual|Referral. source => Website|LinkedIn|Email|Referral|Campaign. status => New|Contacted|Qualified|Lost|Converted. priority (Interest Level) => High|Medium|Low. Dates must be YYYY-MM-DD or empty string. If a field is unknown, return empty string. Preserve any assignedToId passed from the form unless the prompt clearly overrides it. Field mapping: companyName=Company; contactPerson=Director Name; companySize=Team Name; industry=Industry; website/linkedIn=Company Links; location/city/state/country=Location fields; interestedNeeds=Services Needed; notes=Expected Business Value; sourceWebsiteUrl/sourceLinkedInUrl/sourceEmail/referralName/campaignName per Source type; nextFollowUp=Next Follow-up Date & Time.',
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
        },
        'ai-lead-details'
      );

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

  async generateClientDetails(req, res) {
    try {
      const { prompt, currentForm } = req.body || {};

      if (!String(prompt || '').trim() && !currentForm) {
        return sendError(res, 400, 'Client prompt is required');
      }

      if (!hasLlmProvider()) {
        return sendError(res, 503, 'AI client generator is not configured');
      }

      const completion = await chatCompletionWithFallback(
        {
          model: env.OPENAI_CHAT_MODEL,
          temperature: 0.2,
          max_tokens: 1600,
          response_format: {
            type: 'json_schema',
            json_schema: clientDetailsJsonSchema,
          },
          messages: [
            {
              role: 'system',
              content:
                'You are an ATS client onboarding assistant. Analyze all user-provided client information and optimize it into a clean structured client payload for a recruitment CRM Add Client form. Do not ask follow-up questions. Infer sensible defaults when data is missing. Always copy every email address from the user text into the email field exactly. Always copy the primary contact name into directorName. leadStatus should be one of New, Contacted, Qualified, Converted, Lost when possible. priority => High|Medium|Low. Dates must be YYYY-MM-DD or empty string. If a field is unknown, return empty string. Preserve assignedToId from the form unless the prompt clearly overrides it.',
            },
            {
              role: 'user',
              content: [
                'Optimize this client for our Add Client drawer and return only valid JSON matching the schema.',
                `User input:\n${String(prompt || '').trim()}`,
                `Current form values:\n${JSON.stringify(currentForm || {}, null, 2)}`,
                'Map hiring requirements or requested services into servicesNeeded.',
                'Map commercial notes, budget, or deal context into expectedBusinessValue.',
                'Lines like "Email: user@company.com" must populate email. Lines like "Contact: Jane Doe" must populate directorName.',
                'Put extra useful facts that do not fit standard fields into otherDetails as label/value pairs.',
                'Do not return markdown.',
              ].join('\n\n'),
            },
          ],
        },
        'ai-client-details'
      );

      const raw = completion.choices?.[0]?.message?.content?.trim();
      const parsed = raw ? JSON.parse(raw) : null;

      if (!parsed?.companyName && !parsed?.directorName && !parsed?.email) {
        return sendError(res, 500, 'AI returned an empty client payload');
      }

      return sendResponse(res, 200, 'Client details generated successfully', parsed);
    } catch (error) {
      console.error('[generateClientDetails]', error);
      return sendError(res, 500, error.message || 'Failed to generate client details', error);
    }
  },

  async searchLocations(req, res) {
    try {
      const q = String(req.query?.q || req.query?.query || '').trim();
      if (q.length < 2) {
        return sendResponse(res, 200, 'OK', { suggestions: [] });
      }
      const limit = Math.min(Math.max(parseInt(String(req.query?.limit || '8'), 10) || 8, 1), 20);
      const suggestions = await locationResolveService.searchLocations(q, { limit });
      return sendResponse(res, 200, 'OK', { suggestions });
    } catch (error) {
      console.error('[searchLocations]', error);
      return sendError(res, 500, error.message || 'Location search failed', error);
    }
  },

  async resolveLocation(req, res) {
    try {
      const query = String(req.body?.query || req.body?.location || '').trim();
      if (query.length < 2) {
        return sendError(res, 400, 'Location must be at least 2 characters');
      }
      const resolved = await locationResolveService.resolveLocation(query);
      return sendResponse(res, 200, 'Location resolved', resolved);
    } catch (error) {
      if (error.code === 'VALIDATION') {
        return sendError(res, 400, error.message);
      }
      if (error.code === 'NOT_FOUND') {
        return sendError(res, 404, error.message);
      }
      console.error('[resolveLocation]', error);
      return sendError(res, 500, error.message || 'Location resolve failed', error);
    }
  },

  async parseSmartSearch(req, res) {
    try {
      const { entity, prompt, context } = req.body || {};
      if (!entity || !String(entity).trim()) {
        return sendError(res, 400, 'entity is required');
      }
      if (!String(prompt || '').trim()) {
        return sendError(res, 400, 'prompt is required');
      }

      const result = await parseSmartSearchPrompt({
        entity: String(entity).trim(),
        prompt: String(prompt).trim(),
        context: context && typeof context === 'object' ? context : {},
        req,
      });

      return sendResponse(res, 200, 'Smart search parsed', result);
    } catch (error) {
      console.error('[parseSmartSearch]', error);
      if (!hasLlmProvider()) {
        return sendError(res, 503, 'AI smart search is not configured (missing API key)');
      }
      return sendError(res, 500, error.message || 'Failed to parse smart search prompt', error);
    }
  },

  async executeUndo(req, res) {
    try {
      const { actionId } = req.body || {};
      const userId = req.user?.id;
      const orgId = req.user?.orgId || req.tenantDbName;

      if (!actionId) {
        return sendError(res, 400, 'actionId is required');
      }

      const undoRecord = await undoService.getValidUndo(actionId);
      if (!undoRecord) {
        return sendError(res, 404, 'Undo record not found or already expired');
      }

      if (String(undoRecord.userId) !== String(userId)) {
        return sendError(res, 404, 'Undo record not found or already expired');
      }

      if (new Date() > new Date(undoRecord.expiresAt)) {
        await undoService.removeFromStack(actionId);
        return sendError(res, 410, 'Undo window has expired (10 minute limit)');
      }

      const { module, action, targetIds, method, reverseData } = undoRecord;
      const performedById = userId;
      let result = null;

      // Routing logic based on module and action
      if (method === 'DELETE') {
        for (const id of targetIds) {
          switch (module.toLowerCase()) {
            case 'leads':
              await leadService.delete(id, performedById);
              break;
            case 'clients':
              await clientService.delete(id, performedById);
              break;
            case 'jobs':
              await jobService.delete(id, performedById);
              break;
            case 'tasks':
              await taskService.delete(id, performedById);
              break;
            default:
              console.warn(`[executeUndo] No delete handler for module: ${module}`);
          }
        }
        result = { success: true, reversed: action, count: targetIds.length };
      } 
      else if (method === 'PATCH' || method === 'PUT') {
        for (const id of targetIds) {
          const restoreData = reverseData?.[id] || reverseData || {};
          switch (module.toLowerCase()) {
            case 'leads':
              await leadService.update(id, { ...restoreData, performedById });
              break;
            case 'clients':
              await clientService.update(id, { ...restoreData, performedById });
              break;
          }
        }
        result = { success: true, reversed: action, count: targetIds.length };
      }

      await undoService.removeFromStack(actionId);

      return sendResponse(res, 200, 'Action reversed successfully', {
        ...result,
        message: 'Action reversed successfully',
        orgId,
        uiReverse: undoRecord.reverseSnapshot?.uiReverse || undoRecord.uiReverse || null,
      });
    } catch (error) {
      console.error('[ARIA Undo] Error:', error);
      return sendError(res, 500, 'Failed to execute undo', error);
    }
  },
};
