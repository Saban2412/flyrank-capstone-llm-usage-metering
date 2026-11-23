-- 1. Ubacujemo dva testna tenanta (idempotentno preko ON CONFLICT)
INSERT INTO tenants (name, email)
VALUES
  ('Starter Studio', 'free@starterstudio.io'),
  ('Acme Enterprise', 'billing@acme.io')
ON CONFLICT (email) DO NOTHING;

-- 2. Kreiramo aktivnu FREE pretplatu za prvog tenanta
INSERT INTO subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end)
SELECT
  t.id,
  p.id,
  'ACTIVE',
  NOW(),
  NOW() + INTERVAL '30 days'
FROM tenants t
CROSS JOIN plans p
WHERE t.email = 'free@starterstudio.io'
  AND p.code = 'FREE'
ON CONFLICT (tenant_id) DO NOTHING;

-- 3. Kreiramo aktivnu PRO pretplatu za drugog tenanta
INSERT INTO subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end)
SELECT
  t.id,
  p.id,
  'ACTIVE',
  NOW(),
  NOW() + INTERVAL '30 days'
FROM tenants t
CROSS JOIN plans p
WHERE t.email = 'billing@acme.io'
  AND p.code = 'PRO'
ON CONFLICT (tenant_id) DO NOTHING;