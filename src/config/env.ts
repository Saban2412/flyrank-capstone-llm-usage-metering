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
});

export const env = envSchema.parse(process.env);
