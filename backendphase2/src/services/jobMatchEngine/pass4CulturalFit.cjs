// File   : pass4CulturalFit.cjs
// Purpose: LLM-based cultural / soft-skills fit (5 x 20 points).
// Part of: HRJob+Candidate Matching Pipeline v1.0

const OPENAI_CHAT_MODEL =
  process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_ASSISTANT_MODEL || 'gpt-4.1';

async function jobMatchChatCompletion(body, logLabel = 'job-match-pass4') {
  const { chatCompletionWithFallback } = await import('../llmChatFallback.service.js');
  return chatCompletionWithFallback({ ...(body || {}), model: OPENAI_CHAT_MODEL }, logLabel, { quiet: false });
}

function truncate(s, n) {
  const t = String(s || '').trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n)}…`;
}

async function computePass4(
  jobCultureText,
  jobTitle,
  candidateSummary,
  candidateSoftSkills,
  candidateTitles,
  skipCondition
) {
  if (skipCondition) {
    return {
      score: 0,
      skipped: true,
      source: 'skipped-no-culture-text',
      dimensions: { workPace: 0, collaboration: 0, communication: 0, leadership: 0, innovation: 0 },
      rawLlmResponse: '',
    };
  }

  const system =
    'You are an expert HR analyst. Evaluate cultural and soft skills fit between a job and a candidate. Respond ONLY with a valid JSON object. No explanation, no markdown, no extra text — only the JSON.';

  const user = `Job Title: ${jobTitle || 'Role'}
Job Culture & Context:
${truncate(jobCultureText, 1500)}

Candidate Summary:
${truncate(candidateSummary, 1000)}
Candidate Past Titles: ${(candidateTitles || []).join(', ')}
Candidate Soft Skills: ${(candidateSoftSkills || []).join(', ')}

Evaluate these 5 cultural dimensions. For each, assign 20 if there is a reasonable fit, or 0 if there is a clear mismatch or insufficient info.

Respond with ONLY this JSON:
{
  "workPace"      : 20,
  "collaboration" : 20,
  "communication" : 20,
  "leadership"    : 20,
  "innovation"    : 20,
  "reasoning"     : "one sentence explaining the overall cultural fit"
}`;

  let raw = '';
  try {
    const completion = await jobMatchChatCompletion(
      {
        model: OPENAI_CHAT_MODEL,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      },
      'job-match-pass4'
    );
    raw = completion?.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(raw);
    const wp = Number(parsed.workPace) >= 10 ? 20 : 0;
    const col = Number(parsed.collaboration) >= 10 ? 20 : 0;
    const com = Number(parsed.communication) >= 10 ? 20 : 0;
    const ld = Number(parsed.leadership) >= 10 ? 20 : 0;
    const inn = Number(parsed.innovation) >= 10 ? 20 : 0;
    const score = wp + col + com + ld + inn;
    return {
      score,
      skipped: false,
      source: 'llm-response',
      dimensions: { workPace: wp, collaboration: col, communication: com, leadership: ld, innovation: inn },
      rawLlmResponse: raw,
      reasoning: parsed.reasoning || '',
    };
  } catch (parseErr) {
    return {
      score: 50,
      skipped: false,
      source: 'default-fallback',
      error: true,
      errorMessage: parseErr?.message || String(parseErr),
      dimensions: { workPace: 10, collaboration: 10, communication: 10, leadership: 10, innovation: 10 },
      rawLlmResponse: raw,
    };
  }
}

module.exports = { computePass4 };
