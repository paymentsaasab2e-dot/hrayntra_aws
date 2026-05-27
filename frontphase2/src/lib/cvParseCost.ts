/** Rough USD estimates per 1M tokens (input / output) for CV parse cost display. */
const MODEL_RATES: Array<{ match: RegExp; inputPerM: number; outputPerM: number }> = [
  { match: /gpt-4o-mini/i, inputPerM: 0.15, outputPerM: 0.6 },
  { match: /gpt-4o/i, inputPerM: 2.5, outputPerM: 10 },
  { match: /gpt-3\.5/i, inputPerM: 0.5, outputPerM: 1.5 },
  { match: /mistral/i, inputPerM: 0.2, outputPerM: 0.6 },
];

const DEFAULT_RATE = { inputPerM: 0.15, outputPerM: 0.6 };

function ratesForModel(model: string | null | undefined) {
  const name = String(model || '').trim();
  if (!name) return DEFAULT_RATE;
  const hit = MODEL_RATES.find((row) => row.match.test(name));
  return hit || DEFAULT_RATE;
}

export function estimateCvParseCostUsd(
  inputTokens: number,
  outputTokens: number,
  model: string | null | undefined,
): number {
  const { inputPerM, outputPerM } = ratesForModel(model);
  const input = Math.max(0, Number(inputTokens) || 0);
  const output = Math.max(0, Number(outputTokens) || 0);
  return (input * inputPerM + output * outputPerM) / 1_000_000;
}

export function formatUsd(amount: number): string {
  if (amount >= 1) return `$${amount.toFixed(2)}`;
  if (amount >= 0.01) return `$${amount.toFixed(2)}`;
  if (amount > 0) return `$${amount.toFixed(4)}`;
  return '$0.00';
}
