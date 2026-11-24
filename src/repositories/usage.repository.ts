import { date } from "zod";
import { pool } from "../db/pool.js";
import {
  UsageEvent,
  PeriodUsageSummary,
  CreateUsageEventInput,
} from "../types/billing.js";

function mapRowsToUsageEvent(row: any): UsageEvent {
  return {
    id: Number(row.id),
    tenantId: Number(row.tenant_id),
    idempotencyKey: row.idempotency_key,
    endpoint: row.endpoint,
    apiCalls: Number(row.api_calls),
    inputTokens: Number(row.input_tokens),
    cachedInputTokens: Number(row.cached_input_tokens),
    reasoningTokens: Number(row.reasoning_tokens),
    outputTokens: Number(row.output_tokens),
    totalTokens: Number(row.total_tokens),
    costMicroCents: Number(row.cost_micro_cents),
    responsePayload: row.response_payload,
    recordedAt: row.recorded_at,
  };
}
function mapRowsToPeriodUsageSummary(row: any): PeriodUsageSummary {
  return {
    totalApiCalls: Number(row.total_api_calls),
    totalInputTokens: Number(row.total_input_tokens),
    totalCachedInputTokens: Number(row.total_cached_input_tokens),
    totalReasoningTokens: Number(row.total_reasoning_tokens),
    totalOutputTokens: Number(row.total_output_tokens),
    totalTokens: Number(row.total_tokens),
    totalCostMicroCents: Number(row.total_cost_micro_cents),
  };
}

export class UsageRepository {
  async findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<UsageEvent | undefined> {
    const eventRes = await pool.query(
      `SELECT * FROM usage_events WHERE idempotency_key = $1`,
      [idempotencyKey],
    );
    if (eventRes.rows.length === 0) return undefined;
    const event = eventRes.rows[0];
    return event;
  }
  async getPeriodUsageSummary(
    tenantId: number,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<PeriodUsageSummary> {
    const usageRes = await pool.query(
      `SELECT 
      COALESCE(SUM(api_calls), 0) AS total_api_calls,
      COALESCE(SUM(input_tokens), 0) AS total_input_tokens,
      COALESCE(SUM(cached_input_tokens), 0) AS total_cached_input_tokens,
      COALESCE(SUM(reasoning_tokens), 0) AS total_reasoning_tokens,
      COALESCE(SUM(output_tokens), 0) AS total_output_tokens,
      COALESCE(SUM(total_tokens), 0) AS total_tokens,
      COALESCE(SUM(cost_micro_cents), 0) AS total_cost_micro_cents
   FROM usage_events
   WHERE tenant_id = $1
     AND recorded_at >= $2
     AND recorded_at < $3;`,
      [tenantId, periodStart, periodEnd],
    );

    const usage = mapRowsToPeriodUsageSummary(usageRes.rows[0]);
    return usage;
  }
  async createEvent(data: CreateUsageEventInput): Promise<UsageEvent> {
    const result = await pool.query(
      `
        INSERT INTO usage_events (tenant_id, idempotency_key, endpoint, api_calls, input_tokens, cached_input_tokens, reasoning_tokens, output_tokens, total_tokens, cost_micro_cents, response_payload,prompt_hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
        ON CONFLICT (idempotency_key) DO NOTHING 
        RETURNING *`,
      [
        data.tenantId,
        data.idempotencyKey,
        data.endpoint,
        data.apiCalls,
        data.inputTokens,
        data.cachedInputTokens,
        data.reasoningTokens,
        data.outputTokens,
        data.totalTokens,
        data.costMicroCents,
        data.responsePayload,
        data.promptHash,
      ],
    );
    if (result.rows.length === 0) {
      const existingEvent = await this.findByIdempotencyKey(
        data.idempotencyKey,
      );
      if (!existingEvent) {
        throw new Error("Usage event was not found after idempotency conflict");
      }
      return existingEvent;
    }
    return mapRowsToUsageEvent(result.rows[0]);
  }
  async findByTenantId(tenantId: number): Promise<UsageEvent[]> {
    const result = await pool.query(
      `SELECT * FROM usage_events WHERE tenant_id = $1 ORDER BY recorded_at ASC`,
      [tenantId],
    );
    return result.rows.map(mapRowsToUsageEvent);
  }
  async findByPromptHash(
    tenantId: number,
    promptHash: string,
  ): Promise<boolean> {
    const result = await pool.query(
      `SELECT * FROM usage_events WHERE tenant_id = $1 AND prompt_hash = $2`,
      [tenantId, promptHash],
    );
    if (result.rows.length === 0) return false;
    return true;
  }
}
