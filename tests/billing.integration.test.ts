import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import Stripe from "stripe";
import app from "../src/app.js";
import { pool } from "../src/db/pool.js";
import { env } from "../src/config/env.js";

describe("Usage Metering & Billing Engine - Integration Tests", () => {
  let tenantId: number;

  // Reset transactional tables before running the suite to guarantee a clean, deterministic state
  beforeAll(async () => {
    await pool.query(
      "TRUNCATE TABLE usage_events, subscriptions, tenants, processed_webhook_events RESTART IDENTITY CASCADE;",
    );
  });

  // Close the database connection pool after all tests complete
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
    const idempotencyKey = crypto.randomUUID();

    const res = await request(app)
      .post("/api/generate")
      .set("Idempotency-Key", idempotencyKey)
      .send({
        id: tenantId,
        prompt: "What is clean architecture?",
      });

    expect(res.status).toBe(201);
    expect(res.body.totalTokens).toBe(350); // 100 input + 250 output
    expect(res.body.costMicroCents).toBe(1800); // 1*100 + 100*2 + 250*6
  });

  it("3. Enforces idempotency (retrying with the same key returns the cached event without double-charging)", async () => {
    const sharedKey = crypto.randomUUID();

    // First request
    const first = await request(app)
      .post("/api/generate")
      .set("Idempotency-Key", sharedKey)
      .send({ id: tenantId, prompt: "First call with shared key" });

    // Second request (retry with identical Idempotency-Key)
    const second = await request(app)
      .post("/api/generate")
      .set("Idempotency-Key", sharedKey)
      .send({ id: tenantId, prompt: "First call with shared key" });

    expect(first.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);

    // Verify in DB: only 2 usage events should exist so far (from test #2 and test #3)
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
        prompt: "What is clean architecture?", // Identical prompt to test #2
      });

    expect(res.status).toBe(201);
    expect(res.body.responsePayload.model).toBe("sim-cache-v1");
    expect(res.body.cachedInputTokens).toBe(100);
    expect(res.body.totalTokens).toBe(300); // 20 input + 100 cached + 180 output
    expect(res.body.costMicroCents).toBe(1320); // Discounted compared to 1800 micro-cents
  });

  it("5. Triggers Quota Gate (402 Payment Required) when a request would exceed remaining monthly quota", async () => {
    // Consumed so far: 350 + 350 + 300 = 1,000 tokens out of 1,500.
    // A reasoning prompt consumes 1,050 tokens -> 1,000 + 1,050 > 1,500!
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

    const payload = JSON.stringify({
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

    // Generate a valid HMAC-SHA256 signature using STRIPE_WEBHOOK_SECRET
    const validSignature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: env.STRIPE_WEBHOOK_SECRET,
    });

    const webhookRes = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", validSignature)
      .set("Content-Type", "application/json")
      .send(payload);

    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.received).toBe(true);

    // Retry the expensive reasoning prompt from test #5 — it must now succeed on the PRO plan
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
});
