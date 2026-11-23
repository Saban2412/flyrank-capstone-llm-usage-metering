import fs from "node:fs/promises";
import path from "node:path";
import { pool } from "./pool.js";

async function runMigrations(): Promise<void> {
  const client = await pool.connect();

  try {
    // 1. Kreiramo tabelu za praćenje migracija ako već ne postoji
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Čitamo sve .sql fajlove iz migrations/ foldera i sortiramo ih (001, 002...)
    const migrationsDir = path.resolve(process.cwd(), "migrations");
    const files = (await fs.readdir(migrationsDir))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      // Provjeravamo da li je ova migracija već izvršena
      const { rows } = await client.query(
        "SELECT 1 FROM schema_migrations WHERE filename = $1",
        [file],
      );

      if (rows.length > 0) {
        console.log(`⏭️  Skipping (done): ${file}`);
        continue;
      }

      console.log(`🚀 Migrating: ${file}...`);
      const sql = await fs.readFile(path.join(migrationsDir, file), "utf-8");

      // Pokrećemo TRANSAKCIJU (BEGIN ... COMMIT)
      // Ako bilo koja komanda u SQL fajlu padne, ROLLBACK poništava cijeli fajl!
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1)",
          [file],
        );
        await client.query("COMMIT");
        console.log(`✅ Done: ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`❌ Migration error ${file}, ROLLBACK!`);
        throw err;
      }
    }

    console.log("🎉 Migrations finished successfuly!");
  } finally {
    // OBAVEZNO vraćamo konekciju nazad u pool i gasimo pool da bi se skripta završila
    client.release();
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
