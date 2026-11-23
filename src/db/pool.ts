import { Pool } from "pg";
import { env } from "../config/env.js";

export const pool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
});

// Logujemo ako dođe do neočekivanog prekida na neaktivnoj konekciji u bazenu
pool.on("error", (err) => {
  console.error("[POSTGRES POOL ERROR]:", err);
});
