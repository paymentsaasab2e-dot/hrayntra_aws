/** OpenAI list prices (USD per 1M tokens) for cost estimates on /demoAi — adjust when vendor pricing changes. */
export type OpenAiPricingModel = {
  id: string;
  label: string;
  inputPerM: number;
  outputPerM: number;
};

export const OPENAI_PRICING_MODELS: OpenAiPricingModel[] = [
  { id: 'gpt-4.1', label: 'GPT-4.1', inputPerM: 2.0, outputPerM: 8.0 },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini', inputPerM: 0.4, outputPerM: 1.6 },
  { id: 'gpt-4.1-nano', label: 'GPT-4.1 nano', inputPerM: 0.1, outputPerM: 0.4 },
  { id: 'gpt-4o', label: 'GPT-4o', inputPerM: 2.5, outputPerM: 10.0 },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', inputPerM: 0.15, outputPerM: 0.6 },
  { id: 'gpt-4-turbo', label: 'GPT-4 Turbo', inputPerM: 10.0, outputPerM: 30.0 },
  { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', inputPerM: 0.5, outputPerM: 1.5 },
  { id: 'o1', label: 'o1', inputPerM: 15.0, outputPerM: 60.0 },
  { id: 'o1-mini', label: 'o1-mini', inputPerM: 1.1, outputPerM: 4.4 },
  { id: 'o3-mini', label: 'o3-mini', inputPerM: 1.1, outputPerM: 4.4 },
];

const DEFAULT_MODEL_ID = 'gpt-4o-mini';

export function getOpenAiPricingModel(modelId: string): OpenAiPricingModel {
  return OPENAI_PRICING_MODELS.find((m) => m.id === modelId) ?? OPENAI_PRICING_MODELS.find((m) => m.id === DEFAULT_MODEL_ID)!;
}

export function estimateCostForOpenAiModel(
  inputTokens: number,
  outputTokens: number,
  pricingModelId: string,
): number {
  const model = getOpenAiPricingModel(pricingModelId);
  const input = Math.max(0, Number(inputTokens) || 0);
  const output = Math.max(0, Number(outputTokens) || 0);
  return (input * model.inputPerM + output * model.outputPerM) / 1_000_000;
}

export function formatUsd(amount: number): string {
  if (amount >= 1) return `$${amount.toFixed(2)}`;
  if (amount >= 0.01) return `$${amount.toFixed(4)}`;
  if (amount > 0) return `$${amount.toFixed(6)}`;
  return '$0.00';
}
