# Usage Metering & Billing Engine

A production-grade, multi-tenant SaaS Usage Metering, Quota Enforcement, and Subscription Billing Engine built with **TypeScript**, **Node.js**, **Express**, **PostgreSQL**, and **Stripe (Sandbox/Test Mode)**.

Designed around financial correctness: guaranteed no-double-counting under network retries, exact boundary quota enforcement (`402` / `429`), integer micro-cent money math, semantic prompt caching, and HMAC-SHA256 verified Stripe webhooks.

---

## Architecture Overview

The Express API validates requests at the controller boundary, delegates billing
and Stripe operations to services, and reads or writes PostgreSQL through
repositories. Database schema and seed data are managed by sequential SQL
migrations. Stripe webhooks are parsed as raw request bodies so their signatures
can be verified.

```text
+--------+     POST /api/generate (Idempotency-Key)      +-------------------+
| Client | --------------------------------------------> |  Express API      |
+--------+                                               |  (Layered Arch)   |
     |                                                   +-------------------+
     |                                                     |       |       |
     |  1. Deduplicate by Idempotency-Key -----------------+       |       |
     |  2. Check Quota Gate (429 / 402) ---------------------------+       |
     |  3. Check SHA-256 Prompt Cache & Compute Micro-Cents -------+       |
     |                                                             v       |
     |                                                   +-------------------+
     |                                                   |    PostgreSQL     |
     |                                                   | (ACID + Indexes)  |
     |                                                   +-------------------+
     |                                                             ^
     |  POST /api/billing/checkout                                 |
     +-----------------------------> +----------------+            |
                                     | Stripe Sandbox |            |
                                     +----------------+            |
                                             |                     |
                                             | Signed Webhook      |
                                             | (express.raw())     |
                                             +---------------------+
```

### Layered Project Structure

- `src/routes/` & `src/controllers/`: HTTP boundary, Zod input validation, raw buffer handling for Stripe signatures.
- `src/services/`: Business logic — idempotency gates, quota enforcement, LLM token simulation, Stripe Checkout & webhook handling.
- `src/repositories/`: Parameterized SQL queries, transactions, and database row mapping.
- `src/config/`: Pinned pricing constants in micro-cents (`1 USD = 1,000,000 micro-cents`) and environment validation.
- `migrations/`: Sequential SQL schema and seed migrations tracked via `schema_migrations`.
- `tests/`: Automated Vitest + Supertest integration and pricing test suite.

---

## Quick Start (One-Command Setup)

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for running the local Vitest test suite)
- A free Stripe Sandbox account (`sk_test_...` and a recurring monthly `price_...`)

### 1. Configure Environment

```bash
cp .env.example .env
```

### 2. Start All Services (PostgreSQL + Migrations + API + Stripe CLI)

```bash
docker compose up -d
```

_(Migrations run automatically on container startup via `npm run migrate && npm run dev`, seeding `FREE` and `PRO` plans)._

### 3. Run the Automated Test Suite

```bash
npm install
npm test
```

---

## API Reference

| Name                                   | Method | Endpoint                 | Description                                                                                                 |
| :------------------------------------- | :----- | :----------------------- | :---------------------------------------------------------------------------------------------------------- |
| `create_tenant`                        | `POST` | `/api/tenants`           | Creates a tenant and subscription; `planCode` defaults to `FREE`.                                           |
| `get_tenants`                          | `GET`  | `/api/tenants`           | Lists tenants.                                                                                              |
| `get_tenant_with_subscription_details` | `GET`  | `/api/tenants/:id`       | Gets a tenant and its subscription details.                                                                 |
| `meter_generate`                       | `POST` | `/api/generate`          | Records a billable generation request. Requires an `Idempotency-Key` UUID header and `{ id, prompt }` body. |
| `usage_rollup`                         | `GET`  | `/api/tenants/:id/usage` | Returns the current period usage rollup, including API calls, tokens, and cost in micro-cents.              |
| `get_plans`                            | `GET`  | `/api/plans`             | Lists available subscription plans.                                                                         |
| `stripe_checkout`                      | `POST` | `/api/billing/checkout`  | Creates a Stripe Checkout session; request body includes `tenantId`.                                        |
| `stripe_webhook`                       | `POST` | `/api/webhooks/stripe`   | Verifies and processes Stripe webhook events using the `stripe-signature` header.                           |

### AI Token Pricing Rules (Pinned Micro-Cents)

All monetary values are stored as `BIGINT` micro-cents (`$1.00 = 1,000,000 micro-cents`) to eliminate IEEE 754 floating-point drift:

- **Base API Call:** `100` micro-cents / call
- **Fresh Input Tokens:** `2` micro-cents / token
- **Cached Input Tokens:** `1` micro-cent / token (50% discount via per-tenant SHA-256 prompt cache)
- **Output Tokens:** `6` micro-cents / token
- **Reasoning Tokens:** `8` micro-cents / token

---

## Honest Limitations & Non-Goals

- **No Invoicing or Overage Billing:** Requests exceeding the plan quota are strictly blocked (`402 Payment Required` / `429 Too Many Requests`) rather than billed as pay-as-you-go overages.
- **No Mid-Cycle Proration:** Upgrading from `FREE` to `PRO` immediately resets the 30-day billing window (`current_period_start = NOW()`) rather than calculating partial-month credits.
- **Deterministic LLM Simulator:** Token counts are deterministically generated based on prompt keywords and SHA-256 cache hits rather than calling an external paid LLM API.
