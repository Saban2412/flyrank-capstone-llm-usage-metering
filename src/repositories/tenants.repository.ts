import { TenantWithSubscription } from "../types/billing.js";
import { Tenant } from "../types/billing.js";
import { pool } from "../db/pool.js";
import { PlanCode } from "../types/billing.js";

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
    const tenants = await pool.query("SELECT * FROM tenants");
    return tenants.rows.map(mapRowsToTenant);
  }
  async findByEmail(email: string): Promise<boolean> {
    const tenant = await pool.query(`SELECT * FROM tenants WHERE email = $1`, [
      email.toLocaleLowerCase(),
    ]);
    if (tenant.rows.length === 0) return false;
    return true;
  }
  async findById(id: number): Promise<Tenant | undefined> {
    const tenant = await pool.query(`SELECT * FROM tenants WHERE id = $1`, [
      id,
    ]);
    if (tenant.rows.length === 0) return undefined;
    return mapRowsToTenant(tenant.rows[0]);
  }
  async findByIdWithSubscription(
    id: number,
  ): Promise<TenantWithSubscription | undefined> {
    const tenant = await this.findById(id);
    if (!tenant) return undefined;
    const TenantWithSubscription = await pool.query(
      `
        SELECT
            t.id,
            t.name,
            t.email,
            t.created_at,
            s.id AS subscription_id,
            s.status,
            s.current_period_start,
            s.current_period_end,
            p.code AS plan_code,
            p.name AS plan_name,
            p.max_tokens_per_month,
            p.max_api_calls_per_month
            FROM tenants t
            JOIN subscriptions s ON s.tenant_id = t.id
            JOIN plans p ON p.id = s.plan_id
            WHERE t.id = $1;
        `,
      [tenant.id],
    );
    return mapRowToTenantWithSubscription(TenantWithSubscription.rows[0]);
  }
  async createWithSubscription(data: {
    name: string;
    email: string;
    planCode: PlanCode;
  }): Promise<TenantWithSubscription | undefined> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const planRes = await client.query(
        `SELECT * FROM plans WHERE code = $1`,
        [data.planCode],
      );
      const plan = planRes.rows[0];
      if (!plan) {
        await client.query("ROLLBACK");
        throw new Error(`Plan ${data.planCode} is not found.`);
      }

      const tenantRes = await client.query(
        `INSERT INTO tenants (name, email)
       VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING
       RETURNING *`,
        [data.name, data.email.toLowerCase()],
      );

      if (tenantRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return undefined;
      }

      const tenant = tenantRes.rows[0];

      const subRes = await client.query(
        `INSERT INTO subscriptions (tenant_id, plan_id, current_period_start, current_period_end)
       VALUES ($1, $2, NOW(), NOW() + INTERVAL '30 days')
       RETURNING *`,
        [tenant.id, plan.id],
      );

      const sub = subRes.rows[0];

      await client.query("COMMIT");

      return {
        id: Number(tenant.id),
        name: tenant.name,
        email: tenant.email,
        createdAt: tenant.created_at,
        subscription: {
          id: Number(sub.id),
          planCode: plan.code,
          planName: plan.name,
          status: sub.status,
          maxTokensPerMonth: Number(plan.max_tokens_per_month),
          maxApiCallsPerMonth: Number(plan.max_api_calls_per_month),
          currentPeriodStart: sub.current_period_start,
          currentPeriodEnd: sub.current_period_end,
        },
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
  async updateSubscriptionPlan(
    tenantId: number,
    planCode: PlanCode,
  ): Promise<TenantWithSubscription> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const planRes = await client.query(
        `SELECT * FROM plans WHERE code = $1`,
        [planCode],
      );
      const plan = planRes.rows[0];
      if (!plan) {
        throw new Error(`Plan ${planCode} is not found.`);
      }

      const tenantRes = await client.query(
        `SELECT * FROM tenants WHERE id = $1`,
        [tenantId],
      );
      const tenant = tenantRes.rows[0];
      if (!tenant) {
        throw new Error(`Tenant with id: ${tenantId} is not found!`);
      }

      const updateRes = await client.query(
        `UPDATE subscriptions
       SET plan_id = $1, status = 'ACTIVE', updated_at = NOW()
       WHERE tenant_id = $2
       RETURNING *`,
        [plan.id, tenantId],
      );
      const sub = updateRes.rows[0];
      if (!sub) {
        throw new Error("Tenant has no active subscription record!");
      }

      await client.query("COMMIT");

      return {
        id: Number(tenant.id),
        name: tenant.name,
        email: tenant.email,
        createdAt: tenant.created_at,
        subscription: {
          id: Number(sub.id),
          planCode: plan.code,
          planName: plan.name,
          status: sub.status,
          maxTokensPerMonth: Number(plan.max_tokens_per_month),
          maxApiCallsPerMonth: Number(plan.max_api_calls_per_month),
          currentPeriodStart: sub.current_period_start,
          currentPeriodEnd: sub.current_period_end,
        },
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
  async upgradeTenantFromStripeWebhook(params: {
    stripeEventId: string;
    eventType: string;
    tenantId: number;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
  }): Promise<{ alreadyProcessed: boolean }> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const insertEventRes = await client.query(
        `INSERT INTO processed_webhook_events (stripe_event_id, event_type)
       VALUES ($1, $2)
       ON CONFLICT (stripe_event_id) DO NOTHING
       RETURNING stripe_event_id;`,
        [params.stripeEventId, params.eventType],
      );

      if (insertEventRes.rowCount === 0) {
        await client.query("COMMIT");
        return { alreadyProcessed: true };
      }

      const planRes = await client.query<{ id: number }>(
        `SELECT id FROM plans WHERE code = 'PRO' LIMIT 1;`,
      );
      const plan = planRes.rows[0];
      if (!plan) {
        throw new Error("PRO plan not found in database.");
      }

      // 3. Ažuriraj pretplatu tenanta
      await client.query(
        `UPDATE subscriptions
       SET plan_id = $1,
           status = 'ACTIVE',
           stripe_customer_id = COALESCE($2, stripe_customer_id),
           stripe_subscription_id = COALESCE($3, stripe_subscription_id),
           current_period_start = NOW(),
           current_period_end = NOW() + INTERVAL '30 days'
       WHERE tenant_id = $4;`,
        [
          plan.id,
          params.stripeCustomerId,
          params.stripeSubscriptionId,
          params.tenantId,
        ],
      );

      await client.query("COMMIT");
      return { alreadyProcessed: false };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
  async downgradeTenantToFreeFromWebhook(params: {
    stripeEventId: string;
    eventType: string;
    stripeSubscriptionId: string;
  }): Promise<{ alreadyProcessed: boolean }> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const insertEventRes = await client.query(
        `INSERT INTO processed_webhook_events (stripe_event_id, event_type)
       VALUES ($1, $2)
       ON CONFLICT (stripe_event_id) DO NOTHING
       RETURNING stripe_event_id;`,
        [params.stripeEventId, params.eventType],
      );

      if (insertEventRes.rowCount === 0) {
        await client.query("COMMIT");
        return { alreadyProcessed: true };
      }

      const planRes = await client.query<{ id: number }>(
        `SELECT id FROM plans WHERE code = 'FREE' LIMIT 1;`,
      );
      const freePlan = planRes.rows[0];
      if (!freePlan) {
        throw new Error("FREE plan not found in database.");
      }

      await client.query(
        `UPDATE subscriptions
       SET plan_id = $1,
           status = 'CANCELED',
           stripe_subscription_id = NULL
       WHERE stripe_subscription_id = $2;`,
        [freePlan.id, params.stripeSubscriptionId],
      );

      await client.query("COMMIT");
      return { alreadyProcessed: false };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
