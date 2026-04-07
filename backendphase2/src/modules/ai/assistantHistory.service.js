import { prisma } from '../../config/prisma.js';

const MAX_HISTORY_MESSAGES = 50;
const MAX_CONTENT_LENGTH = 8000;
const MAX_ACTION_LOGS = 30;
const MAX_TASKS = 20;

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter(
      (message) =>
        message &&
        typeof message.id === 'string' &&
        (message.role === 'user' || message.role === 'assistant' || message.role === 'system') &&
        typeof message.content === 'string'
    )
    .map((message) => ({
      id: message.id,
      role: message.role,
      content: String(message.content).slice(0, MAX_CONTENT_LENGTH),
    }))
    .slice(-MAX_HISTORY_MESSAGES);
}

function normalizeString(value, max = 255) {
  return String(value || '').trim().slice(0, max);
}

function normalizeStringArray(values, maxItems = 12, maxItemLength = 120) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => normalizeString(value, maxItemLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeConversationMemory(memory) {
  if (!memory || typeof memory !== 'object') {
    return {
      userIntent: '',
      lastActions: [],
      currentPageContext: '',
      userPreferences: [],
      frequentlyUsedActions: [],
      updatedAt: null,
    };
  }

  return {
    userIntent: normalizeString(memory.userIntent, 500),
    lastActions: normalizeStringArray(memory.lastActions, 12, 180),
    currentPageContext: normalizeString(memory.currentPageContext, 500),
    userPreferences: normalizeStringArray(memory.userPreferences, 12, 180),
    frequentlyUsedActions: normalizeStringArray(memory.frequentlyUsedActions, 12, 180),
    updatedAt: memory.updatedAt ? new Date(memory.updatedAt).toISOString() : null,
  };
}

function normalizeTaskMemory(taskMemory) {
  const tasks = Array.isArray(taskMemory?.tasks) ? taskMemory.tasks : [];
  return {
    tasks: tasks
      .map((task, index) => ({
        task_id: normalizeString(task?.task_id || `task-${index + 1}`, 120),
        goal: normalizeString(task?.goal, 500),
        steps: normalizeStringArray(task?.steps, 20, 220),
        completed_steps: normalizeStringArray(task?.completed_steps, 20, 220),
        pending_steps: normalizeStringArray(task?.pending_steps, 20, 220),
        status: ['in_progress', 'completed', 'pending'].includes(String(task?.status || ''))
          ? String(task.status)
          : 'pending',
      }))
      .filter((task) => task.goal || task.steps.length || task.completed_steps.length || task.pending_steps.length)
      .slice(-MAX_TASKS),
  };
}

function normalizeActionLog(actionLog) {
  if (!Array.isArray(actionLog)) return [];
  return actionLog
    .map((action, index) => ({
      action_id: normalizeString(action?.action_id || `action-${index + 1}`, 120),
      entity: normalizeString(action?.entity, 120),
      operation: normalizeString(action?.operation, 120),
      previous_state: action?.previous_state ?? null,
      new_state: action?.new_state ?? null,
      summary: normalizeString(action?.summary, 500),
      createdAt: action?.createdAt ? new Date(action.createdAt).toISOString() : new Date().toISOString(),
    }))
    .filter((action) => action.entity || action.operation || action.summary)
    .slice(-MAX_ACTION_LOGS);
}

function normalizeStoragePayload(payload) {
  if (Array.isArray(payload)) {
    return {
      messages: normalizeMessages(payload),
      conversationMemory: normalizeConversationMemory(null),
      taskMemory: normalizeTaskMemory(null),
      actionLog: [],
    };
  }

  return {
    messages: normalizeMessages(payload?.messages),
    conversationMemory: normalizeConversationMemory(payload?.conversationMemory),
    taskMemory: normalizeTaskMemory(payload?.taskMemory),
    actionLog: normalizeActionLog(payload?.actionLog),
  };
}

function validatePageKey(pageKey) {
  const value = String(pageKey || '').trim();
  if (!value) {
    const err = new Error('pageKey is required');
    err.code = 'VALIDATION';
    throw err;
  }
  return value.slice(0, 100);
}

export async function getAssistantHistory(userId, pageKey) {
  const normalizedPageKey = validatePageKey(pageKey);
  const row = await prisma.assistantPageHistory.findUnique({
    where: {
      userId_pageKey: {
        userId,
        pageKey: normalizedPageKey,
      },
    },
  });

  const normalizedPayload = normalizeStoragePayload(row?.messages);

  return {
    pageKey: normalizedPageKey,
    pathname: row?.pathname || null,
    messages: normalizedPayload.messages,
    conversationMemory: normalizedPayload.conversationMemory,
    taskMemory: normalizedPayload.taskMemory,
    actionLog: normalizedPayload.actionLog,
    updatedAt: row?.updatedAt || null,
  };
}

export async function upsertAssistantHistory(userId, pageKey, payload = {}) {
  const normalizedPageKey = validatePageKey(pageKey);
  const normalizedPathname = String(payload.pathname || '').trim().slice(0, 255) || null;
  const existing = await prisma.assistantPageHistory.findUnique({
    where: {
      userId_pageKey: {
        userId,
        pageKey: normalizedPageKey,
      },
    },
  });

  const existingPayload = normalizeStoragePayload(existing?.messages);
  const normalizedPayload = normalizeStoragePayload({
    messages: payload.messages !== undefined ? payload.messages : existingPayload.messages,
    conversationMemory:
      payload.conversationMemory !== undefined ? payload.conversationMemory : existingPayload.conversationMemory,
    taskMemory: payload.taskMemory !== undefined ? payload.taskMemory : existingPayload.taskMemory,
    actionLog: payload.actionLog !== undefined ? payload.actionLog : existingPayload.actionLog,
  });

  const row = await prisma.assistantPageHistory.upsert({
    where: {
      userId_pageKey: {
        userId,
        pageKey: normalizedPageKey,
      },
    },
    update: {
      pathname: normalizedPathname,
      messages: normalizedPayload,
    },
    create: {
      userId,
      pageKey: normalizedPageKey,
      pathname: normalizedPathname,
      messages: normalizedPayload,
    },
  });

  const storedPayload = normalizeStoragePayload(row.messages);

  return {
    pageKey: normalizedPageKey,
    pathname: row.pathname || null,
    messages: storedPayload.messages,
    conversationMemory: storedPayload.conversationMemory,
    taskMemory: storedPayload.taskMemory,
    actionLog: storedPayload.actionLog,
    updatedAt: row.updatedAt,
  };
}

export async function deleteAssistantHistory(userId, pageKey) {
  const normalizedPageKey = validatePageKey(pageKey);
  await prisma.assistantPageHistory.deleteMany({
    where: {
      userId,
      pageKey: normalizedPageKey,
    },
  });

  return { pageKey: normalizedPageKey, deleted: true };
}
