import { TenantWithSubscription } from "../types/billing.js";
import { Tenant } from "../types/billing.js";
import { pool } from "../db/pool.js";

function mapRowToTenantWithSubscription(row: any): TenantWithSubscription {
  return {
    id: Number(row.id),
    name: row.name,
    email: row.email,
    createdAt: row.created_at,
    subscription: {
      id: Number(row.subscription_id),
      planCode: row.plan_code,
      planName: row.plan_name,
      status: row.status,
      maxTokensPerMonth: Number(row.max_tokens_per_month),
      maxApiCallsPerMonth: Number(row.max_api_calls_per_month),
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
    },
  };
}
function mapRowsToTenant(row: any): Tenant {
  return {
    id: Number(row.id),
    name: row.name,
    email: row.email,
    createdAt: row.created_at,
  };
}

export class TenantRepository {
  async findAllTenants(): Promise<Tenant[]> {
    const tenants = await pool.query("RETURN * FROM tenants");
    return tenants.rows.map(mapRowsToTenant);
  }
  async findByEmail(email: string): Promise<boolean> {
    const tenant = await pool.query(`SELECT * FROM tenants WHERE email = $1`, [
      email.toLocaleLowerCase(),
    ]);
    if (tenant.rows.length === 0) return false;
    return true;
  }
}
