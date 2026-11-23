// Fiksirane cijene u MIKRO-CENTIMA po jedinici (1 USD = 1,000,000 mikro-centi)
export const PRICING_MICRO_CENTS = {
  INPUT_TOKEN: 2, // $2.00 po 1M tokena
  CACHED_INPUT_TOKEN: 1, // $1.00 po 1M tokena (50% popusta za keširane tokene!)
  REASONING_TOKEN: 8, // $8.00 po 1M tokena (4x skuplje jer model "razmišlja")
  OUTPUT_TOKEN: 6, // $6.00 po 1M tokena
  API_CALL: 100, // $0.0001 po API pozivu
} as const;

export const MICRO_CENTS_PER_USD = 1_000_000;

export interface TokenBreakdown {
  inputTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
  outputTokens: number;
  apiCalls: number;
}

// Čista, deterministička funkcija za obračun troška jednog zahtjeva
export function calculateEventCostMicroCents(usage: TokenBreakdown): number {
  return (
    usage.inputTokens * PRICING_MICRO_CENTS.INPUT_TOKEN +
    usage.cachedInputTokens * PRICING_MICRO_CENTS.CACHED_INPUT_TOKEN +
    usage.reasoningTokens * PRICING_MICRO_CENTS.REASONING_TOKEN +
    usage.outputTokens * PRICING_MICRO_CENTS.OUTPUT_TOKEN +
    usage.apiCalls * PRICING_MICRO_CENTS.API_CALL
  );
}

export function microCentsToUsd(microCents: number): number {
  return Number((microCents / MICRO_CENTS_PER_USD).toFixed(6));
}
