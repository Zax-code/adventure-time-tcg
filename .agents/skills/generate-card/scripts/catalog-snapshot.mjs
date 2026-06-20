#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const database = process.env.CARD_DB_NAME || "adventure_time_phoenix_dev";
const user = process.env.CARD_DB_USER || "postgres";

function runPsql(sql) {
  try {
    return execFileSync(
      "docker",
      [
        "compose",
        "exec",
        "-T",
        "postgres",
        "psql",
        "-U",
        user,
        "-d",
        database,
        "-X",
        "-A",
        "-t",
        "-c",
        sql,
      ],
      { encoding: "utf8" },
    ).trim();
  } catch (error) {
    const stderr = error.stderr?.toString?.() ?? "";
    throw new Error(
      `Could not query Docker Postgres. Is the compose stack running?\n${stderr}`,
    );
  }
}

function jsonQuery(sql) {
  const raw = runPsql(sql);
  return raw ? JSON.parse(raw) : [];
}

function mdTable(rows, columns) {
  if (!rows.length) return "_No rows._";

  const header = `| ${columns.map((column) => column.label).join(" | ")} |`;
  const separator = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map(
    (row) =>
      `| ${columns
        .map((column) => String(row[column.key] ?? "").replaceAll("|", "\\|"))
        .join(" | ")} |`,
  );

  return [header, separator, ...body].join("\n");
}

const rarityStats = jsonQuery(`
  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.drop_rate), '[]'::jsonb)::text
  FROM (
    SELECT
      r.name AS rarity,
      r.drop_rate,
      count(*)::int AS cards,
      min(c.hp)::int AS min_hp,
      round(avg(c.hp), 1)::float AS avg_hp,
      max(c.hp)::int AS max_hp,
      min(c.attack)::int AS min_attack,
      round(avg(c.attack), 1)::float AS avg_attack,
      max(c.attack)::int AS max_attack,
      min(c.defense)::int AS min_defense,
      round(avg(c.defense), 1)::float AS avg_defense,
      max(c.defense)::int AS max_defense,
      min(c.speed)::int AS min_speed,
      round(avg(c.speed), 1)::float AS avg_speed,
      max(c.speed)::int AS max_speed
    FROM cards c
    JOIN rarities r ON r.id = c.rarity_id
    WHERE NOT c.is_archived
    GROUP BY r.name, r.drop_rate
  ) t;
`);

const typeCounts = jsonQuery(`
  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.type), '[]'::jsonb)::text
  FROM (
    SELECT c.type, count(*)::int AS cards
    FROM cards c
    WHERE NOT c.is_archived
    GROUP BY c.type
  ) t;
`);

const abilityPayloadKeys = jsonQuery(`
  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.key), '[]'::jsonb)::text
  FROM (
    SELECT key, count(*)::int AS abilities
    FROM (
      SELECT jsonb_object_keys(payload::jsonb) AS key
      FROM ability_defs
    ) keys
    GROUP BY key
  ) t;
`);

const abilityCounts = jsonQuery(`
  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.type), '[]'::jsonb)::text
  FROM (
    SELECT type, count(*)::int AS abilities
    FROM ability_defs
    GROUP BY type
  ) t;
`);

const cards = jsonQuery(`
  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.drop_rate, t.name, t.character), '[]'::jsonb)::text
  FROM (
    SELECT
      c.name,
      c.character,
      r.name AS rarity,
      r.drop_rate,
      c.hp,
      c.attack,
      c.defense,
      c.speed,
      c.type,
      c.image_asset_id,
      p.key AS passive,
      s.key AS skill,
      u.key AS ultimate
    FROM cards c
    JOIN rarities r ON r.id = c.rarity_id
    LEFT JOIN card_abilities ca ON ca.card_id = c.id
    LEFT JOIN ability_defs p ON p.id = ca.passive_id
    LEFT JOIN ability_defs s ON s.id = ca.skill_id
    LEFT JOIN ability_defs u ON u.id = ca.ultimate_id
    WHERE NOT c.is_archived
  ) t;
`);

if (process.argv.includes("--json")) {
  console.log(
    JSON.stringify(
      { rarityStats, typeCounts, abilityCounts, abilityPayloadKeys, cards },
      null,
      2,
    ),
  );
  process.exit(0);
}

console.log("# Local Card Catalog Snapshot\n");
console.log("Source: Docker compose `postgres` service, not seed data.\n");

console.log("## Rarity Stat Bands\n");
console.log(
  mdTable(rarityStats, [
    { key: "rarity", label: "Rarity" },
    { key: "cards", label: "Cards" },
    { key: "avg_hp", label: "Avg HP" },
    { key: "avg_attack", label: "Avg Atk" },
    { key: "avg_defense", label: "Avg Def" },
    { key: "avg_speed", label: "Avg Spd" },
    { key: "min_hp", label: "HP Min" },
    { key: "max_hp", label: "HP Max" },
    { key: "min_attack", label: "Atk Min" },
    { key: "max_attack", label: "Atk Max" },
    { key: "min_defense", label: "Def Min" },
    { key: "max_defense", label: "Def Max" },
    { key: "min_speed", label: "Spd Min" },
    { key: "max_speed", label: "Spd Max" },
  ]),
);

console.log("\n## Type Counts\n");
console.log(
  mdTable(typeCounts, [
    { key: "type", label: "Type" },
    { key: "cards", label: "Cards" },
  ]),
);

console.log("\n## Ability Counts\n");
console.log(
  mdTable(abilityCounts, [
    { key: "type", label: "Ability Type" },
    { key: "abilities", label: "Count" },
  ]),
);

console.log("\n## Payload Keys In Use\n");
console.log(
  mdTable(abilityPayloadKeys, [
    { key: "key", label: "Payload Key" },
    { key: "abilities", label: "Abilities" },
  ]),
);

console.log("\n## Active Cards\n");
console.log(
  mdTable(cards, [
    { key: "name", label: "Name" },
    { key: "character", label: "Character" },
    { key: "rarity", label: "Rarity" },
    { key: "hp", label: "HP" },
    { key: "attack", label: "Atk" },
    { key: "defense", label: "Def" },
    { key: "speed", label: "Spd" },
    { key: "type", label: "Type" },
    { key: "passive", label: "Passive" },
    { key: "skill", label: "Skill" },
    { key: "ultimate", label: "Ultimate" },
  ]),
);
