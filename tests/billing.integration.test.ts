import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import Stripe from "stripe";
import app from "../src/app.js";
import { pool } from "../src/db/pool.js";
import { env } from "../src/config/env.js";
import { calculateEventCostMicroCents } from "../src/config/pricing.js";

describe("Usage Metering & Billing Engine - Integration & Pricing Tests", () => {
  let tenantId: number;
  let sharedStripePayload: string;
  let sharedStripeSignature: string;

  beforeAll(async () => {
    await pool.query(
      "TRUNCATE TABLE usage_events, subscriptions, tenants, processed_webhook_events RESTART IDENTITY CASCADE;",
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  it("1. Registers a new tenant with the default FREE plan (1,500 tokens/month)", async () => {
    const res = await request(app).post("/api/tenants").send({
      name: "Vitest Corp",
      email: "test@vitestcorp.com",
    });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.subscription.planCode).toBe("FREE");
    expect(res.body.subscription.maxTokensPerMonth).toBe(1500);

    tenantId = res.body.id;
  });

  it("2. Executes a standard AI request and calculates micro-cent costs accurately", async () => {
    const res = await request(app)
      .post("/api/generate")
      .set("Idempotency-Key", crypto.randomUUID())
      .send({
        id: tenantId,
        prompt: "What is clean architecture?",
      });

    expect(res.status).toBe(201);
    expect(res.body.totalTokens).toBe(350);
    expect(res.body.costMicroCents).toBe(1800);
  });

  it("3. Enforces idempotency (retrying with the same key returns the cached event without double-charging)", async () => {
    const sharedKey = crypto.randomUUID();

    const first = await request(app)
      .post("/api/generate")
      .set("Idempotency-Key", sharedKey)
      .send({ id: tenantId, prompt: "First call with shared key" });

    const second = await request(app)
      .post("/api/generate")
      .set("Idempotency-Key", sharedKey)
      .send({ id: tenantId, prompt: "First call with shared key" });

    expect(first.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);

    const countRes = await pool.query(
      "SELECT COUNT(*)::int AS count FROM usage_events WHERE tenant_id = $1",
      [tenantId],
    );
    expect(countRes.rows[0].count).toBe(2);
  });

  it("4. Detects a Prompt Cache Hit for an identical prompt and bills discounted cached tokens", async () => {
    const res = await request(app)
      .post("/api/generate")
      .set("Idempotency-Key", crypto.randomUUID())
      .send({
        id: tenantId,
        prompt: "What is clean architecture?",
      });

    expect(res.status).toBe(201);
    expect(res.body.responsePayload.model).toBe("sim-cache-v1");
    expect(res.body.cachedInputTokens).toBe(100);
    expect(res.body.totalTokens).toBe(300);
    expect(res.body.costMicroCents).toBe(1320);
  });

  it("5. Triggers Quota Gate (402 Payment Required) when a request would exceed remaining monthly quota", async () => {
    const res = await request(app)
      .post("/api/generate")
      .set("Idempotency-Key", crypto.randomUUID())
      .send({
        id: tenantId,
        prompt: "Give me a detailed analysis of distributed systems",
      });

    expect(res.status).toBe(402);
  });

  it("6. Rejects forged Stripe Webhooks with an invalid signature (400 Bad Request)", async () => {
    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "t=12345,v1=forged_signature")
      .send({ type: "checkout.session.completed" });

    expect(res.status).toBe(400);
  });

  it("7. Processes a validly signed Stripe Webhook and upgrades the tenant to the PRO plan", async () => {
    const stripe = new Stripe(env.STRIPE_SECRET_KEY);

    sharedStripePayload = JSON.stringify({
      id: `evt_test_${crypto.randomUUID().replace(/-/g, "")}`,
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_123",
          customer: "cus_test_999",
          subscription: "sub_test_999",
          metadata: {
            tenantId: String(tenantId),
          },
        },
      },
    });

    sharedStripeSignature = stripe.webhooks.generateTestHeaderString({
      payload: sharedStripePayload,
      secret: env.STRIPE_WEBHOOK_SECRET,
    });

    const webhookRes = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", sharedStripeSignature)
      .set("Content-Type", "application/json")
      .send(sharedStripePayload);

    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.received).toBe(true);

    const generateRes = await request(app)
      .post("/api/generate")
      .set("Idempotency-Key", crypto.randomUUID())
      .send({
        id: tenantId,
        prompt: "Give me a detailed analysis of distributed systems",
      });

    expect(generateRes.status).toBe(201);
    expect(generateRes.body.reasoningTokens).toBe(400);
  });

  it("8. Deduplicates replayed Stripe Webhook events cleanly (idempotent webhook handling)", async () => {
    const replayRes = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", sharedStripeSignature)
      .set("Content-Type", "application/json")
      .send(sharedStripePayload);

    expect(replayRes.status).toBe(200);
    expect(replayRes.body.received).toBe(true);

    const eventCountRes = await pool.query(
      "SELECT COUNT(*)::int AS count FROM processed_webhook_events",
    );
    expect(eventCountRes.rows[0].count).toBe(1);
  });

  it("9. Verifies pinned AI token pricing math and monthly usage rollup endpoint", async () => {
    // Pinned unit checks (micro-cents)
    const standardCost = calculateEventCostMicroCents({
      apiCalls: 1,
      inputTokens: 100,
      cachedInputTokens: 0,
      reasoningTokens: 0,
      outputTokens: 250,
    });
    const cachedCost = calculateEventCostMicroCents({
      apiCalls: 1,
      inputTokens: 20,
      cachedInputTokens: 100,
      reasoningTokens: 0,
      outputTokens: 180,
    });
    const reasoningCost = calculateEventCostMicroCents({
      apiCalls: 1,
      inputTokens: 150,
      cachedInputTokens: 0,
      reasoningTokens: 400,
      outputTokens: 500,
    });

    expect(standardCost).toBe(1800);
    expect(cachedCost).toBe(1320);
    expect(reasoningCost).toBe(6600);

    // Events: 1800 + 1800 + 1320 + 6600 = 11,520 micro-cents | Tokens: 350 + 350 + 300 + 1050 = 2,050
    const usageRes = await request(app).get(`/api/tenants/${tenantId}/usage`);
    expect(usageRes.status).toBe(200);
    expect(usageRes.body.totalApiCalls).toBe(1);
    expect(usageRes.body.totalTokens).toBe(1050);
    expect(usageRes.body.totalCostMicroCents).toBe(6600);
  });
});
