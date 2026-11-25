import dotenv from "dotenv";
import { z } from "zod";

// Učitava .env fajl u process.env
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().default(5432),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_test_"),
  STRIPE_PRO_PRICE_ID: z.string().startsWith("price_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
  APP_BASE_URL: z.url().default("http://localhost:3000"),
});

export const env = envSchema.parse(process.env);
