import OpenAI from 'openai';
import { env } from '../../config/env.js';
import { executeAssistantDataTool, userHasFullDbAccess, safeSerialize } from './assistantDataTools.js';

const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

const SYSTEM_PROMPT = `You are an AI copilot embedded in a recruitment / ATS web application (candidates, jobs, clients, leads, interviews, placements, tasks, team).

You have access to a tool that reads **live data** from the connected database for the signed-in user. Use it whenever the user asks about real records, counts, names, statuses, dates, or "how many / who / list / show me".

Guidelines:
- Call \`query_recruitment_data\` proactively for factual questions; combine multiple calls if needed (e.g. counts then a list).
- Summarize results clearly; do not dump huge JSON to the user — highlight key facts and offer to narrow down.
- Never fabricate database facts. If the tool returns empty or an error, say so and suggest filters or where to look in the UI.
- Treat emails and phone numbers as sensitive: share only when relevant and avoid unnecessary exposure in long lists.
- You are not a lawyer; give high-level hiring best practices only.`;

const MAX_MESSAGES = 24;
const MAX_CONTENT_LENGTH = 8000;
const MAX_TOOL_ROUNDS = 6;

const QUERY_RECRUITMENT_DATA_TOOL = {
  type: 'function',
  function: {
    name: 'query_recruitment_data',
    description:
      'Fetch structured recruitment data (counts, lists, or a single record by id) scoped to what this user may see in the app.',
    parameters: {
      type: 'object',
      properties: {
        query_type: {
          type: 'string',
          enum: [
            'counts',
            'candidates',
            'jobs',
            'clients',
            'leads',
            'placements',
            'interviews',
            'tasks',
            'team_users',
            'candidate_by_id',
            'job_by_id',
            'client_by_id',
            'lead_by_id',
            'placement_by_id',
          ],
          description: 'Which dataset or record to load.',
        },
        search: {
          type: 'string',
          description: 'Optional text filter for list-style queries (name, email, title, company, etc.).',
        },
        limit: {
          type: 'integer',
          description: 'Max rows for lists (1–80). Default ~28.',
        },
        record_id: {
          type: 'string',
          description: 'Mongo ObjectId when using *_by_id query types.',
        },
      },
      required: ['query_type'],
    },
  },
};

/**
 * @param {{ role: string; content: string }[]} messages
 * @param {{ id?: string; name?: string | null; role?: string | null } | null | undefined} user
 */
export async function runAssistantChat(messages, user) {
  if (!openai) {
    const err = new Error('AI assistant is not configured. Set OPENAI_API_KEY on the server.');
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    const err = new Error('At least one message is required');
    err.code = 'VALIDATION';
    throw err;
  }

  const cleaned = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({
      role: m.role,
      content: String(m.content).slice(0, MAX_CONTENT_LENGTH),
    }))
    .slice(-MAX_MESSAGES);

  if (cleaned.length === 0) {
    const err = new Error('No valid messages to send');
    err.code = 'VALIDATION';
    throw err;
  }

  const model = env.OPENAI_ASSISTANT_MODEL || 'gpt-4o-mini';
  const userLine = user?.name ? `\nSigned-in user: ${user.name} (${user.role || 'user'}).` : '';

  const scopeHint = userHasFullDbAccess(user)
    ? 'Data access: **organization-wide** (admin-level read).'
    : 'Data access: **scoped** — only records this user created, is assigned to, or is linked to (e.g. their placements/interviews).';

  const systemContent = `${SYSTEM_PROMPT}\n\n${scopeHint}${userLine}`;

  /** @type {any[]} */
  let apiMessages = [{ role: 'system', content: systemContent }, ...cleaned];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const response = await openai.chat.completions.create({
      model,
      messages: apiMessages,
      tools: [QUERY_RECRUITMENT_DATA_TOOL],
      tool_choice: 'auto',
      max_tokens: 2200,
      temperature: 0.55,
    });

    const msg = response.choices?.[0]?.message;
    if (!msg) {
      const err = new Error('Empty response from AI');
      err.code = 'AI_EMPTY';
      throw err;
    }

    if (msg.tool_calls?.length) {
      apiMessages.push({
        role: 'assistant',
        content: msg.content && String(msg.content).trim() ? msg.content : null,
        tool_calls: msg.tool_calls,
      });

      for (const tc of msg.tool_calls) {
        if (tc.type !== 'function') continue;
        const fn = tc.function;
        let payload = {};
        try {
          payload = JSON.parse(fn.arguments || '{}');
        } catch {
          payload = {};
        }

        let toolResult;
        if (fn.name === 'query_recruitment_data') {
          toolResult = await executeAssistantDataTool(user, payload);
        } else {
          toolResult = { ok: false, error: `Unknown tool: ${fn.name}` };
        }

        apiMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: safeSerialize(toolResult),
        });
      }
      continue;
    }

    const text = typeof msg.content === 'string' ? msg.content.trim() : '';
    if (!text) {
      const err = new Error('Empty response from AI');
      err.code = 'AI_EMPTY';
      throw err;
    }
    return text;
  }

  const err = new Error('Assistant could not finish within tool round limit. Please try a simpler question.');
  err.code = 'TOOL_LIMIT';
  throw err;
}
