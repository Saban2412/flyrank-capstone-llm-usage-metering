import { TokenBreakdown } from "../config/pricing.js";

export interface SimulatedAiResult extends TokenBreakdown {
  answer: string;
  model: string;
}

export function simulateAiCompletion(
  prompt: string,
  cacheHit: boolean,
): SimulatedAiResult {
  const normalized = prompt.trim().toLowerCase();

  if (normalized.includes("detailed") || normalized.includes("think")) {
    return {
      model: "sim-reasoning-v1",
      answer:
        "[REASONING RESPONSE] Your prompt contains key words that includes reasoning LLM model.",
      apiCalls: 1,
      inputTokens: 150,
      cachedInputTokens: 0,
      reasoningTokens: 400,
      outputTokens: 500,
    };
  }

  if (cacheHit || normalized.includes("again")) {
    return {
      model: "sim-cache-v1",
      answer: "[CACHE RESPONSE] Your prompt has been found in cache.",
      apiCalls: 1,
      inputTokens: 20,
      cachedInputTokens: 100,
      reasoningTokens: 0,
      outputTokens: 180,
    };
  }

  return {
    model: "sim-standard-v1",
    answer: "[STANDARD RESPONSE] this is a standard LLM answer.",
    apiCalls: 1,
    inputTokens: 100,
    cachedInputTokens: 0,
    reasoningTokens: 0,
    outputTokens: 250,
  };
}
