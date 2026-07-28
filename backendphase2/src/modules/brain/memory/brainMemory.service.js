/**
 * Brain conversation memory — tenant + user scoped.
 * Reuses AssistantPageHistory for durable multi-instance storage.
 */

import {
  getAssistantHistory,
  upsertAssistantHistory,
} from '../../ai/assistantHistory.service.js';

const BRAIN_PAGE_PREFIX = 'brain:';

export function brainSessionKey(sessionKey = 'default') {
  const key = String(sessionKey || 'default')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]/g, '-')
    .slice(0, 80);
  return `${BRAIN_PAGE_PREFIX}${key || 'default'}`;
}

export async function loadBrainMemory(userId, sessionKey = 'default') {
  const pageKey = brainSessionKey(sessionKey);
  const history = await getAssistantHistory(userId, pageKey);
  return {
    pageKey,
    messages: Array.isArray(history.messages) ? history.messages : [],
    conversationMemory: history.conversationMemory || {
      userIntent: '',
      lastActions: [],
      currentPageContext: '',
      userPreferences: [],
      frequentlyUsedActions: [],
      updatedAt: null,
    },
    taskMemory: history.taskMemory || { tasks: [] },
    actionLog: history.actionLog || [],
    updatedAt: history.updatedAt || null,
  };
}

export async function saveBrainTurn({
  userId,
  sessionKey = 'default',
  pathname = null,
  priorMessages = [],
  userMessage,
  assistantMessage,
  memoryUpdate = null,
  actionLogItem = null,
}) {
  const pageKey = brainSessionKey(sessionKey);
  const existing = await loadBrainMemory(userId, sessionKey);

  const nextMessages = [
    ...(Array.isArray(priorMessages) && priorMessages.length
      ? priorMessages
      : existing.messages),
    {
      id: `user-${Date.now()}`,
      role: 'user',
      content: String(userMessage || '').slice(0, 8000),
    },
    {
      id: `assistant-${Date.now() + 1}`,
      role: 'assistant',
      content: String(assistantMessage || '').slice(0, 8000),
    },
  ].slice(-40);

  const conversationMemory = {
    ...(existing.conversationMemory || {}),
    ...(memoryUpdate || {}),
    updatedAt: new Date().toISOString(),
  };

  const actionLog = [
    ...(existing.actionLog || []).slice(-25),
    ...(actionLogItem ? [actionLogItem] : []),
  ].slice(-30);

  return upsertAssistantHistory(userId, pageKey, {
    pathname,
    messages: nextMessages,
    conversationMemory,
    taskMemory: existing.taskMemory,
    actionLog,
  });
}

export function buildMemoryContextBlock(memory) {
  if (!memory) return 'No prior brain memory.';
  const cm = memory.conversationMemory || {};
  const lines = [
    `User intent: ${cm.userIntent || '—'}`,
    `Last actions: ${(cm.lastActions || []).join('; ') || '—'}`,
    `Page context: ${cm.currentPageContext || '—'}`,
    `Recent turns: ${(memory.messages || []).slice(-6).map((m) => `${m.role}: ${String(m.content || '').slice(0, 160)}`).join(' | ') || '—'}`,
  ];
  return lines.join('\n');
}

export const brainMemory = {
  brainSessionKey,
  loadBrainMemory,
  saveBrainTurn,
  buildMemoryContextBlock,
};
