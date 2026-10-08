import { defineConfig } from "drizzle-kit";

// Archived legacy schema. Phoenix (Ecto) owns the live database, so there is no
// default URL: point LEGACY_DATABASE_URL at a disposable legacy database explicitly.
const legacyDatabaseUrl = process.env.LEGACY_DATABASE_URL;

if (!legacyDatabaseUrl) {
  throw new Error(
    "LEGACY_DATABASE_URL is required; never run legacy Drizzle migrations against the Phoenix database.",
  );
}

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: legacyDatabaseUrl,
  },
});
