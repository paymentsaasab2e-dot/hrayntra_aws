import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import { ariaLeadsSystemPrompt } from '../ai/prompts/ariaLeadsSystemPrompt.js';
import {
  saveUserMemory,
  getUserMemory,
  savePendingLeadData,
  getPendingLeadData,
  clearPendingLeadData,
  saveUndoRecord,
  getUndoRecord,
  markUndoUsed,
} from '../ai/memory/ariaMemory.js';
import {
  createLead,
  bulkCreateLeads,
  updateLead,
  softDeleteLead,
  restoreLead,
  fetchLeads,
  checkDuplicate,
  getLeadMetrics,
} from '../services/ariaService.js';
import { parseLeadCSV } from '../utils/csvParser.js';
import { parseLeadFromText } from '../utils/ariaAdvancedParser.js';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function safeJsonParse(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text).match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function callOpenAI(systemPrompt, userMessage, retries = 2) {
  for (let i = 0; i <= retries; i += 1) {
    try {
      const res = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 2000,
        temperature: 0.2,
      });
      const parsed = safeJsonParse(res.choices?.[0]?.message?.content || '');
      if (parsed) return parsed;
    } catch (error) {
      if (i === retries) throw error;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return null;
}

function resolveTenant(req) {
  return (
    req.user?.orgId ||
    req.user?.tenantDbName ||
    req.headers['x-tenant-db-name'] ||
    'default'
  );
}

function buildDuplicateResponse(existingRecord) {
  return {
    intent: 'DUPLICATE_FOUND',
    module: 'Leads',
    chatOutput: {
      headline: 'Duplicate Lead Found',
      summary: 'This lead already exists in the system.',
      details: [
        { label: 'Existing ID', value: existingRecord?.id || '-' },
        { label: 'Company', value: existingRecord?.companyName || '-' },
        { label: 'Contact', value: existingRecord?.contactName || '-' },
        {
          label: 'Created',
          value: existingRecord?.createdAt
            ? new Date(existingRecord.createdAt).toLocaleDateString()
            : '-',
        },
      ],
      warnings: ['Email or phone already exists in system'],
      aiInsights: ['Consider updating existing lead instead'],
      undoLine: '',
      suggestions: [
        {
          label: 'Update Existing Lead',
          action: 'UPDATE_LEAD',
          params: { leadId: existingRecord?.id },
        },
        { label: 'Create Anyway', action: 'CREATE_LEAD_FORCE', params: {} },
      ],
    },
    uiPayload: {
      action: 'HIGHLIGHT_ROWS',
      target: 'leads-table',
      highlightRows: existingRecord?.id ? [existingRecord.id] : [],
      highlightColor: 'yellow',
    },
    undoPayload: null,
  };
}

function buildCreateResponse(lead, aiScore, actionId, expiresAt, metrics) {
  return {
    intent: 'CREATE_LEAD',
    module: 'Leads',
    currentPage: 'leads',
    isBulk: false,
    recordCount: 1,
    clarificationNeeded: false,
    actions: [
      {
        step: 1,
        method: 'POST',
        endpoint: '/api/v1/leads',
        payload: lead,
        idempotencyKey: actionId,
        status: 'SUCCESS',
        responseId: lead.id,
      },
    ],
    result: {
      status: 'SUCCESS',
      created: 1,
      updated: 0,
      deleted: 0,
      skipped: 0,
      failed: 0,
      records: [{ id: lead.id, entity: 'Lead', data: lead, warnings: [], aiScore }],
      errors: [],
    },
    chatOutput: {
      headline: `Lead Created — ${lead.companyName || lead.contactName || 'Lead'}`,
      summary: `${lead.type || 'Company'} | ${lead.source || 'Website'} | ${lead.status || 'New'}`,
      details: [
        { label: 'Lead ID', value: lead.id },
        { label: 'Company', value: lead.companyName || '-' },
        { label: 'Contact', value: lead.contactName || '-' },
        { label: 'Email', value: lead.email || 'Not provided' },
        { label: 'Phone', value: lead.phone || 'Not provided' },
        { label: 'Source', value: lead.source || '-' },
        { label: 'Type', value: lead.type || '-' },
        { label: 'Status', value: lead.status || '-' },
        { label: 'Priority', value: lead.priority || '-' },
        {
          label: 'Follow-up',
          value: lead.nextFollowUp ? new Date(lead.nextFollowUp).toLocaleDateString() : 'Auto-set',
        },
        { label: 'Quality Score', value: `${aiScore}/100` },
      ],
      warnings: [],
      aiInsights: [`Lead quality score: ${aiScore}/100`],
      undoLine: 'Undo available — expires in 10:00',
      suggestions: [],
    },
    uiPayload: {
      action: 'INSERT_ROW',
      target: 'leads-table',
      data: {
        ...lead,
        nextFollowUp: lead.nextFollowUp,
        assignedTo: lead.assignedToId || 'Unassigned',
      },
      metricsUpdate: {
        NEW_LEADS: { delta: lead.status === 'New' ? 1 : 0, newTotal: metrics.NEW_LEADS },
        CONTACTED: { delta: 0, newTotal: metrics.CONTACTED },
        QUALIFIED: { delta: 0, newTotal: metrics.QUALIFIED },
        CONVERTED: { delta: 0, newTotal: metrics.CONVERTED },
        LOST: { delta: 0, newTotal: metrics.LOST },
      },
      toast: {
        type: 'success',
        message: `Lead created: ${lead.companyName || lead.contactName}`,
        duration: 10000,
        actions: [{ label: 'Undo', actionId, style: 'warning', expiresIn: 600 }],
      },
      scrollToRow: lead.id,
      highlightRow: lead.id,
    },
    undoPayload: {
      available: true,
      actionId,
      expiresAt,
      expiresInSeconds: 600,
      label: `Remove ${lead.companyName || lead.contactName}`,
      action: 'DELETE',
      endpoint: '/api/v1/ai/aria/undo',
      method: 'POST',
      targetIds: [lead.id],
      uiReverse: {
        action: 'DELETE_ROW',
        target: 'leads-table',
        rowId: lead.id,
        metricsRollback: { NEW_LEADS: { delta: lead.status === 'New' ? -1 : 0 } },
      },
    },
  };
}

function buildBulkResponse(bulkResult, actionId, expiresAt, metrics) {
  const createdIds = bulkResult.created.map((r) => r.id);
  return {
    intent: 'BULK_CREATE_LEADS',
    module: 'Leads',
    isBulk: true,
    recordCount: bulkResult.created.length,
    clarificationNeeded: false,
    result: {
      status: bulkResult.failed.length > 0 ? 'PARTIAL' : 'SUCCESS',
      created: bulkResult.created.length,
      skipped: bulkResult.skipped.length,
      failed: bulkResult.failed.length,
      updated: 0,
      deleted: 0,
      records: bulkResult.created.map((r) => ({ id: r.id, entity: 'Lead', data: r, aiScore: r.aiScore })),
      errors: bulkResult.failed.map((f) => ({ message: f.reason })),
    },
    chatOutput: {
      headline: `${bulkResult.created.length} Leads Created`,
      summary: `${bulkResult.created.length} created | ${bulkResult.skipped.length} skipped | ${bulkResult.failed.length} failed`,
      details: [],
      warnings: bulkResult.skipped.map((s) => `${s.label}: ${s.reason}`),
      aiInsights: [],
      bulkRows: [
        ...bulkResult.created.map((r) => ({ status: 'created', label: r.label, id: r.id })),
        ...bulkResult.skipped.map((r) => ({ status: 'skipped', label: r.label, reason: r.reason })),
        ...bulkResult.failed.map((r) => ({ status: 'failed', label: r.label, reason: r.reason })),
      ],
      undoLine: createdIds.length ? 'Undo all — expires in 10:00' : '',
      suggestions: [],
    },
    uiPayload: {
      action: 'BULK_INSERT_ROWS',
      target: 'leads-table',
      rows: bulkResult.created,
      metricsUpdate: {
        NEW_LEADS: { delta: bulkResult.created.length, newTotal: metrics.NEW_LEADS },
      },
      toast: {
        type: 'success',
        message: `${bulkResult.created.length} leads created`,
        duration: 10000,
        actions: createdIds.length ? [{ label: 'Undo All', actionId, style: 'warning', expiresIn: 600 }] : [],
      },
    },
    undoPayload: createdIds.length
      ? {
          available: true,
          actionId,
          expiresAt,
          expiresInSeconds: 600,
          label: `Remove ${bulkResult.created.length} leads`,
          action: 'BULK_DELETE',
          endpoint: '/api/v1/ai/aria/undo',
          method: 'POST',
          targetIds: createdIds,
          uiReverse: {
            action: 'BULK_DELETE_ROWS',
            target: 'leads-table',
            rowIds: createdIds,
            metricsRollback: { NEW_LEADS: { delta: -bulkResult.created.length } },
          },
        }
      : null,
  };
}

function hasText(value) {
  return String(value || '').trim().length > 0;
}

function normalizeLeadSource(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'linkedin') return 'LinkedIn';
  if (v === 'email') return 'Email';
  if (v === 'referral') return 'Referral';
  if (v === 'campaign') return 'Campaign';
  if (v === 'website') return 'Website';
  return '';
}

function normalizeLeadType(value, companyName) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'company') return 'Company';
  if (v === 'individual') return 'Individual';
  if (v === 'referral') return 'Referral';
  if (hasText(companyName)) return 'Company';
  return 'Individual';
}

function sanitizeCompanyName(value) {
  let out = String(value || '').trim();
  out = out.replace(
    /\b(contact(?:\s+name)?|source|type|status|priority|email|phone|from)\b[\s\S]*$/i,
    ''
  );
  out = out.replace(/[,:;.\-–\s]+$/g, '').trim();
  return out;
}

function normalizeCreateLeadKnownData(data = {}) {
  const companyName = sanitizeCompanyName(data.companyName || '');
  const contactName = String(data.contactName || data.contactPerson || data.directorName || '').trim();
  const source = normalizeLeadSource(data.source);
  const type = normalizeLeadType(data.type, companyName);
  return {
    companyName,
    contactName,
    source,
    type,
  };
}

function getCreateLeadMissingFields(knownData = {}) {
  const missing = [];
  if (!hasText(knownData.contactName)) missing.push('contactName');
  if (!hasText(knownData.source)) missing.push('source');
  if (!hasText(knownData.type)) missing.push('type');
  return missing;
}

function humanizeField(field) {
  if (field === 'contactName') return 'contact name';
  if (field === 'source') return 'source';
  if (field === 'type') return 'type';
  return field;
}

function buildCreateLeadClarificationQuestion(missingFields = []) {
  if (missingFields.length === 1) {
    return `What is the ${humanizeField(missingFields[0])}?`;
  }
  if (missingFields.length === 2) {
    return `What are the ${humanizeField(missingFields[0])} and ${humanizeField(missingFields[1])}?`;
  }
  return `Please share these details: ${missingFields.map((f) => humanizeField(f)).join(', ')}.`;
}

function buildCreateLeadClarificationResponse(knownData, missingFields) {
  const details = [];
  if (hasText(knownData.companyName)) details.push({ label: 'Company', value: `${knownData.companyName} ✓` });
  if (hasText(knownData.contactName)) details.push({ label: 'Contact', value: `${knownData.contactName} ✓` });
  if (hasText(knownData.source)) details.push({ label: 'Source', value: `${knownData.source} ✓` });
  if (hasText(knownData.type)) details.push({ label: 'Type', value: `${knownData.type} ✓` });

  const clarificationQuestion = buildCreateLeadClarificationQuestion(missingFields);

  return {
    intent: 'CLARIFICATION_NEEDED',
    module: 'Leads',
    clarificationNeeded: true,
    clarificationQuestion,
    knownData,
    missingFields,
    chatOutput: {
      headline: 'One quick detail needed',
      summary: 'I have some details, just need a little more.',
      details,
      warnings: missingFields.length
        ? [`Missing: ${missingFields.map((f) => humanizeField(f)).join(', ')}`]
        : [],
      aiInsights: [],
      undoLine: '',
      suggestions: [],
    },
    uiPayload: null,
    undoPayload: null,
  };
}

function toTitleCaseWords(value) {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `${w.charAt(0).toUpperCase()}${w.slice(1).toLowerCase()}`)
    .join(' ');
}

function inferContactNameFromReply(userMessage) {
  const text = String(userMessage || '').trim();
  if (!text || text.length > 60) return '';
  if (text.includes('@') || /https?:\/\//i.test(text) || /\d/.test(text)) return '';
  if (/\b(update|existing|create|lead|anyway|source|type|company|contact)\b/i.test(text)) return '';
  if (/^(yes|no|ok|okay|sure|done|create|add|proceed)$/i.test(text)) return '';

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 4) return '';
  if (!words.every((w) => /^[a-zA-Z][a-zA-Z.'-]*$/.test(w))) return '';
  return toTitleCaseWords(words.join(' '));
}

function sanitizeExtractedLeadData(userMessage, extracted = {}, pendingData = null) {
  const next = { ...(extracted || {}) };
  const msg = String(userMessage || '').toLowerCase();
  const mentionsSource = /(linkedin|website|web site|referral|referred|email|campaign)/i.test(msg);
  const mentionsType = /\b(company|individual|referral)\b/i.test(msg);

  // Parser defaults should not override known pending values during clarification replies.
  if (!mentionsSource) delete next.source;
  if (!mentionsType) delete next.type;

  const pendingKnown = normalizeCreateLeadKnownData(pendingData || {});
  const pendingMissing = getCreateLeadMissingFields(pendingKnown);
  if (
    pendingMissing.includes('contactName') &&
    !hasText(next.contactName) &&
    !hasText(next.contactPerson) &&
    !hasText(next.directorName)
  ) {
    const inferredName = inferContactNameFromReply(userMessage);
    if (inferredName) {
      next.contactName = inferredName;
      next.contactPerson = inferredName;
      next.directorName = inferredName;
    }
  }

  return next;
}

async function handleFileUpload(file, userId, orgId) {
  const records = await parseLeadCSV(file.buffer || file.path);
  if (!records?.length) {
    return {
      success: true,
      message: 'No valid records found in file.',
      structured: {
        intent: 'FILE_EMPTY',
        chatOutput: {
          headline: 'Empty File',
          summary: 'No valid records found in the uploaded file.',
          details: [],
          warnings: ['File appears empty or invalid'],
          aiInsights: [],
          suggestions: [],
        },
        uiPayload: null,
        undoPayload: null,
      },
    };
  }

  const bulkResult = await bulkCreateLeads(orgId, userId, records);
  const metrics = await getLeadMetrics(orgId);
  const actionId = `undo_csv_${uuidv4().slice(0, 8)}`;
  const expiresAt = new Date(Date.now() + 600000).toISOString();
  const createdIds = bulkResult.created.map((r) => r.id);

  if (createdIds.length) {
    saveUndoRecord(userId, {
      actionId,
      expiresAt,
      expiresInSeconds: 600,
      label: `Remove ${createdIds.length} imported leads`,
      action: 'BULK_DELETE',
      endpoint: '/api/v1/leads/bulk-delete',
      method: 'POST',
      targetIds: createdIds,
      available: true,
      uiReverse: {
        action: 'BULK_DELETE_ROWS',
        target: 'leads-table',
        rowIds: createdIds,
      },
    });
  }

  return {
    success: true,
    message: `${bulkResult.created.length} leads imported`,
    structured: {
      intent: 'CSV_IMPORT_COMPLETE',
      module: 'Leads',
      isBulk: true,
      recordCount: records.length,
      clarificationNeeded: false,
      result: {
        status: bulkResult.failed.length ? 'PARTIAL' : 'SUCCESS',
        created: bulkResult.created.length,
        skipped: bulkResult.skipped.length,
        failed: bulkResult.failed.length,
        updated: 0,
        deleted: 0,
        records: bulkResult.created.map((r) => ({ id: r.id, entity: 'Lead', data: r, aiScore: r.aiScore })),
        errors: bulkResult.failed.map((r) => ({ message: r.reason })),
      },
      chatOutput: {
        headline: `${bulkResult.created.length} Leads Imported from CSV`,
        summary: `${bulkResult.created.length} created | ${bulkResult.skipped.length} skipped | ${bulkResult.failed.length} failed`,
        details: [
          { label: 'File', value: file.originalname || 'upload.csv' },
          { label: 'Rows', value: String(records.length) },
        ],
        warnings: bulkResult.skipped.map((s) => `${s.label}: ${s.reason}`),
        aiInsights: [],
        bulkRows: [
          ...bulkResult.created.map((r) => ({ status: 'created', label: r.label, id: r.id })),
          ...bulkResult.skipped.map((r) => ({ status: 'skipped', label: r.label, reason: r.reason })),
          ...bulkResult.failed.map((r) => ({ status: 'failed', label: r.label, reason: r.reason })),
        ],
        undoLine: createdIds.length ? 'Undo available — expires in 10:00' : '',
        suggestions: [],
      },
      uiPayload: {
        action: 'BULK_INSERT_ROWS',
        target: 'leads-table',
        rows: bulkResult.created,
        metricsUpdate: {
          NEW_LEADS: { delta: bulkResult.created.length, newTotal: metrics.NEW_LEADS },
        },
      },
      undoPayload: createdIds.length
        ? {
            available: true,
            actionId,
            expiresAt,
            expiresInSeconds: 600,
            action: 'BULK_DELETE',
            targetIds: createdIds,
          }
        : null,
    },
  };
}

export async function handleAriaMessage(req, res) {
  try {
    const userId = req.user?.id || 'anonymous';
    const orgId = resolveTenant(req);
    const currentPage = req.body.currentPage || 'leads';
    const userMessage = String(req.body.message || req.body.userMessage || '').trim();
    const file = req.file || null;

    if (!userMessage && !file) {
      return res.status(400).json({ success: false, message: 'Message or file is required' });
    }

    if (file) {
      const fileResult = await handleFileUpload(file, userId, orgId);
      return res.json(fileResult);
    }

    const memory = getUserMemory(userId);
    const pendingData = getPendingLeadData(userId);
    const extractedRaw = parseLeadFromText(userMessage);
    const extracted = sanitizeExtractedLeadData(userMessage, extractedRaw, pendingData);
    const mergedKnown = { ...(pendingData || {}), ...extracted };
    const memoryContext = memory
      ? `User last actions: ${((memory.lastActions || []).slice(0, 3).map((a) => a.recordLabel).join(', '))}. Current page: ${currentPage}.`
      : `Current page: ${currentPage}.`;

    const aiResponse = await callOpenAI(
      ariaLeadsSystemPrompt,
      `${memoryContext}\nPending known data: ${JSON.stringify(mergedKnown)}\nUser message: ${userMessage}`
    );
    if (!aiResponse) {
      return res.status(500).json({
        success: false,
        message: 'ARIA could not process your request. Please try again.',
      });
    }

    let intent = aiResponse.intent;
    if (intent === 'CLARIFICATION_NEEDED' || aiResponse.clarificationNeeded) {
      const knownData = normalizeCreateLeadKnownData({
        ...(pendingData || {}),
        ...(aiResponse.knownData || {}),
        ...(aiResponse.actions?.[0]?.payload || {}),
        ...extracted,
      });
      const aiMissing = Array.isArray(aiResponse.missingFields) ? aiResponse.missingFields : [];
      const createFlowHints =
        /create|add|new lead/i.test(userMessage) ||
        aiMissing.some((f) => ['contactName', 'source', 'type'].includes(f)) ||
        (aiResponse.actions || []).some(
          (a) => a?.method === 'POST' && String(a?.endpoint || '').includes('/leads')
        );
      if (createFlowHints) {
        const missingFields = getCreateLeadMissingFields(knownData);
        if (missingFields.length > 0) {
          const clarification = buildCreateLeadClarificationResponse(knownData, missingFields);
          savePendingLeadData(userId, { ...(pendingData || {}), ...knownData, ...extracted });
          return res.json({
            success: true,
            message: clarification.chatOutput.summary,
            structured: clarification,
          });
        }
        // Required fields are now complete (e.g. user answered contact name).
        // Force progression to CREATE_LEAD even if model returned CLARIFICATION_NEEDED again.
        intent = 'CREATE_LEAD';
        if (!Array.isArray(aiResponse.actions) || !aiResponse.actions.length) {
          aiResponse.actions = [{ payload: { ...knownData } }];
        } else {
          aiResponse.actions[0] = {
            ...aiResponse.actions[0],
            payload: { ...(aiResponse.actions[0]?.payload || {}), ...knownData },
          };
        }
      }

      if (intent === 'CLARIFICATION_NEEDED') {
        savePendingLeadData(userId, { ...(pendingData || {}), ...(aiResponse.knownData || {}), ...extracted });
        return res.json({
          success: true,
          message: aiResponse.chatOutput?.summary || aiResponse.clarificationQuestion || 'Please provide more details.',
          structured: aiResponse,
        });
      }
    }

    if (intent === 'CREATE_LEAD') {
      const payload = { ...(pendingData || {}), ...(aiResponse.actions?.[0]?.payload || {}), ...extracted };
      const knownData = normalizeCreateLeadKnownData(payload);
      const missingFields = getCreateLeadMissingFields(knownData);
      if (missingFields.length > 0) {
        const clarification = buildCreateLeadClarificationResponse(knownData, missingFields);
        savePendingLeadData(userId, { ...(pendingData || {}), ...payload, ...knownData, ...extracted });
        return res.json({
          success: true,
          message: clarification.chatOutput.summary,
          structured: clarification,
        });
      }

      payload.contactName = knownData.contactName || payload.contactName;
      payload.source = knownData.source || payload.source;
      payload.type = knownData.type || payload.type;

      const dupCheck = await checkDuplicate(orgId, payload.email, payload.phone, payload.companyName);
      if (dupCheck.isDuplicate && !payload.forceCreate) {
        const dupResponse = buildDuplicateResponse(dupCheck.record);
        return res.json({ success: true, message: dupResponse.chatOutput.summary, structured: dupResponse });
      }

      const { lead, aiScore } = await createLead(orgId, userId, payload);
      clearPendingLeadData(userId);
      const actionId = `undo_${uuidv4().slice(0, 8)}`;
      const expiresAt = new Date(Date.now() + 600000).toISOString();
      saveUndoRecord(userId, {
        actionId,
        expiresAt,
        expiresInSeconds: 600,
        label: `Remove ${lead.companyName || lead.contactName}`,
        action: 'DELETE',
        endpoint: `/api/v1/leads/${lead.id}`,
        method: 'DELETE',
        targetIds: [lead.id],
        available: true,
        uiReverse: {
          action: 'DELETE_ROW',
          target: 'leads-table',
          rowId: lead.id,
        },
      });
      const metrics = await getLeadMetrics(orgId);
      saveUserMemory(userId, {
        lastAction: {
          type: 'CREATE',
          module: 'Leads',
          recordId: lead.id,
          recordLabel: `${lead.contactName || '-'} — ${lead.companyName || '-'}`,
          timestamp: new Date().toISOString(),
          page: currentPage,
        },
      });
      const response = buildCreateResponse(lead, aiScore, actionId, expiresAt, metrics);
      return res.json({ success: true, message: response.chatOutput.headline, structured: response });
    }

    if (intent === 'BULK_CREATE_LEADS') {
      const records = aiResponse.result?.records?.map((r) => r.data) || aiResponse.apiCall?.payload?.leads || [];
      if (!records.length) {
        return res.json({ success: true, message: 'No records found to import.', structured: aiResponse });
      }
      const bulkResult = await bulkCreateLeads(orgId, userId, records);
      clearPendingLeadData(userId);
      const metrics = await getLeadMetrics(orgId);
      const actionId = `undo_bulk_${uuidv4().slice(0, 8)}`;
      const expiresAt = new Date(Date.now() + 600000).toISOString();
      saveUndoRecord(userId, {
        actionId,
        expiresAt,
        expiresInSeconds: 600,
        label: `Remove ${bulkResult.created.length} leads`,
        action: 'BULK_DELETE',
        endpoint: '/api/v1/leads/bulk-delete',
        method: 'POST',
        targetIds: bulkResult.created.map((r) => r.id),
        available: true,
        uiReverse: { action: 'BULK_DELETE_ROWS', target: 'leads-table', rowIds: bulkResult.created.map((r) => r.id) },
      });
      const response = buildBulkResponse(bulkResult, actionId, expiresAt, metrics);
      return res.json({ success: true, message: response.chatOutput.headline, structured: response });
    }

    if (intent === 'UPDATE_LEAD') {
      const payload = aiResponse.actions?.[0]?.payload || {};
      const leadId = aiResponse.actions?.[0]?.responseId || payload.id;
      if (!leadId) {
        return res.json({
          success: true,
          message: 'Which lead would you like to update?',
          structured: {
            intent: 'CLARIFICATION_NEEDED',
            clarificationNeeded: true,
            clarificationQuestion: 'Which lead would you like to update?',
          },
        });
      }
      const updated = await updateLead(orgId, leadId, payload);
      const metrics = await getLeadMetrics(orgId);
      return res.json({
        success: true,
        message: 'Lead updated successfully',
        structured: {
          intent: 'UPDATE_LEAD',
          result: {
            status: 'SUCCESS',
            updated: 1,
            created: 0,
            deleted: 0,
            skipped: 0,
            failed: 0,
            records: [{ id: updated.id, entity: 'Lead', data: updated }],
            errors: [],
          },
          chatOutput: {
            headline: 'Lead Updated',
            summary: `Lead ${updated.companyName || updated.contactName} updated`,
            details: [],
            warnings: [],
            aiInsights: [],
            undoLine: '',
            suggestions: [],
          },
          uiPayload: {
            action: 'UPDATE_ROW',
            target: 'leads-table',
            data: updated,
            metricsUpdate: {
              NEW_LEADS: { newTotal: metrics.NEW_LEADS },
              CONTACTED: { newTotal: metrics.CONTACTED },
              QUALIFIED: { newTotal: metrics.QUALIFIED },
              CONVERTED: { newTotal: metrics.CONVERTED },
              LOST: { newTotal: metrics.LOST },
            },
          },
          undoPayload: null,
        },
      });
    }

    if (intent === 'DELETE_LEAD') {
      const leadId = aiResponse.actions?.[0]?.responseId || aiResponse.actions?.[0]?.payload?.id;
      if (!leadId) {
        return res.json({
          success: true,
          message: 'Which lead would you like to delete?',
          structured: { intent: 'CLARIFICATION_NEEDED', clarificationNeeded: true },
        });
      }
      const deleted = await softDeleteLead(orgId, leadId);
      const metrics = await getLeadMetrics(orgId);
      const actionId = `undo_del_${uuidv4().slice(0, 8)}`;
      const expiresAt = new Date(Date.now() + 600000).toISOString();
      const undoRecord = {
        actionId,
        expiresAt,
        expiresInSeconds: 600,
        label: `Restore ${deleted.companyName || deleted.contactName}`,
        action: 'RESTORE',
        endpoint: '/api/v1/ai/aria/undo',
        method: 'POST',
        targetIds: [deleted.id],
        available: true,
        uiReverse: { action: 'RESTORE_ROW', target: 'leads-table', rowId: deleted.id },
      };
      saveUndoRecord(userId, undoRecord);
      return res.json({
        success: true,
        message: 'Lead deleted',
        structured: {
          intent: 'DELETE_LEAD',
          chatOutput: {
            headline: 'Lead Deleted',
            summary: 'Lead has been soft deleted.',
            details: [],
            warnings: [],
            aiInsights: [],
            undoLine: 'Undo available — expires in 10:00',
            suggestions: [],
          },
          uiPayload: {
            action: 'DELETE_ROW',
            target: 'leads-table',
            data: { id: deleted.id },
            metricsUpdate: {
              NEW_LEADS: { newTotal: metrics.NEW_LEADS },
              CONTACTED: { newTotal: metrics.CONTACTED },
              QUALIFIED: { newTotal: metrics.QUALIFIED },
              CONVERTED: { newTotal: metrics.CONVERTED },
              LOST: { newTotal: metrics.LOST },
            },
          },
          undoPayload: undoRecord,
        },
      });
    }

    if (intent === 'FETCH_LEADS') {
      const filters = aiResponse.actions?.[0]?.payload || {};
      const leads = await fetchLeads(orgId, filters);
      return res.json({
        success: true,
        message: `Found ${leads.length} leads`,
        structured: {
          intent: 'FETCH_LEADS',
          result: {
            status: 'SUCCESS',
            created: 0,
            updated: 0,
            deleted: 0,
            skipped: 0,
            failed: 0,
            records: leads.map((l) => ({ id: l.id, entity: 'Lead', data: l })),
            errors: [],
          },
          chatOutput: {
            headline: `${leads.length} Leads Found`,
            summary: `Showing ${leads.length} leads`,
            details: [],
            warnings: [],
            aiInsights: [],
            undoLine: '',
            suggestions: [],
          },
          uiPayload: { action: 'REPLACE_TABLE', target: 'leads-table', rows: leads },
          undoPayload: null,
        },
      });
    }

    return res.json({
      success: true,
      message: aiResponse.chatOutput?.summary || 'Action completed.',
      structured: aiResponse,
    });
  } catch (error) {
    console.error('[ARIA] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'ARIA encountered an error. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

export async function handleAriaUndo(req, res) {
  try {
    const userId = req.user?.id || 'anonymous';
    const orgId = resolveTenant(req);
    const { actionId } = req.body;
    if (!actionId) {
      return res.status(400).json({ success: false, message: 'actionId is required' });
    }

    const undoRecord = getUndoRecord(userId, actionId);
    if (!undoRecord) {
      return res.status(404).json({
        success: false,
        message: 'Undo record not found or already expired (10 min limit)',
      });
    }
    if (new Date() > new Date(undoRecord.expiresAt)) {
      return res.status(410).json({ success: false, message: 'Undo window has expired' });
    }

    if (undoRecord.action === 'DELETE') {
      for (const id of undoRecord.targetIds || []) {
        await softDeleteLead(orgId, id);
      }
    } else if (undoRecord.action === 'RESTORE') {
      for (const id of undoRecord.targetIds || []) {
        await restoreLead(orgId, id);
      }
    } else if (undoRecord.action === 'BULK_DELETE') {
      await prisma.lead.updateMany({
        where: { id: { in: undoRecord.targetIds || [] }, orgId },
        data: { isDeleted: true, updatedAt: new Date() },
      });
    }

    markUndoUsed(userId, actionId);
    return res.json({
      success: true,
      message: 'Action reversed successfully',
      uiReverse: undoRecord.uiReverse || null,
    });
  } catch (error) {
    console.error('[ARIA Undo] Error:', error);
    return res.status(500).json({ success: false, message: 'Undo failed. Please try again.' });
  }
}
