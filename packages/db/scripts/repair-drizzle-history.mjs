#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import pg from "pg";

const { Client } = pg;

const migrationsFolder = new URL("../drizzle/", import.meta.url);
const journalPath = new URL("../drizzle/meta/_journal.json", import.meta.url);
const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5434/adventure_time_tcg";

async function loadMigrations() {
  const journal = JSON.parse(await readFile(journalPath, "utf8"));

  return Promise.all(
    journal.entries.map(async (entry) => {
      const filePath = new URL(`${entry.tag}.sql`, migrationsFolder);
      const sql = await readFile(filePath, "utf8");

      return {
        tag: entry.tag,
        createdAt: entry.when,
        hash: createHash("sha256").update(sql).digest("hex"),
      };
    }),
  );
}

async function main() {
  const migrations = await loadMigrations();
  const client = new Client({ connectionString });

  await client.connect();

  try {
    await client.query("BEGIN");
    await client.query("CREATE SCHEMA IF NOT EXISTS drizzle");
    await client.query(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);

    for (const migration of migrations) {
      const existing = await client.query(
        "select 1 from drizzle.__drizzle_migrations where created_at = $1",
        [migration.createdAt],
      );

      if (existing.rowCount) {
        continue;
      }

      await client.query(
        "insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)",
        [migration.hash, migration.createdAt],
      );
      console.log(`Recorded ${migration.tag}`);
    }

    await client.query("COMMIT");
    console.log("Drizzle migration history repaired.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Failed to repair Drizzle migration history:", error);
  process.exit(1);
});
