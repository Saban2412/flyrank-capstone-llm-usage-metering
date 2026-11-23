export type PlanCode = "FREE" | "PRO";
export type SubscriptionStatus = "ACTIVE" | "PAST_DUE" | "CANCELED";

export interface Plans {
  id: number;
  code: PlanCode;
  name: string;
  monthlyPriceCents: number;
  maxTokensPerMonth: number;
  maxApiCallsPerMonth: number;
}
export interface TenantWithSubscription {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
  subscription: {
    id: number;
    planCode: PlanCode;
    planName: string;
    status: SubscriptionStatus;
    maxTokensPerMonth: number;
    maxApiCallsPerMonth: number;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  };
}
export interface Tenant {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}
export interface UsageEvent {
  id: number;
  tenantId: number;
  idempotencyKey: string;
  endpoint: string;
  apiCalls: number;
  inputTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
  outputTokens: number;
  totakTokens: number;
  constMicroCents: number;
  responsePayload: Record<string, unknown>;
  recordedAt: Date;
}
