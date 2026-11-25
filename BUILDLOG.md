# Build Log & AI Collaboration Notes

This log documents how AI assistance was used during development, where AI suggestions failed or introduced bugs, and the engineering decisions I made to resolve them.

---

## Phase 1–2: Architecture, Schema & Metering Engine

- **Where AI helped:** Scaffolding the 3-layer TypeScript structure (`routes -> controllers -> services -> repositories`), Zod validation schemas, and initial PostgreSQL migration runner.
- **Where AI / initial drafts went wrong:**
  1. **Cumulative vs. Per-Event Token Bug:** In an early draft of `BillingService.createUsageEvent`, cumulative monthly tokens (`usage.totalTokens + eventTokens`) were accidentally passed into `createEvent()`, which would have caused exponential double-counting on subsequent `SUM(total_tokens)` rollups. I caught this during code review and separated `eventTokens` (stored per row) from `projectedTokens` (used only for the Quota Gate check).
  2. **HTTP Status Code Typos:** Custom error classes initially had `426` instead of `429` (`TooManyRequestsError`) and `409` instead of `402` (`PaymentRequiredError`). Corrected to match HTTP semantics and capstone specs.
  3. **SQL Mapping & `pg` BigInt Strings:** PostgreSQL `SUM()` returns `BIGINT` values as strings in `node-postgres` and lowercases unquoted aliases. Fixed by explicitly casting `::int` / `::float8` and quoting camelCase aliases in SQL.

## Phase 3: Prompt Caching & Deterministic Simulator

- **My Design Addition:** Added a `prompt_hash` (`SHA-256`) column to `usage_events` scoped per `tenant_id`. When a tenant submits an identical normalized prompt, `UsageRepository.findByPromptHash` detects a cache hit and routes the request to discounted `cachedInputTokens`.

## Phase 4: Stripe Sandbox, Webhooks & Docker Networking

- **Challenges & Fixes:**
  1. **Stripe Dashboard Onboarding Lock:** Creating a standard Stripe account from Bosnia & Herzegovina blocked product creation behind business verification. Resolved by switching to Stripe's isolated **Sandboxes** environment.
  2. **Windows Defender Blocking `stripe.exe`:** Windows Security blocked local Stripe CLI execution. Resolved cleanly by containerizing `stripe/stripe-cli` inside `docker-compose.yml` with a local `.stripe-config` volume (added to `.gitignore`).
  3. **Docker Port Collision (`5432` vs `5436`):** Ports `5432–5435` were occupied by other local containers on the host machine. Mapped PostgreSQL to `5436:5432` for host access while overriding `DB_PORT=5432` and `DATABASE_URL` inside the `api` container's internal Docker network.
  4. **Billing Period Reset on Upgrade:** Integration testing revealed that upgrading from `FREE` to `PRO` via webhook resets `current_period_start = NOW()`, meaning monthly usage rollups cleanly begin a fresh 30-day cycle from the moment of subscription activation.
