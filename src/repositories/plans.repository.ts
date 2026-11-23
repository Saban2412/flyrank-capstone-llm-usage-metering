import { Plans } from "../types/billing.js";
import { pool } from "../db/pool.js";

function mapRowsToPlans(row: any): Plans {
  return {
    id: Number(row.id),
    code: row.code,
    name: row.name,
    monthlyPriceCents: Number(row.monthly_price_cents),
    maxTokensPerMonth: Number(row.max_tokens_per_month),
    maxApiCallsPerMonth: Number(row.max_api_calls_per_month),
  };
}

export class PlansRepository {
  async findAll(): Promise<Plans[]> {
    const result = await pool.query("SELECT * FROM plans");
    return result.rows.map(mapRowsToPlans);
  }
  async findByCode(code: string): Promise<Plans | undefined> {
    const result = await pool.query(`SELECT * FROM plans WHERE code = $1`, [
      code.toUpperCase(),
    ]);
    if (result.rows.length === 0) return undefined;
    return mapRowsToPlans(result.rows[0]);
  }
}
