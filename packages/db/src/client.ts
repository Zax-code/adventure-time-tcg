import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5434/adventure_time_tcg";

export const pool = new Pool({
  connectionString,
});

export const db = drizzle(pool, { schema });

export type Database = typeof db;
