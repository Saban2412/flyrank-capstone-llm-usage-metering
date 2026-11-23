INSERT INTO plans (code, name, monthly_price_cents, max_tokens_per_month, max_api_calls_per_month)
VALUES
  ('FREE', 'Free Tier', 0, 1500, 10),
  ('PRO', 'Pro Tier', 2900, 1000000, 10000)
ON CONFLICT (code) DO NOTHING;