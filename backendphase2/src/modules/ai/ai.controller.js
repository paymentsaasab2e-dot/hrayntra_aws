import { env } from '../../config/env.js';
import { sendResponse, sendError } from '../../utils/response.js';
import { chatCompletionWithFallback, hasLlmProvider } from '../../services/llmChatFallback.service.js';
import { processJobCreationFromPrompt } from '../../services/jobCreationPipeline.service.js';
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
import { interviewService } from '../../services/interview.service.js';
import { undoService } from './undo.service.js';
import * as locationResolveService from '../../services/locationResolve.service.js';
import { parseSmartSearchPrompt } from '../../services/smartSearch.service.js';
import {
  listAiRecommendations,
  generateAiEntryRecommendation,
  buildEntitySnapshot,
} from '../../services/aiEntryRecommendation.service.js';
import {
  generateWorkspaceBrief,
  getLatestWorkspaceBrief,
  getWorkspaceBriefAlertsForEntity,
  getWorkspaceBriefAlertsByEntityIds,
  isAiWorkspaceBriefConfigured,
} from '../../services/aiWorkspaceBrief.service.js';

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

const leadDetailsFieldProperties = {
  companyName: { type: 'string' },
  contactPerson: { type: 'string' },
  directorSalutation: { type: 'string' },
  designation: { type: 'string' },
  email: { type: 'string' },
  phone: { type: 'string' },
  emails: { type: 'array', items: { type: 'string' } },
  phones: { type: 'array', items: { type: 'string' } },
  type: { type: 'string' },
  source: { type: 'string' },
  status: { type: 'string' },
  priority: { type: 'string' },
  interestedNeeds: { type: 'string' },
  notes: { type: 'string' },
  expectedBusinessValue: { type: 'string' },
  industry: { type: 'string' },
  companySize: { type: 'string' },
  website: { type: 'string' },
  linkedIn: { type: 'string' },
  location: { type: 'string' },
  country: { type: 'string' },
  city: { type: 'string' },
  state: { type: 'string' },
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
      properties: { label: { type: 'string' }, value: { type: 'string' } },
      required: ['label', 'value'],
    },
  },
  lastFollowUp: { type: 'string' },
  nextFollowUp: { type: 'string' },
  assignedToId: { type: 'string' },
  assignedToName: { type: 'string' },
  companyLinks: {
    type: 'array',
    items: { type: 'string' },
  },
  teamMemberSalutation: { type: 'string' },
  teamMemberName: { type: 'string' },
  teamMemberDesignation: { type: 'string' },
  teamMemberEmail: { type: 'string' },
  teamMemberPhone: { type: 'string' },
};

const leadDetailsRequiredFields = Object.keys(leadDetailsFieldProperties);

const leadDetailsJsonSchema = {
  name: 'lead_details_payload',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: leadDetailsFieldProperties,
    required: leadDetailsRequiredFields,
  },
  strict: true,
};

const leadChatJsonSchema = {
  name: 'lead_chat_response',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      reply: { type: 'string' },
      readyToCreate: { type: 'boolean' },
      leadPatch: {
        type: 'object',
        additionalProperties: false,
        properties: leadDetailsFieldProperties,
        required: leadDetailsRequiredFields,
      },
    },
    required: ['reply', 'readyToCreate', 'leadPatch'],
  },
  strict: true,
};

const LEAD_AI_FIELD_GUIDE = `Add Lead drawer fields (map user text into leadPatch on every turn):

REQUIRED (only these block readyToCreate):
- companyName — Company name
- email — Director primary email (valid format)

OPTIONAL (extract whenever mentioned; never require):
- companyLinks[] — company website / LinkedIn URLs (also copy first URL to website, LinkedIn URL to linkedIn)
- website, linkedIn — company web presence
- contactPerson — Director name
- directorSalutation — Mr/Mrs/Ms/Dr etc. Infer from director name when not stated (e.g. Amit → Mr, Neha → Ms)
- designation — Director job title
- phone, emails[], phones[] — Director contact channels
- teamMemberSalutation, teamMemberName, teamMemberDesignation, teamMemberEmail, teamMemberPhone — secondary team member (not director). Infer teamMemberSalutation from teamMemberName when not stated.
- location — free-text location search (also set city, state, country separately)
- city, state, country — ALWAYS populate these when location is known (e.g. Mumbai, Maharashtra, India → city Mumbai, state Maharashtra, country India)
- industry — e.g. Technology, Healthcare
- source — Website | LinkedIn | Email | Referral | Campaign
- sourceWebsiteUrl — REQUIRED when source is Website: copy the company website URL here (same URL as website/companyLinks)
- sourceLinkedInUrl — when source is LinkedIn: copy LinkedIn URL here
- sourceEmail — when source is Email
- referralName — when source is Referral
- campaignName, campaignLink — when source is Campaign
- status — New | Contacted | Qualified | Converted | Lost (default New)
- priority — High | Medium | Low (Interest Level)
- nextFollowUp — ISO 8601 datetime (YYYY-MM-DDTHH:mm) for next follow-up date & time
- interestedNeeds — Services needed (placement, executive search, ATS, etc.)
- expectedBusinessValue — budget / deal size / revenue potential
- notes — general remarks not captured elsewhere
- assignedToName — recruiter or owner name if user mentions who should own the lead
- type — Company | Individual | Referral
- companySize, lastFollowUp, otherDetails[] — extras as label/value pairs

Merge with currentForm: keep existing non-empty values unless the user corrects them.`;

const LEAD_DETAILS_SYSTEM_PROMPT = `You are the HRYANTRA recruitment CRM lead extraction assistant.

${LEAD_AI_FIELD_GUIDE}

From unstructured text (email, WhatsApp, meeting notes), extract every field you can in one pass.
Return ONLY valid JSON matching the schema. Use empty string or empty array when unknown. No markdown.`;

const LEAD_CHAT_SYSTEM_PROMPT = `You are the HRYANTRA AI Lead Assistant for the Add Lead drawer.

${LEAD_AI_FIELD_GUIDE}

Conversation rules:
- Extract ALL detectable fields from every user message into leadPatch immediately.
- Ask ONE question at a time. Prioritize missing REQUIRED fields (companyName, email) first.
- All optional fields are optional — user may skip. Offer to collect more (director phone, team member, location, industry, source, status, interest level, follow-up, services, business value, assignee) but never insist.
- When the user pastes bulk notes, extract everything possible and summarize what you filled.
- Never re-ask fields already present in currentForm unless the user wants to change them.
- Set readyToCreate=true only when companyName and a valid email are present. Tell the user to review the Add Lead form and click Create Lead.
- Always return leadPatch with ALL schema fields (empty string or [] when unknown).

Reply formatting (reply field only):
- When summarizing captured fields, use a short intro line then ONE bullet per field on its own line.
- Start each bullet with the character • (not a hyphen dash).
- Format: "Label: value" — no markdown, no ** bold, no asterisks.
- Put a blank line between the intro and the bullet list, and another blank line before the closing sentence.
- Example reply shape:
"I've captured these details for you:

• Company: QuantumByte Pvt Ltd
• Website: https://quantumbyte.com
• Director: Amit Shah (amit@quantumbyte.com, 9876543210)
• Team member: Neha Rao (neha@quantumbyte.com)
• Location: Mumbai, Maharashtra, India
• Industry: Technology
• Source: Website
• Services: Executive placement
• Expected value: ₹15 lakh
• Follow-up: 25 Jun 2026, 10:00 AM
• Assigned to: Sarah Chen

Please review the Add Lead form and click Create Lead when ready."
- Never run multiple bullets together on one line.`;

const clientDetailsFieldProperties = {
  companyName: { type: 'string' },
  directorName: { type: 'string' },
  directorSalutation: { type: 'string' },
  designation: { type: 'string' },
  email: { type: 'string' },
  phone: { type: 'string' },
  emails: { type: 'array', items: { type: 'string' } },
  phones: { type: 'array', items: { type: 'string' } },
  industry: { type: 'string' },
  companySize: { type: 'string' },
  website: { type: 'string' },
  linkedIn: { type: 'string' },
  location: { type: 'string' },
  city: { type: 'string' },
  state: { type: 'string' },
  country: { type: 'string' },
  timezone: { type: 'string' },
  leadStatus: { type: 'string' },
  priority: { type: 'string' },
  servicesNeeded: { type: 'string' },
  expectedBusinessValue: { type: 'string' },
  nextFollowUpDue: { type: 'string' },
  assignedToId: { type: 'string' },
  teamMemberName: { type: 'string' },
  teamMemberEmail: { type: 'string' },
  teamMemberPhone: { type: 'string' },
  teamMemberDesignation: { type: 'string' },
  agreementLevel: { type: 'string' },
  agreementServiceChargePercent: { type: 'string' },
  agreementContractStartDate: { type: 'string' },
  agreementContractEndDate: { type: 'string' },
  agreementTimePeriod: { type: 'string' },
  agreementAdvancePaymentPercent: { type: 'string' },
  agreementFreeReplacementValue: { type: 'string' },
  agreementFreeReplacementUnit: { type: 'string' },
  kycTradeName: { type: 'string' },
  kycEntityType: { type: 'string' },
  kycIncorporationDate: { type: 'string' },
  kycCountryOfIncorporation: { type: 'string' },
  kycLegalRegistrationNumber: { type: 'string' },
  kycTaxIdVatNumber: { type: 'string' },
  kycBusinessAddress: { type: 'string' },
  kycSignatoryFullName: { type: 'string' },
  kycSignatoryDesignation: { type: 'string' },
  kycSignatoryNationality: { type: 'string' },
  kycSignatoryEmail: { type: 'string' },
  kycSignatoryPhone: { type: 'string' },
  kycBankName: { type: 'string' },
  kycAccountHolderName: { type: 'string' },
  kycAccountNumber: { type: 'string' },
  kycIban: { type: 'string' },
  kycSwiftBic: { type: 'string' },
  kycBankCurrency: { type: 'string' },
  kycBankAddress: { type: 'string' },
  kycShareholder1Name: { type: 'string' },
  kycShareholder1Nationality: { type: 'string' },
  kycShareholder1OwnershipPercent: { type: 'string' },
  kycShareholder2Name: { type: 'string' },
  kycShareholder2Nationality: { type: 'string' },
  kycShareholder2OwnershipPercent: { type: 'string' },
  otherDetails: {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: false,
      properties: { label: { type: 'string' }, value: { type: 'string' } },
      required: ['label', 'value'],
    },
  },
};

const clientDetailsRequiredFields = Object.keys(clientDetailsFieldProperties);

const clientDetailsJsonSchema = {
  name: 'client_details_payload',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: clientDetailsFieldProperties,
    required: clientDetailsRequiredFields,
  },
  strict: true,
};

const clientChatJsonSchema = {
  name: 'client_chat_response',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      reply: { type: 'string' },
      readyToCreate: { type: 'boolean' },
      clientPatch: {
        type: 'object',
        additionalProperties: false,
        properties: clientDetailsFieldProperties,
        required: clientDetailsRequiredFields,
      },
    },
    required: ['reply', 'readyToCreate', 'clientPatch'],
  },
  strict: true,
};

const CLIENT_DETAILS_SYSTEM_PROMPT = `You are the HRYANTRA Phase 2 Add Client drawer assistant. Extract client onboarding data and return ONLY valid JSON matching the schema.

SECTION: Client Information
- companyName = company / organization (required to save)
- directorName = primary contact / director (required to save)
- directorSalutation = Mr, Ms, Dr, etc.
- designation = contact designation
- email, phone = primary channels; emails[], phones[] for extras (email required to save)
- teamMemberName, teamMemberEmail, teamMemberPhone, teamMemberDesignation = additional team contact row
- website, linkedIn = company URLs (website also populates company links)
- location, city, state, country, timezone = location fields; infer Indian state from city when possible
- industry, companySize, servicesNeeded, expectedBusinessValue
- leadStatus = client status label: Active | On Hold | Inactive (default Active)
- priority = High | Medium | Low
- nextFollowUpDue = YYYY-MM-DD
- assignedToId = recruiter id only if named; else empty string
- otherDetails = dynamic custom fields as { label, value } pairs

SECTION: Agreements & Terms (text only — never file uploads)
- agreementLevel, agreementServiceChargePercent
- agreementContractStartDate, agreementContractEndDate (YYYY-MM-DD)
- agreementTimePeriod = payment terms text
- agreementAdvancePaymentPercent, agreementFreeReplacementValue
- agreementFreeReplacementUnit = MONTHS | DAYS | empty string

SECTION: KYC Form — HRYANTRA text fields only (never attachments)
- kycTradeName, kycEntityType (LLC, Pvt Ltd, etc.)
- kycIncorporationDate, kycCountryOfIncorporation, kycLegalRegistrationNumber, kycTaxIdVatNumber
- kycBusinessAddress
- kycSignatoryFullName, kycSignatoryDesignation, kycSignatoryNationality, kycSignatoryEmail, kycSignatoryPhone
- kycBankName, kycAccountHolderName, kycAccountNumber, kycIban, kycSwiftBic, kycBankCurrency, kycBankAddress
- kycShareholder1Name, kycShareholder1Nationality, kycShareholder1OwnershipPercent
- kycShareholder2Name, kycShareholder2Nationality, kycShareholder2OwnershipPercent

Rules: Preserve currentForm unless new text clearly overrides. If unknown use empty string (not null). Do not return markdown. Do not ask follow-up questions in extract mode.`;

const CLIENT_CHAT_SYSTEM_PROMPT = `You are HRYANTRA client onboarding assistant for the Add Client drawer.

Ask ONE question at a time. Never re-ask fields already in currentForm unless the user wants to change them.

Required before readyToCreate=true:
- companyName
- directorName (primary contact)
- valid email (mandatory — phone alone is not enough)

Collect when possible: phone, location/city/state/country, industry, servicesNeeded, expectedBusinessValue, priority, nextFollowUpDue, team member, agreement terms (agreement* fields), KYC text fields (kyc*).

Company logo, agreement file upload, and KYC document uploads cannot be filled by AI — tell the user to upload those manually in the drawer.

When readyToCreate is true, confirm the client is ready and tell the user to review the form and click Create Client.

Always return clientPatch with ALL schema fields (empty strings for unknown values).`;

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

  async generateJobFromPrompt(req, res) {
    try {
      const { prompt, currentForm } = req.body || {};
      const promptText = String(prompt || '').trim();
      if (!promptText) {
        return sendError(res, 400, 'Job prompt is required');
      }

      if (!hasLlmProvider()) {
        return sendError(res, 503, 'AI job generator is not configured (set OPENAI_API_KEY)');
      }

      let clients = [];
      try {
        const listReq = {
          ...req,
          query: { ...req.query, page: '1', limit: '500' },
        };
        const clientResult = await clientService.getAll(listReq);
        const raw = clientResult?.data ?? clientResult;
        clients = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
      } catch {
        clients = [];
      }

      const result = await processJobCreationFromPrompt(promptText, {
        currentForm: currentForm && typeof currentForm === 'object' ? currentForm : {},
        clients,
      });

      if (!result?.jobTitle) {
        return sendError(res, 422, 'Could not extract a job title from the prompt');
      }

      return sendResponse(res, 200, 'Job details generated from prompt', result);
    } catch (error) {
      console.error('[generateJobFromPrompt]', error);
      return sendError(res, 500, error.message || 'Failed to generate job from prompt', error);
    }
  },

  async generateJobTitleSuggestions(req, res) {
    try {
      const query = String(req.body?.query || req.body?.jobTitle || '').trim();
      const company = String(req.body?.company || '').trim();
      const industry = String(req.body?.industry || '').trim();
      const limitRaw = Number(req.body?.limit);
      const limit = Number.isFinite(limitRaw)
        ? Math.min(12, Math.max(4, Math.floor(limitRaw)))
        : 8;

      if (!query || query.length < 2) {
        return sendResponse(res, 200, 'OK', { suggestions: [] });
      }

      if (!hasLlmProvider()) {
        return sendError(res, 503, 'AI job title suggestions are not configured');
      }

      const completion = await chatCompletionWithFallback(
        {
          model: env.OPENAI_CHAT_MODEL,
          temperature: 0.5,
          max_tokens: 350,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'job_title_suggestions',
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['suggestions'],
                properties: {
                  suggestions: {
                    type: 'array',
                    minItems: 1,
                    maxItems: 12,
                    items: { type: 'string' },
                  },
                },
              },
            },
          },
          messages: [
            {
              role: 'system',
              content:
                'You suggest realistic recruiting job titles for ATS software. Return concise, professional titles only. Prefer common market titles. Do not include company names in titles. Avoid duplicates.',
            },
            {
              role: 'user',
              content: [
                `Suggest ${limit} job titles related to this partial title or keyword: "${query}".`,
                company ? `Hiring company: ${company}.` : null,
                industry ? `Industry: ${industry}.` : null,
                'If the input is already a strong title, include close variations and related roles.',
                'Return JSON with a suggestions array of strings only.',
              ]
                .filter(Boolean)
                .join(' '),
            },
          ],
        },
        'ai-job-title-suggestions'
      );

      const raw = completion.choices?.[0]?.message?.content?.trim();
      const parsed = raw ? JSON.parse(raw) : null;
      const suggestions = Array.isArray(parsed?.suggestions)
        ? parsed.suggestions
            .map((item) => String(item || '').trim())
            .filter(Boolean)
            .filter((item, index, arr) => arr.findIndex((x) => x.toLowerCase() === item.toLowerCase()) === index)
            .slice(0, limit)
        : [];

      return sendResponse(res, 200, 'Job title suggestions generated', { suggestions });
    } catch (error) {
      return sendError(res, 500, error.message || 'Failed to generate job title suggestions', error);
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
        customPrompt
          ? `Recruiter instruction (MUST respect location, salary, country, and nationality exactly as stated — do not substitute other cities or currencies): ${String(customPrompt).trim()}.`
          : null,
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
            { role: 'system', content: LEAD_DETAILS_SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                'Optimize this lead for our Add Lead drawer and return only valid JSON matching the schema.',
                `User input:\n${String(prompt || '').trim()}`,
                `Current form values:\n${JSON.stringify(currentForm || {}, null, 2)}`,
                'Map company URLs into companyLinks[] and website/linkedIn.',
                'When source is Website, also set sourceWebsiteUrl to the same company website URL.',
                'When source is LinkedIn, also set sourceLinkedInUrl to the LinkedIn URL.',
                'Map director/contact into contactPerson, email, phone, directorSalutation, designation.',
                'Map secondary contacts into teamMember* fields.',
                'Map city/state/country/location from address text — set city, state, and country fields separately, not only location.',
                'Map services into interestedNeeds and budget/deal size into expectedBusinessValue.',
                'Map follow-up phrases into nextFollowUp as ISO datetime when possible.',
                'Map source-specific URLs into sourceWebsiteUrl, sourceLinkedInUrl, sourceEmail, campaignName, campaignLink, referralName.',
                'Put remaining facts into otherDetails as label/value pairs.',
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

  async generateLeadChat(req, res) {
    try {
      const { message, currentForm, history = [] } = req.body || {};
      const trimmedMessage = String(message || '').trim();
      if (!trimmedMessage) return sendError(res, 400, 'Message is required');
      if (!hasLlmProvider()) return sendError(res, 503, 'AI lead assistant is not configured');

      const safeHistory = Array.isArray(history)
        ? history
            .filter((entry) => entry && typeof entry === 'object')
            .slice(-12)
            .map((entry) => ({
              role: entry.role === 'assistant' ? 'assistant' : 'user',
              content: String(entry.content || '').trim(),
            }))
            .filter((entry) => entry.content)
        : [];

      const completion = await chatCompletionWithFallback(
        {
          model: env.OPENAI_CHAT_MODEL,
          temperature: 0.3,
          max_tokens: 2200,
          response_format: { type: 'json_schema', json_schema: leadChatJsonSchema },
          messages: [
            { role: 'system', content: LEAD_CHAT_SYSTEM_PROMPT },
            { role: 'user', content: `Current form values:\n${JSON.stringify(currentForm || {}, null, 2)}` },
            ...safeHistory,
            { role: 'user', content: trimmedMessage },
          ],
        },
        'ai-lead-chat'
      );

      const raw = completion.choices?.[0]?.message?.content?.trim();
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed?.reply) return sendError(res, 500, 'AI returned an empty assistant reply');

      return sendResponse(res, 200, 'Lead chat response generated successfully', {
        reply: parsed.reply,
        readyToCreate: Boolean(parsed.readyToCreate),
        lead: parsed.leadPatch || {},
      });
    } catch (error) {
      console.error('[generateLeadChat]', error);
      return sendError(res, 500, error.message || 'Failed to generate lead chat response', error);
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
          max_tokens: 2200,
          response_format: {
            type: 'json_schema',
            json_schema: clientDetailsJsonSchema,
          },
          messages: [
            { role: 'system', content: CLIENT_DETAILS_SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                'Optimize this client for our Add Client drawer.',
                'Sections: Client Information → Agreements & Terms → KYC text fields (no file uploads).',
                `User input:\n${String(prompt || '').trim()}`,
                `Current form values:\n${JSON.stringify(currentForm || {}, null, 2)}`,
                'Map "Email:" lines to email. Map "Contact:" / director names to directorName.',
                'Map contract/commercial notes to expectedBusinessValue and agreement* fields.',
                'Map bank/shareholder/signatory facts to kyc* fields.',
                'Put extra label/value facts into otherDetails.',
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

  async generateClientChat(req, res) {
    try {
      const { message, currentForm, history = [] } = req.body || {};
      const trimmedMessage = String(message || '').trim();
      if (!trimmedMessage) return sendError(res, 400, 'Message is required');
      if (!hasLlmProvider()) return sendError(res, 503, 'AI client assistant is not configured');

      const safeHistory = Array.isArray(history)
        ? history
            .filter((entry) => entry && typeof entry === 'object')
            .slice(-12)
            .map((entry) => ({
              role: entry.role === 'assistant' ? 'assistant' : 'user',
              content: String(entry.content || '').trim(),
            }))
            .filter((entry) => entry.content)
        : [];

      const completion = await chatCompletionWithFallback(
        {
          model: env.OPENAI_CHAT_MODEL,
          temperature: 0.3,
          max_tokens: 2200,
          response_format: { type: 'json_schema', json_schema: clientChatJsonSchema },
          messages: [
            { role: 'system', content: CLIENT_CHAT_SYSTEM_PROMPT },
            { role: 'user', content: `Current form values:\n${JSON.stringify(currentForm || {}, null, 2)}` },
            ...safeHistory,
            { role: 'user', content: trimmedMessage },
          ],
        },
        'ai-client-chat'
      );

      const raw = completion.choices?.[0]?.message?.content?.trim();
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed?.reply) return sendError(res, 500, 'AI returned an empty assistant reply');

      return sendResponse(res, 200, 'Client chat response generated successfully', {
        reply: parsed.reply,
        readyToCreate: Boolean(parsed.readyToCreate),
        client: parsed.clientPatch || {},
      });
    } catch (error) {
      console.error('[generateClientChat]', error);
      return sendError(res, 500, error.message || 'Failed to generate client chat response', error);
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

  async reverseGeocodeLocation(req, res) {
    try {
      const lat = Number(req.query?.lat ?? req.query?.latitude);
      const lon = Number(req.query?.lon ?? req.query?.lng ?? req.query?.longitude);
      const resolved = await locationResolveService.reverseGeocode(lat, lon);
      return sendResponse(res, 200, 'Location reversed', resolved);
    } catch (error) {
      if (error.code === 'VALIDATION') {
        return sendError(res, 400, error.message);
      }
      if (error.code === 'NOT_FOUND') {
        return sendError(res, 404, error.message);
      }
      console.error('[reverseGeocodeLocation]', error);
      return sendError(res, 500, error.message || 'Reverse geocode failed', error);
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
              await leadService.update(id, { ...restoreData, performedById }, req);
              break;
            case 'clients':
              await clientService.update(id, { ...restoreData, performedById }, req);
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

  async listEntryRecommendations(req, res) {
    try {
      const entityType = String(req.query?.entityType || '').trim();
      const entityId = String(req.query?.entityId || '').trim();
      if (!entityType || !entityId) {
        return sendError(res, 400, 'entityType and entityId are required');
      }
      const recommendations = await listAiRecommendations(entityType, entityId);
      return sendResponse(res, 200, 'AI recommendations loaded', {
        recommendations,
        configured: hasLlmProvider(),
      });
    } catch (error) {
      console.error('[listEntryRecommendations]', error);
      return sendError(res, 500, error.message || 'Failed to load AI recommendations', error);
    }
  },

  async regenerateEntryRecommendation(req, res) {
    try {
      if (!hasLlmProvider()) {
        return sendError(res, 503, 'AI recommendations are not configured (set OPENAI_API_KEY)');
      }
      const { entityType, entityId, entityLabel, snapshot, trigger } = req.body || {};
      const type = String(entityType || '').trim();
      const id = String(entityId || '').trim();
      if (!type || !id) {
        return sendError(res, 400, 'entityType and entityId are required');
      }

      let resolvedSnapshot = snapshot && typeof snapshot === 'object' ? snapshot : null;
      if (!resolvedSnapshot) {
        const upper = type.toUpperCase();
        if (upper === 'LEAD') {
          const row = await leadService.getById(id, req);
          if (row) resolvedSnapshot = buildEntitySnapshot('LEAD', row);
        } else if (upper === 'CLIENT') {
          const row = await clientService.getById(id, req);
          if (row) resolvedSnapshot = buildEntitySnapshot('CLIENT', row);
        } else if (upper === 'CANDIDATE') {
          const row = await candidateService.getById(id, req);
          if (row) resolvedSnapshot = buildEntitySnapshot('CANDIDATE', row);
        } else if (upper === 'JOB') {
          const row = await jobService.getById(id, req);
          if (row) resolvedSnapshot = buildEntitySnapshot('JOB', row);
        } else if (upper === 'TASK') {
          const row = await taskService.getById(id, req);
          if (row) resolvedSnapshot = buildEntitySnapshot('TASK', row);
        } else if (upper === 'PLACEMENT') {
          const row = await placementService.getById(id);
          if (row) resolvedSnapshot = buildEntitySnapshot('PLACEMENT', row);
        } else if (upper === 'INTERVIEW') {
          const row = await interviewService.getById(id, req);
          if (row) resolvedSnapshot = buildEntitySnapshot('INTERVIEW', row);
        }
      }

      const recommendation = await generateAiEntryRecommendation({
        entityType: type,
        entityId: id,
        entityLabel: String(entityLabel || '').trim() || type,
        snapshot: resolvedSnapshot || {},
        recipientUserId: req.user?.id,
        actorUserId: req.user?.id,
        trigger: trigger || 'manual',
        skipDedup: true,
      });

      if (!recommendation) {
        return sendError(res, 422, 'Could not generate AI recommendation');
      }

      return sendResponse(res, 200, 'AI recommendation generated', { recommendation });
    } catch (error) {
      console.error('[regenerateEntryRecommendation]', error);
      return sendError(res, 500, error.message || 'Failed to generate AI recommendation', error);
    }
  },

  async getWorkspaceBrief(req, res) {
    try {
      const brief = await getLatestWorkspaceBrief(req.user?.id);
      return sendResponse(res, 200, 'OK', {
        brief,
        configured: isAiWorkspaceBriefConfigured(),
      });
    } catch (error) {
      console.error('[getWorkspaceBrief]', error);
      return sendError(res, 500, error.message || 'Failed to load AI workspace brief', error);
    }
  },

  async generateWorkspaceBrief(req, res) {
    try {
      if (!isAiWorkspaceBriefConfigured()) {
        return sendError(res, 422, 'OpenAI or Mistral API key is not configured');
      }
      const sendEmail = req.body?.sendEmail !== false;
      const brief = await generateWorkspaceBrief({
        userId: req.user?.id,
        trigger: 'manual',
        skipDedup: Boolean(req.body?.force),
        sendEmail,
        sendNotification: true,
        reqUser: req.user,
      });
      if (!brief) {
        return sendError(res, 422, 'Could not generate AI workspace brief');
      }
      return sendResponse(res, 200, 'AI workspace brief generated', { brief });
    } catch (error) {
      console.error('[generateWorkspaceBrief]', error);
      return sendError(res, 500, error.message || 'Failed to generate AI workspace brief', error);
    }
  },

  async getWorkspaceBriefEntityAlerts(req, res) {
    try {
      const entityType = String(req.query?.entityType || '').trim();
      const entityId = String(req.query?.entityId || '').trim();
      if (!entityType || !entityId) {
        return sendError(res, 400, 'entityType and entityId are required');
      }
      const alerts = await getWorkspaceBriefAlertsForEntity(req.user?.id, entityType, entityId);
      return sendResponse(res, 200, 'OK', {
        alerts,
        configured: isAiWorkspaceBriefConfigured(),
      });
    } catch (error) {
      console.error('[getWorkspaceBriefEntityAlerts]', error);
      return sendError(res, 500, error.message || 'Failed to load entity workspace alerts', error);
    }
  },

  async getWorkspaceBriefEntityAlertsBatch(req, res) {
    try {
      const entityType = String(req.query?.entityType || '').trim();
      const rawIds = String(req.query?.entityIds || '').trim();
      if (!entityType || !rawIds) {
        return sendError(res, 400, 'entityType and entityIds are required');
      }
      const entityIds = rawIds
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
        .slice(0, 100);
      const alertsByEntityId = await getWorkspaceBriefAlertsByEntityIds(
        req.user?.id,
        entityType,
        entityIds,
      );
      return sendResponse(res, 200, 'OK', {
        alertsByEntityId,
        configured: isAiWorkspaceBriefConfigured(),
      });
    } catch (error) {
      console.error('[getWorkspaceBriefEntityAlertsBatch]', error);
      return sendError(res, 500, error.message || 'Failed to load entity workspace alerts', error);
    }
  },
};
