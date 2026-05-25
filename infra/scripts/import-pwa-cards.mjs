#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";

import { Client as MinioClient } from "minio";
import pg from "pg";

const { Client } = pg;

const OLD_ENV_PATH = "/home/zax/adventure-time-tcg/.env.postgres.production.local";
const NEW_ENV_PATH = "/home/zax/adventure-time-tcg-secrets/api.env";
const OLD_API_BASE_URL = "https://game.leaetzak.love";

function parseEnvFile(contents) {
  const values = {};
  for (const line of contents.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) {
      continue;
    }
    const [key, ...rest] = line.split("=");
    values[key.trim()] = rest.join("=").trim();
  }
  return values;
}

function extensionForMimeType(mimeType) {
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/svg+xml") return ".svg";
  return "";
}

async function streamToBuffer(stream) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

async function main() {
  const [oldEnvRaw, newEnvRaw, packsSeedRaw] = await Promise.all([
    readFile(OLD_ENV_PATH, "utf8"),
    readFile(NEW_ENV_PATH, "utf8"),
    readFile("/home/zax/adventure-time-tcg/data/seed/packs.json", "utf8"),
  ]);

  const oldEnv = parseEnvFile(oldEnvRaw);
  const newEnv = parseEnvFile(newEnvRaw);
  const packsSeed = JSON.parse(packsSeedRaw);

  const oldDb = new Client({ connectionString: oldEnv.DATABASE_URL });
  const newDb = new Client({ connectionString: newEnv.DATABASE_URL });

  const oldMinio = new MinioClient({
    endPoint: new URL(oldEnv.S3_ENDPOINT).hostname,
    port: Number(new URL(oldEnv.S3_ENDPOINT).port || 80),
    useSSL: new URL(oldEnv.S3_ENDPOINT).protocol === "https:",
    accessKey: oldEnv.S3_ACCESS_KEY_ID,
    secretKey: oldEnv.S3_SECRET_ACCESS_KEY,
  });

  const newMinio = new MinioClient({
    endPoint: newEnv.MINIO_ENDPOINT,
    port: Number(newEnv.MINIO_PORT),
    useSSL: newEnv.MINIO_USE_SSL === "true",
    accessKey: newEnv.MINIO_ACCESS_KEY,
    secretKey: newEnv.MINIO_SECRET_KEY,
  });

  await oldDb.connect();
  await newDb.connect();

  try {
    const response = await fetch(`${OLD_API_BASE_URL}/api/cards`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch PWA cards: ${response.status}`);
    }

    const cards = await response.json();
    let imported = 0;

    for (const card of cards) {
      let rarityRow = (
        await newDb.query(`select id from rarities where name = $1 limit 1`, [card.rarity.name])
      ).rows[0];

      if (!rarityRow) {
        const rarityId = card.rarity.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        rarityRow = (
          await newDb.query(
            `insert into rarities (id, name, drop_rate, color)
             values ($1, $2, $3, $4)
             on conflict (name) do update set drop_rate = excluded.drop_rate, color = excluded.color
             returning id`,
            [rarityId, card.rarity.name, card.rarity.dropRate, card.rarity.color],
          )
        ).rows[0];
      } else {
        await newDb.query(`update rarities set drop_rate = $2, color = $3 where id = $1`, [rarityRow.id, card.rarity.dropRate, card.rarity.color]);
      }

      let imageAssetId = null;
      const mediaMatch = typeof card.imageUrl === "string" ? card.imageUrl.match(/\/api\/media\/card\/([a-f0-9-]+)/i) : null;

      if (mediaMatch) {
        const oldAssetId = mediaMatch[1];
        const oldAssetResult = await oldDb.query(
          `select id, "objectKey" as object_key, "mimeType" as mime_type from "ImageAsset" where id = $1`,
          [oldAssetId],
        );

        const oldAsset = oldAssetResult.rows[0];
        if (oldAsset?.object_key) {
          const oldObjectStream = await oldMinio.getObject(oldEnv.S3_BUCKET_PRIVATE, oldAsset.object_key);
          const objectBuffer = await streamToBuffer(oldObjectStream);
          const extension = extensionForMimeType(oldAsset.mime_type);
          const objectKey = `imports/cards/${card.id}${extension}`;

          await newMinio.putObject(newEnv.MINIO_BUCKET, objectKey, objectBuffer, objectBuffer.length, {
            "Content-Type": oldAsset.mime_type,
          });

          imageAssetId = `imported-card-${card.id}`;
          await newDb.query(
            `insert into image_assets (id, kind, mime_type, object_key, created_at)
             values ($1, 'card', $2, $3, now())
             on conflict (id) do update set mime_type = excluded.mime_type, object_key = excluded.object_key`,
            [imageAssetId, oldAsset.mime_type, objectKey],
          );
        }
      }

      await newDb.query(
        `insert into cards (
          id, name, character, description, hp, attack, defense, speed, type, rarity_id, image_asset_id, is_featured, is_archived, created_at, updated_at
        ) values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now(), now()
        )
        on conflict (id) do update set
          name = excluded.name,
          character = excluded.character,
          description = excluded.description,
          hp = excluded.hp,
          attack = excluded.attack,
          defense = excluded.defense,
          speed = excluded.speed,
          type = excluded.type,
          rarity_id = excluded.rarity_id,
          image_asset_id = excluded.image_asset_id,
          is_featured = excluded.is_featured,
          is_archived = excluded.is_archived,
          updated_at = now()`,
        [
          card.id,
          card.name,
          card.character,
          card.description,
          card.hp,
          card.attack,
          card.defense,
          card.speed ?? 40,
          card.type,
          rarityRow.id,
          imageAssetId,
          Boolean(card.isFeatured),
          Boolean(card.isArchived),
        ],
      );

      imported += 1;
    }

    for (const pack of packsSeed) {
      await newDb.query(
        `insert into packs (id, name, description, card_count, cost, image_url, color, is_active, guaranteed_rarity)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         on conflict (id) do update set
           name = excluded.name,
           description = excluded.description,
           card_count = excluded.card_count,
           cost = excluded.cost,
           image_url = excluded.image_url,
           color = excluded.color,
           is_active = excluded.is_active,
           guaranteed_rarity = excluded.guaranteed_rarity`,
        [
          pack.id,
          pack.name,
          pack.description,
          pack.cardCount,
          pack.cost,
          `${OLD_API_BASE_URL}${pack.imageUrl}`,
          pack.color,
          pack.isActive,
          pack.guaranteedRarity,
        ],
      );
    }

    console.log(`Imported ${imported} cards and ${packsSeed.length} packs into the native database.`);
  } finally {
    await Promise.allSettled([oldDb.end(), newDb.end()]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
