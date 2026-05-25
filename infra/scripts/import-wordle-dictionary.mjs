#!/usr/bin/env node

import { randomUUID } from "node:crypto";
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

const envRaw = await readFile("/home/zax/adventure-time-tcg-secrets/api.env", "utf8");
const env = parseEnvFile(envRaw);
const dictionary = JSON.parse(await readFile("/home/zax/adventure-time-tcg/data/seed/wordle-dictionary.json", "utf8"));
const client = new Client({ connectionString: env.DATABASE_URL });
await client.connect();
try {
  for (const word of dictionary) {
    await client.query(
      `insert into wordle_dictionary_words (id, locale, word, length, is_allowed_guess, is_solution_candidate)
       values ($1, 'fr', $2, $3, true, true)
       on conflict (locale, word) do nothing`,
      [randomUUID(), word, String(word).length],
    );
  }
  console.log(`Imported ${dictionary.length} dictionary words.`);
} finally {
  await client.end();
}
