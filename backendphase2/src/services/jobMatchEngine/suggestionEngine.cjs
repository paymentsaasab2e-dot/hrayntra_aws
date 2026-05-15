// File   : suggestionEngine.cjs
// Purpose: Batch LLM suggestions for pairs above threshold.
// Part of: HRJob+Candidate Matching Pipeline v1.0

const SUGGESTION_BATCH_SIZE = Number(process.env.MATCH_SUGGESTION_BATCH_SIZE || 20) || 20;

async function jobMatchChatCompletion(body, logLabel) {
  const { chatCompletionWithFallback } = await import('../llmChatFallback.service.js');
  return chatCompletionWithFallback(body, logLabel, { quiet: false });
}

function highestPassLabel(p) {
  const scores = [
    ['Skills Match', p.pass1?.score],
    ['Experience', p.pass2?.score],
    ['Semantic Fit', p.pass3?.score],
    ['Cultural Fit', p.pass4?.skipped ? -1 : p.pass4?.score],
  ];
  scores.sort((a, b) => (b[1] || 0) - (a[1] || 0));
  return scores[0][0];
}

function lowestPassLabel(p) {
  const scores = [
    ['Skills Match', p.pass1?.score ?? 0],
    ['Experience', p.pass2?.score ?? 0],
    ['Semantic Fit', p.pass3?.score ?? 0],
    ['Cultural Fit', p.pass4?.skipped ? 100 : p.pass4?.score ?? 0],
  ];
  scores.sort((a, b) => (a[1] || 0) - (b[1] || 0));
  return scores[0][0];
}

async function generateSuggestions(pairs) {
  const out = [];
  if (!pairs?.length) return out;

  for (let batchStart = 0; batchStart < pairs.length; batchStart += SUGGESTION_BATCH_SIZE) {
    const batch = pairs.slice(batchStart, batchStart + SUGGESTION_BATCH_SIZE);
    const system =
      'You are an expert HR recruiter analyst. For each candidate-job pair, write one suggestion: 2-3 sentences. Respond ONLY JSON object: { "items": [ {"index":0,"suggestion":"..."} ] }. No markdown.';

    const blocks = batch.map((p, i) => {
      const top = highestPassLabel(p);
      const low = lowestPassLabel(p);
      const hi = Math.max(
        p.pass1?.score || 0,
        p.pass2?.score || 0,
        p.pass3?.score || 0,
        p.pass4?.skipped ? 0 : p.pass4?.score || 0
      );
      const lo = Math.min(
        p.pass1?.score || 0,
        p.pass2?.score || 0,
        p.pass3?.score || 0,
        p.pass4?.skipped ? 100 : p.pass4?.score || 0
      );
      return (
        `Index: ${i}\n` +
        `Candidate: ${p.candidateName}\n` +
        `Job: ${p.jobTitle}\n` +
        `Overall: ${p.band} (${p.finalScore}/100)\n` +
        `Strength: ${p.topStrength || top} (pillar high ~${hi})\n` +
        `Gap: ${p.topWeakness || low} (pillar low ~${lo})\n` +
        `Matched skills: ${(p.matchedSkills || []).join(', ')}\n` +
        `Missing skills: ${(p.missingSkills || []).join(', ')}`
      );
    });

    const user = `Generate suggestions for ${batch.length} pairs:\n${blocks.join('\n---\n')}`;

    try {
      const completion = await jobMatchChatCompletion(
        {
          model: process.env.OPENAI_JOB_MATCH_MODEL || 'gpt-4o-mini',
          temperature: 0.35,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        },
        'job-match-suggestions'
      );
      const raw = completion?.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed.items) ? parsed.items : [];
      const byIdx = new Map(items.map((it) => [Number(it.index), String(it.suggestion || '').trim()]));
      for (let i = 0; i < batch.length; i += 1) {
        const globalIndex = batchStart + i;
        const sug =
          byIdx.get(i) ||
          `Strong match on ${highestPassLabel(batch[i])}. Review ${lowestPassLabel(batch[i])} during interview.`;
        out.push({ pairIndex: globalIndex, suggestion: sug });
      }
    } catch {
      for (let i = 0; i < batch.length; i += 1) {
        const p = batch[i];
        const globalIndex = batchStart + i;
        out.push({
          pairIndex: globalIndex,
          suggestion: `Strong match on ${highestPassLabel(p)}. Review ${lowestPassLabel(p)} during interview.`,
        });
      }
    }
  }

  return out;
}

module.exports = { generateSuggestions, SUGGESTION_BATCH_SIZE };
