#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import pg from "pg";

const { Client } = pg;

function parseEnvFile(contents) {
  const values = {};
  for (const line of contents.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    values[key.trim()] = rest.join("=").trim();
  }
  return values;
}

const oldEnv = parseEnvFile(await readFile("/home/zax/adventure-time-tcg/.env.postgres.production.local", "utf8"));
const newEnv = parseEnvFile(await readFile("/home/zax/adventure-time-native-secrets/api.env", "utf8"));
const oldDb = new Client({ connectionString: oldEnv.DATABASE_URL });
const newDb = new Client({ connectionString: newEnv.DATABASE_URL });

await oldDb.connect();
await newDb.connect();

try {
  const abilities = await oldDb.query('select id, key, name, description, "descriptionFr", "nameFr", type, cost, cooldown, "oncePerMatch", payload, "createdAt" from "AbilityDef"');
  for (const row of abilities.rows) {
    await newDb.query(
      `insert into ability_defs (id, key, name, description, description_fr, name_fr, type, cost, cooldown, once_per_match, payload, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())
       on conflict (id) do update set
         key = excluded.key,
         name = excluded.name,
         description = excluded.description,
         description_fr = excluded.description_fr,
         name_fr = excluded.name_fr,
         type = excluded.type,
         cost = excluded.cost,
         cooldown = excluded.cooldown,
         once_per_match = excluded.once_per_match,
         payload = excluded.payload,
         updated_at = now()`,
      [row.id, row.key, row.name, row.description, row.descriptionFr, row.nameFr, row.type, row.cost, row.cooldown, row.oncePerMatch, row.payload, row.createdAt],
    );
  }

  const assignments = await oldDb.query('select id, "cardId", "passiveId", "skillId", "ultimateId", "createdAt" from "CardAbility"');
  for (const row of assignments.rows) {
    await newDb.query(
      `insert into card_abilities (id, card_id, passive_id, skill_id, ultimate_id, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,now())
       on conflict (card_id) do update set
         passive_id = excluded.passive_id,
         skill_id = excluded.skill_id,
         ultimate_id = excluded.ultimate_id,
         updated_at = now()`,
      [row.id, row.cardId, row.passiveId, row.skillId, row.ultimateId, row.createdAt],
    );
  }

  console.log(`Imported ${abilities.rowCount} abilities and ${assignments.rowCount} card assignments.`);
} finally {
  await Promise.allSettled([oldDb.end(), newDb.end()]);
}
